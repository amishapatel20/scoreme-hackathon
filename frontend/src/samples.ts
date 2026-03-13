export const SAMPLE_PAYLOADS: Record<string, Record<string, unknown>> = {
  application_approval: {
    applicant_id: 'APP-001',
    applicant_name: 'Aditi Rao',
    requested_amount: 100000,
    monthly_income: 6000,
    credit_score: 720,
    employment_type: 'salaried',
    dependency_mode: 'pass',
  },
  vendor_approval: {
    vendor_id: 'VND-100',
    vendor_name: 'Acme Supplies',
    annual_revenue: 1200000,
    years_in_business: 3,
    compliance_score: 88,
    dependency_mode: 'pass',
  },
  claim_processing: {
    claim_id: 'CLM-1001',
    policy_id: 'POL-9001',
    claimant_name: 'Ravi Kumar',
    claim_amount: 25000,
    days_since_incident: 10,
    dependency_mode: 'pass',
  },
}
