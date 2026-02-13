import { generateText } from "ai";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getTextModel } from "@/lib/ai-model";

const SUGGESTION_PROMPT = `You are a code suggestion assistant.

<context>
<file_name>{fileName}</file_name>
<previous_lines>
{previousLines}
</previous_lines>
<current_line number="{lineNumber}">{currentLine}</current_line>
<before_cursor>{textBeforeCursor}</before_cursor>
<after_cursor>{textAfterCursor}</after_cursor>
<next_lines>
{nextLines}
</next_lines>
<full_code>
{code}
</full_code>
</context>

<instructions>
Follow these steps IN ORDER:

1. Analyze the cursor position relative to the code structure. If next_lines effectively duplicates what you would suggest, return EMPTY.


2. If next_lines effectively duplicates what you would suggest, return EMPTY. But if next_lines is just a closing brace or unrelated code, provide a suggestion.

3. Even if before_cursor ends with '}', do NOT automatically return empty; check if more code (like 'else', 'catch', or another function) makes sense.

Your suggestion is inserted immediately after the cursor, so never suggest code that's already in the file.

Respond with ONLY the code to insert, or the single word EMPTY (no quotes) when no completion is needed. No other text or explanation. suggestio should never be empty send anything

</instructions>`;

export async function POST(request: Request) {
  try {
    const authObj = await auth();
    let userId = authObj.userId;

    if (!userId && process.env.NODE_ENV === "development") {
      console.log("[POST /api/suggestion] Dev mode: Bypassing auth check");
      userId = "dev-user";
    }

    if (!userId) {
      console.warn("[POST /api/suggestion] Unauthorized request");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      console.warn("[POST /api/suggestion] Invalid JSON body", e);
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const {
      fileName,
      code,
      currentLine,
      previousLines,
      textBeforeCursor,
      textAfterCursor,
      nextLines,
      lineNumber,
    } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      );
    }

    const prompt = SUGGESTION_PROMPT
      .replace("{fileName}", fileName)
      .replace("{code}", () => code)
      .replace("{currentLine}", () => currentLine)
      .replace("{previousLines}", () => previousLines || "")
      .replace("{textBeforeCursor}", () => textBeforeCursor)
      .replace("{textAfterCursor}", () => textAfterCursor)
      .replace("{nextLines}", () => nextLines || "")
      .replace("{lineNumber}", () => lineNumber.toString());

    const model = getTextModel();
    const { text } = await generateText({
      model,
      messages: [{ role: "user", content: prompt }],
    });

    console.log("[POST /api/suggestion] Prompt generated text:", text);

    const raw = (text ?? "").trim();
    const suggestion =
      raw.toUpperCase() === "EMPTY" || raw === "" ? "" : raw;

    console.log("[POST /api/suggestion] Final suggestion:", suggestion || "(empty)");

    return NextResponse.json({ suggestion });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/suggestion]", msg, {
      error: err,
      url: err.url,
      status: err.status || err.statusCode,
      body: err.responseBody,
    });
    return NextResponse.json(
      {
        error: "Failed to generate suggestion",
        ...(process.env.NODE_ENV === "development" && { details: msg }),
      },
      { status: 500 }
    );
  }
}
