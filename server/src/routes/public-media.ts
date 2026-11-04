import { Router } from "express";
import path from "node:path";
import { managedPublicMedia } from "../lib/public-media.js";

const router = Router();
/** Organization artwork is intentionally public, like letter and email media.
 * Keep this outside session authentication: email clients cannot supply CRM credentials.
 */
router.get("/branding/:organizationId/:fileName", (req, res) => {
  const media = managedPublicMedia(`/uploads/branding/${req.params.organizationId}/${req.params.fileName}`);
  if (!media) { res.status(404).end(); return; }
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.sendFile(media.fileName, { root: path.resolve("public/uploads/branding", media.organizationId), dotfiles: "deny" }, error => {
    if (error && !res.headersSent) res.status(404).json({ error: { code: "NOT_FOUND", message: "Image unavailable. Replace the saved upload." } });
  });
});
export default router;
