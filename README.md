# MCP Tool Annotation Studio

A dependency-free, local-first editor and deterministic checker for MCP tool annotations. It helps maintainers make `readOnlyHint`, `destructiveHint`, and `openWorldHint` explicit, compare them with a plain-language side-effect profile, and prepare human-review evidence without uploading tool definitions.

## Use

Requires Node.js 20 or newer.

```sh
npm start
# open http://127.0.0.1:4173
```

Audit a local JSON file from the CLI:

```sh
node src/cli.mjs tools.json
```

Run all checks:

```sh
npm run check
```

Accepted shapes are an array of tools, `{ "tools": [...] }`, or an MCP-style `{ "result": { "tools": [...] } }` document. The browser imports at most 1 MB and 100 tools. It performs no network requests and stores no imported content.

## Scope

This is review preparation, not a compliance certificate. Tool annotations do not replace authentication, authorization, validation, confirmations, or human review. The input-schema check is a bounded structural MCP object-shape check, not a complete Draft 2020-12 JSON Schema implementation. Official OpenAI pages currently disagree about whether annotation justifications are required; this app keeps rationale optional and calls out the inconsistency instead of making a universal claim. See [research](docs/RESEARCH.md), [threat model](docs/THREAT_MODEL.md), and [release verification](docs/RELEASE_VERIFICATION.md).

## Privacy

There is no telemetry, account, backend, upload, or credential field. Imported text remains in memory in the current tab and is rendered with DOM text nodes. See [PRIVACY.md](PRIVACY.md).

## License

MIT
