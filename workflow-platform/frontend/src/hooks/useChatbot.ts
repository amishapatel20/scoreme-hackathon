import { useMemo, useState } from 'react'

import { api } from '../lib/api'

type Role = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: Role
  text: string
  timestamp: number
}

function makeMessage(role: Role, text: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    text,
    timestamp: Date.now(),
  }
}

function extractRequestId(input: string): string | undefined {
  const match = input.match(/request(?:\s+id)?\s*[:#-]?\s*([a-zA-Z0-9_-]+)/i)
  return match?.[1]
}

async function chatbotEngine(input: string): Promise<string> {
  const text = input.trim()
  const lower = text.toLowerCase()

  const requestId = extractRequestId(text)

  const asksStatus = lower.includes('status') && lower.includes('request')
  const asksWhy = lower.includes('why') && lower.includes('request')
  const asksRules = lower.includes('rule') || lower.includes('rules')
  const asksLoanApproval = lower.includes('loan approval') || lower.includes('loan_approval')
  const asksSubmitClaim = (lower.includes('how do i submit') || lower.includes('how to submit')) && lower.includes('claim')
  const asksManualReview = lower.includes('manual_review') || lower.includes('manual review')
  const asksAddWorkflow =
    lower.includes('how do i add a new workflow') ||
    lower.includes('how to add a new workflow') ||
    lower.includes('how do i create a workflow') ||
    lower.includes('create workflow')

  if (asksStatus && !requestId) {
    return 'Please share the request ID so I can check its status. Example: status of request REQ-1001.'
  }

  if (asksStatus && requestId) {
    try {
      const record = await api.getRequest(requestId)
      return `Request ${requestId} is currently ${record.status}. It belongs to workflow ${record.workflow_id}.`
    } catch {
      return `I could not fetch status for request ${requestId}. Please confirm the request ID and try again.`
    }
  }

  if (asksWhy && !requestId) {
    return 'Please share the request ID so I can explain the decision. Example: why was request REQ-1001 rejected?'
  }

  if (asksWhy && requestId) {
    try {
      const audit = (await api.getAudit(requestId)) as { rule_trace: Array<Record<string, unknown>> }
    const lastFail = [...audit.rule_trace]
      .reverse()
      .find((item) => String(item.result).toUpperCase() === 'FAIL')

    if (lastFail) {
      return `Request ${requestId} failed at stage '${String(lastFail.stage)}'. Reason: ${String(lastFail.explanation)}.`
    }

    return `I could not find a failing rule for request ${requestId}. It may have passed all checks or failed in an external stage.`
    } catch {
      return `I could not fetch the audit trail for request ${requestId}. Please confirm the request ID and try again.`
    }
  }

  if (asksRules && asksLoanApproval) {
    const workflow = await api.getWorkflow('loan_approval')
    const stageInfo = (workflow.workflow as any).stages
      .map((s: any) => `${s.name}: ${s.rules.length} rules`)
      .join('; ')
    return `Loan approval uses staged rules across: ${stageInfo}. Open Workflow Configs to inspect each YAML rule in detail.`
  }

  if (asksSubmitClaim) {
    return 'Go to New Request, select claim_processing, fill all required fields (claim_id, claimant_name, claim_amount, incident_type, document_count), then click Submit Request.'
  }

  if (asksManualReview) {
    return 'MANUAL_REVIEW means at least one rule flagged the request for human decisioning, or an external dependency path required operator intervention.'
  }

  if (asksAddWorkflow) {
    return 'Open Config Editor, load an existing YAML, modify workflow_id/stages/rules/payload_schema, validate with Test Config, then save. The backend hot-loads YAML from disk immediately.'
  }

  return 'I can help with request status, rejection reasons, rule summaries, and workflow setup. Try asking: status of request REQ-1001, why was request REQ-1001 rejected, or how do I add a new workflow?'
}

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    makeMessage('assistant', 'Hi, I am your workflow assistant. Ask me about request status, rejection reasons, rules, or how to use this platform.'),
  ])
  const [isTyping, setIsTyping] = useState(false)

  const sendMessage = async (input: string) => {
    if (!input.trim()) return
    setMessages((prev) => [...prev, makeMessage('user', input)])
    setIsTyping(true)
    try {
      const reply = await chatbotEngine(input)
      setMessages((prev) => [...prev, makeMessage('assistant', reply)])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong while processing your message.'
      setMessages((prev) => [...prev, makeMessage('assistant', `I ran into an issue: ${message}`)])
    } finally {
      setIsTyping(false)
    }
  }

  const clear = () => {
    setMessages([makeMessage('assistant', 'Chat history cleared. How can I help you next?')])
  }

  return useMemo(() => ({ messages, isTyping, sendMessage, clear }), [messages, isTyping])
}
