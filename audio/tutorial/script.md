# Tutorial Voiceover Script

Generate each narration as an MP3 and save it beside this file using the exact filename shown.

## 01-welcome.wav
Welcome to ImplementationOS for the Digital Manufacturing stack. This guided flow turns implementation decisions into a living configuration model, one clear screen at a time.

## 02-implementation-intent.wav
Start by choosing the capability layers in scope. The selected stack at the top summarizes the answer, while each card says whether it is selected, available, or unavailable.

## 03-system-landscape.wav
Now translate intent into systems. Confirm the ERP source, planning layer, execution layer, shop-floor signals, and any satellite systems that shape the implementation.

## 04-industry-context.wav
Select every industry specialization the project must cover. The model supports portfolios, so one implementation can include multiple product families, sites, or business units.

## 05-archetype.wav
Choose the operating archetypes that truly shape the project. Incompatible cards stay visible for context, but only compatible patterns can enter the model.

## 06-dialect.wav
The app synthesizes industry and archetype into a planning dialect. Use this screen to confirm the ERP vocabulary the customer actually uses.

## 07-migration.wav
If an S/4 or similar migration is on the roadmap, the implementation should avoid brittle one-off mappings and carry that risk into readiness.

## 08-master-purpose.wav
Master Planning is optional. Use it when the project needs a period-level supply plan before detailed planning, scheduling, dispatch, or execution takes over.

## 09-master-policy.wav
This layer should not sequence every operation. It sets rough-cut capacity, planning policies, and bucket-level feasibility before the next layer takes over.

## 10-master-handoff.wav
Confirm what Master Planning hands downstream: firmed orders, pegging, overloads, inventory projection, or another release package.

## 11-capacity-basics.wav
This teaching screen shows that capacity is only the time a resource is actually open. Nights, breaks, holidays, and maintenance cannot be scheduled.

## 12-calendars-capacity.wav
Capture the availability layers, shift pattern, exceptions, and capacity modifiers. This is how the planning engine knows whether open time is really usable.

## 13-capacity-preview.wav
Review the resulting capacity timeline. This is a simplified day view of how the chosen calendar model changes each resource's usable time.

## 14-bottleneck-basics.wav
A bottleneck is the resource everything waits on. The app explains the concept without assuming the customer already knows where the constraint is.

## 15-bottleneck.wav
Ask whether the customer sees a stable bottleneck, a shifting bottleneck, or no clear constraint yet. This records a hypothesis, not a forced answer.

## 16-bottleneck-preview.wav
This preview draws the bottleneck hypothesis against the schedule. It makes clear that the planning engine can recompute the binding resource each run.

## 17-department-taxonomy.wav
Select department taxonomies rather than asking for real plant names. The generated dataset will be representative and replaceable by customer data later.

## 18-resource-taxonomy.wav
Pick the resource types that shape capacity: lines, work centers, tanks, people, labs, tools, or other constraints. These seed the representative model.

## 19-tank-basics.wav
Tanks and silos are not ordinary machines or shelves. Their feasibility depends on live occupancy, flow, cleaning state, and product eligibility.

## 20-volume-storage.wav
Use this screen when tanks, vats, silos, buffers, or drums affect feasibility. If they do not matter, mark them out of scope and move on.

## 21-tank-preview.wav
The preview shows fill, hold, drain, heel, and capacity limits over a cycle. It makes tank scheduling visible instead of hiding it in a duration.

## 22-classification.wav
Attributes begin with classification and grouping. These fields later drive changeovers, campaigns, reporting, and eligibility rules.

## 23-descriptive.wav
Descriptive fields explain what the item is. The tutorial keeps them representative until real master data replaces the generated examples.

## 24-planning-fields.wav
Planning fields tell the model how an item behaves: lead times, lot sizes, shelf life, storage rules, and other planning-relevant properties.

## 25-variants.wav
Variants describe sellable or manufacturable differences. They may affect routing, packaging, eligibility, sequencing, or material availability.

## 26-batch-serial.wav
Batch and serial attributes matter for traceability, potency, expiry, genealogy, and regulated execution feedback.

## 27-quality-params.wav
Quality parameters describe what must be true about the item or process. In regulated environments, they connect planning to batch records and release evidence.

## 28-transition-basics.wav
Between production runs, the line loses capacity to setup, changeover, cleaning, teardown, or other transitions. The model must account for that lost time.

## 29-setup-cleaning.wav
Define what inserts transitions, whether they block the resource, and whether they are driven by SKU, family, attribute, recipe, or cleaning state.

## 30-transition-preview.wav
This preview shows the gaps between runs. Wider gaps cost more capacity, and concurrent transitions can overlap rather than stop the resource.

## 31-bom-profile.wav
BOMs can be multilevel, single-level, recipe-like, phantom-heavy, recursive, allocation-based, or order-level. Capture how product structure reaches planning.

## 32-critical-supplies.wav
Not every material should hard-stop a schedule. Use lead time, storage capacity, shelf life, transfer risk, and substitutability to decide what is truly binding.

## 33-workforce-basics.wav
Machines do not run themselves. Skilled people, qualifications, absences, and shift coverage can gate a schedule just like equipment.

## 34-workforce-planning.wav
Choose how deeply to model workforce constraints. Some environments only need shift coverage; others need named skills, qualifications, and deployment rules.

## 35-workforce-preview.wav
The preview shows how skilled secondary resources constrain primary machines. A job waits if the right qualified person is not available.

## 36-dispatch-intent.wav
Dispatching decides how planned work becomes shop-floor action. Choose whether there is a separate dispatch layer or direct release through planning or MES.

## 37-dispatch-rules.wav
Dispatch rules control sequence adherence, due-date protection, WIP, changeover preservation, and how quickly the floor reacts to disruption.

## 38-execution-feedback.wav
Execution feedback can come from MES, ERP, or both. Capture starts, completions, partials, scrap, yields, timestamps, phases, steps, and confirmations.

## 39-try-variant.wav
Variants let the team test a modeling decision before committing it. The branch history becomes part of the evidence trail rather than an undocumented side path.

## 40-readiness.wav
Readiness is computed from the decisions made so far: scope, model completeness, data issues, risk, and evidence. It shows what still needs attention.

## 41-handoff.wav
The final screen exports the configuration, decisions, representative dataset, evidence, and notes. The handoff is generated from the journey, not recreated afterward.

