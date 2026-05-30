/**
 * Imported FIRST in index.ts (before node:sqlite is loaded) so the override is
 * installed before Node emits its one-time experimental-SQLite warning. ESM
 * evaluates imports in textual order depth-first; this module has no deps, so it
 * runs before the db layer pulls in node:sqlite.
 *
 * Only the SQLite experimental warning is dropped; every other warning passes.
 */
const original = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const msg = typeof warning === "string" ? warning : warning?.message;
  if (msg && msg.includes("SQLite is an experimental feature")) return;
  // @ts-expect-error pass-through to the original overloaded signature
  return original(warning, ...rest);
}) as typeof process.emitWarning;

export {};
