// Room names are persisted with the " Office NN" suffix and capped at 32 chars.
export const TEAM_NAME_MAX_CHARACTERS = 22;
export const MAX_OFFICE_TEAM_COUNT = 250;

export function defaultOfficeTeamName(index: number): string {
  return `Team ${index + 1}`;
}

export function createDefaultOfficeTeamNames(count: number): string[] {
  const safeCount = Math.max(0, Math.min(MAX_OFFICE_TEAM_COUNT, Math.floor(Number.isFinite(count) ? count : 0)));
  return Array.from({ length: safeCount }, (_, index) => defaultOfficeTeamName(index));
}

export function resizeOfficeTeamNames(names: readonly string[], count: number): string[] {
  const safeCount = Math.max(0, Math.min(MAX_OFFICE_TEAM_COUNT, Math.floor(Number.isFinite(count) ? count : 0)));
  return Array.from({ length: safeCount }, (_, index) => names[index] ?? defaultOfficeTeamName(index));
}

export function areOfficeTeamNamesValid(names: readonly string[], count: number): boolean {
  return names.length === count && names.every((name) => typeof name === "string" && name.trim().length > 0);
}

export function normalizeOfficeTeamNames(names: readonly string[], count: number): string[] {
  return resizeOfficeTeamNames(names, count).map((name) => name.trim());
}
