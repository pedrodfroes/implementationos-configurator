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
      if (idx <= state.max) { state.i = idx; state.done = false; render(); }
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

function render() {
  if (state.done) { renderRail(); renderCompletion(); save(); return; }
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
    product: "ImplementationOS for Manufacturing Software",
    planningObjective: planningLevels.find((item) => item.id === state.scope) || null,
    industry: industry(),
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
    billOfMaterials: state.bom,
    calendarAndCapacity: {
      terminology: calendarProfile(),
      profile: state.calendar,
    },
    executionFeedback: {
      sourceLabel: executionSourceLabel(),
      ...state.execution,
    },
    decisions: { variant: state.variant, migration: state.migration },
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
  $("#restartBtn").addEventListener("click", () => {
    state = clone(initialState);
    try { localStorage.removeItem(UI_KEY); } catch {}
    Model.reset();
    render();
  });
  render();
});
