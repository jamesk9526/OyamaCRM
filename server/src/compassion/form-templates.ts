/** Fixed paper-template inventory. Labels/options are transcribed from the six supplied pages. */
export type Answers = Record<string, string | string[]>;
export interface PaperField { key: string; label: string; type?: "text" | "date" | "number" | "long" | "choices"; options?: string[]; multiple?: boolean; max?: number }
export interface PaperSection { title: string; fields: PaperField[]; text?: string[] }
export interface PaperTemplate { title: string; capability: "casework" | "clinical"; version: number; source: string; sourceSha256?: string; pages: PaperSection[][] }
const f = (key: string, label: string, type: PaperField["type"] = "text", max?: number): PaperField => ({ key, label, type, max });
const c = (key: string, label: string, options: string[], multiple = false): PaperField => ({ key, label, type: "choices", options, multiple });
const yn = (key: string, label: string, extra: string[] = []) => c(key, label, ["Yes", "No", ...extra]);
const section = (title: string, fields: PaperField[], text?: string[]): PaperSection => ({ title, fields, text });
export const FACILITY_TEXT = [
  "Our facility is a nonprofit, faith-based, charitable organization. All our services are free of charge, and most of the services are provided by volunteers. All our medical services, presently ultrasounds, are provided by licensed medical professionals.",
  "The urine pregnancy test is 97% to 99% accurate; however, a medical provider must confirm your test results. You should follow up with a licensed medical provider whether the test is positive or negative.",
  "Our advocates/mentors are lay people, not necessarily licensed or degreed personnel. The lay counseling/mentoring obtained here is not intended as a substitute for professional counseling.",
  "All information is kept confidential, except if required to be released by law, as is outlined in The Pregnancy Care Center’s Notice of Privacy Practices.",
  "For our client’s privacy, our center and its agents do not consent to any recording, taping, photographing, or videotaping on the premises without expressed specific permission.",
  "Our center does not benefit financially from your decision regarding your pregnancy. We do not perform or refer for abortion, but we do provide information and services so that you are equipped to make an informed choice about your pregnancy.",
  "Our center takes a holistic approach, which means we help you address your physical, emotional, and spiritual health; this is accomplished through pregnancy testing, ultrasounds, a wide variety of Bright Course educational videos, mentoring, and referrals to outside agencies.",
  "The Bright Course educational videos offered are voluntary, and you may refuse to watch any or all videos at any time.",
  "Our center offers these services to our clients throughout their pregnancy and up to 12 months after the birth of their baby.",
];
export const REQUEST_TEXT = "I have read, understood and agree to the above and hereby request The Pregnancy Care Center to render services for my care.";
export const CASE_INTRO = "Our goal is to get to know you and understand how we can best support you. Please share only what you feel comfortable sharing today.";
const assessment = ["Abortion-minded", "Abortion-vulnerable", "Likely to carry", "N/A"];
const intentions = ["Considering abortion", "Intends to carry", "Undecided", "N/A"];
export const PAPER_TEMPLATES: Record<string, PaperTemplate> = {
  CASE_INTAKE: { title: "Case Intake Form", capability: "casework", version: 1, source: "case intake form.pdf", sourceSha256: "32a508d633e7c0ac64af2fa36d2f6c08e9a61a54afbf951f771a447a03f57863", pages: [
    [section("Basic Information", [
      f("firstName", "First Name:"), f("lastName", "Last Name:"), f("middleInitial", "MI:"), f("dateOfBirth", "Date of Birth:", "date"), f("age", "Age:", "number", 130),
      f("mailingAddress", "Mailing Address:"), f("city", "City:"), f("state", "State:"), f("zip", "Zip:"), f("phone", "Phone:"),
      c("phonePermission", "", ["OK to call", "OK to text", "OK to leave voicemail", "No contact by phone"], true), f("email", "Email:"), c("emailPermission", "", ["OK to email", "No email contact"], true),
      c("maritalStatus", "Marital Status.", ["Single", "Married", "Divorced", "Engaged", "Separated", "Living together", "Widowed"]),
      c("incomeLevel", "Income Level", ["Dependent", "Unemployed", "Welfare/SSI", "Employed"]),
      c("ethnicity", "Ethnicity", ["Caucasian", "Hispanic", "African American", "Native American", "Jewish", "Asian", "other"], true), f("ethnicityOther", "other"),
      c("primaryLanguage", "Primary Language", ["English", "Spanish", "Other"]), f("languageOther", "Other"),
    ]), section("Alternate / Emergency Contact:", [f("emergencyName", "Name:"), f("emergencyRelationship", "Relationship:"), f("emergencyPhone", "Phone:")]),
    section("Partner Information", [f("partnerName", "What is the potential father’s name?"), f("partnerAge", "Age?", "number", 130), yn("partnerInvolved", "If the test is positive, will he be involved?", ["Unsure"]), yn("partnerKnows", "Does he know that you might be pregnant?", ["Unsure"]), c("partnerRelationship", "What is your relationship with him?", ["Boyfriend", "Fiance", "Friend", "Husband"])])],
    [section("Family & Household", [c("household", "Who do you live with right now? (check all that apply)", ["Alone", "Partner", "Parents", "Friends", "Children", "Other"], true), f("householdOther", "Other:"), yn("livingSafe", "Do you feel safe in your current living situation?", ["Sometimes"]), yn("stableHousing", "Do you have stable housing?", ["Temporary", "Shelter"])]),
    section("Support System", [c("supportPeople", "Who do you feel you can turn to for emotional or practical support? (check all that apply)", ["Partner", "Parents", "Family", "Friends", "Church/Faith community", "Caseworker", "No one right now", "Other"], true), f("supportOther", "Other:"), f("outsideHelp", "What outside help are you currently receiving? (ex: Medicaid, WIC, food stamps, housing assistance, counseling, etc.)", "long")]),
    section("Pregnancy / Parenting", [yn("previousVisit", "Have you ever visited our center before?"), f("previousVisitWhen", "If so when"), f("previousVisitName", "and under what name"), f("referralSource", "How did you hear about us?"), yn("hasChildren", "Do you have children already?"), f("children", "If yes, please share their names and date of birth:", "long")]),
    section("Spiritual & Emotional Support", [c("faithSharing", "Would you like to share about your spiritual background or current faith?", ["Yes, I’d like to share: (Religion/Spiritual Journey)", "Not at this time"]), f("faithJourney", "", "long"), f("church", "Do you attend a church? If so please list")]),
    section("Education & Work", [c("education", "Highest level of education completed:", ["Middle School", "High School/GED", "Some College", "College Graduate", "Trade/Other"]), f("employmentSchool", "Place of employment or school:")]),
    section("", [f("paperSignature", "Signature"), f("paperSignatureDate", "Date", "date")])],
    [section("More about our Facility and Request for Services", [], FACILITY_TEXT), section("", [f("requestPrintedName", "Printed Name:"), f("requestSignature", "Signature:"), f("requestDate", "Date:", "date")], [REQUEST_TEXT])],
  ] },
  HEALTH_PREGNANCY_INTAKE: { title: "Client Health and Pregnancy History", capability: "clinical", version: 1, source: "client health and pregna.pdf", sourceSha256: "fd368da046c224bd09cb737cff8d2ed3856af00f15e0c551a15421f6ee7229b0", pages: [
    [section("", [f("name", "Name:"), f("dateOfBirth", "Date of Birth:", "date"), f("visitDate", "Date of Visit:", "date")]),
    section("Medical & Pregnancy History", [yn("prenatalCare", "Are you in prenatal care?"), f("lastPeriod", "First day of last period:", "date"), yn("lastPeriodNormal", "Was your last period normal?", ["Unsure"]), yn("cycleRegular", "Is your cycle regular?", ["Unsure"]), f("sexualActivityAge", "How old were you when you became sexually active?", "number", 130)]),
    section("Pregnancy history:", [f("gravida", "Number of prior pregnancies (Gravida): (including current)", "number"), f("para", "Number of prior births (Para):", "number"), f("prematureBirths", "Number of prior premature births:", "number"), f("miscarriages", "Number of prior miscarriages:", "number"), f("abortions", "Number of prior abortions:", "number")]),
    section("Symptoms you’re currently experiencing (check all that apply):", [c("symptoms", "", ["Appetite changes", "Dizziness", "Frequent urination", "Feeling unusually tired", "Headaches", "Mood changes", "Nausea", "Missed period", "Breast tenderness/swelling", "Vomiting", "Weight change", "Other"], true), f("symptomsOther", "Other:")]),
    section("Birth Control & Pregnancy Intentions", [c("birthControl", "Are you currently using birth control? (check all that apply)", ["Condom", "Implant", "Natural family planning", "Depo-Provera", "IUD", "Norplant", "Pill", "Diaphragm", "Patch (Ortho-Evra)", "Morning-after pill", "Sterilization", "Foam/gel", "Other"], true), f("birthControlOther", "Other:"), yn("hopedPregnancy", "If not using birth control, was pregnancy something you hoped for?", ["Unsure"]), c("pregnancyThoughts", "If you are pregnant, what are your current thoughts about next steps?", ["Parenting", "Adoption", "Not sure / still thinking"])])],
    [section("GYN/Medical history:", [yn("tubalLigation", "History of tubal ligation?"), yn("ectopicPregnancy", "History of ectopic Pregnancy?"), yn("iud", "IUD in place?"), yn("stdTested", "Ever tested for an STD?"), yn("std", "Do you have an STD?"), f("stdList", "(If yes, list:"), yn("latexAllergy", "Allergic to latex?"), yn("allergies", "Current allergies?"), f("allergiesList", "(If yes, list:"), yn("medications", "Current medications?"), f("medicationsList", "(If yes, list:"), yn("endingMedication", "Have you recently taken any medication with the intent of ending a suspected pregnancy?"), f("endingMedicationList", "(If yes, list:")]),
    section("Lifestyle & Health", [yn("substances", "Do you use drugs or alcohol?"), f("substancesList", "(If yes, list:"), yn("smoking", "Do you smoke cigarettes?"), yn("vaping", "Use vaping devices?"), yn("illness", "Experiencing medical problems or illness?"), f("illnessList", "(If yes, list:"), yn("pain", "Experiencing pain?"), f("painScale", "If yes, 0 (none) → 10 (severe):", "number", 10), yn("bleeding", "Experiencing vaginal bleeding or spotting?")]),
    section("Emotional & Social Well-Being", [yn("stress", "Are you experiencing stress?"), f("stressLevel", "Stress level 1-10:", "number", 10), f("stressCause", "What is causing your stress?"), c("abuse", "Have you ever experienced abuse? (check all that apply)", ["None", "Emotional/Verbal", "Physical", "Sexual", "Rape"], true), yn("pregnancyAbuse", "Is this pregnancy the result of rape or abuse?")]),
    section("Safety & Well-Being", [yn("relationshipSafe", "Do you feel safe in your current relationship(s)?", ["Not sure"]), yn("violenceConcerns", "Do you have concerns about violence, pressure, or control from a partner or family member?", ["Prefer not to say"]), yn("safetyResources", "Would you like information about resources for safety and support?"), yn("supportivePerson", "Do you have someone supportive you can talk to about your pregnancy?"), yn("pregnancyPressure", "Have you ever felt pressured by anyone about pregnancy decisions?")]),
    section("Current Needs & Goals", [c("needs", "", ["A safe place to live", "Food support", "Baby supplies (diapers, clothing, formula, etc.)", "Parenting support/education", "Relationship support", "Job search/employment help", "Career development goals", "Educational needs (GED, college, training)", "Social connection/friendship", "Physical health/wellness", "Family activities/leisure time", "Personal growth (confidence, self-esteem, identity)", "Other"], true), f("needsOther", "Other:")])],
    [section("Spiritual Support", [f("faith", "What faith (religion) do you identify with?"), f("faithMeaning", "Can you tell us what this means to you personally?"), c("godRelationship", "If you believe in God how would you describe your relationship with him?", ["Desire to be better", "Unknown", "None", "Okay"])]),
    section("For Office Use Only", [f("testStaff", "Staff Name (who performed the test):"), c("testResult", "Pregnancy Test Result:", ["Positive", "Negative", "Inconclusive"]), f("dueDate", "Due date:", "date"), c("testType", "Type of Test:", ["Initial Test", "Retest"])]),
    section("Abortion Vulnerability Assessment – Stage 1 (At Arrival)", [c("stage1Assessment", "Staff assessment:", assessment), c("stage1Intentions", "Client’s stated intentions:", intentions)]),
    section("Abortion Vulnerability Assessment – Stage 2 (After Support)", [c("stage2Assessment", "Staff assessment:", assessment), c("stage2Intentions", "Client’s stated intentions:", intentions)]),
    section("Health Alerts (to be completed by staff)", [c("healthAlerts", "", ["Active vaginal bleeding/spotting", "Cigarette smoking since LMP", "History of tubal ligation", "Allergic to latex", "Drug/alcohol use", "IUD in place", "History of ectopic pregnancy", "Vaping", "No alerts"], true)])],
  ] },
};
export const SUPPORT_TEMPLATES: Record<string, PaperTemplate> = Object.fromEntries([
  ["CHILD_BIRTH", "Children / births", [f("childName", "Child’s name"), f("birthDate", "Date of birth", "date"), f("notes", "Notes", "long")]],
  ["CASE_VISIT", "Case visit", [f("visitDate", "Date of visit", "date"), f("purpose", "Purpose of visit"), f("support", "Support provided", "long"), f("nextSteps", "Next steps", "long")]],
  ["CONCEPTS_SHARED", "Concepts shared", [f("sharedDate", "Date", "date"), f("concepts", "Concepts shared", "long"), f("response", "Client response", "long")]],
  ["CORRESPONDENCE", "Correspondence", [f("date", "Date", "date"), c("channel", "Channel", ["Phone", "Mail", "Email", "Text", "In person"]), f("summary", "Correspondence record", "long")]],
  ["INDIVIDUAL_EDUCATION", "Individual education / mentoring", [f("date", "Date", "date"), f("topic", "Topic / lesson"), f("staff", "Staff / mentor"), f("notes", "Participation and next steps", "long")]],
  ["REFERRAL", "Referral", [f("date", "Date", "date"), f("agency", "Agency / resource"), f("reason", "Reason for referral", "long"), f("followUp", "Follow-up plan", "long")]],
  ["VITALS", "Vitals", [f("date", "Date", "date"), f("bloodPressure", "Blood pressure"), f("pulse", "Pulse", "number"), f("temperature", "Temperature / units"), f("weight", "Weight / units"), f("notes", "Clinical notes", "long")]],
].map(([key, title, fields]) => [key, { title, capability: key === "VITALS" ? "clinical" : "casework", version: 1, source: "Compassion care template v1", pages: [[section(String(title), fields as PaperField[])]] }])) as Record<string, PaperTemplate>;
export const FORM_TEMPLATES = { ...PAPER_TEMPLATES, ...SUPPORT_TEMPLATES };
export function validateAnswers(kind: string, value: unknown): string[] {
  const template = FORM_TEMPLATES[kind];
  if (!template || !value || typeof value !== "object" || Array.isArray(value)) return ["Choose a supported form and valid answers."];
  const fields = new Map(template.pages.flat(2).flatMap(s => s.fields).map(field => [field.key, field]));
  const issues: string[] = [];
  for (const [key, answer] of Object.entries(value)) {
    const field = fields.get(key);
    if (!field) { issues.push(`Unsupported field: ${key}`); continue; }
    if (answer === "" || (Array.isArray(answer) && answer.length === 0)) continue;
    if (field.type === "choices") {
      const values = field.multiple ? answer : [answer];
      if (!Array.isArray(values) || values.some(x => typeof x !== "string" || !field.options?.includes(x)) || new Set(values).size !== values.length) issues.push(`Invalid answer: ${field.label || key}`);
    } else if (typeof answer !== "string" || answer.length > 10000) issues.push(`Invalid text: ${field.label || key}`);
    else if (field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(answer) || !Number.isFinite(Date.parse(answer)) || new Date(answer).toISOString().slice(0, 10) !== answer)) issues.push(`Invalid date: ${field.label}`);
    else if (field.type === "number" && (!/^\d+$/.test(answer) || Number(answer) > (field.max ?? 1000) || (key === "stressLevel" && Number(answer) < 1))) issues.push(`Invalid number: ${field.label}`);
  }
  return issues;
}
export function answerIssues(kind: string, answers: Answers): string[] {
  const issues: string[] = [];
  const exclusive: Record<string, string[]> = kind === "CASE_INTAKE" ? { phonePermission: ["No contact by phone"], emailPermission: ["No email contact"], household: ["Alone"], supportPeople: ["No one right now"] } : { healthAlerts: ["No alerts"], abuse: ["None"] };
  for (const [key, options] of Object.entries(exclusive)) { const value = answers[key]; if (Array.isArray(value) && value.length > 1 && options.some(x => value.includes(x))) issues.push(`Review conflicting selections in ${key}.`); }
  return issues;
}
export function contactPreferences(answers: Answers) {
  const phone = Array.isArray(answers.phonePermission) ? answers.phonePermission : [];
  const email = Array.isArray(answers.emailPermission) ? answers.emailPermission : [];
  return { phone: !phone.includes("No contact by phone") && phone.includes("OK to call"), sms: !phone.includes("No contact by phone") && phone.includes("OK to text"), voicemail: !phone.includes("No contact by phone") && phone.includes("OK to leave voicemail"), email: !email.includes("No email contact") && email.includes("OK to email") };
}
