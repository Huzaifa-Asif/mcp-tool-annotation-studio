# Privacy

MCP Tool Annotation Studio runs locally. It does not transmit, track, or persist imported tool definitions. The only outbound-capable browser API used is a local Blob download initiated by the user. The Content Security Policy blocks network connections. Clear offers a ten-second in-memory undo window, then releases that snapshot; closing the tab removes all in-memory content.

Do not import secrets. If a tool definition contains sensitive information, the app will display that local content back to you because it is an editor; it does not intentionally log or transmit it.
