from __future__ import annotations

from pathlib import Path

import yaml


def build_valid_payload(**overrides):
    payload = {
        "applicant_id": "APP-001",
        "applicant_name": "Aditi Rao",
        "requested_amount": 100000,
        "monthly_income": 6000,
        "credit_score": 720,
        "employment_type": "salaried",
        "dependency_mode": "pass",
    }
    payload.update(overrides)
    return payload


def test_dashboard_is_served(app_factory):
    with app_factory() as client:
        response = client.get("/")

    assert response.status_code == 200
    assert "Workflow Operations Console" in response.text
    assert "Requirement Coverage" in response.text
    assert "Workflow Intelligence" in response.text


def test_workflow_config_endpoint_exposes_schema_and_stages(app_factory):
    with app_factory() as client:
        response = client.get("/workflows/application_approval/config")

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "application_approval"
    assert "input_schema" in body
    assert len(body["stages"]) >= 1


def test_operational_overview_reports_persisted_activity(app_factory):
    with app_factory() as client:
        client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "analytics-success-1"},
            json={"payload": build_valid_payload()},
        )
        client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "analytics-invalid-1"},
            json={"payload": build_valid_payload(applicant_name=None)},
        )
        response = client.get("/analytics/overview")

    assert response.status_code == 200
    body = response.json()
    assert body["total_requests"] == 2
    assert body["successful_decisions"] == 1
    assert body["validation_failures"] == 1
    assert body["audit_events"] >= 1
    assert body["lifecycle_events"] >= 2
    assert body["workflows_with_activity"] == 1
    assert body["workflow_activity"][0]["workflow_name"] == "application_approval"


def test_happy_path_approves_request(app_factory):
    with app_factory() as client:
        response = client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "happy-path-1"},
            json={"payload": build_valid_payload()},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "approved"
    assert body["outcome"] == "success"
    assert body["decision"] == "approved"
    assert body["current_stage"] == "final_decision"
    assert len(body["audit_trail"]) >= 4


def test_workflow_catalog_shows_multiple_use_cases(app_factory):
    with app_factory() as client:
        response = client.get("/workflows")

    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert {"application_approval", "vendor_approval", "claim_processing"}.issubset(names)


def test_claim_processing_flow_is_supported_by_same_engine(app_factory):
    payload = {
        "claim_id": "CLM-001",
        "claimant_name": "Neha Singh",
        "claim_amount": 45000,
        "incident_type": "medical",
        "document_count": 3,
        "prior_claims_count": 1,
        "dependency_mode": "pass",
    }

    with app_factory() as client:
        response = client.post(
            "/workflows/claim_processing/requests",
            headers={"Idempotency-Key": "claim-happy-1"},
            json={"payload": payload},
        )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "approved"
    assert body["outcome"] == "success"
    assert body["workflow_name"] == "claim_processing"


def test_invalid_input_returns_validation_failure(app_factory):
    with app_factory() as client:
        response = client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "invalid-1"},
            json={"payload": build_valid_payload(applicant_name=None)},
        )

    assert response.status_code == 422
    body = response.json()
    assert body["status"] == "validation_failed"
    assert body["outcome"] == "validation_failed"
    assert body["decision"] == "validation_failed"
    assert "Field 'applicant_name' is required." in body["explanation"]["validation_errors"]


def test_duplicate_request_replays_original_result(app_factory):
    with app_factory() as client:
        first = client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "dup-1"},
            json={"payload": build_valid_payload()},
        )
        second = client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "dup-1"},
            json={"payload": build_valid_payload()},
        )

    assert first.status_code == 201
    assert second.status_code == 200
    assert first.json()["request_id"] == second.json()["request_id"]
    assert second.json()["outcome"] == "success"
    assert second.json()["idempotent_replay"] is True


def test_duplicate_request_with_different_payload_conflicts(app_factory):
    with app_factory() as client:
        first = client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "dup-2"},
            json={"payload": build_valid_payload()},
        )
        second = client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "dup-2"},
            json={"payload": build_valid_payload(requested_amount=50000)},
        )

    assert first.status_code == 201
    assert second.status_code == 409


def test_dependency_failure_can_be_retried(app_factory):
    with app_factory() as client:
        submission = client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "retry-1"},
            json={"payload": build_valid_payload(dependency_mode="transient_error")},
        )

        request_id = submission.json()["request_id"]
        retry = client.post(f"/requests/{request_id}/retry")

    assert submission.status_code == 201
    assert submission.json()["status"] == "retry_pending"
    assert submission.json()["outcome"] == "retry"
    assert retry.status_code == 200
    assert retry.json()["status"] == "approved"
    assert retry.json()["outcome"] == "success"
    assert retry.json()["retry_count"] == 1


def test_rule_change_scenario_is_picked_up_from_configuration(app_factory):
    def relax_credit_rule(workflow_dir: Path) -> None:
        workflow_file = workflow_dir / "application_approval.yaml"
        config = yaml.safe_load(workflow_file.read_text(encoding="utf-8"))
        for stage in config["stages"]:
            for rule in stage["rules"]:
                if rule["id"] == "baseline_credit":
                    rule["value"] = 650
        workflow_file.write_text(yaml.safe_dump(config, sort_keys=False), encoding="utf-8")

    strict_payload = build_valid_payload(credit_score=680)

    with app_factory() as strict_client:
        strict_response = strict_client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "rule-change-strict"},
            json={"payload": strict_payload},
        )

    with app_factory(relax_credit_rule) as relaxed_client:
        relaxed_response = relaxed_client.post(
            "/workflows/application_approval/requests",
            headers={"Idempotency-Key": "rule-change-relaxed"},
            json={"payload": strict_payload},
        )

    assert strict_response.status_code == 201
    assert relaxed_response.status_code == 201
    assert strict_response.json()["status"] == "manual_review"
    assert strict_response.json()["outcome"] == "manual_review"
    assert relaxed_response.json()["status"] == "approved"
    assert relaxed_response.json()["outcome"] == "success"
