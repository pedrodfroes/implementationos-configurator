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
function selectedIndustryContexts() {
  return (state.industryContexts || []).map((context) => ({ ...context, sector: industries.find((item) => item.id === context.industry) })).filter((context) => context.sector);
}
function industryLabel() {
  const contexts = selectedIndustryContexts();
  if (contexts.length === 1) return contexts[0].specialty;
  return contexts.length ? `${contexts.length} industry contexts` : null;
}
function industryLens() {
  return [...new Set(selectedIndustryContexts().map((context) => context.sector.name))].join(" + ");
}
function compatibleContextLabels(id) {
  return selectedIndustryContexts().filter((context) => industryArchetypeCompatibility[context.industry]?.includes(id)).map((context) => context.specialty);
}
function isArchetypeCompatible(id) { return compatibleContextLabels(id).length > 0; }
function supplyProfiles() {
  const ids = new Set();
  selectedIndustryContexts().forEach((context) => (industrySupplyProfiles[context.industry] || []).forEach((id) => ids.add(id)));
  if (!ids.size) ["interplant-transfer", "standard-packaging"].forEach((id) => ids.add(id));
  return [...ids].map((id) => ({ id, ...supplyProfileCatalog[id] })).filter((item) => item.name);
}
function supplyPolicy(profile) { return state.supplies?.policies?.[profile.id] || profile.recommended; }
function volumeStorageRecommended() {
  const processSectors = new Set(["food-beverage", "pharma", "chemicals", "metals-mining", "building-materials", "packaging", "energy-services"]);
  return selectedIndustryContexts().some((context) => processSectors.has(context.industry));
}
function laborIntensity() {
  const rank = { core: 3, supporting: 2, minimal: 1 };
  let best = 0, label = "supporting";
  selectedArchetypes().forEach((a) => {
    const tier = archetypeLaborIntensity[a.id] || "supporting";
    if (rank[tier] > best) { best = rank[tier]; label = tier; }
  });
  return label;
}
function workforceScope(cap) {
  return state.workforce?.scopes?.[cap.id] || workforceScopeMatrix[cap.id]?.[laborIntensity()] || "basic";
}
function executionSourceLabel() {
  return { erp: `${profile().badge} confirmations`, mes: "MES execution events", hybrid: `Hybrid MES + ${profile().badge}` }[state.execution?.source] || "Not configured";
}
function masterPlanningEnabled() {
  return !!state.masterPlanning?.enabled;
}
function masterPlanningConfigured() {
  const mp = state.masterPlanning || {};
  if (!mp.enabled) return !!mp.reviewed;
  return !!(mp.objective && mp.grain && mp.demand?.length && mp.supply?.length && mp.policy?.length && mp.capacity?.length && mp.run && mp.handoff?.length && mp.reviewed);
}
function masterPlanningSummary() {
  const mp = state.masterPlanning || {};
  if (!mp.enabled) return mp.reviewed ? "Not in scope" : "Not reviewed";
  const objective = masterPlanningObjectives.find((item) => item.id === mp.objective)?.name || "Objective pending";
  const grain = masterPlanningGrains.find((item) => item.id === mp.grain)?.name || "grain pending";
  return `${objective} at ${grain}`;
}
function dispatchEnabled() {
  return !!state.dispatch?.enabled;
}
function dispatchConfigured() {
  const d = state.dispatch || {};
  if (!d.enabled) return !!d.reviewed;
  return !!(d.objective && d.granularity && d.inputs?.length && d.policies?.length && d.channels?.length && d.reactivity && d.reviewed);
}
function dispatchSummary() {
  const d = state.dispatch || {};
  if (!d.enabled) return d.reviewed ? "Not in scope" : "Not reviewed";
  const objective = dispatchObjectives.find((item) => item.id === d.objective)?.name || "Objective pending";
  const grain = dispatchGranularities.find((item) => item.id === d.granularity)?.name || "grain pending";
  return `${objective} · ${grain}`;
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
  const regulatedSectors = ["pharma", "food-beverage", "medical-devices", "chemicals", "pesticides"];
  const regulated = selectedIndustryContexts().some((context) => regulatedSectors.includes(context.industry));
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
  if (masterPlanningConfigured()) s += state.masterPlanning?.enabled ? 8 : 3;
  if (state.archetypes?.length) s += 8;
  if (selectedIndustryContexts().length) s += 6;
  if (state.departmentTypes?.length) s += 8;
  if (state.calendar?.layering && state.calendar?.pattern && state.calendar?.exceptions && state.calendar?.modifiersConfirmed) s += 8;
  if (state.constraint) s += 6;
  if (state.resourceTypes?.length) s += 10;
  if (state.volumeStorage?.present === false || state.volumeStorage?.confirmed) s += 6;
  const attrConfirmed = Object.values(state.attr || {}).filter((slot) => slot?.confirmed).length;
  if (attrConfirmed) s += Math.min(10, attrConfirmed * 2);
  if (transitionsConfigured()) s += 8;
  if (state.bom?.structure && state.bom?.featuresConfirmed && state.bom?.consumption && state.bom?.source) s += 8;
  if (state.supplies?.confirmed) s += 6;
  if (state.workforce?.confirmed) s += 6;
  if (dispatchConfigured()) s += state.dispatch?.enabled ? 6 : 2;
  if (state.execution?.source && state.execution?.levels?.length && state.execution?.events?.length && state.execution?.quantitiesConfirmed) s += 8;
  if (state.variant && state.variant !== "active") s += 6;
  if (state.migration) s -= 4;
  return Math.max(5, Math.min(99, Math.round(s)));
}
