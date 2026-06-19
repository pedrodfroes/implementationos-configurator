// Grouping (GROUP BY) test worksheets on Resource (Scheduling), using the library
// methods addAllFieldColumns / enableGroupData / setColumnGrouping.
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

async function groupingWorksheet(name, groupings) {
  await run.createTableWorksheet(name, "Resource", { namespace: "Scheduling" });
  await run.addAllFieldColumns();
  await run.enableGroupData();
  for (const [header, func] of groupings) await run.setColumnGrouping(header, func);
  run.note(`${name} built`);
}

try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_GROUPING_" + String(Date.now()).slice(-6));

  // Case 1: group by Site
  await groupingWorksheet("WS_Group_BySite", [
    ["Area Site", "Group By"],
    ["Efficiency", "Average"],
    ["Name", "Count"],
  ]);
  // Case 2: group by Resource Type, different aggregations
  await groupingWorksheet("WS_Group_ByType", [
    ["Resource Type", "Group By"],
    ["Rate", "Average"],
    ["Efficiency", "Maximum"],
  ]);
  // Case 3: group by two keys (Site + Resource Type)
  await groupingWorksheet("WS_Group_BySiteType", [
    ["Area Site", "Group By"],
    ["Resource Type", "Group By"],
    ["Name", "Count"],
  ]);

  await page.screenshot({ path: "group_result.png" }).catch(() => {});
  console.log("(saved group_result.png)");
  await run.saveWorkbook();
  console.log("\n✓ 3 grouping worksheets built + saved");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
  await page.screenshot({ path: "group_debug.png" }).catch(() => {});
  console.error("(saved group_debug.png)");
} finally {
  await close();
}
// CDP connectOverCDP holds an open websocket, so the Node process never exits on
// its own — force it (the browser is a separate process and stays alive).
process.exit(0);
