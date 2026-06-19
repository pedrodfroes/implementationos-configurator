// ImplementationOS — guided setup.
//
// Philosophy: this is an installer, not a dashboard. One decision per
// screen, full-bleed, gated. The semantic graph (model.js) is still the
// single source of truth underneath; every concept that used to be a
// persistent panel — branching, readiness, the model — is surfaced here
// as a step or a calm review screen. Nothing is a tab.

const $ = (selector) => document.querySelector(selector);
const clone = (value) => JSON.parse(JSON.stringify(value));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ── Reference data ───────────────────────────────────────────────────
const profiles = {
  jde: { badge: "JDE", name: "JDE / classic work orders", order: "Work order", route: "Routing", facility: "Branch / Plant", storage: "Location", bin: "Lot / Location", area: "Department", resource: "Work center", hierarchy: ["Company", "Branch / Plant", "Location"] },
  sap_pp: { badge: "SAP PP", name: "SAP ECC PP", order: "Production order", route: "Routing", facility: "Plant", storage: "Storage Location", bin: "Storage Bin", area: "Production Supply Area", resource: "Work Center", hierarchy: ["Client", "Company Code", "Plant", "Storage Location", "Storage Bin"] },
  sap_pi: { badge: "SAP PP-PI", name: "SAP ECC PP-PI", order: "Process order", route: "Master recipe", facility: "Plant", storage: "Storage Location", bin: "Storage Bin", area: "Production Supply Area", resource: "Resource", hierarchy: ["Client", "Company Code", "Plant", "Storage Location", "Storage Bin"] },
  s4: { badge: "S/4HANA", name: "S/4HANA", order: "Manufacturing order", route: "Routing or recipe", facility: "Plant", storage: "Storage Location", bin: "Storage Bin", area: "Production Supply Area", resource: "Work Center / Resource", hierarchy: ["Client", "Company Code", "Plant", "Storage Location", "Storage Bin"] },
  oracle: { badge: "Oracle SCM", name: "Oracle Fusion Cloud SCM", order: "Work order", route: "Work definition", facility: "Inventory / Manufacturing Organization", storage: "Subinventory", bin: "Locator", area: "Work Area", resource: "Work Center / Resource", hierarchy: ["Legal Entity / Business Unit", "Inventory Organization", "Subinventory", "Locator"] },
  d365: { badge: "D365 SCM", name: "Microsoft Dynamics 365 SCM", order: "Production order", route: "Route", facility: "Site", storage: "Warehouse", bin: "Location", area: "Production Unit", resource: "Resource / Resource Group", hierarchy: ["Legal Entity", "Site", "Warehouse", "Location"] },
  infor_ln: { badge: "Infor LN", name: "Infor LN", order: "Production order", route: "Routing", facility: "Site", storage: "Warehouse", bin: "Location", area: "Department", resource: "Work Center", hierarchy: ["Company", "Enterprise Unit / Site", "Warehouse / Department", "Location"] },
  netsuite: { badge: "NetSuite", name: "Oracle NetSuite", order: "Work order", route: "Manufacturing routing", facility: "Location", storage: "Location", bin: "Bin", area: "Production Area", resource: "Work Center", hierarchy: ["Subsidiary", "Location", "Bin"] },
  odoo: { badge: "Odoo", name: "Odoo Manufacturing", order: "Manufacturing order", route: "BoM / Operations", facility: "Warehouse", storage: "Location", bin: "Location", area: "Production Area", resource: "Work Center", hierarchy: ["Company", "Warehouse", "Location"] },
  peoplesoft: { badge: "PeopleSoft", name: "PeopleSoft Manufacturing", order: "Production ID", route: "Routing", facility: "Manufacturing Business Unit", storage: "Storage Location", bin: "Storage Location", area: "Production Area", resource: "Work Center", hierarchy: ["SetID / Business Unit", "Manufacturing Business Unit", "Storage Location"] },
  qad: { badge: "QAD", name: "QAD", order: "Work order", route: "Routing", facility: "Site", storage: "Warehouse", bin: "Location", area: "Department", resource: "Work Center", hierarchy: ["Domain", "Site", "Warehouse", "Location"] },
  plex: { badge: "Plex", name: "Plex Smart Manufacturing", order: "Job", route: "Routing", facility: "Plant", storage: "Location", bin: "Location", area: "Cell", resource: "Work Center / Cell", hierarchy: ["Enterprise", "Plant", "Location", "Work Center / Cell"] },
  epicor: { badge: "Epicor", name: "Epicor Kinetic", order: "Job", route: "Method of manufacture", facility: "Plant", storage: "Warehouse", bin: "Bin", area: "Department", resource: "Resource Group / Resource", hierarchy: ["Company", "Site / Plant", "Warehouse", "Bin"] },
  ifs: { badge: "IFS", name: "IFS Cloud", order: "Shop order", route: "Routing", facility: "Site", storage: "Warehouse", bin: "Location", area: "Production Line", resource: "Work Center", hierarchy: ["Company", "Site", "Warehouse", "Location"] },
};

const calendarProfiles = {
  sap: { base: "Factory Calendar", pattern: "Shift / Shift Sequence / Work Schedule", resource: "Work Center Capacity", exception: "Calendar or capacity override", units: "Individual Capacity", efficiency: "Utilization", category: "Capacity Category" },
  oracle: { base: "Production Calendar", pattern: "Shift", resource: "Work Center Resource Calendar", exception: "Resource Exception", units: "Default Units Available", efficiency: "Efficiency", category: "Resource" },
  d365: { base: "Calendar", pattern: "Working Time Template / Working Times", resource: "Resource Calendar", exception: "Calendar exception", units: "Capacity", efficiency: "Efficiency", category: "Resource / Resource Group" },
  infor_ln: { base: "Calendar Code", pattern: "Recurrence / Working Hours", resource: "Work Center Calendar", exception: "Calendar Exception", units: "Resource capacity", efficiency: "Efficiency", category: "Availability Type" },
  generic: { base: "Production Calendar", pattern: "Shift / Working Time", resource: "Resource Calendar", exception: "Availability Exception", units: "Units Available", efficiency: "Efficiency / Utilization", category: "Capacity Type" },
};

// The archetype's manufacturing MODE — not the industry — predicts the
// dialect. Process plants talk in process orders and recipes; discrete
// plants in production orders and routings.
const modeProfiles = {
  process: { label: "Process manufacturing", erp: "sap_pi", note: "Recipes, phases, batch sizes, and cleaning lead the model." },
  discrete: { label: "Discrete manufacturing", erp: "sap_pp", note: "Routings, operations, and component availability lead the model." },
  project: { label: "Project / engineer-to-order", erp: "s4", note: "Project networks, milestones, and long-lead parts lead the model." },
  service: { label: "Service / capacity", erp: "sap_pp", note: "People, skills, appointments, and locations lead the model." },
  logistics: { label: "Distribution / logistics", erp: "sap_pp", note: "Networks, lanes, and delivery windows lead the model." },
};

const planningArchetypes = [
  { id: "batch-campaign", name: "Batch / Campaign", core: "Made in batches, with cleaning or changeovers between product families.", mode: "process" },
  { id: "continuous-process", name: "Continuous Process", core: "The line runs continuously; flow balance matters and stopping is costly.", mode: "process" },
  { id: "discrete-assembly", name: "Discrete Assembly", core: "Finished goods assembled from many components; BOM availability drives feasibility.", mode: "discrete" },
  { id: "cto-eto", name: "Configure / Engineer to Order", core: "The product is not fully known until the order arrives.", mode: "project" },
  { id: "job-shop", name: "Job Shop / High-Mix", core: "Many different jobs compete for many different machines.", mode: "discrete" },
  { id: "flow-shop", name: "Flow Shop / Line", core: "Products move through roughly the same sequence of operations.", mode: "discrete" },
  { id: "packaging-postponement", name: "Late-Stage Postponement", core: "Bulk made first; final SKU identity happens late.", mode: "process" },
  { id: "perishable-food", name: "Food with Perishability", core: "Time is a hard constraint; materials and goods degrade.", mode: "process" },
  { id: "maturation-aging", name: "Maturation / Aging", core: "The product must wait a chemically meaningful time.", mode: "process" },
  { id: "semiconductor-fab", name: "Semiconductor / Fab", core: "Products revisit the same tools many times in reentrant flows.", mode: "discrete" },
  { id: "mining-primary", name: "Mining / Primary", core: "Supply is constrained by geology, extraction, and blending.", mode: "logistics" },
  { id: "distribution-logistics", name: "Distribution / Logistics", core: "The constraint is moving goods through a network, not production.", mode: "logistics" },
  { id: "field-service", name: "Workforce / Field Service", core: "The critical resource is people with skills, locations, and travel.", mode: "service" },
  { id: "maintenance-turnaround", name: "Maintenance / Turnaround", core: "Work packages compete for limited downtime windows.", mode: "project" },
  { id: "construction-project", name: "Construction / Project", core: "The factory is a project site; location and sequence matter.", mode: "project" },
  { id: "healthcare-capacity", name: "Healthcare / Capacity", core: "Patients flow through constrained resources with uncertain durations.", mode: "service" },
];

const planningLevels = [
  { id: "strategic", level: "Strategic / network planning", horizon: "Years", question: "Where should we make, source, add capacity, or change the footprint?", terms: "Network design · footprint planning · capacity strategy" },
  { id: "sop", level: "Sales & Operations Planning", horizon: "12–24 months", question: "Can demand, supply, inventory, and finance agree on one feasible plan?", terms: "S&OP · IBP · aggregate planning" },
  { id: "master", level: "Master planning", horizon: "3–18 months", question: "What finished goods should we plan to make by period?", terms: "MPS · RCCP · master scheduling" },
  { id: "material", level: "Material planning", horizon: "Weeks–months", question: "What materials and components are needed, and when?", terms: "MRP · DRP · procurement planning" },
  { id: "capacity", level: "Capacity planning", horizon: "Weeks–months", question: "Do we have enough labor, machines, tools, and suppliers?", terms: "CRP · RCCP · infinite / finite capacity" },
  { id: "aps-ds", level: "Advanced Planning & Detailed Scheduling", horizon: "Hours–weeks", question: "Which operation runs where, when, and in what sequence?", terms: "APS · DS · FCS · finite scheduling", available: true },
  { id: "dispatch", level: "Dispatching / execution", horizon: "Now–days", question: "What should the shop floor do next?", terms: "Dispatch list · MES · shop-floor control" },
  { id: "monitoring", level: "Monitoring / control", horizon: "Real time–days", question: "Are we late, blocked, starved, overloaded, or deviating?", terms: "WIP control · ATP / CTP · exception management" },
];

// ── State ────────────────────────────────────────────────────────────
const initialState = {
  i: 0,
  max: 0,
  scope: null,
  archetype: null,
  erp: "sap_pi",
  migration: null,
  calendar: {
    layering: null,
    pattern: null,
    exceptions: null,
    modifiers: [],
    modifiersConfirmed: false,
  },
  constraint: null,
  lineDecision: null,
  bom: {
    structure: null,
    features: [],
    featuresConfirmed: false,
    consumption: null,
    source: null,
  },
  variant: null, // null | "active" | "kept" | "reverted" | "skipped"
  demo: null, // { laneId, score, note }
  done: false,
};

let state = clone(initialState);
const UI_KEY = "implementationos-installer-v1";

function save() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(state)); } catch {}
}
function load() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...clone(initialState), ...saved };
      if (!("scope" in saved)) {
        state.i = 1;
        state.max = Math.max(1, Number(saved.max || 0));
      } else if ("planningMode" in saved) {
        if (state.i > 6) state.i -= 1;
        if (state.max > 6) state.max -= 1;
      }
      delete state.planningMode;
    }
  } catch { state = clone(initialState); }
}

// ── Derived helpers (graph is the source of truth) ───────────────────
function profile() { return profiles[state.erp]; }
function calendarProfile() {
  if (["sap_pp", "sap_pi", "s4"].includes(state.erp)) return calendarProfiles.sap;
  return calendarProfiles[state.erp] || calendarProfiles.generic;
}
function archetype() { return planningArchetypes.find((a) => a.id === state.archetype) || null; }
function mode() { return modeProfiles[archetype()?.mode || "process"]; }
function areas() { return Model.nodesOfType("area").map((n) => ({ id: n.id, ...n.props })); }
function workcenters() { return Model.nodesOfType("workcenter").map((n) => ({ id: n.id, ...n.props })); }
function siteName() { return Model.node("site")?.props.name || ""; }
function areaName(id) { return areas().find((a) => a.id === id)?.name || "Unassigned"; }

function readiness() {
  let s = 16;
  if (state.scope) s += 12;
  if (state.archetype) s += 8;
  if (siteName()) s += 8;
  if (state.calendar?.layering && state.calendar?.pattern && state.calendar?.exceptions && state.calendar?.modifiersConfirmed) s += 8;
  if (state.constraint) s += 6;
  if (state.lineDecision) s += 10;
  if (state.bom?.structure && state.bom?.featuresConfirmed && state.bom?.consumption && state.bom?.source) s += 8;
  if (state.variant && state.variant !== "active") s += 6;
  if (state.demo) s += Math.round(state.demo.score * 0.24);
  if (state.migration) s -= 4;
  return Math.max(5, Math.min(99, Math.round(s)));
}

// ── Step definitions ─────────────────────────────────────────────────
// Each step is one decision. `gate` returns whether Continue unlocks.
const steps = [
  {
    id: "welcome", phase: "Start", nav: "Welcome", cta: "Begin setup",
    title: "Let's set up your APS pilot.",
    sub: "A guided, step-by-step build of the implementation model — one decision at a time. Nothing is final; you can go back at any point.",
    body: () => `
      <div class="welcome-art" aria-hidden="true">
        <i data-lucide="route"></i>
      </div>
      <ul class="welcome-list">
        <li><i data-lucide="target"></i><span>Start from the planning archetype, not the industry.</span></li>
        <li><i data-lucide="git-branch"></i><span>Try changes on a branch before committing them.</span></li>
        <li><i data-lucide="gauge"></i><span>Watch readiness build as you make each decision.</span></li>
      </ul>
    `,
  },
  {
    id: "scope", phase: "Scope", nav: "Planning objective",
    title: "What are you actually trying to accomplish?",
    sub: "Choose the planning level before describing the manufacturing archetype. Adjacent levels stay visible so the project boundary is explicit, but this demo currently supports APS and Detailed Scheduling only.",
    hint: "Select Advanced Planning & Detailed Scheduling to continue.",
    gate: () => state.scope === "aps-ds",
    body: () => `
      <div class="scope-grid">
        ${planningLevels.map((item, index) => `
          <button class="scope-card${item.available ? " available" : " inactive"}${state.scope === item.id ? " active" : ""}" type="button"
            ${item.available ? `data-scope="${item.id}"` : "disabled"}
            title="${item.available ? "Available in this demo" : "Visible for context; not active in this demo yet"}">
            <span class="scope-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="scope-copy">
              <span class="scope-topline"><strong>${escapeHtml(item.level)}</strong><em>${escapeHtml(item.horizon)}</em></span>
              <span class="scope-question">${escapeHtml(item.question)}</span>
              <small>${escapeHtml(item.terms)}</small>
            </span>
            <i data-lucide="${item.available ? "arrow-right" : "lock-keyhole"}"></i>
          </button>
        `).join("")}
      </div>
    `,
    attach: (root) => {
      root.querySelector("[data-scope]")?.addEventListener("click", (event) => {
        state.scope = event.currentTarget.dataset.scope;
        render();
      });
    },
  },
  {
    id: "archetype", phase: "Characterize", nav: "Archetype",
    title: "What are you implementing?",
    sub: "Pick the pattern that dominates how work actually flows. It shapes terminology, constraints, and the whole model.",
    hint: "Choose an archetype to continue.",
    gate: () => !!state.archetype,
    body: () => `
      <div class="pick-grid">
        ${planningArchetypes
          .map(
            (a) => `
          <button class="pick-card${a.id === state.archetype ? " active" : ""}" type="button" data-arch="${a.id}">
            <span class="pick-mode">${escapeHtml(modeProfiles[a.mode].label)}</span>
            <strong>${escapeHtml(a.name)}</strong>
            <p>${escapeHtml(a.core)}</p>
          </button>`
          )
          .join("")}
      </div>
    `,
    attach: (root) => {
      root.querySelectorAll("[data-arch]").forEach((b) =>
        b.addEventListener("click", () => {
          state.archetype = b.dataset.arch;
          state.erp = mode().erp;
          render();
        })
      );
    },
  },
  {
    id: "dialect", phase: "Characterize", nav: "Dialect",
    title: "Confirm the planning dialect.",
    sub: "Your archetype is a process or discrete pattern — that decides the ERP language the model speaks. Override if the client's system differs.",
    body: () => `
      <div class="derive">
        <div class="derive-chain">
          <span class="chain-node">${escapeHtml(archetype()?.name || "—")}</span>
          <i data-lucide="arrow-right"></i>
          <span class="chain-node accent">${escapeHtml(mode().label)}</span>
          <i data-lucide="arrow-right"></i>
          <span class="chain-node">${escapeHtml(profile().badge)}</span>
        </div>
        <p class="derive-note">${escapeHtml(mode().note)}</p>
        <label class="field big-field">
          <span>ERP dialect</span>
          <select id="erpSelect">
            ${Object.entries(profiles).map(([id, item]) => `<option value="${escapeHtml(id)}">${escapeHtml(item.name)}</option>`).join("")}
          </select>
        </label>
        <div class="derive-chain hierarchy-chain" aria-label="ERP organization hierarchy">
          ${profile().hierarchy.map((term, index) => `${index ? '<i data-lucide="arrow-right"></i>' : ""}<span class="chain-node">${escapeHtml(term)}</span>`).join("")}
        </div>
        <div class="vocab-line">
          <span>You'll plan</span>
          <strong>${escapeHtml(profile().order)}s</strong>
          <em>against</em>
          <strong>${escapeHtml(profile().route)}s</strong>
          <em>at</em>
          <strong>${escapeHtml(profile().facility)}</strong>
          <em>using</em>
          <strong>${escapeHtml(profile().resource)}s</strong>
        </div>
      </div>
    `,
    attach: (root) => {
      const sel = root.querySelector("#erpSelect");
      sel.value = state.erp;
      sel.addEventListener("change", (e) => { state.erp = e.target.value; render(); });
    },
  },
  {
    id: "migration", phase: "Characterize", nav: "Migration",
    title: "Is an S/4 migration on the roadmap?",
    sub: "If a migration is coming, the design avoids one-off mappings — and it shows up as a standing risk on your readiness.",
    hint: "Pick one to continue.",
    gate: () => state.migration !== null,
    body: () => `
      <div class="choice-grid two">
        ${choiceTile("yes", state.migration === true, "calendar-clock", "Yes, it's coming", "Design for portability; flag the risk")}
        ${choiceTile("no", state.migration === false, "circle-off", "No, not planned", "Optimize for the current system")}
      </div>
    `,
    attach: (root) => bindChoices(root, (v) => { state.migration = v === "yes"; render(); }),
  },
  {
    id: "site", phase: "Facility", nav: "Facility name",
    title: () => `Name the ${profile().facility.toLowerCase()}.`,
    sub: () => `In ${profile().badge}, this is the ${profile().facility}. Every ${profile().area.toLowerCase()}, ${profile().resource.toLowerCase()}, storage object, and decision hangs off it.`,
    hint: "Enter the facility name to continue.",
    gate: () => siteName().trim().length > 0,
    body: () => `
      <label class="field big-field solo">
        <span>${escapeHtml(profile().facility)} name</span>
        <input id="siteInput" type="text" value="${escapeHtml(siteName())}" placeholder="e.g. Milano Packaging" autocomplete="off" />
      </label>
    `,
    attach: (root) => {
      const input = root.querySelector("#siteInput");
      input.focus();
      input.addEventListener("input", () => {
        Model.update("site", { name: input.value || "" });
        refreshGate();
      });
    },
  },
  {
    id: "calendar", phase: "Facility", nav: "Calendars & capacity",
    title: "Where does available capacity really come from?",
    sub: () => `${calendarProfile().base} defines broad working days; ${calendarProfile().resource} determines whether a specific ${profile().resource.toLowerCase()} can actually run. Capture both layers before APS interprets an open day as usable capacity.`,
    hint: "Complete all four calendar and capacity dimensions to continue.",
    gate: () => !!(state.calendar?.layering && state.calendar?.pattern && state.calendar?.exceptions && state.calendar?.modifiersConfirmed),
    body: () => {
      const cal = state.calendar || initialState.calendar;
      const terms = calendarProfile();
      const modifier = (value, icon, title, sub) => choiceTile(value, cal.modifiers.includes(value), icon, title, sub).replace("data-choice", "data-calendar-modifier");
      return `
        <div class="capacity-profile">
          <section class="capacity-dimension">
            <div class="dimension-heading"><span>01</span><div><strong>Availability layers</strong><small>Where open time is defined</small></div></div>
            <div class="choice-grid three compact" data-calendar-group="layering">
              ${choiceTile("facility-only", cal.layering === "facility-only", "calendar-days", terms.base, `Only the ${profile().facility.toLowerCase()}-level calendar is available`)}
              ${choiceTile("resource-only", cal.layering === "resource-only", "cpu", terms.resource, `Availability is maintained directly on each ${profile().resource.toLowerCase()}`)}
              ${choiceTile("layered", cal.layering === "layered", "layers-3", "Layered calendars", `${terms.base} plus ${terms.resource.toLowerCase()} overrides`)}
            </div>
          </section>
          <section class="capacity-dimension">
            <div class="dimension-heading"><span>02</span><div><strong>Working-time pattern</strong><small>${escapeHtml(terms.pattern)}</small></div></div>
            <div class="choice-grid three compact" data-calendar-group="pattern">
              ${choiceTile("single-shift", cal.pattern === "single-shift", "sun", "Single shift", "One recurring work interval per working day")}
              ${choiceTile("multi-shift", cal.pattern === "multi-shift", "clock-3", "Multiple shifts", "Two or more named intervals share the day")}
              ${choiceTile("variable", cal.pattern === "variable", "calendar-range", "Variable / rotating", "Patterns change by day, week, crew, or activity")}
            </div>
          </section>
          <section class="capacity-dimension">
            <div class="dimension-heading"><span>03</span><div><strong>Exceptions</strong><small>${escapeHtml(terms.exception)}</small></div></div>
            <div class="choice-grid three compact" data-calendar-group="exceptions">
              ${choiceTile("base-only", cal.exceptions === "base-only", "calendar-off", "Base-calendar only", "Holidays and closures apply broadly")}
              ${choiceTile("resource-overrides", cal.exceptions === "resource-overrides", "wrench", "Resource overrides", "Maintenance and local downtime override open days")}
              ${choiceTile("multi-activity", cal.exceptions === "multi-activity", "calendar-cog", "Activity-specific", "Production, service, logistics, or other availability differs")}
            </div>
          </section>
          <section class="capacity-dimension">
            <div class="dimension-heading"><span>04</span><div><strong>Capacity modifiers</strong><small>Select all supplied by the ERP</small></div></div>
            <div class="choice-grid compact capacity-modifiers">
              ${modifier("units", "copy", terms.units, "Number of parallel people, machines, or capacity units")}
              ${modifier("efficiency", "gauge", terms.efficiency, "Usable percentage or performance factor")}
              ${modifier("category", "tags", terms.category, "Machine, labor, setup, processing, or activity type")}
              ${choiceTile("none", cal.modifiersConfirmed && cal.modifiers.length === 0, "circle-slash-2", "None supplied", "Use working time without additional modifiers").replace("data-choice", "data-calendar-modifier-none")}
            </div>
          </section>
        </div>
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-calendar-group]").forEach((group) => {
        group.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
          state.calendar[group.dataset.calendarGroup] = button.dataset.choice;
          render();
        }));
      });
      root.querySelectorAll("[data-calendar-modifier]").forEach((button) => button.addEventListener("click", () => {
        const value = button.dataset.calendarModifier;
        const selected = new Set(state.calendar.modifiers);
        selected.has(value) ? selected.delete(value) : selected.add(value);
        state.calendar.modifiers = [...selected];
        state.calendar.modifiersConfirmed = true;
        render();
      }));
      root.querySelector("[data-calendar-modifier-none]")?.addEventListener("click", () => {
        state.calendar.modifiers = [];
        state.calendar.modifiersConfirmed = true;
        render();
      });
    },
  },
  {
    id: "constraint", phase: "Facility", nav: "Constraint view",
    title: "What is currently known about the constraint?",
    sub: "Capture the customer's view as a hypothesis, not as planning truth. The limiting constraint may be unknown or shift by horizon, product mix, campaign, and scenario.",
    hint: "Choose the best current description. It can be refined when data and scenarios reveal more.",
    gate: () => !!state.constraint,
    body: () => `
      <div class="choice-grid three">
        ${choiceTile("unknown", state.constraint === "unknown", "circle-help", "Not known yet", "Let data profiling and scenario runs surface likely constraints")}
        ${choiceTile("shifting", state.constraint === "shifting", "shuffle", "Shifting constraint", "Changes with horizon, product mix, campaign, or operating conditions")}
        ${choiceTile("Packaging Line 3", state.constraint === "Packaging Line 3", "alert-triangle", "Packaging Line 3", "Customer-observed candidate; calendar data is incomplete")}
        ${choiceTile("Mixer A", state.constraint === "Mixer A", "flask-conical", "Mixer A", "Customer-observed candidate; shared across campaigns")}
        ${choiceTile("QC Release Bench", state.constraint === "QC Release Bench", "microscope", "QC Release Bench", "Customer-observed candidate; release may gate the schedule")}
      </div>
    `,
    attach: (root) => bindChoices(root, (v) => { state.constraint = v; render(); }),
  },
  {
    id: "areas", phase: "Model", nav: "Areas",
    title: "Confirm the operating areas.",
    sub: () => `These came from the template. Add any ${profile().area.toLowerCase()} or operating area the ${profile().facility.toLowerCase()} is missing.`,
    gate: () => areas().length > 0,
    body: () => `
      <div class="tile-list">
        ${areas()
          .map(
            (a) => `
          <div class="tile-row">
            <i data-lucide="layout-grid"></i>
            <div><strong>${escapeHtml(a.name)}</strong><span>${workcenters().filter((w) => w.areaId === a.id).length} ${escapeHtml(profile().resource.toLowerCase())}s</span></div>
          </div>`
          )
          .join("")}
      </div>
      <form class="add-row" id="areaForm">
        <input id="areaInput" type="text" placeholder="Add an area or department" autocomplete="off" />
        <button class="ghost-btn" type="submit"><i data-lucide="plus"></i><span>Add</span></button>
      </form>
    `,
    attach: (root) => {
      root.querySelector("#areaForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = root.querySelector("#areaInput").value.trim();
        if (!name) return;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `area-${Date.now()}`;
        Model.add({ id, type: "area", props: { name, color: "teal" } }, `${name} added to the ${profile().facility.toLowerCase()} model.`);
        render();
      });
    },
  },
  {
    id: "workcenters", phase: "Model", nav: "Resources",
    title: () => `Place each ${profile().resource.toLowerCase()} — and settle the data issue.`,
    sub: "One resource came in with a missing calendar. Decide how the pilot handles it before moving on.",
    hint: "Resolve Packaging Line 3 to continue.",
    gate: () => !!state.lineDecision,
    body: () => {
      const opts = areas().map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
      return `
        <div class="tile-list">
          ${workcenters()
            .map((w) => {
              const issue = w.status === "Data issue";
              return `
              <div class="tile-row${issue ? " warn" : ""}">
                <i data-lucide="${issue ? "alert-triangle" : "cpu"}"></i>
                <div class="tile-main">
                  <strong>${escapeHtml(w.name)}</strong>
                  <span>${escapeHtml(w.capacity)}</span>
                </div>
                <select data-wc="${w.id}" class="inline-select">${opts.replace(`value="${w.areaId}"`, `value="${w.areaId}" selected`)}</select>
              </div>`;
            })
            .join("")}
        </div>
        <div class="decision-box">
          <p><i data-lucide="help-circle"></i> Packaging Line 3 has no valid shift calendar in the extract. How should the pilot treat it?</p>
          <div class="choice-grid two compact">
            ${choiceTile("flag", state.lineDecision === "flag", "flag", "Flag for cleanup", "Keep it, raise a data task")}
            ${choiceTile("exclude", state.lineDecision === "exclude", "eye-off", "Exclude from pilot", "Schedule without it for now")}
          </div>
        </div>
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-wc]").forEach((sel) =>
        sel.addEventListener("change", () => {
          Model.update(sel.dataset.wc, { areaId: sel.value }, null);
        })
      );
      bindChoices(root, (v) => { state.lineDecision = v; render(); });
    },
  },
  {
    id: "bom", phase: "Model", nav: "BOM profile",
    title: "How does the product structure reach planning?",
    sub: () => `Characterize the ${profile().route.toLowerCase()} and component model across four independent dimensions. APS should preserve what matters without assuming every ERP sends a clean master BOM.`,
    hint: "Complete all four BOM dimensions to continue.",
    gate: () => !!(state.bom?.structure && state.bom?.featuresConfirmed && state.bom?.consumption && state.bom?.source),
    body: () => {
      const bom = state.bom || initialState.bom;
      const feature = (value, icon, title, sub) => choiceTile(value, bom.features.includes(value), icon, title, sub).replace("data-choice", "data-bom-feature");
      return `
        <div class="bom-profile">
          <section class="bom-dimension">
            <div class="dimension-heading"><span>01</span><div><strong>Structure</strong><small>How components are represented</small></div></div>
            <div class="choice-grid three compact" data-bom-group="structure">
              ${choiceTile("multi-level", bom.structure === "multi-level", "network", "Multi-level", "Preserve assemblies and lower-level dependencies")}
              ${choiceTile("single-level", bom.structure === "single-level", "list-tree", "Collapsed single level", "Planning receives an exploded component list")}
              ${choiceTile("recipe-formula", bom.structure === "recipe-formula", "flask-conical", "Recipe / formula", "Ingredients, quantities, phases, or process instructions")}
            </div>
          </section>
          <section class="bom-dimension">
            <div class="dimension-heading"><span>02</span><div><strong>Special behavior</strong><small>Select all that occur</small></div></div>
            <div class="choice-grid compact bom-features">
              ${feature("phantoms", "combine", "Phantom assemblies", "Logical groupings exploded without their own order")}
              ${feature("recursion", "repeat-2", "Recursion / loops", "Rework, co-products, or structures that revisit themselves")}
              ${feature("potency", "test-tube-2", "Lot potency / assay", "Required quantity varies by lot strength or concentration")}
              ${choiceTile("none", bom.featuresConfirmed && bom.features.length === 0, "circle-slash-2", "None identified", "Explicitly confirm no special behavior").replace("data-choice", "data-bom-feature-none")}
            </div>
          </section>
          <section class="bom-dimension">
            <div class="dimension-heading"><span>03</span><div><strong>Consumption linkage</strong><small>Where demand is attached</small></div></div>
            <div class="choice-grid three compact" data-bom-group="consumption">
              ${choiceTile("operation", bom.consumption === "operation", "git-commit-horizontal", "Operation-linked", "Each component points to a consuming operation or phase")}
              ${choiceTile("order", bom.consumption === "order", "package", "Order-level", "Components are consumed without an operation assignment")}
              ${choiceTile("mixed", bom.consumption === "mixed", "split", "Mixed", "Operation-linked and order-level consumption coexist")}
            </div>
          </section>
          <section class="bom-dimension">
            <div class="dimension-heading"><span>04</span><div><strong>Integration grain</strong><small>What the ERP actually sends</small></div></div>
            <div class="choice-grid three compact" data-bom-group="source">
              ${choiceTile("master", bom.source === "master", "library", "Master BOM / recipe", "Versioned product structure from master data")}
              ${choiceTile("order-specific", bom.source === "order-specific", "clipboard-list", "Order BOM", "Copied or changed structure attached to the order")}
              ${choiceTile("allocation", bom.source === "allocation", "boxes", "Allocation / reservation", "Actual reserved materials, batches, or supply assignments")}
              ${choiceTile("hybrid", bom.source === "hybrid", "layers-3", "Hybrid", "Master structure plus order and reservation deltas")}
            </div>
          </section>
        </div>
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-bom-group]").forEach((group) => {
        group.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
          state.bom[group.dataset.bomGroup] = button.dataset.choice;
          render();
        }));
      });
      root.querySelectorAll("[data-bom-feature]").forEach((button) => button.addEventListener("click", () => {
        const value = button.dataset.bomFeature;
        const selected = new Set(state.bom.features);
        selected.has(value) ? selected.delete(value) : selected.add(value);
        state.bom.features = [...selected];
        state.bom.featuresConfirmed = true;
        render();
      }));
      root.querySelector("[data-bom-feature-none]")?.addEventListener("click", () => {
        state.bom.features = [];
        state.bom.featuresConfirmed = true;
        render();
      });
    },
  },
  {
    id: "variant", phase: "Model", nav: "Try a variant",
    title: "Want to try a variant before committing?",
    sub: "Branching lets you explore a change in isolation. Here: split Packaging into a dedicated Finished-Goods area — see the diff, then keep or revert.",
    hint: "Try it or skip to continue.",
    gate: () => state.variant === "kept" || state.variant === "reverted" || state.variant === "skipped",
    body: () => {
      if (state.variant === "active") {
        const { entries } = Model.diff("variant-finished-goods");
        return `
          <div class="variant-live">
            <p class="variant-flag"><i data-lucide="git-branch"></i> On branch <strong>variant-finished-goods</strong> — ${entries.length} change${entries.length === 1 ? "" : "s"}</p>
            <div class="diff-list">
              ${entries
                .map(
                  (e) => `
                <div class="diff-item">
                  <span class="diff-kind ${e.kind}">${e.kind}</span>
                  <strong>${escapeHtml(e.name)}</strong>
                  ${e.changes ? e.changes.map((c) => `<span class="diff-pair"><em>${escapeHtml(c.field)}</em> ${escapeHtml(String(c.before ?? "—"))} → <b>${escapeHtml(String(c.after ?? "—"))}</b></span>`).join("") : ""}
                </div>`
                )
                .join("") || '<p class="muted">No changes recorded.</p>'}
            </div>
            <div class="variant-actions">
              <button class="cta solid" id="keepVariant" type="button"><i data-lucide="git-merge"></i><span>Keep variant</span></button>
              <button class="ghost-btn" id="revertVariant" type="button"><i data-lucide="undo-2"></i><span>Revert</span></button>
            </div>
          </div>
        `;
      }
      if (state.variant === "kept" || state.variant === "reverted") {
        const kept = state.variant === "kept";
        return `
          <div class="variant-outcome ${kept ? "kept" : "reverted"}">
            <i data-lucide="${kept ? "git-merge" : "undo-2"}"></i>
            <strong>${kept ? "Variant kept" : "Variant reverted"}</strong>
            <p>${kept ? "Packaging is now Finished Goods on the baseline — the merge is recorded as a governed decision." : "The baseline is unchanged. The branch was discarded."}</p>
          </div>
        `;
      }
      return `
        <div class="choice-grid two">
          ${choiceTile("try", false, "git-branch", "Try a variant", "Fork, change, review the diff")}
          ${choiceTile("skip", state.variant === "skipped", "arrow-right", "Skip for now", "Keep the baseline as-is")}
        </div>
      `;
    },
    attach: (root) => {
      root.querySelector("#keepVariant")?.addEventListener("click", () => {
        Model.merge("variant-finished-goods", { approver: "You", rationale: "Adopted Finished-Goods naming for go-live." });
        state.variant = "kept";
        render();
      });
      root.querySelector("#revertVariant")?.addEventListener("click", () => {
        Model.discardBranch("variant-finished-goods");
        state.variant = "reverted";
        render();
      });
      bindChoices(root, (v) => {
        if (v === "skip") { state.variant = "skipped"; render(); return; }
        if (v === "try") {
          if (Model.branch() !== "main") Model.checkout("main");
          Model.createBranch("variant-finished-goods");
          Model.commit({ label: "Renamed Packaging to Finished Goods on a variant branch.", ops: [{ op: "update", id: "packaging", props: { name: "Finished Goods", renamed: true } }] });
          state.variant = "active";
          render();
        }
      });
    },
  },
  {
    id: "demo", phase: "Validate", nav: "Demo",
    title: "Schedule the rush order.",
    sub: () => `A rush ${profile().order.toLowerCase()} is due today and needs a packaging line. Pick where it runs — the model scores the choice.`,
    hint: "Schedule the order to continue.",
    gate: () => !!state.demo,
    body: () => {
      const lanes = [
        ["wc-pack-3", "Packaging Line 3", "Preferred line, but calendar data is incomplete."],
        ["wc-pack-2", "Packaging Line 2", "Alternate line with available capacity."],
        ["wc-qc-1", "QC Release Bench", "Wrong capability for packaging operations."],
      ];
      return `
        ${state.demo ? `<div class="demo-result"><strong>${state.demo.score}% — training scored</strong><p>${escapeHtml(state.demo.note)}</p></div>` : ""}
        <div class="lane-list">
          ${lanes
            .map(
              ([id, name, note]) => `
            <button class="lane${state.demo?.laneId === id ? " picked" : ""}" type="button" data-lane="${id}">
              <strong>${escapeHtml(name)}</strong>
              <span>${escapeHtml(note)}</span>
            </button>`
            )
            .join("")}
        </div>
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-lane]").forEach((b) =>
        b.addEventListener("click", () => { scoreDemo(b.dataset.lane); })
      );
    },
  },
  {
    id: "readiness", phase: "Validate", nav: "Readiness",
    title: "Your readiness so far.",
    sub: "Computed from every decision you've made — model completeness, the data issue, and the demo evidence.",
    body: () => {
      const r = readiness();
      const rows = [
        ["Planning objective", state.scope ? "done" : "open", state.scope === "aps-ds" ? "Advanced Planning & Detailed Scheduling" : "Not selected"],
        [`${profile().facility} model`, siteName() ? "done" : "open", siteName() ? `${siteName()} · ${areas().length} areas` : "Not named"],
        ["Calendars & capacity", state.calendar?.layering ? "done" : "open", state.calendar?.layering ? `${calendarProfile().base} · ${state.calendar.pattern} · ${state.calendar.exceptions}` : "Not characterized"],
        [`${profile().resource} model`, state.lineDecision ? "done" : "open", state.lineDecision === "flag" ? "Line 3 flagged for cleanup" : state.lineDecision === "exclude" ? "Line 3 excluded" : "Unresolved"],
        ["BOM profile", state.bom?.source ? "done" : "open", state.bom?.source ? `${state.bom.structure} · ${state.bom.consumption} · ${state.bom.source}` : "Not characterized"],
        ["Demo evidence", state.demo ? "done" : "open", state.demo ? `${state.demo.score}% training score` : "Pending"],
        ["Migration risk", "info", state.migration ? "S/4 migration on roadmap" : "No migration planned"],
      ];
      return `
        <div class="readiness-hero">
          <div class="ring" style="--p:${r}">
            <span>${r}<small>%</small></span>
          </div>
          <div class="readiness-lines">
            ${rows
              .map(
                ([label, st, detail]) => `
              <div class="rline">
                <i data-lucide="${st === "done" ? "circle-check" : st === "info" ? "info" : "circle-dashed"}" class="ic-${st}"></i>
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(detail)}</span>
              </div>`
              )
              .join("")}
          </div>
        </div>
      `;
    },
  },
  {
    id: "handoff", phase: "Handoff", nav: "Handoff", cta: "Finish setup",
    title: "Hand off to the support organization.",
    sub: "The journey ends where support begins. This exports the model, decisions, and evidence — managed services are out of scope.",
    body: () => {
      const decisions = Model.nodesOfType("decision");
      return `
        <div class="summary-grid">
          <div class="summary-card"><span>Objective</span><strong>${state.scope === "aps-ds" ? "APS / Detailed Scheduling" : "Pending"}</strong><small>hours-to-weeks planning horizon</small></div>
          <div class="summary-card"><span>Model</span><strong>${areas().length} areas · ${workcenters().length} ${escapeHtml(profile().resource.toLowerCase())}s</strong><small>${Model.events().length} committed events</small></div>
          <div class="summary-card"><span>BOM</span><strong>${state.bom?.structure ? escapeHtml(state.bom.structure) : "Pending"}</strong><small>${state.bom?.source ? escapeHtml(state.bom.source) : "integration grain not set"}</small></div>
          <div class="summary-card"><span>Capacity</span><strong>${state.calendar?.layering ? escapeHtml(state.calendar.layering) : "Pending"}</strong><small>${state.calendar?.pattern ? escapeHtml(state.calendar.pattern) : "calendar pattern not set"}</small></div>
          <div class="summary-card"><span>Decisions</span><strong>${decisions.length} governed</strong><small>${decisions.length ? "merge history travels with handoff" : "no branch merges"}</small></div>
          <div class="summary-card"><span>Evidence</span><strong>${state.demo ? state.demo.score + "% training" : "Pending"}</strong><small>${state.demo ? "seeds the support runbook" : "no scored scenario"}</small></div>
          <div class="summary-card"><span>Readiness</span><strong>${readiness()}%</strong><small>at handoff</small></div>
        </div>
        <button class="ghost-btn wide" id="exportBtn" type="button"><i data-lucide="download"></i><span>Export handoff brief (JSON)</span></button>
      `;
    },
    attach: (root) => {
      root.querySelector("#exportBtn").addEventListener("click", exportBrief);
    },
  },
];

// ── Step UI helpers ──────────────────────────────────────────────────
function choiceTile(value, active, icon, title, sub) {
  return `
    <button class="choice${active ? " active" : ""}" type="button" data-choice="${escapeHtml(value)}">
      <i data-lucide="${icon}"></i>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(sub)}</span>
    </button>
  `;
}
function bindChoices(root, fn) {
  root.querySelectorAll("[data-choice]").forEach((b) =>
    b.addEventListener("click", () => fn(b.dataset.choice))
  );
}

function scoreDemo(laneId) {
  let r;
  if (laneId === "wc-pack-2") r = { score: 92, note: "Packaging Line 2 is a valid alternate, and the model keeps the Line 3 calendar issue open for data cleanup." };
  else if (laneId === "wc-pack-3") r = { score: 54, note: "Line 3 still has an unresolved calendar issue — it shouldn't run the rush order." };
  else r = { score: 28, note: "That resource doesn't perform packaging operations. The miss links to training and role readiness." };
  state.demo = { laneId, ...r };
  render();
}

// ── Render ───────────────────────────────────────────────────────────
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
    if (s.phase !== lastPhase) { html += `<p class="rail-phase">${escapeHtml(s.phase)}</p>`; lastPhase = s.phase; }
    const cls = state.done ? "done" : idx === state.i ? "current" : idx < state.i ? "done" : idx <= state.max ? "avail" : "locked";
    const icon = cls === "done" ? "circle-check" : cls === "current" ? "circle-dot" : cls === "locked" ? "lock" : "circle";
    html += `
      <button class="rail-step ${cls}" type="button" data-goto="${idx}" ${idx > state.max && !state.done ? "disabled" : ""}>
        <i data-lucide="${icon}"></i><span>${escapeHtml(s.nav)}</span>
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
      <p>${escapeHtml(siteName())} is modelled, validated at ${readiness()}% readiness, and ready to hand off. You can revisit any step from the rail.</p>
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
  $("#stageCount").textContent = `Step ${state.i + 1} of ${steps.length}`;
  $("#stageBody").dataset.step = step.id;
  $("#stageBody").innerHTML = `
    <div class="step">
      <p class="step-phase">${escapeHtml(step.phase)}</p>
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
  $("#footHint").textContent = ok ? "" : step.hint || "";

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
    archetype: archetype()?.name,
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
    site: siteName(),
    areas: areas().map((a) => a.name),
    workcenters: workcenters().map((w) => ({ name: w.name, area: areaName(w.areaId) })),
    billOfMaterials: state.bom,
    calendarAndCapacity: {
      terminology: calendarProfile(),
      profile: state.calendar,
    },
    decisions: { lineIssue: state.lineDecision, variant: state.variant, migration: state.migration },
    demo: state.demo,
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
