from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config_loader import WorkflowNotFoundError, WorkflowConfigLoader
from app.database import Database
from app.external import ExternalDependencyGateway
from app.models import DecisionSnapshot, ExplanationResponse, OperationalOverview, SubmissionRequest, WorkflowConfig, WorkflowSummary
from app.repository import DecisionRepository
from app.service import (
    DuplicateRequestConflictError,
    RequestNotFoundError,
    RetryNotAllowedError,
    SubmissionValidationError,
    WorkflowDecisionService,
)
from app.settings import AppSettings


def create_app(settings: AppSettings | None = None) -> FastAPI:
    settings = settings or AppSettings.from_env()
    ui_root = Path(__file__).resolve().parent / "ui"
    database = Database(settings.db_path)
    repository = DecisionRepository(database)
    config_loader = WorkflowConfigLoader(settings.workflow_dir)
    dependencies = ExternalDependencyGateway()
    service = WorkflowDecisionService(
        config_loader=config_loader,
        repository=repository,
        dependencies=dependencies,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        database.init_db()
        yield

    app = FastAPI(
        title="Workflow Operations Platform",
        version="0.1.0",
        summary="Configurable workflow orchestration service with explainable decisions and operational controls.",
        lifespan=lifespan,
    )
    app.state.settings = settings
    app.state.service = service
    app.mount("/assets", StaticFiles(directory=ui_root / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def home() -> FileResponse:
        return FileResponse(ui_root / "index.html")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/workflows", response_model=list[WorkflowSummary])
    def list_workflows() -> list[WorkflowSummary]:
        return service.list_workflows()

    @app.get("/analytics/overview", response_model=OperationalOverview)
    def get_operational_overview() -> OperationalOverview:
        return service.get_operational_overview()

    @app.get("/workflows/{workflow_name}/config", response_model=WorkflowConfig)
    def get_workflow_config(workflow_name: str) -> WorkflowConfig:
        try:
            return config_loader.load(workflow_name)
        except WorkflowNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.post("/workflows/{workflow_name}/requests", response_model=DecisionSnapshot)
    def submit_request(
        workflow_name: str,
        submission: SubmissionRequest,
        response: Response,
        idempotency_key: str = Header(..., alias="Idempotency-Key"),
    ) -> DecisionSnapshot:
        try:
            snapshot = service.submit(workflow_name, idempotency_key, submission.payload)
        except WorkflowNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except DuplicateRequestConflictError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except SubmissionValidationError as exc:
            response.status_code = 422
            return exc.snapshot

        response.status_code = 200 if snapshot.idempotent_replay else 201
        return snapshot

    @app.get("/requests/{request_id}", response_model=DecisionSnapshot)
    def get_request(request_id: str) -> DecisionSnapshot:
        try:
            return service.get_request(request_id)
        except RequestNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.get("/requests/{request_id}/explanation", response_model=ExplanationResponse)
    def get_explanation(request_id: str) -> ExplanationResponse:
        try:
            snapshot = service.get_request(request_id)
        except RequestNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return ExplanationResponse(
            request_id=snapshot.request_id,
            status=snapshot.status,
            explanation=snapshot.explanation,
            history=snapshot.history,
            audit_trail=snapshot.audit_trail,
        )

    @app.post("/requests/{request_id}/retry", response_model=DecisionSnapshot)
    def retry_request(request_id: str) -> DecisionSnapshot:
        try:
            return service.retry(request_id)
        except RequestNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except RetryNotAllowedError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        except WorkflowNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    return app


app = create_app()
