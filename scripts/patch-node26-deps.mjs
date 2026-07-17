/**
 * Node 25+/26 workarounds for known broken transitive deps during vite-plugin-pwa /
 * workbox-build. Safe to re-run; no-ops when already patched.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = [
  {
    file: "node_modules/fs-extra/lib/fs/index.js",
    find: "if (typeof fs.realpath.native === 'function') {",
    replace:
      "if (fs.realpath && typeof fs.realpath.native === 'function') {",
  },
];

let changed = 0;
for (const t of targets) {
  const full = path.join(root, t.file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  if (text.includes(t.replace)) continue;
  if (!text.includes(t.find)) continue;
  fs.writeFileSync(full, text.replace(t.find, t.replace));
  changed += 1;
  console.log("patched", t.file);
}
if (changed === 0) console.log("node26 dep patches: up to date");
