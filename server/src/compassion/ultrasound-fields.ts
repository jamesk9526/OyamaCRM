/** Shared presentation values only; safe for both the care UI and API validator. */
export const ULTRASOUND_EXAM_TYPES = {
  LIMITED_OBSTETRIC: "Limited obstetric",
  FOLLOW_UP: "Follow-up examination",
  OTHER: "Other ultrasound",
} as const;

export const ULTRASOUND_APPROACHES = {
  TRANSABDOMINAL: "Transabdominal",
  TRANSVAGINAL: "Transvaginal",
  BOTH: "Transabdominal and transvaginal",
} as const;
