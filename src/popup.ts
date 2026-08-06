"use strict";

import "./popup.css";
import {
  DEFAULT_PROOFREAD_PROMPT,
  DEFAULT_WEBLLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_URL,
} from "./constants";

const MASKED_KEY = "********";

const providerSelect = document.getElementById("provider-select") as HTMLSelectElement;
const webllmGroup = document.getElementById("webllm-group") as HTMLDivElement;
const openaiGroup = document.getElementById("openai-group") as HTMLDivElement;

const modelSelector = document.getElementById("model-selection") as HTMLSelectElement;
const loadModelBtn = document.getElementById("load-model-btn") as HTMLButtonElement;

const openaiKeyInput = document.getElementById("openai-key-input") as HTMLInputElement;
const openaiUrlInput = document.getElementById("openai-url-input") as HTMLInputElement;
const openaiModelInput = document.getElementById("openai-model-input") as HTMLInputElement;
const resetUrlBtn = document.getElementById("reset-url-btn") as HTMLButtonElement;
const resetModelBtn = document.getElementById("reset-model-btn") as HTMLButtonElement;

const systemPromptEl = document.getElementById("system-prompt") as HTMLTextAreaElement;
const resetPromptBtn = document.getElementById("reset-prompt-btn") as HTMLButtonElement;
const copyToClipboardEl = document.getElementById("copy-to-clipboard") as HTMLInputElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const saveStatus = document.getElementById("save-status") as HTMLSpanElement;
const errorContainer = document.getElementById("error-container") as HTMLDivElement;

const statusIndicator = document.getElementById("status-indicator") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLParagraphElement;
const progressContainer = document.getElementById("progress-container") as HTMLDivElement;
const progressFill = document.getElementById("progress-fill") as HTMLDivElement;
const progressPercent = document.getElementById("progress-percent") as HTMLSpanElement;

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

async function encryptData(text: string): Promise<any> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(text);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedText);
  return {
    iv: Array.from(iv),
    cipher: Array.from(new Uint8Array(cipher)),
  };
}

function updateResetButtons() {
  resetUrlBtn.style.display = openaiUrlInput.value !== DEFAULT_OPENAI_COMPATIBLE_URL ? "inline-block" : "none";
  resetModelBtn.style.display = openaiModelInput.value !== DEFAULT_OPENAI_COMPATIBLE_MODEL ? "inline-block" : "none";
}

function toggleProviderUI() {
  const provider = providerSelect.value;
  if (provider === "openaiCompatible") {
    webllmGroup.style.display = "none";
    openaiGroup.style.display = "block";
  } else {
    webllmGroup.style.display = "block";
    openaiGroup.style.display = "none";
  }
}

chrome.runtime.sendMessage({ type: "getModelList" }, (response) => {
  if (response?.models) {
    response.models.forEach((modelId: string) => {
      const opt = document.createElement("option");
      opt.value = modelId;
      opt.textContent = modelId;
      modelSelector.appendChild(opt);
    });
  }

  chrome.storage.sync.get(null, async (result) => {
    providerSelect.value = result.provider || "webllm";
    modelSelector.value = result.webllm?.model || result.selectedModel || DEFAULT_WEBLLM_MODEL;
    systemPromptEl.value = result.systemPrompt || DEFAULT_PROOFREAD_PROMPT;
    copyToClipboardEl.checked = result.copyToClipboard || false;

    openaiUrlInput.value = result.openaiCompatible?.url || DEFAULT_OPENAI_COMPATIBLE_URL;
    openaiModelInput.value = result.openaiCompatible?.model || DEFAULT_OPENAI_COMPATIBLE_MODEL;

    const localKeys = await chrome.storage.local.get(["openaiCompatibleKey"]);
    if (localKeys.openaiCompatibleKey) {
      openaiKeyInput.value = MASKED_KEY;
    }

    toggleProviderUI();
    updateResetButtons();
  });
});

function updateStatus() {
  chrome.runtime.sendMessage({ type: "getEngineStatus" }, (response) => {
    if (!response) return;

    if (response.gpuAvailable === false) {
      statusText.textContent = "⚠ WebGPU not available. Chrome 124+ required.";
      statusIndicator.textContent = "No GPU";
      statusIndicator.className = "status-badge status-error";
      loadModelBtn.disabled = true;
      return;
    }

    if (response.loaded) {
      statusIndicator.textContent = "Ready (GPU)";
      statusIndicator.className = "status-badge status-ready";
      statusText.textContent = `Model: ${response.currentModel}`;
    } else if (response.loading) {
      statusIndicator.textContent = "Loading...";
      statusIndicator.className = "status-badge status-loading";
    } else {
      statusIndicator.textContent = "Not loaded";
      statusIndicator.className = "status-badge status-idle";
      statusText.textContent = "Click 'Load Model' to start (WebGPU)";
    }
  });
}
updateStatus();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "loadProgress") {
    statusIndicator.textContent = "Loading...";
    statusIndicator.className = "status-badge status-loading";
    statusText.textContent = message.text;

    const pct = Math.round((message.progress || 0) * 100);
    progressContainer.style.display = "flex";
    progressFill.style.width = `${pct}%`;
    progressPercent.textContent = `${pct}%`;

    if (message.progress === 1.0) {
      statusIndicator.textContent = "Ready";
      statusIndicator.className = "status-badge status-ready";
      progressContainer.style.display = "none";
    }
  }
});

providerSelect.addEventListener("change", () => {
  toggleProviderUI();
});

openaiUrlInput.addEventListener("input", updateResetButtons);
openaiModelInput.addEventListener("input", updateResetButtons);

resetUrlBtn.addEventListener("click", () => {
  openaiUrlInput.value = DEFAULT_OPENAI_COMPATIBLE_URL;
  updateResetButtons();
});

resetModelBtn.addEventListener("click", () => {
  openaiModelInput.value = DEFAULT_OPENAI_COMPATIBLE_MODEL;
  updateResetButtons();
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
  systemPromptEl.value = DEFAULT_PROOFREAD_PROMPT;
});

saveBtn.addEventListener("click", async () => {
  const provider = providerSelect.value;
  const syncSettings = {
    provider,
    selectedModel: modelSelector.value,
    webllm: { model: modelSelector.value },
    openaiCompatible: {
      url: openaiUrlInput.value.trim() || DEFAULT_OPENAI_COMPATIBLE_URL,
      model: openaiModelInput.value.trim() || DEFAULT_OPENAI_COMPATIBLE_MODEL,
    },
    systemPrompt: systemPromptEl.value,
    copyToClipboard: copyToClipboardEl.checked,
  };

  chrome.storage.sync.set(syncSettings, async () => {
    const rawKey = openaiKeyInput.value.trim();
    if (rawKey && rawKey !== MASKED_KEY) {
      const encryptedKey = await encryptData(rawKey);
      await chrome.storage.local.set({ openaiCompatibleKey: encryptedKey });
    }

    saveStatus.textContent = "Saved!";
    setTimeout(() => { saveStatus.textContent = ""; }, 2000);
  });
});
