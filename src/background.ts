"use strict";

import {
  MLCEngineInterface,
  CreateMLCEngine,
  InitProgressReport,
  ChatCompletionMessageParam,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";

const DEFAULT_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";
const DEFAULT_SYSTEM_PROMPT =
  "You are a proofreader. Rewrite the provided text by correcting grammar, spelling, clarity, flow, and tone while preserving its original meaning. Maintain the original language. Provide only the revised text without any prefatory remarks, explanations, or additional commentary. Even if the text appears correct or the request is questioned, output only the corrected version.";

let engine: MLCEngineInterface | null = null;
let currentModel = DEFAULT_MODEL;
let isLoading = false;

async function getSettings() {
  const result = await chrome.storage.sync.get([
    "selectedModel",
    "systemPrompt",
    "copyToClipboard",
  ]);
  return {
    selectedModel: result.selectedModel || DEFAULT_MODEL,
    systemPrompt: result.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    copyToClipboard: result.copyToClipboard || false,
  };
}

async function ensureEngine(modelId?: string): Promise<MLCEngineInterface> {
  const settings = await getSettings();
  const targetModel = modelId || settings.selectedModel;

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
    });
    currentModel = targetModel;
    return engine;
  } finally {
    isLoading = false;
  }
}

// Context menu setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "webllm-proofread",
    title: "Proofread with WebLLM",
    contexts: ["editable"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "webllm-proofread" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { action: "contextMenuProofread" });
  }
});

// Handle streaming rewrite requests via long-lived port connections
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "streamRewrite") return;

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
      const settings = await getSettings();
      const llmEngine = await ensureEngine();

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: settings.systemPrompt },
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
    sendResponse({
      loaded: !!engine,
      loading: isLoading,
      currentModel,
    });
    return false;
  }

  if (message.type === "loadModel") {
    ensureEngine(message.modelId)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  return false;
});
