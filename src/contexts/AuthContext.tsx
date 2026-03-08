import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface User {
  email: string;
  user_metadata?: { user_name?: string };
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
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("nero-user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [loading] = useState(false);
  const [githubToken, setGithubTokenState] = useState<string | null>(
    () => localStorage.getItem("nero-github-token")
  );

  useEffect(() => {
    if (user) localStorage.setItem("nero-user", JSON.stringify(user));
    else localStorage.removeItem("nero-user");
  }, [user]);

  useEffect(() => {
    if (githubToken) localStorage.setItem("nero-github-token", githubToken);
    else localStorage.removeItem("nero-github-token");
  }, [githubToken]);

  const signIn = (email: string) => {
    setUser({ email, user_metadata: { user_name: email.split("@")[0] } });
  };

  const signOut = () => {
    setUser(null);
    setGithubTokenState(null);
  };

  const setGithubToken = (token: string | null) => setGithubTokenState(token);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, githubToken, setGithubToken }}>
      {children}
    </AuthContext.Provider>
  );
}
