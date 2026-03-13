from __future__ import annotations

import os
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import create_app


@pytest.fixture()
def app_factory(tmp_path):
    backend_root = Path(__file__).resolve().parents[1]
    source_workflows = backend_root / "config" / "workflows"

    def _factory(mutate_workflows=None):
        db_path = tmp_path / "test.db"
        workflow_dir = tmp_path / "workflows"
        if workflow_dir.exists():
            shutil.rmtree(workflow_dir)
        shutil.copytree(source_workflows, workflow_dir)

        if mutate_workflows:
            mutate_workflows(workflow_dir)

        old_db = os.environ.get("DATABASE_URL")
        old_wf = os.environ.get("WORKFLOW_DIR")
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
        os.environ["WORKFLOW_DIR"] = str(workflow_dir)

        app = create_app()
        client = TestClient(app)

        class _ClientCtx:
            def __enter__(self):
                return client

            def __exit__(self, exc_type, exc, tb):
                client.close()
                if old_db is None:
                    os.environ.pop("DATABASE_URL", None)
                else:
                    os.environ["DATABASE_URL"] = old_db

                if old_wf is None:
                    os.environ.pop("WORKFLOW_DIR", None)
                else:
                    os.environ["WORKFLOW_DIR"] = old_wf

        return _ClientCtx()

    return _factory


@pytest.fixture()
def valid_loan_payload():
    return {
        "applicant_name": "Jane Doe",
        "credit_score": 720,
        "loan_amount": 250000,
        "employment_status": "employed",
        "dependency_mode": "pass",
    }
