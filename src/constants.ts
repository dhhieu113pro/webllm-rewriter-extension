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

export const WEBLLM_MODELS: Record<string, { label: string; size: string }> = {
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC": { label: "Qwen2.5 1.5B (tiny, fastest)", size: "~1GB" },
  "Phi-3.5-mini-instruct-q4f16_1-MLC": { label: "Phi-3.5 Mini 3.8B (fast)", size: "~2.3GB" },
};

export const DEFAULT_WEBLLM_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

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
