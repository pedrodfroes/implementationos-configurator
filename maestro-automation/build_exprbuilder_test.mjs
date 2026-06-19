// Test the library Expression Builder methods: addCalculatedColumnViaBuilder
// (inserts the namespaced CrewSize via the builder) + read the built expression.
import { launchBrowser, MaestroAuthoringRun, APP_URL } from "./maestro-authoring.mjs";

const { browser, tab, close } = await launchBrowser({ cdpEndpoint: "http://localhost:9222" });
const page = tab._page;
await tab.goto(APP_URL);
const dl = Date.now() + 120000;
let ready = false;
while (Date.now() < dl) {
  const s = await tab.playwright.domSnapshot();
  if (s.includes('button "Resources"')) { ready = true; break; }
  console.error("waiting for login/shell…");
  await page.waitForTimeout(2000);
}
if (!ready) { console.error("no shell"); await close(); process.exit(1); }

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_EXPRB_LIB_" + String(Date.now()).slice(-6));
  await run.createTableWorksheet("WS_E", "RouteOperationSegment");

  const expr = await run.addCalculatedColumnViaBuilder("LabourFactorB", [
    "DIV(24 * ",
    { field: ["RouteOperation", "CrewSize"] },
    ", Rate, 0, 0)",
  ]);

  console.log("\nBUILT EXPRESSION:", expr);
  await run.assertNoInvalidColumns();
  await page.screenshot({ path: "exprbuilder_lib.png" }).catch(() => {});
  console.log("✓ addCalculatedColumnViaBuilder works (no invalid columns)");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
  await page.screenshot({ path: "exprbuilder_lib_debug.png" }).catch(() => {});
} finally {
  await close();
}
