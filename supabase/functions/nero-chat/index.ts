import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Nero AI, an elite full-stack code generation engine inside a full IDE.

## YOUR ENVIRONMENT
- **Chat** — This conversational interface
- **Files** — Virtual file system with CodeMirror editor
- **Preview** — Live HTML/CSS/JS rendering
- **Shell** — Terminal (ls, cat, node, npm, grep, find, etc.)
- **Console** — Debug output and logs

## CONTEXT TAGS
- <current_file> — The file open in the editor
- <project_files> — All file paths in the project
- <terminal_errors> — Recent errors to diagnose

## TOOLS — USE THEM
You have these tools. ALWAYS use them instead of markdown code blocks:
- **write_file** — Create or update a file. Always write complete content.
- **read_file** — Read any file's content. Use to inspect before editing.
- **delete_file** — Remove a file from the project.
- **rename_file** — Move/rename a file.
- **list_files** — List all file paths in the project.
- **run_shell** — Execute a shell command (ls, cat, node, npm, grep, etc.)

## WORKFLOW
1. For new features: create a numbered plan (3-6 steps), wait for approval, then generate all files with write_file.
2. For edits: use read_file first if needed, then write_file with the complete updated content.
3. For debugging: use read_file and run_shell to inspect, then fix with write_file.

## QUALITY STANDARDS
- Semantic HTML5, modern CSS with variables, ES6+ JavaScript
- Mobile-first responsive design, dark mode support
- Proper error/loading/empty states
- WCAG AA contrast, ARIA labels, keyboard navigation
- Never output snippets, placeholders, or TODOs

## AFTER GENERATING
1. Briefly explain what you built
2. Suggest 2-3 improvements
3. Mention which tabs to check (Preview, Files, Shell)`;

const tools = [
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or update a file in the project. Write complete file content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path relative to project root" },
          content: { type: "string", description: "Complete file content" },
          language: { type: "string", description: "Language: html, css, javascript, typescript, python, json, markdown" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the content of a project file. Use to inspect files before editing.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to read" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description: "Delete a file from the project.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "File path to delete" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rename_file",
      description: "Rename or move a file.",
      parameters: {
        type: "object",
        properties: {
          old_path: { type: "string", description: "Current file path" },
          new_path: { type: "string", description: "New file path" },
        },
        required: ["old_path", "new_path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List all file paths in the project.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "run_shell",
      description: "Execute a shell command. Supports: ls, cat, head, tail, grep, find, node -e, npm, python -c, etc.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
        },
        required: ["command"],
      },
    },
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          tools,
          tool_choice: "auto",
          stream: true,
          temperature: 0.7,
          max_tokens: 16384,
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429 || status === 402) {
        return new Response(
          JSON.stringify({ error: status === 429 ? "Rate limited." : "Credits needed." }),
          { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("nero-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
