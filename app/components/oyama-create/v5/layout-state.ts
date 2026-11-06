export type WorkspaceLayout = { left: number; right: number; compact: boolean; leftOpen: boolean; rightOpen: boolean; zoom: number };
export const DEFAULT_WORKSPACE_LAYOUT: WorkspaceLayout = { left: 235, right: 296, compact: false, leftOpen: true, rightOpen: true, zoom: 0 };
export function normalizeWorkspaceLayout(value: unknown): WorkspaceLayout {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const size = (key: string, min: number, max: number, fallback: number) => typeof input[key] === "number" && Number.isFinite(input[key]) ? Math.min(max, Math.max(min, input[key] as number)) : fallback;
  return { left: size("left", 180, 390, 235), right: size("right", 225, 460, 296), zoom: size("zoom", 0, 200, 0), compact: input.compact === true, leftOpen: input.leftOpen !== false, rightOpen: input.rightOpen !== false };
}
