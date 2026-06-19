// Validate the namespaced crewsize reference + labour factor.
import { launchBrowser, MaestroAuthoringRun, APP_URL } from "./maestro-authoring.mjs";

const CREW = "RouteOperation.PernodRicard::CrewSize";

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
  await run.setWorkbookName("WB_LABOUR_TEST_" + String(Date.now()).slice(-6));
  await run.createTableWorksheet("WS_Labour_Test", "RouteOperationSegment");
  await run.addCalculatedColumn("RateCol", "Rate");
  await run.addCalculatedColumn("CrewSize", CREW, { decimalPlaces: 2 });
  await run.addCalculatedColumn("LabourFactor", `DIV(24 * ${CREW}, Rate, 0, 0)`, { decimalPlaces: 6 });

  const snap = await tab.playwright.domSnapshot();
  const exprError = /error in your column|No Data Yet|Invalid column/i.test(snap);
  console.log("expression-error indicator present:", exprError);

  await run.saveWorkbook();
  await run.openWorkbookData({ site: "MKM" });
  await run.assertGridLoaded({ expectedRowsText: "" });
  await page.screenshot({ path: "labour_test.png" });
  console.log(`\n✓ ${CREW} VALID — labour factor computed (saved labour_test.png)`);
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
  await page.screenshot({ path: "labour_debug.png" }).catch(() => {});
  console.error("(saved labour_debug.png)");
} finally {
  await close();
}
