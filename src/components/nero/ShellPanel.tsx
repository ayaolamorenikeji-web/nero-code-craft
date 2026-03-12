import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { executeCommand } from "@/lib/shellUtils";

interface ShellLine {
  type: "input" | "output" | "error";
  text: string;
}

export function ShellPanel() {
  const [history, setHistory] = useState<ShellLine[]>([
    { type: "output", text: "Nero Shell v2.0 — Type 'help' for commands" },
  ]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [envVars, setEnvVars] = useState<Record<string, string>>({
    HOME: "/nero-project",
    USER: "nero-user",
    SHELL: "/bin/nero-sh",
    TERM: "xterm-256color",
    PATH: "/usr/local/bin:/usr/bin:/bin",
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { project } = useProject();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history]);

  const handleSubmit = useCallback(() => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput("");
    setCommandHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);

    const result = executeCommand(cmd, project?.files || [], envVars);

    if (result === "__CLEAR__") {
      setHistory([]);
      return;
    }

    if (result === "__HISTORY__") {
      setHistory((prev) => [
        ...prev,
        { type: "input", text: `$ ${cmd}` },
        ...commandHistory.map((c, i) => ({ type: "output" as const, text: `  ${i + 1}  ${c}` })),
      ]);
      return;
    }

    const text = typeof result === "string" ? result : result.text;
    const type = typeof result === "string" ? "output" : result.type;

    setHistory((prev) => [
      ...prev,
      { type: "input", text: `$ ${cmd}` },
      ...(text ? [{ type: type as "output" | "error", text }] : []),
    ]);
  }, [input, project, envVars, commandHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIdx = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIdx);
        setInput(commandHistory[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIdx = historyIndex + 1;
        if (newIdx >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput("");
        } else {
          setHistoryIndex(newIdx);
          setInput(commandHistory[newIdx]);
        }
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Basic tab completion for filenames
      const files = project?.files || [];
      const partial = input.split(/\s+/).pop() || "";
      if (partial) {
        const match = files.find((f) => f.path.startsWith(partial) || f.name.startsWith(partial));
        if (match) {
          const parts = input.split(/\s+/);
          parts[parts.length - 1] = match.path;
          setInput(parts.join(" "));
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-nero-code-bg" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
        <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono">Shell</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto nero-scrollbar p-3 space-y-0.5">
        {history.map((line, i) => (
          <p
            key={i}
            className={`text-xs font-mono leading-relaxed whitespace-pre-wrap ${
              line.type === "input" ? "text-foreground" : line.type === "error" ? "text-destructive" : "text-secondary-foreground"
            }`}
          >
            {line.text}
          </p>
        ))}
      </div>

      <div className="border-t border-border px-3 py-2 flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Type a command..."
        />
      </div>
    </div>
  );
}
