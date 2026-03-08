import { useState, useCallback } from "react";
import { useProject, ProjectFile, ChatMessage } from "@/contexts/ProjectContext";

interface ParsedToolCall {
  id: string;
  name: string;
  arguments: string;
}

function inferLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "html",
    css: "css",
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    json: "json",
    py: "python",
    md: "markdown",
    txt: "markdown",
  };
  return map[ext] || "javascript";
}

export function useNeroChat() {
  const {
    project,
    activeFile,
    consoleOutput,
    addFile,
    addConsoleLog,
    addChatMessage,
    createNewProject,
  } = useProject();

  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string[] | null>(null);
  const [pendingInput, setPendingInput] = useState("");

  const messages = project?.chatMessages || [];

  /** Build context XML injected into the current user message */
  const getSystemContext = useCallback((): string => {
    const parts: string[] = [];

    // Currently open file (truncated for safety)
    if (activeFile) {
      const MAX = 8000;
      const content =
        activeFile.content.length > MAX
          ? activeFile.content.slice(0, MAX) + "\n... (truncated)"
          : activeFile.content;
      parts.push(
        `<current_file path="${activeFile.path}" language="${activeFile.language}">\n${content}\n</current_file>`
      );
    }

    // All project file paths
    const fileList = project?.files?.map((f) => f.path).join("\n");
    if (fileList) {
      parts.push(`<project_files>\n${fileList}\n</project_files>`);
    }

    // Recent terminal errors
    const errorLines = consoleOutput
      .slice(-30)
      .filter(
        (l) =>
          l.includes("❌") ||
          l.toLowerCase().includes("error") ||
          l.toLowerCase().includes("exception")
      );
    if (errorLines.length > 0) {
      parts.push(
        `<terminal_errors>\n${errorLines.join("\n")}\n</terminal_errors>`
      );
    }

    return parts.length > 0
      ? `\n\n<context>\n${parts.join("\n\n")}\n</context>`
      : "";
  }, [activeFile, project, consoleOutput]);

  /** Parse legacy markdown code-block format as fallback */
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

  const parsePlan = (text: string): string[] | null => {
    const lines = text
      .split("\n")
      .filter((l) => /^\d+[\.\)]\s/.test(l.trim()));
    if (lines.length >= 2)
      return lines.map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim());
    return null;
  };

  const callAI = useCallback(
    async (allMessages: { role: string; content: string }[]) => {
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
        if (resp.status === 429) addConsoleLog("⚠️ Rate limited. Try again shortly.");
        else if (resp.status === 402) addConsoleLog("⚠️ Credits needed.");
        throw new Error(`Request failed: ${resp.status}`);
      }
      return resp;
    },
    [addConsoleLog]
  );

  /** Stream SSE response, collecting both text content and tool calls */
  const streamResponse = useCallback(
    async (
      resp: Response
    ): Promise<{ content: string; toolCalls: ParsedToolCall[] }> => {
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      const toolCallsMap: Record<
        number,
        { id: string; name: string; argsBuffer: string }
      > = {};

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

            // Text content
            if (delta?.content) {
              content += delta.content;
              setStreamingContent(content);
            }

            // Tool call chunks
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx: number = tc.index ?? 0;
                if (!toolCallsMap[idx]) {
                  toolCallsMap[idx] = { id: "", name: "", argsBuffer: "" };
                }
                if (tc.id) toolCallsMap[idx].id = tc.id;
                if (tc.function?.name)
                  toolCallsMap[idx].name = tc.function.name;
                if (tc.function?.arguments)
                  toolCallsMap[idx].argsBuffer += tc.function.arguments;
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

  /** Execute write_file tool calls returned by the AI */
  const executeToolCalls = useCallback(
    (toolCalls: ParsedToolCall[]): string[] => {
      const createdPaths: string[] = [];
      for (const tc of toolCalls) {
        if (tc.name === "write_file") {
          try {
            const args = JSON.parse(tc.arguments);
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
          } catch (e) {
            addConsoleLog(`❌ Tool error (write_file): ${e}`);
          }
        }
      }
      return createdPaths;
    },
    [addFile, addConsoleLog]
  );

  const sendMessage = useCallback(
    async (input: string) => {
      let currentProject = project;
      if (!currentProject) currentProject = createNewProject("Nero Project");

      // Inject context into the outgoing message (not stored in chat history)
      const context = getSystemContext();
      const augmentedInput = context ? `${input}${context}` : input;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: input, // store clean version
      };
      addChatMessage(userMsg);
      setIsLoading(true);
      setStreamingContent("");
      setPendingPlan(null);

      // Build full history + augmented current message
      const allMessages = [
        ...(currentProject.chatMessages || []).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user", content: augmentedInput },
      ];

      try {
        const resp = await callAI(allMessages);
        const { content: assistantContent, toolCalls } =
          await streamResponse(resp);

        let displayContent = assistantContent;

        // Execute any tool calls
        if (toolCalls.length > 0) {
          const created = executeToolCalls(toolCalls);
          // If the AI produced no text, generate a brief confirmation
          if (!displayContent.trim() && created.length > 0) {
            displayContent = `✅ Created ${created.length} file(s): \`${created.join("`, `")}\``;
          }
        }

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: displayContent,
        };
        addChatMessage(assistantMsg);
        setStreamingContent("");

        // Fallback: parse legacy markdown blocks if no tool calls fired
        if (toolCalls.length === 0) {
          const files = parseAndAddFiles(assistantContent);
          if (files.length === 0) {
            const plan = parsePlan(assistantContent);
            if (plan) {
              setPendingPlan(plan);
              setPendingInput(input);
            }
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        const errMsg = err instanceof Error ? err.message : "Unknown";
        addConsoleLog(`❌ Error: ${errMsg}`);

        let userFacingMsg = `⚠️ Something went wrong: ${errMsg}`;
        if (errMsg.includes("402")) {
          userFacingMsg =
            "⚠️ **AI credits have run out.** Please add credits to your Lovable workspace under Settings → Workspace → Usage, then try again.";
        } else if (errMsg.includes("429")) {
          userFacingMsg =
            "⚠️ **Rate limited.** Too many requests — please wait a moment and try again.";
        }

        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: userFacingMsg,
        };
        addChatMessage(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [
      project,
      addChatMessage,
      parseAndAddFiles,
      addConsoleLog,
      createNewProject,
      callAI,
      streamResponse,
      getSystemContext,
      executeToolCalls,
    ]
  );

  const approvePlan = useCallback(async () => {
    if (!pendingPlan) return;
    setPendingPlan(null);
    setIsLoading(true);
    setStreamingContent("");

    const generateMsg = `The user approved the plan. Now generate the complete code files using the write_file tool for each file.\nPlan:\n${pendingPlan
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n")}\n\nOriginal request: ${pendingInput}`;

    const allMessages = [
      ...(project?.chatMessages || []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: generateMsg },
    ];

    try {
      const resp = await callAI(allMessages);
      const { content, toolCalls } = await streamResponse(resp);

      let displayContent = content;
      if (toolCalls.length > 0) {
        const created = executeToolCalls(toolCalls);
        if (!displayContent.trim() && created.length > 0) {
          displayContent = `✅ Created ${created.length} file(s): \`${created.join("`, `")}\``;
        }
      } else {
        parseAndAddFiles(content);
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: displayContent,
      };
      addChatMessage(assistantMsg);
      setStreamingContent("");
    } catch (err) {
      addConsoleLog(
        `❌ Error: ${err instanceof Error ? err.message : "Unknown"}`
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    pendingPlan,
    pendingInput,
    project,
    callAI,
    streamResponse,
    addChatMessage,
    parseAndAddFiles,
    addConsoleLog,
    executeToolCalls,
  ]);

  const editPlan = useCallback(
    (steps: string[]) => {
      setPendingPlan(steps);
      approvePlan();
    },
    [approvePlan]
  );

  return {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    pendingPlan,
    approvePlan,
    editPlan,
  };
}
