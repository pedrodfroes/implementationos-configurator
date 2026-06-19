# maestro-authoring.mjs — Handoff / Catch-up

> Purpose of this file: let any AI or developer resume work without re-reading the
> whole history. It records what the module does, what changed most recently, what
> is verified vs unverified, and what comes next.

## What this module is

A **browser-automation driver** that builds the ES→MPS **routing conversion**
workbook directly in the **Maestro web UI** (Kinaxis RapidResponse), instance
**PR DEV01** (`eu21.kinaxis.net/web/PRSD02_DEV01`). It clicks through the real
app — it is **not** an API client.

It is the GUI counterpart to the offline conversion proof. Domain context lives in
the Obsidian vault:
- `Pernod Ricard - Maestro/Build/01 - Routing Conversion (ES to MPS).md`
- `Pernod Ricard - Maestro/Build/02 - Shift & Downtime Conversion (ES to MPS).md`

Key validated facts the automation encodes:
- Constraint **Factor = DIV(24 × Efficiency, RouteOperationSegment.Rate, 0, 0)** —
  the **24 h calendar-day** basis (proven against DEV factors). Seeded as the
  `vDayHours = 24` workbook variable.
- The routing dataset is **1617 segments** at site **MKM** — used as the
  `assertGridLoaded` sanity check (`"1617 rows"`).

## Architecture (unchanged contract)

The engine `MaestroAuthoringRun` drives a small **browser/tab interface**:
```
browser.capabilities.get(name).set(value)
browser.tabs.list() / get(id) / new()
tab.url() / title() / goto(url)
tab.playwright.{ getByRole, getByText, locator, waitForTimeout, domSnapshot }
tab.cua.keypress({ keys })
```
`createRoutingWorkbook({ browser, tab, ... })` is the high-level entry. It:
1. `prepare()` — viewport, find/open the PR tab, assert app shell.
2. open New Workbook → name it.
3. add variables: `vExpectedSite`, `vDayHours=24`, `vDeltaTolerance=0.000001`,
   `vCommitAllowed` (boolean).
4. worksheet `WS_20_Routing_To_SourceConstraint` on table `RouteOperationSegment`.
5. add columns `Rate, Sequence, Duration, OperationSegmentType`.
6. validate (no invalid columns) → save → open data at site → assert 1617 rows.

`vDeltaTolerance` and `vCommitAllowed` are **seeded but not yet used** — they are
for the next stage (reconciliation + commit gate).

## What changed most recently (Claude, 2026-06-14)

Increment: **"Harden / add CLI entry"** — all **additive**, no authoring logic
changed. The original injected-harness usage (`createRoutingWorkbook({browser,
tab})`) is untouched.

Added to `maestro-authoring.mjs`:
- **Standalone CLI**: `node maestro-authoring.mjs --workbook <name> [opts]`, guarded
  by an `import.meta.url` check so importing as a library never runs `main()`.
- **`parseArgs` / `printUsage`**: flags `--workbook` (required), `--worksheet`,
  `--table`, `--site`, `--mode`, `--url`, `--user-data-dir`, `--login-timeout`,
  `--headless`, `--keep-open`, `--help`. Rejects unknown options / missing values.
- **`launchBrowser`**: a **Playwright (chromium) adapter** that supplies the exact
  browser/tab interface above. Uses `launchPersistentContext(userDataDir)` so the
  Maestro login persists between runs. `domSnapshot()` → `body.ariaSnapshot()`
  (yields the `role "name"` text the engine string-matches). Playwright is a
  **dynamic import** with a friendly install error — importing the library does not
  require Playwright.
- **`waitForAppShell`**: polls for the shell up to `--login-timeout` so the user can
  log in interactively; clean message if the window is closed early.
- **Structured errors**: `main()` logs step breadcrumbs, prints the last completed
  step + stack on failure, leaves the browser open for inspection; exit codes
  0 (ok) / 1 (run failure) / 2 (bad usage).
- **`deriveUrlMarker`**: extracts the instance segment (e.g. `PRSD02_DEV01`) from
  the URL so `--url` can target another instance without breaking tab detection.
  `APP_URL` is now exported.
- Threaded `appUrl` through `createRoutingWorkbook` and `MaestroAuthoringRun`.

## Verified vs unverified

VERIFIED END-TO-END against live DEV on 2026-06-14 (exit 0, ~40s):
- `node maestro-authoring.mjs --workbook WB_CLI_SMOKE_… --mode safe` ran the full
  flow: login → new workbook → 4 variables → worksheet on `RouteOperationSegment`
  → columns → save → open at site MKM → **grid loaded with 1617 rows**.
- So: CLI parsing, Playwright bootstrap, persistent-profile login, the frame-aware
  adapter, AND the original authoring flow all work together. The `"1617 rows"`
  assertion passed (the count lives in a frame; the aggregated snapshot sees it).

Also verified (no browser):
- `node --check` passes; `--help` / missing-arg / bad-option → exit 0 / 2 / 2.
- Importing the module does **not** auto-run `main`; exports are functions.
- `deriveUrlMarker` and `parseArgs` behave (type coercion, rejection).

Two bugs found & fixed during the live run:
1. **iframe blindness** — the Maestro shell renders the Resources panel / dialogs /
   grid inside iframes, so the original main-frame-only `page.getByRole` returned
   0 for `"New resource"`. Fixed with a **frame-spanning locator** + a
   **frame-aggregating `domSnapshot`** (see "frameSpanningLocator" in the source).
2. **login not persisting** — `main()` forced the window to stay open on failure,
   which skipped the profile flush, so every run re-prompted for login. Fixed:
   the context is now always closed (which flushes the session) unless the user
   passes `--keep-open`.

## How to run (standalone)

```
cd "Digital Transformation Configurator/maestro-automation"
npm i playwright            # one-time
npx playwright install chromium
node maestro-authoring.mjs --workbook WB_TEST --mode safe
# a Chromium window opens → log into Maestro there (persists via the profile)
```
Profile dir default: `~/.maestro-authoring-profile` (override with `--user-data-dir`).

## Next steps (not done yet)

1. ~~Run the live smoke test; fix any selector / `"1617 rows"` issues.~~ DONE — see
   "Verified" above. The authoring scaffold is green end-to-end.
2. **Calculated factor column** — add `ConstraintFactor =
   DIV(vDayHours * Efficiency, Rate, 0, 0)` plus the reference-traversal columns it
   needs (Efficiency, part-source + constraint keys).
3. **Reconciliation + commit pipeline** — data-mod worksheet(s), Δ-vs-hand-entered
   check using `vDeltaTolerance`, commit gate using `vCommitAllowed`. NOTE: in DEV
   `Constraint` + `SourceConstraint` are currently **hand-populated**, so this stage
   should start as **audit/reconciliation**, not a committing writer.
4. Optional: `package.json` (`"type":"module"`, playwright dep, `bin`/`start`).

## Authored first routing slice

Validated on 2026-06-14 in DEV with workbook
`WB_ES_to_MPS_Routing_AUTHORED_191115`.

Command shape:
```
node maestro-authoring.mjs --cdp http://localhost:9222 --workbook <name> --mode fast --all-key-fields --constraint-factor
```

Result:
- Saved a private workbook.
- Opened it at scenario `Constraints Demo`, filter `All Parts`, site `MKM`.
- Worksheet `WS_20_Routing_To_SourceConstraint` loaded with `1617 rows and 13 columns`.
- Columns included:
  - base fields: `Rate`, `Sequence`, `Duration`
  - `Columns from Key Fields > All Key Fields`, which supplies the Route Operation
    and Part Source key columns needed for audit/reconciliation
  - calculated `ConstraintFactor`

Current limitation:
- `ConstraintFactor` is currently authored as `DIV(24, Rate, 0, 0)`, which is a
  verified first audit slice for the sample data because observed Resource
  efficiencies are `1`.
- The intended final formula remains `DIV(24 * Efficiency, Rate, 0, 0)`. Next
  step is to add/verify the `RouteOperation.PrimaryResource.Efficiency` reference
  column or expression path, then update the calculated column formula.
- Quantity calculated columns default to `Decimal places = 0`, so fractional
  factors can appear as rounded integers in the grid. In the column editor, select
  `ConstraintFactor` -> `Formatting` -> `Number` -> `Decimal places` and set a
  useful precision such as `4`.
- Automation support: `--constraint-factor` now formats the calculated column with
  `--constraint-factor-decimals <n>`; default is `4`.
- Live validation workbook: `WB_ES_to_MPS_Routing_FORMAT_193748` used
  `--constraint-factor --constraint-factor-decimals 4 --worksheet-filter "Rate < 100"
  --expected-rows "3 rows"` and completed successfully. The run log confirmed
  `Decimal places set: 4`, then saved/opened the workbook and loaded the expected
  `3 rows`.

## Authored second routing slice: explicit Efficiency

Validated on 2026-06-14 in DEV with workbook
`WB_ES_to_MPS_Routing_AUTH2_195940`.

Command shape:
```
node maestro-authoring.mjs --cdp http://localhost:9222 --workbook <name> --mode fast --all-key-fields --resource-efficiency --constraint-factor --constraint-factor-decimals 4
```

Result:
- Saved/opened a private workbook at `MKM`.
- Worksheet loaded with `1617 rows and 14 columns`.
- Added `RouteOperation.PrimaryResource.Efficiency` via the field picker:
  `Columns -> Add Column -> Columns from Fields... -> expand RouteOperation ->
  expand PrimaryResource -> scroll the field list -> select Efficiency -> Add`.
- Maestro-generated header: `Route Operation Primary Resource Efficiency`.
- Maestro-generated ID: `RouteOperationPrimaryResourceEfficiency`.
- The column expression shown by Maestro is
  `RouteOperation.PrimaryResource.Efficiency`.
- Visible DEV data confirms Efficiency = `1` for the sampled rows, matching the
  known DEV assumption.

Current formula caveat:
- The workbook still uses the verified display formula `DIV(24, Rate, 0, 0)`.
- An attempted calculated expression using the helper column ID
  `RouteOperationPrimaryResourceEfficiency` did not validate; Maestro reported
  that the base table does not contain that field.
- An attempted direct path expression
  `DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)` also did not
  clear validation cleanly in this column context. Treat the syntax for
  referencing helper columns/reference fields inside another calculated column as
  still unresolved.

## RESOLVED: efficiency-aware ConstraintFactor formula (Claude, 2026-06-14)

The direct path expression **does** validate. Validated in DEV with workbook
`WB_EFF_TEST_203135` (exit 0, ~38s):
```
node maestro-authoring.mjs --cdp http://localhost:9222 --workbook <name> --mode fast \
  --all-key-fields --resource-efficiency \
  --constraint-factor \
  --constraint-factor-expression "DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)" \
  --constraint-factor-decimals 4
```
Run log: `Calculated column added: ConstraintFactor = DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)`
→ `No invalid columns detected` → saved → opened → grid loaded.

Why the earlier attempt failed and this one worked:
- The expression is entered into the Monaco editor via `keyboard.insertText`, which
  injects text WITHOUT keydown events, so Monaco's bracket auto-close does not
  duplicate the closing `)`. Typing the same expression key-by-key mangles it
  (`DIV(...))`), which is what failed validation before. Use insertText, not typing,
  for any expression containing brackets.
- The reference path resolves directly on the base table; it does NOT need the
  helper Efficiency column to exist first (so `--resource-efficiency` is optional
  for the formula, though it's still useful as an audit column).

Change made: this efficiency-aware expression is now the **default** for
`--constraint-factor` (was `DIV(24, Rate, 0, 0)`). Override with
`--constraint-factor-expression` if needed.

## Atomic skill: worksheet filter expression

Validated on 2026-06-14 in DEV using throwaway workbook
`WB_FILTER_DISCOVERY_182345`.

Where it lives:
- Open/select the worksheet resource.
- Go to the worksheet-level `Filtering` tab, not the workbook-level filtering icon.
- Set `Worksheet Filter Expression` in the textbox named `Expression`.
- The same tab also has standard workbook filter controls. By default for
  `RouteOperationSegment`, Maestro maps:
  - workbook Part filter to `RouteOperation.Route.PartSource.Part`
  - workbook Site control to `RouteOperation.PrimaryResource.Area.Site`

Validation pattern:
- `Rate > 0` saves and opens with the normal MKM count: `1617 rows`.
- `Rate < 100` saves and opens with `3 rows`, all visible rows showing
  `Rate = 48`.
- `Rate = 48` unexpectedly opened with `0 rows`; prefer range predicates for
  quantity-field validation unless exact quantity comparison semantics are
  investigated further.

Automation support:
- `createRoutingWorkbook` now accepts `worksheetFilterExpression` and
  `expectedRowsText`.
- CLI flags:
  `--worksheet-filter "Rate < 100" --expected-rows "3 rows"`.

## Authored WS_10_Resource_To_Constraint (Claude, 2026-06-14)

Second worksheet in the same workbook. Flag: `--resource-constraint-worksheet`.

```
node maestro-authoring.mjs --cdp http://localhost:9222 --workbook <name> --mode fast \
  --resource-constraint-worksheet --expected-rows ""
```

What was added to the library:
- `addResourceConstraintWorksheet()` — builds WS_10 on table **Resource** /
  namespace **Scheduling**, with 9 expression columns (`Name`, `Area.Site`,
  `Constraint.Name`, `Constraint.Site`, constants `'Constrained'`/`'HR'`/`'Workday'`/`'N'`,
  `Efficiency`) and filter `Constraint.Name <> ''`.
- `createTableWorksheet(name, table, { namespace })` now climbs back to workbook
  level first (so 2nd+ worksheets work) and supports a namespace.
- `chooseTableWithNamespace(label, name, namespace)` — the table picker shows
  **name + namespace as separate columns**; several tables share a name (e.g.
  `Resource` exists in both `ProjMgmt` and `Scheduling`). This searches the name,
  then clicks the row whose namespace matches (nearest namespace-bearing ancestor
  of the exact-name cell = the row).
- `backToWorkbookPropertiesIfNeeded()` helper.
- `assertGridLoaded` now polls for the treegrid / row text instead of a single
  check (multi-worksheet workbooks open the first worksheet, which can be slow).

Gotcha: in a multi-worksheet workbook, opening shows the FIRST worksheet (WS_20),
so the post-open grid assertion validates WS_20's grid, not WS_10's. WS_10's
columns are validated by `assertNoInvalidColumns` + a clean save. To validate
WS_10's grid specifically, switch to its worksheet tab (not yet automated).

## Authored check worksheets WS_31 + WS_33 (Claude, 2026-06-14)

Flag: `--check-worksheets`. Validated in DEV (`WB_CHECKS_212146`, exit 0).
- `addBadDataCheckWorksheet()` — WS_31_Bad_Data_Check, base RouteOperationSegment,
  filter `Rate <= 0` (a row = a bad/missing-rate problem; clean data = 0 rows).
- `addOutlierCheckWorksheet()` — WS_33_Outlier_Check, base RouteOperationSegment,
  ConstraintFactor calc column + filter `DIV(24, Rate, 0, 0) >= 0.1` (flags
  very-low-rate / high-hrs-per-unit outliers, e.g. the Rate=48 rows).

Still TODO (harder, need careful expression work — not yet built):
- **WS_30_Duplicate_Key_Check** — needs a self set-count over the SourceConstraint
  key (group-by/having-count > 1), or a grouped worksheet. Set-operator syntax in
  Maestro still to validate.
- **WS_32_Factor_Back_Check** — needs `LookupInTable` from RouteOperationSegment to
  the existing `SourceConstraint` to compare computed vs stored factor against
  `vDeltaTolerance`. Requires SourceConstraint populated (it is, hand-entered).

## Composite worksheets / JOINs (discovery, Claude 2026-06-14 — NOT yet automated)

Needed for WS_32 (factor back-check: compare computed vs existing factor).
- Create: Worksheets tab -> New Worksheet -> **"Composite Worksheet"** (button).
- The composite editor has a **Components** section with an **"Add Component
  Worksheet"** button -> picker panel (heading "Add Component Worksheet"):
  `textbox "Search"`, filter buttons `All Tables` / `Sort by Worksheet (A-Z)` /
  `Valid`, then the worksheet list.
- **Only "Valid" worksheets appear** as candidate components — a bare worksheet
  with no columns is filtered out ("No results"). So build component worksheets
  fully (with columns) BEFORE adding them.
- Combine modes (from user + screenshots): radio **Merge data records (JOIN)** with
  an **"Include in composite worksheet"** dropdown =
  `Only records in the first worksheet (LEFT JOIN)` /
  `Only records that are in all component worksheets (INNER JOIN)` /
  `All records in all component worksheets (OUTER JOIN)`; plus radio
  **Append all records (UNION)**.
- **CRITICAL — no aliasing. Joins match by COLUMN POSITION** ("based on first N
  columns"). Every component must expose its join keys in the SAME leading columns,
  in the SAME order. (Still need to capture the exact "first N columns" control and
  the per-component add flow with valid components present.)

## WS_32 factor back-check — design + validated field paths (Claude 2026-06-14)

Back-check = compare the routing-computed factor vs the hand-entered
`SourceConstraint.ConstraintFactor`, via a **composite (JOIN) worksheet**.

Join key (per user + Data Model note `Maestro Data Model/PR Critical Tables`):
**Site must be column 1**, **Base Key column 2**. Part Source is a reference on
BOTH Route Operation and Source Constraint; Base Key is a field of Part Source.

Two component worksheets, columns in identical positions:

| col | Routing (base `RouteOperationSegment`) | SourceConstraint (base `SourceConstraint`, namespace **Mfg**) |
|---|---|---|
| 1 Site | `RouteOperation.PartSource.Part.Site` | `PartSource.Part.Site` |
| 2 BaseKey | `RouteOperation.PartSource.BaseKey` | `PartSource.BaseKey` |
| 3 value | `DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)` | `ConstraintFactor` |

Then composite **INNER JOIN on first 2 columns** -> add `Delta = ComputedFactor -
ExistingFactor` -> filter `ABS(Delta) > vDeltaTolerance`.

**VALIDATED in DEV (run b...)**: on the routing side, `RouteOperation.PartSource.Part.Site`
and `RouteOperation.PartSource.BaseKey` both added as valid calc columns. The
SourceConstraint-side paths come straight from the Data Model note (same PartSource
fields) — re-validate when the session is back.

ALWAYS use the vault data model for field paths — do NOT rediscover via the field
picker. Key tables: `Maestro Data Model/PR Critical Tables - MPS and Constraints.md`
and `Enterprise Scheduling ADG/Part 3 - ES Data Model.md`.

Known flakiness:
- `setQuantityDecimalPlaces` ("Decimal places control not found") fails
  intermittently on some calc columns — it is cosmetic; skip it if it blocks, or
  set decimals later in the column's Formatting tab.
- `--mode fast` flakes on a loaded page (dropdown "result not unique: 0",
  Columns-tab click timeout). Prefer `--mode safe` for multi-worksheet builds.
- The CDP session (`session.mjs` on :9222) must stay open; if its window is closed
  the browser dies and runs fail with ECONNREFUSED. Restart: `node session.mjs`,
  log in once, leave open.

### WS_32 composite JOIN — FULL recipe (reverse-engineered 2026-06-14)

CORRECTED field paths (the earlier `RouteOperation.PartSource` was wrong — it
validated syntactically but returned empty, so the worksheet was filtered out of
the component picker). Use:
- Routing side: `RouteOperation.Route.PartSource.Part.Site` (Site),
  `RouteOperation.Route.PartSource.BaseKey` (BaseKey).
- SourceConstraint side: `PartSource.Part.Site`, `PartSource.BaseKey`.
(PartSource hangs off **Route** on the routing side; it's a direct reference on
SourceConstraint.)

Build order — the FIRST component is just the base (no join options); the join is
configured when adding the SECOND component, IN the Add-Component panel, BEFORE the
partner worksheet becomes selectable:
1. Build the two source worksheets (Site col1, BaseKey col2, factor col3).
2. New Worksheet -> **Composite Worksheet**; rename it.
3. **Add Component Worksheet** -> click the BASE worksheet (e.g. WS_Routing_Factor).
   No join config for the base.
4. **Add Component Worksheet** again. In the panel:
   - `combobox "Include in composite worksheet"` -> open (its `button "Dropdown"`),
     pick the option containing **"INNER JOIN"** (`Only records that are in all
     component worksheets (INNER JOIN)`).
   - `radio "SpecifiedNumberOfColumns"` (siblings: `radio "GroupByColumns"` checked
     by default; mode radios `radio "Join"` / `radio "Union"`). Click it to ENABLE
     the spinbutton.
   - `spinbutton "The first number of columns"` (disabled until that radio is on) ->
     set to **2** (Site + BaseKey).
   - **KEY INSIGHT (per user):** Maestro filters the candidate component list by
     whether the chosen join + key columns actually make sense. The partner
     worksheet (WS_SC_Factor) only appears as "Valid" AFTER the join type + first-N
     columns are set. So configure the join FIRST, then click the partner.
   - Click the partner worksheet entry to add it.
5. Then add `Delta = ComputedFactor - ExistingFactor` calc column on the composite +
   filter `ABS(Delta) > vDeltaTolerance`.

Automation notes:
- Use FRAME-SPANNING locators (`tab.playwright.getByRole/getByText`), NOT a specific
  frame — there are multiple "Search" boxes so `findFrameWithRole("textbox","Search")`
  grabs the wrong frame; the radio/spinbutton then aren't found.
- Do NOT press Escape to dismiss the join dropdown — it closes the whole picker.
  Selecting the option closes the dropdown on its own.
- ✅ **VALIDATED END-TO-END in DEV (`WB_WS32_JOIN_639958`)**: both components land in
  the composite, **INNER JOIN on first 2 columns**, Create button enabled (valid).
  Run log: base=WS_Routing_Factor → INNER → first 2 columns → WS_SC_Factor appeared
  (only after the join+columns were set) → added. Script: `build_ws32_join.mjs`.
- STILL TODO on the composite: add `Delta = ComputedFactor - ExistingFactor` calc
  column + filter `ABS(Delta) > vDeltaTolerance`, then save. (Composite column
  expressions may reference the joined columns by their position/name — verify.)

STABILITY: the long-lived `session.mjs` browser CRASHES after many runs because each
run opens a new unsaved workbook editor and they pile up. Mitigations: save+close (or
discard) the editor at the end of each run, restart `session.mjs` periodically, and
prefer a FRESH session for the decisive end-to-end run.

## SourceConstraint GENERATION (the actual deliverable, Claude 2026-06-14)

Reframe (per user): the build is supposed to **generate** SourceConstraint records,
not consume them. So the back-check (WS_32, which joins against existing
SourceConstraint) is only an optional audit, NOT a dependency. Also: DEV has a
**phantom "Labor" load-only constraint** per part-source, so each part-source has
2 SourceConstraint records (machine + Labor) — that's what made the WS_32 join
fan out 2×. **Generate machine constraints only; routing's `PrimaryResource` IS the
machine, so Labor is naturally excluded — no filtering needed.**

Deliverable: a worksheet on `RouteOperationSegment` shaped to SourceConstraint's
insertable columns (user inserts them; the insert itself = a Ch27 Data Update
command, TBD). Columns + expressions (paths from Data Model note + user's
`Route.PartSource` correction — NOT yet validated, the run crashed before finishing):

| Column | Expression |
|---|---|
| ConstraintSite | `RouteOperation.PrimaryResource.Constraint.Site` |
| ConstraintName | `RouteOperation.PrimaryResource.Constraint.Name` |
| PartSite | `RouteOperation.Route.PartSource.Part.Site` |
| PartName | `RouteOperation.Route.PartSource.Part.Name` |
| SourceId | `RouteOperation.Route.PartSource.Source.Id` |
| SupplierId | `RouteOperation.Route.PartSource.Source.Supplier.Id` |
| BaseKey | `RouteOperation.Route.PartSource.BaseKey` (validated ✓) |
| EffectiveInDate | `'Past'` (verify literal) |
| ConstraintFactor | `DIV(24 * RouteOperation.PrimaryResource.Efficiency, Rate, 0, 0)` (validated ✓) |
| FixedConstraintFactor | `0` |

Script: `build_sc_generate.mjs`. ✅ **ALL 10 columns VALIDATED in DEV
(`WB_SC_GENERATE_156731`, no invalid columns, Create enabled)** — every path above
resolves, including `PrimaryResource.Constraint.Site/.Name`, `Source.Id`,
`Source.Supplier.Id`, and the `'Past'` literal. This worksheet IS the generation
deliverable (machine-constraint SourceConstraint records to insert; Labor excluded
because routing only yields the machine PrimaryResource).

Remaining: (1) the actual INSERT — a Ch27 **Data Update command** that writes these
rows into `SourceConstraint` (new capability, not yet built); (2) formalize
components + this generation worksheet into the library as flags (currently in
throwaway scripts `build_*.mjs`).

## Labour SourceConstraint + UNION ALL (Claude 2026-06-16, VALIDATED)

The phantom **Labor** load-only constraint's factory-wide consumption, generated from
a custom field and UNION'd onto the machine records. Script: `build_labour_union.mjs`
(workbook `WB_SC_ALL_*`).

- **Custom field reference needs the namespace.** `RouteOperation.CrewSize` ERRORS;
  the field lives in the **PernodRicard** namespace, so the reference is
  **`RouteOperation.PernodRicard::CrewSize`** (`Reference.Namespace::FieldName`).
  Custom-field paths: always include the namespace with `::`.
- **Labour factor** (no efficiency, per owner): `DIV(24 * RouteOperation.PernodRicard::CrewSize, Rate, 0, 0)`.
- **Labour worksheet** = same 10 SourceConstraint columns as the machine sheet, but
  `ConstraintName = 'Labor'` and the labour factor. Labour is naturally factory-wide.
- **UNION ALL composite**: create composite → add machine as base → Add Component
  again → tick `radio "Union"` ("Append all records (UNION)") → pick the labour sheet.
  **CRITICAL: UNION requires matching column TYPES across components.** The labour
  `ConstraintSite` must use the SAME Site-reference expression as the machine sheet
  (`RouteOperation.PrimaryResource.Constraint.Site`) — a `'MKM'` string literal is a
  different type and makes the partner show "No results" in the UNION picker.

## Two more harness patches (Claude 2026-06-16)

- **`setQuantityDecimalPlaces` no longer hard-crashes.** The Formatting "Decimal
  places" control is intermittently slow/variable; it now retries 3× then WARNS and
  continues (decimals are cosmetic — must not fail a build). See `_trySetDecimalPlaces`.
- **`assertNoInvalidColumns` no longer false-passes.** It now also detects a column
  whose data EXPRESSION errors ("error in your column's data expression"), not just
  the "Invalid column" badge. (A bad field path like the un-namespaced CrewSize
  previously slipped through as "no invalid columns".)

## Scope note (from the runbook's governance section)

`01A` says: do NOT build toward an auto-committing writer until ownership of
`SourceConstraint` is decided (DEV factors are currently hand-populated and already
correct). So the **audit side** (WS_10/WS_20 + check worksheets + back-check) is the
sanctioned scope. The **DM_10/DM_20 data-mod worksheets + commit script** are the
gated part — build only after the owner confirms this should be the authoritative
writer.

## Grouping (GROUP BY) — library capability (Claude 2026-06-14, VALIDATED)

Three library methods (in `MaestroAuthoringRun`):
- `addAllFieldColumns()` — Add Column -> "Columns from all Fields" (one click).
- `enableGroupData()` — Group tab; the toggle is the **`checkbox "Switch control"`
  INSIDE the `button "Group Data"`** (clicking the button wrapper does NOT flip it;
  click the checkbox with `{force:true}`). Once on, the Column Groups table appears.
- `setColumnGrouping(header, func)` — sets a column's grouping function. func ∈
  Group By / Sum / Running Total / Average / Minimum / Maximum / Associate / Count /
  Product. Defaults: numeric=Sum, others=Minimum.

Validated in DEV (`WB_GROUPING_291448`): 3 worksheets on Resource (Scheduling) —
group by Site; group by Resource Type (Rate=Average, Efficiency=Maximum); group by
Site+Type (two Group By keys). Script: `build_grouping.mjs`.

Selector lessons (these cost several runs — don't repeat):
- The Column Groups rows are **semantic `<tr>` (implicit role)**, so
  `xpath=ancestor::*[@role='row']` matches NOTHING (it needs an explicit role attr).
  Use Playwright's **`getByRole("row").filter({ has: <column cell> })`** instead.
- The grouping function shows as **plain text** ("Minimum"/"Sum"); the dropdown caret
  is only actionable **on hover**, so a `button` click hangs. Read the current func
  from the row's 2nd cell text and **click that text** to open the menu.
- Prefer **distinctive** target funcs (Group By/Average/Count/Maximum), not the
  defaults Sum/Minimum, so the menu-option `getByText` is unambiguous.

## Session & process management (root causes found — IMPORTANT)

1. **Zombie Chromium → degraded "fresh" restarts.** Re-running `session.mjs` while an
   old Chromium for `.maestro-cdp-profile` was alive just **re-attached** to it
   ("Opening in an existing browser session"), so the session got progressively
   flaky/crashy. FIX (in `session.mjs`): `killStaleSession()` kills any
   `*maestro-cdp-profile*` process on startup, so every launch is genuinely fresh.
2. **CDP scripts never exit.** `connectOverCDP` holds an open websocket, so a
   script's Node process **hangs forever** after finishing. FIXED IN
   `launchBrowser`: the CDP `close()` now calls `conn.close()`, which DISCONNECTS
   the client (Node exits cleanly) but does NOT terminate the externally-launched
   browser (verified: node exit 0, `:9222` still alive). So any script that does
   `await close()` in its `finally` now self-cleans — no per-script `process.exit`
   needed.
3. **Process-kill filter must match script NAMES, not the path.** Scripts run as
   `node build_grouping.mjs` (relative), so `CommandLine -like '*maestro-automation*'`
   misses them. To find/kill them: match `session\.mjs|build_.*\.mjs|discover_.*\.mjs`.
   (Don't kill `session.mjs` if you want to keep the live session.)

## Atomic skill: Expression Builder (resolve field paths + build expressions)

Validated 2026-06-16 in DEV (`WB_EXPRB_LIB_*`). Library methods:
`resolveFieldPath(navPath)`, `_expandBuilderNode`, `addCalculatedColumnViaBuilder(name, parts)`.
`parts` is an ordered array of string literals and `{ field: ["Ref","Ref","Leaf"] }`
nodes, e.g.:
```js
await run.addCalculatedColumnViaBuilder("LabourFactorB", [
  "DIV(24 * ",
  { field: ["RouteOperation", "CrewSize"] },
  ", Rate, 0, 0)",
]);
// => DIV(24 * RouteOperation.PernodRicard::CrewSize, Rate, 0, 0)
```

Where it lives / how it works:
- The column editor's expression box has a **`View full expression builder`** button
  (bottom-right). Clicking it opens `dialog "Expression Builder"` — found via
  `findFrameWithRole("dialog", "Expression Builder")`.
- The dialog has a field tree of `treeitem`s. Expand a reference node by clicking its
  **left-edge caret** (offset-click at dx≈16 from the row's left, with fallbacks
  6/10/22/28/2), confirmed by re-reading the aria snapshot for `[expanded]`.
- **Double-clicking a leaf field inserts its full namespaced path** at the cursor,
  e.g. `RouteOperation.PernodRicard::CrewSize`. This is the reliable way to get an
  exact path without guessing namespaces.

Three traps that bit hard (all now handled in the library — do NOT regress these):
1. **Typing into the builder's Monaco is unreliable.** A multi-char
   `keyboard.insertText("DIV(24 * ")` gets batch-eaten and drops ~every other glyph
   (`DV2 `). `keyboard.type` triggers bracket auto-close. Single-char insertText
   avoids the drop but `(` STILL auto-closes, stranding a `)` after the cursor.
2. **Don't fight it — assemble deterministically.** `addCalculatedColumnViaBuilder`
   now: (a) double-clicks each field to discover its exact path (reading it back from
   the model), (b) builds the full expression string in JS, (c) writes it verbatim
   with `model.setValue(...)`. No typing → no mangling, no auto-close.
3. **This Monaco build exposes `monaco.editor.getModels()` but NOT `getEditors()`.**
   Identify the builder's model by URI: right after a field double-click it's the only
   non-empty model (the column editor behind it is empty for a new column), so capture
   `model.uri.toString()` and drive get/set through it. `.view-lines` DOM innerText is
   lossy (drops glyphs mid-render) — always read the MODEL value, not the DOM.
4. `findFrameWithRole` now retries over a deadline (the dialog can render a beat after
   the click) instead of throwing on the first miss.

Also hardened this round: `chooseTableWithNamespace` got the same retry loop as the
other dropdown opener (the "Dropdown not found: Table" flake), and both deadlines were
widened to 8s/15s for the frequently-degraded DEV instance.

## Conventions for whoever continues

- Keep `createRoutingWorkbook` / `MaestroAuthoringRun` injected-harness contract
  intact; the CLI is an optional standalone layer on top.
- All live-UI assertions go through `domSnapshot()` substring checks and
  `count() === 1` guards with deadline retries — follow that style.
- Use a throwaway, clearly-named workbook (e.g. `WB_CLI_SMOKE_*`) for live tests so
  nothing real is touched; delete it afterward.
