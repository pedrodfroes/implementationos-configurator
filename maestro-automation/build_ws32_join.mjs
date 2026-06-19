// Build the WS_32 factor back-check: two components + composite INNER JOIN on
// first 2 columns (Site, BaseKey). Configure join IN the Add-Component panel
// BEFORE selecting the worksheet.
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
    s.split("\n").filter((l) => /(button|textbox|combobox|radio|option|checkbox)\s+"/.test(l)).map((l) => l.trim()),
  )];
}

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_WS32_JOIN_" + String(Date.now()).slice(-6));

  await run.createTableWorksheet("WS_Routing_Factor", "RouteOperationSegment");
  await run.addCalculatedColumn("Site", "RouteOperation.Route.PartSource.Part.Site");
  await run.addCalculatedColumn("BaseKey", "RouteOperation.Route.PartSource.BaseKey");
  await run.addCalculatedColumn("ComputedFactor", "DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)");

  await run.createTableWorksheet("WS_SC_Factor", "SourceConstraint", { namespace: "Mfg" });
  await run.addCalculatedColumn("Site", "PartSource.Part.Site");
  await run.addCalculatedColumn("BaseKey", "PartSource.BaseKey");
  await run.addCalculatedColumn("ExistingFactor", "ConstraintFactor");

  // composite
  await run.backToWorkbookPropertiesIfNeeded();
  await run.openTab("Worksheets");
  await run.clickRole("button", "New Worksheet");
  await run.wait(900);
  await run.clickRole("button", "Composite Worksheet");
  await run.wait(1500);
  await run.fillTextInput(0, "WS_32_Factor_Back_Check");
  await run.wait(500);
  run.note("Composite WS_32_Factor_Back_Check created");

  const P = tab.playwright; // frame-spanning locators (search all frames)
  const present = async () => {
    const s = await P.domSnapshot();
    return ["WS_Routing_Factor", "WS_SC_Factor"].filter((n) => s.includes(n));
  };

  // ---- FIRST add = BASE (no join config) ----
  await run.clickRole("button", "Add Component Worksheet");
  await run.wait(1500);
  const avail = await present();
  console.log("\n[base picker] available:", JSON.stringify(avail));
  const base = avail.includes("WS_Routing_Factor") ? "WS_Routing_Factor" : avail[0];
  await P.getByText(base, { exact: true }).click();
  await run.wait(2200);
  run.note("Base component: " + base);

  // ---- SECOND add = JOIN (INNER on first 2 columns) ----
  await run.clickRole("button", "Add Component Worksheet");
  await run.wait(1500);

  // join type -> INNER JOIN (open the combobox, click the option)
  try {
    await P.getByRole("combobox", { name: "Include in composite worksheet", exact: true }).click();
    await run.wait(700);
    await P.getByText("INNER JOIN", { exact: false }).click();
    await run.wait(600);
    run.note("Join type = INNER JOIN");
  } catch (e) { console.log("join-type step:", e.message); }

  // combine on first 2 columns: tick SpecifiedNumberOfColumns, then set the spinbutton
  try {
    await P.getByRole("radio", { name: "SpecifiedNumberOfColumns", exact: true }).click();
    await run.wait(400);
    await P.getByRole("spinbutton", { name: "The first number of columns", exact: true }).fill("2");
    await run.wait(800);
    run.note("Combine based on first 2 columns");
  } catch (e) { console.log("columns step:", e.message); }

  // the 2nd worksheet appears only once the join+columns validate; wait for it
  const second = "WS_SC_Factor";
  let seen = false;
  for (let i = 0; i < 10 && !seen; i += 1) {
    seen = (await present()).includes(second);
    if (!seen) await run.wait(400);
  }
  console.log("[2nd picker] WS_SC_Factor visible:", seen);
  try {
    await P.getByText(second, { exact: true }).click();
    await run.wait(2500);
    run.note("Second component added (INNER, first 2 cols): " + second);
  } catch (e) { console.log("select-second step:", e.message); }

  console.log("\n===== composite after join =====");
  const full = await tab.playwright.domSnapshot();
  const idx = full.indexOf("Components");
  console.log(full.slice(idx >= 0 ? idx : 0, (idx >= 0 ? idx : 0) + 1800));
  console.log("\n✓ JOIN STEPS COMPLETED");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
} finally {
  await close();
}
