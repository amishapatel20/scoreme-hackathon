from __future__ import annotations

import shutil
from pathlib import Path
from typing import Callable
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import AppSettings


@pytest.fixture
def app_factory(tmp_path: Path) -> Callable:
    workspace_root = Path(__file__).resolve().parents[1]

    def _build(workflow_mutator: Callable[[Path], None] | None = None) -> TestClient:
        workflow_dir = tmp_path / f"workflows-{uuid4().hex}"
        shutil.copytree(workspace_root / "workflows", workflow_dir)
        if workflow_mutator is not None:
            workflow_mutator(workflow_dir)

        settings = AppSettings(
            project_root=workspace_root,
            db_path=tmp_path / f"decision-{uuid4().hex}.db",
            workflow_dir=workflow_dir,
        )
        return TestClient(create_app(settings))

    return _build
