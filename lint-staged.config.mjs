/**
 * Formats and lints only the staged files.
 *
 * The file lists are built here rather than declared in package.json because
 * Windows caps a command line at about 8000 characters, and a commit that
 * touches a hundred files — a bulk move, a dependency bump, a formatting pass —
 * exceeds it. Past a threshold the whole-project scripts run instead: slower,
 * but the same checks, and never a commit that quietly skipped them.
 */

const WHOLE_PROJECT_THRESHOLD = 40;

/** Absolute paths, and this repository lives under a directory with a space. */
function quote(files) {
  return files.map((file) => JSON.stringify(file)).join(' ');
}

export default {
  '*.{ts,tsx,js,jsx,mjs,cjs,mts}': (files) =>
    files.length > WHOLE_PROJECT_THRESHOLD
      ? ['prettier --write .', 'eslint --fix --max-warnings=0 .']
      : [
          `prettier --write ${quote(files)}`,
          `eslint --fix --max-warnings=0 --no-warn-ignored ${quote(files)}`,
        ],
  '*.{json,md,yml,yaml,css}': (files) =>
    files.length > WHOLE_PROJECT_THRESHOLD
      ? ['prettier --write .']
      : [`prettier --write ${quote(files)}`],
};
