// THROWAWAY — learn the Expression Builder: open it, navigate the field tree,
// double-click a field to insert its full namespaced path, read it back.
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

function ctrls(s) {
  return [...new Set(s.split("\n").filter((l) => /(button|tooltip|treeitem|tab|textbox|dialog|heading|checkbox)\s+"/.test(l)).map((l) => l.trim()))];
}

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
const P = tab.playwright;
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_EXPRB_DISC_" + String(Date.now()).slice(-6));
  await run.createTableWorksheet("WS_E", "RouteOperationSegment");
  await run.openTab("Columns");
  await run.clickRole("button", "Add Column");
  await run.wait(700);
  await run.clickRole("button", "New Column");
  await run.wait(1500);

  console.log("=== column editor controls ===");
  console.log(ctrls(await tab.playwright.domSnapshot()).join("\n"));

  // open the Expression Builder (the "View full expression builder" button/icon)
  let opened = false;
  for (const loc of [
    P.getByRole("button", { name: "View full expression builder" }),
    P.getByRole("button", { name: /expression builder/i }),
  ]) {
    if ((await loc.count().catch(() => 0)) >= 1) { await loc.nth(0).click().catch(() => {}); opened = true; break; }
  }
  await run.wait(1800);
  const afterOpen = await tab.playwright.domSnapshot();
  console.log("\n=== after open attempt (Expression Builder present:",
    /Expression Builder/i.test(afterOpen), ") ===");
  console.log(ctrls(afterOpen).join("\n"));
  console.log("\n=== raw (around Expression Builder, 4000) ===");
  const i = afterOpen.indexOf("Expression Builder");
  console.log(afterOpen.slice(i >= 0 ? i : 0, (i >= 0 ? i : 0) + 4000));
  await page.screenshot({ path: "exprbuilder.png" }).catch(() => {});
  console.log("(saved exprbuilder.png)");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
  await page.screenshot({ path: "exprbuilder_debug.png" }).catch(() => {});
} finally {
  await close();
}
