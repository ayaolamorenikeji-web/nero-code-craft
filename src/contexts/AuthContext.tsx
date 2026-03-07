import { createContext, useContext, useState, ReactNode } from "react";

interface User {
  email: string;
  user_metadata?: {
    user_name?: string;
  };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string) => void;
  signOut: () => void;
  githubToken: string | null;
  setGithubToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  const signIn = (email: string) => {
    setUser({ email, user_metadata: { user_name: email.split("@")[0] } });
  };

  const signOut = () => {
    setUser(null);
    setGithubToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, githubToken, setGithubToken }}>
      {children}
    </AuthContext.Provider>
  );
}
