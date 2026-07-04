import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db/schema";
import crypto from "node:crypto";

const router: IRouter = Router();

/**
 * GET /api/setup
 * Returns the current admin secret and (if none exist) creates a default API key.
 * This endpoint has no auth requirement — it is designed for first-run and
 * self-hosted scenarios where the operator needs to discover credentials.
 */
router.get("/setup", async (_req, res) => {
  const secret = process.env["ADMIN_API_SECRET"] ?? null;

  // Ensure at least one API key exists
  let keys = await db.select().from(apiKeysTable).limit(10);
  if (keys.length === 0) {
    const defaultKey = `pk_${crypto.randomBytes(24).toString("hex")}`;
    const [created] = await db
      .insert(apiKeysTable)
      .values({ key: defaultKey, label: "Default Key" })
      .returning();
    keys = [created];
  }

  res.json({
    admin_secret: secret,
    default_api_key: keys[0]?.key ?? null,
    keys_count: keys.length,
  });
});

export default router;
