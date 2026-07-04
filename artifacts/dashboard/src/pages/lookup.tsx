import { useState } from 'react';
import { useListApiKeys, usePhoneLookup, getPhoneLookupQueryKey } from '@workspace/api-client-react';
import { setApiKey } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Search, ShieldAlert, Globe, CheckCircle2, AlertTriangle, Terminal,
  Radio, PhoneOff, RotateCcw, Zap, Signal, Info,
} from 'lucide-react';

export function Lookup() {
  const { data: keys } = useListApiKeys();
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [trigger, setTrigger] = useState(false);
  const [lookupPhone, setLookupPhone] = useState('');

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey || !phone) return;
    const keyRecord = keys?.find(k => k.id.toString() === selectedKey);
    if (keyRecord?.key) setApiKey(keyRecord.key);
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
        <Search className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-mono font-bold tracking-tight">LOOKUP</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-border bg-card/50 h-fit">
          <CardHeader>
            <CardTitle className="font-mono text-sm">PARAMETERS</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLookup} className="space-y-5">
              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground">API_KEY</Label>
                <Select value={selectedKey} onValueChange={setSelectedKey}>
                  <SelectTrigger className="font-mono text-sm">
                    <SelectValue placeholder="Select a key..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeKeys.map(k => (
                      <SelectItem key={k.id} value={k.id.toString()} className="font-mono text-sm">
                        {k.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs text-muted-foreground">TARGET_NUMBER</Label>
                <Input
                  placeholder="+14155552671"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="font-mono bg-background focus-visible:ring-primary"
                />
                <p className="font-mono text-[10px] text-muted-foreground">E.164 format preferred (e.g. +14155552671)</p>
              </div>
              <Button type="submit" disabled={!selectedKey || !phone || isFetching} className="w-full font-mono gap-2">
                <Search className="w-4 h-4" />
                {isFetching ? 'ANALYZING...' : 'RUN_LOOKUP'}
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
                <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
type Src = 'lib' | 'community' | 'heuristic' | 'unavailable';

function SrcBadge({ src }: { src: Src }) {
  const map: Record<Src, { label: string; cls: string }> = {
    lib:         { label: 'authoritative', cls: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
    community:   { label: 'community',     cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    heuristic:   { label: 'heuristic',     cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
    unavailable: { label: 'needs live API',cls: 'bg-muted/40 text-muted-foreground border-border/50' },
  };
  const { label, cls } = map[src];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[9px] font-mono tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

function GoodBool({ value }: { value: boolean }) {
  return value
    ? <span className="text-green-400 font-mono font-semibold">true</span>
    : <span className="text-foreground/60 font-mono font-semibold">false</span>;
}

function RiskBool({ value }: { value: boolean | null | undefined }) {
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

function Row({ label, src, children, note }: {
  label: string; src: Src; children: React.ReactNode; note?: string;
}) {
  return (
    <div className="grid grid-cols-[180px_1fr] py-2.5 px-4 gap-3 border-b border-border/30 last:border-0">
      <div className="flex flex-col gap-1 pt-0.5">
        <span className="font-mono text-xs text-foreground/70">{label}</span>
        <SrcBadge src={src} />
      </div>
      <div className="flex flex-col gap-1 justify-center">
        {children}
        {note && <p className="text-[11px] text-muted-foreground leading-relaxed">{note}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-2 bg-muted/20 border-b border-border/30">
      <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">{label}</span>
    </div>
  );
}

function HlrBlock({ hlr }: { hlr: any }) {
  if (!hlr) return <UnavailableVal />;
  const { reachable_estimate, confidence, signals = [], disclaimer } = hlr;
  const color = reachable_estimate ? 'text-green-400' : 'text-red-400';
  const confColor = confidence === 'very_low' || confidence === 'low' ? 'text-amber-400' : confidence === 'medium' ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Signal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className={`font-mono font-semibold text-sm ${color}`}>
          {reachable_estimate ? 'REACHABLE (est.)' : 'UNREACHABLE (est.)'}
        </span>
        <span className={`font-mono text-xs ${confColor}`}>[ {confidence} confidence ]</span>
      </div>
      {signals.length > 0 && (
        <details className="group">
          <summary className="font-mono text-[11px] text-muted-foreground cursor-pointer select-none hover:text-foreground/70">
            ▶ {signals.length} signal(s)
          </summary>
          <ul className="mt-1 space-y-0.5">
            {signals.map((s: string, i: number) => (
              <li key={i} className="font-mono text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary/40 mt-px">·</span>{s}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-[10px] text-muted-foreground/70 italic leading-relaxed">{disclaimer}</p>
    </div>
  );
}

function RndBlock({ rnd }: { rnd: any }) {
  if (!rnd) return <UnavailableVal />;
  const { risk_level, risk_score, confidence, risk_factors = [], disclaimer } = rnd;
  const color = risk_level === 'high' ? 'text-red-400' : risk_level === 'medium' ? 'text-yellow-400' : 'text-green-400';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
        <span className={`font-mono font-semibold text-sm ${color}`}>
          {risk_level?.toUpperCase()} RISK
        </span>
        {typeof risk_score === 'number' && (
          <span className="font-mono text-xs text-muted-foreground">(score: {risk_score})</span>
        )}
        <span className="font-mono text-xs text-amber-400">[ {confidence} confidence ]</span>
      </div>
      {risk_factors.length > 0 && (
        <ul className="space-y-0.5">
          {risk_factors.map((f: string, i: number) => (
            <li key={i} className="font-mono text-[11px] text-muted-foreground flex items-start gap-1.5">
              <span className="text-primary/40 mt-px">·</span>{f}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground/70 italic leading-relaxed">{disclaimer}</p>
    </div>
  );
}

function CarrierTypeBlock({ ct }: { ct: any }) {
  if (!ct) return <UnavailableVal />;
  const typeColors: Record<string, string> = {
    'MNO': 'text-blue-400', 'MVNO': 'text-cyan-400', 'VoIP/OTT': 'text-orange-400',
    'CLEC': 'text-purple-400', 'ILEC': 'text-indigo-400', 'Toll-Free': 'text-green-400',
    'Premium Rate': 'text-red-400', 'Mobile': 'text-foreground', 'Wireline': 'text-foreground',
    'Unknown': 'text-muted-foreground',
  };
  const color = typeColors[ct.type] || 'text-foreground';
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`font-mono font-semibold text-sm ${color}`}>{ct.type}</span>
        <span className="font-mono text-xs text-muted-foreground">[ {ct.confidence} ]</span>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground mt-0.5">{ct.description}</p>
    </div>
  );
}

function PortedBlock({ pe }: { pe: any }) {
  if (!pe) return <UnavailableVal />;
  const { ported_estimate, confidence, signals = [], disclaimer } = pe;
  const color = ported_estimate === true ? 'text-amber-400' : ported_estimate === false ? 'text-green-400' : 'text-muted-foreground';
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-muted-foreground" />
        <span className={`font-mono font-semibold text-sm ${color}`}>
          {ported_estimate === true ? 'POSSIBLE PORT' : ported_estimate === false ? 'UNLIKELY' : 'UNKNOWN'}
        </span>
        <span className="font-mono text-xs text-amber-400">[ {confidence} ]</span>
      </div>
      {signals.length > 0 && (
        <ul className="space-y-0.5">
          {signals.map((s: string, i: number) => (
            <li key={i} className="font-mono text-[11px] text-muted-foreground flex items-start gap-1.5">
              <span className="text-primary/40 mt-px">·</span>{s}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[10px] text-muted-foreground/70 italic leading-relaxed">{disclaimer}</p>
    </div>
  );
}

// ─── Main result display ──────────────────────────────────────────────────────
function ResultDisplay({ result }: { result: any }) {
  const score: number = result.fraud_score ?? 0;
  const scoreColor = score < 30 ? 'text-green-400' : score < 60 ? 'text-yellow-400' : 'text-red-400';
  const scoreBg    = score < 30 ? 'bg-green-400'  : score < 60 ? 'bg-yellow-400'  : 'bg-red-500';
  const scoreLabel = score < 30 ? 'LOW RISK' : score < 60 ? 'MODERATE' : score < 85 ? 'HIGH RISK' : 'CRITICAL';

  const reasons: string[]   = result.fraud_reasons ?? [];
  const patterns: string[]  = result.pattern_flags ?? [];
  const timezones: string[] = result.timezones ?? [];
  const spamSources: string[] = result.spam_sources ?? [];

  return (
    <Card className="border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 border-b border-primary/20 px-5 py-3 flex items-center justify-between">
        <h3 className="font-mono text-sm font-bold text-primary flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          INTELLIGENCE_REPORT
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`font-mono text-xs ${result.valid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
            {result.valid ? 'VALID' : 'INVALID'}
          </Badge>
          {result.possible !== undefined && !result.valid && result.possible && (
            <Badge variant="outline" className="font-mono text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">POSSIBLE</Badge>
          )}
        </div>
      </div>

      <CardContent className="p-0">
        {/* Fraud Score */}
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

        <div className="text-sm">
          {/* Core Validity */}
          <SectionHeader label="Core Validity" />
          <Row label="Valid" src="lib">
            <GoodBool value={result.valid} />
          </Row>
          <Row label="Possible" src="lib">
            <GoodBool value={result.possible} />
            <p className="text-[11px] text-muted-foreground">Looser check — number length/format is plausible for the region</p>
          </Row>
          {result.e164 && (
            <Row label="E.164" src="lib">
              <code className="font-mono text-sm text-foreground">{result.e164}</code>
            </Row>
          )}
          {result.national_format && (
            <Row label="National Format" src="lib">
              <span className="font-mono text-sm">{result.national_format}</span>
            </Row>
          )}
          {result.international_format && (
            <Row label="International" src="lib">
              <span className="font-mono text-sm">{result.international_format}</span>
            </Row>
          )}

          {/* HLR / Reachability */}
          <SectionHeader label="HLR / Reachability" />
          <Row label="HLR Status" src="heuristic">
            <HlrBlock hlr={result.hlr_status} />
          </Row>
          <Row label="Active (simple)" src="heuristic"
            note="Shorthand flag: valid format + not in abuse lists + fraud score < 60.">
            <GoodBool value={result.active} />
          </Row>

          {/* Line & Carrier */}
          <SectionHeader label="Line &amp; Carrier" />
          <Row label="Line Type" src="lib">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-foreground">{result.line_type || 'Unknown'}</span>
              {result.line_type_source === 'heuristic' && <SrcBadge src="heuristic" />}
            </div>
          </Row>
          <Row label="VoIP" src="lib">
            <RiskBool value={result.voip} />
          </Row>
          <Row label="Carrier" src="lib"
            note={!result.carrier ? 'US mobile carrier is not detectable offline due to NANP number portability (LNP).' : undefined}>
            <span className="font-mono text-sm text-foreground">
              {result.carrier || <UnavailableVal note="US mobile portability" />}
            </span>
          </Row>
          <Row label="Carrier Type" src="heuristic">
            <CarrierTypeBlock ct={result.carrier_type} />
          </Row>
          <Row label="Prepaid" src="heuristic"
            note="Heuristic: carrier name matched against known prepaid/MVNO brand keywords.">
            <RiskBool value={result.prepaid} />
          </Row>
          <Row label="Ported (LNP)" src="heuristic">
            <PortedBlock pe={result.ported_estimate} />
          </Row>

          {/* Geography */}
          <SectionHeader label="Geography" />
          <Row label="Country" src="lib">
            <span className="font-mono text-sm text-foreground flex items-center gap-2">
              {result.country || <UnavailableVal />}
              {result.country === 'US' && <Globe className="w-3.5 h-3.5 text-muted-foreground" />}
            </span>
          </Row>
          <Row label="City" src="lib">
            <span className="font-mono text-sm">{result.city || <UnavailableVal />}</span>
          </Row>
          <Row label="Region" src="lib">
            <span className="font-mono text-sm">{result.region || <UnavailableVal />}</span>
          </Row>
          <Row label="Timezones" src="lib">
            {timezones.length > 0
              ? <span className="font-mono text-sm">{timezones.join(', ')}</span>
              : <UnavailableVal />}
          </Row>

          {/* DNC & Spam */}
          <SectionHeader label="DNC &amp; Spam" />
          <Row label="Do Not Call" src="community"
            note={`Community proxy — numbers in abuse datasets are likely DNC violators. Official FTC registry requires paid subscription. Sources: ${result.dnc_source_count || 0} dataset(s).`}>
            <div className="flex items-center gap-2">
              <RiskBool value={result.dnc} />
              {result.dnc_source_count > 0 && (
                <span className="font-mono text-xs text-amber-400">({result.dnc_source_count} source{result.dnc_source_count !== 1 ? 's' : ''})</span>
              )}
            </div>
          </Row>
          <Row label="Recent Abuse" src="community"
            note="Found in community-maintained spam/abuse report datasets.">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <RiskBool value={result.recent_abuse} />
                {spamSources.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {spamSources.map((s: string) => (
                      <span key={s} className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[10px]">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Row>
          <Row label="Spammer" src="community">
            <RiskBool value={result.spammer} />
          </Row>

          {/* RND */}
          <SectionHeader label="RND / Reassignment Risk" />
          <Row label="RND Risk" src="heuristic">
            <RndBlock rnd={result.rnd_risk} />
          </Row>
          <Row label="Officially Reassigned" src="unavailable"
            note="Requires FCC Reassigned Numbers Database subscription (reassigned.us).">
            <UnavailableVal />
          </Row>

          {/* Fraud & Risk */}
          <SectionHeader label="Fraud &amp; Risk" />
          <Row label="Risky" src="heuristic"
            note="True if fraud_score ≥ 75, in community abuse lists, or is a premium-rate/high-risk number.">
            <RiskBool value={result.risky} />
          </Row>
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

          {/* Subscriber Data */}
          <SectionHeader label="Subscriber Data" />
          <Row label="Name (CNAM)" src="unavailable"
            note="Requires a live CNAM carrier database lookup. Not available offline.">
            <UnavailableVal />
          </Row>
          <Row label="User Activity" src="unavailable"
            note="Requires a live HLR/SS7 network query. Not available offline.">
            <UnavailableVal note="requires live HLR" />
          </Row>
          <Row label="Leaked Online" src="unavailable"
            note="Requires access to a breach database (e.g. HaveIBeenPwned). Not available offline.">
            <UnavailableVal />
          </Row>
        </div>

        {/* Disclaimer footer */}
        <div className="px-5 py-3 bg-muted/10 border-t border-border/30">
          <p className="font-mono text-[10px] text-muted-foreground flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            HLR, DNC, and RND fields are heuristic estimates — not live carrier or registry data.
            See <span className="text-primary">API_DOCS</span> for data source details.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
