// ImplementationOS — reference data.
//
// Pure, static lookup tables: ERP dialects, planning archetypes, industries,
// taxonomies, and the per-family attribute palettes. No state, no DOM. The
// Model phase speaks each client's dialect by resolving against these tables.

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

const workforceCapabilities = [
  { id: "qualification", name: "Qualification management", icon: "graduation-cap", note: "A qualification matrix maps who can run which workstation, so planning never assigns work to people who cannot perform it.", points: ["Qualification matrix per workstation", "Flexible qualification levels", "Automatic consideration in planning"] },
  { id: "absence", name: "Absence management", icon: "calendar-off", note: "Real availability after leave, holidays, and training keeps planned capacity honest and feeds absence-rate analysis.", points: ["Transparent availability overview", "Simple absence recording", "Automatic planning integration", "Absence-rate reporting & causes"] },
  { id: "deployment", name: "Workforce deployment planning", icon: "users", note: "Assign qualified, available people to shifts with suggestions and reusable schedules instead of manual rostering.", points: ["Automatic employee assignment", "Drag-and-drop planning", "Qualified-employee suggestions", "Reuse of existing schedules"] },
  { id: "shift", name: "Shift planning", icon: "calendar-clock", note: "Maintain shift models and recurring patterns, including overlapping shifts, with team- and workstation-level reporting.", points: ["Bulk shift changes", "Recurring shift patterns", "Employee / team / workstation reports", "Multiple & overlapping shift models"] },
];

// People are the binding constraint in service and project work; process
// plants are asset-bound and treat workforce as shift coverage. Intensity is
// the highest tier across the selected archetypes.
const archetypeLaborIntensity = {
  "field-service": "core", "healthcare-capacity": "core", "maintenance-turnaround": "core",
  "construction-project": "core", "cto-eto": "core", "job-shop": "core",
  "discrete-assembly": "supporting", "flow-shop": "supporting", "semiconductor-fab": "supporting",
  "distribution-logistics": "supporting", "mining-primary": "supporting", "packaging-postponement": "supporting",
  "batch-campaign": "minimal", "continuous-process": "minimal", "perishable-food": "minimal", "maturation-aging": "minimal",
};

// Recommended configuration depth per capability, by derived labor intensity.
const workforceScopeMatrix = {
  qualification: { core: "full", supporting: "full", minimal: "basic" },
  absence: { core: "full", supporting: "basic", minimal: "basic" },
  deployment: { core: "full", supporting: "basic", minimal: "out" },
  shift: { core: "full", supporting: "full", minimal: "full" },
};

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

// The same conceptual thing — a descriptive/classifying trait on a material —
// has a different NAME and STRUCTURE in every ERP. The Model phase must speak
// the client's dialect, so each attribute family resolves to the right word.
const attributeProfiles = {
  sap: {
    family: "SAP Classification (CL)",
    note: "Characteristics live on Classes; values are assigned through Classification. Variant config and batch traits reuse the same engine.",
    classification: "Class / Classification",
    descriptor: "Characteristic & Material master / custom field",
    planning: "MRP view fields",
    variant: "Configuration Profile / Variant Class",
    batchSerial: "Batch Characteristic",
    quality: "Inspection Characteristic",
  },
  oracle: {
    family: "Oracle Item Attributes & Flexfields",
    note: "Oracle leans on item attributes heavily; descriptive and extensible flexfields carry the rest of the model.",
    classification: "Item Catalog / Category",
    descriptor: "Item Attribute & Descriptive Flexfield (DFF)",
    planning: "Planning item attributes",
    variant: "Extensible Flexfield (EFF) / item options",
    batchSerial: "Lot Attribute & Serial Attribute",
    quality: "Specification",
  },
  d365: {
    family: "Dynamics Product Information",
    note: "Dynamics separates product, tracking, and storage dimensions — a clean mental model for where each trait belongs.",
    classification: "Product Category",
    descriptor: "Product Attribute & Attribute Type",
    planning: "Coverage / planning fields",
    variant: "Product Variant & Product Dimensions",
    batchSerial: "Tracking Dimensions (batch, serial)",
    quality: "Quality association / test",
  },
  generic: {
    family: "Item master attributes",
    note: "Captured as item-master fields and custom extensions; the same families exist under local names.",
    classification: "Item category / class",
    descriptor: "Item attribute / custom field",
    planning: "Planning attributes",
    variant: "Variant / configuration options",
    batchSerial: "Lot / serial attribute",
    quality: "Quality / inspection characteristic",
  },
};

// Universal attribute families an APS model must understand, each rendered in
// the ERP's own words via `attributeProfiles`. Each is its own Model step.
const attributeConcepts = [
  { id: "classification", dialectKey: "classification", icon: "tags", short: "Classification", name: "Classification & grouping", role: "Group products into classes or categories.", aps: "Drives changeover families, campaign grouping, and reporting dimensions." },
  { id: "descriptor", dialectKey: "descriptor", icon: "list", short: "Descriptive", name: "Descriptive attributes", role: "Defined traits carried as values on the master record.", aps: "Feed sequencing rules, compatibility, and constraint logic." },
  { id: "planning", dialectKey: "planning", icon: "sliders-horizontal", short: "Planning fields", name: "Planning master fields", role: "Lot size, safety stock, lead time, scrap, strategy.", aps: "Set lot-sizing, buffers, and horizons directly in the schedule." },
  { id: "variant", dialectKey: "variant", icon: "git-fork", short: "Variants", name: "Variant / configuration", role: "Configurable options that resolve a concrete product.", aps: "Late differentiation and configured BOM / routing selection." },
  { id: "batchSerial", dialectKey: "batchSerial", icon: "scan-barcode", short: "Batch / serial", name: "Batch / serial attributes", role: "Values specific to a lot, batch, or serial instance.", aps: "Potency, expiry, and grade constrain which supply is usable." },
  { id: "quality", dialectKey: "quality", icon: "microscope", short: "Quality params", name: "Quality / process parameters", role: "Inspection characteristics, CPP, CQA, and spec limits.", aps: "Release gates and process windows that bound feasibility." },
];

// Generic fallback examples per family — always offered in the ERP's words.
const familyBase = {
  classification: ["Material group", "ABC classification", "Procurement type"],
  descriptor: ["Unit of measure", "Weight / dimensions", "Base material"],
  planning: ["Lot size / MOQ", "Safety stock", "Lead time", "Planning strategy", "Scrap %"],
  variant: ["Size", "Color", "Configuration option"],
  batchSerial: ["Batch number", "Serial number"],
  quality: ["Inspection characteristic", "Specification limit", "Sampling rule"],
};

// Pre-populated, industry-specific example attributes, tagged by family (`f`).
// These seed each Model step so the consultant recognizes the client's reality
// instead of facing a blank field. CQA/CPP tags surface the MES/QMS lens.
const industryAttributePalette = {
  pharma: [
    { f: "classification", n: "Dosage form" }, { f: "classification", n: "Therapeutic class" }, { f: "classification", n: "Controlled-substance schedule" },
    { f: "descriptor", n: "Strength / Concentration" }, { f: "descriptor", n: "Blister size" }, { f: "descriptor", n: "Fill volume" }, { f: "descriptor", n: "Storage condition" },
    { f: "planning", n: "Min remaining shelf life" }, { f: "planning", n: "Shelf-life-driven lot size" },
    { f: "variant", n: "Pack size / count" }, { f: "variant", n: "Market / label variant" },
    { f: "batchSerial", n: "Potency / assay" }, { f: "batchSerial", n: "Expiry / retest date" }, { f: "batchSerial", n: "Manufacturing batch" },
    { f: "quality", n: "Dissolution rate (CQA)" }, { f: "quality", n: "Assay purity (CQA)" }, { f: "quality", n: "Granulation time (CPP)" }, { f: "quality", n: "Drying temperature (CPP)" },
  ],
  pesticides: [
    { f: "classification", n: "Formulation type (EC/WP/SC)" }, { f: "classification", n: "Active-ingredient class" }, { f: "classification", n: "Hazard class" },
    { f: "descriptor", n: "Active-ingredient %" }, { f: "descriptor", n: "Concentration" }, { f: "descriptor", n: "Pack volume" },
    { f: "planning", n: "Campaign min batch" }, { f: "planning", n: "Segregation group" },
    { f: "variant", n: "Pack size" }, { f: "variant", n: "Country registration variant" },
    { f: "batchSerial", n: "AI assay" }, { f: "batchSerial", n: "Batch potency" }, { f: "batchSerial", n: "Expiry date" },
    { f: "quality", n: "Active-ingredient content (CQA)" }, { f: "quality", n: "Particle size (CQA)" }, { f: "quality", n: "Reactor temperature (CPP)" },
  ],
  "medical-devices": [
    { f: "classification", n: "Device class (I/II/III)" }, { f: "classification", n: "Product family" }, { f: "classification", n: "Sterilization method" },
    { f: "descriptor", n: "Size / dimension" }, { f: "descriptor", n: "Material" }, { f: "descriptor", n: "UDI-DI" },
    { f: "planning", n: "Lot size" }, { f: "planning", n: "Lead time" },
    { f: "variant", n: "Model / configuration" }, { f: "variant", n: "Size variant" },
    { f: "batchSerial", n: "Lot number" }, { f: "batchSerial", n: "Serial number" }, { f: "batchSerial", n: "Sterilization batch" }, { f: "batchSerial", n: "Expiry date" },
    { f: "quality", n: "Sterility (CQA)" }, { f: "quality", n: "Dimensional tolerance (CQA)" }, { f: "quality", n: "Seal strength (CPP)" },
  ],
  "food-beverage": [
    { f: "classification", n: "Product family" }, { f: "classification", n: "Allergen group" }, { f: "classification", n: "Storage class (chilled/ambient/frozen)" }, { f: "classification", n: "Brand" },
    { f: "descriptor", n: "Net weight / volume" }, { f: "descriptor", n: "Flavor" }, { f: "descriptor", n: "Pack format" },
    { f: "planning", n: "Min remaining shelf life" }, { f: "planning", n: "Lot size" },
    { f: "variant", n: "Pack size" }, { f: "variant", n: "Flavor / market variant" },
    { f: "batchSerial", n: "Best-before date" }, { f: "batchSerial", n: "Production lot" }, { f: "batchSerial", n: "Allergen status" },
    { f: "quality", n: "Brix / pH (CQA)" }, { f: "quality", n: "Moisture (CQA)" }, { f: "quality", n: "Pasteurization temp (CPP)" }, { f: "quality", n: "Mixing time (CPP)" },
  ],
  chemicals: [
    { f: "classification", n: "Product family" }, { f: "classification", n: "Hazard class" }, { f: "classification", n: "Formula group" },
    { f: "descriptor", n: "Concentration" }, { f: "descriptor", n: "Viscosity" }, { f: "descriptor", n: "Density" }, { f: "descriptor", n: "Pack type" },
    { f: "planning", n: "Campaign min batch" }, { f: "planning", n: "Tank assignment" },
    { f: "variant", n: "Pack size" }, { f: "variant", n: "Grade variant" },
    { f: "batchSerial", n: "Assay / purity" }, { f: "batchSerial", n: "Batch grade" }, { f: "batchSerial", n: "Expiry date" },
    { f: "quality", n: "Purity (CQA)" }, { f: "quality", n: "Particle size (CQA)" }, { f: "quality", n: "Reactor temperature (CPP)" }, { f: "quality", n: "Residence time (CPP)" },
  ],
  cpg: [
    { f: "classification", n: "Brand" }, { f: "classification", n: "Category" }, { f: "classification", n: "Pack family" }, { f: "classification", n: "Promotion group" },
    { f: "descriptor", n: "Pack size" }, { f: "descriptor", n: "Scent / variant" }, { f: "descriptor", n: "Material" },
    { f: "planning", n: "Changeover family" }, { f: "planning", n: "Lot size" },
    { f: "variant", n: "Pack count" }, { f: "variant", n: "Market / language variant" }, { f: "variant", n: "Promotional pack" },
    { f: "batchSerial", n: "Production lot" }, { f: "batchSerial", n: "Best-before date" },
    { f: "quality", n: "Fill weight (CQA)" }, { f: "quality", n: "Seal integrity (CQA)" }, { f: "quality", n: "Line speed (CPP)" },
  ],
  automotive: [
    { f: "classification", n: "Product line" }, { f: "classification", n: "Vehicle platform" }, { f: "classification", n: "Commodity group" }, { f: "classification", n: "Make / buy class" },
    { f: "descriptor", n: "Part dimension" }, { f: "descriptor", n: "Material" }, { f: "descriptor", n: "Weight" }, { f: "descriptor", n: "Color" },
    { f: "planning", n: "Lot size / MOQ" }, { f: "planning", n: "Sequenced-supply flag" }, { f: "planning", n: "Safety stock" },
    { f: "variant", n: "Option / configuration code" }, { f: "variant", n: "Color variant" }, { f: "variant", n: "Trim level" },
    { f: "batchSerial", n: "Serial / VIN linkage" }, { f: "batchSerial", n: "Production batch" },
    { f: "quality", n: "Dimensional tolerance (CQA)" }, { f: "quality", n: "Torque spec (CPP)" }, { f: "quality", n: "Weld parameters (CPP)" },
  ],
  industrial: [
    { f: "classification", n: "Product family" }, { f: "classification", n: "Commodity group" }, { f: "classification", n: "ETO / CTO class" },
    { f: "descriptor", n: "Dimensions" }, { f: "descriptor", n: "Material" }, { f: "descriptor", n: "Capacity rating" },
    { f: "planning", n: "Long-lead flag" }, { f: "planning", n: "Lot size" }, { f: "planning", n: "Lead time" },
    { f: "variant", n: "Configuration options" }, { f: "variant", n: "Engineered variant" },
    { f: "batchSerial", n: "Serial number" }, { f: "batchSerial", n: "Build lot" },
    { f: "quality", n: "Inspection characteristic" }, { f: "quality", n: "Test certificate" }, { f: "quality", n: "Assembly torque (CPP)" },
  ],
  electronics: [
    { f: "classification", n: "Product family" }, { f: "classification", n: "Technology node" }, { f: "classification", n: "Commodity class" },
    { f: "descriptor", n: "Package type" }, { f: "descriptor", n: "Pin count" }, { f: "descriptor", n: "Speed grade" },
    { f: "planning", n: "Yield-adjusted qty" }, { f: "planning", n: "Lot size" }, { f: "planning", n: "Lead time" },
    { f: "variant", n: "Speed / grade bin" }, { f: "variant", n: "Package variant" },
    { f: "batchSerial", n: "Wafer lot" }, { f: "batchSerial", n: "Die lot" }, { f: "batchSerial", n: "Date code" }, { f: "batchSerial", n: "Serial number" },
    { f: "quality", n: "Yield (CQA)" }, { f: "quality", n: "Electrical test bin (CQA)" }, { f: "quality", n: "Etch time (CPP)" }, { f: "quality", n: "Bake temperature (CPP)" },
  ],
  aerospace: [
    { f: "classification", n: "Product family" }, { f: "classification", n: "Effectivity group" }, { f: "classification", n: "Commodity class" },
    { f: "descriptor", n: "Dimensions" }, { f: "descriptor", n: "Material" }, { f: "descriptor", n: "Effectivity" },
    { f: "planning", n: "Long-lead flag" }, { f: "planning", n: "Lot size" },
    { f: "variant", n: "Effectivity / configuration" }, { f: "variant", n: "Serialized variant" },
    { f: "batchSerial", n: "Serial number" }, { f: "batchSerial", n: "Material certification" }, { f: "batchSerial", n: "Lot traceability" },
    { f: "quality", n: "Dimensional tolerance (CQA)" }, { f: "quality", n: "NDT result (CQA)" }, { f: "quality", n: "Cure cycle (CPP)" }, { f: "quality", n: "Torque (CPP)" },
  ],
  "metals-mining": [
    { f: "classification", n: "Grade family" }, { f: "classification", n: "Product class" }, { f: "classification", n: "Hazard class" },
    { f: "descriptor", n: "Grade / spec" }, { f: "descriptor", n: "Dimension" }, { f: "descriptor", n: "Form (ingot/coil)" },
    { f: "planning", n: "Campaign min" }, { f: "planning", n: "Blend group" },
    { f: "variant", n: "Grade variant" }, { f: "variant", n: "Dimension variant" },
    { f: "batchSerial", n: "Heat / cast number" }, { f: "batchSerial", n: "Assay" }, { f: "batchSerial", n: "Batch grade" },
    { f: "quality", n: "Chemical composition (CQA)" }, { f: "quality", n: "Grade assay (CQA)" }, { f: "quality", n: "Furnace temperature (CPP)" }, { f: "quality", n: "Cooling rate (CPP)" },
  ],
  "building-materials": [
    { f: "classification", n: "Product family" }, { f: "classification", n: "Strength class" }, { f: "classification", n: "Hazard class" },
    { f: "descriptor", n: "Strength grade" }, { f: "descriptor", n: "Pack format" }, { f: "descriptor", n: "Density" },
    { f: "planning", n: "Campaign min batch" }, { f: "planning", n: "Kiln assignment" },
    { f: "variant", n: "Pack size" }, { f: "variant", n: "Grade variant" },
    { f: "batchSerial", n: "Production batch" }, { f: "batchSerial", n: "Strength test lot" }, { f: "batchSerial", n: "Cure status" },
    { f: "quality", n: "Compressive strength (CQA)" }, { f: "quality", n: "Setting time (CQA)" }, { f: "quality", n: "Kiln temperature (CPP)" }, { f: "quality", n: "Residence time (CPP)" },
  ],
};

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

// Setup / changeover / cleaning transitions. The time the line loses between
// runs is its own model: what kind of transition, what inserts it, whether it
// blocks the resource, and what it is keyed to. APS schedules around these.
const transitionTypes = [
  { id: "setup", icon: "wrench", name: "Setup", note: "Prepare or configure equipment before a run begins" },
  { id: "changeover", icon: "repeat", name: "Changeover", note: "Switch the line from one product to another" },
  { id: "cleaning", icon: "spray-can", name: "Cleaning / CIP", note: "Clean down between products, campaigns, or batches" },
];

const transitionTriggers = [
  { id: "fixed", icon: "minus", name: "Fixed", note: "Always the same, regardless of sequence" },
  { id: "sequence", icon: "arrow-down-up", name: "Sequence-dependent", note: "Duration depends on the from → to product pair" },
  { id: "order-count", icon: "list-ordered", name: "Order count", note: "Insert after every N orders" },
  { id: "quantity", icon: "package", name: "Quantity based", note: "Insert after a produced-quantity threshold" },
  { id: "time", icon: "timer", name: "Time / runtime", note: "Insert after N hours of run time — e.g. a periodic clean" },
];

const transitionConcurrency = [
  { id: "non-concurrent", icon: "square", name: "Non-concurrent", note: "Blocks the resource; nothing else runs during it" },
  { id: "concurrent", icon: "layers", name: "Concurrent", note: "Can overlap with production or run in parallel" },
  { id: "mixed", icon: "split", name: "Mixed", note: "Some block the resource; others can overlap" },
];

const transitionDrivers = [
  { id: "attribute", icon: "tags", name: "Attribute-driven", note: "Keyed to the item attributes you selected" },
  { id: "sku", icon: "barcode", name: "SKU / material code", note: "Keyed to specific SKU or material codes" },
  { id: "campaign", icon: "layers-3", name: "Campaign / family", note: "Keyed to a campaign or product family" },
];
