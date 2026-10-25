/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

/** Writes files (path -> content) into a fresh temp directory and returns it. */
export function makeTree(files: Record<string, string | Buffer>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-me-test-"));
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), c);
  }
  return dir;
}

export const git = (cwd: string, ...args: string[]): string =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" }).trim();

/** A bare repository with one initial page, standing in for <repo>.wiki.git */
export function makeWiki(): string {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), "docs-me-bare-"));
  git(bare, "init", "--bare", "-q", "-b", "master");
  const seed = fs.mkdtempSync(path.join(os.tmpdir(), "docs-me-seed-"));
  git(seed, "init", "-q", "-b", "master");
  fs.writeFileSync(path.join(seed, "Home.md"), "Created in the UI\n");
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "Initial Home page");
  git(seed, "push", "-q", bare, "master");
  return bare;
}

export const CONFIG = {
  sources: [
    { path: "engine/docs/**", section: "Engine" },
    { path: "games/leertoren/docs", section: "Leertoren" },
  ],
  exclude: ["**/draft/**"],
  home: "README.md",
};

export const TREE: Record<string, string | Buffer> = {
  ".docs-me.json": JSON.stringify(CONFIG),
  "README.md":
    "---\ntitle: Welcome\n---\n# Project\nSee [catalogue](engine/docs/catalogue.md#items) and [code](engine/src/main.c).\n",
  "engine/docs/index.md": "# Engine\n[Catalogue](catalogue.md)\n",
  "engine/docs/catalogue.md":
    "---\ntitle: The Catalogue\n---\n# Cat\n[up](index.md) [sub](sub/deep.md#x) ![pic](img/a.png) [bad](nope.md)\n```\n[code](nope.md)\n```\n`[inline](nope.md)` [ext](https://example.com/a.md) [anchor](#here)\n",
  "engine/docs/img/a.png": Buffer.from([1, 2, 3]),
  "engine/docs/sub/deep.md": "# Deep\n[leertoren](../../../games/leertoren/docs/design.md) [dir](../../src)\n",
  "engine/docs/draft/wip.md": "# WIP\n",
  "engine/src/main.c": "int main(){}\n",
  "games/leertoren/docs/design.md": "# Design\n",
};
