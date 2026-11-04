import { prisma } from "../lib/prisma.js";
import { DEFAULT_MEETING_SETTINGS, type MeetingSettings } from "../lib/meeting-settings.js";

export const MEETING_SETTINGS_KEY = "meeting-defaults";
export class MeetingInputError extends Error {}

export function validateMeetingSettings(value: unknown): MeetingSettings {
  const input = value as MeetingSettings | null;
  if (!input || ![30, 45, 60, 90, 120].includes(input.defaultDuration)
    || ![1, 2, 3, 5, 7].includes(input.followUpDays)
    || typeof input.autoTimeline !== "boolean" || typeof input.autoFollowUp !== "boolean"
    || typeof input.followUpMessage !== "string" || input.followUpMessage.trim().length > 2000
    || input.autoFollowUp && !input.followUpMessage.trim()) {
    throw new MeetingInputError("Choose supported meeting defaults and a follow-up message up to 2,000 characters.");
  }
  return { defaultDuration: input.defaultDuration, autoTimeline: input.autoTimeline, autoFollowUp: input.autoFollowUp, followUpDays: input.followUpDays, followUpMessage: input.followUpMessage.trim() };
}

export async function loadMeetingSettings(organizationId: string): Promise<MeetingSettings> {
  const stored = await prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId, pluginKey: MEETING_SETTINGS_KEY } } });
  return stored ? validateMeetingSettings(stored.config) : { ...DEFAULT_MEETING_SETTINGS };
}
