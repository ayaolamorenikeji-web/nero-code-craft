import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProject, ProjectFile } from "@/contexts/ProjectContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useNeroChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const { addFile, addConsoleLog, project, setProject } = useProject();
  const abortRef = useRef<AbortController | null>(null);

  const parseAndAddFiles = useCallback(
    (text: string) => {
      // Extract code blocks with filenames like ```html filename="index.html"
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

      if (files.length > 0 && !project) {
        setProject({
          id: crypto.randomUUID(),
          name: "Nero Project",
          files,
          createdAt: new Date(),
        });
      }

      return files;
    },
    [addFile, addConsoleLog, project, setProject]
  );

  const sendMessage = useCallback(
    async (input: string) => {
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setStreamingContent("");

      const allMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let assistantContent = "";

      try {
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
          if (resp.status === 429) {
            addConsoleLog("⚠️ Rate limited. Try again shortly.");
          } else if (resp.status === 402) {
            addConsoleLog("⚠️ Credits needed. Top up in settings.");
          }
          throw new Error(`Request failed: ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setStreamingContent(assistantContent);
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingContent("");

        // Parse files from response
        parseAndAddFiles(assistantContent);
      } catch (err) {
        console.error("Chat error:", err);
        addConsoleLog(`❌ Error: ${err instanceof Error ? err.message : "Unknown"}`);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, parseAndAddFiles, addConsoleLog]
  );

  return { messages, isLoading, streamingContent, sendMessage };
}
