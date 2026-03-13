from __future__ import annotations


def test_duplicate_requests(app_factory, valid_loan_payload):
    with app_factory() as client:
        first = client.post(
            "/api/requests",
            json={
                "request_id": "dup-001",
                "workflow_id": "loan_approval",
                "payload": valid_loan_payload,
            },
        )
        second = client.post(
            "/api/requests",
            json={
                "request_id": "dup-001",
                "workflow_id": "loan_approval",
                "payload": valid_loan_payload,
            },
        )
        listing = client.get("/api/requests?limit=100")

    assert first.status_code == 201
    assert second.status_code == 200
    assert second.headers.get("X-Idempotent") == "true"
    ids = [item["request_id"] for item in listing.json()]
    assert ids.count("dup-001") == 1
