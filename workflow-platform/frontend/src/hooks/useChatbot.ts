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

async function chatbotEngine(input: string): Promise<string> {
  const text = input.trim()
  const lower = text.toLowerCase()

  const requestMatch = text.match(/request\s+([a-zA-Z0-9-]+)/i)
  const requestId = requestMatch?.[1]

  if (lower.includes('status of request') && requestId) {
    const record = await api.getRequest(requestId)
    return `Request ${requestId} is currently ${record.status}. It belongs to workflow ${record.workflow_id}.`
  }

  if ((lower.includes('why was request') || lower.includes('why request')) && requestId) {
    const audit = (await api.getAudit(requestId)) as { rule_trace: Array<Record<string, unknown>> }
    const lastFail = [...audit.rule_trace]
      .reverse()
      .find((item) => String(item.result).toUpperCase() === 'FAIL')

    if (lastFail) {
      return `Request ${requestId} failed at stage '${String(lastFail.stage)}'. Reason: ${String(lastFail.explanation)}.`
    }

    return `I could not find a failing rule for request ${requestId}. It may have passed all checks or failed in an external stage.`
  }

  if (lower.includes('what rules') && lower.includes('loan approval')) {
    const workflow = await api.getWorkflow('loan_approval')
    const stageInfo = (workflow.workflow as any).stages
      .map((s: any) => `${s.name}: ${s.rules.length} rules`)
      .join('; ')
    return `Loan approval uses staged rules across: ${stageInfo}. Open Workflow Configs to inspect each YAML rule in detail.`
  }

  if (lower.includes('how do i submit') && lower.includes('claim')) {
    return 'Go to New Request, select claim_processing, fill all required fields (claim_id, claimant_name, claim_amount, incident_type, document_count), then click Submit Request.'
  }

  if (lower.includes('manual_review')) {
    return 'MANUAL_REVIEW means at least one rule flagged the request for human decisioning, or an external dependency path required operator intervention.'
  }

  if (lower.includes('how do i add a new workflow')) {
    return 'Open Config Editor, load an existing YAML, modify workflow_id/stages/rules/payload_schema, validate with Test Config, then save. The backend hot-loads YAML from disk immediately.'
  }

  return 'I can help you check request status, understand decisions, or learn how to use the platform. What would you like to know?'
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
