import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const WORKFLOW_DISPLAY_NAMES: Record<string, string> = {
  loan_approval: 'Loan Approval',
  document_verification: 'Document Verification',
  fraud_check: 'Fraud Detection',
  vendor_approval: 'Vendor Onboarding',
  employee_onboarding: 'Employee Onboarding',
  claim_processing: 'Claims Processing',
}

function toTitleCaseFromSnake(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ')
}

export function formatWorkflowName(workflowId?: string | null) {
  if (!workflowId) return '-'
  return WORKFLOW_DISPLAY_NAMES[workflowId] ?? toTitleCaseFromSnake(workflowId)
}

export function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function formatRelativeDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const diffMs = Date.now() - date.getTime()
  if (diffMs < 0) return formatDate(value)

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'just now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day ago`

  return formatDate(value)
}
