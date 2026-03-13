import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Dashboard from '../pages/Dashboard'

function mockFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/api/admin/metrics')) {
      return new Response(
        JSON.stringify({
          total_requests: 10,
          approval_rate: 0.5,
          rejection_rate: 0.2,
          pending_review: 2,
          failed: 1,
          avg_processing_time_ms: 12,
          failure_rate_by_workflow: {},
          requests_by_workflow: {},
          status_breakdown: {},
          requests_last_7_days: [],
        }),
        { status: 200 },
      )
    }
    if (url.includes('/health')) {
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    }
    if (url.includes('/api/requests')) {
      return new Response(JSON.stringify([]), { status: 200 })
    }
    return new Response(JSON.stringify({}), { status: 200 })
  }) as any
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockFetch()
  })

  it('renders dashboard metric cards', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('Total Requests')).toBeInTheDocument())
    expect(screen.getByText('Approved')).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText('Pending Review')).toBeInTheDocument()
  })
})
