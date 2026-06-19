// Build + validate the two WS_32 join components (paths from the Data Model note).
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

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_WS32_COMPONENTS_" + String(Date.now()).slice(-6));

  // Routing-side component: [Site, BaseKey, ComputedFactor]
  await run.createTableWorksheet("WS_Routing_Factor", "RouteOperationSegment");
  await run.addCalculatedColumn("Site", "RouteOperation.PartSource.Part.Site");
  await run.addCalculatedColumn("BaseKey", "RouteOperation.PartSource.BaseKey");
  await run.addCalculatedColumn(
    "ComputedFactor",
    "DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)",
  );
  await run.assertNoInvalidColumns();
  run.note("Routing component columns valid");

  // SourceConstraint-side component: [Site, BaseKey, ExistingFactor]
  await run.createTableWorksheet("WS_SC_Factor", "SourceConstraint", { namespace: "Mfg" });
  await run.addCalculatedColumn("Site", "PartSource.Part.Site");
  await run.addCalculatedColumn("BaseKey", "PartSource.BaseKey");
  await run.addCalculatedColumn("ExistingFactor", "ConstraintFactor");
  await run.assertNoInvalidColumns();
  run.note("SourceConstraint component columns valid");

  await run.saveWorkbook();
  console.log("\n✓ BOTH COMPONENTS BUILT + SAVED");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
} finally {
  await close();
}
