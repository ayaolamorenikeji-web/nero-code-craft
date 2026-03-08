import { useState, useRef, useEffect } from "react";
import { useNeroChat } from "@/hooks/useNeroChat";
import { Send, Zap, ChevronDown, ChevronRight, Check, Edit2 } from "lucide-react";
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

export function ChatPanel() {
  const { messages, isLoading, streamingContent, sendMessage, pendingPlan, approvePlan, editPlan } = useNeroChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent, pendingPlan]);

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
                {renderMarkdown(streamingContent)}
                <span className="typing-cursor" />
              </div>
            </div>
          </motion.div>
        )}

        {isLoading && !streamingContent && (
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
        <div className="flex items-center gap-2 bg-nero-surface rounded-xl border border-border px-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Describe what you want to build..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground py-3 outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
