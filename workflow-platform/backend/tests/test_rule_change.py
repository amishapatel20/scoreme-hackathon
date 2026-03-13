from __future__ import annotations

from pathlib import Path

import yaml


BASE_PAYLOAD = {
    "applicant_name": "Jane Doe",
    "credit_score": 620,
    "loan_amount": 250000,
    "employment_status": "employed",
    "dependency_mode": "pass",
}


def relax_threshold(workflow_dir: Path):
    file = workflow_dir / "loan_approval.yaml"
    data = yaml.safe_load(file.read_text(encoding="utf-8"))
    for stage in data["stages"]:
        for rule in stage.get("rules", []):
            if rule.get("rule_id") == "credit_score_threshold":
                rule["value"] = 600
    file.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def test_rule_change(app_factory):
    with app_factory() as strict_client:
        strict = strict_client.post(
            "/api/requests",
            json={"workflow_id": "loan_approval", "payload": BASE_PAYLOAD},
        )

    with app_factory(relax_threshold) as relaxed_client:
        relaxed = relaxed_client.post(
            "/api/requests",
            json={"workflow_id": "loan_approval", "payload": BASE_PAYLOAD},
        )

    assert strict.status_code == 201
    assert relaxed.status_code == 201
    assert strict.json()["status"] == "REJECTED"
    assert relaxed.json()["status"] == "APPROVED"
