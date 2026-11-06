export const questionTypes = {
  short: "Short text",
  long: "Long text",
  single: "Single choice",
  multiple: "Multiple choice",
  boolean: "Yes / no",
  number: "Number",
  rating: "Rating (1–5)",
  nps: "Net Promoter Score (0–10)",
} as const;

export type QuestionType = keyof typeof questionTypes;
export type Answer = string | string[] | number | boolean;
export type Answers = Record<string, Answer>;
export type Rule = { questionId: string; operator: "is" | "contains" | "atMost" | "atLeast"; value: string | number | boolean };
export type Question = { id: string; title: string; type: QuestionType; required: boolean; options: string[]; rule?: Rule };
export type Appearance = { logoUrl: string; logoAlt: string; accentColor: string; backgroundColor: string; font: "sans" | "serif"; buttonLabel: string };
export const defaultAppearance: Appearance = { logoUrl: "", logoAlt: "Organization logo", accentColor: "#1763b8", backgroundColor: "#f0f6fc", font: "sans", buttonLabel: "Submit response" };
export function parseAppearance(value: unknown): Appearance {
  const raw = value === undefined ? {} : record(value);
  const color = (key: string) => { const v = raw[key] ?? defaultAppearance[key as keyof Appearance]; if (typeof v !== "string" || !/^#[a-f\d]{6}$/i.test(v)) invalid("Choose a six-digit hex color."); return v; };
  const logoUrl = boundedText(raw.logoUrl ?? "", "Logo", 2048);
  if (logoUrl && !(/^\/(?!\/)[^\s<>"\\]*$/.test(logoUrl) || (() => { try { const u = new URL(logoUrl); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; } })())) invalid("Choose a PNG, JPEG or WebP logo, or a secure image URL.");
  if (raw.font !== undefined && raw.font !== "sans" && raw.font !== "serif") invalid("Choose a supported survey font.");
  return { logoUrl, logoAlt: boundedText(raw.logoAlt ?? defaultAppearance.logoAlt, "Logo description", 160, true), accentColor: color("accentColor"), backgroundColor: color("backgroundColor"), font: raw.font === "serif" ? "serif" : "sans", buttonLabel: boundedText(raw.buttonLabel ?? defaultAppearance.buttonLabel, "Submit button", 80, true) };
}
export function accentText(color: string) {
  const rgb = [1, 3, 5].map(i => { const c = parseInt(color.slice(i, i + 2), 16) / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? "#000000" : "#ffffff";
}
export type Definition = {
  appearance?: Appearance;
  title: string;
  introduction: string;
  thanks: string;
  sections: { id: string; title: string; questions: Question[] }[];
};

export const owns = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

export class SurveyError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export function invalid(message: string): never {
  throw new SurveyError(422, "VALIDATION_ERROR", message);
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Expected an object.");
  return value as Record<string, unknown>;
}

export function boundedText(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    invalid(`${label} must ${required ? "contain 1 to" : "contain at most"} ${max} characters.`);
  }
  return value.trim();
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{1,64}$/.test(value) || owns(Object.prototype, value) || value === "prototype") {
    invalid("A section or question identifier is invalid.");
  }
  return value;
}

function list(value: unknown, limit: number, label: string): unknown[] {
  if (!Array.isArray(value) || value.length > limit) invalid(`${label} supports up to ${limit} entries.`);
  return value;
}

function validAnswer(q: Question, value: unknown): value is Answer {
  switch (q.type) {
    case "short": case "long":
      return typeof value === "string" && !!value.trim() && value.length <= (q.type === "short" ? 250 : 2500);
    case "single":
      return typeof value === "string" && q.options.includes(value);
    case "multiple":
      return Array.isArray(value) && value.length > 0 && value.length <= q.options.length &&
        new Set(value).size === value.length && value.every(option => typeof option === "string" && q.options.includes(option));
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e12;
    case "rating": case "nps":
      return typeof value === "number" && Number.isInteger(value) &&
        (q.type === "rating" ? value >= 1 && value <= 5 : value >= 0 && value <= 10);
  }
}

export function allowedOperators(type: QuestionType): Rule["operator"][] {
  if (type === "multiple") return ["contains"];
  if (type === "single" || type === "boolean") return ["is"];
  if (type === "number" || type === "rating" || type === "nps") return ["is", "atMost", "atLeast"];
  return [];
}

export function parseDefinition(value: unknown, publishing = false): Definition {
  const raw = record(value);
  const seen = new Set<string>();
  const prior = new Map<string, Question>();
  const unique = (id: string) => {
    if (seen.has(id)) invalid("Section and question identifiers must be unique.");
    seen.add(id);
    return id;
  };
  const title = boundedText(raw.title, "Survey title", 160, true);
  const introduction = boundedText(raw.introduction, "Introduction", 2000);
  const thanks = boundedText(raw.thanks, "Thank-you message", 1000, publishing);
  const sections = list(raw.sections, 12, "A survey").map(section => {
    const row = record(section);
    return {
      id: unique(identifier(row.id)),
      title: boundedText(row.title, "Section title", 160, publishing),
      questions: list(row.questions, 40, "A section").map(entry => {
        const input = record(entry);
        if (typeof input.type !== "string" || !owns(questionTypes, input.type)) invalid("Choose a supported question type.");
        if (typeof input.required !== "boolean") invalid("Required must be true or false.");
        const type = input.type as QuestionType;
        const options = type === "single" || type === "multiple"
          ? list(input.options, 20, "A choice question").map(item => boundedText(item, "Choice", 120, publishing))
          : [];
        const question: Question = {
          id: unique(identifier(input.id)), title: boundedText(input.title, "Question title", 300, publishing),
          type, required: input.required, options,
        };
        if (publishing && (type === "single" || type === "multiple") &&
          (options.length < 2 || new Set(options.map(item => item.toLowerCase())).size !== options.length)) {
          invalid("Each choice question needs at least two distinct choices.");
        }
        if (input.rule !== undefined) {
          const rule = record(input.rule);
          const questionId = identifier(rule.questionId);
          const operator = rule.operator as Rule["operator"];
          const source = prior.get(questionId);
          if (!["is", "contains", "atMost", "atLeast"].includes(operator) ||
            !["string", "number", "boolean"].includes(typeof rule.value)) invalid("The condition is invalid.");
          if (publishing && (!source || !allowedOperators(source.type).includes(operator) ||
            !validAnswer(source, operator === "contains" ? [rule.value] : rule.value))) {
            invalid(`“${question.title}” needs a valid condition based on an earlier question.`);
          }
          question.rule = { questionId, operator, value: rule.value as Rule["value"] };
        }
        prior.set(question.id, question);
        return question;
      }),
    };
  });
  if (prior.size > 60) invalid("A survey supports up to 60 questions.");
  if (publishing && (!sections.length || sections.some(section => !section.questions.length))) {
    invalid("Add at least one question to each section.");
  }
  return { title, introduction, thanks, sections, ...(raw.appearance === undefined ? {} : { appearance: parseAppearance(raw.appearance) }) };
}

export function shown(rule: Rule | undefined, answers: Answers): boolean {
  if (!rule) return true;
  const answer = answers[rule.questionId];
  if (rule.operator === "is") return answer === rule.value;
  if (rule.operator === "contains") return Array.isArray(answer) && typeof rule.value === "string" && answer.includes(rule.value);
  if (typeof answer !== "number" || typeof rule.value !== "number") return false;
  return rule.operator === "atMost" ? answer <= rule.value : answer >= rule.value;
}

export function evaluateAnswers(definition: Definition, supplied: Answers) {
  const answers: Answers = {};
  const errors: Record<string, string> = {};
  const visible = new Set<string>();
  for (const question of definition.sections.flatMap(section => section.questions)) {
    if (!shown(question.rule, answers)) continue;
    visible.add(question.id);
    const value = owns(supplied, question.id) ? supplied[question.id] : undefined;
    if (value === undefined || value === "" || (typeof value === "string" && !value.trim()) ||
      (Array.isArray(value) && value.length === 0)) {
      if (question.required) errors[question.id] = "Please answer this question.";
    } else if (validAnswer(question, value)) {
      answers[question.id] = typeof value === "string" && (question.type === "short" || question.type === "long") ? value.trim() : value;
    } else {
      errors[question.id] = "Enter an answer that matches this question.";
    }
  }
  return { answers, errors, visible };
}

export function blankDefinition(): Definition {
  return { title: "Untitled survey", introduction: "", thanks: "Thank you for sharing your feedback.", sections: [
    { id: "welcome", title: "Your feedback", questions: [] },
  ] };
}

export function starterTemplates(audience: "DONOR" | "CLIENT"): { id: string; definition: Definition }[] {
  const examples = audience === "DONOR" ? [
    ["donor-experience", "Donor experience", "How connected do you feel to our mission?", "What would help you feel more connected?"],
    ["giving-interests", "Giving interests", "How well do you know the programs your gifts support?", "Which programs would you like to hear about?"],
  ] : [
    ["client-feedback", "Client care feedback", "How supported did you feel during your visit?", "What could we improve about your experience?"],
    ["program-outcomes", "Program outcomes", "How helpful was the program to you?", "What would make the program more helpful?"],
  ];
  return examples.map(([id, title, first, second]) => ({
    id, definition: { ...blankDefinition(), title, introduction: "We would appreciate a few minutes of your time to share feedback.", sections: [
      { id: "feedback", title: "Your feedback", questions: [
        { id: "rating", title: first, type: "rating", options: [], required: true },
        { id: "follow-up", title: second, type: "long", options: [], required: false, rule: { questionId: "rating", operator: "atMost", value: 2 } },
        { id: "comments", title: "Anything else you would like us to know?", type: "long", options: [], required: false },
      ] },
    ] },
  }));
}
