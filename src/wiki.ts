/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { ASSET_DIR, MARKER_PREFIX, Plan } from "./plan.js";

export interface Changes {
  added: string[];
  changed: string[];
  removed: string[];
  unchanged: string[];
  /** Pages in the wiki that docs-me does not own but wants to write */
  conflicts: string[];
  assets: { added: string[]; changed: string[]; removed: string[] };
}

export function git(cwd: string, args: string[], opts: { quiet?: boolean } = {}): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", opts.quiet ? "ignore" : "pipe"],
    }).trim();
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message: string };
    throw new Error(
      `git ${args[0]} failed: ${String(err.stderr ?? err.message)
        .replace(/x-access-token:[^@]*@/g, "***@")
        .trim()}`
    );
  }
}

/** Reads every file below dir as relative posix path -> Buffer. */
function walk(dir: string, rel = ""): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(path.join(dir, e.name), r).forEach((v, k) => out.set(k, v));
    else out.set(r, fs.readFileSync(path.join(dir, e.name)));
  }
  return out;
}

/** Whether a wiki page text carries the docs-me marker. */
export const isOwned = (text: string): boolean => text.startsWith(MARKER_PREFIX);

/**
 * Compares the plan with the wiki working tree; with write=true also updates the working tree.
 * Pages owned by docs-me whose source is gone are removed; foreign pages are never touched (except Home).
 */
export function applyPlan(wikiDir: string, plan: Plan, root: string, write: boolean): Changes {
  const ch: Changes = {
    added: [],
    changed: [],
    removed: [],
    unchanged: [],
    conflicts: [],
    assets: { added: [], changed: [], removed: [] },
  };
  const existing = new Map<string, string>();
  for (const f of fs.existsSync(wikiDir) ? fs.readdirSync(wikiDir) : []) {
    if (f.endsWith(".md") && fs.statSync(path.join(wikiDir, f)).isFile())
      existing.set(f.slice(0, -3), fs.readFileSync(path.join(wikiDir, f), "utf8"));
  }
  for (const [name, text] of [...plan.pages].sort((a, b) => a[0].localeCompare(b[0]))) {
    const old = existing.get(name);
    if (old === undefined) ch.added.push(name);
    else if (!isOwned(old) && name !== "Home" && name !== "_Sidebar") ch.conflicts.push(name);
    else if (old === text) ch.unchanged.push(name);
    else ch.changed.push(name);
    if (write && !ch.conflicts.includes(name) && old !== text) fs.writeFileSync(path.join(wikiDir, `${name}.md`), text);
  }
  for (const [name, text] of [...existing].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!plan.pages.has(name) && isOwned(text)) {
      ch.removed.push(name);
      if (write) fs.rmSync(path.join(wikiDir, `${name}.md`));
    }
  }

  // Assets: the whole _assets/ directory is owned by docs-me
  const want = new Map<string, Buffer>();
  for (const [wikiPath, src] of [...plan.assets].sort((a, b) => a[0].localeCompare(b[0])))
    want.set(wikiPath, fs.readFileSync(path.join(root, src)));
  const have = walk(path.join(wikiDir, ASSET_DIR));
  for (const [p, buf] of want) {
    const old = have.get(p);
    if (!old) ch.assets.added.push(p);
    else if (!old.equals(buf)) ch.assets.changed.push(p);
    if (write && (!old || !old.equals(buf))) {
      fs.mkdirSync(path.dirname(path.join(wikiDir, ASSET_DIR, p)), { recursive: true });
      fs.writeFileSync(path.join(wikiDir, ASSET_DIR, p), buf);
    }
  }
  for (const p of have.keys()) {
    if (!want.has(p)) {
      ch.assets.removed.push(p);
      if (write) fs.rmSync(path.join(wikiDir, ASSET_DIR, p));
    }
  }
  if (write && fs.existsSync(path.join(wikiDir, ASSET_DIR))) pruneEmpty(path.join(wikiDir, ASSET_DIR));
  return ch;
}

function pruneEmpty(dir: string): void {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) pruneEmpty(path.join(dir, e.name));
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

export const hasChanges = (c: Changes): boolean =>
  c.added.length +
    c.changed.length +
    c.removed.length +
    c.assets.added.length +
    c.assets.changed.length +
    c.assets.removed.length >
  0;

/** Clones the wiki; returns the directory or undefined when it does not exist (yet). */
export function cloneWiki(remote: string): { dir: string; error?: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-me-wiki-"));
  try {
    execFileSync("git", ["clone", "--quiet", remote, dir], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { dir };
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message: string };
    return {
      dir,
      error: String(err.stderr ?? err.message)
        .replace(/x-access-token:[^@]*@/g, "***@")
        .trim(),
    };
  }
}

export function commitAndPush(dir: string, message: string, push: boolean): string {
  git(dir, ["add", "-A"]);
  const hasName = (() => {
    try {
      return git(dir, ["config", "user.name"], { quiet: true }) !== "";
    } catch (_e) {
      return false;
    }
  })();
  const id = hasName
    ? []
    : ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com"];
  git(dir, [...id, "commit", "--quiet", "-m", message]);
  const sha = git(dir, ["rev-parse", "--short", "HEAD"]);
  if (push) git(dir, ["push", "--quiet", "origin", "HEAD"]);
  return sha;
}
