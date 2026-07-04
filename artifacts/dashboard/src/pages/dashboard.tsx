import { useHealthCheck, useListApiKeys, getHealthCheckQueryKey } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Key, Hash, Clock, Server } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function Dashboard() {
  const { data: health, isLoading: healthLoading } = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), refetchInterval: 5000 } });
  const { data: keys, isLoading: keysLoading } = useListApiKeys();

  const totalKeys = keys?.length || 0;
  const activeKeys = keys?.filter(k => k.active).length || 0;
  const totalRequests = keys?.reduce((acc, k) => acc + k.requestCount, 0) || 0;
  
  const mostRecentKey = keys && keys.length > 0 
    ? [...keys].sort((a, b) => {
        const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
        return timeB - timeA;
      })[0] 
    : null;

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-mono font-bold tracking-tight text-foreground flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          SYSTEM_OVERVIEW
        </h1>
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-muted-foreground">API_STATUS:</span>
          {healthLoading ? (
             <Skeleton className="w-16 h-5" />
          ) : (
             <span className={`px-2 py-0.5 rounded ${health?.status === 'ok' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-destructive/20 text-destructive border border-destructive/30'}`}>
               {health?.status?.toUpperCase() || 'UNKNOWN'}
             </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="TOTAL_KEYS" value={keysLoading ? null : totalKeys} icon={Key} />
        <StatCard title="ACTIVE_KEYS" value={keysLoading ? null : activeKeys} icon={Activity} highlight />
        <StatCard title="TOTAL_REQS" value={keysLoading ? null : totalRequests} icon={Hash} />
        <StatCard 
          title="LAST_USED" 
          value={keysLoading ? null : mostRecentKey?.label || 'N/A'} 
          icon={Clock} 
          subtitle={mostRecentKey?.lastUsedAt ? new Date(mostRecentKey.lastUsedAt).toLocaleString() : undefined}
        />
      </div>
      
      {/* Visual filler for "Dense, info-rich" vibe */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-8">
         <Card className="col-span-1 lg:col-span-2 bg-card border-border/50 shadow-md">
           <CardHeader className="border-b border-border/50 pb-4">
             <CardTitle className="font-mono text-sm text-muted-foreground flex items-center gap-2">
               <Server className="w-4 h-4" />
               SYSTEM_LOGS
             </CardTitle>
           </CardHeader>
           <CardContent className="p-0">
              <div className="h-64 bg-black/50 p-4 font-mono text-xs text-muted-foreground overflow-y-auto flex flex-col-reverse">
                 {keys?.slice(0, 10).map((k, i) => (
                   <div key={i} className="py-1 border-b border-white/5 opacity-80">
                     <span className="text-primary mr-2">[{k.createdAt ? new Date(k.createdAt).toISOString() : new Date().toISOString()}]</span>
                     KEY_GENERATED: <span className="text-foreground">{k.label}</span>
                   </div>
                 ))}
                 <div className="py-1 border-b border-white/5">
                   <span className="text-primary mr-2">[{new Date().toISOString()}]</span>
                   SYSTEM_INITIALIZED
                 </div>
              </div>
           </CardContent>
         </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, highlight, subtitle }: any) {
  return (
    <Card className={`border ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border'} shadow-sm`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-mono font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`w-4 h-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-mono font-bold text-foreground">
          {value === null ? <Skeleton className="h-8 w-16" /> : value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}
