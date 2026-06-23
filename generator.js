// ImplementationOS — representative mock-ERP dataset generator.
//
// Pure and deterministic (seeded). Produces a relational set of CSV tables
// that mirror how a real ERP stores the configured model: structure once
// (per family / resource / calendar), expand over time (capacity), transact
// per SKU (orders).
//
// Item attributes / the SKU cartesian and the changeover matrices are PARKED:
// they enter only as two stub counts — `families` (F) and `skus` (S). Every
// other table is small master data or linear in horizon / SKUs, so the
// structural + capacity model stays flat regardless of how big F and S get.
//
// Depends (at runtime) on data.js, state.js, and derive.js's `profile()` /
// `calendarProfile()`.

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
    ...over,
  };
}

// ── Estimator: per-table row counts without building rows ────────────
function estimateDataset(over = {}) {
  const p = datasetParams(over);
  const bins = p.plants * p.locsPerPlant * p.binsPerLoc;
  const R = p.plants * p.resTypes.length * p.resInst;
  const cals = p.plants * 2;
  const K = p.skills.length;
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

// ── Builder: tables in dependency order, FKs are generated id strings ─
function buildDataset(p, rng) {
  const out = [];
  const T = (name, columns, rows) => { out.push({ name, columns, rows }); return rows; };
  const windows = p.shiftsPerDay >= 3 ? [["Night", "22:00", "06:00"], ["Day", "06:00", "14:00"], ["Late", "14:00", "22:00"]]
    : p.shiftsPerDay === 2 ? [["Day", "06:00", "14:00"], ["Late", "14:00", "22:00"]]
      : [["Day", "06:00", "14:00"]];
  const epoch = Date.UTC(2026, 0, 1);
  const dateAt = (day) => new Date(epoch + day * 86400000).toISOString().slice(0, 10);
  const isWeekend = (day) => { const d = new Date(epoch + day * 86400000).getUTCDay(); return d === 0 || d === 6; };

  // org_hierarchy
  const plants = [];
  {
    const rows = [];
    const root = { node_id: "ORG-001", level: profile().hierarchy[0], code: "ORG", name: `${profile().hierarchy[0]} 01`, parent_id: "" };
    rows.push(root);
    for (let pi = 1; pi <= p.plants; pi++) {
      const plant = { node_id: `PLNT-${pad(pi)}`, level: profile().facility, code: `P${pi}`, name: `${profile().facility} ${pad(pi)}`, parent_id: root.node_id };
      plants.push(plant); rows.push(plant);
      for (let li = 1; li <= p.locsPerPlant; li++) {
        const loc = { node_id: `LOC-${pad(pi)}${pad(li)}`, level: profile().storage, code: `L${pi}-${li}`, name: `${profile().storage} ${pi}-${li}`, parent_id: plant.node_id };
        rows.push(loc);
        for (let bi = 1; bi <= p.binsPerLoc; bi++) rows.push({ node_id: `BIN-${pad(pi)}${pad(li)}${pad(bi)}`, level: profile().bin, code: `B${pi}-${li}-${bi}`, name: `${profile().bin} ${pi}-${li}-${bi}`, parent_id: loc.node_id });
      }
    }
    T("org_hierarchy", ["node_id", "level", "code", "name", "parent_id"], rows);
  }

  // departments
  const depts = [];
  {
    let n = 0;
    for (const plant of plants) for (const dt of p.deptTypes) for (let k = 0; k < p.deptInst; k++) {
      const meta = departmentTaxonomy.find((d) => d.id === dt) || { name: dt };
      depts.push({ dept_id: `DEPT-${pad(++n)}`, plant_id: plant.node_id, semantic_type: dt, name: `${meta.name} ${pad(k + 1)}` });
    }
    T("departments", ["dept_id", "plant_id", "semantic_type", "name"], depts);
  }

  // resources
  const resources = [];
  {
    let n = 0;
    plants.forEach((plant, pIdx) => {
      for (const rt of p.resTypes) for (let k = 0; k < p.resInst; k++) {
        const meta = resourceTaxonomy.find((r) => r.id === rt) || { name: rt, department: null };
        const dept = depts.find((d) => d.plant_id === plant.node_id && d.semantic_type === meta.department) || depts.find((d) => d.plant_id === plant.node_id) || depts[0];
        resources.push({ resource_id: `RES-${pad(++n)}`, dept_id: dept ? dept.dept_id : "", resource_type: rt, name: `${meta.name} ${pad(k + 1)}`, capacity_units: randInt(rng, 1, 4), efficiency: +(0.8 + rng() * 0.2).toFixed(2), calendar_id: `CALR-${pad(pIdx + 1)}` });
      }
    });
    T("resources", ["resource_id", "dept_id", "resource_type", "name", "capacity_units", "efficiency", "calendar_id"], resources);
  }

  // calendars
  const calendars = [];
  {
    plants.forEach((plant, i) => {
      calendars.push({ calendar_id: `CAL-${pad(i + 1)}`, type: "base", parent_id: "", description: `${calendarProfile().base} — ${plant.name}` });
      calendars.push({ calendar_id: `CALR-${pad(i + 1)}`, type: "resource", parent_id: `CAL-${pad(i + 1)}`, description: `${calendarProfile().resource} — ${plant.name}` });
    });
    T("calendars", ["calendar_id", "type", "parent_id", "description"], calendars);
  }

  // shifts
  {
    const rows = []; let n = 0;
    for (const c of calendars) for (const w of windows) rows.push({ shift_id: `SHF-${pad(++n)}`, calendar_id: c.calendar_id, name: w[0], start_time: w[1], end_time: w[2], days_of_week: "Mon-Fri" });
    T("shifts", ["shift_id", "calendar_id", "name", "start_time", "end_time", "days_of_week"], rows);
  }

  // skills (secondary resources)
  const skills = [];
  p.skills.forEach((s, i) => skills.push({ skill_id: `SKL-${pad(i + 1)}`, name: s.name, headcount: s.headcount, calendar_id: "CALR-001" }));
  T("skills", ["skill_id", "name", "headcount", "calendar_id"], skills);

  // qualification_matrix
  {
    const rows = [];
    const elig = p.resTypes.slice(0, Math.min(p.resTypes.length, 3));
    skills.forEach((s) => elig.forEach((rt, j) => rows.push({ skill_id: s.skill_id, resource_type: rt, level: j === 0 ? "primary" : "backup" })));
    T("qualification_matrix", ["skill_id", "resource_type", "level"], rows);
  }

  // tanks
  const tanks = [];
  {
    const prodDept = depts.find((d) => d.semantic_type === "production") || depts[0];
    for (let i = 1; i <= p.tanks; i++) tanks.push({ tank_id: `TNK-${pad(i)}`, dept_id: prodDept ? prodDept.dept_id : "", capacity: 1000 * randInt(rng, 5, 40), min_heel: +(0.05 + rng() * 0.1).toFixed(2), eligibility_group: `G${1 + (i % 3)}`, connected_to: i > 1 && rng() < 0.4 ? `TNK-${pad(i - 1)}` : "" });
    T("tanks", ["tank_id", "dept_id", "capacity", "min_heel", "eligibility_group", "connected_to"], tanks);
  }

  // families (parked stub)
  const families = [];
  for (let i = 1; i <= p.families; i++) families.push({ family_id: `FAM-${pad(i, 4)}`, name: `Family ${pad(i, 4)}` });
  T("families", ["family_id", "name"], families);

  // tank_eligibility
  {
    const rows = [];
    const fam = families.slice(0, Math.min(families.length, 20));
    tanks.forEach((t) => fam.forEach((f) => rows.push({ tank_id: t.tank_id, family_id: f.family_id, allowed: true })));
    T("tank_eligibility", ["tank_id", "family_id", "allowed"], rows);
  }

  // materials
  const materials = [];
  {
    const supplyIds = Object.keys(supplyProfileCatalog);
    for (let i = 1; i <= p.materials; i++) {
      const st = supplyIds[i % supplyIds.length];
      const cat = supplyProfileCatalog[st];
      materials.push({ material_id: `MAT-${pad(i, 5)}`, name: `${cat.name.split(" ").slice(0, 2).join(" ")} ${pad(i, 5)}`, supply_type: st, policy: cat.recommended, lead_time_days: randInt(rng, 2, 90), source: pick(rng, ["PO", "transfer", "stock"]), shelf_life_days: st === "cold-chain" ? randInt(rng, 5, 90) : "" });
    }
    T("materials", ["material_id", "name", "supply_type", "policy", "lead_time_days", "source", "shelf_life_days"], materials);
  }

  // bom_templates (per family)
  {
    const rows = []; let n = 0;
    for (const f of families) for (let l = 0; l < p.bomLinesPerFamily; l++) {
      rows.push({ bom_line_id: `BOM-${pad(++n, 7)}`, family_id: f.family_id, level: l < 2 ? 1 : 2, component_ref: materials[n % materials.length].material_id, qty_per: +(0.1 + rng() * 5).toFixed(2), uom: pick(rng, ["EA", "KG", "L"]) });
    }
    T("bom_templates", ["bom_line_id", "family_id", "level", "component_ref", "qty_per", "uom"], rows);
  }

  // routing_templates (per family); setup_group references the parked changeover matrix
  {
    const rows = []; let n = 0;
    for (const f of families) for (let o = 1; o <= p.opsPerRouting; o++) {
      rows.push({ routing_op_id: `RTG-${pad(++n, 7)}`, family_id: f.family_id, op_seq: o, resource_type: p.resTypes[(o - 1) % p.resTypes.length], run_time_per_unit: +(0.2 + rng() * 3).toFixed(2), setup_group: `SG-${1 + (o % 5)}`, skill_required: rng() < 0.3 ? skills[randInt(rng, 0, skills.length - 1)].skill_id : "" });
    }
    T("routing_templates", ["routing_op_id", "family_id", "op_seq", "resource_type", "run_time_per_unit", "setup_group", "skill_required"], rows);
  }

  // resource_availability (time-expanded)
  {
    const rows = [];
    for (const r of resources) for (let day = 0; day < p.horizonDays; day++) {
      const weekend = isWeekend(day), date = dateAt(day);
      for (const w of windows) {
        const status = weekend ? "holiday" : (rng() < 0.02 ? "maintenance" : "working");
        rows.push({ resource_id: r.resource_id, date, shift_id: `${r.calendar_id}-${w[0]}`, available_units: status === "working" ? r.capacity_units : 0, efficiency: r.efficiency, status });
      }
    }
    T("resource_availability", ["resource_id", "date", "shift_id", "available_units", "efficiency", "status"], rows);
  }

  // skill_availability (time-expanded; reduced by absence)
  {
    const rows = [];
    for (const s of skills) for (let day = 0; day < p.horizonDays; day++) {
      const weekend = isWeekend(day), date = dateAt(day);
      for (const w of windows) rows.push({ skill_id: s.skill_id, date, shift_id: w[0], headcount: weekend ? 0 : Math.max(0, s.headcount - (rng() < 0.05 ? 1 : 0)) });
    }
    T("skill_availability", ["skill_id", "date", "shift_id", "headcount"], rows);
  }

  // tank_availability (time-expanded)
  {
    const rows = [];
    for (const t of tanks) for (let day = 0; day < p.horizonDays; day++) rows.push({ tank_id: t.tank_id, date: dateAt(day), status: pick(rng, ["filling", "holding", "draining", "cleaning", "empty"]), current_material: rng() < 0.7 ? families[randInt(rng, 0, families.length - 1)].family_id : "" });
    T("tank_availability", ["tank_id", "date", "status", "current_material"], rows);
  }

  // skus (parked stub: id + family only; attribute columns added later)
  {
    const rows = [];
    for (let i = 1; i <= p.skus; i++) rows.push({ sku_id: `SKU-${pad(i, 7)}`, family_id: families[i % families.length].family_id, name: `SKU ${pad(i, 7)}` });
    T("skus", ["sku_id", "family_id", "name"], rows);
  }

  // demand_orders (transactional, linear in SKUs)
  {
    const rows = []; let n = 0;
    const total = Math.round(p.skus * p.periods * p.ordersPerSkuPeriod);
    for (let k = 0; k < total; k++) {
      rows.push({ order_id: `ORD-${pad(++n, 8)}`, sku_id: `SKU-${pad((k % p.skus) + 1, 7)}`, qty: randInt(rng, 10, 5000), due_date: dateAt(randInt(rng, 1, p.horizonDays)), customer_id: `CUST-${pad(randInt(rng, 1, 40))}`, priority: pick(rng, ["low", "normal", "high", "rush"]) });
    }
    T("demand_orders", ["order_id", "sku_id", "qty", "due_date", "customer_id", "priority"], rows);
  }

  return out;
}

function datasetManifest(p, tables) {
  return {
    product: "ImplementationOS representative dataset",
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
  const head = table.columns.join(",");
  let body = "";
  for (const r of table.rows) body += table.columns.map((c) => esc(r[c])).join(",") + "\n";
  return head + "\n" + body;
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
    const name = enc.encode(f.name);
    const data = f.data;
    const crc = crc32(data);
    const localOffset = offset;
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

// ── Public: build everything and trigger a local download ────────────
function generateDataset(over = {}) {
  const p = datasetParams(over);
  const rng = makeRng(p.seed);
  const tables = buildDataset(p, rng);
  const enc = new TextEncoder();
  const files = tables.map((t) => ({ name: `${t.name}.csv`, data: enc.encode(tableToCsv(t)) }));
  files.push({ name: "manifest.json", data: enc.encode(JSON.stringify(datasetManifest(p, tables), null, 2)) });
  const blob = zipStore(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "implementationos-dataset.zip";
  a.click();
  URL.revokeObjectURL(url);
  return tables.reduce((s, t) => s + t.rows.length, 0);
}
