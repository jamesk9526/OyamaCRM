/**
 * Public Compassion CRM routes.
 * Provides unauthenticated appointment widget config and booking submission.
 */
import { Router } from "express";
import type { CompassionAppointmentType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import {
  APPOINTMENT_WIDGET_PLUGIN_KEY,
  APPOINTMENT_TYPE_OPTIONS,
  parseWidgetConfig,
  type AppointmentWidgetCustomQuestion,
  type AppointmentWidgetFieldConfig,
} from "../services/compassion-appointment-widget.js";

const router = Router();
const ALLOWED_APPOINTMENT_TYPES = new Set<CompassionAppointmentType>(APPOINTMENT_TYPE_OPTIONS);

/** Returns one field config by key, with a safe fallback. */
function fieldByKey(fields: AppointmentWidgetFieldConfig[], key: AppointmentWidgetFieldConfig["key"]): AppointmentWidgetFieldConfig {
  return fields.find((field) => field.key === key) ?? {
    key,
    enabled: false,
    required: false,
    label: key,
    placeholder: "",
    helperText: "",
  };
}

/** Normalizes custom response payloads for configured custom questions. */
function parseCustomResponses(payload: unknown, questions: AppointmentWidgetCustomQuestion[]): Record<string, string | boolean> {
  const questionIds = new Set(questions.map((question) => question.id));
  if (!payload || typeof payload !== "object") return {};

  const input = payload as Record<string, unknown>;
  const responses: Record<string, string | boolean> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!questionIds.has(key)) continue;
    if (typeof value === "boolean") {
      responses[key] = value;
      continue;
    }
    responses[key] = String(value ?? "").trim();
  }

  return responses;
}

/** Loads a widget plugin setting by public token. */
async function findWidgetByToken(token: string) {
  const settings = await prisma.pluginSetting.findMany({
    where: {
      pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
      enabled: true,
    },
  });

  for (const setting of settings) {
    const parsed = parseWidgetConfig(setting.config);
    if (parsed.token === token) {
      return { setting, config: parsed };
    }
  }

  return null;
}

/**
 * GET /api/compassion-public/widget/:token/config
 * Returns sanitized public appointment widget configuration.
 */
router.get("/widget/:token/config", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing widget token" } });
      return;
    }

    const hit = await findWidgetByToken(token);
    if (!hit || !hit.config.enabled) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Widget not found" } });
      return;
    }

    res.json({
      title: hit.config.title,
      description: hit.config.description,
      confirmationMessage: hit.config.confirmationMessage,
      locationOptions: hit.config.locationOptions,
      defaultAppointmentType: hit.config.defaultAppointmentType,
      appointmentTypeOptions: hit.config.appointmentTypeOptions,
      allowTypeSelection: hit.config.allowTypeSelection,
      requireEmail: hit.config.requireEmail,
      requirePhone: hit.config.requirePhone,
      submitButtonText: hit.config.submitButtonText,
      privacyNote: hit.config.privacyNote,
      logoDataUrl: hit.config.logoDataUrl,
      logoAltText: hit.config.logoAltText,
      primaryColor: hit.config.primaryColor,
      secondaryColor: hit.config.secondaryColor,
      surfaceColor: hit.config.surfaceColor,
      textColor: hit.config.textColor,
      enabledFields: hit.config.enabledFields,
      customQuestions: hit.config.customQuestions,
    });
  } catch (err) {
    console.error("[compassion-public] GET /widget/:token/config error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load widget" } });
  }
});

/**
 * POST /api/compassion-public/widget/:token/appointments
 * Creates a public booking request for the matching organization.
 */
router.post("/widget/:token/appointments", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Missing widget token" } });
      return;
    }

    const hit = await findWidgetByToken(token);
    if (!hit || !hit.config.enabled) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Widget not found" } });
      return;
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      location,
      startTime,
      notes,
      appointmentType,
      customResponses,
    } = req.body as Record<string, unknown>;

    const safeFirstName = String(firstName || "").trim();
    const safeLastName = String(lastName || "").trim();
    const safeEmail = String(email || "").trim();
    const safePhone = String(phone || "").trim();
    const safeLocation = String(location || "").trim();
    const safeNotes = String(notes || "").trim();
    const safeType = String(appointmentType || hit.config.defaultAppointmentType || "INTAKE").trim();
    const normalizedType = ALLOWED_APPOINTMENT_TYPES.has(safeType as CompassionAppointmentType)
      ? (safeType as CompassionAppointmentType)
      : "INTAKE";
    const configuredTypeOptions = hit.config.appointmentTypeOptions.length > 0
      ? hit.config.appointmentTypeOptions
      : [hit.config.defaultAppointmentType];
    const parsedStart = new Date(String(startTime || ""));
    const customQuestionResponses = parseCustomResponses(customResponses, hit.config.customQuestions);
    const emailField = fieldByKey(hit.config.enabledFields, "email");
    const phoneField = fieldByKey(hit.config.enabledFields, "phone");
    const locationField = fieldByKey(hit.config.enabledFields, "location");
    const notesField = fieldByKey(hit.config.enabledFields, "notes");
    const appointmentTypeField = fieldByKey(hit.config.enabledFields, "appointmentType");

    const effectiveAppointmentType =
      appointmentTypeField.enabled && hit.config.allowTypeSelection
        ? (configuredTypeOptions.includes(normalizedType) ? normalizedType : hit.config.defaultAppointmentType)
        : hit.config.defaultAppointmentType;
    const effectiveLocation = locationField.enabled
      ? (hit.config.locationOptions.includes(safeLocation) ? safeLocation : (hit.config.locationOptions[0] ?? ""))
      : "";
    const effectiveNotes = notesField.enabled ? safeNotes : "";

    if (!safeFirstName || !safeLastName || Number.isNaN(parsedStart.getTime())) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "firstName, lastName, and a valid startTime are required",
        },
      });
      return;
    }

    if (emailField.enabled && hit.config.requireEmail && !safeEmail) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email is required" } });
      return;
    }

    if (phoneField.enabled && hit.config.requirePhone && !safePhone) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Phone is required" } });
      return;
    }

    if (locationField.enabled && locationField.required && !effectiveLocation) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Location is required" } });
      return;
    }

    if (notesField.enabled && notesField.required && !effectiveNotes) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Notes are required" } });
      return;
    }

    for (const question of hit.config.customQuestions) {
      const answer = customQuestionResponses[question.id];
      if (!question.required) continue;

      if (question.type === "checkbox") {
        if (!Boolean(answer)) {
          res.status(400).json({
            error: { code: "VALIDATION_ERROR", message: `${question.label} is required` },
          });
          return;
        }
        continue;
      }

      const answerText = String(answer ?? "").trim();
      if (!answerText) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: `${question.label} is required` },
        });
        return;
      }
    }

    const organizationId = hit.setting.organizationId;

    let client = null;
    if (safeEmail) {
      client = await prisma.compassionClient.findFirst({
        where: { organizationId, email: safeEmail },
      });
    }
    if (!client && safePhone) {
      client = await prisma.compassionClient.findFirst({
        where: { organizationId, phone: safePhone },
      });
    }

    if (!client) {
      client = await prisma.compassionClient.create({
        data: {
          organizationId,
          firstName: safeFirstName,
          lastName: safeLastName,
          email: emailField.enabled ? (safeEmail || null) : null,
          phone: phoneField.enabled ? (safePhone || null) : null,
          clientStatus: "ACTIVE",
          privateNotes: "Auto-created from public appointment request.",
        },
      });
    }

    const customResponseSummary = hit.config.customQuestions
      .map((question) => {
        const answer = customQuestionResponses[question.id];
        if (question.type === "checkbox") {
          return `${question.label}: ${Boolean(answer) ? "Yes" : "No"}`;
        }
        const answerText = String(answer ?? "").trim();
        return answerText ? `${question.label}: ${answerText}` : "";
      })
      .filter(Boolean)
      .join("\n");

    const noteBlocks = [
      "Public request submitted via appointment widget.",
      effectiveNotes ? `Notes: ${effectiveNotes}` : "",
      customResponseSummary ? `Custom responses:\n${customResponseSummary}` : "",
    ].filter(Boolean);

    const appointment = await prisma.compassionAppointment.create({
      data: {
        organizationId,
        clientId: client.id,
        appointmentType: effectiveAppointmentType,
        status: "SCHEDULED",
        startTime: parsedStart,
        location: effectiveLocation || null,
        notes: noteBlocks.join("\n\n").slice(0, 5000),
        timezone: "America/Chicago",
      },
    });

    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId: client.id,
        appointmentId: appointment.id,
        activityType: "APPOINTMENT_SCHEDULED",
        description: "Public appointment request submitted",
        metadata: {
          source: "public-widget",
          appointmentType: effectiveAppointmentType,
          customResponses: customQuestionResponses,
        },
      },
    });

    await logAudit({
      action: "COMPASSION_PUBLIC_APPOINTMENT_REQUEST_CREATED",
      entity: "CompassionAppointment",
      entityId: appointment.id,
      organizationId,
      metadata: { source: "public-widget", token },
    });

    res.status(201).json({
      appointmentId: appointment.id,
      confirmationMessage: hit.config.confirmationMessage,
    });
  } catch (err) {
    console.error("[compassion-public] POST /widget/:token/appointments error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to submit request" } });
  }
});

export default router;
