"use strict";

import "./popup.css";
import {
  DEFAULT_PROOFREAD_PROMPT,
  DEFAULT_WEBLLM_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_MODEL,
  DEFAULT_OPENAI_COMPATIBLE_URL,
  DEFAULT_ADO_SUMMARY_PROMPT,
} from "./constants";

const MASKED_KEY = "********";

// Tab Navigation Elements
const tabBtnGeneral = document.getElementById("tab-btn-general") as HTMLButtonElement;
const tabBtnWorkitem = document.getElementById("tab-btn-workitem") as HTMLButtonElement;
const tabContentGeneral = document.getElementById("tab-content-general") as HTMLDivElement;
const tabContentWorkitem = document.getElementById("tab-content-workitem") as HTMLDivElement;

const providerSelect = document.getElementById("provider-select") as HTMLSelectElement;
const webllmGroup = document.getElementById("webllm-group") as HTMLDivElement;
const openaiGroup = document.getElementById("openai-group") as HTMLDivElement;

const familySelector = document.getElementById("family-selection") as HTMLSelectElement;
const instanceSelector = document.getElementById("instance-selection") as HTMLSelectElement;
const loadModelBtn = document.getElementById("load-model-btn") as HTMLButtonElement;

const openaiKeyInput = document.getElementById("openai-key-input") as HTMLInputElement;
const openaiUrlInput = document.getElementById("openai-url-input") as HTMLInputElement;
const openaiModelInput = document.getElementById("openai-model-input") as HTMLInputElement;
const resetUrlBtn = document.getElementById("reset-url-btn") as HTMLButtonElement;
const resetModelBtn = document.getElementById("reset-model-btn") as HTMLButtonElement;

const systemPromptEl = document.getElementById("system-prompt") as HTMLTextAreaElement;
const resetPromptBtn = document.getElementById("reset-prompt-btn") as HTMLButtonElement;
const copyToClipboardEl = document.getElementById("copy-to-clipboard") as HTMLInputElement;

// Work Item Summary Elements
const adoAutoSummaryToggle = document.getElementById("ado-auto-summary") as HTMLInputElement;
const adoAutoDelayInput = document.getElementById("ado-auto-delay") as HTMLInputElement;
const adoTargetLanguageSelect = document.getElementById("ado-target-language") as HTMLSelectElement;
const adoSummaryPromptEl = document.getElementById("ado-summary-prompt") as HTMLTextAreaElement;
const resetAdoPromptBtn = document.getElementById("reset-ado-prompt-btn") as HTMLButtonElement;
const clearAdoCacheBtn = document.getElementById("clear-ado-cache-btn") as HTMLButtonElement;

const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const saveStatus = document.getElementById("save-status") as HTMLSpanElement;
const statusIndicator = document.getElementById("status-indicator") as HTMLDivElement;
const statusText = document.getElementById("status-text") as HTMLParagraphElement;
const progressContainer = document.getElementById("progress-container") as HTMLDivElement;
const progressFill = document.getElementById("progress-fill") as HTMLDivElement;
const progressPercent = document.getElementById("progress-percent") as HTMLSpanElement;

// Tab Switch Logic
function switchTab(tab: "general" | "workitem") {
  if (tab === "general") {
    tabContentGeneral.style.display = "block";
    tabContentWorkitem.style.display = "none";
    tabBtnGeneral.style.borderBottom = "2px solid #0078d4";
    tabBtnGeneral.style.opacity = "1";
    tabBtnWorkitem.style.borderBottom = "none";
    tabBtnWorkitem.style.opacity = "0.7";
  } else {
    tabContentGeneral.style.display = "none";
    tabContentWorkitem.style.display = "block";
    tabBtnWorkitem.style.borderBottom = "2px solid #0078d4";
    tabBtnWorkitem.style.opacity = "1";
    tabBtnGeneral.style.borderBottom = "none";
    tabBtnGeneral.style.opacity = "0.7";
  }
}

tabBtnGeneral?.addEventListener("click", () => switchTab("general"));
tabBtnWorkitem?.addEventListener("click", () => switchTab("workitem"));

let familyMap: Map<string, string[]> = new Map();

function getFamilyName(modelId: string): string {
  const clean = modelId.split("/").pop() || modelId;
  const parts = clean.split("-");
  return parts[0] || clean;
}

function updateInstanceOptions(selectedFamily: string, selectedModelId?: string) {
  instanceSelector.innerHTML = "";
  const instances = familyMap.get(selectedFamily) || [];
  instances.forEach((modelId) => {
    const opt = document.createElement("option");
    opt.value = modelId;
    opt.textContent = modelId;
    instanceSelector.appendChild(opt);
  });
  if (selectedModelId && instances.includes(selectedModelId)) {
    instanceSelector.value = selectedModelId;
  } else if (instances.length > 0) {
    instanceSelector.value = instances[0];
  }
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
  familyMap.clear();
  familySelector.innerHTML = "";

  if (response?.models) {
    const allowedModels = response.models.filter((modelId: string) => {
      const id = modelId.toLowerCase();
      // Only allow Qwen family models
      return id.includes("qwen");
    });

    // Pin Qwen2.5-1.5B and 3B explicitly for Vietnamese/multilingual support
    const preferred = [
      "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
      "Qwen2.5-3B-Instruct-q4f16_1-MLC",
      "Qwen2.5-3B-Instruct-q4f32_1-MLC",
    ];
    const extraModels = preferred.filter(
      (m) => !allowedModels.includes(m)
    );
    allowedModels.push(...extraModels);

    allowedModels.forEach((modelId: string) => {
      const family = getFamilyName(modelId);
      if (!familyMap.has(family)) {
        familyMap.set(family, []);
      }
      familyMap.get(family)!.push(modelId);
    });

    familyMap.forEach((instances, family) => {
      const opt = document.createElement("option");
      opt.value = family;
      opt.textContent = family;
      familySelector.appendChild(opt);
    });
  }

  chrome.storage.sync.get(null, async (result) => {
    providerSelect.value = result.provider || "webllm";
    const savedModel = result.webllm?.model || result.selectedModel || DEFAULT_WEBLLM_MODEL;
    const savedFamily = getFamilyName(savedModel);

    if (familyMap.has(savedFamily)) {
      familySelector.value = savedFamily;
    } else if (familySelector.options.length > 0) {
      familySelector.value = familySelector.options[0].value;
    }

    updateInstanceOptions(familySelector.value, savedModel);

    systemPromptEl.value = result.systemPrompt || DEFAULT_PROOFREAD_PROMPT;
    copyToClipboardEl.checked = result.copyToClipboard || false;

    openaiUrlInput.value = result.openaiCompatible?.url || DEFAULT_OPENAI_COMPATIBLE_URL;
    openaiModelInput.value = result.openaiCompatible?.model || DEFAULT_OPENAI_COMPATIBLE_MODEL;

    // Work Item Summary settings
    adoAutoSummaryToggle.checked = result.adoAutoSummary !== false;
    adoAutoDelayInput.value = String(typeof result.adoAutoDelay === "number" ? result.adoAutoDelay : 1000);
    adoTargetLanguageSelect.value = result.adoTargetLanguage || "English";
    adoSummaryPromptEl.value = result.adoSummaryPrompt || DEFAULT_ADO_SUMMARY_PROMPT;

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

familySelector.addEventListener("change", () => {
  updateInstanceOptions(familySelector.value);
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

resetPromptBtn.addEventListener("click", () => {
  systemPromptEl.value = DEFAULT_PROOFREAD_PROMPT;
});

resetAdoPromptBtn?.addEventListener("click", () => {
  adoSummaryPromptEl.value = DEFAULT_ADO_SUMMARY_PROMPT;
});

clearAdoCacheBtn?.addEventListener("click", async () => {
  const allKeys = await chrome.storage.local.get(null);
  const cacheKeys = Object.keys(allKeys).filter((key) => key.startsWith("ado_summary_"));
  if (cacheKeys.length > 0) {
    await chrome.storage.local.remove(cacheKeys);
  }
  clearAdoCacheBtn.textContent = `✓ Cleared ${cacheKeys.length} summaries!`;
  setTimeout(() => {
    clearAdoCacheBtn.textContent = "🗑️ Clear Saved Ticket Summaries";
  }, 2000);
});

loadModelBtn.addEventListener("click", () => {
  const modelId = instanceSelector.value;
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

saveBtn.addEventListener("click", async () => {
  const provider = providerSelect.value;
  const syncSettings = {
    provider,
    selectedModel: instanceSelector.value,
    webllm: { model: instanceSelector.value },
    openaiCompatible: {
      url: openaiUrlInput.value.trim() || DEFAULT_OPENAI_COMPATIBLE_URL,
      model: openaiModelInput.value.trim() || DEFAULT_OPENAI_COMPATIBLE_MODEL,
    },
    systemPrompt: systemPromptEl.value,
    copyToClipboard: copyToClipboardEl.checked,
    adoAutoSummary: adoAutoSummaryToggle.checked,
    adoAutoDelay: parseInt(adoAutoDelayInput.value, 10) || 1000,
    adoTargetLanguage: adoTargetLanguageSelect.value,
    adoSummaryPrompt: adoSummaryPromptEl.value,
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
