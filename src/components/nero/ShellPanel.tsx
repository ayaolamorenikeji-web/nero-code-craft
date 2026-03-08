import { useState, useRef, useEffect } from "react";
import { Terminal } from "lucide-react";

interface ShellLine {
  type: "input" | "output" | "error";
  text: string;
}

// Simulated shell that handles common web-dev commands
function executeCommand(cmd: string, files: { path: string; content: string }[]): string {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();

  switch (command) {
    case "help":
      return "Available commands: ls, cat <file>, pwd, echo <text>, clear, whoami, date, wc <file>, head <file>, find <pattern>";
    case "ls":
      return files.map((f) => f.path).join("\n") || "(no files)";
    case "pwd":
      return "/nero-project";
    case "whoami":
      return "nero-user";
    case "date":
      return new Date().toString();
    case "echo":
      return parts.slice(1).join(" ");
    case "cat": {
      const target = parts[1];
      if (!target) return "Usage: cat <filename>";
      const file = files.find((f) => f.path === target || f.name === target);
      return file ? file.content : `cat: ${target}: No such file`;
    }
    case "wc": {
      const target = parts[1];
      if (!target) return "Usage: wc <filename>";
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return `wc: ${target}: No such file`;
      const lines = file.content.split("\n").length;
      const words = file.content.split(/\s+/).filter(Boolean).length;
      const chars = file.content.length;
      return `  ${lines}  ${words}  ${chars} ${target}`;
    }
    case "head": {
      const target = parts[1];
      if (!target) return "Usage: head <filename>";
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return `head: ${target}: No such file`;
      return file.content.split("\n").slice(0, 10).join("\n");
    }
    case "find": {
      const pattern = parts[1];
      if (!pattern) return "Usage: find <pattern>";
      const matches = files.filter((f) => f.path.includes(pattern) || f.name.includes(pattern));
      return matches.length ? matches.map((f) => f.path).join("\n") : "No matches found";
    }
    case "clear":
      return "__CLEAR__";
    case "":
      return "";
    default:
      return `nero: command not found: ${command}. Type 'help' for available commands.`;
  }
}

export function ShellPanel() {
  const [history, setHistory] = useState<ShellLine[]>([
    { type: "output", text: "Nero Shell v1.0 — Type 'help' for commands" },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // We import useProject lazily to get files
  const { useProject } = require("@/contexts/ProjectContext");
  const { project } = useProject();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    const cmd = input.trim();
    setInput("");

    const result = executeCommand(cmd, project?.files || []);

    if (result === "__CLEAR__") {
      setHistory([]);
      return;
    }

    setHistory((prev) => [
      ...prev,
      { type: "input", text: `$ ${cmd}` },
      ...(result ? [{ type: "output" as const, text: result }] : []),
    ]);
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
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          className="flex-1 bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
          placeholder="Type a command..."
        />
      </div>
    </div>
  );
}
