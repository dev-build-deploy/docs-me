/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import * as core from "@actions/core";

import { format, publish } from "../publish.js";

try {
  const token = core.getInput("token") || process.env.GITHUB_TOKEN;
  if (token) core.setSecret(token);
  const r = publish({
    root: process.env.GITHUB_WORKSPACE ?? process.cwd(),
    config: core.getInput("config") || undefined,
    dryRun: core.getBooleanInput("dry-run"),
    strict: core.getBooleanInput("strict"),
    token,
  });
  core.info(format(r));
  core.setOutput("changed", String(r.pushed));
  core.setOutput("pages", String(r.changes.added.length + r.changes.changed.length + r.changes.removed.length));
  core.setOutput("broken-links", String(r.broken.length));
  if (!r.ok) core.setFailed(r.errors.join("; "));
} catch (e) {
  core.setFailed((e as Error).message);
}
