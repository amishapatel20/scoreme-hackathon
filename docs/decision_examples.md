# Decision Explanation Examples

## Example 1: Approved application

### Input

```json
{
  "applicant_id": "APP-001",
  "applicant_name": "Aditi Rao",
  "requested_amount": 100000,
  "monthly_income": 6000,
  "credit_score": 720,
  "employment_type": "salaried",
  "dependency_mode": "pass"
}
```

### Rules triggered

- `amount_in_auto_lane`: passed because `requested_amount` is within the automated lane.
- `baseline_credit`: passed because `credit_score` is at least 700.
- `self_employed_income_buffer`: skipped because `employment_type` is not `self_employed`.
- `fraud_screen`: passed because the dependency returned a clear result.
- `affordability_ratio`: passed because `6000 / 100000 = 0.06`, which is at least `0.05`.

### Output

- Final status: `approved`
- Assignment outcome: `success`
- Decision: `approved`
- Audit reasoning: every required gate passed, no manual review path was triggered, and no dependency instability occurred.

## Example 2: Manual review due to credit threshold

### Input

```json
{
  "applicant_id": "APP-002",
  "applicant_name": "Rohan Sen",
  "requested_amount": 100000,
  "monthly_income": 6000,
  "credit_score": 680,
  "employment_type": "salaried",
  "dependency_mode": "pass"
}
```

### Rules triggered

- `amount_in_auto_lane`: passed.
- `baseline_credit`: failed because `credit_score` is below the configured threshold of `700`.

### Output

- Final status: `manual_review`
- Assignment outcome: `manual_review`
- Decision: `manual_review`
- Audit reasoning: the workflow intentionally routed this to human review rather than rejecting it, preserving business flexibility under ambiguity.

## Example 3: Retry after transient dependency failure

### Initial input

```json
{
  "applicant_id": "APP-003",
  "applicant_name": "Ishita Das",
  "requested_amount": 100000,
  "monthly_income": 6000,
  "credit_score": 720,
  "employment_type": "salaried",
  "dependency_mode": "transient_error"
}
```

### Initial decision

- `fraud_screen` returned a transient dependency error.
- Workflow moved to `retry_pending`.
- Assignment outcome was `retry`.
- Explanation recorded the dependency issue and the retry recommendation.

### Retry outcome

- Retry re-executed the workflow with incremented retry count.
- The simulated dependency succeeded on the next attempt.
- Final status became `approved`.
- Assignment outcome became `success`.

### Audit reasoning

The system preserved a complete record of:

- the original submission
- the dependency error
- the retry request
- the second execution attempt
- the final approved outcome
