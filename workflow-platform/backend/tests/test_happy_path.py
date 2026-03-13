from __future__ import annotations


def test_happy_path(app_factory, valid_loan_payload):
    with app_factory() as client:
        response = client.post(
            "/api/requests",
            json={"workflow_id": "loan_approval", "payload": valid_loan_payload},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["status"] == "APPROVED"

        audit = client.get(f"/api/audit/{body['request_id']}")
        assert audit.status_code == 200
        audit_body = audit.json()
        rule_trace = audit_body["rule_trace"]
        assert len(rule_trace) >= 2
        assert all(item["result"] == "PASS" for item in rule_trace)
