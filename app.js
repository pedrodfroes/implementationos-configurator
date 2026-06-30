// ImplementationOS — render loop and bootstrap.
//
// Philosophy: this is an installer, not a dashboard. One decision per
// screen, full-bleed, gated. The semantic graph (model.js) is still the
// single source of truth underneath; every concept that used to be a
// persistent panel — branching, readiness, the model — is surfaced here
// as a step or a calm review screen. Nothing is a tab.
//
// This file is the entry point. It owns the render cycle, navigation, the
// JSON export, and DOM wiring. Everything it draws comes from the `steps`
// array (steps.js) and the derived helpers (derive.js). Load order is set in
// index.html: util → data → state → derive → steps → app.

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function refreshGate() {
  const step = steps[state.i];
  $("#nextBtn").disabled = step.gate ? !step.gate() : false;
}

function renderRail() {
  const rail = $("#railSteps");
  let html = "";
  let lastPhase = null;
  steps.forEach((s, idx) => {
    const phase = typeof s.phase === "function" ? s.phase() : s.phase;
    const nav = typeof s.nav === "function" ? s.nav() : s.nav;
    if (phase !== lastPhase) { html += `<p class="rail-phase">${escapeHtml(phase)}</p>`; lastPhase = phase; }
    const cls = state.done ? "done" : idx === state.i ? "current" : idx < state.i ? "done" : idx <= state.max ? "avail" : "locked";
    const icon = cls === "done" ? "circle-check" : cls === "current" ? "circle-dot" : cls === "locked" ? "lock" : "circle";
    html += `
      <button class="rail-step ${cls}" type="button" data-goto="${idx}" ${idx > state.max && !state.done ? "disabled" : ""}>
        <i data-lucide="${icon}"></i><span>${escapeHtml(nav)}</span>
      </button>`;
  });
  rail.innerHTML = html;
  rail.querySelectorAll("[data-goto]").forEach((b) =>
    b.addEventListener("click", () => {
      const idx = Number(b.dataset.goto);
      if (idx <= state.max) { state.i = idx; state.done = false; state.view = "flow"; render(); }
    })
  );

  const r = readiness();
  $("#railReadiness").innerHTML = `
    <div class="mini-ring" style="--p:${r}"><span>${r}%</span></div>
    <div><p class="mini-label">Readiness</p><p class="mini-sub">builds as you decide</p></div>
  `;
}

function renderCompletion() {
  $("#stageCount").textContent = "Complete";
  $("#stageBody").innerHTML = `
    <div class="complete">
      <div class="complete-mark"><i data-lucide="check"></i></div>
      <h2>Setup complete.</h2>
      <p>The configuration is validated at ${readiness()}% readiness. Its representative dataset is synthetic and ready to be replaced with governed customer data during onboarding.</p>
      <button class="cta" id="reviewBtn" type="button"><i data-lucide="list-checks"></i><span>Review readiness</span></button>
    </div>
  `;
  $("#stageFoot").style.display = "none";
  $("#stageBody").querySelector("#reviewBtn").addEventListener("click", () => {
    state.done = false; state.i = steps.findIndex((s) => s.id === "readiness"); render();
  });
  refreshIcons();
}

function applyBlueprintLayout() {
  $("#installer")?.classList.toggle("bp-collapsed", !state.blueprintOpen);
  $("#blueprintToggle")?.setAttribute("aria-pressed", String(!!state.blueprintOpen));
}

function renderBlueprint() {
  applyBlueprintLayout();
  const panel = $("#blueprintPanel");
  if (!panel) return;
  const bp = blueprintModel();
  const sections = bp.sections
    .map(
      (sec) => `
      <div class="bp-sec ${sec.status}">
        <div class="bp-sec-head">
          <i data-lucide="${sec.status === "confirmed" ? "circle-check" : "circle-dashed"}"></i>
          <strong>${escapeHtml(sec.label)}</strong>
          <em class="bp-chip ${sec.status}">${sec.status === "confirmed" ? "Confirmed" : "Draft"}</em>
        </div>
        ${sec.detail ? `<span class="bp-sec-detail">${escapeHtml(sec.detail)}</span>` : ""}
      </div>`
    )
    .join("");
  const notes = state.notes || [];
  const notesBlock = notes.length
    ? `<div class="bp-notes"><div class="bp-notes-head"><i data-lucide="sticky-note"></i>Notes (${notes.length})</div>${notes
        .map((n) => `<div class="bp-note"><span class="bp-note-scope">${escapeHtml(n.scopeLabel || "")}</span><p>${escapeHtml(n.text)}</p></div>`)
        .join("")}</div>`
    : "";
  panel.innerHTML = `
    <div class="bp-head">
      <div><p class="bp-eyebrow">Deployment blueprint</p><strong>Writes itself as you decide</strong></div>
      <span class="bp-live"><i data-lucide="circle-dot"></i>SME · live</span>
    </div>
    <div class="bp-doc">
      <div class="bp-doc-top"><span class="bp-doc-title">Implementation blueprint</span><span class="bp-ver">v0.${bp.confirmed} draft</span></div>
      ${bp.sections.length ? sections : `<p class="bp-empty">The blueprint fills in here as you make decisions — confirmed sections settle in green, drafts stay flagged until the SME signs off.</p>`}
      ${notesBlock}
      <div class="bp-foot">
        <span><b class="bp-c">${bp.confirmed} confirmed</b> · <b class="bp-d">${bp.draft} draft</b>${notes.length ? ` · ${notes.length} note${notes.length === 1 ? "" : "s"}` : ""}</span>
        <button type="button" class="bp-export" id="bpExport">Export ↗</button>
      </div>
    </div>`;
  panel.querySelector("#bpExport")?.addEventListener("click", exportBrief);
}

function currentScope() {
  const step = steps[state.i];
  return { id: step.id, label: typeof step.nav === "function" ? step.nav() : step.nav };
}

// Soft documentation: a notes strip appended to the end of every step's
// scroll area (so it never pushes the footer CTA), scoped to that step and
// surfaced live in the blueprint (direction E — notes attach anywhere).
function renderNotes() {
  const body = $("#stageBody");
  if (!body) return;
  const { id, label } = currentScope();
  const mine = (state.notes || []).filter((n) => n.scope === id);
  const wrap = document.createElement("div");
  wrap.className = "notes-strip";
  wrap.innerHTML = `
    <div class="notes-head"><i data-lucide="sticky-note"></i><span>Notes — soft documentation</span>${mine.length ? `<em>${mine.length}</em>` : ""}</div>
    ${mine.length ? `<div class="notes-list">${mine
      .map((n) => `<div class="note-card"><p>${escapeHtml(n.text)}</p><button class="note-del" type="button" data-note-del="${n.id}" title="Remove note">×</button></div>`)
      .join("")}</div>` : ""}
    <div class="notes-add">
      <input type="text" id="noteInput" placeholder="Capture a rationale, open question, or SME comment for ${escapeHtml(label)}…" />
      <button type="button" class="ghost-btn" id="noteAdd">Add note</button>
    </div>`;
  body.appendChild(wrap);
  const input = wrap.querySelector("#noteInput");
  const add = () => {
    const text = input.value.trim();
    if (!text) return;
    state.notes = state.notes || [];
    state.notes.push({ id: "note-" + Math.random().toString(36).slice(2, 8), scope: id, scopeLabel: label, text });
    render();
  };
  wrap.querySelector("#noteAdd").addEventListener("click", add);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  wrap.querySelectorAll("[data-note-del]").forEach((b) =>
    b.addEventListener("click", () => { state.notes = (state.notes || []).filter((n) => n.id !== b.dataset.noteDel); render(); })
  );
}

function applyChrome() {
  const btn = $("#cockpitToggle");
  if (btn) {
    const inHub = state.view === "cockpit" && !state.done;
    btn.innerHTML = `<i data-lucide="${inHub ? "play" : "layout-grid"}"></i><span>${inHub ? "Resume" : "Cockpit"}</span>`;
  }
}

function renderCockpit() {
  $("#stageFoot").style.display = "none";
  $("#stageCount").textContent = "Cockpit";
  $("#stageBody").dataset.step = "cockpit";
  const mods = moduleModel();
  const r = readiness();
  const counts = { done: 0, active: 0, todo: 0 };
  mods.forEach((m) => { counts[m.status] += 1; });
  const label = { done: "Confirmed", active: "In progress", todo: "Not started" };
  const cards = mods
    .map(
      (m, n) => `
      <button class="cockpit-card ${m.status}" type="button" data-module="${m.firstIndex}">
        <div class="cc-top">
          <span class="cc-idx">${String(n + 1).padStart(2, "0")}</span>
          <span class="cc-badge ${m.status}">${label[m.status]}</span>
        </div>
        <strong>${escapeHtml(m.phase)}</strong>
        <div class="cc-bar"><i style="width:${Math.round((m.passed / m.total) * 100)}%"></i></div>
        <small>${m.passed} of ${m.total} screen${m.total === 1 ? "" : "s"}</small>
      </button>`
    )
    .join("");
  $("#stageBody").innerHTML = `
    <div class="cockpit">
      <div class="cockpit-head">
        <div class="ring" style="--p:${r}"><span>${r}<small>%</small></span></div>
        <div>
          <h2>Configuration cockpit</h2>
          <p>Jump into any module — nothing is locked. Confirm decisions as the SME signs off; the blueprint on the right fills in live.</p>
          <div class="cockpit-legend"><span class="done">● ${counts.done} confirmed</span><span class="active">● ${counts.active} in progress</span><span class="todo">● ${counts.todo} not started</span></div>
        </div>
      </div>
      <div class="cockpit-grid">${cards}</div>
    </div>`;
  $("#stageBody").querySelectorAll("[data-module]").forEach((b) =>
    b.addEventListener("click", () => {
      const idx = Number(b.dataset.module);
      state.view = "flow";
      state.done = false;
      state.i = idx;
      state.max = Math.max(state.max, idx);
      render();
    })
  );
}

function render() {
  if (state.done) { renderRail(); renderCompletion(); renderBlueprint(); applyChrome(); refreshIcons(); save(); return; }
  if (state.view === "cockpit") { renderRail(); renderCockpit(); renderBlueprint(); applyChrome(); refreshIcons(); save(); return; }
  $("#stageFoot").style.display = "";
  const step = steps[state.i];
  renderRail();

  // title/sub may be functions so they can reflect the live dialect.
  const title = typeof step.title === "function" ? step.title() : step.title;
  const sub = typeof step.sub === "function" ? step.sub() : step.sub;
  const phase = typeof step.phase === "function" ? step.phase() : step.phase;
  $("#stageCount").textContent = `Step ${state.i + 1} of ${steps.length}`;
  $("#stageBody").dataset.step = step.id;
  $("#stageBody").innerHTML = `
    <div class="step">
      <p class="step-phase">${escapeHtml(phase)}</p>
      <h2>${escapeHtml(title)}</h2>
      <p class="step-sub">${escapeHtml(sub)}</p>
      <div class="step-body">${step.body ? step.body() : ""}</div>
    </div>
  `;
  step.attach?.($("#stageBody"));

  $("#backBtn").disabled = state.i === 0;
  $("#nextLabel").textContent = step.cta || "Continue";
  const ok = step.gate ? step.gate() : true;
  $("#nextBtn").disabled = !ok;
  const hint = typeof step.hint === "function" ? step.hint() : step.hint;
  $("#footHint").textContent = ok ? "" : hint || "";

  renderNotes();
  renderBlueprint();
  applyChrome();
  refreshIcons();
  save();
}

function advance() {
  const step = steps[state.i];
  if (step.gate && !step.gate()) return;
  if (state.i >= steps.length - 1) { state.done = true; render(); return; }
  state.i += 1;
  state.max = Math.max(state.max, state.i);
  render();
}

function exportBrief() {
  const brief = {
    product: "ImplementationOS for Manufacturing Planning and Execution",
    planningObjective: planningLevels.find((item) => item.id === state.scope) || null,
    masterPlanning: {
      ...state.masterPlanning,
      summary: masterPlanningSummary(),
      objective: masterPlanningObjectives.find((item) => item.id === state.masterPlanning?.objective) || null,
      grain: masterPlanningGrains.find((item) => item.id === state.masterPlanning?.grain) || null,
      demandInputs: masterDemandInputs.filter((item) => state.masterPlanning?.demand?.includes(item.id)),
      supplyInputs: masterSupplyInputs.filter((item) => state.masterPlanning?.supply?.includes(item.id)),
      policies: masterPolicies.filter((item) => state.masterPlanning?.policy?.includes(item.id)),
      capacityBuckets: masterCapacityBuckets.filter((item) => state.masterPlanning?.capacity?.includes(item.id)),
      runBehavior: masterRunBehaviors.find((item) => item.id === state.masterPlanning?.run) || null,
      handoffOutputs: masterHandoffOutputs.filter((item) => state.masterPlanning?.handoff?.includes(item.id)),
    },
    industry: selectedIndustryContexts()[0] ? { ...selectedIndustryContexts()[0].sector, specialty: selectedIndustryContexts()[0].specialty } : null,
    industries: selectedIndustryContexts().map(({ industry: industryId, specialty, sector }) => ({ ...sector, id: industryId, specialty })),
    archetypes: selectedArchetypes().map(({ id, name, mode: archetypeMode }) => ({ id, name, mode: archetypeMode })),
    archetypeSynthesis: { ...archetypeSynthesis(), ...modeMix(), dominantLabel: mode().label },
    mode: mode().label,
    dialect: profile().badge,
    terminology: {
      facility: profile().facility,
      storage: profile().storage,
      bin: profile().bin,
      area: profile().area,
      resource: profile().resource,
      order: profile().order,
      route: profile().route,
      hierarchy: profile().hierarchy,
    },
    taxonomies: {
      departments: selectedDepartmentTypes(),
      resources: selectedResourceTypes(),
    },
    attributeModel: {
      dialect: attributeProfile().family,
      families: attributeConcepts.map(({ id, name, dialectKey }) => ({
        id,
        name,
        term: attributeProfile()[dialectKey],
        attributes: state.attr?.[id]?.picks || [],
        confirmed: !!state.attr?.[id]?.confirmed,
      })),
    },
    representativeDataset: representativeData(),
    setupChangeoverCleaning: {
      ...state.transitions,
      types: transitionTypes.filter((x) => state.transitions?.types?.includes(x.id)).map(({ id, name }) => ({ id, name })),
      triggers: transitionTriggers.filter((x) => state.transitions?.triggers?.includes(x.id)).map(({ id, name }) => ({ id, name })),
      concurrency: transitionConcurrency.find((x) => x.id === state.transitions?.concurrency) ? { id: state.transitions.concurrency, name: transitionConcurrency.find((x) => x.id === state.transitions.concurrency).name } : null,
      drivers: transitionDrivers.filter((x) => state.transitions?.drivers?.includes(x.id)).map(({ id, name }) => ({ id, name })),
      driverAttributes: state.transitions?.driverAttributes || [],
    },
    volumeStorage: {
      ...state.volumeStorage,
      behaviorDetails: volumeStorageBehaviors.filter((behavior) => state.volumeStorage.behaviors.includes(behavior.id)),
    },
    billOfMaterials: state.bom,
    criticalSupplies: {
      confirmed: state.supplies.confirmed,
      profiles: supplyProfiles().map((profile) => ({ ...profile, policy: supplyPolicy(profile) })),
    },
    workforcePlanning: {
      confirmed: state.workforce.confirmed,
      intensity: laborIntensity(),
      capabilities: workforceCapabilities.map((cap) => ({ id: cap.id, name: cap.name, scope: workforceScope(cap) })),
    },
    calendarAndCapacity: {
      terminology: calendarProfile(),
      profile: state.calendar,
    },
    dispatching: {
      ...state.dispatch,
      summary: dispatchSummary(),
      objective: dispatchObjectives.find((item) => item.id === state.dispatch?.objective) || null,
      granularity: dispatchGranularities.find((item) => item.id === state.dispatch?.granularity) || null,
      inputs: dispatchInputs.filter((item) => state.dispatch?.inputs?.includes(item.id)),
      policies: dispatchPolicies.filter((item) => state.dispatch?.policies?.includes(item.id)),
      channels: dispatchChannels.filter((item) => state.dispatch?.channels?.includes(item.id)),
      reactivity: dispatchReactivities.find((item) => item.id === state.dispatch?.reactivity) || null,
    },
    executionFeedback: {
      sourceLabel: executionSourceLabel(),
      ...state.execution,
    },
    systemArchitecture: {
      confirmed: architectureConfigured(),
      nodes: (state.architecture?.nodes || []).map(({ id, layer, name, status }) => ({ id, layer, name, status })),
    },
    decisions: { variant: state.variant, migration: state.migration },
    notes: (state.notes || []).map(({ scopeLabel, text }) => ({ scope: scopeLabel, text })),
    readiness: `${readiness()}%`,
    governedDecisions: Model.nodesOfType("decision").map((d) => d.props),
  };
  const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "implementationos-handoff-brief.json";
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  $("#nextBtn").addEventListener("click", advance);
  $("#backBtn").addEventListener("click", () => { if (state.i > 0) { state.i -= 1; render(); } });
  $("#blueprintToggle")?.addEventListener("click", () => {
    state.blueprintOpen = !state.blueprintOpen;
    save();
    renderBlueprint();
    refreshIcons();
  });
  $("#cockpitToggle")?.addEventListener("click", () => {
    state.view = state.view === "cockpit" ? "flow" : "cockpit";
    render();
  });
  $("#restartBtn").addEventListener("click", () => {
    state = clone(initialState);
    try { localStorage.removeItem(UI_KEY); } catch {}
    Model.reset();
    render();
  });
  render();
});
