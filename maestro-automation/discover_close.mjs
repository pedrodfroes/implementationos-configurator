// Discover how to CLOSE/discard a workbook editor so one browser survives many
// builds (instead of restarting session.mjs each time).
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

const run = new MaestroAuthoringRun({ browser, tab, mode: "safe" });
const pw = tab.playwright;
try {
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName("WB_CLOSE_PROBE_" + String(Date.now()).slice(-6));

  // 1) Dump candidate close controls: tabs, and buttons whose name hints "close".
  const dumpControls = async (label) => {
    const data = await page.evaluate(() => {
      const out = [];
      const nodes = document.querySelectorAll(
        '[role="tab"], button, [aria-label], [title]'
      );
      for (const n of nodes) {
        const name =
          n.getAttribute("aria-label") ||
          n.getAttribute("title") ||
          (n.textContent || "").trim().slice(0, 40);
        const role = n.getAttribute("role") || n.tagName.toLowerCase();
        if (!name) continue;
        if (/clos|×|✕|discard|don.?t save|save changes|unsaved/i.test(name)) {
          out.push(`${role} :: ${name}`);
        }
      }
      return Array.from(new Set(out));
    });
    console.log(`\n=== ${label} (close-ish controls) ===`);
    console.log(data.join("\n") || "(none)");
  };
  await dumpControls("after open+name");

  // 2) Also list role=tab elements specifically (editor tab strip).
  const tabsInfo = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="tab"]')).map((t) => ({
      name: (t.getAttribute("aria-label") || t.textContent || "").trim().slice(0, 50),
      hasCloseChild: !!t.querySelector('button, [role="button"], svg, [class*="close" i]'),
    }));
  });
  console.log("\n=== role=tab elements ===");
  console.log(JSON.stringify(tabsInfo, null, 2));

  console.log("\nDone probing. Leaving editor open (no destructive action taken).");
} catch (err) {
  console.error("\n✗ FAILED:", err && err.message ? err.message : err);
} finally {
  await close();
}
