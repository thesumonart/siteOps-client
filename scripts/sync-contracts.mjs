#!/usr/bin/env node
/**
 * Ports `siteOps-server/src/contracts` into `src/contracts`.
 *
 * The two repositories share no runtime code; they agree by keeping a byte-for-
 * byte copy of the contract directory on each side. That copy was maintained by
 * hand, which works exactly until one file in a twenty-file change is missed —
 * and the symptom is a screen that breaks in front of a user, because nothing
 * in either build compares the two.
 *
 * The single permitted difference is the import specifier. The server is
 * NodeNext ESM and needs explicit `.js` on every relative import; the Next.js
 * bundler resolves extensionless paths and TypeScript's `bundler` resolution
 * rejects the `.js` form. So specifiers are rewritten on the way across and
 * nothing else is touched.
 *
 * This is a developer convenience, not a build step. It runs only when the
 * server repository is checked out alongside this one, and it never runs
 * automatically — a contract change is a decision, and it should appear in a
 * diff someone reads.
 *
 * Usage:  pnpm contracts:sync [--check]
 *
 * `--check` reports drift and exits non-zero without writing, which is what CI
 * runs. A clean check is the guarantee that the dashboard is compiled against
 * the same contract the API serves.
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientContracts = resolve(here, '..', 'src', 'contracts');
const serverContracts = resolve(here, '..', '..', 'siteOps-server', 'src', 'contracts');

const checkOnly = process.argv.includes('--check');

if (!existsSync(serverContracts)) {
  process.stderr.write(
    `siteOps-server is not checked out beside this repository (looked in ${serverContracts}).\n` +
      'Port the contract change by hand, or clone the backend as a sibling directory.\n',
  );
  process.exit(checkOnly ? 0 : 1);
}

/** Every `.ts` file under a directory, as paths relative to it. */
function listFiles(root, prefix = '') {
  const entries = readdirSync(join(root, prefix), { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...listFiles(root, relativePath));
    else if (entry.name.endsWith('.ts')) files.push(relativePath);
  }

  return files.sort();
}

/**
 * Drops the `.js` suffix from relative import and export specifiers.
 *
 * Anchored on `./` or `../` so a package name that happens to end in `.js` is
 * left alone, and applied to `from '...'` clauses only — never to a string in
 * the body of the module.
 */
function toBundlerSpecifiers(source) {
  return source.replace(/(from\s+')(\.\.?\/[^']*)\.js(')/g, '$1$2$3');
}

const sourceFiles = listFiles(serverContracts);
const existing = existsSync(clientContracts) ? listFiles(clientContracts) : [];

const changed = [];
const removed = existing.filter((file) => !sourceFiles.includes(file));

for (const file of sourceFiles) {
  const ported = toBundlerSpecifiers(readFileSync(join(serverContracts, file), 'utf8'));
  const target = join(clientContracts, file);
  const current = existsSync(target) ? readFileSync(target, 'utf8') : null;

  if (current === ported) continue;
  changed.push(file);

  if (!checkOnly) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, ported, 'utf8');
  }
}

if (!checkOnly) {
  for (const file of removed) rmSync(join(clientContracts, file));
}

const drift = changed.length + removed.length;

if (checkOnly) {
  if (drift === 0) {
    process.stdout.write('Contracts are in sync with siteOps-server.\n');
    process.exit(0);
  }
  for (const file of changed) process.stderr.write(`  differs: ${file}\n`);
  for (const file of removed) process.stderr.write(`  removed upstream: ${file}\n`);
  process.stderr.write(
    `\n${String(drift)} contract file(s) drifted. Run "pnpm contracts:sync" and commit the result.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  drift === 0
    ? 'Contracts already in sync.\n'
    : `Ported ${String(changed.length)} file(s), removed ${String(removed.length)}, from ${relative(process.cwd(), serverContracts)}.\n`,
);
