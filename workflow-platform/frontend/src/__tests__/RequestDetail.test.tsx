import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import RequestDetail from '../pages/RequestDetail'

function setupFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/requests/abc-1')) {
      return new Response(
        JSON.stringify({
          request_id: 'abc-1',
          workflow_id: 'loan_approval',
          status: 'REJECTED',
          attempt_count: 1,
          payload: { credit_score: 580 },
          response: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          state_history: [
            { from_state: null, to_state: 'PENDING', reason: 'received', timestamp: new Date().toISOString() },
          ],
        }),
        { status: 200 },
      )
    }
    if (url.includes('/api/audit/abc-1')) {
      return new Response(
        JSON.stringify({
          rule_trace: [
            {
              stage: 'intake_validation',
              rule_id: 'credit_score_threshold',
              field: 'credit_score',
              operator: 'gte',
              expected_value: 650,
              actual_value: 580,
              result: 'FAIL',
              explanation: 'Credit score below threshold',
            },
          ],
          external_calls: [],
        }),
        { status: 200 },
      )
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as any
}

describe('RequestDetail', () => {
  beforeEach(() => setupFetch())

  it('shows rule trace with PASS/FAIL coloring', async () => {
    render(
      <MemoryRouter initialEntries={['/requests/abc-1']}>
        <Routes>
          <Route path="/requests/:id" element={<RequestDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Rule Trace')).toBeInTheDocument())
    expect(screen.getByText('Credit score below threshold')).toBeInTheDocument()
    const failBadge = screen.getAllByText('FAIL')[0]
    expect(failBadge).toBeInTheDocument()
  })
})
