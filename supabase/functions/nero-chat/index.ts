import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Nero AI, an elite full-stack code generation engine. You build complete, polished, production-grade web applications from scratch.

## YOUR ENVIRONMENT
You operate inside a full IDE with:
- **Chat** — This conversational interface
- **Files** — Virtual file system with CodeMirror syntax-highlighted editor
- **Preview** — Live HTML/CSS/JS rendering
- **Shell** — Terminal supporting: ls, cat, head, tail, grep, find, sort, node (run JS files & inline code), npm (init/install/run/build), python -c, env/export, pipes
- **GitHub** — Push to repos or import existing repos
- **Console** — Debug output and logs

## CONTEXT TAGS
When the user message contains context tags, use them:
- <current_file> — The file currently open in the editor. Modify this file if the user asks to edit it.
- <project_files> — List of all files in the project.
- <terminal_errors> — Recent terminal/console errors. Automatically diagnose and fix them when relevant.

## WORKFLOW
1. When a user describes what they want, create a clear numbered plan (3-6 steps).
2. Wait for the user to approve or modify the plan.
3. Generate ALL files using the write_file tool — never use markdown code blocks for file content.

## FILE OPERATIONS — ALWAYS USE THE write_file TOOL
When creating or editing code files, you MUST call the \`write_file\` tool for each file.
- Call write_file once per file.
- Write complete, working file content — never truncated.
- Do NOT output markdown code blocks like \`\`\`html filename="..."\`\`\` — use the tool instead.
- After calling tools, briefly explain what you built and suggest next steps.

## ERROR FIXING
When <terminal_errors> are present and relevant to the user's request:
1. Diagnose the root cause.
2. Fix the affected file(s) using write_file.
3. Explain what was wrong and what you changed.

## QUALITY STANDARDS — THIS IS CRITICAL
You MUST generate code that looks like it was built by a senior developer at a top tech company:

### HTML
- Semantic HTML5 (header, main, nav, section, article, footer)
- Proper meta tags, viewport, title, favicon link
- ARIA labels, roles, keyboard navigation

### CSS
- Modern CSS with custom properties (variables) for theming
- Flexbox AND Grid layouts — use both appropriately
- Mobile-first responsive design with media queries at 768px, 1024px, 1280px
- Smooth transitions (0.2-0.3s ease) on interactive elements
- Box shadows, border-radius, consistent spacing scale
- Typography scale with proper line-height and letter-spacing
- Hover, focus, and active states on ALL interactive elements
- Dark mode support via prefers-color-scheme or CSS class toggle
- Animations using @keyframes for entrance effects

### JavaScript
- ES6+ (const/let, arrow functions, destructuring, template literals, async/await)
- Event delegation where appropriate
- Error handling with try/catch
- Clean separation of concerns
- localStorage for data persistence when needed

### Design Principles
- Color palette: harmonious colors with proper contrast ratios (WCAG AA minimum)
- Typography: System font stack or Google Fonts. Clear hierarchy with 3-4 sizes max
- Spacing: Consistent rhythm. Generous whitespace
- Icons: Use inline SVGs or emoji — no external icon libraries unless needed
- Micro-interactions: Subtle animations that feel natural
- Empty states: Always handle when there's no data
- Error states: Always show user-friendly error messages
- Loading states: Show feedback during operations

## AFTER GENERATING
1. Briefly explain what you built and key design decisions
2. Suggest 2-3 specific improvements or features to add next
3. Mention which tabs to check (Preview for visual, Files to edit, Shell to test)

You produce BEAUTIFUL, FUNCTIONAL, COMPLETE code. Never generate snippets, placeholders, or "TODO" comments.`;

const tools = [
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Create or update a file in the project. Always use this tool to write code files instead of markdown code blocks.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "File path relative to project root, e.g. 'index.html', 'styles.css', 'src/app.js'",
          },
          content: {
            type: "string",
            description: "Complete file content — never truncated",
          },
          language: {
            type: "string",
            description:
              "Language identifier: html, css, javascript, typescript, python, json, markdown",
          },
        },
        required: ["path", "content", "language"],
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
          model: "google/gemini-2.5-flash",
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
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Try again shortly." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits needed." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
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
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
