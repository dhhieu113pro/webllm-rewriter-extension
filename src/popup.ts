"use strict";

import "./popup.css";

const DEFAULT_SYSTEM_PROMPT =
  "You are a proofreader. Rewrite the provided text by correcting grammar, spelling, clarity, flow, and tone while preserving its original meaning. Maintain the original language. Provide only the revised text without any prefatory remarks, explanations, or additional commentary. Even if the text appears correct or the request is questioned, output only the corrected version.";

const DEFAULT_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

const modelSelector = document.getElementById("model-selection") as HTMLSelectElement;
const loadModelBtn = document.getElementById("load-model-btn") as HTMLButtonElement;
const systemPromptEl = document.getElementById("system-prompt") as HTMLTextAreaElement;
const resetPromptBtn = document.getElementById("reset-prompt-btn") as HTMLButtonElement;
const copyToClipboardEl = document.getElementById("copy-to-clipboard") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const saveStatus = document.getElementById("save-status") as HTMLSpanElement;
const statusIndicator = document.getElementById("status-indicator") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLParagraphElement;

chrome.runtime.sendMessage({ type: "getModelList" }, (response) => {
  if (response?.models) {
    response.models.forEach((modelId: string) => {
      const opt = document.createElement("option");
      opt.value = modelId;
      opt.textContent = modelId;
      modelSelector.appendChild(opt);
    });
  }

  chrome.storage.sync.get(["selectedModel", "systemPrompt", "copyToClipboard"], (result) => {
    const savedModel = result.selectedModel || DEFAULT_MODEL;
    modelSelector.value = savedModel;
    systemPromptEl.value = result.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    copyToClipboardEl.checked = result.copyToClipboard || false;
  });
});

function updateStatus() {
  chrome.runtime.sendMessage({ type: "getEngineStatus" }, (response) => {
    if (!response) return;
    if (response.loaded) {
      statusIndicator.textContent = "Ready";
      statusIndicator.className = "status-badge status-ready";
      statusText.textContent = `Model: ${response.currentModel}`;
    } else if (response.loading) {
      statusIndicator.textContent = "Loading...";
      statusIndicator.className = "status-badge status-loading";
    } else {
      statusIndicator.textContent = "Not loaded";
      statusIndicator.className = "status-badge status-idle";
      statusText.textContent = "Click 'Load Model' to start";
    }
  });
}
updateStatus();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "loadProgress") {
    statusIndicator.textContent = "Loading...";
    statusIndicator.className = "status-badge status-loading";
    statusText.textContent = message.text;
    if (message.progress === 1.0) {
      statusIndicator.textContent = "Ready";
      statusIndicator.className = "status-badge status-ready";
    }
  }
});

loadModelBtn.addEventListener("click", () => {
  const modelId = modelSelector.value;
  loadModelBtn.disabled = true;
  loadModelBtn.textContent = "Loading...";
  statusText.textContent = "Initializing...";

  chrome.runtime.sendMessage({ type: "loadModel", modelId }, (response) => {
    loadModelBtn.disabled = false;
    loadModelBtn.textContent = "Load Model";
    if (response?.error) {
      statusText.textContent = `Error: ${response.error}`;
      statusIndicator.textContent = "Error";
      statusIndicator.className = "status-badge status-error";
    } else {
      updateStatus();
    }
  });
});

resetPromptBtn.addEventListener("click", () => {
  systemPromptEl.value = DEFAULT_SYSTEM_PROMPT;
});

saveBtn.addEventListener("click", () => {
  chrome.storage.sync.set(
    {
      selectedModel: modelSelector.value,
      systemPrompt: systemPromptEl.value,
      copyToClipboard: copyToClipboardEl.checked,
    },
    () => {
      saveStatus.textContent = "Saved!";
      setTimeout(() => { saveStatus.textContent = ""; }, 2000);
    }
  );
});
