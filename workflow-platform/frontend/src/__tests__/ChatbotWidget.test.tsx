import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ChatbotWidget } from '../components/ChatbotWidget'

describe('ChatbotWidget', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/requests/REQ-42')) {
        return new Response(JSON.stringify({ request_id: 'REQ-42', workflow_id: 'loan_approval', status: 'APPROVED' }), {
          status: 200,
        })
      }
      return new Response(JSON.stringify({}), { status: 200 })
    }) as any
  })

  it('opens and accepts input', async () => {
    render(<ChatbotWidget />)

    await userEvent.click(screen.getByLabelText('Open chatbot'))
    const input = screen.getByPlaceholderText('Ask about a request, rules, or platform usage...')
    await userEvent.type(input, 'What does MANUAL_REVIEW mean?')
    await userEvent.click(screen.getByLabelText('Send'))

    await waitFor(() => {
      expect(screen.getByText(/MANUAL_REVIEW means/)).toBeInTheDocument()
    })
  })

  it('asks for request id when status query does not include one', async () => {
    render(<ChatbotWidget />)

    await userEvent.click(screen.getByLabelText('Open chatbot'))
    const input = screen.getByPlaceholderText('Ask about a request, rules, or platform usage...')
    await userEvent.type(input, 'What is the status of request?')
    await userEvent.click(screen.getByLabelText('Send'))

    await waitFor(() => {
      expect(screen.getByText(/Please share the request ID/)).toBeInTheDocument()
    })
  })

  it('returns request status when query includes request id', async () => {
    render(<ChatbotWidget />)

    await userEvent.click(screen.getByLabelText('Open chatbot'))
    const input = screen.getByPlaceholderText('Ask about a request, rules, or platform usage...')
    await userEvent.type(input, 'status of request REQ-42')
    await userEvent.click(screen.getByLabelText('Send'))

    await waitFor(() => {
      expect(screen.getByText(/Request REQ-42 is currently APPROVED/)).toBeInTheDocument()
    })
  })
})
