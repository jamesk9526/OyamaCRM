import type { JwtPayload } from "../lib/auth.js";

// Express request augmentation for authenticated routes.
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
