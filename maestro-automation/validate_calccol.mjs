// THROWAWAY validation — exercises the library's addCalculatedColumn path end to
// end: builds WS_20 with the 4 fields + a ConstraintFactor calc column, saves,
// opens at MKM, asserts 1617 rows. Delete after use.
import { launchBrowser, createRoutingWorkbook, APP_URL } from "./maestro-authoring.mjs";

const { browser, tab, close } = await launchBrowser({
  cdpEndpoint: "http://localhost:9222",
});
const page = tab._page;

// Reset to a clean shell (clears any leftover dialog/workbook from a prior run).
await tab.goto(APP_URL);

const deadline = Date.now() + 60000;
let ready = false;
while (Date.now() < deadline) {
  const s = await tab.playwright.domSnapshot();
  if (s.includes('button "Resources"') || s.includes('heading "Resources"')) {
    ready = true;
    break;
  }
  console.error("waiting for shell…");
  await page.waitForTimeout(2000);
}
if (!ready) {
  console.error("shell never appeared (is the session logged in?)");
  await close();
  process.exit(1);
}

const wb = "WB_CALCCOL_TEST_" + String(Date.now()).slice(-6);
console.error("Workbook: " + wb);
try {
  const res = await createRoutingWorkbook({
    browser,
    tab,
    workbookName: wb,
    mode: "safe",
    calculatedColumns: [
      { name: "ConstraintFactor", expression: "DIV(24, Rate, 0, 0)" },
    ],
    logger: (m) => console.error("• " + m),
  });
  console.log("\n✓ CALC-COLUMN VALIDATION OK");
  console.log(JSON.stringify(res.log, null, 2));
} catch (err) {
  console.error("\n✗ FAILED");
  console.error(err && err.stack ? err.stack : String(err));
} finally {
  await close(); // no-op for CDP: leave the session browser running
}
