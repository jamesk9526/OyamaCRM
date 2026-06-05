import { Router } from "express";
import type { ConstituentType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import {
  ensureConstituentGroup,
  normalizeConstituentGroupType,
  type ConstituentGroupType,
} from "../lib/constituent-groups.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

router.use(requireAuth);

const ORG_KEYWORDS = [
  "church",
  "chapel",
  "ministry",
  "ministries",
  "fellowship",
  "baptist",
  "methodist",
  "catholic",
  "assembly",
  "congregation",
  "worship",
  "parish",
  "temple",
  "company",
  "co.",
  "llc",
  "inc",
  "corp",
  "foundation",
  "school",
  "academy",
  "clinic",
  "center",
  "business",
];

const ORGANIZATION_TYPES = new Set<ConstituentType>(["ORGANIZATION", "FOUNDATION", "SPONSOR"]);

const CATEGORY_KEYWORDS: Array<{ category: string; patterns: RegExp[] }> = [
  { category: "CHURCH", patterns: [/church|chapel|baptist|methodist|catholic|parish|temple|worship|congregation|assembly/i] },
  { category: "MINISTRY", patterns: [/ministry|ministries|fellowship|mission/i] },
  { category: "FOUNDATION", patterns: [/foundation|endowment|trust/i] },
  { category: "SCHOOL", patterns: [/school|academy|college|university/i] },
  { category: "BUSINESS", patterns: [/company|co\.|llc|inc|corp|business|clinic|center/i] },
];

type ConversionPreviewCandidate = {
  constituentId: string;
  reasons: string[];
  current: {
    firstName: string;
    lastName: string;
    type: string;
    tags: string[];
  };
  suggested: {
    entityKind: "ORGANIZATION";
    organizationName: string;
    displayName: string;
    type: "ORGANIZATION" | "FOUNDATION" | "SPONSOR";
    organizationCategory: string;
    groupType: ConstituentGroupType;
    firstName: "";
    lastName: string;
    tags: string[];
  };
};

type ApplyConversionInput = {
  constituentId: string;
  organizationName: string;
  displayName: string;
  type: "ORGANIZATION" | "FOUNDATION" | "SPONSOR";
  organizationCategory: string;
  groupType: ConstituentGroupType;
  keepOriginalNameInNotes: boolean;
  addTags: boolean;
  createConstituentGroup: boolean;
  constituentGroupName: string;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function inferCategory(haystack: string): string {
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) return entry.category;
  }
  return "OTHER";
}

function categoryToGroupType(category: string): ConstituentGroupType {
  if (category === "CHURCH" || category === "MINISTRY") return "CHURCH";
  if (category === "BUSINESS") return "BUSINESS";
  return "ORGANIZATION";
}

function normalizeSuggestedType(type: ConstituentType): "ORGANIZATION" | "FOUNDATION" | "SPONSOR" {
  if (type === "FOUNDATION") return "FOUNDATION";
  if (type === "SPONSOR") return "SPONSOR";
  return "ORGANIZATION";
}

function buildPreviewCandidate(row: {
  id: string;
  firstName: string;
  lastName: string;
  type: ConstituentType;
  displayName: string | null;
  organizationName: string | null;
  employer: string | null;
  entityKind: string;
  organizationCategory: string | null;
  tags: Array<{ tag: { name: string } }>;
}): ConversionPreviewCandidate | null {
  const firstName = clean(row.firstName);
  const lastName = clean(row.lastName);
  const displayName = clean(row.displayName);
  const organizationName = clean(row.organizationName);
  const employer = clean(row.employer);
  const tagNames = row.tags.map((item) => item.tag.name).filter(Boolean);
  const tagsLower = tagNames.map((tag) => tag.toLowerCase());
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const haystack = [firstName, lastName, displayName, organizationName, employer, tagNames.join(" ")].join(" ").toLowerCase();

  const reasons: string[] = [];

  if (ORG_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    reasons.push("Name or tags contain organization keywords.");
  }

  if (ORGANIZATION_TYPES.has(row.type) && !organizationName) {
    reasons.push("Type is organization/foundation/sponsor but organizationName is blank.");
  }

  if (/^(church of|first baptist|ministry of|the)\b/i.test(firstName)) {
    reasons.push("First name pattern suggests organization split across first/last name.");
  }

  if (/\b(missouri|texas|oklahoma|city|county|state)\b/i.test(lastName)) {
    reasons.push("Last name contains location wording.");
  }

  if (tagsLower.some((tag) => ["church", "business", "organization"].includes(tag))) {
    reasons.push("Tags indicate church/business/organization.");
  }

  if (employer && fullName && (employer.toLowerCase().includes(fullName.toLowerCase()) || fullName.toLowerCase().includes(employer.toLowerCase()))) {
    reasons.push("Employer resembles constituent name.");
  }

  if (reasons.length === 0) return null;

  const inferredName = organizationName || displayName || fullName;
  if (!inferredName) return null;

  const category = row.organizationCategory || inferCategory(haystack);
  const groupType = categoryToGroupType(category);
  const suggestedTags = Array.from(new Set([
    ...tagNames,
    "Organization",
    category === "CHURCH" ? "Church" : "",
    category === "BUSINESS" ? "Business" : "",
    category === "FOUNDATION" ? "Foundation" : "",
    category === "MINISTRY" ? "Ministry" : "",
  ].filter(Boolean)));

  return {
    constituentId: row.id,
    reasons,
    current: {
      firstName,
      lastName,
      type: row.type,
      tags: tagNames,
    },
    suggested: {
      entityKind: "ORGANIZATION",
      organizationName: inferredName,
      displayName: inferredName,
      type: normalizeSuggestedType(row.type),
      organizationCategory: category,
      groupType,
      firstName: "",
      lastName: inferredName,
      tags: suggestedTags,
    },
  };
}

router.get("/organization-conversion/preview", requirePermission("view:constituents"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit ?? "500"), 10) || 500, 1), 2000);
  const rows = await prisma.constituent.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      type: true,
      displayName: true,
      organizationName: true,
      employer: true,
      entityKind: true,
      organizationCategory: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  const candidates = rows
    .map((row) => buildPreviewCandidate(row))
    .filter((row): row is ConversionPreviewCandidate => Boolean(row));

  res.json({
    scanned: rows.length,
    candidateCount: candidates.length,
    candidates,
  });
});

router.post("/organization-conversion/apply", requirePermission("edit:constituents"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const conversions: unknown[] = Array.isArray(req.body?.conversions) ? req.body.conversions : [];
  if (conversions.length === 0) {
    res.status(400).json({ error: { code: "NO_CONVERSIONS", message: "No conversions were provided." } });
    return;
  }

  const validConversions: ApplyConversionInput[] = conversions
    .map((item: unknown) => {
      const source = (item ?? {}) as Record<string, unknown>;
      const suggestedType: ApplyConversionInput["type"] = ["FOUNDATION", "SPONSOR"].includes(String(source.type ?? "").toUpperCase())
        ? (String(source.type).toUpperCase() as "FOUNDATION" | "SPONSOR")
        : "ORGANIZATION";
      return {
        constituentId: String(source.constituentId ?? "").trim(),
        organizationName: String(source.organizationName ?? "").trim(),
        displayName: String(source.displayName ?? "").trim(),
        type: suggestedType,
        organizationCategory: String(source.organizationCategory ?? "OTHER").trim().toUpperCase(),
        groupType: normalizeConstituentGroupType(source.groupType ?? source.organizationCategory),
        keepOriginalNameInNotes: source.keepOriginalNameInNotes !== false,
        addTags: source.addTags !== false,
        createConstituentGroup: source.createConstituentGroup === true,
        constituentGroupName: String(source.constituentGroupName ?? source.organizationName ?? "").trim(),
      };
    })
    .filter((item) => Boolean(item.constituentId && item.organizationName));

  if (validConversions.length === 0) {
    res.status(400).json({ error: { code: "INVALID_CONVERSIONS", message: "No valid conversion entries were provided." } });
    return;
  }

  const ids = validConversions.map((item) => item.constituentId);
  const rows = await prisma.constituent.findMany({
    where: { organizationId, id: { in: ids } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      organizationName: true,
      contactFirstName: true,
      contactLastName: true,
      contactTitle: true,
      entityKind: true,
      organizationCategory: true,
      type: true,
      notes: true,
      tags: { select: { tag: { select: { id: true, name: true } } } },
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  const applied: Array<{
    constituentId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    constituentGroupId?: string | null;
  }> = [];
  const skipped: Array<{ constituentId: string; reason: string }> = [];

  for (const conversion of validConversions) {
    const row = byId.get(conversion.constituentId);
    if (!row) {
      skipped.push({ constituentId: conversion.constituentId, reason: "Constituent not found in active organization." });
      continue;
    }

    const originalName = [clean(row.firstName), clean(row.lastName)].filter(Boolean).join(" ").trim();
    const notePrefix = `Organization conversion (${new Date().toISOString()}): original split name = ${originalName || "(none)"}`;
    const nextNotes = conversion.keepOriginalNameInNotes
      ? [row.notes, notePrefix].filter(Boolean).join("\n")
      : row.notes;

    await prisma.constituent.update({
      where: { id: row.id },
      data: {
        firstName: "",
        lastName: conversion.organizationName,
        displayName: conversion.displayName || conversion.organizationName,
        organizationName: conversion.organizationName,
        entityKind: "ORGANIZATION",
        organizationCategory: conversion.organizationCategory,
        type: conversion.type,
        notes: nextNotes,
      },
    });

    if (conversion.addTags) {
      const desiredTagNames = Array.from(new Set([
        "Organization",
        conversion.organizationCategory === "CHURCH" ? "Church" : "",
        conversion.organizationCategory === "BUSINESS" ? "Business" : "",
        conversion.organizationCategory === "FOUNDATION" ? "Foundation" : "",
      ].filter(Boolean)));

      for (const tagName of desiredTagNames) {
        let tag = await prisma.tag.findFirst({ where: { name: tagName } });
        if (!tag) {
          tag = await prisma.tag.create({ data: { name: tagName, color: "#16a34a" } });
        }
        await prisma.constituentTag.upsert({
          where: { constituentId_tagId: { constituentId: row.id, tagId: tag.id } },
          update: {},
          create: { constituentId: row.id, tagId: tag.id },
        });
      }
    }

    const before = {
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      organizationName: row.organizationName,
      entityKind: row.entityKind,
      organizationCategory: row.organizationCategory,
      type: row.type,
      tags: row.tags.map((item) => item.tag.name),
    };

    const after = {
      firstName: "",
      lastName: conversion.organizationName,
      displayName: conversion.displayName || conversion.organizationName,
      organizationName: conversion.organizationName,
      entityKind: "ORGANIZATION",
      organizationCategory: conversion.organizationCategory,
      type: conversion.type,
    };

    let constituentGroupId: string | null = null;
    if (conversion.createConstituentGroup) {
      const group = await ensureConstituentGroup({
        organizationId,
        name: conversion.constituentGroupName || conversion.organizationName,
        groupType: conversion.groupType,
        primaryConstituentId: row.id,
        description: `Created by organization conversion for ${conversion.organizationName}.`,
      });
      if (group) {
        constituentGroupId = group.id;
        await prisma.constituentGroupMember.upsert({
          where: {
            groupId_constituentId: {
              groupId: group.id,
              constituentId: row.id,
            },
          },
          update: {
            relationshipLabel: "Primary organization record",
            isPrimary: true,
          },
          create: {
            groupId: group.id,
            constituentId: row.id,
            relationshipLabel: "Primary organization record",
            isPrimary: true,
          },
        });
      }
    }

    applied.push({ constituentId: row.id, before, after, constituentGroupId });

    await logAudit({
      action: "CONSTITUENT_ORGANIZATION_CONVERSION_APPLIED",
      entity: "Constituent",
      entityId: row.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        keepOriginalNameInNotes: conversion.keepOriginalNameInNotes,
        addTags: conversion.addTags,
        createConstituentGroup: conversion.createConstituentGroup,
        constituentGroupName: conversion.constituentGroupName || null,
        groupType: conversion.groupType,
        constituentGroupId,
        before,
        after,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  res.json({
    requested: validConversions.length,
    appliedCount: applied.length,
    skippedCount: skipped.length,
    applied,
    skipped,
  });
});

export default router;
