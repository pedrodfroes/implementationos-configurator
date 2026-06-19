// THROWAWAY discovery — learn the "Add calculated column (expression)" UI flow.
// Creates an UNSAVED workbook/worksheet, opens Columns > Add Column, dumps the
// menu and the calculated-column dialog. Nothing is saved. Delete after use.
import { launchBrowser, MaestroAuthoringRun, APP_URL } from "./maestro-authoring.mjs";

const { browser, tab, context } = await launchBrowser({});
const page = tab._page;

await tab.goto(APP_URL);

// wait for shell (should be instant if the session persisted)
const deadline = Date.now() + 300000;
let ready = false;
while (Date.now() < deadline) {
  const s = await tab.playwright.domSnapshot();
  if (s.includes('button "Resources"') || s.includes('heading "Resources"')) {
    ready = true;
    break;
  }
  console.error("waiting for login/shell…");
  await page.waitForTimeout(2000);
}
if (!ready) {
  console.error("shell never appeared");
  await context.close();
  process.exit(1);
}

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
await run.prepare();
await run.openNewWorkbook();
await run.setWorkbookName("WB_DISCOVERY_TMP");
await run.createTableWorksheet("WS_DISC", "RouteOperationSegment");

function controlLines(snapshot) {
  return [
    ...new Set(
      snapshot
        .split("\n")
        .filter((l) => /(button|menuitem|tab|textbox|combobox|checkbox)\s+"/.test(l))
        .map((l) => l.trim()),
    ),
  ];
}

await run.openTab("Columns");
await run.clickRole("button", "Add Column");
await run.wait(1000);
await run.clickRole("button", "New Column");
await run.wait(1800);

const dlgSnap = await tab.playwright.domSnapshot();
console.log("\n===== AFTER 'New Column' — controls =====");
console.log(controlLines(dlgSnap).join("\n"));

const inputs = await tab.playwright
  .locator('input[type="text"]')
  .filter({ visible: true })
  .count();
const textareas = await tab.playwright.locator("textarea").filter({ visible: true }).count();
console.log(`\nvisible text inputs: ${inputs} | visible textareas: ${textareas}`);

// Look for an expression editor entry point.
const exprButtons = controlLines(dlgSnap).filter((l) =>
  /express|edit|formula|fx|\bf\(x\)/i.test(l),
);
console.log("\nexpression-ish controls:");
console.log(exprButtons.join("\n") || "(none matched)");

console.log("\n===== raw aria (first 6000) =====");
console.log(dlgSnap.slice(0, 6000));

await context.close();
console.log("\nDONE (nothing saved)");
