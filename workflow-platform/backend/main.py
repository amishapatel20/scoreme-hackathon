from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

from api.context import AppContext
from api.routes_admin import router as admin_router
from api.routes_audit import router as audit_router
from api.routes_requests import router as requests_router
from api.routes_workflows import router as workflows_router
from config.loader import WorkflowConfigLoader
from core.engine import WorkflowEngine
from models.db import Base, create_session_factory


def create_app() -> FastAPI:
    backend_root = Path(__file__).resolve().parent
    workflow_dir = Path(os.getenv("WORKFLOW_DIR", str(backend_root / "config" / "workflows")))
    db_url = os.getenv("DATABASE_URL", f"sqlite:///{backend_root / 'workflow_platform.db'}")

    engine, session_factory = create_session_factory(db_url)
    Base.metadata.create_all(bind=engine)

    workflow_loader = WorkflowConfigLoader(workflow_dir)
    workflow_engine = WorkflowEngine(workflow_loader)

    app = FastAPI(
        title="Configurable Workflow Decision Platform",
        version="1.0.0",
        description="Production-ready workflow decisioning with YAML-driven rules, audit trails, and admin controls.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.ctx = AppContext(
        session_factory=session_factory,
        workflow_loader=workflow_loader,
        engine=workflow_engine,
        workflow_dir=workflow_dir,
    )

    app.include_router(requests_router)
    app.include_router(workflows_router)
    app.include_router(audit_router)
    app.include_router(admin_router)

    @app.get("/", tags=["system"])
    def root() -> dict[str, str]:
        return {
            "service": "Configurable Workflow Decision Platform API",
            "status": "ok",
            "docs": "/docs",
            "health": "/health",
            "frontend": "http://localhost:3000",
        }

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon() -> Response:
        return Response(status_code=204)

    @app.get("/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
