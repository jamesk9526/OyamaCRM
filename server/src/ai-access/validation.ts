import { CreateError } from "../oyama-create/domain.js";
import { fieldSchema, modelFields, resourceFor, type AiCapability, type JsonSchema } from "./catalog.js";

export const objectSchema = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: "object", properties, required, additionalProperties: false });
export const idSchema: JsonSchema = { type: "string", minLength: 1, maxLength: 191 };
const extra: Record<string, JsonSchema> = {
  reason: { type: "string", minLength: 1, maxLength: 500 }, note: { type: "string", minLength: 1, maxLength: 10000 },
  type: { type: "string", maxLength: 100 }, description: { type: "string", maxLength: 10000 },
  keepId: idSchema, mergeId: idSchema, acknowledged: { type: "boolean" },
  sendMode: { type: "string", enum: ["LIST"] }, recipientEmails: { type: "array", maxItems: 10000, items: { type: "string", maxLength: 320 } },
  name: { type: "string", maxLength: 200 }, source: { type: "string", maxLength: 100 }, from: { type: "string", maxLength: 10 }, through: { type: "string", maxLength: 10 },
  columns: { type: "array", maxItems: 50, items: { type: "string", maxLength: 100 } }, filters: { type: "array", maxItems: 20, items: { type: "object" } }, sort: { type: "object" },
  fieldId: idSchema, entityId: idSchema, entityType: { type: "string", enum: ["constituent", "donation", "campaign", "event"] }, value: { type: "string", maxLength: 10000 },
};
export function actionSchema(capability: AiCapability): JsonSchema {
  const res = capability.resource ? resourceFor(capability.resource) : undefined;
  const fields: Record<string, JsonSchema> = {};
  for (const name of capability.fields || []) {
    const field = res ? modelFields(res).find(item => item.name === name) : undefined;
    fields[name] = field && res ? { ...fieldSchema(res, name), ...(!field.isRequired ? { anyOf: [fieldSchema(res, name), { type: "null" }] } : {}) } : extra[name] || { type: "string", maxLength: 1000 };
  }
  if (capability.handler === "export") Object.assign(fields, { resource: { type: "string", maxLength: 100 }, query: { type: "string", maxLength: 200 } });
  return objectSchema({ fields: objectSchema(fields, capability.required), id: idSchema, eventId: idSchema, grantId: idSchema, pathId: idSchema, key: idSchema,
    expectedVersion: { type: "string", minLength: 64, maxLength: 64 }, requestKey: { type: "string", minLength: 8, maxLength: 100 }, preview: { type: "boolean" } }, ["fields", "requestKey"]);
}
export function validate(schema: JsonSchema, input: unknown, path = "arguments", depth = 0): void {
  if (depth > 12) throw new CreateError(400, "Tool arguments are nested too deeply.");
  const fail = () => { throw new CreateError(400, `Invalid ${path}. Check this tool's schema.`); };
  if (schema.anyOf) {
    for (const alternative of schema.anyOf) { try { validate(alternative, input, path, depth + 1); return; } catch (error) { if (!(error instanceof CreateError)) throw error; } }
    return fail();
  }
  if (schema.enum && !schema.enum.includes(input as string)) return fail();
  if (schema.type === "null") { if (input !== null) fail(); return; }
  if (schema.type === "object") {
    if (!input || typeof input !== "object" || Array.isArray(input)) return fail();
    const values = input as Record<string, unknown>;
    if (Object.keys(values).length > 200) return fail();
    for (const required of schema.required || []) if (values[required] === undefined) throw new CreateError(400, `Missing ${path}.${required}.`);
    for (const [key, value] of Object.entries(values)) {
      if (["__proto__", "prototype", "constructor"].includes(key)) return fail();
      if (schema.properties?.[key]) validate(schema.properties[key], value, `${path}.${key}`, depth + 1);
      else if (schema.additionalProperties === false) return fail();
      else validateJson(value, depth + 1);
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(input) || input.length > (schema.maxItems || 100)) return fail();
    for (let index = 0; index < input.length; index++) validate(schema.items || {}, input[index], `${path}[${index}]`, depth + 1);
  } else if (schema.type === "string") {
    if (typeof input !== "string" || input.length > (schema.maxLength || 100000) || input.trim().length < (schema.minLength || 0)) fail();
  } else if (schema.type === "boolean") { if (typeof input !== "boolean") fail(); }
  else if (["number", "integer"].includes(schema.type || "")) {
    if (typeof input !== "number" || !Number.isFinite(input) || schema.type === "integer" && !Number.isInteger(input) || input < (schema.minimum ?? -Infinity) || input > (schema.maximum ?? Infinity)) fail();
  } else validateJson(input, depth + 1);
}
function validateJson(input: unknown, depth: number) {
  if (depth > 12) throw new CreateError(400, "JSON content is nested too deeply.");
  if (Array.isArray(input)) { if (input.length > 500) throw new CreateError(400, "JSON arrays are too large."); for (const item of input) validateJson(item, depth + 1); }
  else if (input && typeof input === "object") validate({ type: "object" }, input, "document", depth + 1);
  else if (typeof input === "string" && input.length > 100000) throw new CreateError(400, "JSON content is too large.");
  else if (typeof input === "number" && !Number.isFinite(input)) throw new CreateError(400, "JSON numbers must be finite.");
}
