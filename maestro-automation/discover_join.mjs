// THROWAWAY — build 2 valid components, create a composite, and capture the
// Add Component Worksheet + JOIN config controls.
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
      .filter((l) => /(button|menuitem|tab|textbox|combobox|checkbox|radio|option|spinbutton|listitem)\s+"/.test(l))
      .map((l) => l.trim()),
  )];
}

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_JOIN_DISC_" + String(Date.now()).slice(-6));

  await run.createTableWorksheet("WS_Routing_Factor", "RouteOperationSegment");
  await run.addCalculatedColumn("Site", "RouteOperation.PartSource.Part.Site");
  await run.addCalculatedColumn("BaseKey", "RouteOperation.PartSource.BaseKey");
  await run.addCalculatedColumn("ComputedFactor", "DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)");

  await run.createTableWorksheet("WS_SC_Factor", "SourceConstraint", { namespace: "Mfg" });
  await run.addCalculatedColumn("Site", "PartSource.Part.Site");
  await run.addCalculatedColumn("BaseKey", "PartSource.BaseKey");
  await run.addCalculatedColumn("ExistingFactor", "ConstraintFactor");

  // create the composite worksheet
  await run.backToWorkbookPropertiesIfNeeded();
  await run.openTab("Worksheets");
  await run.clickRole("button", "New Worksheet");
  await run.wait(900);
  await run.clickRole("button", "Composite Worksheet");
  await run.wait(1500);
  run.note("Composite worksheet created");

  await run.clickRole("button", "Add Component Worksheet");
  await run.wait(1500);
  console.log("\n===== Add Component panel =====");
  console.log(controls(await tab.playwright.domSnapshot()).join("\n"));

  // Select WS_SC_Factor as the join partner.
  const item = tab.playwright.getByText("WS_SC_Factor", { exact: true });
  if ((await item.count()) >= 1) {
    await item.nth(0).click({});
    await run.wait(2000);
    run.note("Selected WS_SC_Factor component");
  } else {
    console.log("!! WS_SC_Factor entry not found to click");
  }

  // Open the "Content" (join-type) selector to capture INNER/LEFT/OUTER options.
  const content = tab.playwright.getByRole("textbox", { name: "Content", exact: true });
  if ((await content.count()) >= 1) {
    await content.nth(0).click({});
    await run.wait(1200);
    run.note("Opened Content (join-type) selector");
  } else {
    // maybe it's a combobox/button
    const c2 = tab.playwright.getByText("All records in component worksheet", { exact: false });
    if ((await c2.count()) >= 1) { await c2.nth(0).click({}); await run.wait(1200); }
  }

  const snap = await tab.playwright.domSnapshot();
  console.log("\n===== Join-type options + key controls =====");
  console.log(controls(snap).join("\n"));
  console.log("\n=== lines mentioning join/column/first/key/match/record ===");
  console.log([...new Set(snap.split("\n").map((l) => l.trim()).filter((l) => /join|column|first|\bkey\b|match|record/i.test(l)))].join("\n"));
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
} finally {
  await close();
}
console.log("\nDONE");
