import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Database, CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiBaseUrl } from '@/lib/api';

interface DataSource {
  id: string;
  label: string;
  url: string;
  filename: string;
  present: boolean;
  size_bytes: number;
  last_downloaded: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString();
}

function ageWarning(iso: string | null): boolean {
  if (!iso) return true;
  const d = new Date(iso);
  const ageMs = Date.now() - d.getTime();
  return ageMs > 7 * 24 * 60 * 60 * 1000; // older than 7 days
}

export function Sources() {
  const { data: sources, isLoading, refetch, isFetching } = useQuery<DataSource[]>({
    queryKey: ['phone-sources'],
    queryFn: async () => {
      const resp = await fetch(`${getApiBaseUrl()}/phone/sources`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.json();
    },
    refetchInterval: false,
  });

  const allPresent = sources?.every(s => s.present) ?? false;
  const somePresent = sources?.some(s => s.present) ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="w-7 h-7 text-primary" />
          <h1 className="text-2xl font-mono font-bold tracking-tight">DATA_SOURCES</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="font-mono gap-2 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          REFRESH
        </Button>
      </div>

      {/* Overall status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card/50">
          <CardContent className="py-4">
            <p className="font-mono text-xs text-muted-foreground mb-1">TOTAL_SOURCES</p>
            <p className="font-mono text-2xl font-bold">{isLoading ? <Skeleton className="h-8 w-8" /> : (sources?.length ?? 0)}</p>
          </CardContent>
        </Card>
        <Card className={`border-${allPresent ? 'green' : 'amber'}-500/30 bg-${allPresent ? 'green' : 'amber'}-500/5`}>
          <CardContent className="py-4">
            <p className="font-mono text-xs text-muted-foreground mb-1">PRESENT</p>
            <p className={`font-mono text-2xl font-bold ${allPresent ? 'text-green-400' : 'text-amber-400'}`}>
              {isLoading ? <Skeleton className="h-8 w-8" /> : (sources?.filter(s => s.present).length ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card/50">
          <CardContent className="py-4">
            <p className="font-mono text-xs text-muted-foreground mb-1">TOTAL_SIZE</p>
            <p className="font-mono text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-8" /> : formatBytes(sources?.reduce((a, s) => a + s.size_bytes, 0) ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data source cards */}
      <div className="space-y-3">
        {isLoading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-28" />)
        ) : sources?.map(source => (
          <Card key={source.id} className={`border-${source.present ? 'border' : 'red-500/30 bg-red-500/5'}`}>
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {source.present ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{source.label}</span>
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] ${source.present ? 'text-green-400 border-green-500/30' : 'text-red-400 border-red-500/30'}`}
                      >
                        {source.present ? 'PRESENT' : 'MISSING'}
                      </Badge>
                      {source.present && ageWarning(source.last_downloaded) && (
                        <Badge variant="outline" className="font-mono text-[10px] text-amber-400 border-amber-500/30">
                          STALE &gt;7d
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{source.filename}</p>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 w-fit"
                      onClick={e => e.stopPropagation()}
                    >
                      {source.url.replace('https://raw.githubusercontent.com/', 'github:')}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
                <div className="text-right space-y-1 shrink-0">
                  <p className="font-mono text-xs text-muted-foreground">
                    {source.present ? formatBytes(source.size_bytes) : '—'}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    Last downloaded:<br />
                    <span className={ageWarning(source.last_downloaded) ? 'text-amber-400' : 'text-foreground'}>
                      {formatDate(source.last_downloaded)}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Update instructions */}
      <Card className="border-border/50 bg-card/30">
        <CardHeader>
          <CardTitle className="font-mono text-sm text-muted-foreground">HOW_TO_UPDATE</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-mono text-xs text-muted-foreground">
            Community spam datasets are stored locally on the server. Re-download with:
          </p>
          <div className="bg-black/60 rounded p-3 font-mono text-xs text-green-400 space-y-1">
            <p><span className="text-muted-foreground"># Download missing datasets</span></p>
            <p>python phone-tool/phone_tool.py --update</p>
            <p className="mt-2"><span className="text-muted-foreground"># Force re-download all (refresh stale data)</span></p>
            <p>python phone-tool/phone_tool.py --update --force</p>
          </div>
          <div className="pt-2 space-y-1">
            <p className="font-mono text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">What each source covers</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              <div className="bg-muted/20 rounded p-3 font-mono text-xs space-y-1">
                <p className="text-foreground font-semibold">jwoertink/blocked-numbers</p>
                <p className="text-muted-foreground">Community-maintained blocklist of known spam/robocall numbers. CSV format.</p>
              </div>
              <div className="bg-muted/20 rounded p-3 font-mono text-xs space-y-1">
                <p className="text-foreground font-semibold">Oros42/phone-blacklist</p>
                <p className="text-muted-foreground">International phone blacklist maintained by Oros42. CSV format with E.164 numbers.</p>
              </div>
            </div>
          </div>
          <div className="pt-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded font-mono text-xs text-amber-400 space-y-1">
            <p className="font-semibold">⚠ DNC &amp; RND Limitations</p>
            <p className="text-muted-foreground">
              The official FTC Do Not Call Registry (donotcall.gov) has no free bulk download —
              paid telemarketer access only. The FCC Reassigned Numbers Database (reassigned.us)
              requires a paid subscription. Community datasets are used as proxies; they are real
              data but not the official registries.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
