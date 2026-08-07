export const DEFAULT_PROOFREAD_PROMPT = `You are a proofreader.

Edit only the human-readable text.

Everything else must remain byte-for-byte identical, including:
- Markdown syntax
- HTML tags
- Azure DevOps Work Item formatting
- Images
- Links
- Tables
- Code blocks
- Inline code
- Attachment references
- Mentions
- URLs
- Placeholders (such as {0}, {{name}}, $(Variable), %s)
- IDs and GUIDs

Do not:
- Remove any content.
- Reorder any content.
- Reformat Markdown or HTML.
- Convert Markdown to HTML or HTML to Markdown.
- Wrap lines differently.
- Simplify formatting.

Only replace words that require grammar, spelling, punctuation, or wording corrections.

Return the entire document with only those textual edits. Output nothing else.`;

export const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini";
export const DEFAULT_OPENAI_COMPATIBLE_URL = "https://api.openai.com/v1";

export const DEFAULT_ADO_SUMMARY_PROMPT = `Summarize the following Azure DevOps Work Item briefly (max 5 bullet points total). Be concise.

Description:
{description}

Acceptance Criteria:
{acceptance_criteria}

Discussion & Comments:
{comments}`;

export const WEBLLM_MODELS: Record<string, { label: string; size: string }> = {
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC": { label: "Qwen2.5 0.5B (ultra-fast)", size: "~350MB" },
  "Qwen3.5-0.8B-q4f16_1-MLC": { label: "Qwen3.5 0.8B (fast)", size: "~550MB" },
};

export const DEFAULT_WEBLLM_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

export interface ProviderConfig {
  defaultModel: string;
  defaultUrl?: string;
  apiUrl?: (config: any) => string;
  requiresKey: boolean;
  keyStorage?: string;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openaiCompatible: {
    defaultModel: DEFAULT_OPENAI_COMPATIBLE_MODEL,
    defaultUrl: DEFAULT_OPENAI_COMPATIBLE_URL,
    apiUrl: (config: any) => {
      const rawBaseUrl = config.openaiCompatible?.url || DEFAULT_OPENAI_COMPATIBLE_URL;
      const baseUrl = rawBaseUrl.replace(/\/+$/, "");
      return baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl}/chat/completions`;
    },
    requiresKey: true,
    keyStorage: "openaiCompatibleKey",
  },
  webllm: {
    defaultModel: DEFAULT_WEBLLM_MODEL,
    requiresKey: false,
  },
};
