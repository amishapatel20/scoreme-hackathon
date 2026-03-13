export const runtime = "nodejs";

export default function DocsPage() {
  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 18px", fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>API Reference</h1>
      <p>This project exposes a small operational API used by the dashboard.</p>
      <ul>
        <li>GET /health</li>
        <li>GET /workflows</li>
        <li>GET /workflows/:workflowName/config</li>
        <li>POST /workflows/:workflowName/requests (requires Idempotency-Key header)</li>
        <li>GET /requests/:requestId</li>
        <li>POST /requests/:requestId/retry</li>
        <li>GET /requests/:requestId/explanation</li>
        <li>GET /analytics/overview</li>
      </ul>
    </div>
  );
}
