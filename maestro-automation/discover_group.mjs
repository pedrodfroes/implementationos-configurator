// THROWAWAY — learn the Group (GROUP BY) tab: the Group Data toggle + the
// per-column Grouping Function dropdown.
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

function controls(s) {
  return [...new Set(
    s.split("\n")
      .filter((l) => /(button|checkbox|switch|radio|combobox|menuitem|row|cell|gridcell|textbox)\s+"/.test(l))
      .map((l) => l.trim()),
  )];
}

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_GROUP_DISC_" + String(Date.now()).slice(-6));
  await run.createTableWorksheet("WS_Group_A", "Resource", { namespace: "Scheduling" });

  // add all columns (matches the user's "all columns" worksheet)
  await run.openTab("Columns");
  await run.clickRole("button", "Add Column");
  await run.wait(700);
  await run.clickRole("button", "Columns from all Fields");
  await run.wait(1800);
  run.note("All columns added");

  await run.openTab("Group");
  await run.wait(900);
  console.log("\n===== Group tab (before enable) =====");
  console.log(controls(await tab.playwright.domSnapshot()).join("\n"));

  // enable Group Data: the toggle is the "Switch control" checkbox inside the
  // "Group Data" button. Click the checkbox (force, it may be visually hidden).
  const P = tab.playwright;
  const sw = P.getByRole("checkbox", { name: "Switch control" });
  if ((await sw.count().catch(() => 0)) >= 1) {
    await sw.nth(0).click({ force: true }).catch(() => {});
  }
  await run.wait(1500);
  let full = await tab.playwright.domSnapshot();
  if (!/Column Groups|Grouping Function/i.test(full)) {
    // fallback: click the Group Data button label
    await P.getByRole("button", { name: "Group Data" }).nth(0).click().catch(() => {});
    await run.wait(1500);
    full = await tab.playwright.domSnapshot();
  }
  console.log("\n===== after enabling Group Data — Column Groups present:",
    /Column Groups|Grouping Function/i.test(full), "=====");
  const i = full.indexOf("Column Groups");
  console.log(full.slice(i >= 0 ? i : 0, (i >= 0 ? i : 0) + 3500));

  // open one column's Grouping Function dropdown to capture the option menu
  console.log("\n===== grouping-function menu =====");
  try {
    // the function cells show "Minimum"/"Sum" — click the first "Minimum"
    await P.getByText("Minimum", { exact: true }).nth(0).click();
    await run.wait(900);
    const menu = await tab.playwright.domSnapshot();
    console.log([...new Set(menu.split("\n").map((l) => l.trim())
      .filter((l) => /Group By|Sum|Running Total|Average|Minimum|Maximum|Associate|Count|Product|menuitem|option/i.test(l)))].join("\n"));
  } catch (e) { console.log("menu step:", e.message); }
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
} finally {
  await close();
}
console.log("\nDONE");
