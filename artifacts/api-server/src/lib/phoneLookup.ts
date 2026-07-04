import { spawn } from "node:child_process";
import path from "node:path";

const PHONE_TOOL_PATH = path.resolve(process.cwd(), "..", "..", "phone-tool", "phone_tool.py");
const PYTHON_BIN = process.env.PHONE_TOOL_PYTHON || "python3";
const TIMEOUT_MS = 30_000; // longer: first run downloads datasets

export interface PhoneLookupResult {
  // Authoritative (phonenumbers library)
  valid: boolean;
  line_type: string;
  voip: boolean;
  carrier: string;
  country: string;
  city: string;
  region: string;
  timezones: string[];

  // Heuristic / community-data
  active: boolean;
  fraud_score: number;
  fraud_reasons: string[];
  recent_abuse: boolean;
  spammer: boolean;
  spam: boolean;
  prepaid: boolean;
  risky: boolean;
  dnc: boolean;
  dnc_source: string;
  pattern_flags: string[];

  // Unavailable offline — null means "cannot determine without live carrier/breach data"
  name: string | null;
  associated_emails: string[];
  user_activity: string | null;
  leaked_online: boolean | null;
  reassigned: boolean | null;
}

export class PhoneLookupError extends Error {}

export function lookupPhoneNumber(number: string): Promise<PhoneLookupResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON_BIN, [PHONE_TOOL_PATH, number, "--quiet"], {
      cwd: path.dirname(PHONE_TOOL_PATH),
    });

    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new PhoneLookupError("Phone lookup timed out (datasets may be downloading on first run)"));
    }, TIMEOUT_MS);

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new PhoneLookupError(`Failed to start phone_tool.py: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new PhoneLookupError(
          `phone_tool.py exited with code ${code}: ${stderr || stdout}`.slice(0, 500)
        ));
        return;
      }
      try {
        // Take the last non-empty line (quiet mode prints exactly one JSON line)
        const lastLine = stdout.trim().split("\n").filter(Boolean).pop() ?? "";
        const parsed = JSON.parse(lastLine) as PhoneLookupResult & { error?: string };
        if (parsed.error) {
          reject(new PhoneLookupError(parsed.error));
          return;
        }
        resolve(parsed);
      } catch (err) {
        reject(new PhoneLookupError(
          `Could not parse phone_tool.py output: ${err instanceof Error ? err.message : String(err)}`
        ));
      }
    });
  });
}
