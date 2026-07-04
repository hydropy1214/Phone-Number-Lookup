import { useState } from 'react';
import { useListApiKeys, usePhoneLookup, getPhoneLookupQueryKey } from '@workspace/api-client-react';
import { setApiKey } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, X } from 'lucide-react';

interface Row {
  phone: string;
  country: string;
  valid: boolean;
  risky: boolean;
  fraud_score: number;
  carrier: string;
  line_type: string;
  dnc: boolean;
}

function Badge({ value, risk = false }: { value: boolean; risk?: boolean }) {
  const isRed = risk ? value : !value;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
      isRed ? 'bg-red-500/15 text-red-400' : 'bg-green-500/15 text-green-400'
    }`}>
      {value ? 'YES' : 'NO'}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score < 30 ? 'text-green-400 bg-green-500/10' : score < 60 ? 'text-yellow-400 bg-yellow-500/10' : 'text-red-400 bg-red-500/10';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-sm font-bold ${color}`}>
      {score}
      <span className="text-[10px] font-normal opacity-60">/100</span>
    </span>
  );
}

// A tiny hook that fires a single lookup query for one number
function useSingleLookup(number: string, enabled: boolean) {
  return usePhoneLookup(
    { number },
    { query: { queryKey: getPhoneLookupQueryKey({ number }), enabled, retry: false } }
  );
}

function LookupRow({ number, onRemove }: { number: string; onRemove: () => void }) {
  const { data, isError, isFetching } = useSingleLookup(number, true);

  return (
    <tr className="border-b border-border/30 hover:bg-muted/10 transition-colors group">
      <td className="px-4 py-3 font-mono text-sm text-foreground whitespace-nowrap">{number}</td>

      {isFetching ? (
        <td colSpan={7} className="px-4 py-3">
          <span className="flex items-center gap-2 text-muted-foreground font-mono text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...
          </span>
        </td>
      ) : isError || !data ? (
        <td colSpan={7} className="px-4 py-3">
          <span className="font-mono text-xs text-destructive">Lookup failed</span>
        </td>
      ) : (
        <>
          <td className="px-4 py-3 font-mono text-sm">{data.country || '—'}</td>
          <td className="px-4 py-3"><Badge value={data.valid} /></td>
          <td className="px-4 py-3"><Badge value={data.risky} risk /></td>
          <td className="px-4 py-3"><ScorePill score={data.fraud_score ?? 0} /></td>
          <td className="px-4 py-3 font-mono text-sm text-foreground/80">{data.carrier || '—'}</td>
          <td className="px-4 py-3 font-mono text-sm text-foreground/80">{data.line_type || '—'}</td>
          <td className="px-4 py-3"><Badge value={data.dnc} risk /></td>
        </>
      )}

      <td className="px-2 py-3 text-right">
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}

export function Lookup() {
  const { data: keys } = useListApiKeys();
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<string[]>([]);

  const activeKey = keys?.find(k => k.active);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const number = input.trim();
    if (!number) return;
    if (activeKey?.key) setApiKey(activeKey.key);
    if (!rows.includes(number)) setRows(prev => [number, ...prev]);
    setInput('');
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-3 max-w-xl">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="+14155552671"
          className="font-mono bg-background focus-visible:ring-primary"
          autoFocus
        />
        <Button type="submit" disabled={!input.trim() || !activeKey} className="gap-2 font-mono shrink-0">
          <Search className="w-4 h-4" />
          Look Up
        </Button>
      </form>

      {!activeKey && (
        <p className="font-mono text-xs text-amber-400">No active API key found — create one in Keys first.</p>
      )}

      {/* Results table */}
      {rows.length > 0 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                {['Phone', 'Country', 'Valid', 'Risky', 'Fraud Score', 'Carrier', 'Line Type', 'Do Not Call', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-mono text-[11px] text-muted-foreground tracking-widest uppercase whitespace-nowrap">
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
      )}

      {rows.length === 0 && (
        <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-border text-muted-foreground">
          <p className="font-mono text-sm">Enter a number above to begin</p>
        </div>
      )}
    </div>
  );
}
