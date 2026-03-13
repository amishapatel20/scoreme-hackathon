from __future__ import annotations

from pathlib import Path

import yaml


def force_external_failure(workflow_dir: Path):
    file = workflow_dir / "loan_approval.yaml"
    data = yaml.safe_load(file.read_text(encoding="utf-8"))
    data["external_dependency"]["simulate_failure_rate"] = 1.0
    file.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def test_dependency_failure(app_factory, valid_loan_payload):
    payload = dict(valid_loan_payload)
    payload["dependency_mode"] = ""  # allow failure_rate to control simulator

    with app_factory(force_external_failure) as client:
        response = client.post(
            "/api/requests",
            json={"workflow_id": "loan_approval", "payload": payload},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "FAILED"

        audit = client.get(f"/api/audit/{body['request_id']}").json()
        state_history = audit["state_history"]
        assert any(item["to_state"] == "RETRYING" for item in state_history)
