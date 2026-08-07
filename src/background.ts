"use strict";

import {
  MLCEngineInterface,
  CreateMLCEngine,
  InitProgressReport,
  ChatCompletionMessageParam,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";

import {
  DEFAULT_PROOFREAD_PROMPT,
  DEFAULT_ADO_SUMMARY_PROMPT,
  PROVIDER_CONFIGS,
  DEFAULT_WEBLLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_URL,
} from "./constants";

import { classifyImage } from "./visionEngine";

let engine: MLCEngineInterface | null = null;
let currentModel = DEFAULT_WEBLLM_MODEL;
let isLoading = false;
let gpuAvailable: boolean | null = null;

async function checkWebGPU(): Promise<boolean> {
  if (gpuAvailable !== null) return gpuAvailable;
  try {
    const adapter = await (navigator as any).gpu?.requestAdapter({ powerPreference: "high-performance" });
    gpuAvailable = !!adapter;
  } catch {
    gpuAvailable = false;
  }
  return gpuAvailable;
}

async function getEncryptionKey(): Promise<CryptoKey> {
  let storedKey = await chrome.storage.local.get(["encKey"]);
  if (storedKey.encKey) {
    const keyBuffer = Uint8Array.from(JSON.parse(storedKey.encKey)).buffer;
    return await crypto.subtle.importKey("raw", keyBuffer, "AES-GCM", false, ["encrypt", "decrypt"]);
  } else {
    const newKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const newKeyBuffer = await crypto.subtle.exportKey("raw", newKey);
    const newKeyString = JSON.stringify(Array.from(new Uint8Array(newKeyBuffer)));
    await chrome.storage.local.set({ encKey: newKeyString });
    return newKey;
  }
}

async function decryptData(encrypted: any): Promise<string> {
  if (!encrypted || !encrypted.iv || !encrypted.cipher) return "";
  try {
    const key = await getEncryptionKey();
    const iv = new Uint8Array(encrypted.iv);
    const cipher = new Uint8Array(encrypted.cipher);
    const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err) {
    console.error("[WebLLM] Decryption failed:", err);
    return "";
  }
}

async function getConfig() {
  const syncConfig = await chrome.storage.sync.get(null);
  const localConfig = await chrome.storage.local.get(["openaiCompatibleKey"]);

  const decryptedKey = localConfig.openaiCompatibleKey
    ? await decryptData(localConfig.openaiCompatibleKey)
    : "";

  return {
    provider: syncConfig.provider || "webllm",
    systemPrompt: syncConfig.systemPrompt || DEFAULT_PROOFREAD_PROMPT,
    copyToClipboard: syncConfig.copyToClipboard || false,
    selectedModel: syncConfig.selectedModel || DEFAULT_WEBLLM_MODEL,
    webllm: syncConfig.webllm || { model: DEFAULT_WEBLLM_MODEL },
    openaiCompatible: syncConfig.openaiCompatible || {
      model: DEFAULT_OPENAI_COMPATIBLE_MODEL,
      url: DEFAULT_OPENAI_COMPATIBLE_URL,
    },
    openaiCompatibleKey: decryptedKey,
  };
}

async function ensureEngine(modelId?: string): Promise<MLCEngineInterface> {
  const hasGpu = await checkWebGPU();
  if (!hasGpu) {
    throw new Error("WebGPU is not available. Please use Chrome 124+ with WebGPU support enabled.");
  }

  const config = await getConfig();
  const targetModel = modelId || config.webllm?.model || config.selectedModel || DEFAULT_WEBLLM_MODEL;

  if (engine && currentModel === targetModel) {
    return engine;
  }

  if (isLoading) {
    while (isLoading) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (engine && currentModel === targetModel) return engine;
  }

  isLoading = true;
  try {
    const progressCallback = (report: InitProgressReport) => {
      chrome.runtime.sendMessage({
        type: "loadProgress",
        text: report.text,
        progress: report.progress,
      }).catch(() => {});
    };

    engine = await CreateMLCEngine(targetModel, {
      initProgressCallback: progressCallback,
      appConfig: {
        model_list: [
          {
            model: `https://huggingface.co/mlc-ai/${targetModel}`,
            model_id: targetModel,
            model_lib: `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models-v0_2_48/${targetModel}.wasm`,
            overrides: {
              sliding_window_size: -1,
            },
          },
        ],
      },
    }).catch(async () => {
      return await CreateMLCEngine(targetModel, {
        initProgressCallback: progressCallback,
      });
    });
    currentModel = targetModel;
    return engine;
  } finally {
    isLoading = false;
  }
}

class StreamHandler {
  private decoder = new TextDecoder();
  private buffer = "";

  processChunk(value: Uint8Array, callback: (res: { chunk?: string; done?: boolean; error?: boolean; message?: string }) => void) {
    this.buffer += this.decoder.decode(value, { stream: true });
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const content = this.parseLine(line);
        if (content) callback({ chunk: content, done: false });
      } catch (e: any) {
        console.error("Parse error:", e, "Line:", line);
        callback({ error: true, message: "Parse error: " + e.message });
        return;
      }
    }
  }

  private parseLine(line: string): string | null {
    if (line.startsWith("data: ")) {
      const data = line.slice(6);
      if (data.trim() === "[DONE]") return null;
      const parsedData = JSON.parse(data);
      return parsedData?.choices?.[0]?.delta?.content || null;
    }
    return null;
  }

  async *generateChunks(reader: ReadableStreamDefaultReader<Uint8Array>) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  }

  getRemainingBuffer(): string {
    return this.buffer;
  }
}

class ApiConfigManager {
  constructor(private config: any) {}

  validate() {
    const provider = this.config.provider;
    const providerConfig = PROVIDER_CONFIGS[provider];
    if (!providerConfig) throw new Error(`Unknown provider: ${provider}`);
    if (provider === "webllm") return;

    if (providerConfig.requiresKey && !this.config.openaiCompatibleKey) {
      throw new Error("OpenAI-Compatible API key is required.");
    }
    if (provider === "openaiCompatible") {
      const url = this.config.openaiCompatible?.url || providerConfig.defaultUrl;
      if (!url) throw new Error("API Base URL is required.");
      try {
        new URL(url);
      } catch (error: any) {
        throw new Error(`Invalid URL: ${error.message}`);
      }
    }
  }

  getApiConfig() {
    const { provider } = this.config;
    const providerConfig = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openaiCompatible;
    let headers: Record<string, string> = { "Content-Type": "application/json" };
    let chosenModel = providerConfig.defaultModel || "";
    let apiUrl = "";

    if (provider === "openaiCompatible") {
      chosenModel = this.config.openaiCompatible?.model || chosenModel;
      apiUrl = providerConfig.apiUrl ? providerConfig.apiUrl(this.config) : "";
      if (this.config.openaiCompatibleKey) {
        headers["Authorization"] = `Bearer ${this.config.openaiCompatibleKey}`;
      }
    }

    return { apiUrl, headers, chosenModel };
  }

  formatRequestBody(text: string, systemPrompt: string, chosenModel: string) {
    return {
      model: chosenModel,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    };
  }
}

async function handleOpenAIRequest(text: string, config: any, postMessage: (msg: any) => void) {
  const systemPrompt = config.systemPrompt || DEFAULT_PROOFREAD_PROMPT;
  const configManager = new ApiConfigManager(config);
  configManager.validate();

  const { apiUrl, headers, chosenModel } = configManager.getApiConfig();
  const streamHandler = new StreamHandler();
  const requestBody = configManager.formatRequestBody(text, systemPrompt, chosenModel);

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorMsg = await response.text();
    throw new Error(`HTTP error ${response.status}: ${errorMsg}`);
  }

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  for await (const chunk of streamHandler.generateChunks(reader)) {
    streamHandler.processChunk(chunk, (msg) => postMessage(msg));
  }
  const remaining = streamHandler.getRemainingBuffer();
  if (remaining) {
    postMessage({ chunk: remaining, done: false });
  }
  postMessage({ done: true });
}

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "webllm-proofread",
    title: "Proofread with WebLLM / OpenAI",
    contexts: ["editable"],
  });
  
  // Set default provider to webllm on install if not present
  chrome.storage.sync.get(["provider"], (result) => {
    if (!result.provider) {
      chrome.storage.sync.set({ provider: "webllm" });
    }
  });

  ensureEngine().catch((e) => console.warn("[WebLLM] Auto-load on install failed:", e.message));
});

chrome.runtime.onStartup?.addListener(() => {
  ensureEngine().catch((e) => console.warn("[WebLLM] Auto-load on startup failed:", e.message));
});

ensureEngine().catch((e) => console.warn("[WebLLM] Auto-load failed:", e.message));

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "webllm-proofread" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "contextMenuProofread" });
  }
});

// Handle streaming requests via long-lived port connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "streamAdoSummary") {
    let aborted = false;

    port.onDisconnect.addListener(() => {
      aborted = true;
    });

    port.onMessage.addListener(async (msg) => {
      const { descriptionText, acceptanceCriteriaText, commentsText } = msg;

      try {
        const config = await getConfig();
        const template = config.adoSummaryPrompt || DEFAULT_ADO_SUMMARY_PROMPT;

        const prompt = template
          .replace("{description}", descriptionText || "(No description provided)")
          .replace("{acceptance_criteria}", acceptanceCriteriaText || "(No acceptance criteria provided)")
          .replace("{comments}", commentsText || "(No discussion comments)");

        if (config.provider === "openaiCompatible") {
          await handleOpenAIRequest(prompt, config, (res) => {
            if (!aborted) port.postMessage(res);
          });
        } else {
          const llmEngine = await ensureEngine();
          const messages: ChatCompletionMessageParam[] = [
            {
              role: "system",
              content:
                "You are an Agile Business Analyst. Synthesize the Work Item details into Markdown with headings '### Executive Summary', '### Key Requirements & Scope', '### Investigation & Discussion Insights', '### Proposed / Implemented Solution', and '### Acceptance Criteria Summary'. Output ONLY the summary content. Do NOT echo system prompts or instructions.",
            },
            { role: "user", content: prompt },
          ];

          const completion = await llmEngine.chat.completions.create({
            stream: true,
            messages,
          });

          for await (const chunk of completion) {
            if (aborted) break;
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              port.postMessage({ chunk: content, done: false });
            }
          }

          if (!aborted) {
            port.postMessage({ done: true });
          }
        }
      } catch (error: any) {
        if (!aborted) {
          port.postMessage({
            error: true,
            message: error.message || "Unknown error",
          });
        }
      }
    });
    return;
  }

  if (port.name !== "streamRewrite" && port.name !== "streamTypos") return;

  let aborted = false;

  port.onDisconnect.addListener(() => {
    aborted = true;
  });

  port.onMessage.addListener(async (msg) => {
    if (!msg.text) {
      port.postMessage({ error: true, message: "Empty text provided" });
      return;
    }

    try {
      const config = await getConfig();

      if (config.provider === "openaiCompatible") {
        await handleOpenAIRequest(msg.text, config, (res) => {
          if (!aborted) port.postMessage(res);
        });
      } else {
        const llmEngine = await ensureEngine();
        const messages: ChatCompletionMessageParam[] = [
          { role: "system", content: config.systemPrompt },
          { role: "user", content: msg.text },
        ];

        const completion = await llmEngine.chat.completions.create({
          stream: true,
          messages,
        });

        for await (const chunk of completion) {
          if (aborted) break;
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            port.postMessage({ chunk: content, done: false });
          }
        }

        if (!aborted) {
          port.postMessage({ done: true });
        }
      }
    } catch (error: any) {
      if (!aborted) {
        port.postMessage({
          error: true,
          message: error.message || "Unknown error",
        });
      }
    }
  });
});

// Handle simple messages
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "getModelList") {
    sendResponse({
      models: prebuiltAppConfig.model_list.map((m) => m.model_id),
      currentModel,
    });
    return false;
  }

  if (message.type === "getEngineStatus") {
    checkWebGPU().then((hasGpu) => {
      sendResponse({
        loaded: !!engine,
        loading: isLoading,
        currentModel,
        gpuAvailable: hasGpu,
      });
    });
    return true;
  }



  if (message.type === "loadModel") {
    ensureEngine(message.modelId)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  return false;
});
