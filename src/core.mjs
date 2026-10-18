export const MAX_BYTES = 1_000_000;
export const MAX_TOOLS = 100;
export const HINTS = ["readOnlyHint", "destructiveHint", "openWorldHint"];

const safeText = (value, limit = 4000) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const validSideEffect = new Set(["none", "additive", "mutating", "destructive"]);
const validScope = new Set(["bounded", "open"]);
const secretPattern = /(sk-[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._-]{12,}|api[_ -]?key\s*[:=]\s*\S+|(?:token|password|secret|api[_-]?key)=[^&#\s]+|https:\/\/[^/\s@]+@)/i;

export function normalizeDocument(input) {
  const source = Array.isArray(input) ? input : input?.tools ?? input?.result?.tools;
  if (!Array.isArray(source)) throw new Error("Expected a tools array, { tools }, or { result: { tools } } document.");
  if (source.length > MAX_TOOLS) throw new Error(`At most ${MAX_TOOLS} tools are supported.`);
  return {
    tools: source.map((tool, index) => normalizeTool(tool, index)),
  };
}

export function normalizeTool(tool, index = 0) {
  if (!tool || typeof tool !== "object" || Array.isArray(tool)) throw new Error(`Tool ${index + 1} must be an object.`);
  const annotations = tool.annotations && typeof tool.annotations === "object" ? tool.annotations : {};
  const profile = tool.reviewProfile && typeof tool.reviewProfile === "object" ? tool.reviewProfile : {};
  const rationale = tool.rationale && typeof tool.rationale === "object" ? tool.rationale : {};
  const passthrough = tool.passthrough && typeof tool.passthrough === "object" && !Array.isArray(tool.passthrough) ? structuredClone(tool.passthrough) : structuredClone(tool);
  delete passthrough.reviewProfile; delete passthrough.rationale; delete passthrough.passthrough;
  return {
    name: typeof tool.name === "string" ? tool.name : "",
    description: typeof tool.description === "string" ? tool.description : "",
    inputSchema: tool.inputSchema && typeof tool.inputSchema === "object" && !Array.isArray(tool.inputSchema)
      ? structuredClone(tool.inputSchema) : null,
    annotations: Object.fromEntries(HINTS.map((hint) => [hint, typeof annotations[hint] === "boolean" ? annotations[hint] : null])),
    reviewProfile: {
      sideEffect: validSideEffect.has(profile.sideEffect) ? profile.sideEffect : null,
      externalScope: validScope.has(profile.externalScope) ? profile.externalScope : null,
      storesData: typeof profile.storesData === "boolean" ? profile.storesData : null,
      requiresConfirmation: typeof profile.requiresConfirmation === "boolean" ? profile.requiresConfirmation : null,
    },
    rationale: Object.fromEntries(HINTS.map((hint) => [hint, safeText(rationale[hint], 1000)])),
    passthrough,
  };
}

export function recommendAnnotations(profile) {
  return {
    readOnlyHint: profile.sideEffect === null ? null : profile.sideEffect === "none",
    destructiveHint: profile.sideEffect === null ? null : profile.sideEffect === "mutating" || profile.sideEffect === "destructive",
    openWorldHint: profile.externalScope === null ? null : profile.externalScope === "open",
  };
}

export function auditDocument(input) {
  const document = normalizeDocument(input);
  const findings = [];
  const seen = new Set();
  document.tools.forEach((tool, index) => {
    const path = `tools[${index}]`;
    if (!tool.name.trim()) findings.push(finding("error", path, "missing-name", "Add a stable tool name."));
    if (tool.name && !/^[A-Za-z0-9_.-]+$/.test(tool.name)) findings.push(finding("warning", `${path}.name`, "unusual-name", "Use letters, numbers, underscores, hyphens, or dots."));
    if (seen.has(tool.name) && tool.name) findings.push(finding("error", `${path}.name`, "duplicate-name", "Tool names must be unique."));
    seen.add(tool.name);
    if (!tool.description.trim()) findings.push(finding("error", `${path}.description`, "missing-description", "Describe what the tool does and its side effects."));
    if (!isValidJsonSchema(tool.inputSchema)) findings.push(finding("error", `${path}.inputSchema`, "invalid-input-schema", "inputSchema must be a structurally valid JSON Schema object; it is never replaced automatically."));
    for (const field of ["sideEffect", "externalScope", "storesData", "requiresConfirmation"]) if (tool.reviewProfile[field] === null) findings.push(finding("error", `${path}.reviewProfile.${field}`, "missing-review-profile", `Classify ${field} explicitly; imported tools are never assumed safe.`));
    for (const hint of HINTS) if (tool.annotations[hint] === null) findings.push(finding("error", `${path}.annotations.${hint}`, "missing-explicit-hint", `${hint} must be an explicit boolean.`));
    if (tool.annotations.readOnlyHint === true && tool.annotations.destructiveHint === true) {
      findings.push(finding("error", `${path}.annotations`, "contradictory-hints", "A read-only tool cannot also be destructive."));
    }
    const expected = recommendAnnotations(tool.reviewProfile);
    for (const hint of HINTS) {
      if (expected[hint] !== null && tool.annotations[hint] !== null && tool.annotations[hint] !== expected[hint]) {
        findings.push(finding("error", `${path}.annotations.${hint}`, "profile-mismatch", `Declared ${tool.annotations[hint]} but the review profile implies ${expected[hint]}.`));
      }
    }
    if (tool.reviewProfile.sideEffect === "destructive" && tool.reviewProfile.requiresConfirmation !== true) {
      findings.push(finding("error", `${path}.reviewProfile.requiresConfirmation`, "confirmation-required", "Destructive actions need explicit user confirmation in the product flow."));
    }
    if (tool.reviewProfile.storesData && !/retention|store|save|persist/i.test(tool.description)) {
      findings.push(finding("warning", `${path}.description`, "retention-undisclosed", "Disclose storage or retention behavior in the description."));
    }
    if (containsSecret(tool)) findings.push(finding("error", path, "possible-secret", "Possible credential material detected somewhere in this tool; replace it with an obvious placeholder."));
  });
  const counts = { error: 0, warning: 0 };
  findings.forEach((item) => { counts[item.severity] += 1; });
  return { document, findings, counts, ready: counts.error === 0 };
}

function finding(severity, path, code, message) { return { severity, path, code, message }; }

export function exportMcpTools(input) {
  const audit = auditDocument(input);
  if (!audit.ready) throw new Error("Resolve blocking findings before exporting MCP JSON.");
  return audit.document.tools.map(({ name, description, inputSchema, annotations, passthrough }) => ({
    ...passthrough,
    name,
    description,
    inputSchema,
    annotations: { ...(passthrough.annotations && typeof passthrough.annotations === "object" ? passthrough.annotations : {}), ...annotations },
  }));
}

export function reportMarkdown(input) {
  const audit = auditDocument(input);
  const lines = ["# MCP tool annotation report", "", `Status: ${audit.ready ? "READY" : "NEEDS WORK"}`, `Errors: ${audit.counts.error}; warnings: ${audit.counts.warning}`, ""];
  for (const item of audit.findings) lines.push(`- ${item.severity.toUpperCase()} \`${item.path}\` (${item.code}): ${item.message}`);
  if (!audit.findings.length) lines.push("- No deterministic findings.");
  lines.push("", "## Review evidence");
  for (const tool of audit.document.tools) {
    lines.push("", `### ${safeMarkdown(tool.name) || "Unnamed tool"}`, "", `Profile: ${tool.reviewProfile.sideEffect} side effect; ${tool.reviewProfile.externalScope} scope; stores data: ${tool.reviewProfile.storesData}; confirmation: ${tool.reviewProfile.requiresConfirmation}.`);
    for (const hint of HINTS) lines.push(`- ${hint}: ${String(tool.annotations[hint])}; rationale: ${safeMarkdown(tool.rationale[hint]) || "Not recorded."}`);
  }
  lines.push("", "Rationales are optional local review evidence. Current OpenAI guidance is inconsistent about whether annotation justifications are required; verify the submission surface at release time.", "");
  return lines.join("\n");
}

export function parseBoundedJson(text) {
  if (typeof text !== "string") throw new Error("Input must be text.");
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("Input exceeds the 1 MB limit.");
  return JSON.parse(text);
}
function redact(value) { return secretPattern.test(value) || hasUrlCredentials(value) ? "[REDACTED: possible credential]" : value; }
function safeMarkdown(value) { return redact(value).replace(/([\\`*_{}\[\]<>()#+.!|~-])/g, "\\$1").replace(/[\r\n]+/g, " "); }
function hasUrlCredentials(value) { try { const url = new URL(value); return Boolean(url.username || url.password); } catch { return false; } }
function containsSecret(value, seen = new WeakSet(), depth = 0) { if (typeof value === "string") return secretPattern.test(value) || hasUrlCredentials(value); if (!value || typeof value !== "object" || depth > 24 || seen.has(value)) return false; seen.add(value); return Object.values(value).some((item) => containsSecret(item, seen, depth + 1)); }
function isValidJsonSchema(schema, seen = new WeakSet(), depth = 0, root = true) { const types=new Set(["null","boolean","object","array","number","integer","string"]); if (typeof schema === "boolean") return !root; if (!schema || typeof schema !== "object" || Array.isArray(schema) || depth > 24 || seen.has(schema)) return false; seen.add(schema); if (root && schema.type !== "object") return false; if ("type" in schema && !(typeof schema.type === "string" ? types.has(schema.type) : (Array.isArray(schema.type) && schema.type.length>0 && schema.type.every((x) => types.has(x))))) return false; if ("properties" in schema) { if (!schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) return false; if (!Object.values(schema.properties).every((item)=>isValidJsonSchema(item,seen,depth+1,false))) return false; } if ("items" in schema && !(Array.isArray(schema.items) ? schema.items.every((item)=>isValidJsonSchema(item,seen,depth+1,false)) : isValidJsonSchema(schema.items,seen,depth+1,false))) return false; if ("required" in schema && (!Array.isArray(schema.required) || !schema.required.every((x) => typeof x === "string"))) return false; if ("additionalProperties" in schema && !(typeof schema.additionalProperties === "boolean" || isValidJsonSchema(schema.additionalProperties,seen,depth+1,false))) return false; for (const key of ["allOf", "anyOf", "oneOf"]) if (key in schema && (!Array.isArray(schema[key]) || !schema[key].every((item) => isValidJsonSchema(item, seen, depth + 1, false)))) return false; for (const key of ["minLength","maxLength","minItems","maxItems","minProperties","maxProperties"]) if (key in schema && (!Number.isInteger(schema[key]) || schema[key] < 0)) return false; if ("multipleOf" in schema && (typeof schema.multipleOf !== "number" || !Number.isFinite(schema.multipleOf) || schema.multipleOf <= 0)) return false; if ("pattern" in schema && typeof schema.pattern !== "string") return false; return true; }
