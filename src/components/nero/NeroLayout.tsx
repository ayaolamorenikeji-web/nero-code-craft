import { useState } from "react";
import { MessageSquare, FolderOpen, Eye, Terminal, Github, LogOut, Zap, Plus, ChevronDown, Trash2, Pencil, Check, X } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { FilesPanel } from "./FilesPanel";
import { PreviewPanel } from "./PreviewPanel";
import { ConsolePanel } from "./ConsolePanel";
import { GitHubPanel } from "./GitHubPanel";
import { ShellPanel } from "./ShellPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useProject } from "@/contexts/ProjectContext";
import { motion } from "framer-motion";

type Tab = "chat" | "files" | "preview" | "console" | "github" | "shell";

const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "shell", label: "Shell", icon: Terminal },
  { id: "github", label: "GitHub", icon: Github },
];

export function NeroLayout() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [showProjects, setShowProjects] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const { signOut } = useAuth();
  const { projects, project, createNewProject, switchProject, deleteProject, renameProject } = useProject();

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const confirmRename = () => {
    if (editingId && editName.trim()) {
      renameProject(editingId, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-nero-surface border border-border flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-foreground" />
          </div>
          <button
            onClick={() => setShowProjects(!showProjects)}
            className="flex items-center gap-1 text-sm font-semibold text-foreground tracking-tight hover:opacity-80 transition-opacity"
          >
            {project?.name || "Nero AI"}
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => createNewProject()} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors" title="New project">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={signOut} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Project Switcher */}
      {showProjects && (
        <div className="border-b border-border bg-nero-surface px-4 py-2 space-y-1 max-h-48 overflow-y-auto nero-scrollbar">
          {projects.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No projects yet. Start chatting!</p>
          )}
          {projects.map((p) => (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors ${
                p.id === project?.id ? "bg-nero-tab-active text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-nero-surface-hover"
              }`}
            >
              {editingId === p.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmRename()}
                    className="flex-1 bg-nero-code-bg border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
                    autoFocus
                  />
                  <button onClick={confirmRename} className="p-1 text-foreground"><Check className="w-3 h-3" /></button>
                  <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X className="w-3 h-3" /></button>
                </div>
              ) : (
                <>
                  <span
                    className="truncate cursor-pointer flex-1"
                    onClick={() => { switchProject(p.id); setShowProjects(false); }}
                  >
                    {p.name}
                  </span>
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={(e) => { e.stopPropagation(); startRename(p.id, p.name); }} className="p-1 hover:text-foreground">
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }} className="p-1 hover:text-destructive">
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className={activeTab === "chat" ? "h-full" : "hidden"}><ChatPanel /></div>
        <div className={activeTab === "files" ? "h-full" : "hidden"}><FilesPanel /></div>
        <div className={activeTab === "preview" ? "h-full" : "hidden"}><PreviewPanel /></div>
        <div className={activeTab === "console" ? "h-full" : "hidden"}><ConsolePanel /></div>
        <div className={activeTab === "github" ? "h-full" : "hidden"}><GitHubPanel /></div>
        <div className={activeTab === "shell" ? "h-full" : "hidden"}><ShellPanel /></div>
      </div>

      {/* Tab Bar */}
      <nav className="flex items-center justify-around border-t border-border bg-background flex-shrink-0 pb-safe">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 transition-colors ${isActive ? "text-foreground" : "text-muted-foreground"}`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && <motion.div layoutId="tab-indicator" className="w-1 h-1 rounded-full bg-foreground mt-0.5" />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
