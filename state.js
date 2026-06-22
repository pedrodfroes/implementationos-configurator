// ImplementationOS — UI state and persistence.
//
// The semantic graph (model.js) is the source of truth for the model itself;
// this `state` only tracks where the user is in the installer and which
// answers they've given. Persisted to localStorage under a versioned key so a
// shape change can discard stale state cleanly. Depends on data.js for
// `attributeConcepts` and util.js for `clone`.

const initialState = {
  i: 0,
  max: 0,
  scope: null,
  industryFirst: true,
  archetypes: [],
  industry: null,
  industrySpecialty: null,
  industryContexts: [],
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
  // Migration sentinels: purely-visual Gantt steps were added around the
  // calendar and bottleneck steps. Each flag's absence in a saved session
  // triggers the matching index shift.
  calendarVisuals: true,
  bottleneckVisuals: true,
  taxonomyMode: "representative",
  departmentTypes: [],
  resourceTypes: [],
  attr: Object.fromEntries(attributeConcepts.map((concept) => [concept.id, { picks: [], confirmed: false }])),
  transitions: {
    types: [],
    triggers: [],
    concurrency: null,
    drivers: [],
    driverAttributes: [],
  },
  bom: {
    structure: null,
    features: [],
    featuresConfirmed: false,
    consumption: null,
    source: null,
  },
  volumeStorage: { present: null, behaviors: [], confirmed: false },
  supplies: { policies: {}, confirmed: false },
  workforce: { scopes: {}, confirmed: false },
  execution: {
    source: null,
    levels: [],
    events: [],
    quantities: [],
    quantitiesConfirmed: false,
  },
  variant: null, // null | "active" | "kept" | "reverted" | "skipped"
  done: false,
};

let state = clone(initialState);
const UI_KEY = "implementationos-installer-v2";

function save() {
  try { localStorage.setItem(UI_KEY, JSON.stringify(state)); } catch {}
}
function load() {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...clone(initialState), ...saved };
      if (!Array.isArray(saved.industryContexts) && saved.industry && saved.industrySpecialty) {
        state.industryContexts = [{ industry: saved.industry, specialty: saved.industrySpecialty }];
      }
      if (!("supplies" in saved) && Number(saved.max || 0) >= 11) {
        state.i = 11;
        state.max = Math.max(11, Number(state.max || 0) + 1);
      }
      if (!("workforce" in saved)) {
        const wfIdx = steps.findIndex((step) => step.id === "workforce");
        if (wfIdx >= 0 && Number(saved.i || 0) >= wfIdx) state.i = Number(saved.i) + 1;
        if (wfIdx >= 0 && Number(saved.max || 0) >= wfIdx) state.max = Number(saved.max) + 1;
      }
      if (!("volumeStorage" in saved)) {
        const vsIdx = steps.findIndex((step) => step.id === "volume-storage");
        if (vsIdx >= 0 && Number(saved.i || 0) >= vsIdx) state.i = Number(saved.i) + 1;
        if (vsIdx >= 0 && Number(saved.max || 0) >= vsIdx) state.max = Number(saved.max) + 1;
      }
      if (!("calendarVisuals" in saved)) {
        // Two visual steps were inserted around the calendar step; shift the
        // saved position past each one it already sits at or beyond.
        ["calendar-gantt-intro", "calendar-gantt-preview"].forEach((id) => {
          const idx = steps.findIndex((step) => step.id === id);
          if (idx >= 0 && Number(state.i) >= idx) state.i = Number(state.i) + 1;
          if (idx >= 0 && Number(state.max) >= idx) state.max = Number(state.max) + 1;
        });
      }
      if (!("bottleneckVisuals" in saved)) {
        ["bottleneck-intro", "bottleneck-preview"].forEach((id) => {
          const idx = steps.findIndex((step) => step.id === id);
          if (idx >= 0 && Number(state.i) >= idx) state.i = Number(state.i) + 1;
          if (idx >= 0 && Number(state.max) >= idx) state.max = Number(state.max) + 1;
        });
      }
      if (!Array.isArray(saved.archetypes) && saved.archetype) state.archetypes = [saved.archetype];
      if (!("scope" in saved)) {
        state.i = 1;
        state.max = Math.max(1, Number(saved.max || 0));
      } else if ("planningMode" in saved) {
        if (state.i > 6) state.i -= 1;
        if (state.max > 6) state.max -= 1;
      }
      delete state.planningMode;
      delete state.archetype;
      if (!("industry" in saved) && Number(saved.max || 0) >= 2) {
        state.i = 3;
        state.max = Math.max(3, state.max + 1);
      }
      if (!("execution" in saved) && Number(saved.max || 0) >= 11) {
        state.i = 12;
        state.max = Math.max(12, state.max + 1);
      }
      if (!("taxonomyMode" in saved)) {
        if (state.i > 6) state.i -= 1;
        if (state.max > 6) state.max -= 1;
        if (Number(saved.max || 0) >= 9) state.i = 8;
        state.departmentTypes = [];
        state.resourceTypes = [];
      }
      if (!("industryFirst" in saved)) {
        state.i = 2;
        state.archetypes = state.archetypes.filter((id) => industryArchetypeCompatibility[state.industry]?.includes(id));
      }
      delete state.lineDecision;
    }
  } catch { state = clone(initialState); }
}
