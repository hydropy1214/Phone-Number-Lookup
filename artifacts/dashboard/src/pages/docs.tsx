import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Shield, Radio, PhoneOff, RotateCcw, Layers, Globe } from 'lucide-react';

function Method({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    POST: 'bg-green-500/15 text-green-400 border-green-500/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded border font-mono text-xs font-bold ${colors[method] || 'bg-muted text-muted-foreground'}`}>
      {method}
    </span>
  );
}

function Endpoint({ method, path, auth, summary }: { method: string; path: string; auth?: string; summary: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/30 last:border-0">
      <Method method={method} />
      <div className="flex-1 min-w-0">
        <code className="font-mono text-sm text-foreground">{path}</code>
        <p className="font-mono text-xs text-muted-foreground mt-0.5">{summary}</p>
      </div>
      {auth && (
        <Badge variant="outline" className="font-mono text-[10px] text-amber-400 border-amber-500/30 shrink-0">{auth}</Badge>
      )}
    </div>
  );
}

function Field({ name, type, src, desc, nullable }: { name: string; type: string; src: 'authoritative' | 'community' | 'heuristic' | 'unavailable'; desc: string; nullable?: boolean }) {
  const srcColors: Record<string, string> = {
    authoritative: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    community: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    heuristic: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    unavailable: 'bg-muted/40 text-muted-foreground border-border/50',
  };
  return (
    <div className="grid grid-cols-[180px_90px_1fr] gap-3 py-2 border-b border-border/20 last:border-0 items-start">
      <code className="font-mono text-xs text-foreground">{name}{nullable ? <span className="text-muted-foreground">?</span> : ''}</code>
      <div className="flex flex-col gap-1">
        <code className="font-mono text-[10px] text-muted-foreground">{type}</code>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-wide w-fit ${srcColors[src]}`}>{src}</span>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-black/60 rounded p-4 font-mono text-xs text-green-400 overflow-x-auto leading-relaxed">
      {children}
    </pre>
  );
}

export function Docs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BookOpen className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-mono font-bold tracking-tight">API_DOCS</h1>
        <Badge variant="outline" className="font-mono text-xs">v0.2</Badge>
      </div>

      {/* Authentication */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            AUTHENTICATION
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">
            All phone lookup endpoints require an API key passed in the <code className="text-foreground">X-API-Key</code> request header.
            Create keys on the <span className="text-primary">API_KEYS</span> page.
          </p>
          <CodeBlock>{`curl -H "X-API-Key: your_key_here" \\
  "https://your-domain/api/phone/lookup?number=+14155552671"`}</CodeBlock>
        </CardContent>
      </Card>

      {/* Endpoint list */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm">ENDPOINTS</CardTitle>
        </CardHeader>
        <CardContent className="p-0 px-5">
          <Endpoint method="GET" path="/api/phone/lookup?number=..." auth="X-API-Key" summary="Single phone number intelligence lookup" />
          <Endpoint method="POST" path="/api/phone/batch" auth="X-API-Key" summary="Batch lookup up to 100 numbers in one request" />
          <Endpoint method="GET" path="/api/phone/sources" summary="Data source status (no auth required)" />
          <Endpoint method="GET" path="/api/healthz" summary="Health check" />
          <Endpoint method="GET" path="/api/admin/keys" auth="X-Admin-Secret" summary="List all API keys" />
          <Endpoint method="POST" path="/api/admin/keys" auth="X-Admin-Secret" summary="Create a new API key" />
          <Endpoint method="POST" path="/api/admin/keys/{id}/revoke" auth="X-Admin-Secret" summary="Revoke an API key" />
        </CardContent>
      </Card>

      {/* GET /phone/lookup */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            GET /api/phone/lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Query Parameters</p>
              <div className="bg-muted/20 rounded p-3 font-mono text-xs space-y-1">
                <div><code className="text-foreground">number</code><span className="text-muted-foreground"> (required) — Phone number. E.164 preferred (+14155552671) or national format with country hint.</span></div>
              </div>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Example Request</p>
              <CodeBlock>{`GET /api/phone/lookup?number=%2B14155552671
X-API-Key: pk_live_xxx`}</CodeBlock>
            </div>
          </div>
          <CodeBlock>{`// Example response (abbreviated)
{
  "valid": true,
  "possible": true,
  "e164": "+14155552671",
  "national_format": "(415) 555-2671",
  "international_format": "+1 415-555-2671",
  "line_type": "Fixed Line or Mobile",
  "line_type_source": "phonenumbers",
  "voip": false,
  "carrier": "",
  "country": "US",
  "city": "San Francisco",
  "region": "CA",
  "timezones": ["America/Los_Angeles"],
  "fraud_score": 15,
  "active": true,
  "spam": false,
  "spam_source_count": 0,
  "dnc": false,
  "dnc_source": "none",
  "prepaid": false,
  "risky": false,
  "hlr_status": {
    "method": "heuristic",
    "reachable_estimate": true,
    "confidence": "low",
    "signals": ["Passes E.164 format validity check", "..."],
    "disclaimer": "Heuristic only — not a live SS7/HLR query."
  },
  "carrier_type": {
    "type": "Mobile",
    "confidence": "heuristic",
    "description": "Mobile number — carrier not determinable offline"
  },
  "ported_estimate": {
    "method": "heuristic",
    "ported_estimate": true,
    "confidence": "very_low",
    "signals": ["..."],
    "disclaimer": "..."
  },
  "rnd_risk": {
    "method": "heuristic",
    "risk_level": "medium",
    "risk_score": 35,
    "confidence": "low",
    "risk_factors": ["Area code 415 is in a high-exhaust region"],
    "disclaimer": "..."
  },
  "name": null,
  "user_activity": null,
  "reassigned": null,
  "leaked_online": null
}`}</CodeBlock>
        </CardContent>
      </Card>

      {/* POST /phone/batch */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            POST /api/phone/batch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-mono text-xs text-muted-foreground">
            Submit up to 100 phone numbers in a single request. Results are returned in the same order as input.
            Each item includes either a full <code className="text-foreground">result</code> or an <code className="text-foreground">error</code> string.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Request Body</p>
              <CodeBlock>{`{
  "numbers": [
    "+14155552671",
    "+12125551234",
    "+16505550000"
  ]
}`}</CodeBlock>
            </div>
            <div>
              <p className="font-mono text-[10px] text-muted-foreground mb-1 uppercase tracking-widest">Response</p>
              <CodeBlock>{`{
  "total": 3,
  "succeeded": 3,
  "failed": 0,
  "results": [
    {
      "number": "+14155552671",
      "result": { ... }
    },
    ...
  ]
}`}</CodeBlock>
            </div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded p-3 font-mono text-xs text-amber-400">
            Batch results run concurrently. Large batches (50-100 numbers) may take 15-30 seconds
            due to Python subprocess overhead. Reduce concurrency by splitting into smaller batches if needed.
          </div>
        </CardContent>
      </Card>

      {/* Response field reference */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="font-mono text-sm">RESPONSE_FIELD_REFERENCE</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-5">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Data Source Legend</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['authoritative', 'community', 'heuristic', 'unavailable'] as const).map(src => {
              const colors: Record<string, string> = {
                authoritative: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
                community: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                heuristic: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
                unavailable: 'bg-muted/40 text-muted-foreground border-border/50',
              };
              const labels: Record<string, string> = {
                authoritative: 'Google libphonenumber — definitive offline data',
                community: 'Community spam/abuse datasets',
                heuristic: 'Derived logic / pattern analysis',
                unavailable: 'Always null — requires live carrier/RND/breach API',
              };
              return (
                <div key={src} className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-wide ${colors[src]}`}>{src}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{labels[src]}</span>
                </div>
              );
            })}
          </div>

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">Core Validity</p>
          <Field name="valid" type="boolean" src="authoritative" desc="Valid, dialable E.164 number per ITU standards (Google libphonenumber)" />
          <Field name="possible" type="boolean" src="authoritative" desc="Looser check — number length/format is plausible for the region" />
          <Field name="e164" type="string" src="authoritative" desc="E.164 canonical format, e.g. +14155552671" />
          <Field name="national_format" type="string" src="authoritative" desc="National format, e.g. (415) 555-2671 for US numbers" />
          <Field name="international_format" type="string" src="authoritative" desc="International format, e.g. +1 415-555-2671" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">Line &amp; Carrier</p>
          <Field name="line_type" type="string" src="authoritative" desc="Fixed Line, Mobile, VoIP, Toll-Free, Premium Rate, Shared Cost, Personal Number, Pager, UAN, Voicemail, Unknown" />
          <Field name="line_type_source" type="string" src="authoritative" desc='"phonenumbers" (authoritative) or "heuristic" (carrier keyword match)' />
          <Field name="voip" type="boolean" src="authoritative" desc="True if number is a VoIP line per phonenumbers or carrier heuristic" />
          <Field name="carrier" type="string" src="authoritative" desc="Original network carrier. Often empty for US mobile numbers — NANP number portability (LNP) prevents offline carrier identification after porting" />
          <Field name="carrier_type" type="object" src="heuristic" desc="Carrier category: MNO, MVNO, CLEC, ILEC, VoIP/OTT, Toll-Free, Premium Rate, Mobile, Wireline, Unknown — with confidence label" />
          <Field name="prepaid" type="boolean" src="heuristic" desc="True if carrier name matches known prepaid/MVNO brand keywords" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">Geography</p>
          <Field name="country" type="string" src="authoritative" desc="ISO 3166-1 alpha-2 country code" />
          <Field name="city" type="string" src="authoritative" desc="City or geographic area from phonenumbers geocoder" />
          <Field name="region" type="string" src="authoritative" desc="State, province, or region" />
          <Field name="timezones" type="string[]" src="authoritative" desc="IANA timezone identifiers for this number's geographic area" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">HLR / Reachability</p>
          <Field name="active" type="boolean" src="heuristic" desc="Simplified reachability flag — valid format + not in abuse lists + fraud score < 60" />
          <Field name="hlr_status" type="object" src="heuristic" desc="Structured HLR assessment: reachable_estimate (bool), confidence (very_low/low/medium/high), signals (array of reasoning), disclaimer" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">DNC / Spam</p>
          <Field name="spam" type="boolean" src="community" desc="Found in at least one community spam/abuse dataset" />
          <Field name="spam_source_count" type="integer" src="community" desc="Number of separate datasets that independently flagged this number (higher = stronger signal)" />
          <Field name="spam_sources" type="string[]" src="community" desc="Dataset IDs that flagged this number" />
          <Field name="dnc" type="boolean" src="community" desc="Community-proxy DNC flag — NOT the official FTC Do Not Call Registry (requires paid subscription)" />
          <Field name="dnc_source" type="string" src="community" desc='"community_spam_proxy" or "none"' />
          <Field name="recent_abuse" type="boolean" src="community" desc="Alias for spam — true if in community abuse datasets" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">Fraud &amp; Risk</p>
          <Field name="fraud_score" type="number" src="heuristic" desc="0–100 composite risk score. 0–29=Low, 30–59=Moderate, 60–84=High, 85–100=Critical" />
          <Field name="fraud_reasons" type="string[]" src="heuristic" desc="Detailed breakdown of each signal contributing to the fraud score" />
          <Field name="risky" type="boolean" src="heuristic" desc="True if fraud_score ≥ 75, in community abuse lists, or is a premium-rate number" />
          <Field name="pattern_flags" type="string[]" src="heuristic" desc="Structural pattern risk indicators: 555-0xxx range, repeating digits, sequential digits, high-risk area code, unassigned exchange" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">Porting / LNP</p>
          <Field name="ported_estimate" type="object" src="heuristic" desc="LNP heuristic: ported_estimate (bool), confidence (very_low), signals, disclaimer. True LNP requires live NPAC query" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">RND (Reassignment Risk)</p>
          <Field name="rnd_risk" type="object" src="heuristic" desc="Reassignment heuristic: risk_level (low/medium/high), risk_score (0-100), risk_factors, disclaimer. True RND requires FCC paid subscription" />

          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-4">Unavailable Offline</p>
          <Field name="name" type="string" src="unavailable" nullable desc="Subscriber CNAM — requires live CNAM carrier lookup" />
          <Field name="user_activity" type="string" src="unavailable" nullable desc="Activity level — requires live HLR/SS7 network query" />
          <Field name="leaked_online" type="boolean" src="unavailable" nullable desc="In data breach databases — requires HIBP or similar" />
          <Field name="reassigned" type="boolean" src="unavailable" nullable desc="Officially reassigned — requires FCC RND paid subscription (reassigned.us)" />
        </CardContent>
      </Card>

      {/* HLR / DNC / RND explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-cyan-500/20 bg-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs flex items-center gap-2 text-cyan-400">
              <Radio className="w-4 h-4" />
              HLR — WHAT IT MEANS
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground space-y-2">
            <p>Home Location Register — a database in the GSM network that stores subscriber identity (IMSI), routing (MSC/VLSI), and service data.</p>
            <p>A live HLR query (MAP-SRI over SS7) confirms whether a number is currently provisioned and reachable. This requires SS7 interconnects or a paid gateway (Infobip, HLRLOOKUP.com, etc.).</p>
            <p className="text-cyan-400/70">This platform provides a <strong>heuristic estimate</strong> based on format validity, carrier signals, and community reports.</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs flex items-center gap-2 text-amber-400">
              <PhoneOff className="w-4 h-4" />
              DNC — WHAT IT MEANS
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground space-y-2">
            <p>The FTC Do Not Call Registry (donotcall.gov) is the official US list of numbers that have opted out of telemarketing calls.</p>
            <p>The official registry is only available to paid telemarketer subscribers — no free bulk download exists. This platform uses community spam/abuse datasets as a proxy.</p>
            <p className="text-amber-400/70">Numbers in community datasets are likely DNC violators, but this is <strong>not</strong> the official FTC registry.</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-xs flex items-center gap-2 text-purple-400">
              <RotateCcw className="w-4 h-4" />
              RND — WHAT IT MEANS
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs text-muted-foreground space-y-2">
            <p>The FCC Reassigned Numbers Database (reassigned.us) tracks numbers that were disconnected and reassigned to a new subscriber.</p>
            <p>Calling a reassigned number means reaching an unintended recipient — a compliance risk (TCPA). True RND lookup requires a paid FCC subscription.</p>
            <p className="text-purple-400/70">This platform provides a <strong>heuristic risk estimate</strong> using NANPA area code exhaust data and number type signals.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
