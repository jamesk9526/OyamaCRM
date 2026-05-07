/**
 * Authentication utilities for OyamaCRM.
 * Provides JWT signing/verification for access and refresh tokens,
 * bcrypt password hashing helpers, and shared cookie configuration
 * used across the auth routes and middleware.
 * @module lib/auth
 */
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-jwt-secret-UNSAFE";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "15m";
const REFRESH_SECRET = process.env.REFRESH_SECRET ?? "dev-refresh-secret-UNSAFE";
const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN ?? "7d";

/**
 * Shape of the decoded JWT access token payload.
 * This is attached to `req.user` by the `requireAuth` middleware.
 */
export interface JwtPayload {
  sub: string;       // userId
  email: string;
  role: string;
  orgId: string;
}

/**
 * Signs a short-lived JWT access token containing the user's identity and role.
 * Expiry is controlled by the `JWT_EXPIRES_IN` env var (default: 15m).
 *
 * @param payload - User identity fields to embed in the token
 * @returns Signed JWT access token string
 */
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verifies and decodes a JWT access token.
 * Throws a `JsonWebTokenError` or `TokenExpiredError` if the token is invalid.
 *
 * @param token - The raw JWT string (without "Bearer " prefix)
 * @returns Decoded payload with `sub`, `email`, `role`, and `orgId`
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Signs a long-lived JWT refresh token containing only the user ID.
 * Expiry is controlled by the `REFRESH_EXPIRES_IN` env var (default: 7d).
 * The token is also persisted to the database for rotation/revocation tracking.
 *
 * @param userId - The user's database ID to embed as the `sub` claim
 * @returns Signed JWT refresh token string
 */
export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Verifies and decodes a JWT refresh token.
 * Throws if the token is expired or tampered with.
 *
 * @param token - The raw refresh token string read from the HTTP-only cookie
 * @returns Object containing `sub` (the user ID)
 */
export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, REFRESH_SECRET) as { sub: string };
}

/** Number of bcrypt salt rounds. Higher values increase security but slow hashing. */
const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt with `SALT_ROUNDS` cost factor.
 *
 * @param plain - The plain-text password to hash
 * @returns Promise resolving to the bcrypt hash string
 */
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Uses a timing-safe comparison to prevent timing attacks.
 *
 * @param plain - The plain-text password submitted by the user
 * @param hash - The stored bcrypt hash from the database
 * @returns Promise resolving to `true` if the password matches, `false` otherwise
 */
export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Name of the HTTP-only cookie used to store the refresh token. */
export const REFRESH_COOKIE = "oyama_refresh";

/**
 * Cookie options for the refresh token cookie.
 * The cookie is HTTP-only (not accessible via JS), scoped to `/api/auth`,
 * and marked secure in production to enforce HTTPS transmission.
 */
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};
