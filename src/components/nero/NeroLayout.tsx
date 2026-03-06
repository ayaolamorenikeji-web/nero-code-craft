import { useState } from "react";
import { MessageSquare, FolderOpen, Eye, Terminal, Github, LogOut, Zap } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { FilesPanel } from "./FilesPanel";
import { PreviewPanel } from "./PreviewPanel";
import { ConsolePanel } from "./ConsolePanel";
import { GitHubPanel } from "./GitHubPanel";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";

type Tab = "chat" | "files" | "preview" | "console" | "github";

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "console", label: "Console", icon: Terminal },
  { id: "github", label: "GitHub", icon: Github },
];

export function NeroLayout() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const { user, signOut } = useAuth();

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-nero-surface border border-border flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground tracking-tight">Nero AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {user?.user_metadata?.user_name || user?.email}
          </span>
          <button
            onClick={signOut}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === "chat" && <ChatPanel />}
            {activeTab === "files" && <FilesPanel />}
            {activeTab === "preview" && <PreviewPanel />}
            {activeTab === "console" && <ConsolePanel />}
            {activeTab === "github" && <GitHubPanel />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tab Bar */}
      <nav className="flex items-center justify-around border-t border-border bg-background flex-shrink-0 pb-safe">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 transition-colors ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="w-1 h-1 rounded-full bg-foreground mt-0.5"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
