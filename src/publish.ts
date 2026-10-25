/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import fs from "fs";
import path from "path";

import { DEFAULT_CONFIG_FILE, loadConfiguration } from "./config";
import { buildPlan, BrokenLink, RepoInfo } from "./plan";
import { applyPlan, Changes, cloneWiki, commitAndPush, git, hasChanges } from "./wiki";

export interface PublishOptions {
  root: string;
  config?: string;
  dryRun?: boolean;
  strict?: boolean;
  /** "owner/name"; default GITHUB_REPOSITORY or the origin remote */
  repo?: string;
  /** Token for the wiki remote; default GITHUB_TOKEN. Without one the local git credentials are used. */
  token?: string;
  /** Explicit wiki remote (tests, forks); overrides repo/token */
  wikiRemote?: string;
  message?: string;
}

export interface PublishResult {
  ok: boolean;
  repo: string;
  sha: string;
  dryRun: boolean;
  wikiFound: boolean;
  changes: Changes;
  broken: BrokenLink[];
  committed?: string;
  pushed: boolean;
  errors: string[];
}

export function detectRepo(root: string): string {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = git(root, ["remote", "get-url", "origin"]);
  const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?\/?$/.exec(url);
  if (!m) throw new Error(`Cannot derive owner/name from origin (${url}); pass --repo`);
  return m[1];
}

export function publish(opts: PublishOptions): PublishResult {
  const root = path.resolve(opts.root);
  const cfg = loadConfiguration(root, opts.config ?? DEFAULT_CONFIG_FILE);
  const repo = opts.repo ?? (opts.wikiRemote ? "local/local" : detectRepo(root));
  let sha = "0000000";
  let full = "0000000000000000000000000000000000000000";
  const inGit = fs.existsSync(path.join(root, ".git"));
  if (inGit) {
    full = git(root, ["rev-parse", "HEAD"]);
    sha = full.slice(0, 7);
  }
  const memo = new Map<string, string | undefined>();
  const info: RepoInfo = {
    repo,
    sha: full,
    shortSha: sha,
    lastCommit: (file: string) => {
      if (!inGit) return undefined;
      if (!memo.has(file)) {
        let v: string | undefined;
        try {
          v = git(root, ["log", "-1", "--format=%H", "--", file], { quiet: true }) || undefined;
        } catch (_e) {
          v = undefined;
        }
        memo.set(file, v);
      }
      return memo.get(file);
    },
  };

  const plan = buildPlan(root, cfg, info);
  const token = opts.token ?? process.env.GITHUB_TOKEN;
  const remote =
    opts.wikiRemote ??
    (token ? `https://x-access-token:${token}@github.com/${repo}.wiki.git` : `https://github.com/${repo}.wiki.git`);
  const clone = cloneWiki(remote);
  const errors: string[] = [];
  const result: PublishResult = {
    ok: true,
    repo,
    sha,
    dryRun: !!opts.dryRun,
    wikiFound: !clone.error,
    changes: {
      added: [],
      changed: [],
      removed: [],
      unchanged: [],
      conflicts: [],
      assets: { added: [], changed: [], removed: [] },
    },
    broken: plan.broken,
    pushed: false,
    errors,
  };
  try {
    if (clone.error) {
      if (!opts.dryRun)
        throw new Error(
          `Cannot clone the wiki (${clone.error.split("\n").pop()}). A wiki must be initialised once by creating a first page in the GitHub UI.`
        );
      errors.push("wiki not found or not readable: planning against an empty wiki");
      fs.rmSync(clone.dir, { recursive: true, force: true });
      fs.mkdirSync(clone.dir, { recursive: true });
    }
    result.changes = applyPlan(clone.dir, plan, root, !opts.dryRun);
    if (result.changes.conflicts.length)
      errors.push(
        `pages exist in the wiki that docs-me does not own (no marker): ${result.changes.conflicts.join(", ")}`
      );
    if (opts.strict && plan.broken.length) errors.push(`${plan.broken.length} broken link(s)`);
    if (errors.some(e => !e.startsWith("wiki not found"))) result.ok = false;
    if (!opts.dryRun && result.ok && hasChanges(result.changes)) {
      const c = result.changes;
      const msg = opts.message ?? `docs: publish ${sha} (+${c.added.length} ~${c.changed.length} -${c.removed.length})`;
      result.committed = commitAndPush(clone.dir, msg, true);
      result.pushed = true;
    }
  } finally {
    fs.rmSync(clone.dir, { recursive: true, force: true });
  }
  return result;
}

export function format(r: PublishResult): string {
  const c = r.changes;
  const out = [
    `docs-me ${r.dryRun ? "plan" : "publish"} ${r.repo} @ ${r.sha}: +${c.added.length} ~${c.changed.length} -${c.removed.length} =${c.unchanged.length} pages, assets +${c.assets.added.length} ~${c.assets.changed.length} -${c.assets.removed.length}`,
  ];
  for (const [sign, list] of [
    ["+", c.added],
    ["~", c.changed],
    ["-", c.removed],
  ] as const)
    for (const p of list) out.push(`  ${sign} ${p}`);
  for (const b of r.broken) out.push(`  broken ${b.file}:${b.line} (${b.dest}): ${b.reason}`);
  for (const e of r.errors) out.push(`  ! ${e}`);
  if (r.committed) out.push(`pushed wiki commit ${r.committed}`);
  else if (!r.dryRun) out.push("nothing to publish");
  return out.join("\n");
}
