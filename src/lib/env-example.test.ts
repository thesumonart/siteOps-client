import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * `.env.example` is the deployment checklist. Every variable this app reads has
 * to appear in it, or the first person to deploy discovers the omission as a
 * build that fails — at the least convenient possible moment.
 *
 * Keeping it correct by hand does not work: a variable gets added during a
 * feature and the example file is updated later, or never. This test reads the
 * env module as text and fails the build instead.
 */

/*
 * Resolved from the working directory rather than `import.meta.url`: Vitest
 * serves this module through Vite, where that value is an http URL and not a
 * path on disk. The runner's working directory is the project root.
 */
function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

const example = read('.env.example');

/** Documented names, whether or not the line is commented out. */
const documented = new Set(
  [...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1] ?? ''),
);

describe('.env.example', () => {
  it('documents every browser-visible variable the app reads', () => {
    const source = read('src/lib/env.ts');
    const keys = [...source.matchAll(/(NEXT_PUBLIC_[A-Z0-9_]+):/g)].map((match) => match[1] ?? '');

    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !documented.has(key))).toEqual([]);
  });

  it('documents nothing that is not browser-visible', () => {
    // A non-public name here would be misread as configuration this project
    // needs. It does not have any: the server keeps its own environment, and
    // anything named in this file is compiled into the bundle regardless.
    const undeclared = [...documented].filter((key) => !key.startsWith('NEXT_PUBLIC_'));

    expect(undeclared).toEqual([]);
  });

  it('never carries a real secret', () => {
    // This file is committed and its values reach the browser, so the shapes
    // that would matter if one were ever pasted in by accident are worth
    // catching here.
    expect(example).not.toMatch(/mongodb(\+srv)?:\/\//);
    expect(example).not.toMatch(/re_[A-Za-z0-9]{20,}/);
    expect(example).not.toMatch(/AUTH_SECRET/);
  });
});
