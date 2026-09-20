import { NextRequest, NextResponse } from "next/server";

let warnedOnce = false;

/**
 * Mutation guard for state-changing API routes (POST/PUT/DELETE).
 *
 * - If PITMRY_TOKEN is unset: allows the request (local-dev default) and
 *   logs a one-time warning. Pair this with the localhost-only bind
 *   (`next dev -H localhost`) in package.json.
 * - If PITMRY_TOKEN is set: requires a matching
 *   `x-pitmry-token` header or `Authorization: Bearer <token>`.
 *
 * GET routes stay open (read-only dashboard views).
 */
export function requireMutationAuth(request: NextRequest): NextResponse | null {
  const token = process.env.PITMRY_TOKEN;
  if (!token) {
    if (!warnedOnce) {
      warnedOnce = true;
      console.warn(
        "[auth] PITMRY_TOKEN unset — mutations allowed. Set PITMRY_TOKEN in .env.local to lock POST/PUT/DELETE."
      );
    }
    return null;
  }
  const header = request.headers.get("x-pitmry-token");
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (header === token || bearer === token) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Parse a `limit` query param into a safe integer within [1, max]. */
export function clampLimit(raw: string | null, fallback = 50, max = 200): number {
  const n = raw == null ? NaN : parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), max);
}

/** Clamp a limit for passthrough to the Python bridge (returns string). */
export function clampLimitStr(raw: string | null, fallback = "50", max = 200): string {
  return String(clampLimit(raw, parseInt(fallback, 10) || 50, max));
}
