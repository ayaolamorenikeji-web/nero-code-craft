import { useState, useCallback } from "react";
import { useProject, ProjectFile, ChatMessage } from "@/contexts/ProjectContext";
import { executeCommand } from "@/lib/shellUtils";

interface ParsedToolCall {
  id: string;
  name: string;
  arguments: string;
}

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "html", css: "css", js: "javascript", ts: "typescript",
    jsx: "javascript", tsx: "typescript", json: "json", py: "python",
    md: "markdown", txt: "markdown",
  };
  return map[ext] || "javascript";
}

export function useNeroChat() {
  const {
    project, activeFile, consoleOutput, addFile, deleteFile, renameFile,
    addConsoleLog, addChatMessage, createNewProject,
  } = useProject();

  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string[] | null>(null);
  const [pendingInput, setPendingInput] = useState("");
  const [toolActivity, setToolActivity] = useState<{ name: string; detail: string }[]>([]);

  const messages = project?.chatMessages || [];

  const getSystemContext = useCallback((): string => {
    const parts: string[] = [];
    if (activeFile) {
      const MAX = 8000;
      const content = activeFile.content.length > MAX
        ? activeFile.content.slice(0, MAX) + "\n... (truncated)"
        : activeFile.content;
      parts.push(`<current_file path="${activeFile.path}" language="${activeFile.language}">\n${content}\n</current_file>`);
    }
    const fileList = project?.files?.map((f) => f.path).join("\n");
    if (fileList) parts.push(`<project_files>\n${fileList}\n</project_files>`);
    const errorLines = consoleOutput.slice(-30).filter(
      (l) => l.includes("❌") || l.toLowerCase().includes("error") || l.toLowerCase().includes("exception")
    );
    if (errorLines.length > 0) parts.push(`<terminal_errors>\n${errorLines.join("\n")}\n</terminal_errors>`);
    return parts.length > 0 ? `\n\n<context>\n${parts.join("\n\n")}\n</context>` : "";
  }, [activeFile, project, consoleOutput]);

  const callAI = useCallback(
    async (allMessages: { role: string; content: string; tool_call_id?: string }[]) => {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nero-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: allMessages }),
        }
      );
      if (!resp.ok || !resp.body) {
        if (resp.status === 429) addConsoleLog("⚠️ Rate limited.");
        else if (resp.status === 402) addConsoleLog("⚠️ Credits needed.");
        throw new Error(`Request failed: ${resp.status}`);
      }
      return resp;
    },
    [addConsoleLog]
  );

  const streamResponse = useCallback(
    async (resp: Response): Promise<{ content: string; toolCalls: ParsedToolCall[] }> => {
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      const toolCallsMap: Record<number, { id: string; name: string; argsBuffer: string }> = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              content += delta.content;
              setStreamingContent(content);
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx: number = tc.index ?? 0;
                if (!toolCallsMap[idx]) toolCallsMap[idx] = { id: "", name: "", argsBuffer: "" };
                if (tc.id) toolCallsMap[idx].id = tc.id;
                if (tc.function?.name) toolCallsMap[idx].name = tc.function.name;
                if (tc.function?.arguments) toolCallsMap[idx].argsBuffer += tc.function.arguments;
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      const toolCalls: ParsedToolCall[] = Object.values(toolCallsMap).map(
        (tc) => ({ id: tc.id, name: tc.name, arguments: tc.argsBuffer })
      );
      return { content, toolCalls };
    },
    []
  );

  /** Execute tool calls, returning results for read-only tools (for multi-turn) */
  const executeToolCalls = useCallback(
    (toolCalls: ParsedToolCall[]): { createdPaths: string[]; toolResults: { id: string; result: string }[] } => {
      const createdPaths: string[] = [];
      const toolResults: { id: string; result: string }[] = [];
      const files = project?.files || [];
      const env: Record<string, string> = { HOME: "/nero-project", USER: "nero-user" };

      for (const tc of toolCalls) {
        try {
          const args = tc.arguments ? JSON.parse(tc.arguments) : {};
          const toolLabel = (name: string, detail: string) => {
            setToolActivity((prev) => [...prev, { name, detail }]);
          };
          switch (tc.name) {
            case "write_file": {
              toolLabel("write_file", args.path);
              const file: ProjectFile = {
                id: crypto.randomUUID(),
                name: args.path.split("/").pop() || args.path,
                path: args.path,
                content: args.content,
                language: args.language || inferLanguage(args.path),
              };
              addFile(file);
              addConsoleLog(`📄 Created: ${args.path}`);
              createdPaths.push(args.path);
              toolResults.push({ id: tc.id, result: `File written: ${args.path}` });
              break;
            }
            case "read_file": {
              toolLabel("read_file", args.path);
              const found = files.find((f) => f.path === args.path || f.name === args.path);
              const result = found ? found.content : `Error: file not found: ${args.path}`;
              addConsoleLog(`👁️ Read: ${args.path}`);
              toolResults.push({ id: tc.id, result });
              break;
            }
            case "delete_file": {
              toolLabel("delete_file", args.path);
              deleteFile(args.path);
              addConsoleLog(`🗑️ Deleted: ${args.path}`);
              toolResults.push({ id: tc.id, result: `Deleted: ${args.path}` });
              break;
            }
            case "rename_file": {
              toolLabel("rename_file", `${args.old_path} → ${args.new_path}`);
              renameFile(args.old_path, args.new_path);
              addConsoleLog(`✏️ Renamed: ${args.old_path} → ${args.new_path}`);
              toolResults.push({ id: tc.id, result: `Renamed ${args.old_path} → ${args.new_path}` });
              break;
            }
            case "list_files": {
              toolLabel("list_files", "");
              const paths = files.map((f) => f.path).join("\n");
              toolResults.push({ id: tc.id, result: paths || "(no files)" });
              break;
            }
            case "run_shell": {
              toolLabel("run_shell", args.command);
              const cmdResult = executeCommand(args.command, files, env);
              const output = typeof cmdResult === "string" ? cmdResult : cmdResult.text;
              addConsoleLog(`🖥️ Shell: ${args.command}`);
              toolResults.push({ id: tc.id, result: output || "(no output)" });
              break;
            }
            default:
              toolResults.push({ id: tc.id, result: `Unknown tool: ${tc.name}` });
          }
        } catch (e) {
          addConsoleLog(`❌ Tool error (${tc.name}): ${e}`);
          toolResults.push({ id: tc.id, result: `Error: ${e}` });
        }
      }
      return { createdPaths, toolResults };
    },
    [project, addFile, deleteFile, renameFile, addConsoleLog]
  );

  /** Check if any tool calls are "query" tools that need a follow-up AI turn */
  const hasQueryTools = (toolCalls: ParsedToolCall[]): boolean =>
    toolCalls.some((tc) => ["read_file", "list_files", "run_shell"].includes(tc.name));

  const parsePlan = (text: string): string[] | null => {
    const lines = text.split("\n").filter((l) => /^\d+[\.\)]\s/.test(l.trim()));
    if (lines.length >= 2) return lines.map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim());
    return null;
  };

  const parseAndAddFiles = useCallback(
    (text: string) => {
      const regex = /```(\w+)\s+filename="([^"]+)"\n([\s\S]*?)```/g;
      let match;
      const files: ProjectFile[] = [];
      while ((match = regex.exec(text)) !== null) {
        const file: ProjectFile = {
          id: crypto.randomUUID(),
          name: match[2].split("/").pop() || match[2],
          path: match[2],
          content: match[3].trim(),
          language: match[1],
        };
        files.push(file);
        addFile(file);
        addConsoleLog(`📄 Created: ${file.path}`);
      }
      return files;
    },
    [addFile, addConsoleLog]
  );

  /** Multi-turn tool loop: execute tools → feed results back → repeat up to MAX_ROUNDS */
  const runWithToolLoop = useCallback(
    async (initialMessages: { role: string; content: string; tool_call_id?: string }[]) => {
      const MAX_ROUNDS = 5;
      let msgs = [...initialMessages];
      let finalContent = "";
      let allCreated: string[] = [];

      for (let round = 0; round < MAX_ROUNDS; round++) {
        const resp = await callAI(msgs);
        const { content, toolCalls } = await streamResponse(resp);
        finalContent += content;

        if (toolCalls.length === 0) break;

        const { createdPaths, toolResults } = executeToolCalls(toolCalls);
        allCreated.push(...createdPaths);

        // If only write/delete/rename (no query tools), we're done
        if (!hasQueryTools(toolCalls)) break;

        // Build assistant message with tool_calls + tool results for next round
        msgs.push({
          role: "assistant",
          content: content || "",
        });
        for (const tr of toolResults) {
          msgs.push({
            role: "tool",
            content: tr.result,
            tool_call_id: tr.id,
          });
        }
      }

      return { content: finalContent, createdPaths: allCreated };
    },
    [callAI, streamResponse, executeToolCalls]
  );

  const sendMessage = useCallback(
    async (input: string) => {
      let currentProject = project;
      if (!currentProject) currentProject = createNewProject("Nero Project");

      const context = getSystemContext();
      const augmentedInput = context ? `${input}${context}` : input;

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: input };
      addChatMessage(userMsg);
      setIsLoading(true);
      setStreamingContent("");
      setPendingPlan(null);
      setToolActivity([]);

      const allMessages = [
        ...(currentProject.chatMessages || []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: augmentedInput },
      ];

      try {
        const { content: assistantContent, createdPaths } = await runWithToolLoop(allMessages);

        let displayContent = assistantContent;
        if (!displayContent.trim() && createdPaths.length > 0) {
          displayContent = `✅ Created ${createdPaths.length} file(s): \`${createdPaths.join("`, `")}\``;
        }

        const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: displayContent };
        addChatMessage(assistantMsg);
        setStreamingContent("");

        if (createdPaths.length === 0) {
          const files = parseAndAddFiles(assistantContent);
          if (files.length === 0) {
            const plan = parsePlan(assistantContent);
            if (plan) { setPendingPlan(plan); setPendingInput(input); }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        const errMsg = err instanceof Error ? err.message : "Unknown";
        addConsoleLog(`❌ Error: ${errMsg}`);
        let userFacingMsg = `⚠️ Something went wrong: ${errMsg}`;
        if (errMsg.includes("402")) userFacingMsg = "⚠️ **AI credits have run out.** Please add credits under Settings → Workspace → Usage.";
        else if (errMsg.includes("429")) userFacingMsg = "⚠️ **Rate limited.** Please wait a moment and try again.";
        addChatMessage({ id: crypto.randomUUID(), role: "assistant", content: userFacingMsg });
      } finally {
        setIsLoading(false);
      }
    },
    [project, addChatMessage, parseAndAddFiles, addConsoleLog, createNewProject, runWithToolLoop, getSystemContext]
  );

  const approvePlan = useCallback(async () => {
    if (!pendingPlan) return;
    setPendingPlan(null);
    setIsLoading(true);
    setStreamingContent("");

    const generateMsg = `The user approved the plan. Generate all files using write_file.\nPlan:\n${pendingPlan.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nOriginal request: ${pendingInput}`;

    const allMessages = [
      ...(project?.chatMessages || []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: generateMsg },
    ];

    try {
      const { content, createdPaths } = await runWithToolLoop(allMessages);
      let displayContent = content;
      if (!displayContent.trim() && createdPaths.length > 0) {
        displayContent = `✅ Created ${createdPaths.length} file(s): \`${createdPaths.join("`, `")}\``;
      }
      if (createdPaths.length === 0) parseAndAddFiles(content);
      addChatMessage({ id: crypto.randomUUID(), role: "assistant", content: displayContent });
      setStreamingContent("");
    } catch (err) {
      addConsoleLog(`❌ Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setIsLoading(false);
    }
  }, [pendingPlan, pendingInput, project, runWithToolLoop, addChatMessage, parseAndAddFiles, addConsoleLog]);

  const editPlan = useCallback(
    (steps: string[]) => { setPendingPlan(steps); approvePlan(); },
    [approvePlan]
  );

  return { messages, isLoading, streamingContent, sendMessage, pendingPlan, approvePlan, editPlan, toolActivity };
}
