// Loads the exported n8n workflow and gives tests two things:
//   - its graph (nodes by name, and who connects to whom), for checking the
//     security wiring: which checks sit in front of which actions;
//   - `runCode`, which executes a Code node's real JavaScript, straight from
//     the export, against n8n-shaped inputs ($input, $json, $('Node'), items).
// Testing the exported code itself, not a copy, means a change made in the
// n8n editor and re-exported is exactly what these tests run.
import { readFileSync } from "node:fs";

const workflowUrl = new URL("../../n8n/mimo-workflow.json", import.meta.url);

export function loadWorkflow() {
  return JSON.parse(readFileSync(workflowUrl, "utf8"));
}

export function graph(workflow = loadWorkflow()) {
  const byName = new Map(workflow.nodes.map((n) => [n.name, n]));

  function node(name) {
    const n = byName.get(name);
    if (!n) throw new Error(`No node named "${name}" in the workflow`);
    return n;
  }

  /** Downstream node names on one output of a node (main outputs by default). */
  function next(name, output = 0, kind = "main") {
    const outs = workflow.connections[name]?.[kind]?.[output] ?? [];
    return outs.map((c) => c.node);
  }

  /** Every main-output edge in the graph, as [from, to]. */
  function edges() {
    const out = [];
    for (const [from, kinds] of Object.entries(workflow.connections)) {
      for (const outputs of kinds.main ?? []) {
        for (const c of outputs ?? []) out.push([from, c.node]);
      }
    }
    return out;
  }

  /** Nodes reachable from `start` over main edges, never passing through `blocked`. */
  function reachable(start, blocked = []) {
    const stop = new Set(blocked);
    const seen = new Set();
    const queue = [start];
    const all = edges();
    while (queue.length) {
      const cur = queue.shift();
      if (seen.has(cur)) continue;
      seen.add(cur);
      if (stop.has(cur) && cur !== start) continue;
      for (const [from, to] of all) if (from === cur && !seen.has(to)) queue.push(to);
    }
    seen.delete(start);
    return seen;
  }

  return { workflow, nodes: workflow.nodes, node, next, edges, reachable };
}

/**
 * Runs a Code node's jsCode.
 *   input:  the items arriving on its input, as plain json objects
 *   nodes:  { "Other Node": [json, ...] } for $('Other Node') lookups
 *   binary: { "Other Node": binaryObject } for $('Other Node').item.binary
 * Returns the node's output items.
 */
export function runCode(nodeName, { input = [], nodes = {}, binary = {} } = {}, workflow = loadWorkflow()) {
  const codeNode = workflow.nodes.find((n) => n.name === nodeName);
  if (!codeNode?.parameters?.jsCode) throw new Error(`"${nodeName}" is not a Code node`);

  const wrap = (json) => ({ json });
  const items = input.map(wrap);
  const $input = {
    all: () => items,
    first: () => items[0],
    last: () => items[items.length - 1],
    item: items[0],
  };
  const $ = (name) => {
    const outputs = nodes[name];
    if (!outputs) throw new Error(`Code node "${nodeName}" read $('${name}'), which the test did not provide`);
    const wrapped = outputs.map(wrap);
    return {
      all: () => wrapped,
      first: () => wrapped[0],
      last: () => wrapped[wrapped.length - 1],
      item: { json: outputs[0], binary: binary[name] },
    };
  };

  const fn = new Function("$input", "$", "$json", "items", codeNode.parameters.jsCode);
  return fn($input, $, items[0]?.json, items);
}
