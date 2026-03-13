import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ChatbotWidget } from '../components/ChatbotWidget'

describe('ChatbotWidget', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })) as any
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
})
