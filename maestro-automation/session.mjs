// Long-lived Maestro session for CDP attach.
//
//   node session.mjs            # opens a Chrome on CDP port 9222
//   (log into Maestro in that window, then LEAVE IT OPEN)
//
// Then run the authoring library against it with no re-login:
//   node maestro-authoring.mjs --cdp http://localhost:9222 --workbook WB_TEST
//
// The window stays up across many runs, so you only log in once.
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { APP_URL } from "./maestro-authoring.mjs";

const PORT = process.argv[2] || "9222";
const userDataDir = path.join(os.homedir(), ".maestro-cdp-profile");

// Kill any lingering Chromium on this profile FIRST. Otherwise a new launch
// silently re-attaches to the old (often degraded/zombie) instance — "Opening in
// an existing browser session" — which is the cause of the session getting flaky
// after several runs. This makes every `node session.mjs` genuinely fresh.
function killStaleSession() {
  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -NoProfile -Command "Get-CimInstance Win32_Process | ` +
          `Where-Object { $_.CommandLine -like '*maestro-cdp-profile*' } | ` +
          `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
        { stdio: "ignore" },
      );
    } else {
      execSync("pkill -f maestro-cdp-profile", { stdio: "ignore" });
    }
  } catch {
    // nothing to kill, or already gone
  }
}
killStaleSession();
await new Promise((r) => setTimeout(r, 1500)); // let the OS release the profile lock

const { chromium } = await import("playwright");
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  viewport: null,
  args: [`--remote-debugging-port=${PORT}`, "--start-maximized"],
});
const page = context.pages()[0] || (await context.newPage());
await page.goto(APP_URL, { waitUntil: "domcontentloaded" });

console.error("──────────────────────────────────────────────");
console.error(`Maestro session is up. CDP endpoint: http://localhost:${PORT}`);
console.error("1. Log into Maestro in the window that just opened.");
console.error("2. Leave this window open (and this process running).");
console.error("3. Run, e.g.:");
console.error(`   node maestro-authoring.mjs --cdp http://localhost:${PORT} --workbook WB_TEST`);
console.error("Press Ctrl+C here to end the session.");
console.error("──────────────────────────────────────────────");

await new Promise(() => {}); // stay alive until killed
