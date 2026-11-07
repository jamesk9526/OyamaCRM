/** Compatibility mount: independently organized care feature routers retain their original API. */
import { Router } from 'express';
import { recoveredPolicy } from '../compassion/core-policy.js';
import { bookingSettingsRoutes } from '../compassion/core/booking-settings.js';
import { caseworkRoutes } from '../compassion/core/casework.js';
import { clientsRoutes } from '../compassion/core/clients.js';
import { overviewRoutes } from '../compassion/core/overview.js';
import { reportingRoutes } from '../compassion/core/reporting.js';
import { schedulingRoutes } from '../compassion/core/scheduling.js';
import { staffRoutes } from '../compassion/core/staff.js';
import { requireCareMembership } from '../compassion/security.js';
import { requireAuth } from '../middleware/requireAuth.js';
const router = Router();
router.use(requireAuth, requireCareMembership);
router.get("/access", (_req, res) => res.json({ allowed: true, role: res.locals.careRole, capabilities: res.locals.careCapabilities, modules: res.locals.careModules }));
router.use(recoveredPolicy);
router.use(bookingSettingsRoutes, overviewRoutes, caseworkRoutes, reportingRoutes, staffRoutes, clientsRoutes, schedulingRoutes);
export default router;
