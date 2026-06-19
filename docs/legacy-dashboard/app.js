const profiles = {
  jde: {
    badge: "JDE",
    mini: "JDE current state",
    terms: {
      Order: "Work order",
      Route: "Routing",
      Resource: "Work center",
      Version: "No native production version",
    },
    memory: [
      "Current ERP is JDE; keep integration assumptions portable.",
      "Schedulers use work order language in workshops.",
      "Routing data quality is expected to vary by product family.",
    ],
  },
  sap_pp: {
    badge: "SAP PP",
    mini: "SAP ECC PP profile",
    terms: {
      Order: "Production order",
      Route: "Routing",
      Resource: "Work center",
      Version: "Production version",
    },
    memory: [
      "ECC PP terminology is active for training and test scripts.",
      "Production versions may drive APS mapping decisions.",
      "Capacity and calendar ownership should be confirmed early.",
    ],
  },
  sap_pi: {
    badge: "SAP PP-PI",
    mini: "Process manufacturing profile",
    terms: {
      Order: "Process order",
      Route: "Master recipe",
      Resource: "Resource",
      Version: "Production version",
    },
    memory: [
      "Use process order, recipe, phase, and resource language.",
      "Recipe phase assignments are part of semantic data checks.",
      "Batch and cleaning constraints should feed training scenarios.",
    ],
  },
  s4: {
    badge: "S/4HANA",
    mini: "S/4 target state",
    terms: {
      Order: "Manufacturing order",
      Route: "Routing or recipe",
      Resource: "Work center or resource",
      Version: "Production version",
    },
    memory: [
      "Future-state design should avoid one-off legacy mappings.",
      "Template decisions should be reusable across sites.",
      "Integration strategy should support S/4 migration waves.",
    ],
  },
};

const initialState = {
  activeScreen: "journey",
  step: 0,
  maxUnlockedStep: 2,
  gateMessage: "Select Site to continue the implementation tree.",
  erp: "sap_pi",
  domain: "aps",
  archetype: "batch-campaign",
  selectedRouting: "RT-TAB-WG-001",
  futureMigration: true,
  planningMode: "Finite capacity pilot",
  constraint: "Packaging Line 3",
};

let state = clone(initialState);

const UI_STORAGE_KEY = "implementationos-ui-v1";

function saveUiState() {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable — session stays in-memory
  }
}

function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (raw) state = { ...clone(initialState), ...JSON.parse(raw) };
  } catch {
    state = clone(initialState);
  }
}

// The journey spine: Intake -> Characterize -> Model -> Validate -> Handoff.
// Sales artifacts are consumed at Intake; the journey ends at hypercare
// handoff. Steps carry their phase so the map can group them.
const steps = [
  { label: "Intake", phase: "Intake", title: "Sales handoff intake" },
  { label: "Characterize", phase: "Characterize", title: "Archetype and dialect" },
  { label: "Site", phase: "Model", title: "Site model" },
  { label: "Areas", phase: "Model", title: "Areas and departments" },
  { label: "Work Centers", phase: "Model", title: "Workcenter reconciliation" },
  { label: "Demo", phase: "Validate", title: "Mock scheduling demo" },
  { label: "Handoff", phase: "Handoff", title: "Hypercare handoff" },
];

// Sales-stage artifacts are intake inputs: imported once to seed project
// memory, never managed as implementation workstreams.
const intakeInputs = [
  { name: "RFI", owner: "Sales + Solution", detail: "Initial data request for sites, products, orders, resources, calendars, integrations, and constraints" },
  { name: "RFP Response", owner: "Sales + Solution", detail: "Scope assumptions, differentiators, data asks, implementation approach" },
  { name: "Solution Demo Script", owner: "Solution", detail: "Persona story, planning archetype, pharma routing scenario" },
  { name: "SaaS Agreement / Order Form", owner: "Sales + Legal", detail: "Subscription terms, environments, product modules, users, service dates, renewal terms" },
  { name: "SOS", owner: "Sales Ops", detail: "Sales order summary, commercial assumptions, purchased scope, handoff notes" },
  { name: "Statement of Work", owner: "Delivery + Legal", detail: "Work packages, responsibilities, assumptions, exclusions, acceptance model" },
  { name: "Sales to Service Transition", owner: "Sales + Delivery", detail: "Customer context, promised outcomes, risks, stakeholders, scope caveats, demo commitments" },
];

const deliverableJourney = [
  {
    stage: "Discover",
    goal: "Turn sales intent into implementation truth.",
    artifacts: [
      { name: "Kick-off Deck", owner: "PMO", status: "Ready", evidence: "Project goals, team roles, cadence, scope, milestones, risks, working model" },
      { name: "Discovery Notes", owner: "Consulting", status: "Active", evidence: "Pain points, current-state process, decision cadence, open questions" },
      { name: "Fit-Gap Register", owner: "Functional Lead", status: "Active", evidence: "Standard fit, configuration gap, extension candidate, product feedback" },
      { name: "RACI Matrix", owner: "PMO", status: "Drafted", evidence: "Business process owners, data owners, integration owners, approvers" },
    ],
  },
  {
    stage: "Blueprint",
    goal: "Freeze the process model the build team can execute against.",
    artifacts: [
      { name: "Blueprint Document", owner: "Solution Architect", status: "In review", evidence: "To-be process, SAP PI terms, resource model, constraints, integrations" },
      { name: "Data Migration Workbook", owner: "Data Lead", status: "Profiling", evidence: "Sites, resources, calendars, recipes, inventory, purchase orders" },
      { name: "Integration Map", owner: "Integration Lead", status: "Drafted", evidence: "SAP objects, APS payloads, confirmations, exceptions, reconciliation rules" },
    ],
  },
  {
    stage: "Build",
    goal: "Convert blueprint decisions into sprint-ready work.",
    artifacts: [
      { name: "User Stories", owner: "Product + Delivery", status: "Prioritized", evidence: "Planner stories, admin stories, batch campaign planning, constraints" },
      { name: "Configuration Backlog", owner: "Functional Lead", status: "Active", evidence: "Calendars, resources, master recipes, changeovers, alerts, dashboards" },
      { name: "Technical Design", owner: "Engineering", status: "Scoped", evidence: "Interfaces, extensions, performance model, security roles, environments" },
    ],
  },
  {
    stage: "Govern",
    goal: "Control decisions, changes, and scope drift without losing delivery speed.",
    artifacts: [
      { name: "CR Log", owner: "PMO + Product", status: "Active", evidence: "Change requests, impact analysis, commercial decision, sprint and release impact" },
      { name: "Decision Log", owner: "Solution Architect", status: "Active", evidence: "Key design decisions, alternatives rejected, approvers, rationale, downstream impact" },
      { name: "RAID Log", owner: "PMO", status: "Active", evidence: "Risks, assumptions, issues, dependencies, owners, due dates, escalation path" },
      { name: "Steering Deck", owner: "PMO", status: "Drafted", evidence: "Executive status, milestones, blockers, decisions needed, budget and timeline signals" },
    ],
  },
  {
    stage: "Validate",
    goal: "Prove the implementation works across roles, data, and scenarios.",
    artifacts: [
      { name: "UAT Scripts", owner: "Business Owners", status: "Gated by training evidence", evidence: "Scenario steps, expected results, pass/fail evidence, defect links" },
      { name: "E2E Scripts", owner: "Program Team", status: "Drafted", evidence: "Demand to supply, recipe to schedule, order to confirmation, inventory checks" },
      { name: "Cutover Plan", owner: "PMO + IT", status: "Outline", evidence: "Mock loads, freeze windows, role readiness, go/no-go criteria" },
    ],
  },
  {
    stage: "Launch",
    goal: "Move into production with traceable decisions and support ownership.",
    artifacts: [
      { name: "GPT", owner: "PMO + Workstream Leads", status: "Open", evidence: "Go-live preparation tracker, readiness checklist, owners, blockers, go/no-go evidence" },
      { name: "Training Pack", owner: "Change Lead", status: "Scenario linked", evidence: "Planner exercises, admin guides, role-specific job aids" },
      { name: "Go-Live Checklist", owner: "PMO", status: "Open", evidence: "Data signoff, interface signoff, support rota, rollback criteria" },
      { name: "Support Handoff", owner: "Support Lead", status: "Open", evidence: "Known issues, monitoring cadence, escalation contacts, runbook links, warranty coverage" },
      { name: "Hypercare Runbook", owner: "Support Lead", status: "Open", evidence: "Issue triage, severity rules, daily cadence, product feedback loop" },
    ],
  },
];

const graphNodes = [
  { id: "intake", label: "Intake", sub: "Sales inputs", x: 615, y: 478, step: 0, tone: "amber" },
  { id: "setup", label: "Project", sub: "ERP dialect", x: 495, y: 456, step: 1, tone: "teal", major: true },
  { id: "site", label: "Site", sub: "Plant model", x: 430, y: 368, step: 2, tone: "green" },
  { id: "areas", label: "Areas", sub: "Departments", x: 520, y: 300, step: 3, tone: "coral" },
  { id: "workcenters", label: "Work Centers", sub: "Resources", x: 448, y: 220, step: 4, tone: "violet", major: true },
  { id: "data", label: "Data Quality", sub: "Sample extract", x: 650, y: 216, screen: "intelligence", tone: "amber" },
  { id: "demo", label: "Demo", sub: "Mock schedule", x: 536, y: 146, step: 5, tone: "teal" },
  { id: "uat", label: "UAT", sub: "Script 12", x: 670, y: 332, screen: "delivery", tone: "violet" },
  { id: "training", label: "Training", sub: "Planner score", x: 356, y: 156, screen: "delivery", tone: "green" },
  { id: "hypercare", label: "Handoff", sub: "Hypercare exit", x: 280, y: 310, step: 6, tone: "amber" },
  { id: "rnd", label: "R&D", sub: "Enhancement", x: 770, y: 104, screen: "delivery", tone: "coral", major: true },
];

const graphEdges = [
  ["intake", "setup"],
  ["setup", "site"],
  ["site", "areas"],
  ["areas", "workcenters"],
  ["workcenters", "data"],
  ["workcenters", "demo"],
  ["demo", "training"],
  ["demo", "uat"],
  ["data", "uat"],
  ["training", "hypercare"],
  ["data", "rnd"],
  ["uat", "rnd"],
];

const constellationClusters = [
  { cx: 180, cy: 132, radius: 78, count: 13, tone: "violet", phase: 0.2 },
  { cx: 300, cy: 82, radius: 64, count: 10, tone: "green", phase: 1.1 },
  { cx: 760, cy: 210, radius: 76, count: 12, tone: "green", phase: 0.7 },
  { cx: 800, cy: 405, radius: 72, count: 12, tone: "coral", phase: 1.8 },
  { cx: 215, cy: 420, radius: 62, count: 10, tone: "amber", phase: 2.4 },
  { cx: 872, cy: 82, radius: 58, count: 9, tone: "violet", phase: 0.4 },
  { cx: 116, cy: 290, radius: 54, count: 8, tone: "coral", phase: 1.5 },
];

const planningArchetypes = [
  {
    id: "batch-campaign",
    name: "Batch / Campaign Manufacturing",
    core: "Products are made in batches, often with cleaning or changeovers between product families.",
    examples: "Pharma, food, chemicals, cosmetics, paints, beverages",
    constraints: ["Batch size", "Campaigning", "Cleaning", "Shelf life", "QA holds", "Shared tanks / fillers"],
    model: "Batch -> process step -> hold -> test/release -> pack -> clean/changeover",
    tone: "violet",
  },
  {
    id: "continuous-process",
    name: "Continuous Process",
    core: "The line runs continuously; stopping is expensive and flow balance matters.",
    examples: "Oil refining, petrochemicals, paper, steel, glass, cement, energy",
    constraints: ["Flow balance", "Storage buffers", "Grade transitions", "Minimum run length", "Shutdown windows", "Energy cost"],
    model: "Flow rates + tanks/buffers + grade transitions + long campaigns",
    tone: "green",
  },
  {
    id: "discrete-assembly",
    name: "Discrete Assembly",
    core: "Finished goods are assembled from many components and BOM availability drives feasibility.",
    examples: "Automotive, electronics, appliances, machinery, medical devices",
    constraints: ["BOM availability", "Workstations", "Labor skills", "Sequence dependencies", "Variant complexity", "Supplier constraints"],
    model: "Component availability + routing + capacity + pegging + assembly sequence",
    tone: "teal",
  },
  {
    id: "cto-eto",
    name: "Configure / Engineer To Order",
    core: "The product is not fully known until the order arrives.",
    examples: "Industrial machinery, aerospace, defense, shipbuilding, custom equipment",
    constraints: ["Engineering lead time", "Project milestones", "Long-lead parts", "Specialized skills", "Order-specific routings", "Approval gates"],
    model: "Project network + material plan + finite capacity + milestone scheduling",
    tone: "amber",
  },
  {
    id: "job-shop",
    name: "Job Shop / High-Mix Low-Volume",
    core: "Many different jobs compete for many different machines.",
    examples: "Machining, metal fabrication, toolmaking, repair shops, printing",
    constraints: ["Alternative machines", "Setup/changeover", "Due dates", "Routing variability", "Bottlenecks", "Rework loops"],
    model: "Operation sequencing + finite capacity + dispatching + due-date optimization",
    tone: "coral",
  },
  {
    id: "flow-shop",
    name: "Flow Shop / Line Manufacturing",
    core: "Products move through roughly the same sequence of operations.",
    examples: "Packaging, bottling, automotive lines, consumer goods, textiles",
    constraints: ["Line rate", "Line balancing", "Sequence-dependent setup", "Changeover windows", "Starvation/blocking", "OEE losses"],
    model: "Sequence on line + rate + changeovers + buffers + downtime",
    tone: "green",
  },
  {
    id: "packaging-postponement",
    name: "Packaging / Late-Stage Postponement",
    core: "Bulk or semi-finished material is made first; final SKU identity happens late.",
    examples: "Pharma, food, beverages, cosmetics, chemicals, consumer goods",
    constraints: ["Bulk-to-pack split", "Market labels", "Packaging materials", "Bulk shelf life", "Line clearance", "Campaigning by format"],
    model: "Bulk supply -> allocation to packaging orders -> packaging line sequence",
    tone: "violet",
  },
  {
    id: "perishable-food",
    name: "Food With Perishability",
    core: "Time is a hard constraint because raw materials, WIP, or finished goods degrade.",
    examples: "Dairy, meat, seafood, bakery, fresh meals, produce",
    constraints: ["Raw material expiry", "WIP hold times", "Cold chain", "Freshness demand", "Cleaning/allergen", "Daily production cycle"],
    model: "Perishable inventory + short-cycle scheduling + expiry-aware allocation",
    tone: "teal",
  },
  {
    id: "maturation-aging",
    name: "Maturation / Aging / Curing",
    core: "The product must wait for a chemically or biologically meaningful time.",
    examples: "Cheese, wine, spirits, cured meats, biotech, fermentation, ceramics",
    constraints: ["Mandatory wait time", "Vessel/cellar capacity", "Environmental conditions", "Quality uncertainty", "Blending", "Long horizon"],
    model: "Start batch -> occupy aging capacity -> quality classify -> blend/pack",
    tone: "amber",
  },
  {
    id: "semiconductor-fab",
    name: "Semiconductor / Electronics Fab",
    core: "Products revisit the same equipment many times in complex reentrant flows.",
    examples: "Semiconductors, wafers, advanced electronics, PCB fabrication",
    constraints: ["Reentrant routing", "Tool qualification", "Batch tools", "Time windows", "Yield sensitivity", "Priority lots"],
    model: "Reentrant routing + batching + time windows + tool eligibility",
    tone: "violet",
  },
  {
    id: "mining-primary",
    name: "Mining / Primary Materials",
    core: "Supply is constrained by geology, extraction rates, blending, and transport.",
    examples: "Mining, quarrying, agriculture inputs, pulpwood, oil and gas extraction",
    constraints: ["Source quality", "Blending", "Extraction capacity", "Transport", "Stockpiles", "Long horizon"],
    model: "Source extraction -> stockpile blending -> processing -> transport",
    tone: "green",
  },
  {
    id: "distribution-logistics",
    name: "Distribution / Logistics Scheduling",
    core: "The main constraint is moving goods through a network, not production.",
    examples: "Retail, e-commerce, spare parts, cold chain, pharma distribution, grocery",
    constraints: ["Warehouses", "Transport lanes", "Delivery windows", "Load building", "Cross-docking", "Service levels"],
    model: "Inventory allocation + transport capacity + delivery windows",
    tone: "teal",
  },
  {
    id: "field-service",
    name: "Workforce / Field Service",
    core: "The critical resource is people with skills, locations, calendars, and travel time.",
    examples: "Maintenance, utilities, telecom, healthcare services, installation",
    constraints: ["Skills", "Travel time", "Appointments", "Parts availability", "Labor laws", "Emergency jobs"],
    model: "Technician + skill + location + appointment window + travel optimization",
    tone: "coral",
  },
  {
    id: "maintenance-turnaround",
    name: "Maintenance / Turnaround",
    core: "Maintenance work packages compete for limited downtime windows.",
    examples: "Chemicals, oil and gas, utilities, aviation, rail, heavy manufacturing",
    constraints: ["Asset availability", "Shutdown window", "Crew skills", "Precedence", "Safety permits", "Spare parts"],
    model: "Work package network + asset downtime + crew capacity + permits/materials",
    tone: "amber",
  },
  {
    id: "construction-project",
    name: "Construction / Project Manufacturing",
    core: "The factory is a project site; location and sequence matter.",
    examples: "Construction, shipbuilding, infrastructure, large capital projects",
    constraints: ["Spatial constraints", "Precedence", "Weather", "Subcontractors", "Long-lead materials", "Inspection gates"],
    model: "Project schedule + crew/resource leveling + location-based planning",
    tone: "green",
  },
  {
    id: "healthcare-capacity",
    name: "Healthcare / Hospital Capacity",
    core: "Patients flow through constrained resources with uncertain durations and priorities.",
    examples: "Hospitals, labs, diagnostic centers, surgery centers",
    constraints: ["Rooms", "Staff", "Patient priority", "Uncertain duration", "Equipment", "Turnaround"],
    model: "Patient flow + resource capacity + urgency + stochastic duration",
    tone: "violet",
  },
];

const dataObjectGroups = [
  {
    title: "Plant Structure",
    summary: "The physical and organizational model that anchors every planning object.",
    objects: [
      { id: "site-object", name: "Site", icon: "factory", status: "Configured", detail: "Milano Packaging Plant as the semantic root.", tone: "green" },
      { id: "dept-object", name: "Departments", icon: "network", status: "Configured", detail: "Mixing, Packaging/Finished Goods, Quality.", tone: "coral" },
      { id: "workcenter-object", name: "Workcenters", icon: "boxes", status: "Configured", detail: "Finite resources and capability ownership.", tone: "violet" },
      { id: "resource-object", name: "Resources", icon: "cpu", status: "Next", detail: "Detailed machines, crews, tools, skills, and alternates.", tone: "teal" },
    ],
  },
  {
    title: "Capacity And Availability",
    summary: "The time model that determines whether a plan can actually be scheduled.",
    objects: [
      { id: "calendar-object", name: "Calendars / Shifts", icon: "calendar-days", status: "Profiled", detail: "Shift patterns, exceptions, and planning horizons.", tone: "green" },
      { id: "downtime-object", name: "Downtimes", icon: "circle-pause", status: "Mocked", detail: "Planned maintenance, holidays, constraints, and outages.", tone: "amber" },
      { id: "changeover-object", name: "Changeovers", icon: "shuffle", status: "Mocked", detail: "Sequence-dependent setup and cleaning matrices.", tone: "coral" },
    ],
  },
  {
    title: "Product And Process Master Data",
    summary: "The manufacturing model that connects demand, constraints, and executable operations.",
    objects: [
      { id: "sku-object", name: "SKUs", icon: "barcode", status: "Sampled", detail: "Items with families, UoM, shelf-life, and planning policy.", tone: "teal" },
      { id: "attribute-object", name: "Attributes / Characteristics", icon: "tags", status: "Sampled", detail: "Allergens, product family, package type, grade, temperature class.", tone: "violet" },
      { id: "recipe-object", name: "Routings / Recipes", icon: "git-branch", status: "Profiled", detail: "Operations, phases, resource requirements, yields, and durations.", tone: "green" },
    ],
  },
  {
    title: "Execution And Supply Signals",
    summary: "Actuals and supply-side commitments that turn a static model into project truth.",
    objects: [
      { id: "confirm-object", name: "Execution Data / Confirmations / Partials", icon: "clipboard-check", status: "Future", detail: "Actual starts, completions, partial quantities, scrap, and delays.", tone: "amber" },
      { id: "sales-order-object", name: "Sales Orders", icon: "receipt-text", status: "Future", detail: "Customer demand, due dates, priorities, promised quantities, and allocation signals.", tone: "violet" },
      { id: "inventory-object", name: "Inventory", icon: "warehouse", status: "Future", detail: "On-hand, lots, holds, expiry, location, and allocation status.", tone: "green" },
      { id: "po-object", name: "Purchase Orders", icon: "truck", status: "Future", detail: "Inbound material commitments and supplier risk.", tone: "coral" },
    ],
  },
];

const mesObjectGroups = [
  {
    title: "Recipe And Batch Instruction Model",
    summary: "The executable instruction structure that turns recipes into controlled operator work.",
    objects: [
      { id: "mes-recipe-object", name: "Recipe and Batch Instruction Model", icon: "book-open-check", status: "MES", detail: "MBRs, recipes, phases, steps, parameters, limits, and reusable instruction blocks.", tone: "violet" },
    ],
  },
  {
    title: "Shopfloor Execution And EBR",
    summary: "The live record of what operators and systems actually did on the floor.",
    objects: [
      { id: "mes-ebr-object", name: "Shopfloor Execution and EBR", icon: "clipboard-list", status: "MES", detail: "Batch records, operator tasks, confirmations, timestamps, and e-signatures.", tone: "teal" },
    ],
  },
  {
    title: "Materials, Weighing, And Genealogy",
    summary: "The traceability layer that connects lots, containers, and actual consumption.",
    objects: [
      { id: "mes-material-object", name: "Materials, Weighing, and Genealogy", icon: "scale", status: "MES", detail: "Lots, containers, dispensing, consumption, reconciliation, and traceability.", tone: "green" },
    ],
  },
  {
    title: "Equipment, Cleaning, And Line Clearance",
    summary: "The equipment state model behind compliant setup, cleaning, and use.",
    objects: [
      { id: "mes-equipment-object", name: "Equipment, Cleaning, and Line Clearance", icon: "badge-check", status: "MES", detail: "Equipment status, cleaning state, calibration, setup, clearance, and usage logs.", tone: "coral" },
    ],
  },
  {
    title: "Quality Controls And Exceptions",
    summary: "The exception and quality gate model that governs batch movement.",
    objects: [
      { id: "mes-quality-object", name: "Quality Controls and Exceptions", icon: "shield-alert", status: "MES", detail: "IPCs, sampling, deviations, holds, OOS/OOT triggers, and QA approvals.", tone: "amber" },
    ],
  },
  {
    title: "Review, Release, And Compliance Evidence",
    summary: "The release evidence chain auditors and QA teams need to trust the record.",
    objects: [
      { id: "mes-release-object", name: "Review, Release, and Compliance Evidence", icon: "file-check-2", status: "MES", detail: "Batch review, audit trail, electronic signatures, review by exception, and release status.", tone: "violet" },
    ],
  },
  {
    title: "Automation And External Interfaces",
    summary: "The connected systems layer around MES execution and evidence capture.",
    objects: [
      { id: "mes-interface-object", name: "Automation and External Interfaces", icon: "cable", status: "MES", detail: "ERP, LIMS, WMS, PLC/SCADA, historian, serialization, and machine data.", tone: "teal" },
    ],
  },
];

const $ = (selector) => document.querySelector(selector);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Graph accessors: every screen reads domain objects as projections of
// the semantic graph in model.js, never from local copies.
function areas() {
  return Model.nodesOfType("area").map((node) => ({ id: node.id, ...node.props }));
}

function workcenters() {
  return Model.nodesOfType("workcenter").map((node) => ({ id: node.id, ...node.props }));
}

function siteName() {
  return Model.node("site").props.name;
}

function packagingRenamed() {
  return Boolean(Model.node("packaging")?.props.renamed);
}

function training() {
  return Model.node("training")?.props || null;
}

function assignedOrder() {
  return Model.node("assigned-order")?.props || null;
}

function impacts() {
  return Model.log();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function profile() {
  return profiles[state.erp];
}

function selectedArchetype() {
  return planningArchetypes.find((archetype) => archetype.id === state.archetype) || planningArchetypes[0];
}

function activePack() {
  return ArchetypePacks[archetypePackMap[state.archetype] || "pharma-batch"];
}

// Keep the selected routing valid when the archetype switches packs.
function syncRoutingToPack() {
  if (!activePack().routings.some((routing) => routing.id === state.selectedRouting)) {
    state.selectedRouting = activePack().routings[0].id;
  }
}

function selectedRouting() {
  return activePack().routings.find((routing) => routing.id === state.selectedRouting) || activePack().routings[0];
}

function areaName(areaId) {
  return areas().find((area) => area.id === areaId)?.name || "Unassigned";
}

// Readiness is computed, not scripted: each node contributes through a
// per-type rule, and the project score is a weighted fold over three
// pools — model health, data-object maturity, and delivery evidence.
const statusWeights = {
  configured: 1,
  ready: 0.9,
  profiled: 0.7,
  sampled: 0.5,
  changed: 0.5,
  mocked: 0.4,
  reconcile: 0.3,
  next: 0.2,
  blocked: 0.1,
  future: 0,
  mes: 0,
};

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function workcenterReadiness(wc) {
  let value = 1;
  if (wc.needsReconcile) value -= 0.5;
  if (/missing calendar/i.test(wc.capacity)) value -= 0.5;
  if (wc.status === "Data issue") value -= 0.3;
  return Math.max(0, value);
}

function readinessScore() {
  const modelPool = average(workcenters().map(workcenterReadiness));
  const dataPool = average(
    dataObjectGroups
      .flatMap((group) => group.objects)
      .map((object) => statusWeights[objectStatusLabel(object).toLowerCase()] ?? 0.4)
  );
  const evidencePool = average([
    training() ? Number.parseFloat(training().score) / 100 : 0,
    assignedOrder() ? 1 : 0,
  ]);
  let score = (modelPool * 0.3 + dataPool * 0.5 + evidencePool * 0.2) * 100;
  if (state.futureMigration) score -= 4;
  return Math.max(5, Math.min(99, Math.round(score)));
}

function riskCount() {
  let count = 2;
  if (state.futureMigration) count += 1;
  if (workcenters().some((wc) => wc.needsReconcile)) count += 1;
  return count;
}

function semanticObjectCount() {
  const dataObjects = [...dataObjectGroups, ...mesObjectGroups].flatMap((group) => group.objects).length;
  return areas().length + workcenters().length + dataObjects;
}

function nodeById(id) {
  return graphNodes.find((node) => node.id === id);
}

function activeGraphNodeId() {
  return graphNodes.find((node) => node.step === state.step)?.id || "setup";
}

function hasOpenReconciliation() {
  return workcenters().some((wc) => wc.needsReconcile);
}

function maxAllowedStep() {
  return hasOpenReconciliation() ? 4 : Math.max(5, state.maxUnlockedStep);
}

function canEnterStep(step) {
  return step <= Math.min(state.maxUnlockedStep, maxAllowedStep());
}

function completedNodeIds() {
  const completed = new Set();
  for (let index = 0; index < Math.min(state.step, state.maxUnlockedStep); index += 1) {
    const node = graphNodes.find((item) => item.step === index);
    if (node) completed.add(node.id);
  }
  if (state.step > 4 && !hasOpenReconciliation()) completed.add("workcenters");
  if (assignedOrder()) completed.add("demo");
  if (training()) completed.add("training");
  if (readinessScore() >= 60) completed.add("data");
  return completed;
}

function isNodeLocked(node) {
  if (node.step !== undefined) return !canEnterStep(node.step);
  if (node.id === "data") return state.maxUnlockedStep < 4;
  if (node.id === "training") return !assignedOrder();
  if (node.id === "uat") return !training();
  if (node.id === "rnd") return !training();
  return false;
}

function gateTextFor(node) {
  if (node.step !== undefined && node.step > state.maxUnlockedStep) {
    return `Unlock ${node.label} by completing the previous implementation node.`;
  }
  if (node.id === "demo" && hasOpenReconciliation()) return "Clear workcenter reconciliation before opening the demo scenario.";
  if (node.id === "data") return "Reach the Work Centers node to unlock semantic data checks.";
  if (node.id === "training") return "Schedule the rush order in the Demo node to unlock training scoring.";
  if (node.id === "uat") return "Complete the training scenario before UAT opens.";
  if (node.id === "hypercare") return "Raise readiness above 60% before hypercare opens.";
  if (node.id === "rnd") return "Generate training evidence before promoting an enhancement candidate.";
  return "This node is gated by prior implementation work.";
}

function unlockThrough(step) {
  state.maxUnlockedStep = Math.max(state.maxUnlockedStep, Math.min(step, steps.length - 1));
}

function enterStep(step) {
  const targetNode = graphNodes.find((node) => node.step === step);
  if (!canEnterStep(step)) {
    state.gateMessage = gateTextFor(targetNode || graphNodes[0]);
    renderAll();
    return;
  }
  state.activeScreen = "journey";
  state.step = step;
  if (step < steps.length - 1 && !hasOpenReconciliation()) unlockThrough(step + 1);
  renderAll();
}

function graphNodeLabel(node) {
  if (node.id === "areas") return packagingRenamed() ? "Finished Goods" : node.label;
  if (node.id === "data") return workcenters().some((wc) => wc.needsReconcile) ? "Reconcile" : node.label;
  if (node.id === "training") return training()?.score ? `Training ${training().score}` : node.label;
  return node.label;
}

function graphNodeSub(node) {
  if (isNodeLocked(node)) return "Locked";
  if (node.id === "site") return siteName();
  if (node.id === "workcenters") return `${workcenters().length} ${profile().terms.Resource.toLowerCase()}s`;
  if (node.id === "demo") return assignedOrder() ? "Scenario scored" : node.sub;
  if (node.id === "data") return `${readinessScore()}% ready`;
  return node.sub;
}

function buildConstellation(variant) {
  const clusters = variant === "compact" ? constellationClusters.slice(0, 4) : constellationClusters;
  const nodes = [];
  const edges = [];
  clusters.forEach((cluster, clusterIndex) => {
    let previous = null;
    for (let index = 0; index < cluster.count; index += 1) {
      const angle = cluster.phase + (index / cluster.count) * Math.PI * 2;
      const innerPulse = index % 4 === 0 ? 0.55 : index % 3 === 0 ? 0.78 : 1;
      const wobble = Math.sin(index * 1.7 + clusterIndex) * 12;
      const node = {
        id: `minor-${clusterIndex}-${index}`,
        x: cluster.cx + Math.cos(angle) * (cluster.radius * innerPulse + wobble),
        y: cluster.cy + Math.sin(angle) * (cluster.radius * innerPulse - wobble * 0.4),
        tone: cluster.tone,
        major: index % 5 === 0,
      };
      nodes.push(node);
      if (previous) edges.push([previous.id, node.id]);
      if (index % 4 === 0) edges.push([node.id, `cluster-${clusterIndex}`]);
      previous = node;
    }
  });
  return { nodes, edges };
}

function renderGraphs() {
  renderGraph("#journeyGraph", "compact");
  renderGraph("#intelligenceGraph", "intelligence");
  const activeNode = nodeById(activeGraphNodeId());
  const focusBadge = $("#graphFocusBadge");
  if (focusBadge && activeNode) focusBadge.textContent = graphNodeLabel(activeNode);
}

function renderGraph(selector, variant) {
  const graph = $(selector);
  if (!graph) return;
  const activeId = activeGraphNodeId();
  const visibleNodes =
    variant === "compact"
      ? graphNodes.filter((node) => node.step !== undefined || ["data", "training"].includes(node.id))
      : graphNodes;
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const constellation = buildConstellation(variant);
  const constellationLookup = new Map(constellation.nodes.map((node) => [node.id, node]));
  constellationClusters.forEach((cluster, index) => {
    constellationLookup.set(`cluster-${index}`, { x: cluster.cx, y: cluster.cy });
  });
  const minorEdges = constellation.edges
    .map(([from, to]) => {
      const source = constellationLookup.get(from);
      const target = constellationLookup.get(to);
      if (!source || !target) return "";
      return `<line class="minor-link" x1="${source.x.toFixed(1)}" y1="${source.y.toFixed(1)}" x2="${target.x.toFixed(1)}" y2="${target.y.toFixed(1)}" />`;
    })
    .join("");
  const minorNodes = constellation.nodes
    .map(
      (node) =>
        `<circle class="minor-node ${node.tone}${node.major ? " major" : ""}" cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${node.major ? 8 : 4}" />`
    )
    .join("");
  const completed = completedNodeIds();
  const edgeMarkup = graphEdges
    .filter(([from, to]) => visibleIds.has(from) && visibleIds.has(to))
    .map(([from, to]) => {
      const source = nodeById(from);
      const target = nodeById(to);
      const active = from === activeId || to === activeId ? " active" : "";
      const locked = isNodeLocked(source) || isNodeLocked(target) ? " locked" : "";
      const done = completed.has(from) && completed.has(to) ? " complete" : "";
      return `<line class="node-link${active}${locked}${done}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" />`;
    })
    .join("");

  const nodeMarkup = visibleNodes
    .map((node, index) => {
      const classes = ["graph-button", node.tone];
      const locked = isNodeLocked(node);
      if (node.id === activeId) classes.push("active");
      if (completed.has(node.id)) classes.push("complete");
      if (locked) classes.push("locked");
      if (node.step !== undefined && node.step < state.step) classes.push("visited");
      if (node.id === "data" && hasOpenReconciliation()) classes.push("warning");
      if (node.id === "training" && training()) classes.push("scored");
      const action =
        node.step !== undefined
          ? `data-graph-step="${node.step}"`
          : node.screen
            ? `data-graph-screen="${node.screen}"`
            : "";
      const stateText = locked ? "Locked" : completed.has(node.id) ? "Complete" : node.id === activeId ? "Active" : "Available";
      return `
        <button class="${classes.join(" ")}" type="button" ${action}
          data-graph-id="${escapeHtml(node.id)}"
          style="left:${(node.x / 1000) * 100}%; top:${(node.y / 520) * 100}%; --node-delay:${index * 42}ms"
          aria-label="${escapeHtml(graphNodeLabel(node))}, ${stateText}"
          title="${escapeHtml(graphNodeLabel(node))}: ${escapeHtml(graphNodeSub(node))}">
          <span class="node-dot"></span>
          <strong>${escapeHtml(graphNodeLabel(node))}</strong>
          <small>${escapeHtml(graphNodeSub(node))}</small>
          <em>${stateText}</em>
        </button>
      `;
    })
    .join("");

  graph.innerHTML = `
    <svg class="node-links" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
      <circle class="gate-ring outer" cx="500" cy="270" r="245" />
      <circle class="gate-ring middle" cx="500" cy="270" r="168" />
      <circle class="gate-ring inner" cx="500" cy="270" r="86" />
      ${minorEdges}
      ${minorNodes}
      ${edgeMarkup}
    </svg>
    <div class="graph-aura one"></div>
    <div class="graph-aura two"></div>
    ${nodeMarkup}
    <div class="gate-toast">${escapeHtml(state.gateMessage)}</div>
  `;

  graph.querySelectorAll("[data-graph-step]").forEach((button) => {
    button.addEventListener("click", () => {
      enterStep(Number(button.dataset.graphStep));
    });
  });

  graph.querySelectorAll("[data-graph-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetNode = nodeById(button.dataset.graphId);
      if (targetNode && isNodeLocked(targetNode)) {
        state.gateMessage = gateTextFor(targetNode);
        renderAll();
        return;
      }
      state.activeScreen = button.dataset.graphScreen;
      state.gateMessage = "Unlocked nodes can become project screens, training paths, or delivery workstreams.";
      renderAll();
    });
  });
}

function renderAll() {
  syncRoutingToPack();
  renderScreenNav();
  renderSnapshot();
  renderArchetypeOptions();
  renderContext();
  renderGraphs();
  renderJourneyMap();
  renderStage();
  renderArchetypesScreen();
  renderDataScreen();
  renderRoutingScreen();
  renderIntelligence();
  renderBranchPanel();
  renderDeliveryScreen();
  syncStaticControls();
  refreshIcons();
  saveUiState();
}

function renderScreenNav() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    const locked = false;
    button.classList.toggle("active", button.dataset.screen === state.activeScreen);
    button.classList.toggle("locked", locked);
    button.setAttribute("aria-disabled", locked ? "true" : "false");
  });
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === `${state.activeScreen}Screen`);
  });
}

function renderSnapshot() {
  $("#erpMini").textContent = profile().mini;
  $("#objectCount").textContent = semanticObjectCount();
  $("#dataReadiness").textContent = `${readinessScore()}%`;
  $("#dataStageLabel").textContent = training() ? "Hybrid mock plus training evidence" : "Profiled mock plus sample extract";
  $("#trainingScore").textContent = training()?.score || "Pending";
  $("#trainingNote").textContent = training()?.noteShort || "one scheduling puzzle ready";
}

function renderContext() {
  $("#dialectBadge").textContent = profile().badge;

  const memory = [...profile().memory];
  memory.unshift(`Selected routing: ${selectedRouting().id} (${selectedRouting().type}).`);
  memory.unshift(`Planning archetype: ${selectedArchetype().name}.`);
  if (state.futureMigration) {
    memory.unshift("Future S/4 migration is a design constraint, not a side note.");
  }

  $("#memoryList").innerHTML = memory.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#termList").innerHTML = Object.entries(profile().terms)
    .map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
}

function renderArchetypeOptions() {
  const select = $("#archetypeProfile");
  if (!select) return;
  select.innerHTML = planningArchetypes
    .map((archetype) => `<option value="${escapeHtml(archetype.id)}">${escapeHtml(archetype.name)}</option>`)
    .join("");
}

function renderJourneyMap() {
  $("#journeyMap").innerHTML = steps
    .map((step, index) => {
      const classes = ["journey-step"];
      if (index === state.step) classes.push("active");
      if (index < state.step) classes.push("done");
      if (!canEnterStep(index)) classes.push("locked");
      return `
        <button class="${classes.join(" ")}" type="button" data-step="${index}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(step.label)}</strong>
          <em>${escapeHtml(step.phase)}</em>
        </button>
      `;
    })
    .join("");

  $("#journeyMap").querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => {
      enterStep(Number(button.dataset.step));
    });
  });
}

function renderStage() {
  const stage = $("#journeyStage");
  const renderers = [
    renderIntakeStage,
    renderSetupStage,
    renderSiteStage,
    renderAreasStage,
    renderWorkcentersStage,
    renderDemoStage,
    renderHandoffStage,
  ];
  stage.innerHTML = renderers[state.step]();
  attachStageHandlers();

  $("#backBtn").disabled = state.step === 0;
  $("#nextBtn").disabled = state.step === steps.length - 1 || !canEnterStep(state.step + 1);
}

function stageHeader(kicker, title, text, pill) {
  return `
    <div class="stage-title">
      <div>
        <p class="eyebrow">${escapeHtml(kicker)}</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(text)}</p>
      </div>
      <span class="stage-pill">${escapeHtml(pill)}</span>
    </div>
  `;
}

function renderIntakeStage() {
  const inputCards = intakeInputs
    .map(
      (input) => `
        <article class="object-card teal">
          <div class="object-row">
            <div class="object-main">
              <span class="object-meta">${escapeHtml(input.owner)}</span>
              <h3>${escapeHtml(input.name)}</h3>
              <p>${escapeHtml(input.detail)}</p>
            </div>
            <span class="status-pill">Imported</span>
          </div>
        </article>
      `
    )
    .join("");

  return `
    <div class="stage-view">
      ${stageHeader(
        "Phase: Intake",
        "Sales promises arrive as inputs, not workstreams.",
        "Commercial artifacts are imported once and seed project memory. The implementation system consumes the sales handoff; it does not manage the sales process, and it ends before managed services begin.",
        `${intakeInputs.length} inputs`
      )}
      <div class="object-list">${inputCards}</div>
    </div>
  `;
}

function renderHandoffStage() {
  const launch = deliverableJourney.find((stage) => stage.stage === "Launch");
  const decisions = Model.nodesOfType("decision");
  const trainingEvidence = training();
  return `
    <div class="stage-view">
      ${stageHeader(
        "Phase: Handoff",
        "The journey ends where support begins.",
        "Hypercare handoff exports the model state, decision history, and readiness evidence to the support organization. Managed services and ongoing support are outside this system's scope.",
        `${readinessScore()}% readiness`
      )}
      <div class="stage-grid">
        <article class="setup-card">
          <h3>Model state</h3>
          <p>${areas().length} areas, ${workcenters().length} ${profile().terms.Resource.toLowerCase()}s, and ${Model.events().length} committed change events form the exported baseline.</p>
        </article>
        <article class="setup-card">
          <h3>Decision history</h3>
          <p>${decisions.length ? `${decisions.length} governed merge decision${decisions.length === 1 ? "" : "s"} travel with the handoff as the model's audit trail.` : "No merged branches yet; the decision log exports empty."}</p>
        </article>
        <article class="setup-card">
          <h3>Training evidence</h3>
          <p>${trainingEvidence ? `Planner scored ${trainingEvidence.score} on the mock scheduling scenario; the same case seeds the support runbook.` : "No scored scenario yet. Complete the Demo step to attach training evidence to the handoff."}</p>
        </article>
        <article class="setup-card">
          <h3>Export</h3>
          <p>Use Export brief in the toolbar to produce the handoff package as JSON for the support organization.</p>
        </article>
      </div>
      <div class="deliverable-list">
        ${(launch?.artifacts || []).map(renderDeliverableCard).join("")}
      </div>
    </div>
  `;
}

function renderSetupStage() {
  return `
    <div class="stage-view">
      ${stageHeader(
        "Phase: Characterize",
        "Start with the implementation dialect, not a blank project plan.",
        "The selected ERP profile changes vocabulary, expected data gaps, test language, and training scenarios across the model.",
        profile().badge
      )}
      <div class="stage-grid">
        <article class="setup-card">
          <h3>APS template</h3>
          <p>Site, areas, ${profile().terms.Resource.toLowerCase()}s, calendars, routings or recipes, orders, constraints, scenarios, UAT, and hypercare are connected from the first screen.</p>
        </article>
        <article class="setup-card">
          <h3>AI project memory</h3>
          <p>Facts, assumptions, risks, doubts, and future-state constraints stay visible as the journey moves from blueprinting into delivery.</p>
        </article>
        <article class="setup-card">
          <h3>Semantic spine</h3>
          <p>${profile().terms.Order}s link to configuration, data quality, demo scenarios, training puzzles, tests, and enhancement candidates.</p>
        </article>
        <article class="setup-card">
          <h3>Implementation rhythm</h3>
          <p>Discovery, blueprint, sprints, UAT, training, go-live, hypercare, and R&D feedback use the same manufacturing objects.</p>
        </article>
        <article class="setup-card wide">
          <h3>Current narrative</h3>
          <p>${siteName()} starts with one APS pilot, a known packaging bottleneck, a partly clean master-data extract, and a migration-aware architecture decision.</p>
        </article>
      </div>
    </div>
  `;
}

function renderSiteStage() {
  return `
    <div class="stage-view">
      ${stageHeader(
        "Phase: Model",
        "Define the plant before modelling the schedule.",
        "The site becomes the root object for areas, workcenters, data ownership, tests, training, and hypercare signals.",
        state.planningMode
      )}
      <div class="stage-grid">
        <article class="setup-card">
          <label class="field">
            <span>Site Name</span>
            <input id="siteName" type="text" value="${escapeHtml(siteName())}" />
          </label>
          <label class="field">
            <span>Planning Mode</span>
            <select id="planningMode">
              <option value="Finite capacity pilot">Finite capacity pilot</option>
              <option value="Rough-cut capacity">Rough-cut capacity</option>
              <option value="Sequencing pilot">Sequencing pilot</option>
            </select>
          </label>
        </article>
        <article class="setup-card">
          <label class="field">
            <span>Known Constraint</span>
            <select id="constraint">
              <option value="Packaging Line 3">Packaging Line 3</option>
              <option value="Mixer A">Mixer A</option>
              <option value="QC Release Bench">QC Release Bench</option>
            </select>
          </label>
          <p>The constraint is linked to data checks, scheduling scenarios, and training readiness.</p>
        </article>
        <article class="object-card wide green">
          <div class="object-row">
            <div class="object-main">
              <span class="object-meta">Semantic root</span>
              <h3>${escapeHtml(siteName())}</h3>
              <p>${areas().length} areas, ${workcenters().length} ${profile().terms.Resource.toLowerCase()}s, ${deliverableJourney.flatMap((stage) => stage.artifacts).length} delivery artifacts, and 2 training objects linked.</p>
            </div>
            <span class="status-pill">Traceable</span>
          </div>
        </article>
      </div>
    </div>
  `;
}

function renderAreasStage() {
  const areaCards = areas()
    .map((area) => {
      const assigned = workcenters().filter((wc) => wc.areaId === area.id).length;
      const renameButton =
        area.id === "packaging" && !packagingRenamed()
          ? `<button class="mini-action" type="button" data-rename-packaging><i data-lucide="pencil"></i><span>Rename</span></button>`
          : "";
      return `
        <article class="object-card ${escapeHtml(area.color)}">
          <div class="object-row">
            <div class="object-main">
              <span class="object-meta">Department</span>
              <h3>${escapeHtml(area.name)}</h3>
              <p>${assigned} ${profile().terms.Resource.toLowerCase()}${assigned === 1 ? "" : "s"} assigned.</p>
            </div>
            <div class="object-actions">${renameButton}</div>
          </div>
        </article>
      `;
    })
    .join("");

  const affected = workcenters().filter((wc) => wc.areaId === "packaging").length;

  return `
    <div class="stage-view">
      ${stageHeader(
        "Phase: Model",
        "Shape the operating areas and keep downstream impact visible.",
        "Changing an area does not silently break the model; it creates reconciliation work linked to workcenters, UAT, training, and data ownership.",
        `${areas().length} areas`
      )}
      ${packagingRenamed() ? impactBanner(`${affected} packaging workcenters were marked for reconciliation after the department rename.`) : ""}
      <div class="object-list">${areaCards}</div>
      <form class="area-form" id="areaForm">
        <input id="newAreaName" type="text" placeholder="Add area or department" aria-label="Add area or department" />
        <button class="secondary-button" type="submit">
          <i data-lucide="plus"></i>
          <span>Add</span>
        </button>
      </form>
    </div>
  `;
}

function renderWorkcentersStage() {
  const needsReconcile = workcenters().filter((wc) => wc.needsReconcile);
  const cards = workcenters()
    .map((wc) => {
      const areaOptions = areas()
        .map(
          (area) =>
            `<option value="${escapeHtml(area.id)}" ${area.id === wc.areaId ? "selected" : ""}>${escapeHtml(area.name)}</option>`
        )
        .join("");
      const statusClass = wc.status === "Data issue" ? "coral" : wc.needsReconcile ? "amber" : "green";
      const status = wc.needsReconcile ? "Needs reconciliation" : wc.status;
      return `
        <article class="object-card ${statusClass}">
          <div class="object-row">
            <div class="object-main">
              <span class="object-meta">${escapeHtml(profile().terms.Resource)}</span>
              <h3>${escapeHtml(wc.name)}</h3>
              <p>${escapeHtml(wc.capacity)}. Current area: ${escapeHtml(areaName(wc.areaId))}.</p>
            </div>
            <span class="status-pill">${escapeHtml(status)}</span>
          </div>
          <label class="field assignment-row">
            <span>Assign Area</span>
            <select data-workcenter-area="${escapeHtml(wc.id)}">${areaOptions}</select>
          </label>
        </article>
      `;
    })
    .join("");

  return `
    <div class="stage-view">
      ${stageHeader(
        "Phase: Model",
        `Reconcile ${profile().terms.Resource.toLowerCase()}s after upstream changes.`,
        "The model shows what changed, what is still valid, and which downstream artifacts need a human decision.",
        needsReconcile.length ? `${needsReconcile.length} open` : "Clear"
      )}
      ${needsReconcile.length ? impactBanner(`${needsReconcile.length} ${profile().terms.Resource.toLowerCase()}s still need area confirmation.`) : ""}
      <div class="workcenter-grid">${cards}</div>
    </div>
  `;
}

function renderDemoStage() {
  const result = training()
    ? `
      <div class="training-result">
        <strong>${escapeHtml(training().score)} training score</strong>
        <p>${escapeHtml(training().note)}</p>
      </div>
    `
    : `
      <div class="training-result">
        <strong>Awaiting attempt</strong>
        <p>Rush ${profile().terms.Order.toLowerCase()} 104 needs a resource decision before training readiness can be scored.</p>
      </div>
    `;

  return `
    <div class="stage-view">
      ${stageHeader(
        "Phase: Validate",
        "Turn configuration into a tangible mock scheduling exercise.",
        "The demo uses configured workcenters, known data issues, and ERP terminology so users see a real scenario before perfect customer data exists.",
        "Mock data"
      )}
      <div class="scenario-layout">
        <section class="scenario-card">
          <h3>Order bank</h3>
          <div class="order-bank">
            ${renderOrderTile("rush-104", `Rush ${profile().terms.Order} 104`, "Due today, packaging operation, allergen cleaning required")}
            ${renderOrderTile("std-218", `${profile().terms.Order} 218`, "Due Friday, standard packaging run")}
          </div>
          <div class="resource-lanes" id="resourceLanes">
            ${renderLane("wc-pack-3", "Packaging Line 3", "Preferred line, but calendar data is incomplete.")}
            ${renderLane("wc-pack-2", "Packaging Line 2", "Alternate line with available capacity.")}
            ${renderLane("wc-qc-1", "QC Release Bench", "Wrong capability for packaging operations.")}
          </div>
        </section>
        ${result}
      </div>
    </div>
  `;
}

function renderReadinessStage() {
  const artifacts = deliverableJourney.flatMap((stage) => stage.artifacts);
  const activeCount = artifacts.filter((artifact) => /active|draft|review|prioritized|profiling|scoped|ready/i.test(artifact.status)).length;
  const gatedCount = artifacts.filter((artifact) => /gated|open|needs/i.test(artifact.status)).length;
  return `
    <div class="stage-view">
      ${stageHeader(
        "Delivery Cockpit",
        "The document journey is part of the implementation system.",
        "Kick-off, blueprint, stories, CRs, UAT, E2E, GPT, RACI, cutover, training, and hypercare artifacts stay tied to manufacturing objects and decisions. Sales artifacts live at Intake as imported inputs.",
        `${artifacts.length} artifacts`
      )}
      <div class="delivery-metrics">
        <article>
          <span>Artifact Library</span>
          <strong>${artifacts.length}</strong>
          <small>core deliverables tracked</small>
        </article>
        <article>
          <span>Active / Draft</span>
          <strong>${activeCount}</strong>
          <small>moving through workshops</small>
        </article>
        <article>
          <span>Gated / Open</span>
          <strong>${gatedCount}</strong>
          <small>needs decision or evidence</small>
        </article>
        <article>
          <span>Traceability</span>
          <strong>${readinessScore()}%</strong>
          <small>linked to model readiness</small>
        </article>
      </div>

      <section class="deliverable-timeline" aria-label="Document and deliverables journey">
        ${deliverableJourney.map(renderDeliverableStage).join("")}
      </section>

      <div class="stage-grid">
        <article class="readiness-card">
          <h3>Validation readiness</h3>
          <div class="readiness-list">
            ${readinessRow("Blueprint signoff", 58)}
            ${readinessRow("Story coverage", 64)}
            ${readinessRow("UAT scripts", training() ? 68 : 42)}
            ${readinessRow("E2E coverage", 36)}
            ${readinessRow("Cutover readiness", 28)}
          </div>
        </article>
        <article class="readiness-card">
          <h3>Traceability thread</h3>
          <p>One customer promise should travel from the intake imports into blueprint scope, user stories, CRs, UAT evidence, E2E scripts, GPT readiness, training, cutover, and hypercare without becoming detached from the site, recipe, resource, and planning constraint model.</p>
        </article>
      </div>

      <div class="pipeline-board">
        <section class="pipeline-column">
          <h3>Intake</h3>
          <div class="pipeline-item">Imported sales inputs (SOW, SOS, transition notes) define scope, constraints, responsibilities, and acceptance terms.</div>
        </section>
        <section class="pipeline-column">
          <h3>Design</h3>
          <div class="pipeline-item">Kick-off, blueprint, RACI, fit-gap, and Integration Map turn scope into accountable decisions.</div>
        </section>
        <section class="pipeline-column">
          <h3>Build</h3>
          <div class="pipeline-item">User stories, configuration backlog, CRs, decision log, and RAID log translate decisions into controlled sprint work.</div>
        </section>
        <section class="pipeline-column">
          <h3>Prove</h3>
          <div class="pipeline-item">UAT, E2E, GPT, training, cutover, support handoff, and hypercare convert implementation work into launch evidence.</div>
        </section>
      </div>
    </div>
  `;
}

function deliverableStatusClass(status) {
  if (/gated|needs|open/i.test(status)) return "blocked";
  if (/review|profiling|active|prioritized/i.test(status)) return "active";
  if (/ready|drafted|scoped|outline|linked/i.test(status)) return "ready";
  return "draft";
}

function renderDeliverableStage(stage, index) {
  return `
    <section class="deliverable-stage">
      <header>
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div>
          <h3>${escapeHtml(stage.stage)}</h3>
          <p>${escapeHtml(stage.goal)}</p>
        </div>
      </header>
      <div class="deliverable-list">
        ${stage.artifacts.map(renderDeliverableCard).join("")}
      </div>
    </section>
  `;
}

function renderDeliverableCard(artifact) {
  const statusClass = deliverableStatusClass(artifact.status);
  const gated = /UAT|E2E|Cutover|Go-Live/i.test(artifact.name) && !training();
  const effectiveStatus = gated && artifact.name === "UAT Scripts" ? "Needs scored scenario" : artifact.status;
  return `
    <article class="deliverable-card ${statusClass}">
      <div>
        <strong>${escapeHtml(artifact.name)}</strong>
        <span>${escapeHtml(effectiveStatus)}</span>
      </div>
      <p>${escapeHtml(artifact.evidence)}</p>
      <small>${escapeHtml(artifact.owner)}</small>
    </article>
  `;
}

function readinessRow(label, value) {
  return `
    <div class="readiness-row">
      <strong>${escapeHtml(label)}</strong>
      <div class="progress-track"><div class="progress-fill" style="width: ${value}%"></div></div>
      <span>${value}%</span>
    </div>
  `;
}

function renderOrderTile(id, title, detail) {
  if (assignedOrder()?.id === id) return "";
  return `
    <div class="order-tile" draggable="true" data-order-id="${escapeHtml(id)}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function renderLane(id, title, detail) {
  const assigned =
    assignedOrder()?.laneId === id
      ? `<div class="order-tile"><strong>${escapeHtml(assignedOrder().title)}</strong><span>Scheduled for review</span></div>`
      : "";
  return `
    <div class="lane" data-lane-id="${escapeHtml(id)}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(detail)}</p>
      <button class="mini-action" type="button" data-schedule-lane="${escapeHtml(id)}">
        <i data-lucide="corner-down-right"></i>
        <span>Schedule</span>
      </button>
      ${assigned}
    </div>
  `;
}

function impactBanner(text) {
  return `
    <div class="impact-banner">
      <i data-lucide="triangle-alert"></i>
      <span>${escapeHtml(text)}</span>
    </div>
  `;
}

function renderDecisionLog() {
  const decisions = Model.nodesOfType("decision");
  if (!decisions.length) return `<p class="branch-hint">No merges yet. Merged branches land here as governed decisions.</p>`;
  return decisions
    .map(
      (decision) => `
        <div class="signal">
          <span>Decision</span>
          <p><strong>${escapeHtml(decision.props.branch)}</strong> — ${escapeHtml(decision.props.rationale)} Approved by ${escapeHtml(decision.props.approver)}.</p>
        </div>
      `
    )
    .reverse()
    .join("");
}

function renderBranchPanel() {
  const panel = $("#branchPanel");
  if (!panel) return;
  const activeBranch = Model.branch();
  const badge = $("#branchBadge");
  if (badge) {
    badge.textContent = activeBranch;
    badge.classList.toggle("on-branch", activeBranch !== "main");
  }

  if (activeBranch === "main") {
    const others = Model.branchNames().filter((name) => name !== "main");
    panel.innerHTML = `
      <h3>Model Branches</h3>
      <p class="branch-hint">Fork the model to explore a change without touching the baseline. Anything you edit in the app is committed to the active branch.</p>
      <div class="area-form" id="branchForm">
        <input id="branchNameInput" type="text" placeholder="e.g. split-packaging" aria-label="New branch name" />
        <button class="secondary-button" type="button" id="branchCreateBtn"><i data-lucide="git-branch"></i><span>Branch</span></button>
      </div>
      ${others
        .map(
          (name) => `
            <div class="signal">
              <span>Branch</span>
              <p><strong>${escapeHtml(name)}</strong></p>
              <button class="mini-action" type="button" data-checkout="${escapeHtml(name)}"><i data-lucide="log-in"></i><span>Open</span></button>
              <button class="mini-action" type="button" data-discard="${escapeHtml(name)}"><i data-lucide="trash-2"></i><span>Discard</span></button>
            </div>
          `
        )
        .join("")}
      <h3>Decision Log</h3>
      ${renderDecisionLog()}
    `;
  } else {
    const { entries, conflicts } = Model.diff(activeBranch);
    const downstream = Model.downstreamOf(entries.map((entry) => entry.id));
    const mainScore = Model.withBranch("main", readinessScore);
    const delta = readinessScore() - mainScore;
    const deltaText = delta === 0 ? "no readiness change" : `${delta > 0 ? "+" : ""}${delta}% readiness vs main`;
    panel.innerHTML = `
      <h3>Branch: ${escapeHtml(activeBranch)}</h3>
      <p class="branch-hint">${entries.length} change${entries.length === 1 ? "" : "s"} vs fork point · ${deltaText}.</p>
      ${conflicts.length ? impactBanner(`${conflicts.length} node(s) also changed on main since the fork — merging needs a human decision.`) : ""}
      ${
        entries.length
          ? entries
              .map(
                (entry) => `
                  <div class="signal">
                    <span>${escapeHtml(entry.kind)}</span>
                    <p><strong>${escapeHtml(entry.name)}</strong> (${escapeHtml(entry.type)})${entry.fields ? ` — ${entry.fields.map(escapeHtml).join(", ")}` : ""}</p>
                  </div>
                `
              )
              .join("")
          : `<p class="branch-hint">No changes yet. Edit the model on the Journey screen, then come back to review the diff.</p>`
      }
      ${
        downstream.length
          ? `<div class="signal"><span>Impact</span><p>Touches downstream: ${downstream.map((node) => escapeHtml(node.props.name || node.id)).join(", ")}.</p></div>`
          : ""
      }
      <div class="area-form" id="mergeForm">
        <input id="mergeApprover" type="text" placeholder="Approver" aria-label="Approver" />
        <input id="mergeRationale" type="text" placeholder="Rationale" aria-label="Rationale" />
        <button class="secondary-button" type="button" id="mergeBtn" ${entries.length ? "" : "disabled"}><i data-lucide="git-merge"></i><span>Merge</span></button>
      </div>
      <button class="mini-action" type="button" data-checkout="main"><i data-lucide="undo-2"></i><span>Back to main</span></button>
      <button class="mini-action" type="button" data-discard="${escapeHtml(activeBranch)}"><i data-lucide="trash-2"></i><span>Discard branch</span></button>
    `;
  }

  panel.querySelector("#branchCreateBtn")?.addEventListener("click", () => {
    const name = panel.querySelector("#branchNameInput").value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!name) return;
    if (!Model.createBranch(name)) return;
    state.gateMessage = `Branch "${name}" is active. Model edits are isolated until merged.`;
    renderAll();
  });

  panel.querySelector("#mergeBtn")?.addEventListener("click", () => {
    const approver = panel.querySelector("#mergeApprover").value.trim();
    const rationale = panel.querySelector("#mergeRationale").value.trim();
    if (!approver || !rationale) return;
    Model.merge(activeBranch, { approver, rationale });
    state.gateMessage = `Branch "${activeBranch}" merged into main as a governed decision.`;
    renderAll();
  });

  panel.querySelectorAll("[data-checkout]").forEach((button) => {
    button.addEventListener("click", () => {
      Model.checkout(button.dataset.checkout);
      renderAll();
    });
  });

  panel.querySelectorAll("[data-discard]").forEach((button) => {
    button.addEventListener("click", () => {
      Model.discardBranch(button.dataset.discard);
      state.gateMessage = "Branch discarded. The baseline model is unchanged.";
      renderAll();
    });
  });
}

function renderIntelligence() {
  $("#riskBadge").textContent = `${riskCount()} risks`;
  const impactItems = [
    ...impacts().slice(0, 3),
    state.futureMigration ? "S/4 migration context influences data model and integration choices." : null,
  ].filter(Boolean);

  $("#impactList").innerHTML = impactItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  $("#meetingItems").innerHTML = `
    <div class="signal">
      <span>Dubious</span>
      <p>Customer says calendars are complete, but Packaging Line 3 has no valid shift calendar in the sample extract.</p>
    </div>
    <div class="signal">
      <span>Risk</span>
      <p>${state.futureMigration ? "JDE-to-S/4 migration may invalidate one-off interface logic." : "ERP assumptions need confirmation before integration design."}</p>
    </div>
    <div class="signal">
      <span>Task</span>
      <p>Planning owner to confirm alternate resource rules for rush ${profile().terms.Order.toLowerCase()}s.</p>
    </div>
  `;
}

function dataStatusCounts() {
  return [...dataObjectGroups, ...mesObjectGroups]
    .flatMap((group) => group.objects)
    .reduce((counts, object) => {
      counts[object.status] = (counts[object.status] || 0) + 1;
      return counts;
    }, {});
}

function objectStatusLabel(object) {
  if (object.id === "dept-object" && packagingRenamed()) return "Changed";
  if (object.id === "workcenter-object" && hasOpenReconciliation()) return "Reconcile";
  if (object.id === "calendar-object" && hasOpenReconciliation()) return "Blocked";
  if (object.id === "confirm-object" && training()) return "Ready";
  return object.status;
}

function objectDetail(object) {
  if (object.id === "site-object") return `${siteName()} as the semantic root.`;
  if (object.id === "dept-object" && packagingRenamed()) return "Packaging was renamed; downstream assignments were marked for confirmation.";
  if (object.id === "workcenter-object") return `${workcenters().length} ${profile().terms.Resource.toLowerCase()}s mapped to departments and training scenarios.`;
  if (object.id === "calendar-object" && hasOpenReconciliation()) return "Packaging Line 3 calendar remains a scheduling blocker.";
  if (object.id === "confirm-object" && training()) return "Training evidence can now become mock confirmations and UAT actuals.";
  return object.detail;
}

function renderDataObjectCard(object) {
  const status = objectStatusLabel(object);
  const classes = ["data-object-card", object.tone, status.toLowerCase().replace(/[^a-z0-9]+/g, "-")];
  return `
    <article class="${classes.join(" ")}">
      <div class="data-object-icon"><i data-lucide="${escapeHtml(object.icon)}"></i></div>
      <div>
        <div class="object-card-head">
          <h3>${escapeHtml(object.name)}</h3>
          <span>${escapeHtml(status)}</span>
        </div>
        <p>${escapeHtml(objectDetail(object))}</p>
      </div>
    </article>
  `;
}

function renderArchetypeCard(archetype) {
  const active = archetype.id === state.archetype ? " active" : "";
  return `
    <article class="archetype-card ${escapeHtml(archetype.tone)}${active}" data-archetype-card="${escapeHtml(archetype.id)}">
      <header>
        <span>${active ? "Selected" : "Archetype"}</span>
        <h3>${escapeHtml(archetype.name)}</h3>
      </header>
      <p>${escapeHtml(archetype.core)}</p>
      <div class="archetype-meta">
        <strong>Common in</strong>
        <span>${escapeHtml(archetype.examples)}</span>
      </div>
      <div class="constraint-cloud">
        ${archetype.constraints.map((constraint) => `<span>${escapeHtml(constraint)}</span>`).join("")}
      </div>
      <footer>${escapeHtml(archetype.model)}</footer>
    </article>
  `;
}

function renderArchetypesScreen() {
  const stage = $("#archetypesStage");
  if (!stage) return;
  const active = selectedArchetype();
  stage.innerHTML = `
    <section class="archetype-hero">
      <div>
        <p class="eyebrow">Planning Archetypes</p>
        <h2>Industries are mixtures. Planning logic starts with archetypes.</h2>
        <p>The APS template should steer data modelling, workshop questions, mock data, training scenarios, and risk checks from the planning archetype, not from a broad industry label.</p>
      </div>
      <article class="selected-archetype ${escapeHtml(active.tone)}">
        <span>Current Archetype</span>
        <strong>${escapeHtml(active.name)}</strong>
        <small>${escapeHtml(active.model)}</small>
      </article>
    </section>

    <section class="archetype-focus">
      <div>
        <p class="eyebrow">Model Bias</p>
        <h3>${escapeHtml(active.core)}</h3>
        <p>${escapeHtml(active.examples)}</p>
      </div>
      <div class="constraint-cloud large">
        ${active.constraints.map((constraint) => `<span>${escapeHtml(constraint)}</span>`).join("")}
      </div>
    </section>

    <section class="archetype-grid">
      ${planningArchetypes.map(renderArchetypeCard).join("")}
    </section>
  `;

  stage.querySelectorAll("[data-archetype-card]").forEach((card) => {
    card.addEventListener("click", () => {
      state.archetype = card.dataset.archetypeCard;
      Model.note(`Planning archetype changed to ${selectedArchetype().name}.`);
      renderAll();
    });
  });
}

function renderDataScreen() {
  const dataStage = $("#dataModelStage");
  if (!dataStage) return;
  const counts = dataStatusCounts();
  const apsTotal = dataObjectGroups.flatMap((group) => group.objects).length;
  const mesTotal = mesObjectGroups.flatMap((group) => group.objects).length;
  const objectTotal = apsTotal + mesTotal;
  dataStage.innerHTML = `
    <section class="data-hero">
      <div>
        <p class="eyebrow">Implementation Data Model</p>
        <h2>APS planning objects and MES execution objects share one implementation spine.</h2>
        <p>Current planning archetype: ${escapeHtml(selectedArchetype().name)}. Selected routing: ${escapeHtml(selectedRouting().id)}. APS objects drive finite planning; MES objects carry execution, EBR, genealogy, quality, and compliance evidence.</p>
      </div>
      <div class="data-scoreboard" aria-label="Data object summary">
        <article><span>Total Objects</span><strong>${objectTotal}</strong></article>
        <article><span>APS Objects</span><strong>${apsTotal}</strong></article>
        <article><span>MES Objects</span><strong>${mesTotal}</strong></article>
        <article><span>Profiled</span><strong>${(counts.Profiled || 0) + (counts.Configured || 0)}</strong></article>
        <article><span>Future</span><strong>${counts.Future || 0}</strong></article>
      </div>
    </section>

    <section class="object-flow" aria-label="Data object dependency flow">
      <span>Site</span>
      <i data-lucide="arrow-right"></i>
      <span>Departments</span>
      <i data-lucide="arrow-right"></i>
      <span>Workcenters</span>
      <i data-lucide="arrow-right"></i>
      <span>Calendars</span>
      <i data-lucide="arrow-right"></i>
      <span>Routings / Recipes</span>
      <i data-lucide="arrow-right"></i>
      <span>Orders + Execution</span>
    </section>

    <section class="data-domain-panel">
      <div>
        <p class="eyebrow">APS Library</p>
        <h3>Planning objects for finite-capacity scheduling.</h3>
      </div>
      <span>${apsTotal} objects</span>
    </section>

    <div class="data-object-grid">
      ${dataObjectGroups
        .map(
          (group) => `
            <section class="data-group">
              <header>
                <h3>${escapeHtml(group.title)}</h3>
                <p>${escapeHtml(group.summary)}</p>
              </header>
              <div class="data-object-list">
                ${group.objects.map(renderDataObjectCard).join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>

    <section class="data-domain-panel mes">
      <div>
        <p class="eyebrow">MES Library</p>
        <h3>Execution, EBR, genealogy, quality, and compliance objects.</h3>
      </div>
      <span>${mesTotal} objects</span>
    </section>

    <div class="data-object-grid mes-grid">
      ${mesObjectGroups
        .map(
          (group) => `
            <section class="data-group mes-group">
              <header>
                <h3>${escapeHtml(group.title)}</h3>
                <p>${escapeHtml(group.summary)}</p>
              </header>
              <div class="data-object-list">
                ${group.objects.map(renderDataObjectCard).join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

function parseFirstNumber(value) {
  const match = String(value || "").replace(/,/g, "").match(/[\d.]+/);
  return match ? Number.parseFloat(match[0]) : 0;
}

function formatHours(value) {
  if (!value) return "-";
  if (value < 0.1) return "0.1h";
  return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
}

function operationClass(name, workCenter) {
  const value = `${name} ${workCenter}`.toLowerCase();
  if (value.includes("qa") || value.includes("qc") || value.includes("sampling") || value.includes("testing") || value.includes("release")) return "quality";
  if (value.includes("pack") || value.includes("label") || value.includes("carton") || value.includes("serial") || value.includes("line clearance")) return "packaging";
  if (value.includes("stage") || value.includes("hold")) return "logistics";
  if (value.includes("sterile") || value.includes("aseptic")) return "sterile";
  return "process";
}

function inferPiPhaseTimes(routing, operation) {
  const [, name, workCenter, setup, rate, queue] = operation;
  const setupHours = parseFirstNumber(setup);
  const queueHours = parseFirstNumber(queue);
  const classification = operationClass(name, workCenter);
  const isHold = classification === "logistics" || String(rate).trim() === "-";
  const isCleaningSensitive = /granulat|blend|mix|mill|compress|coat|fill|filter|tank|aseptic|sterile|blister/i.test(`${name} ${workCenter}`);
  const disassemblyHours = isCleaningSensitive ? Math.max(0.2, Math.min(1.0, setupHours * 0.5)) : 0;
  const teardownHours = isHold ? 0 : Math.max(0.1, Math.min(0.8, setupHours * 0.45));
  const cleanupHours = isCleaningSensitive ? (routing.cleaning.toLowerCase().includes("major") ? 1.5 : 0.8) : 0;
  const laborHours = classification === "quality" ? Math.max(0.3, setupHours + Math.min(queueHours, 2) * 0.12) : Math.max(0.2, setupHours * 0.7);
  const machineLabel = String(rate).trim() === "-" ? "Manual / hold" : `${rate} x order qty`;

  return [
    { key: "setup", value: setup || "-", tone: "fixed" },
    { key: "machine", value: machineLabel, tone: String(rate).trim() === "-" ? "hold" : "variable" },
    { key: "labor", value: formatHours(laborHours), tone: "labor" },
    { key: "teardown", value: formatHours(teardownHours), tone: "fixed" },
    { key: "disassembly", value: formatHours(disassemblyHours), tone: disassemblyHours ? "clean" : "hold" },
    { key: "cleanup", value: formatHours(cleanupHours), tone: cleanupHours ? "clean" : "hold" },
  ];
}

function renderPiPhaseChips(routing, operation) {
  const phases = inferPiPhaseTimes(routing, operation);
  return `
    <div class="phase-chip-grid">
      ${phases
        .map((phase) => {
          const definition = activePack().phases.find((item) => item.key === phase.key);
          return `
            <span class="phase-chip ${phase.tone}" title="${escapeHtml(definition.description)}">
              <small>${escapeHtml(definition.label)}</small>
              <strong>${escapeHtml(phase.value)}</strong>
            </span>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderPiPhaseLegend() {
  return `
    <div class="phase-legend">
      ${activePack().phases
        .map(
          (phase) => `
            <article title="${escapeHtml(phase.description)}">
              <strong>${escapeHtml(phase.label)}</strong>
              <span>${escapeHtml(phase.description)}</span>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderOperationRows(routing) {
  return routing.operations
    .map(
      ([seq, op, wc, setup, rate, queue, yieldPct, notes]) => `
        <tr>
          <td>${escapeHtml(seq)}</td>
          <td>${escapeHtml(op)}</td>
          <td>${escapeHtml(wc)}</td>
          <td>${renderPiPhaseChips(routing, [seq, op, wc, setup, rate, queue, yieldPct, notes])}</td>
          <td>${escapeHtml(queue)}</td>
          <td>${escapeHtml(yieldPct)}</td>
          <td>${escapeHtml(notes)}</td>
        </tr>
      `
    )
    .join("");
}

function renderRoutingScreen() {
  const stage = $("#routingStage");
  if (!stage) return;
  const routing = selectedRouting();
  const totalQueue = routing.operations.reduce((sum, op) => sum + parseFirstNumber(op[5]), 0);
  const phaseTotals = routing.operations.reduce(
    (totals, op) => {
      inferPiPhaseTimes(routing, op).forEach((phase) => {
        if (phase.key !== "machine") totals[phase.key] += parseFirstNumber(phase.value);
      });
      return totals;
    },
    { setup: 0, labor: 0, teardown: 0, disassembly: 0, cleanup: 0 }
  );
  const workCenters = [...new Set(routing.operations.map((op) => op[2]))];
  stage.innerHTML = `
    <section class="routing-hero">
      <div>
        <p class="eyebrow">${escapeHtml(activePack().copy.eyebrow)}</p>
        <h2>${escapeHtml(activePack().copy.title)}</h2>
        <p>${escapeHtml(activePack().copy.text)}</p>
      </div>
      <label class="routing-picker">
        <span>${escapeHtml(activePack().copy.pickerLabel)}</span>
        <select id="routingProfile">
          ${activePack().routings.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} - ${escapeHtml(item.type)}</option>`).join("")}
        </select>
      </label>
    </section>

    <section class="routing-master">
      <article><span>Product Family</span><strong>${escapeHtml(routing.family)}</strong></article>
      <article><span>Product Type</span><strong>${escapeHtml(routing.type)}</strong></article>
      <article><span>Batch Size</span><strong>${escapeHtml(routing.batchSize)}</strong></article>
      <article><span>GMP Criticality</span><strong>${escapeHtml(routing.gmp)}</strong></article>
      <article><span>Campaign Allowed</span><strong>${escapeHtml(routing.campaign)}</strong></article>
      <article><span>QA Release</span><strong>${escapeHtml(routing.qaRelease)}</strong></article>
      <article><span>Resources</span><strong>${workCenters.length}</strong></article>
      <article><span>Queue Hours</span><strong>${totalQueue.toFixed(1)}</strong></article>
      <article><span>Fixed Phase Hours</span><strong>${formatHours(phaseTotals.setup + phaseTotals.teardown)}</strong></article>
      <article><span>Cleaning Phase Hours</span><strong>${formatHours(phaseTotals.disassembly + phaseTotals.cleanup)}</strong></article>
    </section>

    <section class="routing-layout">
      <div class="routing-main">
        <section class="routing-panel">
          <header>
            <div>
              <p class="eyebrow">Phase Dictionary</p>
              <h3>Hover a phase for its planning meaning.</h3>
            </div>
          </header>
          ${renderPiPhaseLegend()}
        </section>

        <section class="routing-panel">
          <header>
            <div>
              <p class="eyebrow">Operation Sequence</p>
              <h3>${escapeHtml(routing.id)} · ${escapeHtml(routing.type)}</h3>
            </div>
            <span>${routing.operations.length} operations</span>
          </header>
          <div class="table-wrap">
            <table class="routing-table">
              <thead>
                <tr>
                  <th>Seq</th>
                  <th>Operation</th>
                  <th>Resource</th>
                  <th>Phases</th>
                  <th>Queue</th>
                  <th>Yield</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>${renderOperationRows(routing)}</tbody>
            </table>
          </div>
        </section>

        <section class="routing-panel">
          <header>
            <div>
              <p class="eyebrow">APS / SAP Load Format</p>
              <h3>Operation rows explode into phase rows for import, validation, and simulation.</h3>
            </div>
          </header>
          <div class="load-preview">
            ${routing.operations.slice(0, 3).flatMap((op, index) =>
              inferPiPhaseTimes(routing, op).map((phase, phaseIndex) => {
                const definition = activePack().phases.find((item) => item.key === phase.key);
                return `<code>${escapeHtml(routing.id)}, OP-${String(index + 1).padStart(3, "0")}, PH-${String(phaseIndex + 1).padStart(2, "0")}, ${escapeHtml(op[2])}, ${escapeHtml(definition.label)}, ${escapeHtml(phase.value)}, ${escapeHtml(phase.tone)}, ${escapeHtml(routing.cleaning)}</code>`;
              })
            ).join("")}
          </div>
        </section>
      </div>

      <aside class="routing-side">
        <section class="routing-panel">
          <header>
            <div>
              <p class="eyebrow">Cleaning Routing</p>
              <h3>${escapeHtml(routing.cleaning)}</h3>
            </div>
          </header>
          <div class="cleaning-list">
            ${activePack().cleaningRoutings.map((clean) => `
              <article>
                <strong>${escapeHtml(clean.id)}</strong>
                <span>${escapeHtml(clean.name)}</span>
                <small>${escapeHtml(clean.duration)} · ${escapeHtml(clean.steps)}</small>
              </article>
            `).join("")}
          </div>
        </section>

        <section class="routing-panel">
          <header>
            <div>
              <p class="eyebrow">Routing Selection Rules</p>
              <h3>Product attributes drive route composition.</h3>
            </div>
          </header>
          <div class="rule-list">
            ${activePack().routingRules.map(([condition, rule]) => `
              <div><span>${escapeHtml(condition)}</span><strong>${escapeHtml(rule)}</strong></div>
            `).join("")}
          </div>
        </section>

        <section class="routing-panel">
          <header>
            <div>
              <p class="eyebrow">Scheduling Constraints</p>
              <h3>Hard and soft gates.</h3>
            </div>
          </header>
          <div class="rule-list">
            ${activePack().schedulingConstraints.map(([constraint, rule]) => `
              <div><span>${escapeHtml(constraint)}</span><strong>${escapeHtml(rule)}</strong></div>
            `).join("")}
          </div>
        </section>
      </aside>
    </section>
  `;

  const picker = $("#routingProfile");
  if (picker) {
    picker.value = selectedRouting().id;
    picker.addEventListener("change", (event) => {
      state.selectedRouting = event.target.value;
      Model.note(`Routing changed to ${selectedRouting().id} (${selectedRouting().type}).`);
      renderAll();
    });
  }
}

function renderDeliveryScreen() {
  const deliveryStage = $("#deliveryStage");
  if (!deliveryStage) return;
  deliveryStage.innerHTML = `
    <div class="delivery-hero">
      <div>
        <p class="eyebrow">Delivery Cockpit</p>
        <h2>Implementation artifacts stay tied to the manufacturing model.</h2>
        <p>Use this screen when the team moves from modelling into sprint delivery, UAT, training, go-live, hypercare, and product enhancement feedback.</p>
      </div>
      <div class="delivery-score">
        <span>Readiness</span>
        <strong>${readinessScore()}%</strong>
      </div>
    </div>
    ${renderReadinessStage()}
  `;
}

function attachStageHandlers() {
  $("#siteName")?.addEventListener("input", (event) => {
    Model.update("site", { name: event.target.value || "Unnamed Site" });
    renderSnapshot();
  });

  $("#planningMode")?.addEventListener("change", (event) => {
    state.planningMode = event.target.value;
    renderAll();
  });
  if ($("#planningMode")) $("#planningMode").value = state.planningMode;

  $("#constraint")?.addEventListener("change", (event) => {
    state.constraint = event.target.value;
    Model.note(`${state.constraint} is now the primary constraint for demo and UAT planning.`);
    renderAll();
  });
  if ($("#constraint")) $("#constraint").value = state.constraint;

  $("[data-rename-packaging]")?.addEventListener("click", () => {
    renamePackaging();
  });

  $("#areaForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = $("#newAreaName");
    const name = input.value.trim();
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `area-${Date.now()}`;
    const color = ["teal", "coral", "amber", "violet", "green"][areas().length % 5];
    Model.add({ id, type: "area", props: { name, color } }, `${name} was added to the semantic site model.`);
    renderAll();
  });

  document.querySelectorAll("[data-workcenter-area]").forEach((select) => {
    select.addEventListener("change", () => {
      const workcenter = workcenters().find((wc) => wc.id === select.dataset.workcenterArea);
      if (!workcenter) return;
      const label = workcenter.needsReconcile ? `${workcenter.name} area assignment was reconciled.` : null;
      Model.update(workcenter.id, { areaId: select.value, needsReconcile: false }, label);
      if (!hasOpenReconciliation()) {
        unlockThrough(5);
        state.gateMessage = "Demo node unlocked. The model is stable enough for a mock scheduling scenario.";
      }
      renderAll();
    });
  });

  document.querySelectorAll(".order-tile[draggable='true']").forEach((tile) => {
    tile.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", tile.dataset.orderId);
    });
  });

  document.querySelectorAll(".lane").forEach((lane) => {
    lane.addEventListener("dragover", (event) => {
      event.preventDefault();
      lane.classList.add("drag-over");
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-over"));
    lane.addEventListener("drop", (event) => {
      event.preventDefault();
      lane.classList.remove("drag-over");
      const orderId = event.dataTransfer.getData("text/plain");
      scoreTraining(orderId, lane.dataset.laneId);
    });
  });

  document.querySelectorAll("[data-schedule-lane]").forEach((button) => {
    button.addEventListener("click", () => {
      scoreTraining("rush-104", button.dataset.scheduleLane);
    });
  });
}

function renamePackaging() {
  if (!Model.node("packaging")) return;
  // One commit: the rename and its downstream reconciliation flags are
  // a single atomic change to the model.
  Model.commit({
    label: "Packaging was renamed to Finished Goods; downstream assignments require confirmation.",
    ops: [
      { op: "update", id: "packaging", props: { name: "Finished Goods", renamed: true } },
      ...workcenters()
        .filter((wc) => wc.areaId === "packaging")
        .map((wc) => ({ op: "update", id: wc.id, props: { needsReconcile: true } })),
    ],
  });
  state.step = 4;
  unlockThrough(4);
  state.gateMessage = "Demo is gated until affected work centers are reconciled.";
  renderAll();
}

function scoreTraining(orderId, laneId) {
  const orderTitle = orderId === "std-218" ? `${profile().terms.Order} 218` : `Rush ${profile().terms.Order} 104`;

  let trainingProps;
  let label;
  if (laneId === "wc-pack-2" && orderId === "rush-104") {
    trainingProps = {
      score: "92%",
      noteShort: "planner passed scenario",
      note: "Good choice. Packaging Line 2 is a valid alternate resource, and the model keeps the Line 3 calendar issue open for data cleanup.",
    };
    label = "Training scenario passed; UAT script 12 can reuse the same mock scheduling case.";
    state.gateMessage = "Training and UAT nodes unlocked from the scored demo scenario.";
  } else if (laneId === "wc-pack-3") {
    trainingProps = {
      score: "54%",
      noteShort: "calendar issue caught",
      note: "Partially correct capability match, but Packaging Line 3 still has an unresolved calendar issue and should not be used for the rush order.",
    };
    label = "Training scenario exposed a calendar-data misunderstanding.";
    state.gateMessage = "Training evidence captured, but data quality remains a risk node.";
  } else {
    trainingProps = {
      score: "28%",
      noteShort: "capability mismatch",
      note: "The selected resource does not perform packaging operations. The semantic layer links this miss to training and role readiness.",
    };
    label = "Training scenario exposed a workcenter capability misunderstanding.";
    state.gateMessage = "Training evidence captured. Review capability mapping before UAT.";
  }

  Model.commit({
    label,
    ops: [
      { op: "add", node: { id: "assigned-order", type: "evidence", props: { id: orderId, laneId, title: orderTitle } } },
      { op: "add", node: { id: "training", type: "evidence", props: trainingProps } },
    ],
  });
  unlockThrough(6);
  renderAll();
}

function syncStaticControls() {
  $("#erpProfile").value = state.erp;
  $("#domainProfile").value = state.domain;
  $("#archetypeProfile").value = state.archetype;
  $("#futureMigration").checked = state.futureMigration;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function exportBrief() {
  const brief = {
    product: "ImplementationOS for Manufacturing Software",
    template: "APS Pilot",
    erpProfile: profile().badge,
    site: siteName(),
    areas: areas().map((area) => area.name),
    workcenters: workcenters().map((wc) => ({
      name: wc.name,
      area: areaName(wc.areaId),
      status: wc.needsReconcile ? "Needs reconciliation" : wc.status,
    })),
    readiness: `${readinessScore()}%`,
    training: training() || "Pending",
    deliverables: deliverableJourney.map((stage) => ({
      stage: stage.stage,
      artifacts: stage.artifacts.map((artifact) => ({
        name: artifact.name,
        owner: artifact.owner,
        status: artifact.status,
      })),
    })),
    impacts: impacts().slice(0, 5),
  };

  const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "implementationos-demo-brief.json";
  link.click();
  URL.revokeObjectURL(url);
}

document.addEventListener("DOMContentLoaded", () => {
  loadUiState();
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeScreen = button.dataset.screen;
      renderAll();
    });
  });

  $("#erpProfile").addEventListener("change", (event) => {
    state.erp = event.target.value;
    Model.note(`ERP profile changed to ${profile().badge}; terminology and implementation risks were refreshed.`);
    renderAll();
  });

  $("#domainProfile").addEventListener("change", (event) => {
    state.domain = event.target.value;
    Model.note(`Implementation domain changed to ${event.target.options[event.target.selectedIndex].text}.`);
    renderAll();
  });

  $("#archetypeProfile").addEventListener("change", (event) => {
    state.archetype = event.target.value;
    Model.note(`Planning archetype changed to ${selectedArchetype().name}.`);
    state.gateMessage = `${selectedArchetype().name} now steers mock data, constraints, and training scenarios.`;
    renderAll();
  });

  $("#futureMigration").addEventListener("change", (event) => {
    state.futureMigration = event.target.checked;
    Model.note(
      state.futureMigration
        ? "S/4 migration context added to project memory."
        : "S/4 migration context removed from active risk scoring."
    );
    renderAll();
  });

  $("#backBtn").addEventListener("click", () => {
    state.step = Math.max(0, state.step - 1);
    renderAll();
  });

  $("#nextBtn").addEventListener("click", () => {
    enterStep(Math.min(steps.length - 1, state.step + 1));
  });

  $("#resetBtn").addEventListener("click", () => {
    state = clone(initialState);
    try {
      localStorage.removeItem(UI_STORAGE_KEY);
    } catch {}
    Model.reset();
    renderAll();
  });

  $("#exportBtn").addEventListener("click", exportBrief);

  renderAll();
});
