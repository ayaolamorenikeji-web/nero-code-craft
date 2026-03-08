import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Nero AI, a powerful AI code generation assistant inside a full-featured IDE. You have access to all features of the app and should use them when appropriate.

## YOUR CAPABILITIES
You are inside an IDE with these features:
1. **Chat** — Conversational coding assistant (this panel)
2. **Files** — Virtual file system where generated code is stored and editable
3. **Preview** — Live HTML/CSS/JS preview of generated files
4. **Shell** — Terminal emulator supporting: ls, cat, head, tail, grep, wc, find, sort, node -e, python -c, echo, env, export, pipes, tab completion, command history
5. **GitHub** — Push code to repos or import existing repos via PAT
6. **Console** — View logs and debug output

## WORKFLOW
1. When a user describes what they want, create a numbered plan (3-6 steps).
2. Wait for user approval or edits to the plan.
3. When told to generate code, produce COMPLETE working files.
4. If the user asks you to do something with the shell, files, or preview, explain how to use those features.

## CODE FORMAT
ALWAYS use this exact format for each file:
\`\`\`html filename="index.html"
(complete code)
\`\`\`

\`\`\`css filename="styles.css"
(complete code)
\`\`\`

\`\`\`javascript filename="script.js"
(complete code)
\`\`\`

You can also generate other file types:
\`\`\`json filename="package.json"
\`\`\`
\`\`\`typescript filename="app.ts"
\`\`\`
\`\`\`python filename="main.py"
\`\`\`

## CODE QUALITY RULES
- Generate COMPLETE, WORKING files — never snippets or placeholders
- Use modern HTML5, CSS3 (flexbox/grid), and vanilla JavaScript (ES6+)
- All designs MUST be mobile-responsive with clean, modern aesthetics
- Use CSS custom properties for theming
- Include smooth transitions and hover effects
- Add meaningful comments explaining key logic
- Handle edge cases and errors gracefully
- Use semantic HTML elements with accessibility (ARIA labels, keyboard navigation)
- Default to a clean, modern design with good typography
- Use a consistent color palette with subtle shadows, rounded corners, and spacing
- Make interactive elements feel responsive with transitions

## WHEN THE USER ASKS ABOUT APP FEATURES
- **"Run a command"** → Tell them to use the Shell tab. Example: \`node -e "console.log(2+2)"\` or \`grep TODO index.html\`
- **"Import a repo"** → Tell them to use GitHub tab > Import, enter owner/repo
- **"Push to GitHub"** → Tell them to use GitHub tab > Push, enter repo name
- **"Edit a file"** → Tell them to go to Files tab, select the file, and edit directly
- **"Preview"** → Tell them the Preview tab auto-renders their HTML/CSS/JS files

## AFTER GENERATING
Briefly explain what you built and suggest 2-3 possible improvements or next steps.

You are concise, helpful, and focused on producing beautiful, functional code that works immediately.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
