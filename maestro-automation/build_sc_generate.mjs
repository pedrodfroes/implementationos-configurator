// Generate machine-constraint SourceConstraint records from routing, shaped to
// SourceConstraint's insertable columns. Routing -> PrimaryResource is the machine
// constraint, so Labor is naturally excluded. Paths from the Data Model note +
// user: PartSource via RouteOperation.Route.PartSource; Constraint via
// RouteOperation.PrimaryResource.Constraint.
import { launchBrowser, MaestroAuthoringRun, APP_URL } from "./maestro-authoring.mjs";

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

// columns in SourceConstraint key order: Constraint (Site, Name), PartSource keys,
// EffectiveInDate, then the factors.
const columns = [
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

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_SC_GENERATE_" + String(Date.now()).slice(-6));
  await run.createTableWorksheet("WS_SourceConstraint_Generate", "RouteOperationSegment");
  for (const [name, expr, decimals] of columns) {
    try {
      await run.addCalculatedColumn(name, expr, decimals ? { decimalPlaces: decimals } : {});
    } catch (e) {
      console.log(`!! column ${name} (${expr}) failed: ${e.message}`);
    }
  }
  // surface any invalid columns explicitly (don't abort — report which)
  const snap = await tab.playwright.domSnapshot();
  console.log("invalid-column flag present:", snap.includes("Invalid column"));

  // save + open so the grid is testable with the decimal-formatted factors
  await run.assertNoInvalidColumns();
  await run.saveWorkbook();
  await run.openWorkbookData({ site: "MKM" });
  await run.assertGridLoaded({ expectedRowsText: "" });
  console.log("\n✓ WS_SourceConstraint_Generate built, saved, and opened at MKM");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
} finally {
  await close();
}
