import { createContext, useContext, useState } from 'react';
import { getStoredSecret, setAdminSecret as setApiSecret, clearAdminSecret as clearApiSecret } from '@/lib/api';

type AuthContextType = {
  isAuth: boolean;
  login: (secret: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState(!!getStoredSecret());

  const login = (secret: string) => {
    setApiSecret(secret);
    setIsAuth(true);
  };

  const logout = () => {
    clearApiSecret();
    setIsAuth(false);
  };

  return (
    <AuthContext.Provider value={{ isAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
