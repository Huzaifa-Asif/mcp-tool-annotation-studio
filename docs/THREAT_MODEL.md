# Threat model

## Assets and boundary

Imported tool definitions, local annotations, and review rationale exist only in browser memory or an explicitly downloaded file. There is no service account or cloud backend.

## Considered threats

- Prompt-injection text in imported fields: displayed as inert text; never executed or interpreted as instructions.
- Oversized input: browser and CLI limit input to 1 MB; the model limits the tool array to 100 items.
- Path traversal or DNS rebinding against the development server: only fixed paths and loopback Host values are served.
- Accidental persistence or exfiltration: no local content persistence, telemetry, third-party assets, or browser network connections.
- False assurance: UI and reports describe deterministic findings as preparation, not approval.

## Out of scope

The app does not inspect server code, authenticate to an MCP server, prove runtime behavior, or replace adversarial testing.
