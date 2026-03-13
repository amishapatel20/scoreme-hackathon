from __future__ import annotations


def test_invalid_input(app_factory, valid_loan_payload):
    invalid = dict(valid_loan_payload)
    invalid.pop("applicant_name")

    with app_factory() as client:
        response = client.post(
            "/api/requests",
            json={"workflow_id": "loan_approval", "payload": invalid},
        )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "Missing required field: applicant_name" in detail["errors"]
