import { createOpenAI } from "@ai-sdk/openai";

/** Scitely base URL (OpenAI-compatible). */
const SCITELY_BASE_URL = "https://api.scitely.com/v1";
/** Scitely default model (Community tier). Override with SCITELY_MODEL in .env.local. */
const SCITELY_DEFAULT_MODEL = "deepseek-v3.2";

/**
 * Get a text-generation model for suggestion/quick-edit APIs.
 * Scitely only (Groq free models don't support json_schema; Scitely is reliable for plain text).
 */
export function getTextModel() {
  const scitelyKey = process.env.SCITELY_API_KEY;
  if (!scitelyKey) {
    throw new Error(
      "Code completion uses Scitely only. Set SCITELY_API_KEY in .env.local (get a key at platform.scitely.com)."
    );
  }

  // Allow overriding base URL via env var, ensuring it handles compatibility
  const baseURL = process.env.SCITELY_BASE_URL || SCITELY_BASE_URL;
  const model = process.env.SCITELY_MODEL?.trim() || SCITELY_DEFAULT_MODEL;

  const openai = createOpenAI({
    baseURL,
    apiKey: scitelyKey,
  });

  return openai.chat(model);
}
