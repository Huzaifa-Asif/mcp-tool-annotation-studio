import { HINTS, MAX_BYTES, auditDocument, exportMcpTools, reportMarkdown } from "./core.mjs";

const state = { tools: [] }; let lastCleared = null; let clearTimer = null;
const $ = (id) => document.getElementById(id);
const sample = { tools: [{ name: "projects_list", description: "Lists projects visible to the signed-in user without changing external state.", inputSchema: { type: "object", properties: {} }, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }, reviewProfile: { sideEffect: "none", externalScope: "bounded", storesData: false, requiresConfirmation: false }, rationale: {} }] };

function blank() { return { name: "", description: "", inputSchema: { type: "object" }, annotations: { readOnlyHint: null, destructiveHint: null, openWorldHint: null }, reviewProfile: { sideEffect: null, externalScope: null, storesData: null, requiresConfirmation: null }, rationale: {} }; }
function render() {
  const container = $("tools"); container.replaceChildren();
  state.tools.forEach((tool, index) => container.append(buildCard(tool, index)));
  $("empty").hidden = state.tools.length > 0;
  refreshAudit();
}
function refreshAudit() {
  const audit = auditDocument(state);
  $("status-title").textContent = !state.tools.length ? "No tools loaded" : audit.ready ? "Ready for human review" : "Needs attention";
  $("counts").textContent = `${state.tools.length} tool${state.tools.length === 1 ? "" : "s"} · ${audit.counts.error} errors · ${audit.counts.warning} warnings`;
  const list = $("findings"); list.replaceChildren();
  const items = audit.findings.length ? audit.findings : [{ severity: "pass", path: "document", message: state.tools.length ? "No deterministic findings." : "No audit has run." }];
  items.forEach((item) => { const li = document.createElement("li"); li.className = item.severity; const strong = document.createElement("strong"); strong.textContent = `${item.severity.toUpperCase()} · ${item.path}`; li.append(strong, document.createTextNode(item.message)); list.append(li); });
  $("export-json").disabled = !state.tools.length || !audit.ready; $("export-report").disabled = !state.tools.length;
}
function buildCard(tool, index) {
  const card = $("tool-template").content.firstElementChild.cloneNode(true);
  card.querySelector("h3").textContent = tool.name || `Tool ${index + 1}`;
  card.querySelector(".name").value = tool.name;
  card.querySelector(".description").value = tool.description;
  bind(card, ".name", "input", (value) => { tool.name = value; card.querySelector("h3").textContent=value||`Tool ${index+1}`; card.querySelector(".remove").setAttribute("aria-label",`Remove ${value||`tool ${index+1}`}`); });
  bind(card, ".description", "input", (value) => tool.description = value);
  bindProfile(card, ".side-effect", (value) => tool.reviewProfile.sideEffect = value, tool);
  bindProfile(card, ".scope", (value) => tool.reviewProfile.externalScope = value, tool);
  bindBooleanSelect(card, ".stores", (value) => tool.reviewProfile.storesData = value, tool);
  bindBooleanSelect(card, ".confirm", (value) => tool.reviewProfile.requiresConfirmation = value, tool);
  card.querySelector(".side-effect").value = tool.reviewProfile.sideEffect ?? ""; card.querySelector(".scope").value = tool.reviewProfile.externalScope ?? ""; card.querySelector(".stores").value = tool.reviewProfile.storesData === null ? "" : String(tool.reviewProfile.storesData); card.querySelector(".confirm").value = tool.reviewProfile.requiresConfirmation === null ? "" : String(tool.reviewProfile.requiresConfirmation);
  const hints = card.querySelector(".hint-grid"); const rationales = card.querySelector(".rationales");
  HINTS.forEach((hint) => {
    const wrap = document.createElement("label"); wrap.textContent = hint; const select = document.createElement("select"); [["", "Not set"], ["true", "True"], ["false", "False"]].forEach(([value, label]) => { const option = document.createElement("option"); option.value = value; option.textContent = label; select.append(option); }); select.value = tool.annotations[hint] === null ? "" : String(tool.annotations[hint]); select.addEventListener("change", () => { tool.annotations[hint] = select.value === "" ? null : select.value === "true"; refreshAudit(); }); wrap.append(select); hints.append(wrap);
    const r = document.createElement("label"); r.textContent = hint; const textarea = document.createElement("textarea"); textarea.rows = 2; textarea.maxLength = 1000; textarea.value = tool.rationale[hint] || ""; textarea.addEventListener("input", () => { tool.rationale[hint] = textarea.value; }); r.append(textarea); rationales.append(r);
  });
  updateRecommendation(card, tool);
  card.querySelector(".remove").setAttribute("aria-label", `Remove ${tool.name || `tool ${index + 1}`}`); card.querySelector(".remove").addEventListener("click", () => { state.tools.splice(index, 1); render(); queueMicrotask(()=>{const next=document.querySelectorAll(".tool-card .remove")[Math.min(index,state.tools.length-1)];(next||$("add")).focus()}); }); return card;
}
function bind(card, selector, event, set) { const input = card.querySelector(selector); input.addEventListener(event, () => set(input.value)); input.addEventListener("change", refreshAudit); }
function bindProfile(card, selector, set, tool) { card.querySelector(selector).addEventListener("change", (event) => { set(event.target.value); updateRecommendation(card, tool); refreshAudit(); }); }
function bindBooleanSelect(card, selector, set, tool) { card.querySelector(selector).addEventListener("change", (event) => { set(event.target.value === "" ? null : event.target.value === "true"); updateRecommendation(card, tool); refreshAudit(); }); }
function updateRecommendation(card, tool) { const recommended=auditDocument({tools:[tool]}).document.tools[0]; const show=(value)=>value===null?"unknown":String(value); const hints={readOnlyHint:recommended.reviewProfile.sideEffect===null?null:recommended.reviewProfile.sideEffect==="none",destructiveHint:recommended.reviewProfile.sideEffect===null?null:recommended.reviewProfile.sideEffect==="mutating"||recommended.reviewProfile.sideEffect==="destructive",openWorldHint:recommended.reviewProfile.externalScope===null?null:recommended.reviewProfile.externalScope==="open"}; card.querySelector(".recommendation").textContent = `Profile suggests: readOnly ${show(hints.readOnlyHint)}, destructive ${show(hints.destructiveHint)}, openWorld ${show(hints.openWorldHint)}.`; }
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url); }
function discardUndo(){lastCleared=null;clearTimeout(clearTimer);$("undo").hidden=true}
$("sample").addEventListener("click", () => { discardUndo(); state.tools = structuredClone(sample.tools); render(); });
$("add").addEventListener("click", () => { state.tools.push(blank()); render(); });
$("clear").addEventListener("click", () => { lastCleared = structuredClone(state.tools); state.tools = []; $("file").value = ""; $("undo").hidden = !lastCleared.length; clearTimeout(clearTimer); clearTimer=setTimeout(discardUndo,10000); render(); });
$("undo").addEventListener("click", () => { if (!lastCleared) return; state.tools = lastCleared; discardUndo(); render(); });
$("file").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { if (file.size > MAX_BYTES) throw new Error("File exceeds 1 MB."); discardUndo(); state.tools = auditDocument(JSON.parse(await file.text())).document.tools; render(); } catch (error) { alert(error instanceof Error ? error.message : "Import failed."); } finally { event.target.value = ""; } });
$("export-json").addEventListener("click", () => download("mcp-tools.json", JSON.stringify({ tools: exportMcpTools(state) }, null, 2), "application/json"));
$("export-report").addEventListener("click", () => download("annotation-report.md", reportMarkdown(state), "text/markdown"));
$("theme").addEventListener("click", () => { const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; $("theme").textContent = `Use ${next === "dark" ? "light" : "dark"} theme`; });
render();
