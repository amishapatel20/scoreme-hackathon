import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import NewRequest from '../pages/NewRequest'

function setupFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/workflows')) {
      return new Response(
        JSON.stringify([
          {
            workflow_id: 'loan_approval',
            name: 'Loan Approval Workflow',
            description: 'desc',
            version: '1.0',
            stage_count: 2,
            rule_count: 2,
            external_dependencies: [],
            payload_schema: [
              { name: 'applicant_name', type: 'string', required: true, label: 'Applicant Name' },
              { name: 'credit_score', type: 'integer', required: true, label: 'Credit Score' },
            ],
          },
        ]),
        { status: 200 },
      )
    }
    if (url.includes('/api/requests')) {
      return new Response(JSON.stringify({ request_id: 'r-1' }), { status: 201 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as any
}

describe('NewRequest', () => {
  beforeEach(() => setupFetch())

  it('shows correct fields for workflow type', async () => {
    render(
      <MemoryRouter>
        <NewRequest />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Applicant Name *')).toBeInTheDocument())
    expect(screen.getByText('Credit Score *')).toBeInTheDocument()

    const input = screen.getByPlaceholderText('Enter applicant_name')
    await userEvent.type(input, 'Jane Doe')
    expect(input).toHaveValue('Jane Doe')
  })
})
