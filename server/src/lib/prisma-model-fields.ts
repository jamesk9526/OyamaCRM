import { Prisma } from "@prisma/client";

const modelFieldCache = new Map<string, Set<string>>();

function getModelFields(modelName: string): Set<string> {
  const cached = modelFieldCache.get(modelName);
  if (cached) return cached;

  const model = Prisma.dmmf.datamodel.models.find((entry) => entry.name === modelName);
  const fields = new Set(model?.fields.map((field) => field.name) ?? []);
  modelFieldCache.set(modelName, fields);
  return fields;
}

export function prismaModelHasField(modelName: string, fieldName: string): boolean {
  return getModelFields(modelName).has(fieldName);
}

export function prismaModelExists(modelName: string): boolean {
  return getModelFields(modelName).size > 0;
}

export function omitUnavailableModelSelectFields<T extends Record<string, unknown>>(
  modelName: string,
  select: T,
): Partial<T> {
  return omitUnavailableModelFields(modelName, select);
}

export function omitUnavailableModelDataFields<T extends Record<string, unknown>>(
  modelName: string,
  data: T,
): Partial<T> {
  return omitUnavailableModelFields(modelName, data);
}

function omitUnavailableModelFields<T extends Record<string, unknown>>(
  modelName: string,
  values: T,
): Partial<T> {
  const fields = getModelFields(modelName);
  return Object.fromEntries(
    Object.entries(values).filter(([fieldName]) => fields.has(fieldName)),
  ) as Partial<T>;
}
