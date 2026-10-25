// SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
// SPDX-License-Identifier: CC0-1.0

// Runs the committed bundles the way users do: `bin/docs-me --help`, and `bin/docs-me publish --dry-run --strict`
// on a document set with and without a broken link. Catches a bundle or bin wrapper that no longer loads (e.g.
// CommonJS `require` of an ESM bundle). Usage: node scripts/smoke-bin.mjs

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const bin = resolve("bin/docs-me");
const root = mkdtempSync(join(tmpdir(), "docs-me-smoke-"));

const docs = (name, page) => {
  const dir = join(root, name);
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, ".docs-me.json"), JSON.stringify({ sources: [{ path: "docs", section: "Docs" }], home: "README.md" }));
  writeFileSync(join(dir, "README.md"), "# Home\n");
  writeFileSync(join(dir, "docs", "a.md"), page);
  return dir;
};
const good = docs("good", "# A page\n[home](../README.md)\n");
const bad = docs("bad", "# A page\n[gone](./nope.md)\n");

const publish = dir => ["publish", "--dry-run", "--strict", "-C", dir, "-r", "smoke/test", "--wiki-remote", join(root, "no-wiki.git")];
const cases = [
  { args: ["--help"], exit: 0, output: /Publish repository documentation/ },
  { args: publish(good), exit: 0, output: /\+ Home/ },
  { args: publish(bad), exit: 1, output: /broken docs\/a\.md:2/ },
];

let failed = false;
for (const c of cases) {
  const run = spawnSync(process.execPath, [bin, ...c.args], { encoding: "utf8" });
  const out = `${run.stdout}${run.stderr}`;
  const ok = run.status === c.exit && c.output.test(out);
  console.log(`${ok ? "ok  " : "FAIL"} bin/docs-me ${c.args[0]} ${c.args[0] === "publish" ? c.args[4].split("/").pop() : ""} (exit ${run.status}, expected ${c.exit})`);
  if (!ok) {
    failed = true;
    console.error(out.trim());
  }
}
rmSync(root, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
