import { useState } from 'react';
import { useListApiKeys } from '@workspace/api-client-react';
import { setApiKey } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Layers, CheckCircle2, XCircle, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/api';

interface BatchItem {
  number: string;
  result?: any;
  error?: string;
}

interface BatchResponse {
  results: BatchItem[];
  total: number;
  succeeded: number;
  failed: number;
}

export function Batch() {
  const { data: keys } = useListApiKeys();
  const [selectedKey, setSelectedKey] = useState('');
  const [numbersText, setNumbersText] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<BatchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const activeKeys = keys?.filter(k => k.active) || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKey || !numbersText.trim()) return;

    const keyRecord = keys?.find(k => k.id.toString() === selectedKey);
    if (!keyRecord?.key) return;

    const numbers = numbersText
      .split(/[\n,;]+/)
      .map(n => n.trim())
      .filter(Boolean);

    if (numbers.length === 0) {
      setError('No valid numbers found. Enter one per line or comma-separated.');
      return;
    }
    if (numbers.length > 100) {
      setError(`Too many numbers (${numbers.length}). Maximum is 100 per batch.`);
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setApiKey(keyRecord.key);

    try {
      const resp = await fetch(`${getApiBaseUrl()}/phone/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': keyRecord.key,
        },
        body: JSON.stringify({ numbers }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      const data: BatchResponse = await resp.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Batch lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!response) return;
    const rows = [
      [
        'Input', 'E.164', 'Valid', 'Possible', 'Line Type', 'Carrier', 'Carrier Type',
        'Country', 'Region', 'City', 'VoIP', 'Prepaid',
        'Fraud Score', 'Spam', 'DNC', 'HLR Reachable', 'HLR Confidence',
        'RND Risk Level', 'Ported Estimate',
        'Pattern Flags', 'Error',
      ].join(','),
      ...response.results.map(item => {
        const r = item.result;
        if (!r) return [item.number, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', item.error || ''].join(',');
        return [
          item.number,
          r.e164 || '',
          r.valid,
          r.possible,
          r.line_type,
          r.carrier || '',
          r.carrier_type?.type || '',
          r.country || '',
          r.region || '',
          r.city || '',
          r.voip,
          r.prepaid,
          r.fraud_score,
          r.spam,
          r.dnc,
          r.hlr_status?.reachable_estimate ?? '',
          r.hlr_status?.confidence || '',
          r.rnd_risk?.risk_level || '',
          r.ported_estimate?.ported_estimate ?? '',
          (r.pattern_flags || []).join(' | '),
          '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      }),
    ].join('\n');

    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phone-batch-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreColor = (s: number) => s < 30 ? 'text-green-400' : s < 60 ? 'text-yellow-400' : 'text-red-400';
  const scoreBg = (s: number) => s < 30 ? 'bg-green-400' : s < 60 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-mono font-bold tracking-tight">BATCH_LOOKUP</h1>
        <Badge variant="outline" className="font-mono text-xs">MAX 100</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-border bg-card/50 h-fit">
          <CardHeader>
            <CardTitle className="font-mono text-sm">PARAMETERS</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
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
                <Label className="font-mono text-xs text-muted-foreground">
                  NUMBERS — one per line or comma-separated (max 100)
                </Label>
                <Textarea
                  placeholder={`+14155552671\n+16505550123\n+12125551234`}
                  value={numbersText}
                  onChange={e => setNumbersText(e.target.value)}
                  className="font-mono text-xs bg-background min-h-[160px] resize-y"
                />
                <p className="font-mono text-[10px] text-muted-foreground">
                  {numbersText.split(/[\n,;]+/).filter(n => n.trim()).length} number(s) entered
                </p>
              </div>
              <Button
                type="submit"
                disabled={!selectedKey || !numbersText.trim() || loading}
                className="w-full font-mono gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {loading ? 'PROCESSING...' : 'RUN_BATCH'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {error && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="flex items-center gap-3 py-4">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <p className="font-mono text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {response && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-border bg-card/50">
                  <CardContent className="py-4 text-center">
                    <p className="font-mono text-xs text-muted-foreground mb-1">TOTAL</p>
                    <p className="font-mono text-2xl font-bold">{response.total}</p>
                  </CardContent>
                </Card>
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="py-4 text-center">
                    <p className="font-mono text-xs text-muted-foreground mb-1">SUCCEEDED</p>
                    <p className="font-mono text-2xl font-bold text-green-400">{response.succeeded}</p>
                  </CardContent>
                </Card>
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardContent className="py-4 text-center">
                    <p className="font-mono text-xs text-muted-foreground mb-1">FAILED</p>
                    <p className="font-mono text-2xl font-bold text-red-400">{response.failed}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" className="font-mono gap-2 text-xs" onClick={handleDownloadCSV}>
                  <Download className="w-3.5 h-3.5" />
                  EXPORT_CSV
                </Button>
              </div>

              {/* Results list */}
              <div className="space-y-2">
                {response.results.map((item, idx) => (
                  <Card
                    key={idx}
                    className={`border-border/50 cursor-pointer transition-colors hover:border-primary/30 ${expanded === idx ? 'border-primary/40' : ''}`}
                    onClick={() => setExpanded(expanded === idx ? null : idx)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.error ? (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        )}
                        <span className="font-mono text-sm font-medium flex-1">{item.number}</span>
                        {item.result && (
                          <>
                            <Badge
                              variant="outline"
                              className={`font-mono text-[10px] ${item.result.valid ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}`}
                            >
                              {item.result.valid ? 'VALID' : 'INVALID'}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                              {item.result.line_type}
                            </Badge>
                            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                              {item.result.carrier_type?.type || 'Unknown'}
                            </Badge>
                            <span className={`font-mono text-sm font-bold ${scoreColor(item.result.fraud_score)}`}>
                              {item.result.fraud_score}/100
                            </span>
                          </>
                        )}
                        {item.error && (
                          <span className="font-mono text-xs text-red-400">{item.error}</span>
                        )}
                      </div>

                      {expanded === idx && item.result && (
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-xs font-mono border-t border-border/30 pt-4">
                          <InfoCell label="E.164" value={item.result.e164 || 'N/A'} />
                          <InfoCell label="Country" value={item.result.country || 'N/A'} />
                          <InfoCell label="Region" value={item.result.region || 'N/A'} />
                          <InfoCell label="Carrier" value={item.result.carrier || '(portable/unknown)'} />
                          <InfoCell label="Carrier Type" value={item.result.carrier_type?.type || 'Unknown'} />
                          <InfoCell label="VoIP" value={item.result.voip ? 'YES' : 'NO'} highlight={item.result.voip} />
                          <InfoCell label="Prepaid" value={item.result.prepaid ? 'YES' : 'NO'} />
                          <InfoCell label="Spam" value={item.result.spam ? `YES (${item.result.spam_source_count} src)` : 'NO'} highlight={item.result.spam} />
                          <InfoCell label="DNC Proxy" value={item.result.dnc ? 'YES' : 'NO'} highlight={item.result.dnc} />
                          <InfoCell label="HLR Est." value={`${item.result.hlr_status?.reachable_estimate ? 'REACHABLE' : 'UNREACHABLE'} (${item.result.hlr_status?.confidence})`} />
                          <InfoCell label="RND Risk" value={item.result.rnd_risk?.risk_level?.toUpperCase() || 'N/A'} highlight={item.result.rnd_risk?.risk_level === 'high'} />
                          <InfoCell label="Ported Est." value={item.result.ported_estimate?.ported_estimate === true ? 'POSSIBLE' : item.result.ported_estimate?.ported_estimate === false ? 'UNLIKELY' : 'N/A'} />
                          {(item.result.pattern_flags || []).length > 0 && (
                            <div className="col-span-full">
                              <span className="text-muted-foreground">Pattern Flags: </span>
                              <span className="text-amber-400">{item.result.pattern_flags.join(' | ')}</span>
                            </div>
                          )}
                          {/* Fraud score bar */}
                          <div className="col-span-full mt-1">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Fraud Score:</span>
                              <span className={`font-bold ${scoreColor(item.result.fraud_score)}`}>{item.result.fraud_score}/100</span>
                              <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                <div className={`h-full ${scoreBg(item.result.fraud_score)} rounded-full`} style={{ width: `${item.result.fraud_score}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {!response && !loading && !error && (
            <Card className="min-h-[300px] flex items-center justify-center border-dashed border-border bg-transparent">
              <div className="text-center space-y-2 text-muted-foreground">
                <Layers className="w-12 h-12 mx-auto opacity-20" />
                <p className="font-mono text-sm">PASTE_NUMBERS_AND_RUN</p>
                <p className="font-mono text-xs opacity-60">Results will appear here</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className={highlight ? 'text-red-400' : 'text-foreground'}>{value}</span>
    </div>
  );
}
