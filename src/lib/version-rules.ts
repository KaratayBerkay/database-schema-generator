// The imported "original" version (version-0). It is the schema exactly as pulled from the source
// database and must stay frozen: it's read-only and only selectable as a migration *source*, so the
// schema you collect data against can never drift. Created only by the database-import flow.

export const ORIGINAL_VERSION_NAME = "0";

export function isOriginalVersion(name: string): boolean {
  return name.trim() === ORIGINAL_VERSION_NAME;
}

/** The version a user should land on / edit — the first that isn't the read-only original. */
export function defaultWorkingVersion(versionNames: string[]): string | undefined {
  return versionNames.find((n) => !isOriginalVersion(n)) ?? versionNames[0];
}
