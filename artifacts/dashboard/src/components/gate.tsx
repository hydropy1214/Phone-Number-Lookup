import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Terminal } from 'lucide-react';
import { getApiBaseUrl, setApiKey } from '@/lib/api';

interface SetupInfo {
  admin_secret: string | null;
  default_api_key: string | null;
  keys_count: number;
}

export function Gate({ children }: { children: React.ReactNode }) {
  const { isAuth, login } = useAuth();
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(!isAuth);
  const [setupInfo, setSetupInfo] = useState<SetupInfo | null>(null);
  const [fetchError, setFetchError] = useState(false);

  // Always refresh credentials from the server on mount, even if already authenticated.
  // This keeps the stored API key and admin secret in sync after server restarts.
  useEffect(() => {
    const base = getApiBaseUrl();
    fetch(`${base}/setup`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((info: SetupInfo) => {
        setSetupInfo(info);
        if (info.admin_secret) {
          login(info.admin_secret);
        }
        if (info.default_api_key) {
          setApiKey(info.default_api_key);
        }
      })
      .catch(() => {
        if (!isAuth) setFetchError(true);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isAuth) return <>{children}</>;

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Terminal className="w-8 h-8 text-primary mx-auto" />
          <p className="font-mono text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Connecting to server...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative z-10">
      <div className="w-full max-w-sm space-y-6 bg-card p-8 border border-border shadow-2xl rounded-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
        <div className="space-y-2 text-center">
          <Terminal className="w-7 h-7 text-primary mx-auto" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">PHONE_INTEL</h1>
          <p className="text-sm text-muted-foreground font-mono">ENTER ADMIN SECRET</p>
        </div>

        {setupInfo?.admin_secret && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
            <p className="font-mono text-[10px] text-primary uppercase tracking-widest">Auto-detected secret</p>
            <code className="font-mono text-xs text-foreground break-all block">{setupInfo.admin_secret}</code>
            <Button size="sm" className="w-full font-mono text-xs" onClick={() => login(setupInfo.admin_secret!)}>
              USE THIS SECRET
            </Button>
          </div>
        )}

        {fetchError && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded p-2">
            <p className="font-mono text-[10px] text-amber-400">
              Could not reach API server. Ensure the API Server workflow is running, then refresh.
            </p>
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); if (inputVal) login(inputVal); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secret" className="sr-only">Secret</Label>
            <Input
              id="secret"
              type="password"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="••••••••••••"
              className="font-mono bg-background text-center text-lg border-primary/30 focus-visible:ring-primary/50"
              autoFocus={!setupInfo}
            />
          </div>
          <Button type="submit" className="w-full font-mono font-bold tracking-wider">AUTHENTICATE</Button>
        </form>
      </div>
    </div>
  );
}
