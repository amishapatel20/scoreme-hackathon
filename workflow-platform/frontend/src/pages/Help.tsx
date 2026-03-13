import { useEffect } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export default function Help() {
  useEffect(() => {
    document.title = 'Help | Workflow Decision Platform'
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Help</h1>
      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Go to New Request and choose a workflow.</p>
          <p>2. Fill required fields and submit.</p>
          <p>3. Open Request Detail to inspect status, state transitions, and rule trace.</p>
          <p>4. Use Audit Explorer for global search and Admin Panel for overrides and retries.</p>
          <p>5. Use Config Editor to update YAML rules and test behavior before saving.</p>
          <p>6. Click the chatbot button in the bottom-right for guided support.</p>
        </CardContent>
      </Card>
    </div>
  )
}
