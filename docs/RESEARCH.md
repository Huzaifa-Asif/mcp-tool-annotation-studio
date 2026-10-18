# Research notes — 2026-10-19 MYT

Primary sources reviewed:

- OpenAI Plugins: Build plugins
- OpenAI Plugins: Submit your plugin
- OpenAI Plugins: Submission errors
- OpenAI Plugins: Guidelines
- OpenAI Plugins: Security and privacy

The current guidelines require explicit boolean values for `readOnlyHint`, `destructiveHint`, and `openWorldHint`, and explain that annotations do not replace authentication, authorization, validation, or confirmation. The current guidelines say annotation justifications are no longer required, while the current submission-errors page still asks for justification for each annotation. This application therefore checks the confirmed boolean semantics, offers optional local rationale, and reports the documentation conflict.

Existing alternatives include general MCP scanners and OpenAI's broader packaging tools. This app's distinct scope is deterministic, offline annotation-to-side-effect reconciliation and evidence authoring; it does not scan transport implementations or submit packages.
