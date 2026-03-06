import { useState, useRef, useEffect } from "react";
import { useNeroChat } from "@/hooks/useNeroChat";
import { Send, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";

export function ChatPanel() {
  const { messages, isLoading, streamingContent, sendMessage } = useNeroChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto nero-scrollbar p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <div className="w-12 h-12 rounded-xl bg-nero-surface border border-border flex items-center justify-center">
              <Zap className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">What do you want to build?</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Describe your app and I'll generate the code, create files, and show you a live preview.
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
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-foreground text-background"
                    : "bg-nero-surface text-foreground border border-border"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-nero-code-bg [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_code]:font-mono [&_code]:text-xs">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Streaming */}
        {streamingContent && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-4 py-3 text-sm bg-nero-surface text-foreground border border-border">
              <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-nero-code-bg [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:text-xs [&_code]:font-mono [&_code]:text-xs">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
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
