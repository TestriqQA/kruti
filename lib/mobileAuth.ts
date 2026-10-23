/**
 * Mobile auth helper.
 *
 * The mobile app authenticates with a Bearer JWT that was created in
 * app/api/auth/mobile-callback/route.ts via next-auth `encode()` with
 * the payload { uid, role, email, name, picture, ... } signed by
 * process.env.NEXTAUTH_SECRET.
 *
 * This helper decodes that same token and returns the user id (uid),
 * so mobile API routes can authenticate the same way web routes use
 * getServerSession().
 *
 * Place at: lib/mobileAuth.ts
 */

import { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";

export interface MobileUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
}

/**
 * Extracts and verifies the mobile Bearer JWT.
 * Returns the MobileUser, or null if missing/invalid.
 */
export async function getMobileUser(
  req: NextRequest,
): Promise<MobileUser | null> {
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("[mobileAuth] NEXTAUTH_SECRET not set");
    return null;
  }

  try {
    const decoded = await decode({ token, secret });
    if (!decoded) return null;

    // mobile-callback signs the payload with `uid` as the user id.
    const uid =
      (decoded.uid as string) ||
      (decoded.sub as string) ||
      (decoded.id as string);
    if (!uid) return null;

    return {
      id: uid,
      email: decoded.email as string | undefined,
      name: decoded.name as string | undefined,
      role: (decoded.role as string | undefined) || "user",
    };
  } catch (err) {
    console.warn("[mobileAuth] token decode failed:", err);
    return null;
  }
}

/**
 * Convenience: returns just the userId, or null.
 */
export async function getMobileUserId(
  req: NextRequest,
): Promise<string | null> {
  const user = await getMobileUser(req);
  return user?.id ?? null;
}