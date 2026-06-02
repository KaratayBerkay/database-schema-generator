export const PREFLIGHT_PAGE_SIZE = 8;

export function shortUuid(uuid: string): string {
  return uuid.slice(0, 8);
}
