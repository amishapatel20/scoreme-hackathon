from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import select

from api.context import AppContext
from api.schemas import ConfigDryRunRequest, WorkflowConfigBody
from models.db import WorkflowConfigModel


router = APIRouter(prefix="/api", tags=["workflows"])


def _ctx(req: Request) -> AppContext:
    return req.app.state.ctx


def _sync_workflow_row(session, config, yaml_content: str) -> None:
    row = session.get(WorkflowConfigModel, config.workflow_id)
    now = datetime.now(timezone.utc)
    if row is None:
        row = WorkflowConfigModel(
            workflow_id=config.workflow_id,
            name=config.name,
            description=config.description,
            version=config.version,
            yaml_content=yaml_content,
            updated_at=now,
        )
        session.add(row)
    else:
        row.name = config.name
        row.description = config.description
        row.version = config.version
        row.yaml_content = yaml_content
        row.updated_at = now


@router.get("/workflows")
def list_workflows(req: Request):
    ctx = _ctx(req)
    workflows = ctx.workflow_loader.list_workflows()
    return [
        {
            "workflow_id": w.workflow_id,
            "name": w.name,
            "description": w.description,
            "version": w.version,
            "stage_count": len(w.stages),
            "rule_count": sum(len(s.rules) for s in w.stages),
            "external_dependencies": [s.external_dependency for s in w.stages if s.external_dependency],
            "payload_schema": [item.model_dump() for item in w.payload_schema],
        }
        for w in workflows
    ]


@router.get("/workflows/{workflow_id}")
def get_workflow(workflow_id: str, req: Request):
    ctx = _ctx(req)
    try:
        config = ctx.workflow_loader.load(workflow_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    yaml_path = ctx.workflow_dir / f"{workflow_id}.yaml"
    return {
        "workflow": config.model_dump(mode="json"),
        "yaml_content": yaml_path.read_text(encoding="utf-8"),
    }


@router.post("/workflows")
def create_workflow(body: WorkflowConfigBody, req: Request):
    ctx = _ctx(req)
    try:
        config = ctx.workflow_loader.create(body.yaml_content)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    with ctx.session_factory() as session:
        _sync_workflow_row(session, config, body.yaml_content)
        session.commit()

    return {"message": "Workflow created", "workflow_id": config.workflow_id}


@router.put("/workflows/{workflow_id}")
def update_workflow(workflow_id: str, body: WorkflowConfigBody, req: Request):
    ctx = _ctx(req)
    try:
        config = ctx.workflow_loader.save(workflow_id, body.yaml_content)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    with ctx.session_factory() as session:
        _sync_workflow_row(session, config, body.yaml_content)
        session.commit()

    return {"message": "Workflow updated", "workflow_id": config.workflow_id}


@router.delete("/workflows/{workflow_id}")
def delete_workflow(workflow_id: str, req: Request):
    ctx = _ctx(req)
    try:
        ctx.workflow_loader.delete(workflow_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    with ctx.session_factory() as session:
        row = session.get(WorkflowConfigModel, workflow_id)
        if row is not None:
            session.delete(row)
            session.commit()

    return {"message": "Workflow deleted", "workflow_id": workflow_id}


@router.post("/workflows/{workflow_id}/test")
def test_workflow_config(workflow_id: str, body: ConfigDryRunRequest, req: Request):
    ctx = _ctx(req)
    try:
        result = ctx.workflow_loader.dry_run(workflow_id, body.payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return result


@router.post("/workflows/sync-db")
def sync_workflows_to_db(req: Request):
    ctx = _ctx(req)
    configs = ctx.workflow_loader.list_workflows()
    with ctx.session_factory() as session:
        for config in configs:
            yaml_content = (ctx.workflow_dir / f"{config.workflow_id}.yaml").read_text(encoding="utf-8")
            _sync_workflow_row(session, config, yaml_content)
        session.commit()
    return {"message": "Workflow configs synced", "count": len(configs)}
