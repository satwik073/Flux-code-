import { createOpenAI } from "@ai-sdk/openai";

/** Scitely base URL (OpenAI-compatible). */
const SCITELY_BASE_URL = "https://api.scitely.com/v1";
/** Scitely default model (Community tier). Override with SCITELY_MODEL in .env.local. */
const SCITELY_DEFAULT_MODEL = "glm-4.6";

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
  const model =
    process.env.SCITELY_MODEL?.trim() || SCITELY_DEFAULT_MODEL;
  return createOpenAI({
    baseURL: SCITELY_BASE_URL,
    apiKey: scitelyKey,
  })(model);
}
