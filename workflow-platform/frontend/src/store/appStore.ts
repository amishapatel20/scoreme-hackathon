import { create } from 'zustand'

import type { RequestRecord, WorkflowSummary } from '../lib/api'

type AppStore = {
  sidebarOpen: boolean
  darkMode: boolean
  workflows: WorkflowSummary[]
  requests: RequestRecord[]
  setSidebarOpen: (open: boolean) => void
  toggleDarkMode: () => void
  setWorkflows: (workflows: WorkflowSummary[]) => void
  setRequests: (requests: RequestRecord[]) => void
}

export const useAppStore = create<AppStore>((set) => ({
  sidebarOpen: true,
  darkMode: true,
  workflows: [],
  requests: [],
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setWorkflows: (workflows) => set({ workflows }),
  setRequests: (requests) => set({ requests }),
}))
