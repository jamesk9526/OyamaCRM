/**
 * Bearer JWT authentication middleware for OyamaCRM.
 * Extracts the access token from the `Authorization: Bearer <token>` header,
 * verifies it, and attaches the decoded payload to `req.user`.
 * Routes that require authentication should apply this middleware first.
 * @module middleware/requireAuth
 */
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth.js";

/**
 * Express middleware that enforces JWT authentication on a route.
 * Reads the `Authorization: Bearer <token>` header, verifies the access token,
 * and stores the decoded payload on `req.user` for downstream handlers.
 *
 * Responds with:
 * - `401 UNAUTHORIZED` — if the header is missing or malformed
 * - `401 TOKEN_EXPIRED` — if the token signature is invalid or the token has expired
 *
 * @param req  - Express request object
 * @param res  - Express response object
 * @param next - Call to pass control to the next middleware/handler
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } });
    return;
  }

  // Strip the "Bearer " prefix to get the raw token string
  const token = authHeader.slice(7);
  try {
    req.user = verifyAccessToken(token);
    // New client-care-only identities never inherit donor access from endpoints
    // that historically required authentication without a finer permission gate.
    if (req.user.role === "compassion_user" && !/^\/api\/(?:auth(?:\/|$)|compassion(?:-public)?(?:\/|$))/.test(req.originalUrl)) {
      res.status(403).json({ error: { code: "CLIENT_CARE_ONLY", message: "This account is limited to Compassion client care." } });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: { code: "TOKEN_EXPIRED", message: "Access token is expired or invalid" } });
  }
}
