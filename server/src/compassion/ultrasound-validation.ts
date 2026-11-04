import { ULTRASOUND_APPROACHES, ULTRASOUND_EXAM_TYPES } from "./ultrasound-fields.js";
import { check } from "./http.js";

function calendarDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

/** Drafts may be incomplete. Supplied structured values must still be valid. */
export function validateUltrasoundContent(content: Record<string, unknown>) {
  check(!content._signoff, "Sign-off provenance is assigned only by the server.");
  for (const key of ["examDate", "estimatedDueDate", "followUpDueDate"]) {
    const value = content[key];
    check(value === undefined || value === "" || (typeof value === "string" && calendarDate(value)), `Enter a valid calendar date for ${key}.`);
  }
  for (const key of ["indication", "findings", "impression", "followUp", "amendmentReason"]) {
    check(content[key] === undefined || (typeof content[key] === "string" && content[key].length <= 20000), `${key} must be text up to 20,000 characters.`);
  }
  for (const key of ["performedBy", "referringProvider", "appointmentId"]) {
    check(content[key] === undefined || (typeof content[key] === "string" && content[key].length <= 191), `${key} must be text up to 191 characters.`);
  }
  for (const [key, max] of [["gestationalAgeWeeks", 60], ["gestationalAgeDays", 6]] as const) {
    const value = content[key];
    check(value === undefined || value === "" || (typeof value === "string" && /^\d{1,2}$/.test(value) && Number(value) <= max), `${key} must be a whole number between 0 and ${max}.`);
  }
  check(content.examType === undefined || content.examType === "" || (typeof content.examType === "string" && Object.prototype.hasOwnProperty.call(ULTRASOUND_EXAM_TYPES, content.examType)), "Choose a supported examination type.");
  check(content.approach === undefined || content.approach === "" || (typeof content.approach === "string" && Object.prototype.hasOwnProperty.call(ULTRASOUND_APPROACHES, content.approach)), "Choose a supported scan approach.");
}
