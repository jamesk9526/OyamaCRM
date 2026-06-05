type ConstituentIdentityInput = {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  type?: string | null;
  entityKind?: string | null;
};

const ORGANIZATION_TYPES = new Set(["ORGANIZATION", "FOUNDATION", "SPONSOR"]);

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function isOrganizationConstituent(c: ConstituentIdentityInput): boolean {
  const type = clean(c.type).toUpperCase();
  const entityKind = clean(c.entityKind).toUpperCase();
  return ORGANIZATION_TYPES.has(type) || entityKind === "ORGANIZATION";
}

export function getConstituentDisplayName(c: ConstituentIdentityInput): string {
  const orgName = clean(c.organizationName);
  const displayName = clean(c.displayName);
  const first = clean(c.firstName);
  const last = clean(c.lastName);
  const full = [first, last].filter(Boolean).join(" ").trim();

  if (isOrganizationConstituent(c)) {
    return orgName || displayName || full || "Unnamed Organization";
  }

  return displayName || full || "Unnamed Constituent";
}

export function getConstituentSortName(c: ConstituentIdentityInput): string {
  if (isOrganizationConstituent(c)) {
    return getConstituentDisplayName(c).toLowerCase();
  }
  const first = clean(c.firstName);
  const last = clean(c.lastName);
  return `${last} ${first}`.trim().toLowerCase();
}

export function getConstituentContactFullName(c: ConstituentIdentityInput): string {
  const first = clean(c.contactFirstName);
  const last = clean(c.contactLastName);
  return [first, last].filter(Boolean).join(" ").trim();
}

export function getConstituentSalutation(c: ConstituentIdentityInput): string {
  if (isOrganizationConstituent(c)) {
    return `Dear ${getConstituentDisplayName(c)},`;
  }
  const first = clean(c.firstName);
  return first ? `Dear ${first},` : "Dear Friend,";
}
