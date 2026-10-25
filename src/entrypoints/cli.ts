#!/usr/bin/env node

/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { Command } from "commander";

import { format, publish } from "../publish.js";

const program = new Command();

program.name("docs-me").description("Publish repository documentation one way to the GitHub Wiki");

program
  .command("publish")
  .description("Map the documents to wiki pages, rewrite links, and push the wiki when something changed.")
  .option("-C, --root <dir>", "Repository root", process.cwd())
  .option("-c, --config <file>", "Configuration file, relative to the root", ".docs-me.json")
  .option("-n, --dry-run", "Print the plan (pages added/changed/removed, broken links) without writing")
  .option("--strict", "Exit non-zero when a link is broken")
  .option("--json", "Machine readable output")
  .option("-r, --repo <owner/name>", "Repository (default: GITHUB_REPOSITORY or the origin remote)")
  .option("-t, --token <token>", "Token for the wiki (default: GITHUB_TOKEN; else local git credentials)")
  .option("--wiki-remote <url>", "Explicit wiki git remote (tests, forks)")
  .option("-m, --message <text>", "Commit message for the wiki")
  .action(
    (o: {
      root: string;
      config: string;
      dryRun?: boolean;
      strict?: boolean;
      json?: boolean;
      repo?: string;
      token?: string;
      wikiRemote?: string;
      message?: string;
    }) => {
      try {
        const r = publish(o);
        console.log(o.json ? JSON.stringify(r, null, 2) : format(r));
        process.exitCode = r.ok ? 0 : 1;
      } catch (e) {
        const msg = (e as Error).message;
        console.error(o.json ? JSON.stringify({ ok: false, errors: [msg] }) : `docs-me: ${msg}`);
        process.exitCode = 2;
      }
    }
  );

program.parse();
