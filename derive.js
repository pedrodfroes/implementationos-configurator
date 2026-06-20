// ImplementationOS — derived helpers.
//
// Read-only getters over `state` + the reference data. They resolve the live
// ERP dialect, synthesize the operating mode from the selected archetypes, and
// compute readiness. Depends on data.js and state.js.

function profile() { return profiles[state.erp]; }
function organizationTerm() {
  const compact = {
    oracle: "Inventory Organization",
    peoplesoft: "Manufacturing BU",
    epicor: "Site / Plant",
  };
  return compact[state.erp] || profile().facility;
}
function calendarProfile() {
  if (["sap_pp", "sap_pi", "s4"].includes(state.erp)) return calendarProfiles.sap;
  return calendarProfiles[state.erp] || calendarProfiles.generic;
}
function selectedArchetypes() {
  return (state.archetypes || []).map((id) => planningArchetypes.find((item) => item.id === id)).filter(Boolean);
}
function industry() { return industries.find((item) => item.id === state.industry) || null; }
function executionSourceLabel() {
  return { erp: `${profile().badge} confirmations`, mes: "MES execution events", hybrid: `Hybrid MES + ${profile().badge}` }[state.execution?.source] || "Not configured";
}
function selectedDepartmentTypes() { return departmentTaxonomy.filter((item) => state.departmentTypes?.includes(item.id)); }
function selectedResourceTypes() { return resourceTaxonomy.filter((item) => state.resourceTypes?.includes(item.id)); }
function attributeProfile() {
  if (["sap_pp", "sap_pi", "s4"].includes(state.erp)) return attributeProfiles.sap;
  if (["oracle", "netsuite", "peoplesoft"].includes(state.erp)) return attributeProfiles.oracle;
  if (state.erp === "d365") return attributeProfiles.d365;
  return attributeProfiles.generic;
}
function itemTerm() {
  return { sap_pp: "material", sap_pi: "material", s4: "material", d365: "product", odoo: "product", netsuite: "item" }[state.erp] || "item";
}
function qualityLens() {
  const processMode = modeMix().dominant === "process";
  const regulated = ["pharma", "food-beverage", "medical-devices", "chemicals", "pesticides"].includes(state.industry);
  return processMode || regulated;
}
// Every attribute the user picked across all families — feeds the transitions
// step, where setups/cleans can be keyed to those same traits.
function allSelectedAttributes() {
  return Object.values(state.attr || {}).flatMap((slot) => slot?.picks || []);
}
function transitionsConfigured() {
  const t = state.transitions;
  return !!(t && t.types?.length && t.triggers?.length && t.concurrency && t.drivers?.length);
}
function representativeData() {
  const departments = selectedDepartmentTypes().map((item, index) => ({
    id: `DEPT-${String(index + 1).padStart(3, "0")}`,
    name: `${item.name} 01`,
    taxonomyType: item.id,
    synthetic: true,
  }));
  const resources = selectedResourceTypes().map((item, index) => ({
    id: `RES-${String(index + 1).padStart(3, "0")}`,
    name: `${item.name} 01`,
    taxonomyType: item.id,
    departmentId: departments.find((department) => department.taxonomyType === item.department)?.id || null,
    relationshipStatus: departments.some((department) => department.taxonomyType === item.department) ? "mapped by taxonomy" : "left unassigned for customer mapping",
    synthetic: true,
  }));
  return {
    replacementPolicy: "Representative synthetic records; replace with governed customer master data during onboarding.",
    organization: { id: "ORG-001", name: `Demo ${organizationTerm()} 01`, type: profile().facility, synthetic: true },
    departments,
    resources,
  };
}
function modeMix() {
  const selected = selectedArchetypes();
  const counts = {};
  selected.forEach((item) => { counts[item.mode] = (counts[item.mode] || 0) + 1; });
  let dominant = selected[0]?.mode || "process";
  selected.forEach((item) => {
    if ((counts[item.mode] || 0) > (counts[dominant] || 0)) dominant = item.mode;
  });
  return { dominant, overlays: Object.keys(counts).filter((key) => key !== dominant), counts };
}
function mode() { return modeProfiles[modeMix().dominant]; }
function archetypeSynthesis() {
  const selected = selectedArchetypes();
  const mix = modeMix();
  if (!selected.length) return { title: "No operating pattern selected", detail: "Choose every pattern that materially shapes planning.", count: 0 };
  if (selected.length === 1) return { title: selected[0].name, detail: modeProfiles[selected[0].mode].note, count: 1 };
  const dominant = modeProfiles[mix.dominant].label;
  const overlays = mix.overlays.map((key) => modeProfiles[key].label).join(", ");
  return {
    title: overlays ? `${dominant} backbone with ${overlays} overlay` : `${dominant} composite`,
    detail: overlays ? `The ${dominant.toLowerCase()} model drives terminology; secondary constraints remain explicit downstream.` : `${selected.length} compatible patterns are synthesized inside one ${dominant.toLowerCase()} model.`,
    count: selected.length,
  };
}
function readiness() {
  let s = 16;
  if (state.scope) s += 12;
  if (state.archetypes?.length) s += 8;
  if (state.industry) s += 6;
  if (state.departmentTypes?.length) s += 8;
  if (state.calendar?.layering && state.calendar?.pattern && state.calendar?.exceptions && state.calendar?.modifiersConfirmed) s += 8;
  if (state.constraint) s += 6;
  if (state.resourceTypes?.length) s += 10;
  const attrConfirmed = Object.values(state.attr || {}).filter((slot) => slot?.confirmed).length;
  if (attrConfirmed) s += Math.min(10, attrConfirmed * 2);
  if (transitionsConfigured()) s += 8;
  if (state.bom?.structure && state.bom?.featuresConfirmed && state.bom?.consumption && state.bom?.source) s += 8;
  if (state.execution?.source && state.execution?.levels?.length && state.execution?.events?.length && state.execution?.quantitiesConfirmed) s += 8;
  if (state.variant && state.variant !== "active") s += 6;
  if (state.migration) s -= 4;
  return Math.max(5, Math.min(99, Math.round(s)));
}
