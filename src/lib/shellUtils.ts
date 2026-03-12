import { ProjectFile } from "@/contexts/ProjectContext";

export function executeCommand(
  cmd: string,
  files: ProjectFile[],
  env: Record<string, string>
): string | { text: string; type: "error" | "output" } {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const ch of cmd.trim()) {
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " ") {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);

  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  if (cmd.includes("|")) {
    const segments = cmd.split("|").map((s) => s.trim());
    let pipeInput = "";
    for (const seg of segments) {
      const result = executeCommand(
        seg + (pipeInput ? ` <<PIPE>>${pipeInput}<<PIPE>>` : ""),
        files,
        env
      );
      pipeInput = typeof result === "string" ? result : result.text;
    }
    return pipeInput;
  }

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
  head [-n N] <f>   - First N lines
  tail [-n N] <f>   - Last N lines
  grep <pat> <file> - Search in file
  wc [-l|-w|-c] <f> - Count lines/words/chars
  find <pattern>    - Find files matching pattern
  echo <text>       - Print text
  pwd / whoami / date / env
  export K=V        - Set env variable
  node -e "<code>"  - Execute JavaScript
  python -c "<code>"- Execute Python-like expressions
  npm <init|install|run>
  clear / history`;

    case "ls": {
      const dir = args.find((a) => !a.startsWith("-")) || "";
      let filtered = files;
      if (dir) filtered = files.filter((f) => f.path.startsWith(dir));
      if (args.includes("-l") || args.includes("-la")) {
        return (
          filtered
            .map(
              (f) =>
                `-rw-r--r-- 1 nero nero ${String(f.content.length).padStart(6)} ${f.path}`
            )
            .join("\n") || "(empty)"
        );
      }
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
      return args.includes("-a")
        ? "NeroOS 1.0.0 nero-shell aarch64"
        : "NeroOS";

    case "echo": {
      let text = args.join(" ");
      text = text.replace(/\$(\w+)/g, (_, k) => env[k] || "");
      return text;
    }

    case "env":
      return (
        Object.entries(env)
          .map(([k, v]) => `${k}=${v}`)
          .join("\n") || "(no variables)"
      );

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
      return file
        ? file.content
        : {
            text: `cat: ${target}: No such file or directory`,
            type: "error",
          };
    }

    case "head": {
      let n = 10;
      let target = args[0];
      if (args[0] === "-n" && args[1]) {
        n = parseInt(args[1]) || 10;
        target = args[2];
      }
      if (!target)
        return { text: "Usage: head [-n N] <filename>", type: "error" };
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return { text: `head: ${target}: No such file`, type: "error" };
      return file.content.split("\n").slice(0, n).join("\n");
    }

    case "tail": {
      let n = 10;
      let target = args[0];
      if (args[0] === "-n" && args[1]) {
        n = parseInt(args[1]) || 10;
        target = args[2];
      }
      if (!target)
        return { text: "Usage: tail [-n N] <filename>", type: "error" };
      const file = files.find((f) => f.path === target || f.name === target);
      if (!file) return { text: `tail: ${target}: No such file`, type: "error" };
      return file.content.split("\n").slice(-n).join("\n");
    }

    case "grep": {
      const pattern = args[0];
      const target = args[1];
      if (!pattern)
        return { text: "Usage: grep <pattern> [file]", type: "error" };
      if (target) {
        const file = files.find((f) => f.path === target || f.name === target);
        if (!file)
          return { text: `grep: ${target}: No such file`, type: "error" };
        return file.content
          .split("\n")
          .filter((l) => l.includes(pattern))
          .join("\n") || "";
      }
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
      if (!target)
        return { text: "Usage: wc [-l|-w|-c] <filename>", type: "error" };
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
      if (!pattern)
        return { text: "Usage: find <pattern>", type: "error" };
      const matches = files.filter(
        (f) => f.path.includes(pattern) || f.name.includes(pattern)
      );
      return matches.length ? matches.map((f) => `./${f.path}`).join("\n") : "";
    }

    case "sort": {
      const target = args[0];
      if (!target)
        return { text: "Usage: sort <filename>", type: "error" };
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
      return args[0]
        ? `(created virtual file: ${args[0]})`
        : { text: "Usage: touch <filename>", type: "error" };

    case "mkdir":
      return args[0]
        ? `(created virtual directory: ${args[0]})`
        : { text: "Usage: mkdir <dirname>", type: "error" };

    case "rm":
      return args[0]
        ? `(removed: ${args[0]})`
        : { text: "Usage: rm <filename>", type: "error" };

    case "node": {
      if (args[0] === "-e" || args[0] === "--eval") {
        const code = args.slice(1).join(" ");
        if (!code)
          return { text: 'Usage: node -e "<code>"', type: "error" };
        try {
          const logs: string[] = [];
          const mockConsole = {
            log: (...a: any[]) =>
              logs.push(
                a
                  .map((v) =>
                    typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)
                  )
                  .join(" ")
              ),
            error: (...a: any[]) =>
              logs.push("Error: " + a.map(String).join(" ")),
            warn: (...a: any[]) =>
              logs.push("Warning: " + a.map(String).join(" ")),
            info: (...a: any[]) => logs.push(a.map(String).join(" ")),
            table: (data: any) => logs.push(JSON.stringify(data, null, 2)),
          };
          const mockRequire = (mod: string) => {
            if (mod === "path")
              return {
                join: (...p: string[]) => p.join("/"),
                basename: (p: string) => p.split("/").pop(),
                dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
                extname: (p: string) => "." + p.split(".").pop(),
              };
            if (mod === "fs")
              return {
                readFileSync: (p: string) => {
                  const f = files.find((f) => f.path === p || f.name === p);
                  return f ? f.content : "";
                },
                readdirSync: () => files.map((f) => f.path),
                existsSync: (p: string) => files.some((f) => f.path === p),
              };
            throw new Error(`Module '${mod}' not available in virtual shell`);
          };
          const fn = new Function(
            "console",
            "require",
            "Math",
            "JSON",
            "Date",
            "Array",
            "Object",
            "String",
            "Number",
            "Boolean",
            "parseInt",
            "parseFloat",
            "isNaN",
            "setTimeout",
            "Promise",
            "Map",
            "Set",
            "RegExp",
            code
          );
          const result = fn(
            mockConsole,
            mockRequire,
            Math,
            JSON,
            Date,
            Array,
            Object,
            String,
            Number,
            Boolean,
            parseInt,
            parseFloat,
            isNaN,
            () => {},
            Promise,
            Map,
            Set,
            RegExp
          );
          if (logs.length) return logs.join("\n");
          return result !== undefined ? String(result) : "";
        } catch (e) {
          return {
            text: `${e instanceof Error ? e.message : String(e)}`,
            type: "error",
          };
        }
      }
      const target = args[0];
      if (target) {
        const file = files.find((f) => f.path === target || f.name === target);
        if (!file)
          return { text: `node: ${target}: No such file`, type: "error" };
        try {
          const logs: string[] = [];
          const mockConsole = {
            log: (...a: any[]) =>
              logs.push(
                a
                  .map((v) =>
                    typeof v === "object" ? JSON.stringify(v, null, 2) : String(v)
                  )
                  .join(" ")
              ),
            error: (...a: any[]) =>
              logs.push("Error: " + a.map(String).join(" ")),
          };
          const fn = new Function(
            "console",
            "Math",
            "JSON",
            "Date",
            "Array",
            "Object",
            file.content
          );
          fn(mockConsole, Math, JSON, Date, Array, Object);
          return logs.join("\n") || "(no output)";
        } catch (e) {
          return {
            text: `${e instanceof Error ? e.message : String(e)}`,
            type: "error",
          };
        }
      }
      return 'Node.js v20.0.0 (virtual)\nUsage: node -e "<code>" or node <filename>';
    }

    case "npm": {
      const subcmd = args[0];
      if (subcmd === "init")
        return 'Wrote to /nero-project/package.json\n\n{ "name": "nero-project", "version": "1.0.0" }';
      if (subcmd === "install" || subcmd === "i") {
        const pkg = args[1];
        if (!pkg)
          return "npm install: installing dependencies...\nadded 0 packages in 0.5s";
        return `+ ${pkg}@latest\nadded 1 package in 0.3s`;
      }
      if (subcmd === "run") {
        const script = args[1];
        if (!script)
          return { text: "Usage: npm run <script>", type: "error" };
        if (script === "dev" || script === "start")
          return "Starting development server...\n\n  ➜  Local: http://localhost:3000/\n  ➜  Use the Preview tab to see your app";
        if (script === "build")
          return "Building for production...\n✓ Built in 1.2s\n  dist/index.html  0.5 kB\n  dist/assets/*.js  12.3 kB";
        return `npm run ${script}: script not found`;
      }
      if (subcmd === "list" || subcmd === "ls")
        return "nero-project@1.0.0\n└── (no dependencies)";
      if (subcmd === "version" || subcmd === "-v") return "10.0.0";
      return "Usage: npm <init|install|run|list|version>";
    }

    case "npx": {
      const tool = args[0];
      if (!tool)
        return { text: "Usage: npx <package> [args]", type: "error" };
      return `npx: executing ${tool}...\n(virtual environment — use Nero AI for full code generation)`;
    }

    case "python": {
      if (args[0] === "-c") {
        const expr = args.slice(1).join(" ");
        if (!expr)
          return { text: 'Usage: python -c "<expression>"', type: "error" };
        try {
          const jsExpr = expr
            .replace(/print\(([^)]+)\)/g, "($1)")
            .replace(/\*\*/g, "**")
            .replace(/True/g, "true")
            .replace(/False/g, "false")
            .replace(/None/g, "null")
            .replace(/len\(([^)]+)\)/g, "$1.length")
            .replace(/str\(([^)]+)\)/g, "String($1)")
            .replace(/int\(([^)]+)\)/g, "parseInt($1)")
            .replace(/float\(([^)]+)\)/g, "parseFloat($1)");
          const result = new Function(`return ${jsExpr}`)();
          return String(result);
        } catch (e) {
          return {
            text: `Error: ${e instanceof Error ? e.message : String(e)}`,
            type: "error",
          };
        }
      }
      return 'Python 3.11.0 (virtual)\nUsage: python -c "<expression>"';
    }

    case "pip":
      return args[0] === "install"
        ? `Successfully installed ${args.slice(1).join(" ") || "nothing"}`
        : "Usage: pip install <package>";

    case "curl":
      return {
        text: "curl: network requests not supported in virtual shell.",
        type: "error",
      };
    case "wget":
      return {
        text: "wget: network requests not supported in virtual shell.",
        type: "error",
      };

    case "clear":
      return "__CLEAR__";
    case "history":
      return "__HISTORY__";
    case "":
      return "";

    default:
      return {
        text: `nero: command not found: ${command}. Type 'help' for available commands.`,
        type: "error",
      };
  }
}
