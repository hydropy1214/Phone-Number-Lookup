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

export async function requireAdminSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.header("x-admin-secret");
  const expected = process.env.ADMIN_API_SECRET;

  if (!expected) {
    res.status(500).json({ error: "ADMIN_API_SECRET is not configured on the server" });
    return;
  }

  if (!provided || provided !== expected) {
    res.status(401).json({ error: "Invalid admin secret" });
    return;
  }

  next();
}
