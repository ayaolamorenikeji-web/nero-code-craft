import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) signIn(email.trim());
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm flex flex-col items-center gap-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nero-surface flex items-center justify-center border border-border">
            <Zap className="w-5 h-5 text-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Nero AI
          </h1>
        </div>

        <p className="text-muted-foreground text-center text-sm leading-relaxed">
          AI-powered code assistant. Generate apps, preview live, and push to GitHub.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email to start"
            required
            className="w-full h-12 rounded-lg bg-nero-surface border border-border px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 h-12 rounded-lg bg-foreground text-background font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <ArrowRight className="w-5 h-5" />
            Get Started
          </button>
        </form>

        <p className="text-xs text-muted-foreground text-center">
          You can connect your GitHub token later to push code.
        </p>
      </motion.div>
    </div>
  );
}
