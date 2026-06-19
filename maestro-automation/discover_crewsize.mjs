// Find the exact crewsize field name on the RouteOperation table.
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
  await run.setWorkbookName("WB_CREW_DISC_" + String(Date.now()).slice(-6));
  await run.createTableWorksheet("WS_RO", "RouteOperation", { namespace: "Scheduling" });
  await run.openTab("Columns");
  await run.clickRole("button", "Add Column");
  await run.wait(700);
  await run.clickRole("button", "Columns from Fields...");
  await run.wait(1500);
  const snap = await tab.playwright.domSnapshot();
  const fields = [...new Set(snap.split("\n").filter((l) => /checkbox "/.test(l)).map((l) => l.trim()))];
  console.log("=== ALL RouteOperation fields ===");
  console.log(fields.join("\n"));
  console.log("\n=== lines mentioning crew/size ===");
  console.log([...new Set(snap.split("\n").map((l) => l.trim()).filter((l) => /crew|size/i.test(l)))].join("\n"));
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
  await page.screenshot({ path: "crewsize_debug.png" }).catch(() => {});
} finally {
  await close();
}
