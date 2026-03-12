import { useState, useRef, useEffect } from "react";
import { useNeroChat } from "@/hooks/useNeroChat";
import { Send, Zap, ChevronDown, ChevronRight, Check, Edit2, FileText, Eye, Trash2, ArrowRight, FolderOpen, Terminal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

function CollapsibleCode({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded bg-nero-code-bg border border-border"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {open ? "Hide code" : "View code"}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

function PlanView({ plan, onApprove, onEdit }: {
  plan: string[];
  onApprove: () => void;
  onEdit: (steps: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [steps, setSteps] = useState(plan);

  return (
    <div className="bg-nero-surface border border-border rounded-xl p-3 space-y-2">
      <p className="text-xs font-medium text-foreground">📋 Plan</p>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-[10px] text-muted-foreground mt-0.5 w-4 shrink-0">{i + 1}.</span>
          {editing ? (
            <input
              value={step}
              onChange={(e) => { const s = [...steps]; s[i] = e.target.value; setSteps(s); }}
              className="flex-1 bg-nero-code-bg border border-border rounded px-2 py-1 text-xs text-foreground outline-none"
            />
          ) : (
            <span className="text-xs text-secondary-foreground">{step}</span>
          )}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { if (editing) { onEdit(steps); setEditing(false); } else onApprove(); }}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Check className="w-3 h-3" />
          {editing ? "Save & Generate" : "Approve & Generate"}
        </button>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
        )}
      </div>
    </div>
  );
}

const TOOL_META: Record<string, { icon: typeof FileText; label: string; color: string }> = {
  write_file: { icon: FileText, label: "Writing", color: "text-green-400" },
  read_file: { icon: Eye, label: "Reading", color: "text-blue-400" },
  delete_file: { icon: Trash2, label: "Deleting", color: "text-red-400" },
  rename_file: { icon: ArrowRight, label: "Renaming", color: "text-yellow-400" },
  list_files: { icon: FolderOpen, label: "Listing files", color: "text-purple-400" },
  run_shell: { icon: Terminal, label: "Running", color: "text-orange-400" },
};

export function ChatPanel() {
  const { messages, isLoading, streamingContent, sendMessage, pendingPlan, approvePlan, editPlan, toolActivity } = useNeroChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent, pendingPlan, toolActivity]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const renderMarkdown = (content: string, isStreaming = false) => (
    <ReactMarkdown
      components={{
        pre: ({ children }) => isStreaming ? <div className="my-2">{children}</div> : <CollapsibleCode>{children}</CollapsibleCode>,
        code: ({ className, children, ...props }) => {
          const isInline = !className;
          if (isInline) return <code className="font-mono text-xs bg-nero-code-bg px-1 py-0.5 rounded" {...props}>{children}</code>;
          return (
            <pre className="bg-nero-code-bg rounded-lg p-3 text-xs overflow-x-auto">
              <code className="font-mono text-xs" {...props}>{children}</code>
            </pre>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      <div ref={scrollRef} className="flex-1 overflow-y-auto nero-scrollbar p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-nero-surface border border-border flex items-center justify-center">
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">What do you want to build?</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Describe your app and I'll create a plan, generate code, and show you a live preview.
            </p>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                msg.role === "user"
                  ? "bg-foreground text-background"
                  : "bg-nero-surface text-foreground border border-border"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    {renderMarkdown(msg.content)}
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Pending Plan */}
        {pendingPlan && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="max-w-[85%]">
              <PlanView plan={pendingPlan} onApprove={approvePlan} onEdit={editPlan} />
            </div>
          </motion.div>
        )}

        {/* Streaming */}
        {streamingContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-nero-surface text-foreground border border-border">
              <div className="prose prose-invert prose-sm max-w-none">
                {renderMarkdown(streamingContent, true)}
                <span className="typing-cursor" />
              </div>
            </div>
          </motion.div>
        )}

        {/* Tool Activity Indicator */}
        {isLoading && toolActivity.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3 py-2 bg-nero-surface border border-border space-y-1">
              {toolActivity.map((t, i) => {
                const meta = TOOL_META[t.name] || { icon: Zap, label: t.name, color: "text-muted-foreground" };
                const Icon = meta.icon;
                const isLatest = i === toolActivity.length - 1;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: isLatest ? 1 : 0.5, x: 0 }}
                    className={`flex items-center gap-2 text-[11px] font-mono ${isLatest ? meta.color : "text-muted-foreground"}`}
                  >
                    {isLatest ? (
                      <Icon className="w-3 h-3 animate-pulse" />
                    ) : (
                      <Check className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span>{meta.label}</span>
                    {t.detail && (
                      <span className="text-muted-foreground truncate max-w-[180px]">{t.detail}</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {isLoading && !streamingContent && toolActivity.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-nero-surface border border-border rounded-xl px-4 py-3 flex gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0.2s" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground pulse-dot" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2 bg-nero-surface rounded-xl border border-border px-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe what you want to build... (Shift+Enter to send)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground py-3 outline-none resize-none min-h-[44px] max-h-32"
            rows={1}
            disabled={isLoading}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 mb-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Shift + Enter to send · Enter for new line</p>
      </div>
    </div>
  );
}
