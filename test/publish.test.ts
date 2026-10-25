/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import fs from "fs";
import os from "os";
import path from "path";

import { publish } from "../src/publish";

import { git, makeTree, makeWiki, TREE } from "./helpers";

function setup(): {
  root: string;
  wiki: string;
  run: (o?: object) => ReturnType<typeof publish>;
  wikiLog: () => string[];
  wikiFile: (f: string) => string;
} {
  const root = makeTree(TREE);
  git(root, "init", "-q", "-b", "main");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "init");
  const wiki = makeWiki();
  const run = (o: object = {}): ReturnType<typeof publish> => publish({ root, wikiRemote: wiki, repo: "o/r", ...o });
  const wikiLog = (): string[] => git(wiki, "log", "--format=%s").split("\n");
  const wikiFile = (f: string): string => {
    const co = fs.mkdtempSync(path.join(os.tmpdir(), "docs-me-co-"));
    git(co, "clone", "-q", wiki, ".");
    return fs.readFileSync(path.join(co, f), "utf8");
  };
  return { root, wiki, run, wikiLog, wikiFile };
}

test("dry-run plans without writing", () => {
  const s = setup();
  const r = s.run({ dryRun: true });
  expect(r.changes.added).toContain("Engine-catalogue");
  expect(r.changes.changed).toEqual(["Home"]);
  expect(r.pushed).toBe(false);
  expect(s.wikiLog()).toEqual(["Initial Home page"]);
});

test("publish writes pages, assets and the sidebar; a second run makes no commit", () => {
  const s = setup();
  const r1 = s.run();
  expect(r1.ok).toBe(true);
  expect(r1.pushed).toBe(true);
  expect(s.wikiFile("_Sidebar.md")).toContain("[Engine](Engine)");
  expect(s.wikiFile("_assets/engine/docs/img/a.png")).toBeDefined();
  const r2 = s.run();
  expect(r2.pushed).toBe(false);
  expect(r2.changes.added.length + r2.changes.changed.length + r2.changes.removed.length).toBe(0);
  expect(s.wikiLog()).toHaveLength(2);
});

test("pages whose source is gone are removed; foreign pages are kept", () => {
  const s = setup();
  s.run();
  const co = fs.mkdtempSync(path.join(os.tmpdir(), "docs-me-co-"));
  git(co, "clone", "-q", s.wiki, ".");
  fs.writeFileSync(path.join(co, "Handmade.md"), "mine\n");
  git(co, "add", "-A");
  git(co, "commit", "-q", "-m", "hand");
  git(co, "push", "-q");
  fs.rmSync(path.join(s.root, "games/leertoren/docs/design.md"));
  fs.rmSync(path.join(s.root, "engine/docs/img/a.png"));
  git(s.root, "add", "-A");
  git(s.root, "commit", "-q", "-m", "rm");
  const r = s.run();
  expect(r.changes.removed).toEqual(["Leertoren-design"]);
  expect(r.changes.assets.removed).toEqual(["engine/docs/img/a.png"]);
  expect(s.wikiFile("Handmade.md")).toBe("mine\n");
  expect(() => s.wikiFile("Leertoren-design.md")).toThrow();
});

test("strict fails on broken links and pushes nothing", () => {
  const s = setup();
  const r = s.run({ strict: true });
  expect(r.ok).toBe(false);
  expect(r.pushed).toBe(false);
  expect(r.broken).toHaveLength(1);
  expect(s.wikiLog()).toEqual(["Initial Home page"]);
});

test("a foreign page with the name of a doc is a conflict, not overwritten", () => {
  const s = setup();
  const co = fs.mkdtempSync(path.join(os.tmpdir(), "docs-me-co-"));
  git(co, "clone", "-q", s.wiki, ".");
  fs.writeFileSync(path.join(co, "Engine.md"), "mine\n");
  git(co, "add", "-A");
  git(co, "commit", "-q", "-m", "hand");
  git(co, "push", "-q");
  const r = s.run();
  expect(r.ok).toBe(false);
  expect(r.changes.conflicts).toEqual(["Engine"]);
  expect(s.wikiFile("Engine.md")).toBe("mine\n");
});

test("a missing wiki is an error for publish, a note for dry-run", () => {
  const root = makeTree(TREE);
  expect(() => publish({ root, repo: "o/r", wikiRemote: "/nonexistent/wiki.git" })).toThrow(/first page/);
  const r = publish({ root, repo: "o/r", wikiRemote: "/nonexistent/wiki.git", dryRun: true });
  expect(r.wikiFound).toBe(false);
  expect(r.changes.added).toContain("Home");
});

test("an unrelated commit does not rewrite the pages (banner uses the last commit touching the file)", () => {
  const s = setup();
  s.run();
  fs.writeFileSync(path.join(s.root, "engine/src/other.c"), "x\n");
  git(s.root, "add", "-A");
  git(s.root, "commit", "-q", "-m", "other");
  const r = s.run({ config: ".docs-me.json" });
  // only pages with links to non-doc files (blob url at the commit) change
  expect(r.changes.changed.sort()).toEqual(["Engine-sub-deep", "Home"]);
});
