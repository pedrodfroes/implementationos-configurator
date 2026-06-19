import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const APP_URL =
  "https://eu21.kinaxis.net/web/PRSD02_DEV01/RapidResponse/web/default.aspx?ap=1";

function defaultLogger(message) {
  console.log(message);
}

// The instance path segment (e.g. "PRSD02_DEV01") is used to recognise an
// already-open Maestro tab. Derive it from the URL so a different instance can
// be targeted with --url without editing the source.
export function deriveUrlMarker(appUrl) {
  try {
    const segments = new URL(appUrl).pathname.split("/").filter(Boolean);
    const webIndex = segments.indexOf("web");
    if (webIndex !== -1 && segments[webIndex + 1]) return segments[webIndex + 1];
    return new URL(appUrl).host;
  } catch {
    return "PRSD02_DEV01";
  }
}

export async function createRoutingWorkbook({
  browser,
  tab,
  workbookName,
  worksheetName = "WS_20_Routing_To_SourceConstraint",
  tableName = "RouteOperationSegment",
  site = "MKM",
  mode = "safe",
  appUrl = APP_URL,
  calculatedColumns = [],
  includeAllKeyFields = false,
  includeResourceEfficiency = false,
  includeResourceConstraintWorksheet = false,
  includeCheckWorksheets = false,
  worksheetFilterExpression = "",
  expectedRowsText = "1617 rows",
  logger = defaultLogger,
} = {}) {
  if (!browser) throw new Error("browser is required");
  if (!workbookName) throw new Error("workbookName is required");

  const run = new MaestroAuthoringRun({ browser, tab, logger, mode, appUrl });
  const startedAt = Date.now();
  await run.prepare();
  await run.openNewWorkbook();
  await run.setWorkbookName(workbookName);
  await run.addTextVariable("vExpectedSite", site);
  await run.addQuantityVariable("vDayHours", "24");
  await run.addQuantityVariable("vDeltaTolerance", "0.000001");
  await run.addBooleanVariable("vCommitAllowed");
  await run.createTableWorksheet(worksheetName, tableName);
  await run.addColumnsFromFields(
    includeAllKeyFields
      ? ["Rate", "Sequence", "Duration"]
      : ["Rate", "Sequence", "Duration", "OperationSegmentType"],
  );
  if (includeAllKeyFields) {
    await run.addColumnsFromKeyFields("All Key Fields");
  }
  if (includeResourceEfficiency) {
    await run.addRouteOperationPrimaryResourceEfficiencyColumn();
  }
  for (const col of calculatedColumns) {
    await run.addCalculatedColumn(col.name, col.expression, {
      decimalPlaces: col.decimalPlaces,
    });
  }
  if (worksheetFilterExpression) {
    await run.setWorksheetFilterExpression(worksheetFilterExpression);
  }
  if (includeResourceConstraintWorksheet) {
    await run.addResourceConstraintWorksheet();
  }
  if (includeCheckWorksheets) {
    await run.addBadDataCheckWorksheet();
    await run.addOutlierCheckWorksheet();
  }
  await run.assertNoInvalidColumns();
  await run.saveWorkbook();
  await run.openWorkbookData({ site });
  await run.assertGridLoaded({ expectedRowsText });

  return {
    workbookName,
    worksheetName,
    tableName,
    site,
    title: await run.tab.title(),
    url: await run.tab.url(),
    log: run.log,
    mode,
    elapsedMs: Date.now() - startedAt,
  };
}

export class MaestroAuthoringRun {
  constructor({
    browser,
    tab,
    logger = defaultLogger,
    mode = "safe",
    appUrl = APP_URL,
  }) {
    this.browser = browser;
    this.tab = tab;
    this.logger = logger;
    this.mode = mode;
    this.appUrl = appUrl;
    this.urlMarker = deriveUrlMarker(appUrl);
    this.log = [];
    this.timings =
      mode === "fast"
        ? {
            afterNavigation: 1500,
            panel: 450,
            menu: 150,
            createResource: 650,
            fieldReady: 250,
            settle: 200,
            dropdown: 400,
            filter: 150,
            addColumns: 500,
            save: 1200,
            dataSettings: 1200,
            loadGrid: 3500,
          }
        : {
            afterNavigation: 4000,
            panel: 900,
            menu: 350,
            createResource: 1800,
            fieldReady: 650,
            settle: 450,
            dropdown: 300,
            filter: 350,
            addColumns: 1200,
            save: 2500,
            dataSettings: 2600,
            loadGrid: 6000,
          };
  }

  note(message) {
    this.log.push(message);
    this.logger(message);
  }

  async prepare() {
    await (await this.browser.capabilities.get("visibility")).set(true);
    await (await this.browser.capabilities.get("viewport")).set({
      width: 1600,
      height: 1000,
    });

    if (!this.tab) this.tab = await this.getPrTab();
    const url = (await this.tab.url()) || "";
    if (!url.includes(this.urlMarker)) {
      await this.tab.goto(this.appUrl);
      await this.wait(this.timings.afterNavigation);
    }

    const snapshot = await this.snapshot(20000);
    if (
      !snapshot.includes('button "Resources"') &&
      !snapshot.includes('heading "Resources"')
    ) {
      throw new Error("Maestro app shell is not ready. Log in first.");
    }
    this.note("Maestro app shell ready");
  }

  async getPrTab() {
    const tabs = await this.browser.tabs.list();
    const match =
      tabs.find((t) => (t.url || "").includes(this.urlMarker)) || tabs[0];
    return match ? this.browser.tabs.get(match.id) : this.browser.tabs.new();
  }

  async openNewWorkbook() {
    const resources = this.tab.playwright.getByRole("button", {
      name: "Resources",
      exact: true,
    });
    let newResource = this.tab.playwright.getByRole("button", {
      name: "New resource",
      exact: true,
    });
    let newResourceCount = await newResource.count();
    const deadline = Date.now() + (this.mode === "fast" ? 20000 : 25000);
    while (newResourceCount !== 1 && Date.now() < deadline) {
      if ((await resources.count()) !== 1) {
        throw new Error("Resources button not found");
      }
      await resources.click({});
      await this.wait(this.timings.panel);
      newResource = this.tab.playwright.getByRole("button", {
        name: "New resource",
        exact: true,
      });
      newResourceCount = await newResource.count();
    }
    if (newResourceCount !== 1) {
      throw new Error(`New resource button count=${newResourceCount}`);
    }
    await newResource.click({});
    await this.wait(this.timings.menu);
    await this.clickRole("button", "Workbook");
    await this.wait(this.timings.createResource);
    this.note("New workbook editor opened");
  }

  async setWorkbookName(name) {
    await this.fillTextInput(0, name);
    await this.wait(this.timings.settle);
    if (this.mode !== "fast") {
      const snapshot = await this.snapshot();
      if (snapshot.includes("already exists")) {
        throw new Error(`Workbook name already exists: ${name}`);
      }
    }
    this.note(`Workbook named ${name}`);
  }

  async addTextVariable(name, value) {
    await this.createVariable("Text Variable", name, { textValue: value });
  }

  async addQuantityVariable(name, value) {
    await this.createVariable("Quantity Variable", name, {
      quantityValue: value,
    });
  }

  async addBooleanVariable(name) {
    await this.createVariable("Boolean Variable", name, {});
  }

  async createVariable(typeName, name, { textValue, quantityValue }) {
    await this.openTab("Variables");
    await this.clickRole("button", "New Variable");
    await this.wait(this.timings.menu);
    await this.clickRole("button", typeName);
    await this.wait(this.timings.fieldReady);

    const inputs = this.visibleTextInputs();
    const count = await inputs.count();
    if (count < 1) throw new Error(`No text inputs after creating ${name}`);
    await this.replaceText(inputs.nth(0), name);

    if (textValue !== undefined) {
      if (count < 4) throw new Error(`Text variable layout changed: ${name}`);
      await this.replaceText(inputs.nth(3), textValue);
    }
    if (quantityValue !== undefined) {
      if (count < 6) throw new Error(`Quantity variable layout changed: ${name}`);
      await this.replaceText(inputs.nth(5), quantityValue);
    }

    await this.wait(this.timings.settle);
    this.note(`Variable configured: ${name}`);
  }

  async createTableWorksheet(worksheetName, tableName, { namespace } = {}) {
    // Climb back to workbook level so this works for the 2nd+ worksheet too
    // (no-op when already at workbook level, e.g. the first worksheet).
    await this.backToWorkbookPropertiesIfNeeded();
    await this.openTab("Worksheets");
    await this.clickRole("button", "New Worksheet");
    await this.wait(this.timings.menu);
    await this.clickRole("button", "Worksheet (Table-based)");
    await this.wait(this.timings.createResource);

    await this.fillTextInput(0, worksheetName);
    await this.wait(this.timings.settle);
    if (namespace) {
      await this.chooseTableWithNamespace("Table", tableName, namespace);
    } else {
      await this.chooseDropdownValue("Table", tableName);
    }
    this.note(
      `Worksheet ${worksheetName} uses table ${tableName}` +
        (namespace ? ` (${namespace})` : ""),
    );
  }

  // The table picker lists name + namespace as separate columns, so several
  // tables share a name (e.g. Resource exists in ProjMgmt and Scheduling). Open
  // the dropdown, search the name, then click the row whose namespace matches.
  async chooseTableWithNamespace(label, name, namespace) {
    const combo = this.tab.playwright.getByRole("combobox", {
      name: label,
      exact: true,
    });
    const button = this.tab.playwright.getByRole("button", {
      name: `${label} All Sites Dropdown`,
      exact: true,
    });
    // The control can render slightly late on a busy/degraded instance â€” retry
    // rather than throwing on the first miss (the "Dropdown not found: Table" flake).
    let opened = false;
    const dropdownDeadline = Date.now() + (this.mode === "fast" ? 8000 : 15000);
    while (!opened && Date.now() < dropdownDeadline) {
      if ((await combo.count().catch(() => 0)) === 1) {
        await combo.click({});
        opened = true;
      } else if ((await button.count().catch(() => 0)) === 1) {
        await button.click({});
        opened = true;
      } else {
        await this.wait(300);
      }
    }
    if (!opened) throw new Error(`Dropdown not found: ${label}`);
    await this.wait(this.timings.dropdown);

    let search = this.tab.playwright.getByRole("textbox", {
      name: "Search",
      exact: true,
    });
    let searchCount = await search.count();
    const openDeadline = Date.now() + (this.mode === "fast" ? 2000 : 5000);
    while (searchCount !== 1 && Date.now() < openDeadline) {
      if ((await combo.count()) === 1) await combo.click({});
      await this.wait(250);
      search = this.tab.playwright.getByRole("textbox", {
        name: "Search",
        exact: true,
      });
      searchCount = await search.count();
    }
    if (searchCount === 1) {
      try {
        await search.fill(name, {});
      } catch {
        await this.replaceText(search, name);
      }
      await this.wait(this.timings.filter);
    }

    // Operate inside the frame that holds the picker.
    const frame = await this.findFrameWithRole("textbox", "Search");
    const nameLoc = frame.getByText(name, { exact: true });
    const deadline = Date.now() + (this.mode === "fast" ? 3000 : 6000);
    while ((await nameLoc.count().catch(() => 0)) < 1 && Date.now() < deadline) {
      await this.wait(200);
    }
    const count = await nameLoc.count();
    for (let i = 0; i < count; i += 1) {
      const node = nameLoc.nth(i);
      // Nearest ancestor that introduces a namespace token = the row. Each row
      // carries exactly one namespace, so checking that small row is reliable.
      const row = node.locator(
        'xpath=ancestor::*[contains(., "Scheduling") or contains(., "ProjMgmt") or contains(., "Mfg")][1]',
      );
      if ((await row.count().catch(() => 0)) < 1) continue;
      let text = "";
      try {
        text = await row.first().innerText();
      } catch {
        text = "";
      }
      if (text.includes(namespace)) {
        await row.first().click();
        await this.wait(this.timings.settle);
        return;
      }
    }
    throw new Error(`Table not found: ${name} (${namespace})`);
  }

  async addColumnsFromFields(fields) {
    await this.openTab("Columns");
    await this.clickRole("button", "Add Column");
    await this.wait(this.timings.menu);
    await this.clickRole("button", "Columns from Fields...");
    await this.wait(this.timings.fieldReady);

    for (const field of fields) {
      await this.checkField(field);
    }

    await this.clickRole("button", "Add");
    await this.wait(this.timings.addColumns);
    this.note(`Columns added: ${fields.join(", ")}`);
  }

  async addColumnsFromKeyFields(kind = "All Key Fields") {
    await this.openTab("Columns");
    await this.clickRole("button", "Add Column");
    await this.wait(this.timings.menu);
    await this.clickRole("button", "Columns from Key Fields");
    await this.wait(this.timings.menu);
    await this.clickRole("button", kind);
    await this.wait(this.timings.addColumns);
    this.note(`Key columns added: ${kind}`);
  }

  // Add every field of the base table as a column (Add Column > Columns from all
  // Fields). One click; matches a "worksheet with all columns".
  async addAllFieldColumns() {
    await this.backToWorksheetPropertiesIfNeeded();
    await this.openTab("Columns");
    await this.clickRole("button", "Add Column");
    await this.wait(this.timings.menu);
    await this.clickRole("button", "Columns from all Fields");
    await this.wait(this.timings.addColumns);
    this.note("All-field columns added");
  }

  // Enable the Group (GROUP BY) tab. The toggle is the "Switch control" checkbox
  // INSIDE the "Group Data" button â€” clicking the button wrapper does NOT flip it,
  // so click the checkbox (force; it can be visually hidden). Once on, the Column
  // Groups table appears.
  async enableGroupData() {
    await this.backToWorksheetPropertiesIfNeeded();
    await this.openTab("Group");
    await this.wait(this.timings.settle);
    const sw = this.tab.playwright.getByRole("checkbox", { name: "Switch control" });
    if ((await sw.count().catch(() => 0)) >= 1) {
      await sw.nth(0).click({ force: true });
    } else {
      await this.clickRole("button", "Group Data");
    }
    const deadline = Date.now() + (this.mode === "fast" ? 5000 : 9000);
    while (Date.now() < deadline) {
      if (/Grouping Function/i.test(await this.snapshot(16000))) {
        this.note("Group Data enabled");
        return;
      }
      await this.wait(400);
    }
    throw new Error("Group Data did not enable (Column Groups not shown)");
  }

  // Set a column's grouping function in the Group tab's Column Groups grid.
  // header = exact column header; func = Group By | Sum | Running Total | Average |
  // Minimum | Maximum | Associate | Count | Product. (Defaults are Sum for numeric,
  // Minimum for the rest, so prefer distinctive target funcs to avoid ambiguity.)
  async setColumnGrouping(header, func) {
    const FUNCS = ["Running Total", "Group By", "Average", "Minimum",
      "Maximum", "Associate", "Count", "Product", "Sum"];
    const frame = await this.findFrameWithRole("button", "Group Data");
    const esc = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const colCellRe = new RegExp(`^(String|Quantity) ${esc}$`);
    await frame.getByRole("cell", { name: colCellRe }).first().waitFor({ timeout: 8000 });
    // Use the SEMANTIC row (getByRole, not xpath @role='row' â€” rows are <tr> with
    // implicit role). Identify the row by its column cell.
    const row = frame
      .getByRole("row")
      .filter({ has: frame.getByRole("cell", { name: colCellRe }) });
    // The current function is shown as plain text in the 2nd cell; clicking that
    // text opens the menu (the caret is only actionable on hover).
    const txt = (await row.getByRole("cell").nth(1).textContent().catch(() => "")) || "";
    const current = FUNCS.find((f) => txt.includes(f)) || "Minimum";
    await row.getByText(current, { exact: true }).first().click();
    await this.wait(this.timings.dropdown);
    await frame.getByText(func, { exact: true }).last().click();
    await this.wait(this.timings.settle);
    this.note(`Grouping: ${header} -> ${func}`);
  }

  async addRouteOperationPrimaryResourceEfficiencyColumn() {
    if (!this.tab._page) {
      throw new Error(
        "Nested field authoring requires the standalone Playwright adapter",
      );
    }

    await this.openTab("Columns");
    await this.clickRole("button", "Add Column");
    await this.wait(this.timings.menu);
    await this.clickRole("button", "Columns from Fields...");
    await this.wait(this.timings.fieldReady);

    const page = this.tab._page;
    const frame = await this.findFrameWithRole("heading", "Fields");
    await this.expandFieldTreeNode(frame, "RouteOperation Key badge Reference badge", "PrimaryResource");

    const primaryResource = frame.getByRole("checkbox", {
      name: "PrimaryResource Reference badge",
      exact: true,
    });
    if ((await primaryResource.count().catch(() => 0)) === 1) {
      if (await primaryResource.isChecked().catch(() => false)) {
        await primaryResource.uncheck();
      }
    }

    await this.expandFieldTreeNode(frame, "PrimaryResource Reference badge", "Efficiency");

    const list = frame.locator('[role="list"]').first();
    const listBox = await list.boundingBox().catch(() => null);
    if (listBox) {
      await page.mouse.move(listBox.x + listBox.width / 2, listBox.y + listBox.height / 2);
    }
    let efficiency = frame.getByRole("checkbox", {
      name: "Efficiency",
      exact: true,
    });
    let count = await efficiency.count().catch(() => 0);
    for (let i = 0; count !== 1 && i < 8; i += 1) {
      await page.mouse.wheel(0, 180);
      await this.wait(200);
      efficiency = frame.getByRole("checkbox", {
        name: "Efficiency",
        exact: true,
      });
      count = await efficiency.count().catch(() => 0);
    }
    if (count !== 1) {
      throw new Error("Efficiency field checkbox not found under PrimaryResource");
    }

    await efficiency.check();
    await this.wait(this.timings.settle);
    await frame.getByRole("button", { name: "Add", exact: true }).click();
    await this.wait(this.timings.addColumns);
    this.note("Column added: RouteOperation.PrimaryResource.Efficiency");
  }

  async findFrameWithRole(role, name) {
    if (!this.tab._page) throw new Error("Direct Playwright page is unavailable");
    // Retry: the target (e.g. a dialog) may render a moment after the click that
    // triggered it.
    const deadline = Date.now() + (this.mode === "fast" ? 5000 : 9000);
    while (Date.now() < deadline) {
      for (const frame of this.tab._page.frames()) {
        const locator = frame.getByRole(role, { name, exact: true });
        if ((await locator.count().catch(() => 0)) > 0) return frame;
      }
      await this.wait(300);
    }
    throw new Error(`${role} not found in any frame: ${name}`);
  }

  async expandFieldTreeNode(frame, buttonName, expectedChildText) {
    const page = this.tab._page;
    const button = frame.getByRole("button", {
      name: buttonName,
      exact: true,
    });
    await button.scrollIntoViewIfNeeded().catch(() => {});
    await this.wait(150);
    const box = await button.boundingBox();
    if (!box) throw new Error(`Field tree button not visible: ${buttonName}`);

    for (const dx of [-52, -42, -32, -22]) {
      await page.mouse.click(box.x + dx, box.y + box.height / 2);
      await this.wait(500);
      const snapshot = await frame.locator("body").ariaSnapshot();
      if (snapshot.includes(expectedChildText)) return;
    }
    throw new Error(`Could not expand field tree node: ${buttonName}`);
  }

  async setWorksheetFilterExpression(expression) {
    await this.backToWorksheetPropertiesIfNeeded();
    await this.openTab("Filtering");
    const filterExpression = this.tab.playwright.getByRole("textbox", {
      name: "Expression",
      exact: true,
    });
    const count = await filterExpression.count();
    if (count !== 1) {
      throw new Error(`Worksheet filter expression textbox count=${count}`);
    }
    await this.replaceText(filterExpression, expression);
    await this.wait(this.timings.settle);

    const value = await filterExpression.inputValue().catch(async () => {
      const snapshot = await this.snapshot();
      return snapshot.includes(`textbox "Expression": ${expression}`)
        ? expression
        : "";
    });
    if (value !== expression) {
      throw new Error(`Worksheet filter expression was not set: ${expression}`);
    }
    this.note(`Worksheet filter expression set: ${expression}`);
  }

  async backToWorksheetPropertiesIfNeeded() {
    const back = this.tab.playwright.getByRole("button", {
      name: "Back to Worksheet Properties",
      exact: true,
    });
    if ((await back.count()) === 1) {
      await back.click({});
      await this.wait(this.timings.settle);
    }
  }

  // Climb from a column editor / worksheet editor back to workbook-level tabs.
  async backToWorkbookPropertiesIfNeeded() {
    await this.backToWorksheetPropertiesIfNeeded();
    const back = this.tab.playwright.getByRole("button", {
      name: "Back to Workbook Properties",
      exact: true,
    });
    if ((await back.count()) === 1) {
      await back.click({});
      await this.wait(this.timings.settle);
    }
  }

  // WS_10: one row per resource/constraint, all columns expression-based
  // (reference paths + string constants). Ensures target Constraint records
  // exist before SourceConstraint writes. Base table: Resource (Scheduling).
  async addResourceConstraintWorksheet() {
    await this.createTableWorksheet(
      "WS_10_Resource_To_Constraint",
      "Resource",
      { namespace: "Scheduling" },
    );
    const columns = [
      ["ResourceName", "Name"],
      ["ResourceSite", "Area.Site"],
      ["ConstraintName", "Constraint.Name"],
      ["ConstraintSite", "Constraint.Site"],
      ["ConstraintTypeValue", "'Constrained'"],
      ["ConstraintUOMValue", "'HR'"],
      ["ConstraintCalendarValue", "'Workday'"],
      ["KeyConstraint", "'N'"],
      ["EfficiencyValue", "Efficiency"],
    ];
    for (const [name, expression] of columns) {
      await this.addCalculatedColumn(name, expression);
    }
    await this.setWorksheetFilterExpression("Constraint.Name <> ''");
    this.note("Worksheet WS_10_Resource_To_Constraint authored");
  }

  // WS_31: rows with bad/missing source data. A row here = a problem the script
  // gate counts. Clean data yields 0 rows.
  async addBadDataCheckWorksheet() {
    await this.createTableWorksheet("WS_31_Bad_Data_Check", "RouteOperationSegment");
    await this.addColumnsFromFields(["Rate", "Sequence"]);
    await this.setWorksheetFilterExpression("Rate <= 0");
    this.note("Worksheet WS_31_Bad_Data_Check authored");
  }

  // WS_33: factor outliers (very low rate => very high hrs/unit). Flags
  // ConstraintFactor >= 0.1 hr/unit (Rate <= 240/day). A row here = review item.
  async addOutlierCheckWorksheet() {
    await this.createTableWorksheet("WS_33_Outlier_Check", "RouteOperationSegment");
    await this.addColumnsFromFields(["Rate"]);
    await this.addCalculatedColumn("ConstraintFactor", "DIV(24, Rate, 0, 0)", {
      decimalPlaces: 4,
    });
    await this.setWorksheetFilterExpression("DIV(24, Rate, 0, 0) >= 0.1");
    this.note("Worksheet WS_33_Outlier_Check authored");
  }

  async checkField(field) {
    let name = field;
    if (field === "OperationSegmentType") {
      name = "OperationSegmentType Key badge ArrowUpward badge";
    }
    const treeitem = this.tab.playwright.getByRole("treeitem", {
      name,
      exact: true,
    });
    const count = await treeitem.count();
    if (count !== 1) {
      throw new Error(`Field treeitem not found: ${field}; count=${count}`);
    }
    const checkbox = treeitem.getByRole("checkbox");
    const checkboxCount = await checkbox.count();
    if (checkboxCount !== 1) {
      throw new Error(
        `Field checkbox not found in treeitem: ${field}; count=${checkboxCount}`,
      );
    }
    await checkbox.click({ force: true });
    await this.wait(this.mode === "fast" ? 50 : 150);
  }

  // Add a calculated column: Add Column > New Column, set its name, then enter
  // an expression into the Monaco editor. Resilient to already being inside the
  // column editor (clicks "Back to Worksheet Properties" first if present).
  async addCalculatedColumn(name, expression, { decimalPlaces } = {}) {
    const back = this.tab.playwright.getByRole("button", {
      name: "Back to Worksheet Properties",
      exact: true,
    });
    if ((await back.count()) === 1) {
      await back.click({});
      await this.wait(this.timings.settle);
    }

    await this.openTab("Columns");
    await this.clickRole("button", "Add Column");
    await this.wait(this.timings.menu);
    await this.clickRole("button", "New Column");
    await this.wait(this.timings.createResource);

    // In the column editor the MUI name/id inputs have no stable accessible name
    // (GUID ids, no placeholder/aria-label). But the editor shows exactly two
    // visible text inputs â€” [display name, id] â€” so target the first positionally.
    // (The Monaco expression editor is a <textarea>, not input[type=text], so it
    // is not counted here.)
    await this.fillTextInput(0, name);
    await this.wait(this.timings.settle);

    await this.setColumnExpression(expression);
    if (decimalPlaces !== undefined && decimalPlaces !== null) {
      await this.setQuantityDecimalPlaces(decimalPlaces);
    }
    this.note(`Calculated column added: ${name} = ${expression}`);
  }

  // Enter an expression into the column's Monaco editor.
  async setColumnExpression(expression) {
    // Scope to the actual code editor (role="code"); the page also contains a
    // hidden Monaco rename widget (.monaco-editor.rename-box) that must not match.
    const editor = this.tab.playwright
      .locator('.monaco-editor[role="code"]')
      .nth(0);
    let count = await editor.count();
    const deadline = Date.now() + (this.mode === "fast" ? 8000 : 12000);
    while (count < 1 && Date.now() < deadline) {
      await this.wait(150);
      count = await editor.count();
    }
    if (count < 1) throw new Error("Monaco expression editor not found");

    await editor.click({}); // focuses Monaco's hidden input
    await this.wait(this.timings.settle);

    // Clear any default content, then insert literally.
    if (this.tab.cua && this.tab.clipboard) {
      await this.tab.cua.keypress({ keys: ["CTRL", "A"] });
      await this.tab.cua.keypress({ keys: ["BACKSPACE"] });
      await this.tab.clipboard.writeText(expression);
      await this.tab.cua.keypress({ keys: ["CTRL", "V"] });
    } else if (this.tab.keyboard) {
      await this.tab.keyboard.press("Control+A");
      await this.tab.keyboard.press("Delete");
      await this.tab.keyboard.insertText(expression);
    } else {
      // Fallback for harnesses without keyboard.insertText. Plain typing may
      // auto-close brackets, so this is best-effort only.
      await editor.type(expression, {});
    }
    await this.wait(this.timings.settle);
  }

  // The Formatting "Decimal places" control is intermittently slow to appear and
  // its widget shape varies (combobox/dialog/textbox). Retry a few times, and if
  // it still can't be driven, WARN and move on â€” decimals are cosmetic and must
  // not crash an entire build.
  async setQuantityDecimalPlaces(decimalPlaces) {
    const value = String(decimalPlaces);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await this._trySetDecimalPlaces(value)) return;
      await this.wait(this.timings.settle);
    }
    this.note(`âš  Decimal places control not found â€” left at default for this column`);
  }

  async _trySetDecimalPlaces(value) {
    await this.openTab("Formatting");
    const readyDeadline = Date.now() + (this.mode === "fast" ? 6000 : 10000);
    while (Date.now() < readyDeadline) {
      const snapshot = await this.snapshot(16000);
      if (snapshot.includes('combobox "Decimal places"')) break;
      await this.wait(250);
    }

    if (this.tab._page) {
      const page = this.tab._page;
      for (const frame of page.frames()) {
        const frameCombo = frame.getByRole("combobox", {
          name: "Decimal places",
          exact: true,
        });
        if ((await frameCombo.count().catch(() => 0)) !== 1) continue;
        await frameCombo.click({});
        await page.waitForTimeout(this.timings.menu);
        const item = frame.locator(
          `role=dialog[name="Decimal places"] >> text="${value}"`,
        );
        if ((await item.count().catch(() => 0)) === 1) {
          await item.click({});
          await page.waitForTimeout(this.timings.settle);
          if ((await frameCombo.inputValue().catch(() => "")) === value) {
            this.note(`Decimal places set: ${value}`);
            return true;
          }
        }
      }
    }

    const combo = this.tab.playwright.getByRole("combobox", {
      name: "Decimal places",
      exact: true,
    });
    if ((await combo.count()) === 1) {
      await combo.click({});
      await this.wait(this.timings.menu);
      const option = this.tab.playwright.getByRole("option", {
        name: value,
        exact: true,
      });
      if ((await option.count()) === 1) {
        await option.click({});
        await this.wait(this.timings.settle);
        this.note(`Decimal places set: ${value}`);
        return true;
      }
      const dialog = this.tab.playwright.getByRole("dialog", {
        name: "Decimal places",
        exact: true,
      });
      if ((await dialog.count()) === 1) {
        const item = this.tab.playwright.locator(
          `role=dialog[name="Decimal places"] >> text="${value}"`,
        );
        if ((await item.count()) === 1) {
          await item.click({});
          await this.wait(this.timings.settle);
          const snapshot = await this.snapshot();
          if (snapshot.includes(`combobox "Decimal places": "${value}"`)) {
            this.note(`Decimal places set: ${value}`);
            return true;
          }
        }
      }
    }

    const textbox = this.tab.playwright.getByRole("textbox", {
      name: "Decimal places",
      exact: true,
    });
    if ((await textbox.count()) === 1) {
      await this.replaceText(textbox, value);
      await this.wait(this.timings.settle);
      this.note(`Decimal places set: ${value}`);
      return true;
    }

    return false;
  }

  // Open the Expression Builder from a column editor, navigate the field tree, and
  // return the EXACT inserted reference for a field â€” including custom-field
  // namespaces (e.g. RouteOperation.PernodRicard::CrewSize). Use this to RESOLVE a
  // path instead of guessing. navPath = node names from the base table to the leaf,
  // e.g. ["RouteOperation", "CrewSize"]; the last entry is the field to insert.
  async resolveFieldPath(navPath) {
    if (!this.tab._page) {
      throw new Error("Expression Builder requires the Playwright adapter");
    }
    const page = this.tab._page;
    await this.clickRole("button", "View full expression builder");
    await this.wait(this.timings.createResource);
    const frame = await this.findFrameWithRole("dialog", "Expression Builder");
    for (let i = 0; i < navPath.length - 1; i += 1) {
      await this._expandBuilderNode(frame, page, navPath[i]);
    }
    const leaf = navPath[navPath.length - 1];
    await frame.getByRole("button", { name: leaf, exact: true }).first().dblclick();
    await this.wait(this.timings.settle);
    const inserted = await page.evaluate((fn) => {
      const models = window.monaco && monaco.editor ? monaco.editor.getModels() : [];
      const vals = models.map((m) => m.getValue());
      return vals.find((v) => v && v.includes(fn)) || "";
    }, leaf);
    await frame.getByRole("button", { name: "Cancel", exact: true }).click().catch(() => {});
    await this.wait(this.timings.settle);
    this.note(`Resolved ${navPath.join(".")} -> ${inserted.trim()}`);
    return inserted.trim();
  }

  // Expand a reference node in the builder's field tree. Single-click only selects;
  // the disclosure caret sits at the LEFT of the treeitem, so click by offset.
  async _expandBuilderNode(frame, page, nodeName) {
    const item = frame.getByRole("treeitem", { name: nodeName, exact: true });
    await item.first().waitFor({ timeout: 8000 });
    const box = await item.first().boundingBox();
    if (!box) throw new Error(`Builder tree node not visible: ${nodeName}`);
    for (const dx of [16, 10, 22, 6, 28, 2]) {
      await page.mouse.click(box.x + dx, box.y + box.height / 2);
      await this.wait(700);
      const snap = await frame.locator("body").ariaSnapshot().catch(() => "");
      if (new RegExp(`treeitem "${nodeName}" \\[expanded\\]`).test(snap)) return;
    }
    throw new Error(`Could not expand builder node: ${nodeName}`);
  }

  // Author a calculated column whose expression is assembled IN the Expression
  // Builder, so field references (esp. namespaced custom fields) are inserted
  // correctly. parts = array of either a literal string or { field: navPath }.
  // e.g. ["DIV(24 * ", { field: ["RouteOperation", "CrewSize"] }, ", Rate, 0, 0)"].
  async addCalculatedColumnViaBuilder(name, parts) {
    if (!this.tab._page) {
      throw new Error("Expression Builder requires the Playwright adapter");
    }
    const page = this.tab._page;
    const back = this.tab.playwright.getByRole("button", {
      name: "Back to Worksheet Properties",
      exact: true,
    });
    if ((await back.count()) === 1) {
      await back.click({});
      await this.wait(this.timings.settle);
    }
    await this.openTab("Columns");
    await this.clickRole("button", "Add Column");
    await this.wait(this.timings.menu);
    await this.clickRole("button", "New Column");
    await this.wait(this.timings.createResource);
    await this.fillTextInput(0, name);
    await this.wait(this.timings.settle);

    await this.clickRole("button", "View full expression builder");
    await this.wait(this.timings.createResource);
    const frame = await this.findFrameWithRole("dialog", "Expression Builder");
    // scope the editor to the BUILDER dialog â€” there's another Monaco (the column
    // editor) behind it that would intercept clicks.
    const dialog = frame.getByRole("dialog", { name: "Expression Builder", exact: true });
    const editor = dialog.locator('.monaco-editor[role="code"]').first();
    await editor.click();

    // Deterministic assembly. Typing into the builder's Monaco is unreliable:
    // multi-char insertText drops ~every other glyph, and "(" triggers bracket
    // auto-close that strands a ")". So instead we (1) resolve each field's exact
    // namespaced path via the proven double-click mechanic, reading the result
    // straight from the model, then (2) build the full expression string in JS and
    // setValue it verbatim into the builder editor — no typing, no auto-close.
    // This Monaco build exposes monaco.editor.getModels() but NOT getEditors().
    // We identify the builder's model by URI: right after a field double-click the
    // builder model is the only non-empty one (the column editor behind it is
    // empty for a new column), so we capture its URI and drive get/set through it.
    let builderUri = "";
    const readBuilder = async () =>
      page.evaluate((uri) => {
        const ms = window.monaco && monaco.editor ? monaco.editor.getModels() : [];
        let m = uri ? ms.find((x) => x.uri.toString() === uri) : null;
        if (!m) {
          const nonEmpty = ms.filter((x) => x.getValue().trim().length > 0);
          m = nonEmpty.sort((a, b) => b.getValue().length - a.getValue().length)[0];
        }
        return m ? { uri: m.uri.toString(), value: m.getValue() } : { uri: "", value: "" };
      }, builderUri);
    const writeBuilder = async (val) =>
      page.evaluate(
        ({ uri, val }) => {
          const ms = window.monaco && monaco.editor ? monaco.editor.getModels() : [];
          const m = ms.find((x) => x.uri.toString() === uri);
          if (m) m.setValue(val);
          return m ? m.getValue() : "";
        },
        { uri: builderUri, val }
      );
    const clearBuilder = async () => {
      await editor.click();
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Delete");
      await this.wait(80);
    };

    // (1) Resolve each field part to its exact inserted path.
    const fieldPaths = [];
    for (const part of parts) {
      if (part && part.field) {
        const nav = part.field;
        await clearBuilder();
        for (let i = 0; i < nav.length - 1; i += 1) {
          await this._expandBuilderNode(frame, page, nav[i]);
        }
        await frame.getByRole("button", { name: nav[nav.length - 1], exact: true }).first().dblclick();
        await this.wait(this.timings.settle);
        const r = await readBuilder();
        if (r.uri) builderUri = r.uri; // lock onto the builder model
        fieldPaths.push(r.value.trim());
      }
    }

    // (2) Assemble verbatim and write it in one shot (no typing → no mangling).
    let fi = 0;
    const expression = parts
      .map((part) => (typeof part === "string" ? part : fieldPaths[fi++]))
      .join("");
    await clearBuilder();
    await writeBuilder(expression);
    await this.wait(this.timings.settle);
    const built = (await readBuilder()).value.trim();

    await frame.getByRole("button", { name: "Ok", exact: true }).click();
    await this.wait(this.timings.settle);
    this.note(`Calculated column via builder: ${name} => ${built || "(unread)"}`);
    return built;
  }

  async assertNoInvalidColumns() {
    const snapshot = await this.snapshot(16000);
    // Two distinct failure signals: the "Invalid column" badge, AND a column whose
    // EXPRESSION errors (e.g. a bad/namespaced field path) shows "There is an error
    // in your column's data expression" / "No Data Yet". Greping only the first
    // gave false passes. Catch both.
    if (snapshot.includes("Invalid column")) {
      throw new Error("Invalid column badge detected");
    }
    if (/error in your column.?s data expression/i.test(snapshot)) {
      throw new Error("Column data expression error detected");
    }
    this.note("No invalid columns detected");
  }

  async saveWorkbook() {
    const create = this.tab.playwright.getByRole("button", {
      name: "Create",
      exact: true,
    });
    const count = await create.count();
    if (count !== 1) throw new Error(`Create button count=${count}`);
    let enabled = await create.isEnabled();
    const deadline = Date.now() + (this.mode === "fast" ? 12000 : 16000);
    while (!enabled && Date.now() < deadline) {
      await this.wait(200);
      enabled = await create.isEnabled();
    }
    if (!enabled) throw new Error("Create button is disabled");
    await create.click({});
    let snapshot = "";
    const savedDeadline = Date.now() + (this.mode === "fast" ? 10000 : 16000);
    do {
      await this.wait(this.mode === "fast" ? 250 : 500);
      snapshot = await this.snapshot();
    } while (
      !snapshot.includes("Workbook successfully saved") &&
      !snapshot.includes('button "Save"') &&
      !snapshot.includes('tooltip "Open Workbook (Ctrl+O)"') &&
      Date.now() < savedDeadline
    );
    if (
      !snapshot.includes("Workbook successfully saved") &&
      !snapshot.includes('button "Save"') &&
      !snapshot.includes('tooltip "Open Workbook (Ctrl+O)"')
    ) {
      throw new Error("Workbook save confirmation not detected");
    }
    this.note("Workbook saved");
  }

  async openWorkbookData({ site = "MKM" } = {}) {
    let snapshot = await this.snapshot();
    if (!snapshot.includes('dialog "Data Settings"')) {
      const currentUrl = (await this.tab.url()) || "";
      if (!currentUrl.includes("#type=Workbook")) {
        const openWorkbook = this.tab.playwright.getByRole("button", {
          name: "Open Workbook (Ctrl+O)",
          exact: true,
        });
        const openCount = await openWorkbook.count();
        if (openCount === 1) {
          await openWorkbook.click({});
        } else if (snapshot.includes('tooltip "Open Workbook (Ctrl+O)"')) {
          await this.pressOpenWorkbookShortcut();
        } else {
          throw new Error(`Open Workbook button count=${openCount}`);
        }
      }
      const deadline = Date.now() + (this.mode === "fast" ? 30000 : 45000);
      do {
        await this.wait(this.mode === "fast" ? 250 : 500);
        snapshot = await this.snapshot();
      } while (
        !snapshot.includes('dialog "Data Settings"') &&
        Date.now() < deadline
      );
    }
    snapshot = await this.snapshot(16000);
    if (!snapshot.includes('dialog "Data Settings"')) {
      throw new Error("Data Settings dialog did not open");
    }

    if (snapshot.includes("Site All Sites Dropdown")) {
      await this.chooseDropdownValue("Site", site);
    }

    // The dialog's "Open" button can render a beat after the dialog appears, so
    // wait for it rather than clicking blindly (clickRole has no retry).
    const openBtn = this.tab.playwright.getByRole("button", {
      name: "Open",
      exact: true,
    });
    let openBtnCount = await openBtn.count();
    const openBtnDeadline = Date.now() + (this.mode === "fast" ? 4000 : 8000);
    while (openBtnCount !== 1 && Date.now() < openBtnDeadline) {
      await this.wait(250);
      openBtnCount = await openBtn.count();
    }
    if (openBtnCount !== 1) {
      throw new Error(`Data Settings 'Open' button count=${openBtnCount}`);
    }
    await openBtn.click({});
    await this.wait(this.timings.loadGrid);
    this.note(`Workbook opened with site ${site}`);
  }

  async assertGridLoaded({ expectedRowsText }) {
    // Grids can take a while to render (a multi-thousand-row worksheet, or the
    // first worksheet of a multi-worksheet workbook), so poll rather than check
    // once.
    const deadline = Date.now() + (this.mode === "fast" ? 10000 : 18000);
    let snapshot = await this.snapshot(16000);
    while (!snapshot.includes("treegrid") && Date.now() < deadline) {
      await this.wait(500);
      snapshot = await this.snapshot(16000);
    }
    if (!snapshot.includes("treegrid")) {
      throw new Error("Worksheet grid did not load");
    }
    if (expectedRowsText) {
      while (!snapshot.includes(expectedRowsText) && Date.now() < deadline) {
        await this.wait(500);
        snapshot = await this.snapshot(16000);
      }
      if (!snapshot.includes(expectedRowsText)) {
        throw new Error(`Expected row count text not found: ${expectedRowsText}`);
      }
    }
    this.note("Worksheet grid loaded");
  }

  async chooseDropdownValue(label, value) {
    const combo = this.tab.playwright.getByRole("combobox", {
      name: label,
      exact: true,
    });
    const button = this.tab.playwright.getByRole("button", {
      name: `${label} All Sites Dropdown`,
      exact: true,
    });
    // The dropdown control can render slightly late â€” retry rather than throwing
    // on the first miss (the "Dropdown not found: Table" flake).
    let opened = false;
    const dropdownDeadline = Date.now() + (this.mode === "fast" ? 8000 : 15000);
    while (!opened && Date.now() < dropdownDeadline) {
      if ((await combo.count().catch(() => 0)) === 1) {
        await combo.click({});
        opened = true;
      } else if ((await button.count().catch(() => 0)) === 1) {
        await button.click({});
        opened = true;
      } else {
        await this.wait(300);
      }
    }
    if (!opened) throw new Error(`Dropdown not found: ${label}`);

    await this.wait(this.timings.dropdown);
    let search = this.tab.playwright.getByRole("textbox", {
      name: "Search",
      exact: true,
    });
    let searchCount = await search.count();
    const openDeadline = Date.now() + (this.mode === "fast" ? 2000 : 5000);
    while (searchCount !== 1 && Date.now() < openDeadline) {
      if ((await combo.count()) === 1) await combo.click({});
      await this.wait(250);
      search = this.tab.playwright.getByRole("textbox", {
        name: "Search",
        exact: true,
      });
      searchCount = await search.count();
    }

    if (searchCount === 1) {
      try {
        await search.fill(value, {});
      } catch {
        await this.replaceText(search, value);
      }
      await this.wait(this.timings.filter);
    }

    const result = this.tab.playwright.getByText(value, { exact: true });
    let resultCount = await result.count();
    const deadline = Date.now() + (this.mode === "fast" ? 2000 : 5000);
    while (resultCount !== 1 && Date.now() < deadline) {
      await this.wait(200);
      resultCount = await result.count();
    }
    if (resultCount !== 1) {
      throw new Error(`Dropdown result not unique for ${value}: ${resultCount}`);
    }
    await result.click({});
    await this.wait(this.timings.settle);
  }

  async openTab(name) {
    const tab = this.tab.playwright.getByRole("tab", { name, exact: true });
    // Tabs can render slightly late after a panel switch â€” retry rather than
    // throwing on the first miss.
    let count = await tab.count();
    const deadline = Date.now() + (this.mode === "fast" ? 4000 : 8000);
    while (count !== 1 && Date.now() < deadline) {
      await this.wait(300);
      count = await tab.count();
    }
    if (count !== 1) throw new Error(`Tab not found: ${name}; count=${count}`);
    await tab.click({});
    await this.wait(this.timings.settle);
  }

  async clickRole(role, name) {
    const locator = this.tab.playwright.getByRole(role, { name, exact: true });
    const count = await locator.count();
    if (count !== 1) {
      throw new Error(`${role} not found: ${name}; count=${count}`);
    }
    await locator.click({});
  }

  async pressOpenWorkbookShortcut() {
    if (this.tab.keyboard) {
      await this.tab.keyboard.press("Control+O");
      return;
    }

    const properties = this.tab.playwright.getByRole("button", {
      name: "Properties",
      exact: true,
    });
    if ((await properties.count()) === 1) {
      await properties.press("Control+O", {});
      return;
    }

    const moreActions = this.tab.playwright.getByRole("button", {
      name: "More actions",
      exact: true,
    });
    if ((await moreActions.count()) === 1) {
      await moreActions.press("Control+O", {});
      return;
    }

    throw new Error("No visible toolbar target for Open Workbook shortcut");
  }

  async fillTextInput(index, value) {
    let inputs = this.visibleTextInputs();
    let count = await inputs.count();
    const deadline = Date.now() + (this.mode === "fast" ? 15000 : 20000);
    while (count <= index && Date.now() < deadline) {
      await this.wait(100);
      inputs = this.visibleTextInputs();
      count = await inputs.count();
    }
    if (count <= index) {
      throw new Error(`Text input index ${index} missing; count=${count}`);
    }
    await this.replaceText(inputs.nth(index), value);
  }

  visibleTextInputs() {
    return this.tab.playwright
      .locator('input[type="text"]')
      .filter({ visible: true });
  }

  async replaceText(locator, value) {
    const text = String(value);
    try {
      await locator.click({});
      await locator.fill(text, {});
      return;
    } catch {
      // The in-app browser sometimes refuses direct fill with a virtual clipboard
      // error. Keystrokes are slower, but reliable enough as a fallback.
    }

    await locator.click({});
    let cleared = false;
    try {
      await locator.press("Control+A", {});
      await locator.press("Backspace", {});
      cleared = true;
    } catch {
      cleared = false;
    }
    if (!cleared) {
      for (let i = 0; i < 80; i += 1) {
        await this.tab.cua.keypress({ keys: ["Backspace"] });
      }
    }
    try {
      await locator.type(text, {});
      return;
    } catch {
      // Last resort for fields where bulk typing is not accepted.
    }
    try {
      await this.tab.dom_cua.type({ text });
      return;
    } catch {
      // Fall through to character keypresses for older browser-control builds.
    }
    for (const char of text) {
      await this.tab.cua.keypress({ keys: [char] });
    }
  }

  async snapshot(limit = 8000) {
    return (await this.tab.playwright.domSnapshot()).slice(0, limit);
  }

  async wait(ms) {
    await this.tab.playwright.waitForTimeout(ms);
  }
}

// ---------------------------------------------------------------------------
// Standalone CLI
//
// The MaestroAuthoringRun engine talks to a small browser/tab interface:
//   browser.capabilities.get(name).set(value)
//   browser.tabs.list()/get(id)/new()
//   tab.url()/title()/goto(url)
//   tab.playwright.{getByRole,getByText,locator,waitForTimeout,domSnapshot}
//   tab.cua.keypress({ keys })
// When run standalone, launchBrowser() supplies that interface backed by a real
// Playwright (chromium) session using a persistent profile so the Maestro login
// survives between runs. Requires `npm i playwright`.
// ---------------------------------------------------------------------------

const CLI_DEFAULTS = {
  workbook: undefined,
  worksheet: "WS_20_Routing_To_SourceConstraint",
  table: "RouteOperationSegment",
  site: "MKM",
  mode: "safe",
  url: APP_URL,
  "user-data-dir": path.join(os.homedir(), ".maestro-authoring-profile"),
  "login-timeout": 180000,
  "worksheet-filter": "",
  "expected-rows": "1617 rows",
  cdp: "",
  "all-key-fields": false,
  "resource-efficiency": false,
  "constraint-factor": false,
  "constraint-factor-expression":
    "DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)",
  "constraint-factor-decimals": "4",
  "resource-constraint-worksheet": false,
  "check-worksheets": false,
  headless: false,
  "keep-open": false,
  help: false,
};

const CLI_FLAGS = new Set([
  "all-key-fields",
  "resource-efficiency",
  "constraint-factor",
  "resource-constraint-worksheet",
  "check-worksheets",
  "headless",
  "keep-open",
  "help",
]);

export function parseArgs(argv = []) {
  const args = { ...CLI_DEFAULTS };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    if (!(key in CLI_DEFAULTS)) {
      throw new Error(`Unknown option: --${key}`);
    }
    if (CLI_FLAGS.has(key)) {
      args[key] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  if (typeof args["login-timeout"] === "string") {
    args["login-timeout"] = Number(args["login-timeout"]);
  }
  return args;
}

export function printUsage(out = console.log) {
  out(
    [
      "Usage: node maestro-authoring.mjs --workbook <name> [options]",
      "",
      "Builds the routingâ†’SourceConstraint workbook in the Maestro web UI.",
      "Requires Playwright: npm i playwright",
      "",
      "Required:",
      "  --workbook <name>        Workbook name to create",
      "",
      "Options:",
      `  --worksheet <name>       Worksheet name (default: ${CLI_DEFAULTS.worksheet})`,
      `  --table <name>           Base table (default: ${CLI_DEFAULTS.table})`,
      `  --site <code>            Site filter (default: ${CLI_DEFAULTS.site})`,
      "  --mode <safe|fast>       Timing profile (default: safe)",
      "  --url <appUrl>           Maestro app URL (default: PR DEV01)",
      "  --user-data-dir <path>   Chromium profile dir (keeps you logged in)",
      "  --cdp <url>              Attach to a running session (e.g. http://localhost:9222 from session.mjs) instead of launching/logging in",
      "  --login-timeout <ms>     How long to wait for manual login (default: 180000)",
      "  --worksheet-filter <expr> Worksheet filter expression to set before saving",
      "  --expected-rows <text>    Row-count text expected after opening (default: 1617 rows)",
      "  --all-key-fields         Add all key fields for the worksheet table and referenced keys",
      "  --resource-efficiency    Add RouteOperation.PrimaryResource.Efficiency as an explicit source column",
      "  --constraint-factor      Add ConstraintFactor = DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)",
      "  --constraint-factor-expression <expr> Override the ConstraintFactor expression",
      "  --constraint-factor-decimals <n> Decimal places for ConstraintFactor (default: 4)",
      "  --resource-constraint-worksheet  Also build WS_10_Resource_To_Constraint (Resource (Scheduling))",
      "  --check-worksheets       Also build WS_31_Bad_Data_Check + WS_33_Outlier_Check",
      "  --headless               Run without a visible window (login must already be cached)",
      "  --keep-open              Leave the browser open after finishing",
      "  --help                   Show this help",
    ].join("\n"),
  );
}

// A locator that transparently searches the main document AND every child frame,
// resolving (at call time) to whichever frame currently has the most matches.
// The Maestro shell renders panels/dialogs inside iframes, which a plain
// page.getByRole() (main frame only) cannot see â€” this makes the engine's
// existing selectors work across that frame boundary without changing the engine.
function frameSpanningLocator(page, makeLocator) {
  async function resolve() {
    let best = null;
    let bestCount = -1;
    for (const frame of page.frames()) {
      let locator;
      try {
        locator = makeLocator(frame);
      } catch {
        continue;
      }
      let count = 0;
      try {
        count = await locator.count();
      } catch {
        count = 0;
      }
      if (count > bestCount) {
        best = locator;
        bestCount = count;
      }
    }
    return best || makeLocator(page.mainFrame());
  }
  return {
    count: async () => (await resolve()).count(),
    click: async (opts) => (await resolve()).click(opts),
    isEnabled: async () => (await resolve()).isEnabled(),
    check: async (opts) => (await resolve()).check(opts),
    fill: async (text, opts) => (await resolve()).fill(text, opts),
    type: async (text, opts) => (await resolve()).type(text, opts),
    press: async (key, opts) => (await resolve()).press(key, opts),
    nth: (index) =>
      frameSpanningLocator(page, (scope) => makeLocator(scope).nth(index)),
    filter: (opts) =>
      frameSpanningLocator(page, (scope) => makeLocator(scope).filter(opts)),
  };
}

// Wrap a Playwright Page in the tab interface the engine expects.
function wrapTab(page) {
  return {
    playwright: {
      getByRole: (role, opts) =>
        frameSpanningLocator(page, (scope) => scope.getByRole(role, opts)),
      getByText: (text, opts) =>
        frameSpanningLocator(page, (scope) => scope.getByText(text, opts)),
      locator: (selector) =>
        frameSpanningLocator(page, (scope) => scope.locator(selector)),
      waitForTimeout: (ms) => page.waitForTimeout(ms),
      domSnapshot: async () => {
        const parts = [];
        for (const frame of page.frames()) {
          try {
            parts.push(await frame.locator("body").ariaSnapshot());
          } catch {
            // frame may be detached/navigating; skip it
          }
        }
        return parts.join("\n");
      },
    },
    cua: {
      keypress: async ({ keys }) => {
        for (const key of keys) {
          try {
            await page.keyboard.press(key);
          } catch {
            await page.keyboard.type(key);
          }
        }
      },
    },
    // Direct keyboard access. insertText injects text via an input event WITHOUT
    // keydown, so editors that auto-close brackets (Monaco) don't mangle
    // expressions like DIV(24 * Efficiency, Rate, 0, 0).
    keyboard: {
      insertText: async (text) => page.keyboard.insertText(text),
      press: async (key) => page.keyboard.press(key),
    },
    url: async () => page.url(),
    title: async () => page.title(),
    goto: async (url) => {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    },
    _page: page,
  };
}

function makeBrowserShim(context, page) {
  return {
    capabilities: {
      get: async (name) => ({
        set: async (value) => {
          if (name === "viewport" && value) {
            // Attached (CDP) tabs may reject viewport emulation; ignore if so.
            try {
              await page.setViewportSize(value);
            } catch {
              /* leave the real window size as-is */
            }
          }
          // "visibility" is a no-op: a headed window is already shown.
        },
      }),
    },
    tabs: {
      list: async () =>
        context.pages().map((pg, index) => ({ id: index, url: pg.url() })),
      get: async (id) => wrapTab(context.pages()[id] || page),
      new: async () => wrapTab(await context.newPage()),
    },
  };
}

export async function launchBrowser({
  userDataDir = CLI_DEFAULTS["user-data-dir"],
  headless = false,
  cdpEndpoint = null,
} = {}) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is not installed. Run: npm i playwright  (then npx playwright install chromium)",
    );
  }

  // Attach to a long-lived Chrome (started by session.mjs) so the Maestro login
  // is reused across runs instead of logging in every time.
  if (cdpEndpoint) {
    let conn;
    try {
      conn = await chromium.connectOverCDP(cdpEndpoint);
    } catch (err) {
      throw new Error(
        `Could not attach to Chrome at ${cdpEndpoint}. ` +
          `Start the session first (node session.mjs), log in, leave it open. ` +
          `(${(err && err.message) || err})`,
      );
    }
    const context = conn.contexts()[0] || (await conn.newContext());
    const page =
      context.pages().find((p) => (p.url() || "").includes("kinaxis")) ||
      context.pages()[0] ||
      (await context.newPage());
    return {
      browser: makeBrowserShim(context, page),
      tab: wrapTab(page),
      context,
      // Disconnect the CDP client so the Node process can exit (connectOverCDP
      // holds an open websocket that otherwise keeps Node alive forever).
      // connectOverCDP's close() only DISCONNECTS â€” it does NOT terminate the
      // externally-launched browser, so the long-lived session survives.
      close: async () => {
        try {
          await conn.close();
        } catch {
          /* already disconnected */
        }
      },
    };
  }

  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      viewport: null,
      args: ["--start-maximized"],
    });
  } catch (err) {
    const message = String((err && err.message) || err || "");
    if (/ProcessSingleton|already (in use|running)|SingletonLock/i.test(message)) {
      throw new Error(
        `The profile at ${userDataDir} is already in use by another Chromium. ` +
          "Close that window (or pass a different --user-data-dir) and retry.",
      );
    }
    throw err;
  }
  const page = context.pages()[0] || (await context.newPage());
  return {
    browser: makeBrowserShim(context, page),
    tab: wrapTab(page),
    context,
    close: async () => {
      try {
        await context.close();
      } catch {
        /* ignore */
      }
    },
  };
}

function isClosedError(err) {
  const message = String((err && err.message) || err || "");
  return /has been closed|Target page|Target closed|browser has been closed/i.test(
    message,
  );
}

// Poll until the Maestro shell is present, giving the user time to log in.
async function waitForAppShell(tab, { timeoutMs, logger }) {
  const deadline = Date.now() + timeoutMs;
  let announced = false;
  while (Date.now() < deadline) {
    let snapshot = "";
    try {
      snapshot = await tab.playwright.domSnapshot();
    } catch (err) {
      if (isClosedError(err)) {
        throw new Error(
          "Browser window was closed before login completed. " +
            "Re-run and leave the opened window up until the Maestro home loads.",
        );
      }
      snapshot = "";
    }
    if (
      snapshot.includes('button "Resources"') ||
      snapshot.includes('heading "Resources"')
    ) {
      return true;
    }
    if (!announced) {
      logger("Waiting for Maestro login â€” log in in the opened browser windowâ€¦");
      announced = true;
    }
    try {
      await tab.playwright.waitForTimeout(2000);
    } catch (err) {
      if (isClosedError(err)) {
        throw new Error(
          "Browser window was closed before login completed. " +
            "Re-run and leave the opened window up until the Maestro home loads.",
        );
      }
      throw err;
    }
  }
  return false;
}

export async function main(
  argv =
    typeof process !== "undefined" && Array.isArray(process.argv)
      ? process.argv.slice(2)
      : [],
) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    console.error(`âœ— ${err.message}\n`);
    printUsage(console.error);
    return 2;
  }

  if (args.help) {
    printUsage();
    return 0;
  }
  if (!args.workbook) {
    console.error("âœ— --workbook is required\n");
    printUsage(console.error);
    return 2;
  }

  const steps = [];
  const logger = (message) => {
    steps.push(message);
    console.error(`â€¢ ${message}`);
  };

  let context;
  let closeBrowser = async () => {};
  const keepOpen = !!args["keep-open"];
  try {
    const launched = await launchBrowser({
      userDataDir: args["user-data-dir"],
      headless: !!args.headless,
      cdpEndpoint: args.cdp || null,
    });
    context = launched.context;
    closeBrowser = launched.close || (async () => {});
    const { browser, tab } = launched;

    await tab.goto(args.url);
    const shellReady = await waitForAppShell(tab, {
      timeoutMs: Number(args["login-timeout"]) || 180000,
      logger,
    });
    if (!shellReady) {
      throw new Error(
        "Timed out waiting for the Maestro app shell. Are you logged in?",
      );
    }

    const result = await createRoutingWorkbook({
      browser,
      tab,
      workbookName: args.workbook,
      worksheetName: args.worksheet,
      tableName: args.table,
      site: args.site,
      mode: args.mode === "fast" ? "fast" : "safe",
      appUrl: args.url,
      includeAllKeyFields: !!args["all-key-fields"],
      includeResourceEfficiency: !!args["resource-efficiency"],
      includeResourceConstraintWorksheet: !!args["resource-constraint-worksheet"],
      includeCheckWorksheets: !!args["check-worksheets"],
      calculatedColumns: args["constraint-factor"]
        ? [
            {
              name: "ConstraintFactor",
              expression: args["constraint-factor-expression"],
              decimalPlaces: args["constraint-factor-decimals"],
            },
          ]
        : [],
      worksheetFilterExpression: args["worksheet-filter"],
      expectedRowsText: args["expected-rows"],
      logger,
    });

    console.log("\nâœ“ DONE");
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (err) {
    console.error("\nâœ— FAILED");
    if (steps.length) {
      console.error(`  last completed step: ${steps[steps.length - 1]}`);
    }
    console.error(err && err.stack ? err.stack : String(err));
    return 1;
  } finally {
    // close() flushes the login into the persistent profile (launch mode) or is a
    // no-op (CDP attach â€” the long-lived session stays up for the next run).
    // --keep-open opts out for the launch case.
    if (context && !keepOpen) {
      await closeBrowser();
    } else if (context && keepOpen) {
      console.error(
        "\n(Browser left open per --keep-open; login may not persist until it is closed.)",
      );
    }
  }
}

const hasProcess =
  typeof process !== "undefined" &&
  process &&
  Array.isArray(process.argv);

const invokedDirectly =
  hasProcess &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err && err.stack ? err.stack : String(err));
      process.exit(1);
    });
}
