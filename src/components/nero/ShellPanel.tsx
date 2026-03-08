import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal } from "lucide-react";
import { useProject, ProjectFile } from "@/contexts/ProjectContext";

interface ShellLine {
  type: "input" | "output" | "error";
  text: string;
}

function executeCommand(cmd: string, files: ProjectFile[], env: Record<string, string>): string | { text: string; type: "error" | "output" } {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  
  for (const ch of cmd.trim()) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; } else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true; quoteChar = ch;
    } else if (ch === " ") {
      if (current) { parts.push(current); current = ""; }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  // Handle pipes
  if (cmd.includes("|")) {
    const segments = cmd.split("|").map((s) => s.trim());
    let pipeInput = "";
    for (const seg of segments) {
      const result = executeCommand(seg + (pipeInput ? ` <<PIPE>>${pipeInput}<<PIPE>>` : ""), files, env);
      pipeInput = typeof result === "string" ? result : result.text;
    }
    return pipeInput;
  }

  // Handle redirects (basic >)
  if (cmd.includes(" > ") && !cmd.includes(">>")) {
    const [cmdPart] = cmd.split(" > ");
    const result = executeCommand(cmdPart.trim(), files, env);
    return typeof result === "string" ? result : result.text;
  }

  switch (command) {
    case "help":
      return `Available commands:
  ls [-la] [dir]    - List files
  cat <file>        - Show file content
  head [-n N] <f>   - First N lines (default 10)
  tail [-n N] <f>   - Last N lines (default 10)
  grep <pat> <file> - Search in file
  wc [-l|-w|-c] <f> - Count lines/words/chars
  find <pattern>    - Find files matching pattern
  echo <text>       - Print text
  pwd               - Print working directory
  whoami            - Current user
  date              - Current date/time
  env               - Show environment variables
  export K=V        - Set environment variable
  touch <file>      - Create empty file
  mkdir <dir>       - Create directory (virtual)
  rm <file>         - Remove file (virtual)
  cp <src> <dst>    - Copy file (virtual)
  mv <src> <dst>    - Move/rename file (virtual)
  sort <file>       - Sort file lines
  uniq              - Remove duplicate lines
  tr <a> <b>        - Translate characters
  node -e "<code>"  - Execute JavaScript
  python -c "<code>"- Execute Python-like expressions
  curl <url>        - Fetch URL (limited)
  history           - Command history
  clear             - Clear screen
  
  Supports: pipes (|), quotes, basic env vars ($VAR)`;

    case "ls": {
      const showAll = args.includes("-la") || args.includes("-l") || args.includes("-a");
      const dir = args.find((a) => !a.startsWith("-")) || "";
      let filtered = files;
      if (dir) filtered = files.filter((f) => f.path.startsWith(dir));
      
      if (args.includes("-l") || args.includes("-la")) {
        return filtered.map((f) => {
          const size = f.content.length;
          return `-rw-r--r-- 1 nero nero ${String(size).padStart(6)} ${f.path}`;
        }).join("\n") || "(empty)";
      }
      
      // Group by top-level directory
      const names = new Set<string>();
      filtered.forEach((f) => {
        const rel = dir ? f.path.slice(dir.length).replace(/^\//, "") : f.path;
        const topLevel = rel.split("/")[0];
        if (topLevel) names.add(topLevel);
      });
      return [...names].sort().join("  ") || "(empty)";
    }

    case "pwd":
      return "/nero-project";
    case "whoami":
      return "nero-user";
    case "date":
      return new Date().toString();
    case "hostname":
      return "nero-shell";
    case "uname":
      return args.includes("-a") ? "NeroOS 1.0.0 nero-shell aarch64" : "NeroOS";

    case "echo": {
      let text = args.join(" ");
      // Expand env vars
      text = text.replace(/\$(\w+)/g, (_, k) => env[k] || "");
      return text;
    }

    case "env":
      return Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n") || "(no variables)";

    case "export": {
      const expr = args.join(" ");
      const eq = expr.indexOf("=");
      if (eq === -1) return { text: "Usage: export KEY=VALUE", type: "error" };
      env[expr.slice(0, eq)] = expr.slice(eq + 1);
      return "";
    }

    case "cat": {
      const target = args[0];
      if (!target) return { text: "Usage: cat <filename>", type: "error" };
      const file = files.find((f) => f.path === target || f.name === target);
      return file ? file.content : { text: `cat: ${target}: No such file or directory`, type: "error" };
    }

    case "head": {
      let n = 10;
      let target = args[0];
      if (args[0] === "-n" && args[1]) { n = parseInt(args[1]) || 10; target = args[2]; }
      if (!target) return { text: "Usage: head [-n N] <filename>", type: "error" };
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return { text: `head: ${target}: No such file`, type: "error" };
      return file.content.split("\n").slice(0, n).join("\n");
    }

    case "tail": {
      let n = 10;
      let target = args[0];
      if (args[0] === "-n" && args[1]) { n = parseInt(args[1]) || 10; target = args[2]; }
      if (!target) return { text: "Usage: tail [-n N] <filename>", type: "error" };
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return { text: `tail: ${target}: No such file`, type: "error" };
      const lines = file.content.split("\n");
      return lines.slice(-n).join("\n");
    }

    case "grep": {
      const pattern = args[0];
      const target = args[1];
      if (!pattern) return { text: "Usage: grep <pattern> [file]", type: "error" };
      if (target) {
        const file = files.find((f) => f.path === target || f.name === target);
        if (!file) return { text: `grep: ${target}: No such file`, type: "error" };
        const matches = file.content.split("\n").filter((l) => l.includes(pattern));
        return matches.join("\n") || "";
      }
      // Grep across all files
      const results: string[] = [];
      files.forEach((f) => {
        f.content.split("\n").forEach((line) => {
          if (line.includes(pattern)) results.push(`${f.path}: ${line}`);
        });
      });
      return results.slice(0, 50).join("\n") || "";
    }

    case "wc": {
      const flag = args[0]?.startsWith("-") ? args[0] : null;
      const target = flag ? args[1] : args[0];
      if (!target) return { text: "Usage: wc [-l|-w|-c] <filename>", type: "error" };
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return { text: `wc: ${target}: No such file`, type: "error" };
      const lines = file.content.split("\n").length;
      const words = file.content.split(/\s+/).filter(Boolean).length;
      const chars = file.content.length;
      if (flag === "-l") return `${lines}`;
      if (flag === "-w") return `${words}`;
      if (flag === "-c") return `${chars}`;
      return `  ${lines}  ${words}  ${chars} ${target}`;
    }

    case "find": {
      const pattern = args[0];
      if (!pattern) return { text: "Usage: find <pattern>", type: "error" };
      const matches = files.filter((f) => f.path.includes(pattern) || f.name.includes(pattern));
      return matches.length ? matches.map((f) => `./${f.path}`).join("\n") : "";
    }

    case "sort": {
      const target = args[0];
      if (!target) return { text: "Usage: sort <filename>", type: "error" };
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return { text: `sort: ${target}: No such file`, type: "error" };
      return file.content.split("\n").sort().join("\n");
    }

    case "uniq": {
      const target = args[0];
      if (!target) return "";
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return { text: `uniq: ${target}: No such file`, type: "error" };
      const lines = file.content.split("\n");
      return lines.filter((l, i) => i === 0 || l !== lines[i - 1]).join("\n");
    }

    case "touch":
      return args[0] ? `(created virtual file: ${args[0]})` : { text: "Usage: touch <filename>", type: "error" };

    case "mkdir":
      return args[0] ? `(created virtual directory: ${args[0]})` : { text: "Usage: mkdir <dirname>", type: "error" };

    case "rm":
      return args[0] ? `(removed: ${args[0]})` : { text: "Usage: rm <filename>", type: "error" };

    case "node": {
      if (args[0] !== "-e" || !args[1]) return { text: "Usage: node -e \"<code>\"", type: "error" };
      const code = args.slice(1).join(" ");
      try {
        const logs: string[] = [];
        const mockConsole = { log: (...a: any[]) => logs.push(a.map(String).join(" ")), error: (...a: any[]) => logs.push(a.map(String).join(" ")) };
        const fn = new Function("console", "Math", "JSON", "Date", "Array", "Object", "String", "Number", "Boolean", "parseInt", "parseFloat", "isNaN", code);
        const result = fn(mockConsole, Math, JSON, Date, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN);
        if (logs.length) return logs.join("\n");
        return result !== undefined ? String(result) : "";
      } catch (e) {
        return { text: `Error: ${e instanceof Error ? e.message : String(e)}`, type: "error" };
      }
    }

    case "python": {
      if (args[0] !== "-c" || !args[1]) return { text: "Usage: python -c \"<expression>\"", type: "error" };
      const expr = args.slice(1).join(" ");
      // Very basic Python-like eval for math expressions
      try {
        const jsExpr = expr
          .replace(/print\(([^)]+)\)/g, "$1")
          .replace(/\*\*/g, "**")
          .replace(/True/g, "true")
          .replace(/False/g, "false")
          .replace(/None/g, "null")
          .replace(/len\(([^)]+)\)/g, "$1.length");
        const result = new Function(`return ${jsExpr}`)();
        return String(result);
      } catch (e) {
        return { text: `Error: ${e instanceof Error ? e.message : String(e)}`, type: "error" };
      }
    }

    case "curl":
      return { text: "curl: network requests not supported in virtual shell. Use the app's GitHub import instead.", type: "error" };

    case "clear":
      return "__CLEAR__";

    case "history":
      return "__HISTORY__";

    case "":
      return "";

    default:
      return { text: `nero: command not found: ${command}. Type 'help' for available commands.`, type: "error" };
  }
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
