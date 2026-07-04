import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Gate({ children }: { children: React.ReactNode }) {
  const { isAuth, login } = useAuth();
  const [inputVal, setInputVal] = useState('');

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background p-4 relative z-10">
      <div className="w-full max-w-sm space-y-6 bg-card p-8 border border-border shadow-2xl rounded-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">SYSTEM_ACCESS</h1>
          <p className="text-sm text-muted-foreground font-mono">ENTER ADMIN SECRET</p>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          if (inputVal) {
            login(inputVal);
          }
        }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="secret" className="sr-only">Secret</Label>
            <Input 
              id="secret" 
              type="password" 
              value={inputVal} 
              onChange={e => setInputVal(e.target.value)} 
              placeholder="••••••••••••"
              className="font-mono bg-background text-center text-lg border-primary/30 focus-visible:ring-primary/50"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full font-mono font-bold tracking-wider">
            AUTHENTICATE
          </Button>
        </form>
      </div>
    </div>
  );
}
