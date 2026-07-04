import { useState } from 'react';
import { useListApiKeys, usePhoneLookup, getPhoneLookupQueryKey } from '@workspace/api-client-react';
import { setApiKey } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, X } from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────

function ValidBadge({ value }: { value: boolean }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
      value ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
    }`}>
      {value ? 'YES' : 'NO'}
    </span>
  );
}

function RiskBadge({ value }: { value: boolean }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
      value ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
    }`}>
      {value ? 'YES' : 'NO'}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const cls =
    score < 30 ? 'text-green-400 bg-green-500/10 border-green-500/20' :
    score < 60 ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                 'text-red-400 bg-red-500/10 border-red-500/20';
  return (
    <span className={`inline-flex items-baseline gap-1 px-2 py-0.5 rounded border font-mono font-bold text-sm ${cls}`}>
      {score}
      <span className="text-[10px] font-normal opacity-50">/100</span>
    </span>
  );
}

/** Best-effort carrier label: real carrier → VoIP provider → carrier_type classification */
function resolveCarrier(data: any): string {
  // 1. Real carrier from phonenumbers library (works for intl numbers)
  if (data.carrier) return data.carrier;

  // 2. VoIP/CPaaS provider embedded in line_type (e.g. "VoIP (Bandwidth)")
  if (data.line_type && data.line_type.startsWith('VoIP (')) {
    const match = data.line_type.match(/VoIP \((.+?)\)/);
    if (match) return match[1]; // e.g. "Bandwidth", "Twilio"
  }

  // 3. Carrier type classification (Mobile, Wireline, Toll-Free, etc.)
  const ct = data.carrier_type?.type;
  if (ct && ct !== 'Unknown') return ct;

  return '—';
}

/** Clean line type label — strip the parenthetical CPaaS name (shown in Carrier already) */
function resolveLineType(data: any): string {
  const lt = data.line_type || '—';
  // "VoIP (CPaaS block)" → "VoIP"
  if (lt.startsWith('VoIP')) return 'VoIP';
  return lt;
}

// ── per-row component ──────────────────────────────────────────────────────

function LookupRow({ number, onRemove }: { number: string; onRemove: () => void }) {
  const { data, isError, isFetching } = usePhoneLookup(
    { number },
    { query: { queryKey: getPhoneLookupQueryKey({ number }), enabled: true, retry: false } }
  );

  return (
    <tr className="border-b border-border/30 hover:bg-muted/10 transition-colors group">
      <td className="px-4 py-3 font-mono text-sm whitespace-nowrap">{number}</td>

      {isFetching ? (
        <td colSpan={8} className="px-4 py-3">
          <span className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
          </span>
        </td>
      ) : isError || !data ? (
        <td colSpan={8} className="px-4 py-3">
          <span className="font-mono text-xs text-destructive">
            {isError ? 'Lookup failed — check the number format (use E.164, e.g. +14155552671)' : '—'}
          </span>
        </td>
      ) : (
        <>
          <td className="px-4 py-3 font-mono text-sm">{data.country || '—'}</td>
          <td className="px-4 py-3"><ValidBadge value={data.valid} /></td>
          <td className="px-4 py-3"><RiskBadge value={data.risky} /></td>
          <td className="px-4 py-3"><ScorePill score={data.fraud_score ?? 0} /></td>
          <td className="px-4 py-3 font-mono text-sm text-foreground/80">{resolveCarrier(data)}</td>
          <td className="px-4 py-3 font-mono text-sm text-foreground/80">{resolveLineType(data)}</td>
          <td className="px-4 py-3"><RiskBadge value={data.dnc} /></td>
        </>
      )}

      <td className="px-2 py-3">
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          title="Remove"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ── main page ─────────────────────────────────────────────────────────────

export function Lookup() {
  const { data: keys } = useListApiKeys();
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<string[]>([]);

  const activeKey = keys?.find(k => k.active);

  // Set the API key header whenever keys load
  if (activeKey?.key) setApiKey(activeKey.key);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const number = input.trim();
    if (!number || !activeKey) return;
    if (!rows.includes(number)) setRows(prev => [number, ...prev]);
    setInput('');
  };

  return (
    <div className="space-y-5">
      {/* Search */}
      <form onSubmit={handleSubmit} className="flex gap-3 max-w-lg">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="+14155552671  or  +447911123456"
          className="font-mono bg-background focus-visible:ring-primary"
          autoFocus
        />
        <Button type="submit" disabled={!input.trim() || !activeKey} className="gap-2 font-mono shrink-0">
          <Search className="w-4 h-4" />
          Look Up
        </Button>
      </form>

      {!activeKey && keys !== undefined && (
        <p className="font-mono text-xs text-amber-400">
          No active API key — go to <a href="/keys" className="underline">Keys</a> and create one first.
        </p>
      )}

      {/* Results table */}
      {rows.length > 0 ? (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Phone', 'Country', 'Valid', 'Risky', 'Fraud Score', 'Carrier', 'Line Type', 'Do Not Call', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] text-muted-foreground tracking-widest uppercase whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(number => (
                <LookupRow
                  key={number}
                  number={number}
                  onRemove={() => setRows(prev => prev.filter(r => r !== number))}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-border text-muted-foreground">
          <p className="font-mono text-sm">Enter a number above — E.164 format, e.g. +14155552671</p>
        </div>
      )}

      <p className="font-mono text-[10px] text-muted-foreground/50">
        Carrier: real carrier name for international numbers · VoIP provider for CPaaS blocks · "Mobile" / "Wireline" for US numbers (LNP prevents offline carrier ID)
      </p>
    </div>
  );
}
