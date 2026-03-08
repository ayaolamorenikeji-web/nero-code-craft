import { useState, useCallback } from "react";
import { useProject, ProjectFile, ChatMessage } from "@/contexts/ProjectContext";

export function useNeroChat() {
  const { project, addFile, addConsoleLog, addChatMessage, createNewProject } = useProject();
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingPlan, setPendingPlan] = useState<string[] | null>(null);
  const [pendingInput, setPendingInput] = useState("");

  const messages = project?.chatMessages || [];

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
    // Look for numbered plan steps like "1. Do X\n2. Do Y"
    const lines = text.split("\n").filter((l) => /^\d+[\.\)]\s/.test(l.trim()));
    if (lines.length >= 2) return lines.map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim());
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

  const streamResponse = useCallback(async (resp: Response): Promise<string> => {
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

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
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            content += delta;
            setStreamingContent(content);
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
    return content;
  }, []);

  const sendMessage = useCallback(
    async (input: string) => {
      let currentProject = project;
      if (!currentProject) currentProject = createNewProject("Nero Project");

      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: input };
      addChatMessage(userMsg);
      setIsLoading(true);
      setStreamingContent("");
      setPendingPlan(null);

      const allMessages = [...(currentProject.chatMessages || []), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const resp = await callAI(allMessages);
        const assistantContent = await streamResponse(resp);

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent,
        };
        addChatMessage(assistantMsg);
        setStreamingContent("");

        // Check for plan vs code
        const files = parseAndAddFiles(assistantContent);
        if (files.length === 0) {
          const plan = parsePlan(assistantContent);
          if (plan) {
            setPendingPlan(plan);
            setPendingInput(input);
          }
        }
      } catch (err) {
        console.error("Chat error:", err);
        const errMsg = err instanceof Error ? err.message : "Unknown";
        addConsoleLog(`❌ Error: ${errMsg}`);
        
        // Show error as assistant message so user sees it in chat
        let userFacingMsg = `⚠️ Something went wrong: ${errMsg}`;
        if (errMsg.includes("402")) {
          userFacingMsg = "⚠️ **AI credits have run out.** Please add credits to your Lovable workspace under Settings → Workspace → Usage, then try again.";
        } else if (errMsg.includes("429")) {
          userFacingMsg = "⚠️ **Rate limited.** Too many requests — please wait a moment and try again.";
        }
        
        const errorMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: userFacingMsg };
        addChatMessage(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [project, addChatMessage, parseAndAddFiles, addConsoleLog, createNewProject, callAI, streamResponse]
  );

  const approvePlan = useCallback(async () => {
    if (!pendingPlan) return;
    setPendingPlan(null);
    setIsLoading(true);
    setStreamingContent("");

    const generateMsg = `The user approved the plan. Now generate the complete code files. Follow the plan:\n${pendingPlan.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nOriginal request: ${pendingInput}`;

    const allMessages = [
      ...(project?.chatMessages || []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: generateMsg },
    ];

    try {
      const resp = await callAI(allMessages);
      const content = await streamResponse(resp);
      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content };
      addChatMessage(assistantMsg);
      setStreamingContent("");
      parseAndAddFiles(content);
    } catch (err) {
      addConsoleLog(`❌ Error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setIsLoading(false);
    }
  }, [pendingPlan, pendingInput, project, callAI, streamResponse, addChatMessage, parseAndAddFiles, addConsoleLog]);

  const editPlan = useCallback((steps: string[]) => {
    setPendingPlan(steps);
    approvePlan();
  }, [approvePlan]);

  return { messages, isLoading, streamingContent, sendMessage, pendingPlan, approvePlan, editPlan };
}
