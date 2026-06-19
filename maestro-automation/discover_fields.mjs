// THROWAWAY — dump top-level fields of a table to find Site / Base Key / PartSource paths.
import { launchBrowser, MaestroAuthoringRun, APP_URL } from "./maestro-authoring.mjs";

const table = process.argv[2] || "RouteOperationSegment";
const namespace = process.argv[3] || ""; // e.g. Scheduling

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
await run.prepare();
await run.openNewWorkbook();
await run.setWorkbookName("WB_DISC_FIELDS_TMP");
await run.createTableWorksheet("WS_F", table, namespace ? { namespace } : {});
await run.wait(1000);

await run.openTab("Columns");
await run.clickRole("button", "Add Column");
await run.wait(600);
await run.clickRole("button", "Columns from Fields...");
await run.wait(1200);

const snap = await tab.playwright.domSnapshot();
const fields = [...new Set(
  snap.split("\n").filter((l) => /checkbox "/.test(l)).map((l) => l.trim()),
)];
console.log(`\n===== top-level fields of ${table}${namespace ? " (" + namespace + ")" : ""} =====`);
console.log(fields.join("\n"));
console.log("\n=== lines mentioning Base/Site/PartSource ===");
console.log(
  [...new Set(snap.split("\n").map((l) => l.trim()).filter((l) => /base key|\bsite\b|partsource|part source/i.test(l)))].join("\n"),
);

await close();
console.log("\nDONE");
