import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.header("x-api-key");

  if (!key) {
    res.status(401).json({ error: "Missing X-API-Key header" });
    return;
  }

  const [record] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.key, key)).limit(1);

  if (!record || !record.active) {
    res.status(401).json({ error: "Invalid or revoked API key" });
    return;
  }

  db.update(apiKeysTable)
    .set({ requestCount: record.requestCount + 1, lastUsedAt: new Date() })
    .where(eq(apiKeysTable.id, record.id))
    .catch((err) => {
      req.log.error({ err }, "failed to update api key usage stats");
    });

  next();
}

/**
 * Admin auth: accepts EITHER the X-Admin-Secret header (matches ADMIN_API_SECRET env var)
 * OR a valid X-API-Key from the database. This lets the dashboard use the auto-generated
 * API key for admin operations without needing a separate secret workflow.
 */
export async function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  // ── Path 1: Admin secret header ──────────────────────────────────────────
  const providedSecret = req.header("x-admin-secret");
  const expectedSecret = process.env.ADMIN_API_SECRET;

  if (providedSecret && expectedSecret && providedSecret === expectedSecret) {
    next();
    return;
  }

  // ── Path 2: Valid API key (any active key grants admin access in self-hosted mode)
  const apiKey = req.header("x-api-key");
  if (apiKey) {
    const [record] = await db
      .select()
      .from(apiKeysTable)
      .where(eq(apiKeysTable.key, apiKey))
      .limit(1);

    if (record && record.active) {
      next();
      return;
    }
  }

  // ── Both failed ───────────────────────────────────────────────────────────
  res.status(401).json({
    error: "Invalid admin secret",
    hint: "Send X-Admin-Secret or a valid X-API-Key header",
  });
}
