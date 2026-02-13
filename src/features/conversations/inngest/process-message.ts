import { createAgent, openai, createNetwork } from '@inngest/agent-kit';
// import { anthropic, gemini } from '@inngest/agent-kit'; // Commented out — using Groq only for now

import { inngest } from "@/inngest/client";
import { Id } from "../../../../convex/_generated/dataModel";
import { NonRetriableError } from "inngest";
import { convex } from "@/lib/convex-client";
import { api } from "../../../../convex/_generated/api";
import {
  CODING_AGENT_SYSTEM_PROMPT,
  TITLE_GENERATOR_SYSTEM_PROMPT
} from "./constants";
import { DEFAULT_CONVERSATION_TITLE } from "../constants";
import { createReadFilesTool } from './tools/read-files';
import { createListFilesTool } from './tools/list-files';
import { createUpdateFileTool } from './tools/update-file';
import { createCreateFilesTool } from './tools/create-files';
import { createCreateFolderTool } from './tools/create-folder';
import { createRenameFileTool } from './tools/rename-file';
import { createDeleteFilesTool } from './tools/delete-files';
import { createScrapeUrlsTool } from './tools/scrape-urls';

interface MessageEvent {
  messageId: Id<"messages">;
  conversationId: Id<"conversations">;
  projectId: Id<"projects">;
  message: string;
  /** Optional model id from UI (e.g. llama-3.3-70b-versatile). */
  model?: string;
}

/** Scitely (free unlimited) — prefer when SCITELY_API_KEY is set. Model IDs are lowercase (see platform.scitely.com/docs/models). */
const SCITELY_BASE_URL = "https://api.scitely.com/v1";
/** GLM 4.6 (Zhipu AI) for code editing; alternatives: qwen3-coder-plus, deepseek-r1, qwen3-32b */
const DEFAULT_SCITELY_MODEL = "deepseek-v3.2";

/** Groq default coding model (Llama). */
const DEFAULT_GROQ_CODING_MODEL = "llama-3.3-70b-versatile";
/** Groq default title model (lighter). */
const DEFAULT_GROQ_TITLE_MODEL = "llama-3.1-8b-instant";

/** Use Scitely if key set, else Groq. */
function getCodingModel() {
  const scitelyKey = process.env.SCITELY_API_KEY;
  if (scitelyKey) {
    const model = process.env.FLUX_SCITELY_MODEL?.trim() || DEFAULT_SCITELY_MODEL;
    return openai({
      model,
      baseUrl: SCITELY_BASE_URL,
      apiKey: scitelyKey,
      defaultParameters: { temperature: 0.3, max_completion_tokens: 16000 },
    });
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new NonRetriableError(
      "No AI API key. Set SCITELY_API_KEY (platform.scitely.com) or GROQ_API_KEY (console.groq.com) in .env.local."
    );
  }
  return openai({
    model: DEFAULT_GROQ_CODING_MODEL,
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: key,
    defaultParameters: { temperature: 0.3, max_completion_tokens: 16000 },
  });
}

/** Use Scitely if key set, else Groq. */
function getTitleModel() {
  const scitelyKey = process.env.SCITELY_API_KEY;
  if (scitelyKey) {
    return openai({
      model: DEFAULT_SCITELY_MODEL,
      baseUrl: SCITELY_BASE_URL,
      apiKey: scitelyKey,
      defaultParameters: { temperature: 0, max_completion_tokens: 50 },
    });
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new NonRetriableError("SCITELY_API_KEY or GROQ_API_KEY is not set in .env.local.");
  }
  return openai({
    model: DEFAULT_GROQ_TITLE_MODEL,
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: key,
    defaultParameters: { temperature: 0, max_completion_tokens: 50 },
  });
}

/** Build model from UI-selected model id. Uses Scitely if SCITELY_API_KEY set, else Groq. */
function getCodingModelFromId(modelId: string) {
  const id = modelId.trim();
  const scitelyKey = process.env.SCITELY_API_KEY;
  if (scitelyKey) {
    return openai({
      model: id,
      baseUrl: SCITELY_BASE_URL,
      apiKey: scitelyKey,
      defaultParameters: { temperature: 0.3, max_completion_tokens: 16000 },
    });
  }
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new NonRetriableError("SCITELY_API_KEY or GROQ_API_KEY is not set in .env.local.");
  }
  return openai({
    model: id,
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: key,
    defaultParameters: { temperature: 0.3, max_completion_tokens: 16000 },
  });
}

// --- Commented out: Anthropic + Gemini (uncomment and add back getCodingModel/getTitleModel branches to re-enable) ---
// const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
// function getGeminiModel(): string {
//   const env = process.env.FLUX_GEMINI_MODEL?.trim();
//   return env || DEFAULT_GEMINI_MODEL;
// }
// Anthropic: anthropic({ model: "claude-opus-4-20250514", defaultParameters: { temperature: 0.3, max_tokens: 16000 } })
// Gemini: gemini({ model: getGeminiModel(), apiKey: key, defaultParameters: { generationConfig: { temperature: 0.3, maxOutputTokens: 16000 } } })

export const processMessage = inngest.createFunction(
  {
    id: "process-message",
    cancelOn: [
      {
        event: "message/cancel",
        if: "event.data.messageId == async.data.messageId",
      },
    ],
    onFailure: async ({ event, step }) => {
      const { messageId } = event.data.event.data as MessageEvent;
      const internalKey = process.env.FLUX_CONVEX_INTERNAL_KEY;

      // Update the message with error content
      if (internalKey) {
        await step.run("update-message-on-failure", async () => {
          await convex.mutation(api.system.updateMessageContent, {
            internalKey,
            messageId,
            content:
              "My apologies, I encountered an error while processing your request. Let me know if you need anything else!",
          });
        });
      }
    }
  },
  {
    event: "message/sent",
  },
  async ({ event, step }) => {
    const {
      messageId,
      conversationId,
      projectId,
      message,
      model: eventModel,
    } = event.data as MessageEvent;

    const internalKey = process.env.FLUX_CONVEX_INTERNAL_KEY; 

    if (!internalKey) {
      throw new NonRetriableError("FLUX_CONVEX_INTERNAL_KEY is not configured");
    }

    // TODO: Check if this is needed
    await step.sleep("wait-for-db-sync", "1s");

    // Get conversation for title generation check
    const conversation = await step.run("get-conversation", async () => {
      return await convex.query(api.system.getConversationById, {
        internalKey,
        conversationId,
      });
    });

    if (!conversation) {
      throw new NonRetriableError("Conversation not found");
    }

    // Fetch recent messages for conversation context
    const recentMessages = await step.run("get-recent-messages", async () => {
      return await convex.query(api.system.getRecentMessages, {
        internalKey,
        conversationId,
        limit: 10,
      });
    });

    // Build system prompt with conversation history (exclude the current processing message)
    let systemPrompt = CODING_AGENT_SYSTEM_PROMPT;

    // Filter out the current processing message and empty messages
    const contextMessages = recentMessages.filter(
      (msg) => msg._id !== messageId && msg.content.trim() !== ""
    );

    if (contextMessages.length > 0) {
      const historyText = contextMessages
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n\n");

      systemPrompt += `\n\n## Previous Conversation (for context only - do NOT repeat these responses):\n${historyText}\n\n## Current Request:\nRespond ONLY to the user's new message below. Do not repeat or reference your previous responses.`;
    }

    // Generate conversation title if it's still the default
    const shouldGenerateTitle =
      conversation.title === DEFAULT_CONVERSATION_TITLE;

    if (shouldGenerateTitle) {
      const titleAgent = createAgent({
        name: "title-generator",
        system: TITLE_GENERATOR_SYSTEM_PROMPT,
        model: getTitleModel(),
      });

       const { output } = await titleAgent.run(message, { step });

       const textMessage = output.find(
        (m) => m.type === "text" && m.role === "assistant"
      );

      if (textMessage?.type === "text") {
         const title = 
          typeof textMessage.content === "string"
            ? textMessage.content.trim()
            : textMessage.content
              .map((c) => c.text)
              .join("")
              .trim();

        if (title) {
          await step.run("update-conversation-title", async () => {
            await convex.mutation(api.system.updateConversationTitle, {
              internalKey,
              conversationId,
              title,
            });
          });
        }
      }
    }

    // Create the coding agent with file tools (use UI-selected model if provided)
    const codingModel = eventModel ? getCodingModelFromId(eventModel) : getCodingModel();
    const codingAgent = createAgent({
      name: "flux",
      description: "An expert AI coding assistant",
      system: systemPrompt,
      model: codingModel,
      tools: [
        createListFilesTool({ internalKey, projectId }),
        createReadFilesTool({ internalKey }),
        createUpdateFileTool({ internalKey }),
        createCreateFilesTool({ projectId, internalKey }),
        createCreateFolderTool({ projectId, internalKey }),
        createRenameFileTool({ internalKey }),
        createDeleteFilesTool({ internalKey }),
        createScrapeUrlsTool(),
       ],
    });

    // Create network with single agent
    const network = createNetwork({
      name: "flux-network",
      agents: [codingAgent],
      maxIter: 20,
      router: ({ network }) => {
        const lastResult = network.state.results.at(-1);
        const hasTextResponse = lastResult?.output.some(
          (m) => m.type === "text" && m.role === "assistant"
        );
        const hasToolCalls = lastResult?.output.some(
          (m) => m.type === "tool_call"
        );

        // Anthropic outputs text AND tool calls together
        // Only stop if there's text WITHOUT tool calls (final response)
        if (hasTextResponse && !hasToolCalls) {
          return undefined;
        }
        return codingAgent;
      }
    });

    // Run the agent (Groq can sometimes return null tool.function — we patch agent-kit to filter those)
    let assistantResponse: string;
    try {
      const result = await network.run(message);

      const lastResult = result.state.results.at(-1);
      const textMessage = lastResult?.output.find(
        (m) => m.type === "text" && m.role === "assistant"
      );

      assistantResponse =
        textMessage?.type === "text"
          ? typeof textMessage.content === "string"
            ? textMessage.content
            : textMessage.content.map((c) => c.text).join("")
          : "I processed your request. Let me know if you need anything else!";
    } catch (err) {
      // Groq/Llama sometimes return tool_calls with null function/arguments, causing "Cannot read properties of null (reading 'arguments')"
      const msg = err instanceof Error ? err.message : String(err);
      assistantResponse =
        msg.includes("null") && msg.includes("arguments")
          ? "The model returned an invalid tool call (Groq quirk). Please try again or rephrase your request."
          : `Something went wrong: ${msg}`;
    }

    await step.run("update-assistant-message", async () => {
      await convex.mutation(api.system.updateMessageContent, {
        internalKey,
        messageId,
        content: assistantResponse,
      })
    });

    return { success: true, messageId, conversationId };
  }
);

