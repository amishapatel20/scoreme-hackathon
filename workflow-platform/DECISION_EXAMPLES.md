# Decision Explanation Examples

## Example 1: Loan Application - Rejected

Input:

```json
{
  "applicant_name": "Jane Doe",
  "credit_score": 580,
  "loan_amount": 250000,
  "employment_status": "employed"
}
```

Rules Evaluated:

1. `[intake_validation] mandatory applicant_name neq ""` -> PASS
2. `[intake_validation] threshold credit_score gte 650` -> FAIL

Decision: `REJECTED`

Reason: Credit score below threshold.

Audit Trail (sample):

```json
{
  "event_type": "rule_evaluated",
  "stage": "intake_validation",
  "rule_id": "credit_score_threshold",
  "field": "credit_score",
  "operator": "gte",
  "expected_value": 650,
  "actual_value": 580,
  "result": "FAIL",
  "explanation": "Credit score below minimum threshold of 650"
}
```

## Example 2: Claim Processing - Manual Review

Input:

```json
{
  "claim_id": "CLM-9021",
  "claimant_name": "Asha Verma",
  "claim_amount": 180000,
  "incident_type": "medical",
  "document_count": 2
}
```

Rules Evaluated:

1. `[claim_intake] mandatory claim_id neq ""` -> PASS
2. `[claim_intake] threshold document_count gte 2` -> PASS
3. `[claim_intake] conditional claim_amount lte 100000` -> FAIL -> `flag_review`

Decision: `MANUAL_REVIEW`

Reason: High-value claim required human review.

Audit Trail (sample):

```json
{
  "event_type": "rule_evaluated",
  "stage": "claim_intake",
  "rule_id": "high_value_claim",
  "result": "FAIL",
  "explanation": "Claims above 100000 must be manually reviewed"
}
```

## Example 3: Vendor Approval - External Retry Then Approved

Input:

```json
{
  "vendor_name": "Acme Supplies",
  "annual_revenue": 1200000,
  "compliance_score": 88,
  "years_in_business": 4,
  "force_external_failures": 2
}
```

Execution:

1. Qualification rules pass.
2. External sanctions check fails on attempt 1.
3. External sanctions check fails on attempt 2.
4. External sanctions check succeeds on attempt 3.
5. Final decision rules pass.

Decision: `APPROVED`

Reason: Transient dependency failures resolved within retry policy.

Audit Trail (sample):

```json
[
  {
    "event_type": "external_call",
    "stage": "sanctions_check",
    "result": "FAIL",
    "details": {"attempt": 1}
  },
  {
    "event_type": "external_call",
    "stage": "sanctions_check",
    "result": "FAIL",
    "details": {"attempt": 2}
  },
  {
    "event_type": "external_call",
    "stage": "sanctions_check",
    "result": "SUCCESS",
    "details": {"attempt": 3}
  }
]
```
