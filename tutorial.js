// ImplementationOS -- scripted tutorial mode.
//
// Audio files are optional. Generate voiceover MP3s with the matching file
// names and place them under ./audio/tutorial/. Captions and spotlight focus
// work even when the audio files are not present.

const tutorialScript = [
  {
    id: "intro",
    stepId: "welcome",
    focus: ".stage-body",
    audio: "audio/tutorial/01-intro.mp3",
    title: "Start with the journey",
    text: "Welcome to ImplementationOS for the Digital Manufacturing stack. This is not a form dump. It is a guided configuration journey that turns implementation decisions into a living model.",
  },
  {
    id: "intent",
    stepId: "scope",
    focus: ".scope-selection-strip",
    audio: "audio/tutorial/02-intent.mp3",
    title: "Define the implementation intent",
    text: "The first real decision is intent. Pick the capability layers in scope: master planning, detailed planning and scheduling, dispatch, execution feedback, data foundation, and architecture.",
  },
  {
    id: "selected-cards",
    stepId: "scope",
    focus: ".scope-grid",
    audio: "audio/tutorial/03-selected-cards.mp3",
    title: "Read selected versus unavailable",
    text: "Each card now states whether it is selected, available, or unavailable. The selected stack above the grid summarizes the answer, so you do not have to infer it from color alone.",
  },
  {
    id: "landscape",
    stepId: "architecture",
    focus: ".arch-wrap",
    audio: "audio/tutorial/04-system-landscape.mp3",
    title: "Translate intent into systems",
    text: "Next, the system landscape shows how the ERP source, planning layer, execution layer, shop floor, and satellite systems participate in the implementation.",
  },
  {
    id: "industry",
    stepId: "industry",
    focus: ".industry-picker",
    audio: "audio/tutorial/05-industry-context.mp3",
    title: "Narrow the industry context",
    text: "Industry context comes before operating archetype. A project can span several sectors or specializations, so the model supports portfolios rather than forcing one narrow industry label.",
  },
  {
    id: "archetype",
    stepId: "archetype",
    focus: ".pick-grid",
    audio: "audio/tutorial/06-archetype.mp3",
    title: "Choose compatible operating patterns",
    text: "Archetypes describe the operating pattern: discrete, process, packaging, asset-heavy, labor-heavy, or hybrid. Incompatible choices stay visible for context but cannot enter the model.",
  },
  {
    id: "blueprint",
    stepId: "scope",
    focus: "#blueprintPanel",
    audio: "audio/tutorial/07-blueprint.mp3",
    title: "Watch the blueprint write itself",
    text: "The blueprint on the right is the implementation evidence trail. As decisions are confirmed, it becomes a handoff artifact rather than a separate document someone has to reconstruct later.",
  },
  {
    id: "cockpit",
    stepId: "scope",
    focus: ".stage-top-actions",
    audio: "audio/tutorial/08-cockpit.mp3",
    title: "Use cockpit and tutorial together",
    text: "Use Cockpit to jump between modules, Blueprint to inspect evidence, and Tutorial to guide a stakeholder through the concept with voiceover, captions, and focus transitions.",
  },
];

window.tutorialScript = tutorialScript;
