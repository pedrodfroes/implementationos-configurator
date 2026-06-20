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
  archetypes: [],
  industry: null,
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
      delete state.lineDecision;
    }
  } catch { state = clone(initialState); }
}
