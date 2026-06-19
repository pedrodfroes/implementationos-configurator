// Machine + Labour SourceConstraint generation, then UNION ALL into one output.
// Both component worksheets share the SAME 10 columns (positions/types) so UNION
// can append them. Machine constraint = PrimaryResource.Constraint; Labour = the
// phantom 'Labor' constraint, factor uses the namespaced custom field CrewSize.
import { launchBrowser, MaestroAuthoringRun, APP_URL } from "./maestro-authoring.mjs";

const CREW = "RouteOperation.PernodRicard::CrewSize";

const machineCols = [
  ["ConstraintSite", "RouteOperation.PrimaryResource.Constraint.Site"],
  ["ConstraintName", "RouteOperation.PrimaryResource.Constraint.Name"],
  ["PartSite", "RouteOperation.Route.PartSource.Part.Site"],
  ["PartName", "RouteOperation.Route.PartSource.Part.Name"],
  ["SourceId", "RouteOperation.Route.PartSource.Source.Id"],
  ["SupplierId", "RouteOperation.Route.PartSource.Source.Supplier.Id"],
  ["BaseKey", "RouteOperation.Route.PartSource.BaseKey"],
  ["EffectiveInDate", "'Past'"],
  ["ConstraintFactor", "DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)", 6],
  ["FixedConstraintFactor", "0", 2],
];
const labourCols = [
  // Same Site-reference expression as the machine sheet (value = MKM) so the column
  // TYPES match for UNION; only ConstraintName + ConstraintFactor differ.
  ["ConstraintSite", "RouteOperation.PrimaryResource.Constraint.Site"],
  ["ConstraintName", "'Labor'"],
  ["PartSite", "RouteOperation.Route.PartSource.Part.Site"],
  ["PartName", "RouteOperation.Route.PartSource.Part.Name"],
  ["SourceId", "RouteOperation.Route.PartSource.Source.Id"],
  ["SupplierId", "RouteOperation.Route.PartSource.Source.Supplier.Id"],
  ["BaseKey", "RouteOperation.Route.PartSource.BaseKey"],
  ["EffectiveInDate", "'Past'"],
  ["ConstraintFactor", `DIV(24 * ${CREW}, Rate, 0, 0)`, 6],
  ["FixedConstraintFactor", "0", 2],
];

const { browser, tab, close } = await launchBrowser({ cdpEndpoint: "http://localhost:9222" });
const page = tab._page;
await tab.goto(APP_URL);
const dl = Date.now() + 60000;
let ready = false;
while (Date.now() < dl) {
  const s = await tab.playwright.domSnapshot();
  if (s.includes('button "Resources"')) { ready = true; break; }
  await page.waitForTimeout(1500);
}
if (!ready) { console.error("no shell"); await close(); process.exit(1); }

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
const P = tab.playwright;

async function genWorksheet(name, cols) {
  await run.createTableWorksheet(name, "RouteOperationSegment");
  for (const [n, expr, dec] of cols) {
    await run.addCalculatedColumn(n, expr, dec ? { decimalPlaces: dec } : {});
  }
  run.note(`${name} built`);
}

async function addComponent(name) {
  await run.clickRole("button", "Add Component Worksheet");
  await run.wait(1500);
  await P.getByText(name, { exact: true }).click();
  await run.wait(2200);
  run.note("component added: " + name);
}

try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_SC_ALL_" + String(Date.now()).slice(-6));

  await genWorksheet("WS_SC_Machine", machineCols);
  await genWorksheet("WS_SC_Labour", labourCols);

  // composite UNION ALL
  await run.backToWorkbookPropertiesIfNeeded();
  await run.openTab("Worksheets");
  await run.clickRole("button", "New Worksheet");
  await run.wait(900);
  await run.clickRole("button", "Composite Worksheet");
  await run.wait(1500);
  await run.fillTextInput(0, "WS_SourceConstraint_All");
  await run.wait(500);

  // base = machine
  await addComponent("WS_SC_Machine");
  // 2nd = labour, with UNION mode (Append all records)
  await run.clickRole("button", "Add Component Worksheet");
  await run.wait(1500);
  await P.getByRole("radio", { name: "Union", exact: true }).click();
  await run.wait(900);
  await P.getByText("WS_SC_Labour", { exact: true }).click();
  await run.wait(2500);
  run.note("UNION: WS_SC_Labour appended");

  await page.screenshot({ path: "union_result.png" }).catch(() => {});
  await run.saveWorkbook();
  console.log("\n✓ machine + labour + UNION ALL built + saved (union_result.png)");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
  await page.screenshot({ path: "union_debug.png" }).catch(() => {});
  console.error("(saved union_debug.png)");
} finally {
  await close();
}
