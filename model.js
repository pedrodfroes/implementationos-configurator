// Semantic graph + event log with git semantics. The graph is never
// mutated directly: every write is an event committed to the active
// branch, and the graph is the replay of visible events. Branches fork
// from the trunk at a base index; diff compares replays; merge appends
// branch events to the trunk and records the decision as a node in the
// graph itself, so the decision log IS the merge history.

const Model = (() => {
  const seedOps = [
    { op: "add", node: { id: "site", type: "site", props: { name: "Pharma Plant A" } } },
    { op: "add", node: { id: "mixing", type: "area", props: { name: "Mixing", color: "teal" } } },
    { op: "add", node: { id: "packaging", type: "area", props: { name: "Packaging", color: "coral" } } },
    { op: "add", node: { id: "quality", type: "area", props: { name: "Quality", color: "amber" } } },
    { op: "add", node: { id: "wc-mix-1", type: "workcenter", props: { name: "Mixer A", areaId: "mixing", capacity: "2 shifts", status: "Clean" } } },
    { op: "add", node: { id: "wc-pack-2", type: "workcenter", props: { name: "Packaging Line 2", areaId: "packaging", capacity: "1 shift", status: "Alternate resource" } } },
    { op: "add", node: { id: "wc-pack-3", type: "workcenter", props: { name: "Packaging Line 3", areaId: "packaging", capacity: "Missing calendar", status: "Data issue" } } },
    { op: "add", node: { id: "wc-qc-1", type: "workcenter", props: { name: "QC Release Bench", areaId: "quality", capacity: "Shared bench", status: "UAT linked" } } },
    { op: "add", node: { id: "impact-cal", type: "impact", props: { text: "Packaging Line 3 calendar issue blocks the first scheduling demo." } } },
    { op: "add", node: { id: "impact-uat", type: "impact", props: { text: "One UAT script and one training puzzle are linked to the packaging area." } } },
  ];

  let trunk = [];
  let branches = new Map(); // name -> { baseIndex, events }
  let current = "main";
  let graph = { nodes: new Map(), edges: [] };
  let eventCounter = 0;

  const STORAGE_KEY = "implementationos-model-v1";

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ trunk, branches: [...branches], current, eventCounter }));
    } catch {
      // storage unavailable (private mode, quota) — stay in-memory
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!Array.isArray(data.trunk) || !data.trunk.length) return false;
      trunk = data.trunk;
      branches = new Map(data.branches || []);
      current = data.current && (data.current === "main" || branches.has(data.current)) ? data.current : "main";
      eventCounter = data.eventCounter || trunk.length;
      rebuild();
      return true;
    } catch {
      return false;
    }
  }

  function visibleEvents(branchName = current) {
    if (branchName === "main") return trunk;
    const branch = branches.get(branchName);
    if (!branch) return trunk;
    return [...trunk.slice(0, branch.baseIndex), ...branch.events];
  }

  function replay(events) {
    const nodes = new Map();
    for (const event of events) {
      for (const op of event.ops) {
        if (op.op === "add") {
          // add is an upsert so evidence nodes can be re-scored
          nodes.set(op.node.id, { id: op.node.id, type: op.node.type, props: { ...op.node.props } });
        } else if (op.op === "update") {
          const node = nodes.get(op.id);
          if (node) Object.assign(node.props, op.props);
        } else if (op.op === "remove") {
          nodes.delete(op.id);
        }
      }
    }
    const edges = [];
    for (const node of nodes.values()) {
      if (node.type === "area") edges.push({ from: "site", to: node.id, type: "contains" });
      if (node.type === "workcenter" && node.props.areaId) edges.push({ from: node.props.areaId, to: node.id, type: "contains" });
    }
    return { nodes, edges };
  }

  function rebuild() {
    graph = replay(visibleEvents());
  }

  function commit({ label = null, ops = [] }) {
    eventCounter += 1;
    const event = { id: `evt-${eventCounter}`, ts: Date.now(), branch: current, label, ops };
    if (current === "main") trunk.push(event);
    else branches.get(current).events.push(event);
    rebuild();
    save();
  }

  function touchedIds(events) {
    const ids = new Set();
    for (const event of events) {
      for (const op of event.ops) ids.add(op.op === "add" ? op.node.id : op.id);
    }
    return ids;
  }

  // What the branch changes relative to its fork point, plus conflicts:
  // nodes touched both on the branch and on main since the fork.
  function diff(branchName) {
    const branch = branches.get(branchName);
    if (!branch) return { entries: [], conflicts: [] };
    const before = replay(trunk.slice(0, branch.baseIndex)).nodes;
    const after = replay(visibleEvents(branchName)).nodes;
    const entries = [];
    for (const [id, node] of after) {
      const prev = before.get(id);
      if (!prev) {
        entries.push({ id, kind: "added", name: node.props.name || id, type: node.type, after: { ...node.props } });
        continue;
      }
      const fields = Object.keys({ ...prev.props, ...node.props }).filter(
        (key) => JSON.stringify(prev.props[key]) !== JSON.stringify(node.props[key])
      );
      if (fields.length) {
        // Carry per-field before/after so a two-pane diff can render the
        // baseline and branch states side by side.
        const changes = fields.map((field) => ({ field, before: prev.props[field], after: node.props[field] }));
        entries.push({ id, kind: "changed", name: node.props.name || id, type: node.type, fields, changes });
      }
    }
    for (const [id, node] of before) {
      if (!after.has(id)) entries.push({ id, kind: "removed", name: node.props.name || id, type: node.type, before: { ...node.props } });
    }
    const branchTouched = touchedIds(branch.events);
    const mainTouched = touchedIds(trunk.slice(branch.baseIndex));
    const conflicts = [...branchTouched].filter((id) => mainTouched.has(id));
    return { entries, conflicts };
  }

  function downstreamOf(ids) {
    const out = new Set();
    for (const edge of graph.edges) {
      if (ids.includes(edge.from) && !ids.includes(edge.to)) out.add(edge.to);
    }
    return [...out].map((id) => graph.nodes.get(id)).filter(Boolean);
  }

  function createBranch(name) {
    if (current !== "main" || name === "main" || branches.has(name)) return false;
    branches.set(name, { baseIndex: trunk.length, events: [] });
    current = name;
    rebuild();
    save();
    return true;
  }

  function checkout(name) {
    if (name !== "main" && !branches.has(name)) return;
    current = name;
    rebuild();
    save();
  }

  function discardBranch(name) {
    branches.delete(name);
    if (current === name) current = "main";
    rebuild();
    save();
  }

  function merge(name, { approver, rationale }) {
    const branch = branches.get(name);
    if (!branch) return false;
    trunk.push(...branch.events.map((event) => ({ ...event, branch: "main" })));
    branches.delete(name);
    current = "main";
    eventCounter += 1;
    trunk.push({
      id: `evt-${eventCounter}`,
      ts: Date.now(),
      branch: "main",
      label: `Merged branch "${name}" — ${rationale} (approved by ${approver}).`,
      ops: [
        {
          op: "add",
          node: { id: `decision-${eventCounter}`, type: "decision", props: { branch: name, approver, rationale, ts: Date.now() } },
        },
      ],
    });
    rebuild();
    save();
    return true;
  }

  // Evaluate fn against another branch's graph, then restore.
  function withBranch(name, fn) {
    const previous = current;
    checkout(name);
    try {
      return fn();
    } finally {
      checkout(previous);
    }
  }

  function reset() {
    trunk = [];
    branches = new Map();
    current = "main";
    eventCounter = 0;
    commit({ ops: seedOps });
  }

  if (!load()) reset();

  return {
    commit,
    reset,
    note: (label) => commit({ label, ops: [] }),
    add: (node, label = null) => commit({ label, ops: [{ op: "add", node }] }),
    update: (id, props, label = null) => commit({ label, ops: [{ op: "update", id, props }] }),
    node: (id) => graph.nodes.get(id) || null,
    nodesOfType: (type) => [...graph.nodes.values()].filter((node) => node.type === type),
    edges: () => graph.edges,
    // Human-readable trail of labelled events, newest first. Seeded
    // impact nodes come first so the initial story is preserved.
    log: () => [
      ...visibleEvents().filter((event) => event.label).map((event) => event.label).reverse(),
      ...[...graph.nodes.values()].filter((node) => node.type === "impact").map((node) => node.props.text),
    ],
    events: () => visibleEvents().slice(),
    branch: () => current,
    branchNames: () => ["main", ...branches.keys()],
    createBranch,
    checkout,
    discardBranch,
    merge,
    diff,
    downstreamOf,
    withBranch,
  };
})();
