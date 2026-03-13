from __future__ import annotations


def test_retry_flow(app_factory, valid_loan_payload):
    payload = dict(valid_loan_payload)
    payload["force_external_failures"] = 2
    payload["dependency_mode"] = ""

    with app_factory() as client:
        response = client.post(
            "/api/requests",
            json={"workflow_id": "loan_approval", "payload": payload},
        )

        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "APPROVED"

        audit = client.get(f"/api/audit/{body['request_id']}").json()
        external_calls = audit["external_calls"]
        assert len(external_calls) == 3
