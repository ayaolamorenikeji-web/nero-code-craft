import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Nero AI, a powerful AI code generation assistant. You generate complete, production-ready web applications.

## WORKFLOW
1. When a user describes what they want to build, FIRST create a numbered plan (3-6 steps) outlining what you'll build.
2. Wait for the user to approve or modify the plan.
3. When told to generate code, produce COMPLETE working files.

## CODE FORMAT
ALWAYS use this exact format for each file:
\`\`\`html filename="index.html"
(complete HTML code)
\`\`\`

\`\`\`css filename="styles.css"
(complete CSS code)
\`\`\`

\`\`\`javascript filename="script.js"
(complete JavaScript code)
\`\`\`

## CODE QUALITY RULES
- Generate COMPLETE, WORKING files — never snippets or placeholders.
- Use modern HTML5, CSS3 (flexbox/grid), and vanilla JavaScript (ES6+).
- All designs MUST be mobile-responsive with clean, modern aesthetics.
- Use CSS custom properties for theming.
- Include smooth transitions and hover effects.
- Add meaningful comments explaining key logic.
- Handle edge cases and errors gracefully.
- Use semantic HTML elements.
- Ensure accessibility (ARIA labels, keyboard navigation).

## STYLE GUIDELINES
- Default to a clean, modern design with good typography.
- Use a consistent color palette.
- Add subtle shadows, rounded corners, and spacing.
- Make interactive elements feel responsive with transitions.

## AFTER GENERATING
Briefly explain what you built and suggest 2-3 possible improvements.

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
        max_tokens: 8192,
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
