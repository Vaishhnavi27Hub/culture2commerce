/**
 * Small helper for keeping docs/features.json tidy from the command line.
 *
 *   node scripts/progress.mjs set <feature-id> <status> "<notes>" [test-path ...]
 *   node scripts/progress.mjs list
 */
import fs from "node:fs";

const FILE = "docs/features.json";
const STATUSES = ["pending", "in_progress", "implemented", "tested"];
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
const [command, id, status, notes, ...tests] = process.argv.slice(2);

if (command === "list") {
  for (const f of data.features) console.log(`${f.status.padEnd(12)} ${f.id}`);
} else if (command === "set") {
  const feature = data.features.find((f) => f.id === id);
  if (!feature) throw new Error(`Unknown feature id: ${id}`);
  if (!STATUSES.includes(status)) throw new Error(`Status must be one of ${STATUSES.join(", ")}`);
  feature.status = status;
  if (notes !== undefined) feature.notes = notes;
  if (tests.length) feature.tests = tests;
  data.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${id} -> ${status}`);
} else {
  console.log("Usage: node scripts/progress.mjs set <id> <status> \"<notes>\" [tests...] | list");
}
