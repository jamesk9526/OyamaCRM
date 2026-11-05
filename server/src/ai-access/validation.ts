import { CreateError } from "../oyama-create/domain.js";
import { fieldSchema, modelFields, resourceFor, type AiCapability, type JsonSchema } from "./catalog.js";

export const objectSchema = (properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({ type: "object", properties, required, additionalProperties: false });
export const idSchema: JsonSchema = { type: "string", minLength: 1, maxLength: 191 };
const extra: Record<string, JsonSchema> = {
  reason: { type: "string", minLength: 1, maxLength: 500 }, note: { type: "string", minLength: 1, maxLength: 10000 },
  type: { type: "string", maxLength: 100 }, description: { type: "string", maxLength: 10000 },
  keepId: idSchema, mergeId: idSchema, acknowledged: { type: "boolean" },
  sendMode: { type: "string", enum: ["LIST", "INDIVIDUAL"], description: "Optional. OyamaCRM derives the send mode from the recipient count." }, recipientEmails: { type: "array", maxItems: 10000, items: { type: "string", maxLength: 320 } },
  name: { type: "string", maxLength: 200 }, source: { type: "string", maxLength: 100 }, from: { type: "string", maxLength: 10 }, through: { type: "string", maxLength: 10 },
  columns: { type: "array", maxItems: 50, items: { type: "string", maxLength: 100 } }, filters: { type: "array", maxItems: 20, items: { type: "object" } }, sort: { type: "object" },
  fieldId: idSchema, entityId: idSchema, entityType: { type: "string", enum: ["constituent", "donation", "campaign", "event"] }, value: { type: "string", maxLength: 10000 },
  guestId: idSchema, constituentId: idSchema, configJson: { type: "object" },
  recipientConstituentIds: { type: "array", maxItems: 10000, items: idSchema },
  tags: { type: "array", maxItems: 30, items: { type: "string", minLength: 1, maxLength: 100 } },
  groupMemberships: { type: "array", maxItems: 50, items: objectSchema({ groupId: idSchema, relationshipLabel: { type: "string", maxLength: 80 }, isPrimary: { type: "boolean" } }, ["groupId"]) },
  items: { type: "array", maxItems: 100, items: objectSchema({ ticketTypeId: idSchema, quantity: { type: "integer", minimum: 1, maximum: 1000 } }, ["ticketTypeId", "quantity"]) },
  groupBy: { type: "string", maxLength: 64 }, metric: { type: "string", maxLength: 64 }, contains: { type: "string", maxLength: 100 },
  year: { type: "integer", minimum: 2000, maximum: 2100 }, donationId: idSchema,
};
export function actionSchema(capability: AiCapability): JsonSchema {
  const res = capability.resource ? resourceFor(capability.resource) : undefined;
  const fields: Record<string, JsonSchema> = {};
  for (const name of capability.fields || []) {
    const field = res ? modelFields(res).find(item => item.name === name) : undefined;
    if (field && res) {
      const schema = fieldSchema(res, name);
      fields[name] = field.isRequired ? schema : { anyOf: [schema, { type: "null" }] };
    } else fields[name] = extra[name] || { type: "string", maxLength: 1000 };
  }
  if (capability.key === "paths.create") fields.targetType = { type: "string", enum: ["CONSTITUENT", "DONOR", "EVENT_ATTENDEE", "SPONSOR", "GRANT", "STAFF", "CUSTOM"] };
  if (capability.key === "path_enrollments.pause") fields.status = { type: "string", enum: ["PAUSED", "CANCELLED"] };
  if (capability.handler === "custom") fields.value = { anyOf: [{ type: "string", maxLength: 10000 }, { type: "number", minimum: -1000000000, maximum: 1000000000 }, { type: "boolean" }, { type: "array", maxItems: 100, items: { type: "string", maxLength: 191 } }, { type: "null" }] };
  if (capability.key === "custom_fields.create" || capability.key === "custom_fields.update") fields.options = { type: "array", maxItems: 100, items: { type: "string", minLength: 1, maxLength: 191 } };
  if (capability.handler === "export") Object.assign(fields, { resource: { type: "string", maxLength: 100 }, query: { type: "string", maxLength: 200 } });
  if (capability.handler === "import") fields.records = { type: "array", maxItems: 100, items: objectSchema({ firstName: { type: "string", maxLength: 100 }, lastName: { type: "string", maxLength: 100 }, email: { type: "string", maxLength: 191 }, phone: { type: "string", maxLength: 50 }, addressLine1: { type: "string", maxLength: 191 }, city: { type: "string", maxLength: 100 }, state: { type: "string", maxLength: 100 }, zip: { type: "string", maxLength: 20 }, notes: { type: "string", maxLength: 10000 } }, ["firstName", "lastName"]) };
  if (capability.handler === "batch") fields.actions = { type: "array", maxItems: 100, items: objectSchema({ capability: { type: "string", maxLength: 100 }, arguments: { type: "object" } }, ["capability", "arguments"]) };
  return objectSchema({ fields: objectSchema(fields, capability.required), id: idSchema, eventId: idSchema, grantId: idSchema, pathId: idSchema, siteId: idSchema, key: idSchema,
    expectedVersion: { type: "string", minLength: 64, maxLength: 64 }, requestKey: { type: "string", minLength: 8, maxLength: 100 }, preview: { type: "boolean" } }, ["fields", "requestKey"]);
}
export function validateCustomValue(definition: { fieldType: unknown; options: unknown; required: unknown }, value: unknown) {
  if (value === null) {
    if (definition.required) throw new CreateError(400, "This custom field requires a value.");
    return;
  }
  let options: unknown;
  try { options = typeof definition.options === "string" ? JSON.parse(definition.options) : definition.options; } catch { options = []; }
  const choices = Array.isArray(options) && options.every(option => typeof option === "string") ? options : [];
  const types: Record<string, JsonSchema> = {
    number: { type: "number", minimum: -1000000000, maximum: 1000000000 },
    boolean: { type: "boolean" },
    multiselect: { type: "array", maxItems: 100, items: { type: "string", enum: choices } },
    select: { type: "string", enum: choices },
  };
  const schema = types[String(definition.fieldType)] || { type: "string", maxLength: 10000, minLength: definition.required ? 1 : 0 };
  validate(schema, value, "custom field value");
  if (definition.fieldType === "date") {
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new CreateError(400, "Use a valid YYYY-MM-DD custom field value.");
  }
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
