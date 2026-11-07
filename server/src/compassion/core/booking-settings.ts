import { Prisma } from "@prisma/client";
import { Router } from "express";
import {
APPOINTMENT_WIDGET_PLUGIN_KEY,
createWidgetToken,
parseWidgetConfig,
type AppointmentWidgetConfig,
} from "../../services/compassion-appointment-widget.js";
import { careTransaction } from "../core-policy.js";
import { prisma } from "../database.js";
import { logAudit,requireCare,resolveOrganizationId } from "../security.js";
const router = Router();


// ─── Widget Builder Settings ────────────────────────────────────────────────

/**
 * GET /api/compassion/appointment-widget
 * Returns current authenticated-org widget builder configuration.
 */
router.get("/appointment-widget", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const plugin = await prisma.compassionConfiguration.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        },
      },
    });

    const config = parseWidgetConfig(plugin?.config ?? null);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3650";
    const publicUrl = `${appUrl.replace(/\/$/, "")}/compassion/public/appointments/${config.token}`;
    const scriptUrl = `${appUrl.replace(/\/$/, "")}/embed/compassion-schedule.js`;

    res.json({
      enabled: plugin?.enabled ?? config.enabled,
      config,
      publicUrl,
      iframeSnippet: `<iframe src="${publicUrl}" width="100%" height="760" style="border:0;border-radius:12px;" title="Appointment Request"></iframe>`,
      scriptSnippet: `<div id="oyama-compassion-schedule"></div>\n<script src="${scriptUrl}" data-token="${config.token}" data-target="oyama-compassion-schedule" async></script>`,
    });
  } catch {
    console.error("[compassion] GET /appointment-widget error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load widget settings" } });
  }
});


/**
 * PUT /api/compassion/appointment-widget
 * Updates the authenticated-org appointment widget builder config. Admin only.
 */
router.put("/appointment-widget", requireCare("manage"), careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const existing = await prisma.compassionConfiguration.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        },
      },
    });

    const base = parseWidgetConfig(existing?.config ?? null);
    const incoming = parseWidgetConfig(req.body?.config ?? req.body ?? null);

    const merged: AppointmentWidgetConfig = {
      ...base,
      ...incoming,
      token: typeof req.body?.regenerateToken === "boolean" && req.body.regenerateToken
        ? createWidgetToken()
        : incoming.token || base.token,
    };

    const enabled = typeof req.body?.enabled === "boolean" ? req.body.enabled : existing?.enabled ?? merged.enabled;
    const mergedConfigJson = merged as unknown as Prisma.InputJsonValue;

    const saved = await prisma.compassionConfiguration.upsert({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        },
      },
      create: {
        organizationId,
        pluginKey: APPOINTMENT_WIDGET_PLUGIN_KEY,
        enabled,
        config: mergedConfigJson,
      },
      update: {
        enabled,
        config: mergedConfigJson,
      },
    });

    await logAudit({
      action: "COMPASSION_APPOINTMENT_WIDGET_UPDATED",
      entity: "PluginSetting",
      entityId: saved.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { enabled },
    });

    res.json({
      enabled: saved.enabled,
      config: parseWidgetConfig(saved.config),
    });
  } catch {
    console.error("[compassion] PUT /appointment-widget error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update widget settings" } });
  }
}));
export const bookingSettingsRoutes = router;
