import { Router, type IRouter } from "express";
import { PhoneLookupResponse } from "@workspace/api-zod";
import { requireApiKey } from "../middleware/apiKey";
import { lookupPhoneNumber, PhoneLookupError } from "../lib/phoneLookup";

const router: IRouter = Router();

router.get("/phone/lookup", requireApiKey, async (req, res) => {
  const number = req.query.number;

  if (!number || typeof number !== "string") {
    res.status(400).json({ error: "Missing required 'number' query parameter" });
    return;
  }

  try {
    const raw = await lookupPhoneNumber(number);
    const data = PhoneLookupResponse.parse(raw);
    res.json(data);
  } catch (err) {
    if (err instanceof PhoneLookupError) {
      req.log.warn({ err, number }, "phone lookup failed");
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err, number }, "unexpected error during phone lookup");
    res.status(500).json({ error: "Internal error performing phone lookup" });
  }
});

export default router;
