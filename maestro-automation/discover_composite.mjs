// THROWAWAY — learn the Composite Worksheet (JOIN) authoring flow.
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

function controls(snapshot) {
  return [...new Set(
    snapshot.split("\n")
      .filter((l) => /(button|menuitem|tab|textbox|combobox|checkbox|radio|option|spinbutton)\s+"/.test(l))
      .map((l) => l.trim()),
  )];
}

const run = new MaestroAuthoringRun({ browser, tab, mode: "fast" });
await run.prepare();
await run.openNewWorkbook();
await run.setWorkbookName("WB_DISC_COMPOSITE_TMP");

// one simple table worksheet to act as the main join component
await run.createTableWorksheet("WS_A", "RouteOperationSegment");
await run.wait(800);

// create the composite worksheet
await run.backToWorkbookPropertiesIfNeeded();
await run.openTab("Worksheets");
await run.clickRole("button", "New Worksheet");
await run.wait(800);
console.log("\n===== New Worksheet menu =====");
console.log(controls(await tab.playwright.domSnapshot()).join("\n"));

await run.clickRole("button", "Composite Worksheet");
await run.wait(1500);
console.log("\n===== After 'Composite Worksheet' (initial panel) =====");
console.log(controls(await tab.playwright.domSnapshot()).join("\n"));

// Reveal the Add Component Worksheet panel.
await run.clickRole("button", "Add Component Worksheet");
await run.wait(1500);
console.log("\n===== After 'Add Component Worksheet' =====");
console.log(controls(await tab.playwright.domSnapshot()).join("\n"));
console.log("\n===== Add-Component raw aria (first 7000) =====");
console.log((await tab.playwright.domSnapshot()).slice(0, 7000));

await close();
console.log("\nDONE (nothing saved)");
