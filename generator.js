// ImplementationOS — representative mock-ERP dataset generator.
//
// Pure and deterministic (seeded). A shared `coreEntities()` structural layer
// feeds two projections:
//   • Generic  — neutral relational CSVs (one table per concept).
//   • Opcenter — Siemens Opcenter APS (formerly Preactor) UserData schema.
//
// Mirrors how a scheduler stores the model: structure once (per family /
// resource / calendar), expand over time (capacity), transact per part
// (demand). Item attributes / the SKU cartesian and the changeover matrices
// are PARKED: they enter only as stub counts F (families) and S (skus); the
// structural model stays flat regardless of how big F and S get.
//
// Runtime deps: data.js, state.js, derive.js's profile()/calendarProfile().

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────────
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function pad(n, w = 3) { return String(n).padStart(w, "0"); }

// ── Parameters: derived from wizard state, overridable ───────────────
function datasetParams(over = {}) {
  const cal = state.calendar || {};
  const shiftsPerDay = cal.pattern === "multi-shift" ? 2 : cal.pattern === "variable" ? 3 : 1;
  const deptTypes = (state.departmentTypes && state.departmentTypes.length) ? state.departmentTypes : departmentTaxonomy.slice(0, 4).map((d) => d.id);
  const resTypes = (state.resourceTypes && state.resourceTypes.length) ? state.resourceTypes : resourceTaxonomy.slice(0, 4).map((r) => r.id);
  const industries = (state.industryContexts || []).length || 1;
  return {
    seed: 20260101,
    plants: 2, locsPerPlant: 4, binsPerLoc: 8,
    deptTypes, deptInst: 1,
    resTypes, resInst: 3,
    shiftsPerDay, horizonDays: 90,
    skills: [
      { name: "Engineer", headcount: 2 },
      { name: "Technician", headcount: 3 },
      { name: "Operator", headcount: 6 },
      { name: "QA Analyst", headcount: 2 },
    ],
    tanks: state.volumeStorage?.present ? 12 : 0,
    families: industries * 64, // F stub (parked attribute layer)
    skus: 5000,                // S stub (parked)
    materials: 1500,
    opsPerRouting: 8, bomLinesPerFamily: 12,
    periods: 12, ordersPerSkuPeriod: 0.5,
    ordersPerPartPeriod: 4,    // Opcenter demand is per part (family), not per SKU
    changeoverAttrValues: 8,   // size of the parked attribute changeover matrix
    ...over,
  };
}

// ── Shared structural layer (identical rng draw order for both formats) ─
function coreEntities(p, rng) {
  const plants = [];
  const org = [];
  const root = { node_id: "ORG-001", level: profile().hierarchy[0], code: "ORG", name: `${profile().hierarchy[0]} 01`, parent_id: "" };
  org.push(root);
  for (let pi = 1; pi <= p.plants; pi++) {
    const plant = { node_id: `PLNT-${pad(pi)}`, level: profile().facility, code: `P${pi}`, name: `${profile().facility} ${pad(pi)}`, parent_id: root.node_id };
    plants.push(plant); org.push(plant);
    for (let li = 1; li <= p.locsPerPlant; li++) {
      const loc = { node_id: `LOC-${pad(pi)}${pad(li)}`, level: profile().storage, code: `L${pi}-${li}`, name: `${profile().storage} ${pi}-${li}`, parent_id: plant.node_id };
      org.push(loc);
      for (let bi = 1; bi <= p.binsPerLoc; bi++) org.push({ node_id: `BIN-${pad(pi)}${pad(li)}${pad(bi)}`, level: profile().bin, code: `B${pi}-${li}-${bi}`, name: `${profile().bin} ${pi}-${li}-${bi}`, parent_id: loc.node_id });
    }
  }

  const depts = [];
  let dn = 0;
  for (const plant of plants) for (const dt of p.deptTypes) for (let k = 0; k < p.deptInst; k++) {
    const meta = departmentTaxonomy.find((d) => d.id === dt) || { name: dt };
    depts.push({ dept_id: `DEPT-${pad(++dn)}`, plant_id: plant.node_id, semantic_type: dt, name: `${meta.name} ${pad(k + 1)}` });
  }

  const resources = [];
  let rn = 0;
  plants.forEach((plant, pIdx) => {
    for (const rt of p.resTypes) for (let k = 0; k < p.resInst; k++) {
      const meta = resourceTaxonomy.find((r) => r.id === rt) || { name: rt, department: null };
      const dept = depts.find((d) => d.plant_id === plant.node_id && d.semantic_type === meta.department) || depts.find((d) => d.plant_id === plant.node_id) || depts[0];
      resources.push({ resource_id: `RES-${pad(++rn)}`, dept_id: dept ? dept.dept_id : "", resource_type: rt, name: `${meta.name} ${pad(k + 1)}`, capacity_units: randInt(rng, 1, 4), efficiency: +(0.8 + rng() * 0.2).toFixed(2), calendar_id: `CALR-${pad(pIdx + 1)}` });
    }
  });

  const calendars = [];
  plants.forEach((plant, i) => {
    calendars.push({ calendar_id: `CAL-${pad(i + 1)}`, type: "base", parent_id: "", description: `${calendarProfile().base} — ${plant.name}` });
    calendars.push({ calendar_id: `CALR-${pad(i + 1)}`, type: "resource", parent_id: `CAL-${pad(i + 1)}`, description: `${calendarProfile().resource} — ${plant.name}` });
  });

  const windows = p.shiftsPerDay >= 3 ? [["Night", "22:00", "06:00"], ["Day", "06:00", "14:00"], ["Late", "14:00", "22:00"]]
    : p.shiftsPerDay === 2 ? [["Day", "06:00", "14:00"], ["Late", "14:00", "22:00"]]
      : [["Day", "06:00", "14:00"]];
  const shifts = []; let sn = 0;
  for (const c of calendars) for (const w of windows) shifts.push({ shift_id: `SHF-${pad(++sn)}`, calendar_id: c.calendar_id, name: w[0], start_time: w[1], end_time: w[2], days_of_week: "Mon-Fri" });

  const skills = p.skills.map((s, i) => ({ skill_id: `SKL-${pad(i + 1)}`, name: s.name, headcount: s.headcount, calendar_id: "CALR-001" }));

  const qualification = [];
  const elig = p.resTypes.slice(0, Math.min(p.resTypes.length, 3));
  skills.forEach((s) => elig.forEach((rt, j) => qualification.push({ skill_id: s.skill_id, resource_type: rt, level: j === 0 ? "primary" : "backup" })));

  const tanks = [];
  const prodDept = depts.find((d) => d.semantic_type === "production") || depts[0];
  for (let i = 1; i <= p.tanks; i++) tanks.push({ tank_id: `TNK-${pad(i)}`, dept_id: prodDept ? prodDept.dept_id : "", capacity: 1000 * randInt(rng, 5, 40), min_heel: +(0.05 + rng() * 0.1).toFixed(2), eligibility_group: `G${1 + (i % 3)}`, connected_to: i > 1 && rng() < 0.4 ? `TNK-${pad(i - 1)}` : "" });

  const families = [];
  for (let i = 1; i <= p.families; i++) families.push({ family_id: `FAM-${pad(i, 4)}`, name: `Family ${pad(i, 4)}` });

  const tankElig = [];
  const famSlice = families.slice(0, Math.min(families.length, 20));
  tanks.forEach((t) => famSlice.forEach((f) => tankElig.push({ tank_id: t.tank_id, family_id: f.family_id, allowed: true })));

  const materials = [];
  const supplyIds = Object.keys(supplyProfileCatalog);
  for (let i = 1; i <= p.materials; i++) {
    const st = supplyIds[i % supplyIds.length];
    const cat = supplyProfileCatalog[st];
    materials.push({ material_id: `MAT-${pad(i, 5)}`, name: `${cat.name.split(" ").slice(0, 2).join(" ")} ${pad(i, 5)}`, supply_type: st, policy: cat.recommended, lead_time_days: randInt(rng, 2, 90), source: pick(rng, ["PO", "transfer", "stock"]), shelf_life_days: st === "cold-chain" ? randInt(rng, 5, 90) : "" });
  }

  const bom = []; let bn = 0;
  for (const f of families) for (let l = 0; l < p.bomLinesPerFamily; l++) bom.push({ bom_line_id: `BOM-${pad(++bn, 7)}`, family_id: f.family_id, level: l < 2 ? 1 : 2, component_ref: materials[bn % materials.length].material_id, qty_per: +(0.1 + rng() * 5).toFixed(2), uom: pick(rng, ["EA", "KG", "L"]) });

  const routing = []; let on = 0;
  for (const f of families) for (let o = 1; o <= p.opsPerRouting; o++) routing.push({ routing_op_id: `RTG-${pad(++on, 7)}`, family_id: f.family_id, op_seq: o, resource_type: p.resTypes[(o - 1) % p.resTypes.length], run_time_per_unit: +(0.2 + rng() * 3).toFixed(2), setup_group: `SG-${1 + (o % 5)}`, skill_required: rng() < 0.3 ? skills[randInt(rng, 0, skills.length - 1)].skill_id : "" });

  return { org, plants, depts, resources, calendars, windows, shifts, skills, qualification, tanks, families, tankElig, materials, bom, routing };
}

// ── Generic projection ───────────────────────────────────────────────
function buildDataset(p, rng) {
  const e = coreEntities(p, rng);
  const out = [];
  const T = (name, columns, rows) => out.push({ name, columns, rows });
  const epoch = Date.UTC(2026, 0, 1);
  const dateAt = (day) => new Date(epoch + day * 86400000).toISOString().slice(0, 10);
  const isWeekend = (day) => { const d = new Date(epoch + day * 86400000).getUTCDay(); return d === 0 || d === 6; };
  const windowNames = e.windows.map((w) => w[0]);

  T("org_hierarchy", ["node_id", "level", "code", "name", "parent_id"], e.org);
  T("departments", ["dept_id", "plant_id", "semantic_type", "name"], e.depts);
  T("resources", ["resource_id", "dept_id", "resource_type", "name", "capacity_units", "efficiency", "calendar_id"], e.resources);
  T("calendars", ["calendar_id", "type", "parent_id", "description"], e.calendars);
  T("shifts", ["shift_id", "calendar_id", "name", "start_time", "end_time", "days_of_week"], e.shifts);
  T("skills", ["skill_id", "name", "headcount", "calendar_id"], e.skills);
  T("qualification_matrix", ["skill_id", "resource_type", "level"], e.qualification);
  T("tanks", ["tank_id", "dept_id", "capacity", "min_heel", "eligibility_group", "connected_to"], e.tanks);
  T("families", ["family_id", "name"], e.families);
  T("tank_eligibility", ["tank_id", "family_id", "allowed"], e.tankElig);
  T("materials", ["material_id", "name", "supply_type", "policy", "lead_time_days", "source", "shelf_life_days"], e.materials);
  T("bom_templates", ["bom_line_id", "family_id", "level", "component_ref", "qty_per", "uom"], e.bom);
  T("routing_templates", ["routing_op_id", "family_id", "op_seq", "resource_type", "run_time_per_unit", "setup_group", "skill_required"], e.routing);

  const resAvail = [];
  for (const r of e.resources) for (let day = 0; day < p.horizonDays; day++) {
    const weekend = isWeekend(day), date = dateAt(day);
    for (const w of windowNames) {
      const status = weekend ? "holiday" : (rng() < 0.02 ? "maintenance" : "working");
      resAvail.push({ resource_id: r.resource_id, date, shift_id: `${r.calendar_id}-${w}`, available_units: status === "working" ? r.capacity_units : 0, efficiency: r.efficiency, status });
    }
  }
  T("resource_availability", ["resource_id", "date", "shift_id", "available_units", "efficiency", "status"], resAvail);

  const skillAvail = [];
  for (const s of e.skills) for (let day = 0; day < p.horizonDays; day++) {
    const weekend = isWeekend(day), date = dateAt(day);
    for (const w of windowNames) skillAvail.push({ skill_id: s.skill_id, date, shift_id: w, headcount: weekend ? 0 : Math.max(0, s.headcount - (rng() < 0.05 ? 1 : 0)) });
  }
  T("skill_availability", ["skill_id", "date", "shift_id", "headcount"], skillAvail);

  const tankAvail = [];
  for (const t of e.tanks) for (let day = 0; day < p.horizonDays; day++) tankAvail.push({ tank_id: t.tank_id, date: dateAt(day), status: pick(rng, ["filling", "holding", "draining", "cleaning", "empty"]), current_material: rng() < 0.7 ? e.families[randInt(rng, 0, e.families.length - 1)].family_id : "" });
  T("tank_availability", ["tank_id", "date", "status", "current_material"], tankAvail);

  const skus = [];
  for (let i = 1; i <= p.skus; i++) skus.push({ sku_id: `SKU-${pad(i, 7)}`, family_id: e.families[i % e.families.length].family_id, name: `SKU ${pad(i, 7)}` });
  T("skus", ["sku_id", "family_id", "name"], skus);

  const demand = []; let dn = 0;
  const total = Math.round(p.skus * p.periods * p.ordersPerSkuPeriod);
  for (let k = 0; k < total; k++) demand.push({ order_id: `ORD-${pad(++dn, 8)}`, sku_id: `SKU-${pad((k % p.skus) + 1, 7)}`, qty: randInt(rng, 10, 5000), due_date: dateAt(randInt(rng, 1, p.horizonDays)), customer_id: `CUST-${pad(randInt(rng, 1, 40))}`, priority: pick(rng, ["low", "normal", "high", "rush"]) });
  T("demand_orders", ["order_id", "sku_id", "qty", "due_date", "customer_id", "priority"], demand);

  return out;
}

// ── Opcenter APS (Preactor) UserData projection ──────────────────────
// Maps the shared entities onto the core UserData tables. Families are the
// scheduled "Products" (PartNo); skills and tanks become SecondaryConstraints;
// the parked attribute layer is represented by a small Attribute1 dimension
// and its changeover matrix.
function buildOpcenter(p, rng) {
  const e = coreEntities(p, rng);
  const out = [];
  const T = (name, columns, rows) => out.push({ name, columns, rows });
  const epoch = Date.UTC(2026, 0, 1);
  const dstr = (day) => new Date(epoch + day * 86400000).toISOString().slice(0, 10);

  // id maps (Opcenter uses integer PKs; keep ExternalId = our string id)
  const groupInt = {}; e.depts.forEach((d, i) => { groupInt[d.dept_id] = i + 1; });
  const semanticGroup = {}; e.depts.forEach((d, i) => { if (!semanticGroup[d.semantic_type]) semanticGroup[d.semantic_type] = i + 1; });
  const resInt = {}; e.resources.forEach((r, i) => { resInt[r.resource_id] = i + 1; });
  const resByType = {}; e.resources.forEach((r, i) => { (resByType[r.resource_type] ||= []).push(i + 1); });
  const secInt = {};

  // ResourceGroups / Resources / membership
  T("ResourceGroups", ["ResourceGroupsId", "Name", "ExternalId"], e.depts.map((d, i) => ({ ResourceGroupsId: i + 1, Name: d.name, ExternalId: d.dept_id })));
  T("Resources", ["ResourcesId", "Name", "FiniteOrInfinite", "Efficiency", "CostPerHour", "ChangeoverGroup", "ExternalId"],
    e.resources.map((r, i) => ({ ResourcesId: i + 1, Name: r.name, FiniteOrInfinite: 0, Efficiency: r.efficiency, CostPerHour: 50 + (i % 10) * 15, ChangeoverGroup: 1, ExternalId: r.resource_id })));
  T("ResourceGroupsResources", ["ResourceGroupsId", "Resources", "__inst__ResourceGroupsResources"],
    e.resources.map((r, i) => ({ ResourceGroupsId: groupInt[r.dept_id] || 1, Resources: i + 1, __inst__ResourceGroupsResources: 0 })));

  // SecondaryConstraints = skills + tanks
  const sec = []; let sid = 0;
  e.skills.forEach((s) => { sid++; secInt[s.skill_id] = sid; sec.push({ SecondaryConstraintsId: sid, Name: s.name, UseAsAConstraint: 1, CostPerHour: 40, CalendarEffect: 0, ExternalId: s.skill_id }); });
  e.tanks.forEach((t) => { sid++; secInt[t.tank_id] = sid; sec.push({ SecondaryConstraintsId: sid, Name: `Tank ${t.tank_id}`, UseAsAConstraint: 1, CostPerHour: 0, CalendarEffect: 0, ExternalId: t.tank_id }); });
  T("SecondaryConstraints", ["SecondaryConstraintsId", "Name", "UseAsAConstraint", "CostPerHour", "CalendarEffect", "ExternalId"], sec);

  // Products = families x routing operations (the scheduled parts + routings)
  const routingByFam = {}; e.routing.forEach((r) => { (routingByFam[r.family_id] ||= []).push(r); });
  const products = []; let pid = 0; const famFirstPid = {};
  e.families.forEach((f, fi) => {
    (routingByFam[f.family_id] || []).sort((a, b) => a.op_seq - b.op_seq).forEach((op, oi) => {
      pid++;
      if (oi === 0) famFirstPid[f.family_id] = pid;
      const grp = semanticGroup[(resourceTaxonomy.find((rt) => rt.id === op.resource_type) || {}).department] || 1;
      products.push({ ParentPart: 0, ProductsId: pid, PartNo: f.family_id, Product: f.name, OpNo: op.op_seq, OpId: pid, OperationName: `Op ${op.op_seq}`, ResourceGroup: grp, RequiredResource: 0, SetupTime: +(5 + (fi % 4) * 2).toFixed(1), OpTimePerItem: op.run_time_per_unit, QuantityPerHour: +(60 / Math.max(0.2, op.run_time_per_unit)).toFixed(1), TableAttribute1: (fi % p.changeoverAttrValues) + 1, ExternalId: `${f.family_id}-OP${op.op_seq}`, _resType: op.resource_type, _skill: op.skill_required });
    });
  });
  T("Products", ["ParentPart", "ProductsId", "PartNo", "Product", "OpNo", "OpId", "OperationName", "ResourceGroup", "RequiredResource", "SetupTime", "OpTimePerItem", "QuantityPerHour", "TableAttribute1", "ExternalId"], products);

  // ProductsResourceData = eligible resource(s) per operation
  const prd = [];
  products.forEach((pr) => {
    (resByType[pr._resType] || []).slice(0, 2).forEach((rid, inst) => prd.push({ ProductsId: pr.ProductsId, ResourceData: rid, AutomaticSequencing: 1, ResourceSetupTime: pr.SetupTime, ResourceOpTime: pr.OpTimePerItem, __inst__ProductsResourceData: inst }));
  });
  T("ProductsResourceData", ["ProductsId", "ResourceData", "AutomaticSequencing", "ResourceSetupTime", "ResourceOpTime", "__inst__ProductsResourceData"], prd);

  // ProductsSecondaryConstraints = operations needing a skilled secondary resource
  const psc = [];
  products.forEach((pr) => { if (pr._skill && secInt[pr._skill]) psc.push({ ProductsId: pr.ProductsId, SecondaryConstraints: secInt[pr._skill], ConstraintUsage: 1, ConstraintQuantity: 1 }); });
  T("ProductsSecondaryConstraints", ["ProductsId", "SecondaryConstraints", "ConstraintUsage", "ConstraintQuantity"], psc);

  // ProductBillOfMaterials
  const bom = []; let bid = 0;
  e.bom.forEach((b) => { bid++; bom.push({ ProductBillOfMaterialsId: bid, PartNo: famFirstPid[b.family_id] || 0, OpNo: 1, RequiredPartNo: b.component_ref, RequiredQuantity: b.qty_per, MultiplyByOrderQuantity: 1 }); });
  T("ProductBillOfMaterials", ["ProductBillOfMaterialsId", "PartNo", "OpNo", "RequiredPartNo", "RequiredQuantity", "MultiplyByOrderQuantity"], bom);

  // PurchasedItems
  T("PurchasedItems", ["PurchasedItemsId", "PartNo", "Description", "LeadTime", "MinimumReorderQuantity", "ReorderMultiple"],
    e.materials.map((m, i) => ({ PurchasedItemsId: i + 1, PartNo: m.material_id, Description: m.name, LeadTime: m.lead_time_days, MinimumReorderQuantity: 100, ReorderMultiple: 50 })));

  // Attribute1 dimension + ChangeoverGroups + changeover matrix (parked attribute layer)
  const attr1 = [];
  for (let i = 1; i <= p.changeoverAttrValues; i++) attr1.push({ Attribute1Id: i, Name: `Attribute Value ${pad(i, 2)}`, Rank: i });
  T("Attribute1", ["Attribute1Id", "Name", "Rank"], attr1);
  T("ChangeoverGroups", ["ChangeoverGroupsId", "Name", "Attribute1ChangeoverTime"], [{ ChangeoverGroupsId: 1, Name: "Default changeover", Attribute1ChangeoverTime: 1 }]);
  const com = [];
  for (let x = 1; x <= p.changeoverAttrValues; x++) for (let y = 1; y <= p.changeoverAttrValues; y++) com.push({ ChangeoverGroupsId: 1, XAxisAttribute1: x, YAxisAttribute1: y, Attribute1ChangeoverMatrix: x === y ? 0 : ((x * 7 + y * 13) % 5 + 1) * 10 });
  T("ChangeoverGroupsAttribute1ChangeoverMatrix", ["ChangeoverGroupsId", "XAxisAttribute1", "YAxisAttribute1", "Attribute1ChangeoverMatrix"], com);

  // PrimaryResourceTemplates + Periods (the calendar / shift pattern)
  T("PrimaryResourceTemplates", ["Name", "ReferenceDate", "Length"], [{ Name: "Standard week", ReferenceDate: "2026-01-05", Length: 7 * 1440 }]);
  const periods = [];
  const dayWindows = p.shiftsPerDay >= 3 ? [[0, 1440]] : p.shiftsPerDay === 2 ? [[360, 960]] : [[360, 480]];
  for (let d = 0; d < 7; d++) {
    const weekday = d < 5;
    dayWindows.forEach((w) => periods.push({ Template: "Standard week", StartOffset: d * 1440 + w[0], Length: w[1], Efficiency: 1, CostFactor: 1, State: weekday ? 1 : 0 }));
  }
  T("PrimaryResourceTemplatePeriods", ["Template", "StartOffset", "Length", "Efficiency", "CostFactor", "State"], periods);

  // Demand (the input the scheduler turns into Orders), per part (family)
  const demand = []; let did = 0;
  e.families.forEach((f) => {
    for (let per = 0; per < p.periods; per++) for (let o = 0; o < p.ordersPerPartPeriod; o++) {
      did++;
      demand.push({ DemandId: did, OrderNo: `D-${pad(did, 7)}`, PartNo: f.family_id, Quantity: randInt(rng, 50, 5000), DemandDate: dstr(per * 7 + randInt(rng, 0, 6)), Priority: randInt(rng, 1, 5), Description: f.name });
    }
  });
  T("Demand", ["DemandId", "OrderNo", "PartNo", "Quantity", "DemandDate", "Priority", "Description"], demand);

  return out;
}

// ── Estimators ───────────────────────────────────────────────────────
function estimateDataset(over = {}) {
  const p = datasetParams(over);
  const bins = p.plants * p.locsPerPlant * p.binsPerLoc;
  const R = p.plants * p.resTypes.length * p.resInst;
  const cals = p.plants * 2, K = p.skills.length;
  return [
    ["org_hierarchy", 1 + p.plants + p.plants * p.locsPerPlant + bins],
    ["departments", p.plants * p.deptTypes.length * p.deptInst],
    ["resources", R],
    ["calendars", cals],
    ["shifts", cals * p.shiftsPerDay],
    ["skills", K],
    ["qualification_matrix", K * Math.min(p.resTypes.length, 3)],
    ["tanks", p.tanks],
    ["families", p.families],
    ["tank_eligibility", p.tanks * Math.min(p.families, 20)],
    ["materials", p.materials],
    ["bom_templates", p.families * p.bomLinesPerFamily],
    ["routing_templates", p.families * p.opsPerRouting],
    ["resource_availability", R * p.horizonDays * p.shiftsPerDay],
    ["skill_availability", K * p.horizonDays * p.shiftsPerDay],
    ["tank_availability", p.tanks * p.horizonDays],
    ["skus", p.skus],
    ["demand_orders", Math.round(p.skus * p.periods * p.ordersPerSkuPeriod)],
  ];
}
function estimateFor(format) {
  const p = datasetParams();
  if (format === "opcenter") return buildOpcenter(p, makeRng(p.seed)).map((t) => [t.name, t.rows.length]);
  return estimateDataset();
}

function datasetManifest(p, tables, format) {
  return {
    product: "ImplementationOS representative dataset",
    format,
    generatedAt: new Date().toISOString(),
    seed: p.seed,
    parked: { families: p.families, skus: p.skus, note: "Item attributes / SKU cartesian and changeover matrices are stubbed." },
    parameters: p,
    tables: tables.map((t) => ({ name: t.name, columns: t.columns, rows: t.rows.length })),
  };
}

// ── CSV + store-only ZIP (no dependency) ─────────────────────────────
function tableToCsv(table) {
  const esc = (v) => { if (v == null) return ""; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  let body = table.columns.join(",") + "\n";
  for (const r of table.rows) body += table.columns.map((c) => esc(r[c])).join(",") + "\n";
  return body;
}

let CRC_TABLE;
function crc32(buf) {
  if (!CRC_TABLE) { CRC_TABLE = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function u16(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
function u32(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]); }
function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = []; const central = []; let offset = 0;
  const push = (u) => { chunks.push(u); offset += u.length; };
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data), localOffset = offset;
    push(u32(0x04034b50)); push(u16(20)); push(u16(0)); push(u16(0)); push(u16(0)); push(u16(0));
    push(u32(crc)); push(u32(data.length)); push(u32(data.length)); push(u16(name.length)); push(u16(0));
    push(name); push(data);
    central.push({ name, crc, size: data.length, localOffset });
  }
  const cdStart = offset;
  for (const c of central) {
    push(u32(0x02014b50)); push(u16(20)); push(u16(20)); push(u16(0)); push(u16(0)); push(u16(0)); push(u16(0));
    push(u32(c.crc)); push(u32(c.size)); push(u32(c.size)); push(u16(c.name.length));
    push(u16(0)); push(u16(0)); push(u16(0)); push(u16(0)); push(u32(0)); push(u32(c.localOffset));
    push(c.name);
  }
  const cdSize = offset - cdStart;
  push(u32(0x06054b50)); push(u16(0)); push(u16(0)); push(u16(central.length)); push(u16(central.length));
  push(u32(cdSize)); push(u32(cdStart)); push(u16(0));
  return new Blob(chunks, { type: "application/zip" });
}

// ── Public: build the chosen format and trigger a local download ─────
function generateDataset(format = "generic") {
  const p = datasetParams();
  const rng = makeRng(p.seed);
  const tables = format === "opcenter" ? buildOpcenter(p, rng) : buildDataset(p, rng);
  const enc = new TextEncoder();
  const files = tables.map((t) => ({ name: `${t.name}.csv`, data: enc.encode(tableToCsv(t)) }));
  files.push({ name: "manifest.json", data: enc.encode(JSON.stringify(datasetManifest(p, tables, format), null, 2)) });
  const blob = zipStore(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = format === "opcenter" ? "implementationos-opcenter-aps.zip" : "implementationos-dataset.zip";
  a.click();
  URL.revokeObjectURL(url);
  return tables.reduce((s, t) => s + t.rows.length, 0);
}
