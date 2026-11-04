export type MeetingSettings = {
  defaultDuration: number;
  autoTimeline: boolean;
  autoFollowUp: boolean;
  followUpDays: number;
  followUpMessage: string;
};

export const DEFAULT_MEETING_SETTINGS: MeetingSettings = {
  defaultDuration: 60, autoTimeline: true, autoFollowUp: false, followUpDays: 2,
  followUpMessage: "Thank the donor and recap next steps from your meeting.",
};
