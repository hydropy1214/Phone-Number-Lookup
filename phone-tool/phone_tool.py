#!/usr/bin/env python3
"""
phone_tool.py — Offline Phone Number Intelligence Lookup

Uses only locally stored data and the `phonenumbers` library. No paid API
providers are used. On first run (or with --update) it downloads community-
maintained public spam/abuse datasets into ./data.

Data honesty policy:
  Fields sourced from phonenumbers:  valid, line_type, voip, carrier, country,
                                      city, region — these are authoritative.
  Fields sourced from community lists: spam/recent_abuse/spammer, dnc_community
                                      — real but limited to what's been reported.
  Fields requiring live carrier lookup: name, associated_emails, user_activity,
                                         leaked_online, reassigned, active (precise)
                                         — shown as null/unknown; not faked.

HLR / active check:
  True HLR (Home Location Register) lookup requires SS7 signaling network
  access — this is physically impossible without telecom infrastructure or a
  paid SS7-gateway API. No free open-source tool provides real HLR. This tool
  shows "active" as a heuristic best-effort estimate, NOT a live network check.

DNC (Do Not Call):
  The official FTC Do Not Call Registry has no free bulk download — it is only
  available to paid telemarketer subscribers at donotcall.gov. "dnc" here uses
  community spam reports as a proxy, not the official registry.

RND (Reassigned Numbers Database):
  The FCC Reassigned Numbers Database requires a paid subscription at
  reassigned.us. No free open-source alternative exists. "reassigned" is always
  null in this tool.

Usage:
    python phone_tool.py +14155552671
    python phone_tool.py +14155552671 --update
    python phone_tool.py +14155552671 --quiet
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

try:
    import phonenumbers
    from phonenumbers import carrier as pn_carrier
    from phonenumbers import geocoder as pn_geocoder
    from phonenumbers import timezone as pn_timezone
except ImportError:
    print(
        "ERROR: the 'phonenumbers' package is required.\n"
        "    pip install phonenumbers",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    import requests
except ImportError:
    requests = None

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
METADATA_PATH = os.path.join(DATA_DIR, "metadata.json")
REQUEST_TIMEOUT = 20
USER_AGENT = "phone-tool/2.0 (+offline phone intelligence CLI)"

# Community spam/abuse list sources — all freely downloadable, maintained by
# the open-source community. Verified live as of 2026-07.
# Sources that no longer exist (404) have been removed:
#   - nicehash/spam-list         (404)
#   - sproctor/phone-blacklist   (404)
#   - StopSpam/phone-numbers     (404)
#   - TeamDman/nomorobo-blocklist (404)
SPAM_SOURCES = {
    "jwoertink_blocked": (
        "https://raw.githubusercontent.com/jwoertink/blocked-numbers/master/list.csv",
        "jwoertink_blocked.csv",
    ),
    "oros42_blacklist": (
        "https://raw.githubusercontent.com/Oros42/phone-blacklist/master/blacklist.csv",
        "oros42_blacklist.csv",
    ),
}

# ---------------------------------------------------------------------------
# High-risk area codes (publicly known from FCC consumer complaint reports)
# These NANPA area codes are disproportionately used in scam/fraud calls.
# Source: FCC Consumer Complaint Database public statistics.
# ---------------------------------------------------------------------------
HIGH_RISK_AREA_CODES = {
    # Caribbean area codes that share +1 country code but are NOT US/Canada.
    # Used in "one-ring" scams and premium-rate fraud.
    "876": ("Jamaica", 40),
    "268": ("Antigua and Barbuda", 40),
    "473": ("Grenada", 40),
    "664": ("Montserrat", 40),
    "767": ("Dominica", 40),
    "809": ("Dominican Republic", 35),
    "829": ("Dominican Republic", 35),
    "849": ("Dominican Republic", 35),
    "284": ("British Virgin Islands", 35),
    "345": ("Cayman Islands", 35),
    "441": ("Bermuda", 35),
    "721": ("Sint Maarten", 35),
    "758": ("Saint Lucia", 30),
    "784": ("Saint Vincent and the Grenadines", 30),
    "868": ("Trinidad and Tobago", 30),
    "869": ("Saint Kitts and Nevis", 30),
    "649": ("Turks and Caicos", 30),
    "246": ("Barbados", 25),
    "242": ("Bahamas", 25),
    "787": ("Puerto Rico", 5),   # US territory, modest risk
    "939": ("Puerto Rico", 5),
    # US area codes with high FCC robocall complaint volumes
    "712": ("Iowa", 10),
    "218": ("Minnesota", 10),
    "605": ("South Dakota", 10),
    "406": ("Montana", 8),
    "701": ("North Dakota", 8),
    "208": ("Idaho", 5),
}

# Known prepaid / MVNO carrier keywords for best-effort prepaid detection.
# Source: publicly known carrier trade names.
PREPAID_CARRIER_KEYWORDS = [
    "boost", "cricket", "metro", "tracfone", "mint mobile", "straight talk",
    "simple mobile", "net10", "total wireless", "h2o", "ultra mobile",
    "google fi", "visible", "red pocket", "consumer cellular", "page plus",
    "virgin mobile", "lyca", "ptel", "safelink", "truphone", "telcel",
    "t-mobile prepaid", "at&t prepaid", "verizon prepaid", "prepaid",
    "mvno", "freedom mobile", "public mobile", "koodo", "chatr",
    "ting", "republic wireless", "wing", "textnow", "unreal mobile",
    "tello", "pure talk", "us mobile", "reach mobile", "gen mobile",
]

# VoIP carrier name fragments — extended to cover all major VoIP providers.
# These supplement the authoritative phonenumbers line-type detection.
# When a carrier name contains any of these strings, the number is VoIP.
VOIP_CARRIER_KEYWORDS = [
    # Generics
    "voip", "voice over ip", "virtual", "virtual number", "virtual phone",
    # Major US VoIP providers
    "vonage", "magicjack", "google voice", "lingo", "ooma",
    "ring central", "ringcentral",
    # CPaaS / programmable voice (used by businesses and robocallers alike)
    "twilio", "bandwidth", "bandwidth.com",
    "signalwire", "plivo", "nexmo", "vonage api",
    "telnyx", "voxbone", "commio", "didlogic",
    "flowroute", "voip innovations", "voip.ms",
    "ip communications", "level 3", "level3",
    "lumen", "centurylink voip", "qwest voip",
    # UCaaS / business VoIP
    "8x8", "dialpad", "nextiva", "intermedia",
    "cbeyond", "cavalier", "paetec",
    "zoom phone", "microsoft teams direct",
    "cisco webex calling", "avaya cloud",
    "jive", "grasshopper", "google workspace voice",
    # International / MVNO VoIP
    "skype", "whatsapp", "viber out",
    "textmagic", "iphone voip", "textfree",
    "textplus", "talkatone", "burner",
    "hushed", "line2", "openphone", "sideline",
    "numero esim", "dingtone", "2ndline",
]

NUMBER_TYPE_NAMES = {
    phonenumbers.PhoneNumberType.FIXED_LINE: "Fixed Line",
    phonenumbers.PhoneNumberType.MOBILE: "Mobile",
    phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE: "Fixed Line or Mobile",
    phonenumbers.PhoneNumberType.TOLL_FREE: "Toll-Free",
    phonenumbers.PhoneNumberType.PREMIUM_RATE: "Premium Rate",
    phonenumbers.PhoneNumberType.SHARED_COST: "Shared Cost",
    phonenumbers.PhoneNumberType.VOIP: "VoIP",
    phonenumbers.PhoneNumberType.PERSONAL_NUMBER: "Personal Number",
    phonenumbers.PhoneNumberType.PAGER: "Pager",
    phonenumbers.PhoneNumberType.UAN: "UAN",
    phonenumbers.PhoneNumberType.VOICEMAIL: "Voicemail",
    phonenumbers.PhoneNumberType.UNKNOWN: "Unknown",
}

# ---------------------------------------------------------------------------
# Data download / setup
# ---------------------------------------------------------------------------

def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _download(url: str, dest_path: str, quiet: bool = False) -> bool:
    if requests is None:
        return False
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": USER_AGENT})
        if resp.status_code != 200:
            if not quiet:
                print(f"  [skip] HTTP {resp.status_code} for {url}")
            return False
        with open(dest_path, "wb") as f:
            f.write(resp.content)
        if not quiet:
            print(f"  [ok]   {url} → {os.path.relpath(dest_path, SCRIPT_DIR)} ({len(resp.content):,} bytes)")
        return True
    except Exception as e:
        if not quiet:
            print(f"  [skip] {url}: {e}")
        return False


def update_data(force: bool = False, quiet: bool = False):
    ensure_data_dir()
    if not quiet:
        print(f"Downloading community spam/abuse datasets into {DATA_DIR} ...")

    downloaded = 0
    for key, (url, filename) in SPAM_SOURCES.items():
        if filename is None:
            continue  # explicitly skipped source
        dest = os.path.join(DATA_DIR, filename)
        if not force and os.path.exists(dest):
            if not quiet:
                print(f"  [cached] {filename}")
            downloaded += 1
            continue
        if _download(url, dest, quiet=quiet):
            downloaded += 1

    metadata = {
        "last_updated": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        "sources_downloaded": downloaded,
    }
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    if not quiet:
        print(f"Update complete — {downloaded} source(s) available.\n")


def data_is_missing() -> bool:
    if not os.path.isdir(DATA_DIR):
        return True
    spam_files = [fn for _, fn in SPAM_SOURCES.values() if fn]
    return not any(os.path.exists(os.path.join(DATA_DIR, fn)) for fn in spam_files)


# ---------------------------------------------------------------------------
# Loading spam datasets
# ---------------------------------------------------------------------------

def _normalize_number_str(raw: str) -> Optional[str]:
    """Best-effort E.164 normalization, defaulting to US/Canada."""
    if not raw:
        return None
    raw = raw.strip()
    if not raw or raw.startswith("#"):
        return None
    digits = re.sub(r"[^\d+]", "", raw)
    if not digits or len(digits) < 4:
        return None
    try:
        if digits.startswith("+"):
            parsed = phonenumbers.parse(digits, None)
        else:
            parsed = phonenumbers.parse(digits, "US")
        return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        return None


def load_spam_numbers(override_path: Optional[str] = None) -> set:
    """Load all community spam datasets into a single normalized set."""
    numbers = set()

    def _ingest_text(path):
        try:
            with open(path, "r", errors="ignore") as f:
                for line in f:
                    norm = _normalize_number_str(line.split(",")[0])
                    if norm:
                        numbers.add(norm)
        except Exception:
            pass

    def _ingest_csv(path):
        try:
            with open(path, "r", errors="ignore", newline="") as f:
                sample = f.read(4096)
                f.seek(0)
                try:
                    has_header = csv.Sniffer().has_header(sample)
                except csv.Error:
                    has_header = True
                reader = csv.reader(f)
                for i, row in enumerate(reader):
                    if i == 0 and has_header:
                        continue
                    for cell in row:
                        norm = _normalize_number_str(cell)
                        if norm:
                            numbers.add(norm)
        except Exception:
            pass

    if override_path:
        if override_path.lower().endswith(".csv"):
            _ingest_csv(override_path)
        else:
            _ingest_text(override_path)
        return numbers

    for key, (url, filename) in SPAM_SOURCES.items():
        if filename is None:
            continue
        path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(path):
            continue
        if filename.endswith(".csv"):
            _ingest_csv(path)
        else:
            _ingest_text(path)

    return numbers


# ---------------------------------------------------------------------------
# Number pattern analysis
# ---------------------------------------------------------------------------

def _check_suspicious_patterns(e164: str) -> list[tuple[str, int]]:
    """
    Detect structurally suspicious number patterns without live data.
    Returns list of (reason, score_penalty) tuples.
    """
    hits = []
    if not e164:
        return hits

    # Strip leading + and country code for national number analysis
    digits = e164.lstrip("+")
    # For NANP (+1), national number is last 10 digits
    if digits.startswith("1") and len(digits) == 11:
        area_code = digits[1:4]
        exchange = digits[4:7]
        subscriber = digits[7:11]

        # Hollywood / fictitious numbers: NXX 555-01xx
        if exchange == "555" and subscriber.startswith("0"):
            hits.append(("555-0xxx fictitious number pattern", 30))

        # All-same-digit subscriber block (e.g., 555-1111)
        if len(set(subscriber)) == 1:
            hits.append(("Repeating digit subscriber number (e.g. 0000, 1111)", 20))

        # Sequential subscriber block (e.g., 1234, 2345, 6789)
        digs = [int(d) for d in subscriber]
        if all(digs[i+1] - digs[i] == 1 for i in range(3)):
            hits.append(("Sequential digit subscriber number (e.g. 1234)", 15))
        elif all(digs[i] - digs[i+1] == 1 for i in range(3)):
            hits.append(("Descending sequential subscriber number (e.g. 9876)", 15))

        # Known high-risk Caribbean / NANP area codes
        if area_code in HIGH_RISK_AREA_CODES:
            country_note, penalty = HIGH_RISK_AREA_CODES[area_code]
            hits.append((f"Area code {area_code} ({country_note}) — elevated scam/premium-rate risk", penalty))

        # Exchange 000 or 100 — typically unassigned/special
        if exchange in ("000", "100"):
            hits.append((f"Exchange {exchange} is typically unassigned or special-use", 20))

        # Subscriber 0000 or 9999 — unassigned extremes
        if subscriber in ("0000", "9999"):
            hits.append((f"Subscriber number {subscriber} is typically unassigned", 15))

        # Repeating exchange+subscriber pattern (e.g. +12025555555)
        if len(set(exchange + subscriber)) == 1:
            hits.append(("All-same-digit 7-digit national number", 25))

    else:
        # Non-NANP: all-same digits in last 4
        national_part = digits[2:] if len(digits) > 6 else digits
        if national_part and len(set(national_part[-4:])) == 1:
            hits.append(("Repeating last-4 digit pattern", 10))

    return hits


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------

@dataclass
class LookupResult:
    # --- Input ---
    input_number: str

    # --- Parse error (set when phonenumbers cannot parse the input) ---
    parse_error: Optional[str] = None

    # --- Authoritative (phonenumbers library) ---
    valid: bool = False
    e164: Optional[str] = None
    line_type: str = "Unknown"
    carrier: str = ""
    country: str = ""
    region: str = ""
    city: str = ""
    timezones: list = field(default_factory=list)

    # --- Derived from line_type (phonenumbers) ---
    is_voip: bool = False
    is_prepaid: bool = False        # heuristic from carrier name

    # --- Community spam/abuse datasets ---
    is_spam: bool = False           # found in community spam lists
    spam_list_count: int = 0        # how many separate lists flagged it

    # --- Pattern analysis ---
    pattern_risks: list = field(default_factory=list)  # [(reason, score)]

    # --- Composite / heuristic ---
    fraud_score_int: int = 0
    fraud_reasons: list = field(default_factory=list)
    is_risky: bool = False
    is_active_estimate: bool = True  # best-effort only — NOT a live HLR check

    # --- Unavailable offline (shown as None/unknown) ---
    # name, associated_emails, user_activity, leaked_online, reassigned:
    # These require carrier CNAM, data enrichment, live HLR, or FCC RND
    # subscriptions. We never fabricate values for these fields.


def analyze_number(
    raw_number: str,
    spam_set: set,
    override_spam_path: Optional[str] = None,
) -> LookupResult:
    result = LookupResult(input_number=raw_number)

    # --- Parse ---
    try:
        default_region = None if raw_number.strip().startswith("+") else "US"
        parsed = phonenumbers.parse(raw_number, default_region)
    except phonenumbers.NumberParseException as e:
        # Record the parse error; the caller decides how to surface it.
        result.parse_error = str(e)
        result.fraud_reasons.append(f"Parse error: {e}")
        result.fraud_score_int = 30
        return result

    # --- Validity (authoritative) ---
    result.valid = phonenumbers.is_valid_number(parsed)
    result.e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)

    # --- Line type (authoritative via Google libphonenumber) ---
    # This is the most reliable offline signal for VoIP vs mobile vs landline.
    # The library encodes known VoIP number ranges directly.
    num_type = phonenumbers.number_type(parsed)
    result.line_type = NUMBER_TYPE_NAMES.get(num_type, "Unknown")
    result.is_voip = (num_type == phonenumbers.PhoneNumberType.VOIP)

    # --- Carrier (authoritative for international; often empty for US mobile
    #     due to NANP number portability — carrier cannot be determined from
    #     the number alone without a live HLR/portability query) ---
    carrier_name = pn_carrier.name_for_number(parsed, "en")
    result.carrier = carrier_name if carrier_name else ""

    # --- Prepaid heuristic from carrier name ---
    carrier_lower = (carrier_name or "").lower()
    result.is_prepaid = any(kw in carrier_lower for kw in PREPAID_CARRIER_KEYWORDS)

    # --- VoIP carrier-name heuristic (supplements libphonenumber line type) ---
    # If carrier name contains any known VoIP provider keyword, flag as VoIP.
    # This catches cases where libphonenumber classified the range as "Fixed Line"
    # but the carrier name reveals it is actually a VoIP/CPaaS provider.
    if not result.is_voip and any(kw in carrier_lower for kw in VOIP_CARRIER_KEYWORDS):
        result.is_voip = True
        # If line_type wasn't already VoIP, update it to reflect the finding
        if result.line_type not in ("VoIP",):
            result.line_type = f"VoIP (via carrier: {carrier_name})"

    # --- Geography (authoritative) ---
    region_code = phonenumbers.region_code_for_number(parsed)
    result.country = region_code or ""

    geo = pn_geocoder.description_for_number(parsed, "en")
    if geo:
        parts = [p.strip() for p in geo.split(",")]
        if len(parts) >= 2:
            result.city = parts[0]
            result.region = ", ".join(parts[1:])
        else:
            result.region = geo
            result.city = ""

    # --- Timezones (authoritative) ---
    try:
        result.timezones = list(pn_timezone.time_zones_for_number(parsed))
    except Exception:
        result.timezones = []

    # --- Community spam lookup ---
    if result.e164:
        result.is_spam = result.e164 in spam_set

    # --- Pattern risk analysis ---
    result.pattern_risks = _check_suspicious_patterns(result.e164 or "")

    # --- Fraud score (heuristic, 0–100) ---
    score = 0
    reasons = []

    if not result.valid:
        score += 30
        reasons.append("Invalid number format (+30)")

    if result.is_spam:
        score += 45
        reasons.append("Reported in community spam/abuse dataset (+45)")

    for pattern_reason, penalty in result.pattern_risks:
        score += penalty
        reasons.append(f"{pattern_reason} (+{penalty})")

    if result.is_voip:
        score += 15
        reasons.append("VoIP line type — commonly used for disposable/spoofed numbers (+15)")

    if num_type == phonenumbers.PhoneNumberType.PREMIUM_RATE:
        score += 25
        reasons.append("Premium-rate number — charges caller (+25)")

    if num_type == phonenumbers.PhoneNumberType.TOLL_FREE:
        score += 5
        reasons.append("Toll-free number — slight elevation for scam calls (+5)")

    if num_type == phonenumbers.PhoneNumberType.PERSONAL_NUMBER:
        score += 10
        reasons.append("Personal/follow-me number (+10)")

    if result.is_prepaid:
        score += 5
        reasons.append("Prepaid carrier — slightly higher fraud association (+5)")

    if not result.valid and not carrier_name:
        score += 5
        reasons.append("No carrier data available (+5)")

    score = min(score, 100)
    result.fraud_score_int = score
    result.fraud_reasons = reasons if reasons else ["No risk indicators found in available data"]

    # --- Composite flags ---
    result.is_risky = (
        result.is_spam
        or result.fraud_score_int >= 75
        or num_type == phonenumbers.PhoneNumberType.PREMIUM_RATE
        or any(pen >= 35 for _, pen in result.pattern_risks)
    )

    # Active: best-effort heuristic — valid format + no major red flags.
    # This is NOT a live HLR check. True HLR requires SS7 network access
    # which is not available without a paid telecom API.
    result.is_active_estimate = result.valid and not result.is_spam and result.fraud_score_int < 60

    return result


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def to_api_dict(result: LookupResult) -> dict:
    """
    Flat JSON shape consumed by the API server.
    Fields that cannot be determined offline use null.
    The 'dnc' field uses community spam list as a proxy — numbers reported
    as spam are often Do-Not-Call violations, but this is not the FTC registry.
    """
    return {
        # Authoritative (Google libphonenumber via phonenumbers)
        "valid":             result.valid,
        "line_type":         result.line_type,
        "voip":              result.is_voip,
        "carrier":           result.carrier,
        "country":           result.country,
        "city":              result.city,
        "region":            result.region,
        "timezones":         result.timezones,

        # Heuristic / community-data
        "active":            result.is_active_estimate,
        "fraud_score":       result.fraud_score_int,
        "fraud_reasons":     result.fraud_reasons,
        "recent_abuse":      result.is_spam,
        "spammer":           result.is_spam,
        "spam":              result.is_spam,
        "prepaid":           result.is_prepaid,
        "risky":             result.is_risky,

        # DNC: community spam list proxy (NOT the official FTC registry).
        # A number in community abuse reports is likely a DNC violator, but
        # the real FTC Do Not Call Registry requires a paid subscription —
        # it has no free bulk download. "dnc" here = community-reported proxy.
        "dnc":               result.is_spam,
        "dnc_source":        "community_spam_proxy" if result.is_spam else "none",

        # Unavailable offline — never fabricated:
        # HLR (live active/reachable) — requires SS7 / paid telecom API
        # CNAM (caller name)          — requires carrier CNAM lookup
        # RND (reassigned)            — requires FCC paid subscription
        # Data enrichment             — requires breach/enrichment database
        "name":              None,   # requires CNAM carrier lookup
        "associated_emails": [],     # requires data enrichment service
        "user_activity":     None,   # requires live HLR/SS7
        "leaked_online":     None,   # requires breach database (e.g. HIBP)
        "reassigned":        None,   # requires FCC RND paid subscription

        # Pattern analysis detail
        "pattern_flags":     [r for r, _ in result.pattern_risks],
    }


def print_result_table(result: LookupResult):
    api = to_api_dict(result)

    def fmt(val):
        if val is None:
            return "N/A (requires live carrier/breach data)"
        if isinstance(val, bool):
            return "YES" if val else "NO"
        if isinstance(val, list):
            return ", ".join(val) if val else "(none)"
        return str(val)

    rows = [
        ("Input",            result.input_number),
        ("E.164",            result.e164 or "unparseable"),
        ("Valid",            fmt(api["valid"])),
        ("Active (est.)",    fmt(api["active"]) + " [heuristic — NOT a live HLR check]"),
        ("Line Type",        api["line_type"]),
        ("VoIP",             fmt(api["voip"])),
        ("Carrier",          api["carrier"] or "Unknown (US mobile portability prevents offline carrier ID)"),
        ("Prepaid",          fmt(api["prepaid"]) + " [heuristic from carrier name]"),
        ("Country",          api["country"] or "Unknown"),
        ("City",             api["city"] or "Unknown"),
        ("Region",           api["region"] or "Unknown"),
        ("Timezones",        fmt(api["timezones"])),
        ("Fraud Score",      f"{api['fraud_score']}/100"),
        ("Recent Abuse",     fmt(api["recent_abuse"]) + " [community dataset]"),
        ("Spammer",          fmt(api["spammer"]) + " [community dataset]"),
        ("Risky",            fmt(api["risky"])),
        ("DNC",              fmt(api["dnc"]) + " [community proxy — NOT FTC registry]"),
        ("Pattern Flags",    fmt(api["pattern_flags"])),
        ("Name (CNAM)",      "N/A — requires live CNAM carrier lookup"),
        ("Emails",           "N/A — requires data enrichment service"),
        ("Active (HLR)",     "N/A — true HLR requires SS7 / paid telecom API"),
        ("Leaked Online",    "N/A — requires breach database (e.g. HIBP)"),
        ("Reassigned (RND)", "N/A — FCC RND requires paid subscription"),
    ]

    w = max(len(r[0]) for r in rows) + 2
    total = w + 66
    print()
    print("=" * total)
    print(" PHONE INTELLIGENCE REPORT".center(total))
    print("=" * total)
    for label, value in rows:
        print(f" {label.ljust(w)}: {value}")
    print("-" * total)
    print(" Fraud Score Breakdown:")
    for reason in result.fraud_reasons:
        print(f"   · {reason}")
    print("=" * total)
    print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="phone_tool.py",
        description="Offline phone intelligence lookup using community datasets and phonenumbers library.",
    )
    p.add_argument("number", nargs="?", help="E.164 phone number, e.g. +14155552671")
    p.add_argument("--update", action="store_true", help="Re-download community datasets before lookup.")
    p.add_argument("--spam-file", dest="spam_file", help="Path to a custom spam numbers file.")
    p.add_argument("--quiet", action="store_true", help="Print only JSON (for programmatic use).")
    p.add_argument("--json", action="store_true", help="Also print raw JSON.")
    return p


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    quiet = args.quiet

    def qprint(*a, **kw):
        if not quiet:
            print(*a, **kw)

    if args.update or data_is_missing():
        if quiet:
            _update_silently()
        else:
            update_data(force=args.update)

    if not args.number:
        if args.update:
            qprint("Data update done. Provide a number to look up.")
            return 0
        if quiet:
            print(json.dumps({"error": "no number provided"}))
            return 1
        parser.print_help()
        return 1

    spam_set = load_spam_numbers(override_path=args.spam_file)
    qprint(f"Loaded {len(spam_set):,} community spam entries from {DATA_DIR}")

    result = analyze_number(args.number, spam_set)

    # In quiet/programmatic mode: surface parse errors as {"error": ...} with
    # exit code 1 so the API server can return HTTP 400 instead of 200.
    if quiet:
        if result.parse_error:
            print(json.dumps({"error": f"Invalid phone number: {result.parse_error}"}))
            return 1
        print(json.dumps(to_api_dict(result)))
        return 0

    if result.parse_error:
        print(f"\nERROR: Could not parse number: {result.parse_error}")
        return 1

    print_result_table(result)

    if args.json:
        print("JSON:")
        print(json.dumps(to_api_dict(result), indent=2))

    return 0


def _update_silently():
    import contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        update_data(force=True)


if __name__ == "__main__":
    sys.exit(main())
