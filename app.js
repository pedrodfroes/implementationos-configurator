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

const archetypeIcons = {
  "batch-campaign": "flask-conical",
  "continuous-process": "waves",
  "discrete-assembly": "boxes",
  "cto-eto": "pencil-ruler",
  "job-shop": "shuffle",
  "flow-shop": "workflow",
  "packaging-postponement": "package-open",
  "perishable-food": "apple",
  "maturation-aging": "hourglass",
  "semiconductor-fab": "microchip",
  "mining-primary": "mountain",
  "distribution-logistics": "truck",
  "field-service": "users",
  "maintenance-turnaround": "wrench",
  "construction-project": "hard-hat",
  "healthcare-capacity": "hospital",
};

const industries = [
  { id: "food-beverage", name: "Food & Beverage", group: "Consumer process", icon: "utensils", focus: "Shelf life, allergens, recipes, yield, sanitation", compliance: "Food safety · lot traceability · labeling" },
  { id: "pharma", name: "Pharmaceuticals & Biotech", group: "Life sciences", icon: "pill", focus: "GMP batches, potency, genealogy, cleaning, QA release", compliance: "GxP · electronic records · validated processes" },
  { id: "medical-devices", name: "Medical Devices", group: "Life sciences", icon: "stethoscope", focus: "Device history, UDI, controlled assembly, sterilization", compliance: "QMS · traceability · regulated change control" },
  { id: "chemicals", name: "Chemicals, Plastics & Polymers", group: "Process industries", icon: "flask-conical", focus: "Formulas, tanks, campaigns, co-products, hazardous materials", compliance: "SDS · process safety · environmental controls" },
  { id: "metals-mining", name: "Metals & Heavy Industry", group: "Primary industries", icon: "mountain", focus: "Blending, grades, campaign assets, energy, extraction", compliance: "Assay · chain of custody · environmental constraints" },
  { id: "building-materials", name: "Building Materials", group: "Process industries", icon: "brick-wall", focus: "Kilns, campaigns, bulk logistics, energy-intensive assets", compliance: "Quality certificates · emissions · batch traceability" },
  { id: "automotive", name: "Automotive & Mobility", group: "Discrete manufacturing", icon: "car", focus: "Sequenced supply, variants, line balance, supplier constraints", compliance: "PPAP · serial genealogy · quality gates" },
  { id: "aerospace", name: "Aerospace & Defense", group: "Regulated discrete", icon: "plane", focus: "Effectivity, serialized parts, scarce skills, project networks", compliance: "Airworthiness · full traceability · controlled data" },
  { id: "electronics", name: "Electronics & High-Tech", group: "High-tech", icon: "microchip", focus: "Reentrant flows, yield, alternates, cleanroom tools", compliance: "Material genealogy · process control · export rules" },
  { id: "packaging", name: "Packaging", group: "Conversion & packing", icon: "package", focus: "High-SKU conversion, printing, filling, packing, and changeovers", compliance: "Label control · market variants · traceability" },
  { id: "consumer-goods", name: "Paper, Textile & Consumer Goods", group: "Consumer products", icon: "shirt", focus: "Materials, variants, seasonal demand, finishing, and packing", compliance: "Product safety · labeling · source traceability" },
  { id: "industrial", name: "Industrial Equipment", group: "Discrete manufacturing", icon: "cog", focus: "BOM depth, engineer-to-order, skills, tools, long lead parts", compliance: "Configuration control · inspection evidence" },
  { id: "energy-services", name: "Energy, Utilities & Industrial Services", group: "Asset intensive", icon: "zap", focus: "Continuous assets, maintenance windows, utilities, and field constraints", compliance: "Process safety · asset integrity · environmental controls" },
  { id: "operations-services", name: "MRO & Resource-Constrained Services", group: "Beyond manufacturing", icon: "wrench", focus: "Finite skills, bays, tools, sequence constraints, and due dates", compliance: "Work evidence · safety · service traceability" },
];

const industrySpecialties = {
  "food-beverage": ["General food & beverage", "Spirits / distilleries", "Breweries", "Wine", "Juice", "Soft drinks", "Bottled water", "Dairy", "Cheese", "Yogurt", "Ice cream", "Meat processing", "Poultry", "Seafood", "Bakery", "Biscuits / cookies", "Chocolate", "Confectionery", "Sugar refining", "Coffee roasting", "Tea blending", "Frozen foods", "Ready meals", "Sauces / condiments", "Canned foods", "Snacks / chips", "Cereals", "Infant nutrition", "Pet food", "Nutraceutical foods"],
  pharma: ["General pharmaceuticals & biotech", "Injectables", "Sterile fill-finish", "Vaccines", "Biologics", "Cell and gene therapy", "API", "OSD tablets", "Capsules", "Softgels", "Creams / ointments", "Liquids / syrups", "Inhalers", "Medical cannabis", "Contract manufacturing (CDMO / CMO)", "Packaging and serialization", "Laboratory reagent production", "Blood products / plasma fractionation"],
  "medical-devices": ["General medical devices", "Sterile disposable devices", "Diagnostic devices", "Implants", "Surgical instruments", "Combination products", "Medical electronics", "Contract device manufacturing"],
  chemicals: ["Specialty chemicals", "Commodity chemicals", "Paints and coatings", "Adhesives", "Resins", "Solvents", "Fertilizers", "Agrochemicals / pesticides", "Industrial gases", "Lubricants", "Detergents", "Cosmetics", "Fragrances", "Personal care", "Cleaning products", "Battery chemicals", "Pulp chemicals", "Water treatment chemicals", "Plastic extrusion", "Plastic injection molding", "Plastic rotomolding", "Blow molding", "Thermoforming", "Film extrusion", "Pipe extrusion", "Rubber molding", "Tires", "Hoses", "Seals and gaskets", "Foam products", "Composite materials", "Packaging plastics", "Recycled plastics processing"],
  "metals-mining": ["Steelworks", "Mini-mills", "Foundries", "Forging", "Rolling mills", "Aluminum smelting", "Aluminum extrusion", "Copper processing", "Wire and cable", "Metal stamping", "Machining", "Heat treatment", "Surface treatment", "Galvanizing", "Powder metallurgy", "Toolmaking", "Industrial castings", "Mining / primary extraction"],
  "building-materials": ["Cement", "Concrete", "Precast concrete", "Aggregates", "Asphalt", "Bricks", "Ceramics", "Tiles", "Glass", "Insulation materials", "Drywall / gypsum board", "Roofing materials", "Pipes and fittings", "Wood panels", "Flooring"],
  automotive: ["Automotive assembly", "Powertrain", "EV batteries", "Battery packs", "Tires", "Seats", "Wiring harnesses", "Stamping", "Paint shops", "Injection-molded components", "Glass components", "Brakes", "Suspension", "Electronics modules", "Aftermarket parts", "Rail components", "Shipbuilding", "Heavy vehicles", "Agricultural machinery"],
  aerospace: ["Aerospace components", "Aircraft assembly", "Engines and propulsion", "Avionics", "Space systems", "Defense manufacturing"],
  electronics: ["Semiconductors", "PCB assembly", "Consumer electronics", "Industrial electronics", "Telecom equipment", "Sensors", "Batteries", "Solar panels", "LED manufacturing", "Data center hardware", "Medical electronics", "Appliances", "Cable assemblies"],
  packaging: ["Bottling", "Canning", "Cartoning", "Labels", "Flexible packaging", "Corrugated packaging", "Glass bottles", "Aluminum cans", "Plastic bottles", "Closures / caps", "Blister packaging", "Pharmaceutical packaging", "Food packaging", "Palletizing operations"],
  "consumer-goods": ["Paper mills", "Tissue products", "Printing", "Publishing / commercial print", "Textile weaving", "Textile dyeing", "Apparel manufacturing", "Footwear", "Furniture", "Mattresses", "Stationery / writing instruments", "Household goods", "Toys", "Sporting goods", "Luxury goods", "Jewelry manufacturing", "Eyewear"],
  industrial: ["General industrial equipment", "Power equipment manufacturing", "Wind turbine components", "Solar equipment manufacturing", "Nuclear component manufacturing", "Large capital equipment assembly", "Engineering workshops", "Tool rooms"],
  "energy-services": ["Oil refining", "Petrochemicals", "LNG operations", "Biofuels", "Hydrogen production", "Waste processing", "Recycling plants", "Water treatment operations", "Industrial maintenance shutdowns"],
  "operations-services": ["MRO / maintenance repair overhaul", "Aircraft maintenance", "Rail maintenance", "Fleet workshops", "Ship repair", "Industrial maintenance", "Construction prefabrication", "Hospital operating rooms", "Lab scheduling", "Warehouse value-added services", "Distribution center labor planning"],
};

const industryArchetypeCompatibility = {
  pharma: ["batch-campaign", "continuous-process", "discrete-assembly", "flow-shop", "packaging-postponement", "maturation-aging"],
  "medical-devices": ["discrete-assembly", "cto-eto", "job-shop", "flow-shop", "packaging-postponement"],
  "food-beverage": ["batch-campaign", "continuous-process", "flow-shop", "packaging-postponement", "perishable-food", "maturation-aging"],
  chemicals: ["batch-campaign", "continuous-process", "discrete-assembly", "flow-shop", "packaging-postponement", "maturation-aging"],
  packaging: ["batch-campaign", "continuous-process", "discrete-assembly", "flow-shop", "packaging-postponement"],
  "consumer-goods": ["batch-campaign", "continuous-process", "discrete-assembly", "job-shop", "flow-shop", "packaging-postponement", "perishable-food"],
  automotive: ["discrete-assembly", "cto-eto", "job-shop", "flow-shop"],
  industrial: ["discrete-assembly", "cto-eto", "job-shop", "flow-shop", "maintenance-turnaround"],
  electronics: ["discrete-assembly", "cto-eto", "job-shop", "flow-shop", "semiconductor-fab"],
  aerospace: ["discrete-assembly", "cto-eto", "job-shop", "maintenance-turnaround"],
  "metals-mining": ["batch-campaign", "continuous-process", "discrete-assembly", "job-shop", "flow-shop", "mining-primary"],
  "building-materials": ["batch-campaign", "continuous-process", "flow-shop", "maturation-aging"],
  "energy-services": ["batch-campaign", "continuous-process", "flow-shop", "maintenance-turnaround"],
  "operations-services": ["cto-eto", "job-shop", "maintenance-turnaround", "construction-project", "healthcare-capacity", "field-service"],
};

const supplyProfileCatalog = {
  "natural-feedstock": { name: "Natural / source-bound feedstock", icon: "trees", note: "Wood, fibers, agricultural inputs, minerals, or other supply that cannot be created through expediting.", drivers: ["Long lead time", "Source capacity", "Variable quality"], recommended: "hard" },
  "qualified-material": { name: "Qualified active or regulated material", icon: "badge-check", note: "Approved sources, specifications, release status, and substitution rules limit availability.", drivers: ["Qualified source", "QA release", "No easy substitute"], recommended: "hard" },
  "cold-chain": { name: "Shelf-life / cold-chain material", icon: "snowflake", note: "Expiry, remaining shelf life, temperature state, and storage slots determine usable supply.", drivers: ["Shelf life", "Cold storage", "Lot eligibility"], recommended: "hard" },
  "long-lead-component": { name: "Allocated or long-lead component", icon: "cpu", note: "Semiconductors, bespoke parts, tooling, or imported components with constrained supplier capacity.", drivers: ["Long lead time", "Allocation", "Supplier capacity"], recommended: "hard" },
  "bulk-feedstock": { name: "Bulk / tank-constrained feedstock", icon: "cylinder", note: "Usable supply depends on tank, silo, yard, or warehouse capacity as well as inbound timing.", drivers: ["Storage capacity", "Inbound windows", "Minimum lots"], recommended: "watch" },
  "interplant-transfer": { name: "Interplant or network transfer", icon: "arrow-left-right", note: "Stock exists elsewhere, but transfer orders, lanes, transit time, and receiving capacity determine feasibility.", drivers: ["Transfer orders", "Transit time", "Lane capacity"], recommended: "hard" },
  "primary-packaging": { name: "Product-contact / primary packaging", icon: "package-check", note: "Packaging may be specification-bound, serialized, validated, or required for product release.", drivers: ["Specification", "Artwork / serialization", "Line compatibility"], recommended: "watch" },
  "standard-packaging": { name: "Standard packaging and consumables", icon: "package-open", note: "Common cartons, labels, pallets, and consumables with credible expediting or substitution options.", drivers: ["Short lead time", "Expedite possible", "Substitutable"], recommended: "soft" },
};

const industrySupplyProfiles = {
  "food-beverage": ["natural-feedstock", "cold-chain", "bulk-feedstock", "primary-packaging", "standard-packaging"],
  pharma: ["qualified-material", "cold-chain", "interplant-transfer", "primary-packaging", "standard-packaging"],
  "medical-devices": ["qualified-material", "long-lead-component", "interplant-transfer", "primary-packaging", "standard-packaging"],
  chemicals: ["natural-feedstock", "qualified-material", "bulk-feedstock", "interplant-transfer", "standard-packaging"],
  "metals-mining": ["natural-feedstock", "long-lead-component", "bulk-feedstock", "interplant-transfer"],
  "building-materials": ["natural-feedstock", "bulk-feedstock", "interplant-transfer", "standard-packaging"],
  automotive: ["long-lead-component", "interplant-transfer", "primary-packaging", "standard-packaging"],
  aerospace: ["qualified-material", "long-lead-component", "interplant-transfer"],
  electronics: ["qualified-material", "long-lead-component", "interplant-transfer", "standard-packaging"],
  packaging: ["natural-feedstock", "bulk-feedstock", "interplant-transfer", "standard-packaging"],
  "consumer-goods": ["natural-feedstock", "long-lead-component", "interplant-transfer", "standard-packaging"],
  industrial: ["long-lead-component", "interplant-transfer", "standard-packaging"],
  "energy-services": ["natural-feedstock", "qualified-material", "bulk-feedstock", "interplant-transfer"],
  "operations-services": ["qualified-material", "long-lead-component", "interplant-transfer", "standard-packaging"],
};

const volumeStorageBehaviors = [
  { id: "dynamic-hold", icon: "pause", name: "Independent inflow, hold, and outflow", note: "Storage duration is schedule-dependent; feeding and consuming operations have independent timing and rates." },
  { id: "single-material", icon: "circle-dot", name: "Single-material occupancy", note: "Any occupied volume can reserve the whole vessel against other materials or batches until empty and released." },
  { id: "buffer", icon: "waves", name: "Buffer behavior", note: "Minimum fill, maximum heel, multiple inflows/outflows, and unequal rates protect upstream or downstream throughput." },
  { id: "pipe-network", icon: "git-fork", name: "Pipe and transfer topology", note: "Physical connections, shared-line capacity, simultaneous occupation, flow rates, and product compatibility constrain routing." },
  { id: "attribute-cleaning", icon: "sparkles", name: "Attribute-driven cleaning", note: "Cleaning depends on sequence attributes such as allergen, color, quality, brand, or lot rather than an unmaintainable SKU matrix." },
  { id: "size-batch", icon: "maximize-2", name: "Tank size and dynamic batch sizing", note: "Different capacities, formula scaling, due dates, and future demand determine vessel choice and whether batches split." },
  { id: "eligibility", icon: "list-checks", name: "Tank eligibility and auxiliary resources", note: "Products use overlapping tank groups and may also require stirrers, tools, CIP sets, operators, or QA standing time." },
  { id: "state-change", icon: "refresh-cw", name: "Material state transformation", note: "Fermentation, maturation, incubation, assay, or QA release can change identity, quantity, status, and earliest outflow." },
];

const departmentTaxonomy = [
  { id: "production", name: "Production / Processing", icon: "factory", note: "Core conversion, processing, or assembly activities" },
  { id: "packaging", name: "Packaging / Finishing", icon: "package-check", note: "Packing, labeling, finishing, and late-stage differentiation" },
  { id: "quality", name: "Quality / Laboratory", icon: "microscope", note: "Testing, sampling, inspection, and release capacity" },
  { id: "warehouse", name: "Warehouse / Intralogistics", icon: "warehouse", note: "Storage, staging, dispensing, picking, and internal movement" },
  { id: "maintenance", name: "Maintenance / Reliability", icon: "wrench", note: "Planned maintenance, repair, calibration, and reliability work" },
  { id: "utilities", name: "Utilities / Site Services", icon: "zap", note: "Shared utilities, clean media, energy, and environmental services" },
  { id: "planning", name: "Planning / Production Control", icon: "calendar-range", note: "Scheduling, release, coordination, and production control" },
  { id: "external", name: "External / Subcontracting", icon: "external-link", note: "Third-party processing, testing, or contract manufacturing" },
];

const resourceTaxonomy = [
  { id: "processing-equipment", name: "Processing equipment", icon: "cog", department: "production", note: "Machines, vessels, reactors, or processing units" },
  { id: "lines-cells", name: "Lines / cells", icon: "workflow", department: "packaging", note: "Packaging, assembly, filling, or production lines" },
  { id: "labor-crews", name: "Labor / crews", icon: "users", department: "production", note: "People, teams, skills, and shift-based capacity" },
  { id: "quality-capacity", name: "Quality / lab capacity", icon: "test-tube-2", department: "quality", note: "Benches, instruments, analysts, and release capacity" },
  { id: "tools-fixtures", name: "Tools / fixtures", icon: "hammer", department: "production", note: "Shared tooling, molds, dies, fixtures, and setup kits" },
  { id: "material-handling", name: "Storage / material handling", icon: "forklift", department: "warehouse", note: "Locations, tanks, staging lanes, and handling equipment" },
  { id: "utility-capacity", name: "Utility capacity", icon: "gauge", department: "utilities", note: "Power, steam, clean media, air, water, or environmental limits" },
  { id: "external-capacity", name: "External capacity", icon: "building-2", department: "external", note: "Suppliers, subcontractors, tollers, and external laboratories" },
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
  taxonomyMode: "representative",
  departmentTypes: [],
  resourceTypes: [],
  bom: {
    structure: null,
    features: [],
    featuresConfirmed: false,
    consumption: null,
    source: null,
  },
  supplies: { policies: {}, confirmed: false },
  volumeStorage: { present: null, behaviors: [], confirmed: false },
  execution: {
    source: null,
    levels: [],
    events: [],
    quantities: [],
    quantitiesConfirmed: false,
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
      if (!Array.isArray(saved.industryContexts) && saved.industry && saved.industrySpecialty) {
        state.industryContexts = [{ industry: saved.industry, specialty: saved.industrySpecialty }];
      }
      if (!("supplies" in saved) && Number(saved.max || 0) >= 11) {
        state.i = 11;
        state.max = Math.max(11, Number(state.max || 0) + 1);
      }
      if (!("volumeStorage" in saved) && Number(saved.max || 0) >= 10) {
        state.i = 10;
        state.max = Math.max(10, Number(state.max || 0) + 1);
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

// ── Derived helpers (graph is the source of truth) ───────────────────
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
function executionSourceLabel() {
  return { erp: `${profile().badge} confirmations`, mes: "MES execution events", hybrid: `Hybrid MES + ${profile().badge}` }[state.execution?.source] || "Not configured";
}
function selectedDepartmentTypes() { return departmentTaxonomy.filter((item) => state.departmentTypes?.includes(item.id)); }
function selectedResourceTypes() { return resourceTaxonomy.filter((item) => state.resourceTypes?.includes(item.id)); }
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
  if (selectedIndustryContexts().length) s += 6;
  if (state.departmentTypes?.length) s += 8;
  if (state.calendar?.layering && state.calendar?.pattern && state.calendar?.exceptions && state.calendar?.modifiersConfirmed) s += 8;
  if (state.constraint) s += 6;
  if (state.resourceTypes?.length) s += 10;
  if (state.volumeStorage?.present === false || state.volumeStorage?.confirmed) s += 6;
  if (state.bom?.structure && state.bom?.featuresConfirmed && state.bom?.consumption && state.bom?.source) s += 8;
  if (state.supplies?.confirmed) s += 6;
  if (state.execution?.source && state.execution?.levels?.length && state.execution?.events?.length && state.execution?.quantitiesConfirmed) s += 8;
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
    sub: () => `Select every operating pattern that materially shapes ${industryLabel() || "the selected industry"}. Incompatible patterns remain visible for context but cannot enter the model.`,
    hint: "Choose at least one archetype to continue.",
    gate: () => state.archetypes?.length > 0,
    body: () => {
      const synthesis = archetypeSynthesis();
      return `
      <div class="archetype-synthesis${synthesis.count ? " populated" : ""}">
        <i data-lucide="layers-3"></i>
        <div><strong>${escapeHtml(synthesis.title)}</strong><p>${escapeHtml(synthesis.detail)}</p></div>
        <span>${synthesis.count} selected</span>
      </div>
      <div class="pick-grid" aria-label="Manufacturing archetypes">
        ${planningArchetypes
          .map(
            (a) => `
          <button class="pick-card${state.archetypes.includes(a.id) ? " active" : ""}${isArchetypeCompatible(a.id) ? "" : " inactive"}" type="button"
            ${isArchetypeCompatible(a.id) ? `data-arch="${a.id}"` : "disabled"} data-mode="${a.mode}" aria-pressed="${state.archetypes.includes(a.id)}"
            title="${isArchetypeCompatible(a.id) ? `Supported by ${escapeHtml(compatibleContextLabels(a.id).join(", "))}` : `Not supported by the selected industry contexts`}">
            <span class="pick-head"><i data-lucide="${archetypeIcons[a.id]}"></i><span class="pick-mode">${escapeHtml(modeProfiles[a.mode].label)}</span></span>
            <strong>${escapeHtml(a.name)}</strong>
            <p>${escapeHtml(a.core)}</p>
          </button>`
          )
          .join("")}
      </div>
    `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-arch]").forEach((b) =>
        b.addEventListener("click", () => {
          const selected = new Set(state.archetypes);
          selected.has(b.dataset.arch) ? selected.delete(b.dataset.arch) : selected.add(b.dataset.arch);
          state.archetypes = [...selected];
          state.erp = mode().erp;
          render();
        })
      );
    },
  },
  {
    id: "industry", phase: "Characterize", nav: "Industry context",
    title: "Which industry contexts does this implementation cover?",
    sub: "Build the implementation's coverage across products, sites, and business units. Add every relevant specialization; the next step reconciles their operating archetypes.",
    hint: "Add at least one industry context to continue.",
    gate: () => selectedIndustryContexts().length > 0,
    body: () => {
      const selected = industry();
      const specialties = selected ? industrySpecialties[selected.id] || [] : [];
      const contexts = selectedIndustryContexts();
      return `
        <div class="context-tray${contexts.length ? " has-contexts" : ""}">
          <div class="context-tray-title"><span>Project coverage</span><strong>${contexts.length ? `${contexts.length} selected` : "No contexts yet"}</strong></div>
          <div class="context-chips">
            ${contexts.length ? contexts.map((context, index) => `<button class="context-chip" type="button" data-remove-context="${index}" title="Remove ${escapeHtml(context.specialty)}"><i data-lucide="${context.sector.icon}"></i><span><small>${escapeHtml(context.sector.name)}</small>${escapeHtml(context.specialty)}</span><i data-lucide="x"></i></button>`).join("") : `<span class="context-empty">Choose one or several specializations below. Cross-sector combinations are supported.</span>`}
          </div>
        </div>
        <div class="industry-picker">
          <div class="sector-list" aria-label="Industry sectors">
            <span class="picker-label">1 · Sector</span>
            ${industries.map((item) => {
              const count = contexts.filter((context) => context.industry === item.id).length;
              return `
              <button class="sector-option${state.industry === item.id ? " active" : ""}" type="button" data-industry="${item.id}" aria-pressed="${state.industry === item.id}">
                <i data-lucide="${item.icon}"></i><span>${escapeHtml(item.name)}</span>${count ? `<b>${count}</b>` : `<i data-lucide="chevron-right"></i>`}
              </button>`;
            }).join("")}
          </div>
          <div class="specialty-panel">
            <div class="specialty-head">
              <div><span class="picker-label">2 · Specialization</span><strong>${selected ? escapeHtml(selected.name) : "Select a sector"}</strong></div>
              ${selected ? `<label class="specialty-search"><i data-lucide="search"></i><input id="specialtySearch" type="search" placeholder="Search ${escapeHtml(selected.name)}" autocomplete="off" aria-label="Search specializations"></label>` : ""}
            </div>
            ${selected ? `<div class="specialty-list" id="specialtyList">
              ${specialties.map((item, index) => {
                const active = contexts.some((context) => context.industry === state.industry && context.specialty === item);
                return `<button class="specialty-option${active ? " active" : ""}" type="button" data-specialty-index="${index}" aria-pressed="${active}"><span>${escapeHtml(item)}</span><i data-lucide="check"></i></button>`;
              }).join("")}
              <p class="specialty-empty" id="specialtyEmpty" hidden>No matching specialization.</p>
            </div>` : `<div class="specialty-placeholder"><i data-lucide="corner-down-left"></i><p>Pick the closest sector to reveal its focused industry list.</p></div>`}
          </div>
        </div>
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-industry]").forEach((button) => button.addEventListener("click", () => {
        state.industry = button.dataset.industry;
        render();
      }));
      root.querySelectorAll("[data-specialty-index]").forEach((button) => button.addEventListener("click", () => {
        const specialty = (industrySpecialties[state.industry] || [])[Number(button.dataset.specialtyIndex)];
        const contexts = [...(state.industryContexts || [])];
        const existing = contexts.findIndex((context) => context.industry === state.industry && context.specialty === specialty);
        existing >= 0 ? contexts.splice(existing, 1) : contexts.push({ industry: state.industry, specialty });
        state.industryContexts = contexts;
        state.industrySpecialty = contexts.at(-1)?.specialty || null;
        state.supplies.confirmed = false;
        state.archetypes = state.archetypes.filter((id) => isArchetypeCompatible(id));
        state.erp = mode().erp;
        render();
      }));
      root.querySelectorAll("[data-remove-context]").forEach((button) => button.addEventListener("click", () => {
        state.industryContexts.splice(Number(button.dataset.removeContext), 1);
        state.industrySpecialty = state.industryContexts.at(-1)?.specialty || null;
        state.supplies.confirmed = false;
        state.archetypes = state.archetypes.filter((id) => isArchetypeCompatible(id));
        state.erp = mode().erp;
        render();
      }));
      root.querySelector("#specialtySearch")?.addEventListener("input", (event) => {
        const query = event.target.value.trim().toLocaleLowerCase();
        let visible = 0;
        root.querySelectorAll("[data-specialty-index]").forEach((button) => {
          const matches = button.textContent.toLocaleLowerCase().includes(query);
          button.hidden = !matches;
          if (matches) visible += 1;
        });
        const empty = root.querySelector("#specialtyEmpty");
        if (empty) empty.hidden = visible > 0;
      });
    },
  },
  {
    id: "dialect", phase: "Characterize", nav: "Dialect",
    title: "Confirm the planning dialect.",
    sub: "The synthesized operating backbone recommends the planning language. Secondary archetypes remain overlays; override the ERP dialect if the client's system differs.",
    body: () => `
      <div class="derive">
        <div class="derive-chain">
          <span class="chain-node industry-node">${escapeHtml(industryLabel() || "Industry not set")}</span>
          <i data-lucide="plus"></i>
          <span class="chain-node">${escapeHtml(archetypeSynthesis().count === 1 ? archetypeSynthesis().title : `${archetypeSynthesis().count} reconciled patterns`)}</span>
          <i data-lucide="arrow-right"></i>
          <span class="chain-node accent">${escapeHtml(mode().label)}</span>
          <i data-lucide="arrow-right"></i>
          <span class="chain-node">${escapeHtml(profile().badge)}</span>
        </div>
        <p class="derive-note">${escapeHtml(mode().note)} ${selectedIndustryContexts().length ? `Portfolio lens: ${escapeHtml(industryLens())}` : ""}</p>
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
    id: "calendar", phase: () => organizationTerm(), nav: "Calendars & capacity",
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
    id: "constraint", phase: () => organizationTerm(), nav: "Constraint view",
    title: "What is currently known about the constraint?",
    sub: "Capture the customer's view as a hypothesis, not as planning truth. The limiting constraint may be unknown or shift by horizon, product mix, campaign, and scenario.",
    hint: "Choose the best current description. It can be refined when data and scenarios reveal more.",
    gate: () => !!state.constraint,
    body: () => `
      <div class="choice-grid three">
        ${choiceTile("unknown", state.constraint === "unknown", "circle-help", "Not known yet", "Let data profiling and scenario runs surface likely constraints")}
        ${choiceTile("shifting", state.constraint === "shifting", "shuffle", "Shifting constraint", "Changes with horizon, product mix, campaign, or operating conditions")}
        ${choiceTile("equipment-family", state.constraint === "equipment-family", "cog", "Equipment family", "Customer-observed capacity pattern; representative resources will illustrate it")}
        ${choiceTile("shared-stage", state.constraint === "shared-stage", "workflow", "Shared processing stage", "A shared stage may constrain multiple products or campaigns")}
        ${choiceTile("quality-release", state.constraint === "quality-release", "microscope", "Quality release", "Inspection, testing, or release capacity may gate the schedule")}
      </div>
    `,
    attach: (root) => bindChoices(root, (v) => { state.constraint = v; render(); }),
  },
  {
    id: "areas", phase: "Model", nav: "Department taxonomy",
    title: () => `Which ${profile().area.toLowerCase()} types belong in the representative model?`,
    sub: "Select semantic categories, not customer department names. The generator will create synthetic examples that preserve these roles and relationships.",
    hint: "Select at least one department type to continue.",
    gate: () => state.departmentTypes?.length > 0,
    body: () => `
      <div class="taxonomy-grid">
        ${departmentTaxonomy.map((item) => `
          <button class="taxonomy-card${state.departmentTypes.includes(item.id) ? " active" : ""}" type="button" data-department-type="${item.id}" aria-pressed="${state.departmentTypes.includes(item.id)}">
            <i data-lucide="${item.icon}"></i>
            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.note)}</small></span>
          </button>
        `).join("")}
      </div>
      <p class="representative-note"><i data-lucide="sparkles"></i> ${state.departmentTypes.length || "No"} department type${state.departmentTypes.length === 1 ? "" : "s"} will seed representative records.</p>
    `,
    attach: (root) => {
      root.querySelectorAll("[data-department-type]").forEach((button) => button.addEventListener("click", () => {
        const selected = new Set(state.departmentTypes);
        selected.has(button.dataset.departmentType) ? selected.delete(button.dataset.departmentType) : selected.add(button.dataset.departmentType);
        state.departmentTypes = [...selected];
        render();
      }));
    },
  },
  {
    id: "workcenters", phase: "Model", nav: "Resource taxonomy",
    title: () => `Which ${profile().resource.toLowerCase()} types should the generator represent?`,
    sub: "Choose capacity-object categories, not named machines or people. Synthetic examples will be linked to compatible department types automatically.",
    hint: "Select at least one resource type to continue.",
    gate: () => state.resourceTypes?.length > 0,
    body: () => `
      <div class="taxonomy-grid">
        ${resourceTaxonomy.map((item) => `
          <button class="taxonomy-card${state.resourceTypes.includes(item.id) ? " active" : ""}" type="button" data-resource-type="${item.id}" aria-pressed="${state.resourceTypes.includes(item.id)}">
            <i data-lucide="${item.icon}"></i>
            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.note)}</small></span>
          </button>
        `).join("")}
      </div>
      <p class="representative-note"><i data-lucide="sparkles"></i> ${state.resourceTypes.length || "No"} resource type${state.resourceTypes.length === 1 ? "" : "s"} will seed representative records.</p>
    `,
    attach: (root) => {
      root.querySelectorAll("[data-resource-type]").forEach((button) => button.addEventListener("click", () => {
        const selected = new Set(state.resourceTypes);
        selected.has(button.dataset.resourceType) ? selected.delete(button.dataset.resourceType) : selected.add(button.dataset.resourceType);
        state.resourceTypes = [...selected];
        render();
      }));
    },
  },
  {
    id: "volume-storage", phase: "Model", nav: "Volume storage",
    title: "Do tanks or other volume assets shape feasibility?",
    sub: "Model tanks, silos, vats, drums, bins, and connected buffers as schedule-dependent volume resources - not as warehouses or ordinary machines.",
    hint: "Confirm whether volume-storage scheduling is in scope and review its behaviors.",
    gate: () => state.volumeStorage?.present === false || !!(state.volumeStorage?.present && state.volumeStorage?.confirmed && state.volumeStorage?.behaviors?.length),
    body: () => {
      const storage = state.volumeStorage || initialState.volumeStorage;
      return `
        ${volumeStorageRecommended() ? `<div class="volume-recommendation"><i data-lucide="sparkles"></i><span><strong>Recommended from industry coverage</strong>Process-oriented contexts commonly require explicit volume-storage scheduling.</span></div>` : ""}
        <div class="volume-presence" role="group" aria-label="Volume storage scope">
          <button type="button" class="${storage.present === true ? "active" : ""}" data-volume-present="true" aria-pressed="${storage.present === true}"><i data-lucide="cylinder"></i><span><strong>Volume assets are in scope</strong><small>Tanks, silos, vats, drums, bins, or intermediate buffers affect feasibility</small></span></button>
          <button type="button" class="${storage.present === false ? "active" : ""}" data-volume-present="false" aria-pressed="${storage.present === false}"><i data-lucide="circle-slash-2"></i><span><strong>Not relevant to this project</strong><small>Materials use ordinary inventory locations or non-volume resources</small></span></button>
        </div>
        ${storage.present ? `
          <div class="volume-heading"><div><span>Tank scheduling behaviors</span><strong>${storage.behaviors.length} of ${volumeStorageBehaviors.length} represented</strong></div><button type="button" id="selectAllVolume">${storage.behaviors.length === volumeStorageBehaviors.length ? "Clear all" : "Select complete model"}</button></div>
          <div class="volume-grid">
            ${volumeStorageBehaviors.map((behavior, index) => `<button type="button" class="volume-behavior${storage.behaviors.includes(behavior.id) ? " active" : ""}" data-volume-behavior="${behavior.id}" aria-pressed="${storage.behaviors.includes(behavior.id)}"><span>${String(index + 1).padStart(2, "0")}</span><i data-lucide="${behavior.icon}"></i><div><strong>${escapeHtml(behavior.name)}</strong><small>${escapeHtml(behavior.note)}</small></div><i data-lucide="check"></i></button>`).join("")}
          </div>
          <div class="volume-confirmation"><p><strong>Avoid fixed durations and rules of thumb.</strong> Feasible schedules must dynamically couple occupancy, quantity, topology, sequence, and product state.</p><button type="button" class="${storage.confirmed ? "active" : ""}" id="confirmVolume" ${storage.behaviors.length ? "" : "disabled"}><i data-lucide="${storage.confirmed ? "circle-check" : "shield-check"}"></i><span>${storage.confirmed ? "Volume model confirmed" : "Confirm volume model"}</span></button></div>
        ` : ""}
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-volume-present]").forEach((button) => button.addEventListener("click", () => {
        const present = button.dataset.volumePresent === "true";
        state.volumeStorage.present = present;
        state.volumeStorage.behaviors = present ? [...volumeStorageBehaviors.map((item) => item.id)] : [];
        state.volumeStorage.confirmed = !present;
        render();
      }));
      root.querySelectorAll("[data-volume-behavior]").forEach((button) => button.addEventListener("click", () => {
        const selected = new Set(state.volumeStorage.behaviors);
        selected.has(button.dataset.volumeBehavior) ? selected.delete(button.dataset.volumeBehavior) : selected.add(button.dataset.volumeBehavior);
        state.volumeStorage.behaviors = [...selected];
        state.volumeStorage.confirmed = false;
        render();
      }));
      root.querySelector("#selectAllVolume")?.addEventListener("click", () => {
        state.volumeStorage.behaviors = state.volumeStorage.behaviors.length === volumeStorageBehaviors.length ? [] : volumeStorageBehaviors.map((item) => item.id);
        state.volumeStorage.confirmed = false;
        render();
      });
      root.querySelector("#confirmVolume")?.addEventListener("click", () => {
        state.volumeStorage.confirmed = true;
        render();
      });
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
    id: "supplies", phase: "Model", nav: "Critical supplies",
    title: "Which supplies can stop the schedule?",
    sub: "Classify representative material families by operational substitutability. Purchase orders, transfer orders, usable stock, expiry, and storage capacity become hard constraints only where recovery is not credible.",
    hint: "Review the industry recommendations and confirm the supply policy.",
    gate: () => !!state.supplies?.confirmed,
    body: () => {
      const profiles = supplyProfiles();
      const counts = profiles.reduce((result, profile) => {
        result[supplyPolicy(profile)] += 1;
        return result;
      }, { hard: 0, watch: 0, soft: 0 });
      return `
        <div class="supply-synthesis">
          <div><span>Industry-informed policy</span><strong>${profiles.length} representative supply families</strong></div>
          <div class="supply-counts"><b class="hard">${counts.hard} hard</b><b class="watch">${counts.watch} watch</b><b class="soft">${counts.soft} soft</b></div>
        </div>
        <div class="supply-matrix" role="table" aria-label="Supply criticality policy">
          <div class="supply-header" role="row"><span>Representative supply family</span><span>Criticality drivers</span><span>Scheduling policy</span></div>
          ${profiles.map((profile) => {
            const policy = supplyPolicy(profile);
            return `<div class="supply-row" role="row">
              <div class="supply-identity"><i data-lucide="${profile.icon}"></i><span><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(profile.note)}</small></span></div>
              <div class="supply-drivers">${profile.drivers.map((driver) => `<span>${escapeHtml(driver)}</span>`).join("")}</div>
              <div class="supply-policy" aria-label="Policy for ${escapeHtml(profile.name)}">
                <button type="button" class="${policy === "hard" ? "active hard" : ""}" data-supply-profile="${profile.id}" data-supply-policy="hard" title="Blocks scheduling when confirmed supply is insufficient">Hard</button>
                <button type="button" class="${policy === "watch" ? "active watch" : ""}" data-supply-profile="${profile.id}" data-supply-policy="watch" title="Warns and scores risk without blocking every schedule">Watch</button>
                <button type="button" class="${policy === "soft" ? "active soft" : ""}" data-supply-profile="${profile.id}" data-supply-policy="soft" title="Assumes expediting, substitution, or supplier recovery">Soft</button>
              </div>
            </div>`;
          }).join("")}
        </div>
        <div class="supply-confirmation">
          <div><i data-lucide="info"></i><p><strong>Hard</strong> means APS must respect usable inventory plus dated purchase and transfer supply. <strong>Soft</strong> means planners accept recovery outside the current system picture.</p></div>
          <button type="button" class="${state.supplies.confirmed ? "active" : ""}" id="confirmSupplies"><i data-lucide="${state.supplies.confirmed ? "circle-check" : "shield-check"}"></i><span>${state.supplies.confirmed ? "Policy confirmed" : "Confirm supply policy"}</span></button>
        </div>
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-supply-profile]").forEach((button) => button.addEventListener("click", () => {
        state.supplies.policies[button.dataset.supplyProfile] = button.dataset.supplyPolicy;
        state.supplies.confirmed = false;
        render();
      }));
      root.querySelector("#confirmSupplies")?.addEventListener("click", () => {
        state.supplies.confirmed = true;
        render();
      });
    },
  },
  {
    id: "execution", phase: "Model", nav: "Execution feedback",
    title: "How does actual execution return to planning?",
    sub: () => `Configure the feedback contract separately from the ${profile().route.toLowerCase()}. MES events and ${profile().badge} confirmations may describe the same work at different levels and times.`,
    hint: "Complete the source, reporting level, event, and quantity configuration.",
    gate: () => !!(state.execution?.source && state.execution?.levels?.length && state.execution?.events?.length && state.execution?.quantitiesConfirmed),
    body: () => {
      const execution = state.execution || initialState.execution;
      const signal = (group, value, icon, title, sub) => {
        const attribute = { levels: "level", events: "event", quantities: "quantity" }[group];
        return choiceTile(value, execution[group].includes(value), icon, title, sub).replace("data-choice", `data-execution-${attribute}`);
      };
      const sourceNote = {
        erp: `${profile().badge} is the execution system of record and sends official confirmations.`,
        mes: `MES sends detailed execution events; ${profile().badge} remains planning context rather than the confirmation source.`,
        hybrid: `MES provides event detail while ${profile().badge} provides official postings; identifiers and duplicate-event rules must reconcile both.`,
      }[execution.source];
      return `
        ${sourceNote ? `<div class="execution-synthesis"><i data-lucide="refresh-cw"></i><span>${escapeHtml(sourceNote)}</span></div>` : ""}
        <div class="execution-profile">
          <section class="execution-dimension">
            <div class="dimension-heading"><span>01</span><div><strong>System of record</strong><small>Who publishes execution truth</small></div></div>
            <div class="choice-grid three compact" data-execution-group="source">
              ${choiceTile("erp", execution.source === "erp", "database", `${profile().badge} confirmations`, "ERP owns starts, finishes, and quantities")}
              ${choiceTile("mes", execution.source === "mes", "monitor-cog", "MES execution events", "MES owns detailed shop-floor feedback")}
              ${choiceTile("hybrid", execution.source === "hybrid", "git-merge", "Hybrid MES + ERP", "MES detail reconciled to official ERP postings")}
            </div>
          </section>
          <section class="execution-dimension">
            <div class="dimension-heading"><span>02</span><div><strong>Reporting level</strong><small>Select every level received</small></div></div>
            <div class="choice-grid three compact">
              ${signal("levels", "order-batch", "clipboard-list", `${profile().order} / batch`, "One confirmation summarizes the whole order or batch")}
              ${signal("levels", "operation-step", "list-checks", "Operation / step", "Feedback is attached to a routing operation or instruction step")}
              ${signal("levels", "phase", "split", "Phase", "Process phases publish their own execution status")}
            </div>
          </section>
          <section class="execution-dimension">
            <div class="dimension-heading"><span>03</span><div><strong>Lifecycle events</strong><small>Select every event received</small></div></div>
            <div class="choice-grid three compact">
              ${signal("events", "start", "play", "Start", "Actual start of an order, operation, step, or phase")}
              ${signal("events", "end", "square-check-big", "End / completion", "Final completion or technically complete status")}
              ${signal("events", "partial", "circle-dot-dashed", "Partial / progress", "Incremental confirmation before final completion")}
            </div>
          </section>
          <section class="execution-dimension">
            <div class="dimension-heading"><span>04</span><div><strong>Quantity outcomes</strong><small>Select every quantity received</small></div></div>
            <div class="choice-grid compact execution-signals">
              ${signal("quantities", "yield", "badge-check", "Yield / good quantity", "Accepted production quantity or process yield")}
              ${signal("quantities", "scrap", "trash-2", "Scrap / reject", "Rejected quantity and optional reason code")}
              ${signal("quantities", "rework", "rotate-ccw", "Rework", "Quantity routed back into correction or reprocessing")}
              ${signal("quantities", "consumption", "package-minus", "Material consumption", "Actual component, ingredient, lot, or container usage")}
              ${choiceTile("status-only", execution.quantitiesConfirmed && execution.quantities.length === 0, "activity", "Status only", "No execution quantities are supplied").replace("data-choice", "data-execution-quantity-none")}
            </div>
          </section>
        </div>
      `;
    },
    attach: (root) => {
      root.querySelectorAll("[data-execution-group]").forEach((group) => {
        group.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
          state.execution[group.dataset.executionGroup] = button.dataset.choice;
          render();
        }));
      });
      ["level", "event", "quantity"].forEach((group) => {
        root.querySelectorAll(`[data-execution-${group}]`).forEach((button) => button.addEventListener("click", () => {
          const key = { level: "levels", event: "events", quantity: "quantities" }[group];
          const selected = new Set(state.execution[key]);
          selected.has(button.dataset[`execution${group[0].toUpperCase()}${group.slice(1)}`])
            ? selected.delete(button.dataset[`execution${group[0].toUpperCase()}${group.slice(1)}`])
            : selected.add(button.dataset[`execution${group[0].toUpperCase()}${group.slice(1)}`]);
          state.execution[key] = [...selected];
          if (group === "quantity") state.execution.quantitiesConfirmed = true;
          render();
        }));
      });
      root.querySelector("[data-execution-quantity-none]")?.addEventListener("click", () => {
        state.execution.quantities = [];
        state.execution.quantitiesConfirmed = true;
        render();
      });
    },
  },
  {
    id: "variant", phase: "Model", nav: "Try a variant",
    title: "Want to try a variant before committing?",
    sub: "Branching lets you explore a taxonomy change in isolation. The example uses synthetic Packaging and Finished-Goods records, never customer master data.",
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
    id: "demo", phase: "Validate", nav: "Representative scenario",
    title: "Validate with a synthetic scheduling scenario.",
    sub: () => `A generated rush ${profile().order.toLowerCase()} needs representative packaging capacity. The scenario tests the configured logic without asking for customer orders or resources.`,
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
        ["Industry contexts", selectedIndustryContexts().length ? "done" : "open", selectedIndustryContexts().length ? selectedIndustryContexts().map((context) => context.specialty).join(" · ") : "Not selected"],
        ["Operating archetypes", state.archetypes?.length ? "done" : "open", state.archetypes?.length ? archetypeSynthesis().title : "Not characterized"],
        ["Department taxonomy", state.departmentTypes?.length ? "done" : "open", state.departmentTypes?.length ? `${state.departmentTypes.length} semantic types selected` : "Not configured"],
        ["Calendars & capacity", state.calendar?.layering ? "done" : "open", state.calendar?.layering ? `${calendarProfile().base} · ${state.calendar.pattern} · ${state.calendar.exceptions}` : "Not characterized"],
        ["Resource taxonomy", state.resourceTypes?.length ? "done" : "open", state.resourceTypes?.length ? `${state.resourceTypes.length} capacity-object types selected` : "Not configured"],
        ["Volume storage", state.volumeStorage?.present === false || state.volumeStorage?.confirmed ? "done" : "open", state.volumeStorage?.present === false ? "Not in scope" : state.volumeStorage?.confirmed ? `${state.volumeStorage.behaviors.length} tank behaviors modeled` : "Not characterized"],
        ["BOM profile", state.bom?.source ? "done" : "open", state.bom?.source ? `${state.bom.structure} · ${state.bom.consumption} · ${state.bom.source}` : "Not characterized"],
        ["Critical supplies", state.supplies?.confirmed ? "done" : "open", state.supplies?.confirmed ? `${supplyProfiles().filter((profile) => supplyPolicy(profile) === "hard").length} hard constraints confirmed` : "Policy not reviewed"],
        ["Execution feedback", state.execution?.source ? "done" : "open", state.execution?.source ? `${executionSourceLabel()} · ${state.execution.events.join(", ")}` : "Not configured"],
        ["Representative evidence", state.demo ? "done" : "open", state.demo ? `${state.demo.score}% scenario score` : "Pending"],
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
      const generated = representativeData();
      return `
        <div class="summary-grid">
          <div class="summary-card"><span>Objective</span><strong>${state.scope === "aps-ds" ? "APS / Detailed Scheduling" : "Pending"}</strong><small>hours-to-weeks planning horizon</small></div>
          <div class="summary-card"><span>Industry coverage</span><strong>${industryLabel() ? escapeHtml(industryLabel()) : "Pending"}</strong><small>${selectedIndustryContexts().length ? escapeHtml(selectedIndustryContexts().map((context) => context.specialty).join(" · ")) : "context not selected"}</small></div>
          <div class="summary-card"><span>Representative data</span><strong>${generated.departments.length} departments · ${generated.resources.length} resources</strong><small>synthetic and replaceable</small></div>
          <div class="summary-card"><span>Volume storage</span><strong>${state.volumeStorage?.present ? `${state.volumeStorage.behaviors.length} behaviors` : state.volumeStorage?.present === false ? "Not in scope" : "Pending"}</strong><small>${state.volumeStorage?.present ? "dynamic occupancy, flow and eligibility model" : "tank scheduling profile"}</small></div>
          <div class="summary-card"><span>BOM</span><strong>${state.bom?.structure ? escapeHtml(state.bom.structure) : "Pending"}</strong><small>${state.bom?.source ? escapeHtml(state.bom.source) : "integration grain not set"}</small></div>
          <div class="summary-card"><span>Critical supplies</span><strong>${state.supplies?.confirmed ? `${supplyProfiles().filter((profile) => supplyPolicy(profile) === "hard").length} hard constraints` : "Pending"}</strong><small>${state.supplies?.confirmed ? "PO, transfer, stock, shelf-life and storage policy" : "supply policy not reviewed"}</small></div>
          <div class="summary-card"><span>Capacity</span><strong>${state.calendar?.layering ? escapeHtml(state.calendar.layering) : "Pending"}</strong><small>${state.calendar?.pattern ? escapeHtml(state.calendar.pattern) : "calendar pattern not set"}</small></div>
          <div class="summary-card"><span>Execution</span><strong>${escapeHtml(executionSourceLabel())}</strong><small>${state.execution?.events?.length ? escapeHtml(state.execution.events.join(" · ")) : "feedback events not set"}</small></div>
          <div class="summary-card"><span>Decisions</span><strong>${decisions.length} governed</strong><small>${decisions.length ? "merge history travels with handoff" : "no branch merges"}</small></div>
          <div class="summary-card"><span>Evidence</span><strong>${state.demo ? state.demo.score + "% training" : "Pending"}</strong><small>${state.demo ? "seeds the support runbook" : "no scored scenario"}</small></div>
          <div class="summary-card"><span>Readiness</span><strong>${readiness()}%</strong><small>at handoff</small></div>
        </div>
        <section class="generated-preview" aria-label="Generated representative dataset">
          <div class="generated-heading"><div><span>Generated representative dataset</span><strong>${escapeHtml(generated.organization.name)}</strong></div><em>synthetic</em></div>
          <div class="generated-columns">
            <div><span>${escapeHtml(profile().area)} examples</span>${generated.departments.map((item) => `<code>${escapeHtml(item.id)}</code><small>${escapeHtml(item.name)}</small>`).join("") || "<small>No department types selected</small>"}</div>
            <div><span>${escapeHtml(profile().resource)} examples</span>${generated.resources.map((item) => `<code>${escapeHtml(item.id)}</code><small>${escapeHtml(item.name)}</small>`).join("") || "<small>No resource types selected</small>"}</div>
          </div>
          <p>${escapeHtml(generated.replacementPolicy)}</p>
        </section>
        <button class="ghost-btn wide" id="exportBtn" type="button"><i data-lucide="download"></i><span>Export handoff brief (JSON)</span></button>
      `;
    },
    attach: (root) => {
      root.querySelector("#exportBtn").addEventListener("click", exportBrief);
    },
  },
];

// ── Step UI helpers ──────────────────────────────────────────────────
// Industry constrains valid operating patterns, so it must precede Archetype.
const industryStepIndex = steps.findIndex((step) => step.id === "industry");
const archetypeStepIndex = steps.findIndex((step) => step.id === "archetype");
const [industryStep] = steps.splice(industryStepIndex, 1);
steps.splice(archetypeStepIndex, 0, industryStep);

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
    representativeDataset: representativeData(),
    billOfMaterials: state.bom,
    volumeStorage: {
      ...state.volumeStorage,
      behaviorDetails: volumeStorageBehaviors.filter((behavior) => state.volumeStorage.behaviors.includes(behavior.id)),
    },
    criticalSupplies: {
      confirmed: state.supplies.confirmed,
      profiles: supplyProfiles().map((profile) => ({ ...profile, policy: supplyPolicy(profile) })),
    },
    calendarAndCapacity: {
      terminology: calendarProfile(),
      profile: state.calendar,
    },
    executionFeedback: {
      sourceLabel: executionSourceLabel(),
      ...state.execution,
    },
    decisions: { variant: state.variant, migration: state.migration },
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
