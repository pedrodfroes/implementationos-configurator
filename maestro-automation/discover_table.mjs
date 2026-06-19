// THROWAWAY — find the exact "Resource" table name in the worksheet Table picker.
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

const run = new MaestroAuthoringRun({ browser, tab, mode: "fast" });
await run.prepare();
await run.openNewWorkbook();
await run.setWorkbookName("WB_DISCOVER_TBL_TMP");
await run.openTab("Worksheets");
await run.clickRole("button", "New Worksheet");
await run.wait(600);
await run.clickRole("button", "Worksheet (Table-based)");
await run.wait(1000);
await run.fillTextInput(0, "WS_TMP");
await run.wait(400);

const combo = tab.playwright.getByRole("combobox", { name: "Table", exact: true });
if ((await combo.count()) === 1) await combo.click({});
else {
  const b = tab.playwright.getByRole("button", { name: "Table All Sites Dropdown", exact: true });
  if ((await b.count()) === 1) await b.click({});
}
await run.wait(700);

let search = tab.playwright.getByRole("textbox", { name: "Search", exact: true });
for (let i = 0; i < 12 && (await search.count()) !== 1; i++) {
  if ((await combo.count()) === 1) await combo.click({});
  await page.waitForTimeout(250);
  search = tab.playwright.getByRole("textbox", { name: "Search", exact: true });
}
if ((await search.count()) === 1) {
  await search.fill("Resource");
  await run.wait(900);
}

const snap = await tab.playwright.domSnapshot();
const lines = [...new Set(snap.split("\n").map((l) => l.trim()).filter((l) => /Resource/i.test(l)))];
console.log("=== lines mentioning Resource ===");
console.log(lines.join("\n"));

await close();
console.log("\nDONE (nothing saved)");
