#!/usr/bin/env node
// Runs the Security Lab checks against the installed toolkit version from the CLI.
// Exit code: 0 always by default (the output is the evidence). Pass --strict to
// exit 1 when any high-severity concern is exposed, e.g. to gate an upgrade.
import { readFileSync } from 'node:fs';
import { runChecks } from '../src/lab/checks.js';

// package.json is not in the toolkit's "exports" map, so read it from disk.
const { version } = JSON.parse(
  readFileSync(new URL('../node_modules/@tantainnovative/ndpr-toolkit/package.json', import.meta.url), 'utf8'),
);
const strict = process.argv.includes('--strict');

const color = process.stdout.isTTY && !process.argv.includes('--no-color');
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const tag = (chk) =>
  chk.strength ? c(32, 'STRENGTH') : chk.exposed ? c(chk.severity === 'high' ? 31 : 33, `EXPOSED:${chk.severity.toUpperCase()}`) : c(32, 'OK');

const checks = runChecks();
console.log(`\n@tantainnovative/ndpr-toolkit@${version} - security probe\n`);
for (const chk of checks) {
  console.log(`${tag(chk).padEnd(color ? 26 : 16)} ${chk.title}`);
  console.log(`  observed:   ${chk.observed}`);
  console.log(`  mitigation: ${chk.mitigation}\n`);
}
const high = checks.filter((x) => x.exposed && x.severity === 'high').length;
const exposed = checks.filter((x) => x.exposed).length;
console.log(`${exposed} concern(s) confirmed, ${high} high. These are adoption risks to mitigate in YOUR app, not package vulnerabilities.`);
if (strict && high > 0) process.exit(1);
