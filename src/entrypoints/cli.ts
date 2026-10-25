#!/usr/bin/env node

/*
 * SPDX-FileCopyrightText: 2026 Kevin de Jong <monkaii@hotmail.com>
 * SPDX-License-Identifier: MIT
 */

import { Command } from "commander";

const program = new Command();

program.name("docs-me").description("Publish repository documentation one way to the GitHub Wiki");

program.parse();
