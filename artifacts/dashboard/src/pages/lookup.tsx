import { useState } from 'react';
import { useListApiKeys, usePhoneLookup, getPhoneLookupQueryKey } from '@workspace/api-client-react';
import { setApiKey } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ShieldAlert, Globe, RadioTower, CheckCircle2, AlertTriangle, AlertCircle, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function Lookup() {
  const { data: keys } = useListApiKeys();
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [trigger, setTrigger] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');

  const handleKeySelect = (val: string) => {
    setSelectedKey(val);
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey || !phone) return;
    const keyRecord = keys?.find(k => k.id.toString() === selectedKey);
    if (keyRecord && keyRecord.key) {
      setApiKey(keyRecord.key);
    }
    setLookupPhone(phone);
    setTrigger(true);
  };

  const { data: result, isError, error, isFetching } = usePhoneLookup(
    { number: lookupPhone },
    { query: { queryKey: getPhoneLookupQueryKey({ number: lookupPhone }), enabled: !!lookupPhone && trigger, retry: false } }
  );

  const activeKeys = keys?.filter(k => k.active) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Search className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-mono font-bold tracking-tight">LOOKUP_TESTER</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-border bg-card/50 h-fit">
          <CardHeader>
            <CardTitle className="font-mono text-sm">PARAMETERS</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="space-y-6">
              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground">API_KEY</Label>
                <Select value={selectedKey} onValueChange={handleKeySelect}>
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Select a key..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeKeys.map(k => (
                      <SelectItem key={k.id} value={k.id.toString()} className="font-mono">
                        {k.label} (ID:{k.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground">TARGET_NUMBER (E.164)</Label>
                <Input 
                  placeholder="+1234567890" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="font-mono bg-background focus-visible:ring-primary"
                />
              </div>
              <Button type="submit" disabled={!selectedKey || !phone || isFetching} className="w-full font-mono gap-2">
                <Search className="w-4 h-4" />
                {isFetching ? 'EXECUTING...' : 'RUN_QUERY'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {!trigger ? (
            <Card className="h-full min-h-[300px] flex items-center justify-center border-dashed border-border bg-transparent">
              <div className="text-center space-y-2 text-muted-foreground">
                <Terminal className="w-12 h-12 mx-auto opacity-20" />
                <p className="font-mono text-sm">AWAITING_INPUT</p>
              </div>
            </Card>
          ) : isFetching ? (
             <Card className="h-full min-h-[300px] flex items-center justify-center border-primary/30 bg-primary/5">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
                <p className="font-mono text-sm text-primary animate-pulse">ANALYZING_TARGET...</p>
              </div>
            </Card>
          ) : isError ? (
            <Card className="h-full min-h-[300px] flex items-center justify-center border-destructive bg-destructive/5">
              <div className="text-center space-y-2 text-destructive">
                <AlertTriangle className="w-12 h-12 mx-auto" />
                <p className="font-mono text-sm">QUERY_FAILED</p>
                <p className="text-xs max-w-sm font-mono opacity-80">{(error as any)?.data?.error || (error as Error).message || 'Unknown error'}</p>
              </div>
            </Card>
          ) : result ? (
            <ResultDisplay result={result} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Data source badges ────────────────────────────────────────────────────
type Src = 'lib' | 'community' | 'heuristic' | 'unavailable';

function SrcBadge({ src }: { src: Src }) {
  const map: Record<Src, { label: string; cls: string }> = {
    lib:         { label: 'phonenumbers',   cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    community:   { label: 'community data', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    heuristic:   { label: 'heuristic',      cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    unavailable: { label: 'needs live API', cls: 'bg-muted/40 text-muted-foreground border-border/50' },
  };
  const { label, cls } = map[src];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// ─── Boolean value renderers ────────────────────────────────────────────────
function GoodBool({ value }: { value: boolean }) {
  // green=true is good (valid, active)
  return value
    ? <span className="text-green-400 font-mono font-semibold">true</span>
    : <span className="text-foreground/60 font-mono font-semibold">false</span>;
}

function RiskBool({ value }: { value: boolean | null }) {
  if (value === null || value === undefined) return <UnavailableVal />;
  return value
    ? <span className="text-red-400 font-mono font-semibold">true</span>
    : <span className="text-green-400 font-mono font-semibold">false</span>;
}

function UnavailableVal({ note }: { note?: string }) {
  return (
    <span className="font-mono text-sm text-muted-foreground/60 italic">
      N/A{note ? ` — ${note}` : ''}
    </span>
  );
}

// ─── Table row ─────────────────────────────────────────────────────────────
function Row({
  label, src, children, note,
}: {
  label: string;
  src: Src;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] py-2.5 px-4 gap-3 border-b border-border/30 last:border-0">
      <div className="flex flex-col gap-1 pt-0.5">
        <span className="font-mono text-xs text-foreground/70">{label}:</span>
        <SrcBadge src={src} />
      </div>
      <div className="flex flex-col gap-1 justify-center">
        {children}
        {note && <p className="text-[11px] text-muted-foreground leading-relaxed">{note}</p>}
      </div>
    </div>
  );
}

// ─── Main result display ────────────────────────────────────────────────────
function ResultDisplay({ result }: { result: any }) {
  const score: number = result.fraud_score ?? 0;
  const scoreColor = score < 30 ? 'text-green-400' : score < 60 ? 'text-yellow-400' : 'text-red-400';
  const scoreBg    = score < 30 ? 'bg-green-400'  : score < 60 ? 'bg-yellow-400'  : 'bg-red-500';
  const scoreLabel = score < 30 ? 'LOW RISK' : score < 60 ? 'MODERATE' : score < 85 ? 'HIGH RISK' : 'CRITICAL';

  const reasons: string[]     = result.fraud_reasons    ?? [];
  const patterns: string[]    = result.pattern_flags    ?? [];
  const timezones: string[]   = result.timezones        ?? [];
  const emails: string[]      = result.associated_emails ?? [];

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* ── Header ── */}
      <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          INTELLIGENCE_REPORT
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-mono text-xs ${result.valid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
            {result.valid ? 'VALID' : 'INVALID'}
          </Badge>
        </div>
      </div>

      <CardContent className="p-0">
        {/* ── Fraud Score gauge ── */}
        <div className="px-5 py-4 border-b border-border/40 bg-black/30">
          <div className="flex items-end justify-between mb-2">
            <span className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Fraud Score
              <SrcBadge src="heuristic" />
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`font-mono text-3xl font-bold ${scoreColor}`}>{score}</span>
              <span className="text-muted-foreground text-sm font-mono">/100</span>
              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${scoreColor} border border-current/30`}>{scoreLabel}</span>
            </div>
          </div>
          <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
            <div className={`h-full ${scoreBg} rounded-full transition-all duration-1000`} style={{ width: `${score}%` }} />
          </div>
          {/* Score breakdown */}
          {reasons.length > 0 && (
            <details className="mt-3 group">
              <summary className="font-mono text-[11px] text-muted-foreground cursor-pointer select-none hover:text-foreground/70 transition-colors">
                ▶ Score breakdown ({reasons.length} factor{reasons.length !== 1 ? 's' : ''})
              </summary>
              <ul className="mt-2 space-y-1">
                {reasons.map((r, i) => (
                  <li key={i} className="font-mono text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary/50 mt-px">·</span>{r}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* ── Field table ── */}
        <div className="text-sm">

          {/* ── Section: Core Validity ── */}
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Core Validity</span>
          </div>

          <Row label="Valid" src="lib">
            <GoodBool value={result.valid} />
          </Row>

          <Row label="Active"  src="heuristic"
            note="Best-effort estimate: valid format + not in community abuse lists. A live HLR query is required to confirm reachability.">
            <GoodBool value={result.active} />
          </Row>

          <Row label="Reassigned" src="unavailable"
            note="Requires FCC Reassigned Numbers Database subscription (reassigned.us). Cannot determine offline.">
            <UnavailableVal />
          </Row>

          {/* ── Section: Line & Carrier ── */}
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Line &amp; Carrier</span>
          </div>

          <Row label="Line Type" src="lib">
            <span className="font-mono text-sm text-foreground">{result.line_type || 'Unknown'}</span>
          </Row>

          <Row label="VOIP" src="lib">
            <RiskBool value={result.voip} />
          </Row>

          <Row label="Carrier" src="lib"
            note={!result.carrier ? 'US mobile carrier is not detectable from the number alone due to NANP number portability. A live portability query is required.' : undefined}>
            <span className="font-mono text-sm text-foreground">{result.carrier || <UnavailableVal note="US mobile portability" />}</span>
          </Row>

          <Row label="Prepaid" src="heuristic"
            note="Heuristic: carrier name matched against known prepaid brand keywords.">
            <RiskBool value={result.prepaid} />
          </Row>

          {/* ── Section: Geography ── */}
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Geography</span>
          </div>

          <Row label="Country" src="lib">
            <span className="font-mono text-sm text-foreground flex items-center gap-2">
              {result.country || <UnavailableVal />}
              {result.country === 'US' && <Globe className="w-3.5 h-3.5 text-muted-foreground" />}
            </span>
          </Row>

          <Row label="City" src="lib">
            <span className="font-mono text-sm text-foreground">{result.city || <UnavailableVal />}</span>
          </Row>

          <Row label="Region" src="lib">
            <span className="font-mono text-sm text-foreground">{result.region || <UnavailableVal />}</span>
          </Row>

          <Row label="Timezones" src="lib">
            {timezones.length > 0
              ? <span className="font-mono text-sm text-foreground">{timezones.join(', ')}</span>
              : <UnavailableVal />}
          </Row>

          {/* ── Section: Abuse & Fraud ── */}
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Abuse &amp; Fraud</span>
          </div>

          <Row label="Recent Abuse" src="community"
            note="True if this number appears in community-maintained spam/abuse report datasets.">
            <RiskBool value={result.recent_abuse} />
          </Row>

          <Row label="Spammer" src="community"
            note="True if this number appears in community spam report datasets.">
            <RiskBool value={result.spammer} />
          </Row>

          <Row label="Risky" src="heuristic"
            note="Composite flag: true if fraud_score ≥ 75, in community abuse lists, or is a premium-rate/high-risk area code.">
            <RiskBool value={result.risky} />
          </Row>

          <Row label="Do Not Call" src="community"
            note={`Community proxy — numbers reported in abuse datasets are likely DNC violators. ${result.dnc_source === 'community_spam_proxy' ? 'Source: community spam reports.' : 'Not found in community reports.'} The official FTC Do Not Call Registry requires a paid subscription.`}>
            <RiskBool value={result.dnc} />
          </Row>

          <Row label="Leaked Online" src="unavailable"
            note="Requires access to a breach/leak database (e.g. HaveIBeenPwned phone search). Cannot determine offline.">
            <UnavailableVal />
          </Row>

          {/* Pattern flags */}
          {patterns.length > 0 && (
            <Row label="Pattern Flags" src="heuristic">
              <div className="flex flex-wrap gap-1.5">
                {patterns.map((p, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px]">
                    {p}
                  </span>
                ))}
              </div>
            </Row>
          )}

          {/* ── Section: Subscriber Data ── */}
          <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">Subscriber Data</span>
          </div>

          <Row label="Name" src="unavailable"
            note="Requires a live CNAM (Caller Name) carrier database lookup. Offline CNAM is not available.">
            <UnavailableVal />
          </Row>

          <Row label="Associated Emails" src="unavailable"
            note="Requires a data enrichment service to correlate phone numbers with email addresses.">
            {emails.length > 0
              ? <span className="font-mono text-sm">{emails.join(', ')}</span>
              : <UnavailableVal note="no enrichment service" />}
          </Row>

          <Row label="User Activity" src="unavailable"
            note="Requires a live HLR (Home Location Register) or SS7 network query to measure activity status.">
            <UnavailableVal note="requires live HLR" />
          </Row>

        </div>
      </CardContent>
    </Card>
  );
}
