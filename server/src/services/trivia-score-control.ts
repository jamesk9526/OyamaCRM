/** Resolve a phone score action against the latest server total. */
export function resolveRemoteScore(previousScore: number, payload: Record<string, unknown>, allowNegative: boolean) {
  const settingTotal = payload.total !== undefined;
  if (settingTotal && (typeof payload.total !== "number" || !Number.isInteger(payload.total) || payload.total < 0 || payload.total > 2_147_483_647)) {
    return { ok: false as const, message: "Enter a whole-number total from 0 to 2147483647." };
  }
  if (!settingTotal && (typeof payload.delta !== "number" || !Number.isInteger(payload.delta))) {
    return { ok: false as const, message: "Enter a whole-number score adjustment." };
  }
  const delta = Math.max(-100, Math.min(100, Number(payload.delta) || 0));
  const nextScore = settingTotal ? Number(payload.total) : allowNegative ? previousScore + delta : Math.max(0, previousScore + delta);
  if (!Number.isInteger(nextScore) || nextScore < -2_147_483_648 || nextScore > 2_147_483_647) {
    return { ok: false as const, message: "The score is outside the supported whole-number range." };
  }
  if (nextScore === previousScore) return { ok: false as const, message: "That adjustment would not change the score." };
  return { ok: true as const, nextScore, appliedDelta: nextScore - previousScore };
}
