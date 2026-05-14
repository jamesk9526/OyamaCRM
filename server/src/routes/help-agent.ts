/**
 * Help Agent routes.
 * Provides a lightweight planner that maps natural-language help requests to executable route actions.
 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { buildHelpAgentPlan, type HelpAgentScope } from "../services/help-agent.js";

const router = Router();

router.use(requireAuth);

/**
 * POST /api/help-agent/plan
 * Body: { query: string; scope: donor|events|compassion|global; scopePath?: string }
 */
router.post("/plan", (req, res) => {
  const body = req.body as {
    query?: string;
    scope?: string;
    scopePath?: string;
  };

  const rawScope = String(body.scope ?? "donor");
  const scope: HelpAgentScope = rawScope === "events"
    ? "events"
    : rawScope === "compassion"
      ? "compassion"
      : rawScope === "global"
        ? "global"
        : "donor";

  const plan = buildHelpAgentPlan({
    query: String(body.query ?? "").trim(),
    scope,
    scopePath: String(body.scopePath ?? "/"),
  });

  res.json({ data: plan });
});

export default router;
