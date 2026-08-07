"use strict";

class InputHookIndicatorManager {
  constructor() {
    this.indicators = new Map();
    this.styleId = "webllm-hook-indicator-style";
    this.animationFrame = null;
    this.ensureStyles();
    this.bindPositionUpdaters();
  }

  ensureStyles() {
    if (document.getElementById(this.styleId)) return;
    const style = document.createElement("style");
    style.id = this.styleId;
    style.textContent = `
      .webllm-glow-svg {
        position: fixed;
        pointer-events: none;
        z-index: 2147483645;
        overflow: visible !important;
        box-sizing: border-box;
      }

      .webllm-glow-ambient {
        fill: none !important;
        stroke: url(#webllm-glow-grad);
        stroke-width: 6;
        opacity: 0.65;
        filter: blur(8px);
      }

      .webllm-glow-border {
        fill: none !important;
        stroke: url(#webllm-glow-grad);
        stroke-width: 2.5;
        filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.6));
      }

      .webllm-hook-indicator {
        position: fixed;
        display: none;
        align-items: center;
        justify-content: center;
        min-width: 46px;
        height: 26px;
        padding: 0 9px;
        border-radius: 999px;
        background: linear-gradient(120deg, rgba(82, 119, 255, 0.93), rgba(53, 209, 255, 0.92), rgba(165, 100, 255, 0.9));
        background-size: 220% 220%;
        color: #fff;
        font-size: 13px;
        font-weight: 700;
        z-index: 2147483646;
        border: 1px solid rgba(255, 255, 255, 0.32);
        box-shadow: 0 8px 20px rgba(68, 113, 255, 0.34), 0 2px 8px rgba(0, 0, 0, 0.22);
        backdrop-filter: blur(6px);
        pointer-events: none;
        animation: webllm-gradient-flow 2.2s linear infinite;
      }

      .webllm-hook-indicator__dots {
        display: inline-flex;
        gap: 3px;
      }

      .webllm-hook-indicator__dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
        opacity: 0.4;
        box-shadow: 0 0 7px rgba(255, 255, 255, 0.75);
        animation: webllm-dot-pulse 1s infinite ease-in-out;
      }

      .webllm-hook-indicator__dot:nth-child(2) { animation-delay: 0.16s; }
      .webllm-hook-indicator__dot:nth-child(3) { animation-delay: 0.32s; }

      .webllm-hook-indicator--done {
        background: linear-gradient(120deg, rgba(17, 124, 84, 0.94), rgba(36, 181, 119, 0.93));
        box-shadow: 0 8px 20px rgba(20, 148, 97, 0.34), 0 2px 8px rgba(0, 0, 0, 0.22);
        animation: none;
      }

      @keyframes webllm-gradient-flow {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }

      @keyframes webllm-dot-pulse {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-2.5px) scale(1.03); opacity: 1; }
      }
    `;
    document.documentElement.appendChild(style);
  }

  bindPositionUpdaters() {
    const update = () => {
      if (this.indicators.size === 0) return;
      if (this.animationFrame !== null) return;
      this.animationFrame = requestAnimationFrame(() => {
        this.animationFrame = null;
        this.updateAllPositions();
      });
    };
    window.addEventListener("scroll", update, false);
    window.addEventListener("resize", update);
  }

  createIndicatorElement() {
    const indicator = document.createElement("div");
    indicator.className = "webllm-hook-indicator";
    indicator.innerHTML = `
      <span class="webllm-hook-indicator__dots" aria-hidden="true">
        <span class="webllm-hook-indicator__dot"></span>
        <span class="webllm-hook-indicator__dot"></span>
        <span class="webllm-hook-indicator__dot"></span>
      </span>
    `;
    document.body.appendChild(indicator);
    return indicator;
  }

  createGlowWrapperElement() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "webllm-glow-svg");
    svg.style.display = "none";
    svg.innerHTML = `
      <defs>
        <linearGradient id="webllm-glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="33%" stop-color="#8b5cf6" />
          <stop offset="66%" stop-color="#ec4899" />
          <stop offset="100%" stop-color="#3b82f6" />
        </linearGradient>
      </defs>
      <rect class="webllm-glow-ambient" x="0" y="0" width="100%" height="100%" rx="16" fill="none" />
      <rect class="webllm-glow-border" x="0" y="0" width="100%" height="100%" rx="16" fill="none" />
    `;
    document.body.appendChild(svg);
    return svg;
  }

  getRecord(inputElement) {
    let record = this.indicators.get(inputElement);
    if (!record) {
      record = {
        indicator: this.createIndicatorElement(),
        glowWrapper: this.createGlowWrapperElement(),
        hideTimer: null,
      };
      this.indicators.set(inputElement, record);
    }
    return record;
  }

  updatePosition(inputElement, indicator, glowWrapper) {
    if (!inputElement || !document.contains(inputElement)) return;

    const rect = inputElement.getBoundingClientRect();

    if (indicator) {
      const top = Math.max(8, rect.top - 30);
      const left = Math.max(8, rect.right - indicator.offsetWidth);
      indicator.style.top = `${top}px`;
      indicator.style.left = `${left}px`;
    }

    if (glowWrapper) {
      const compStyle = window.getComputedStyle(inputElement);
      const borderRadius = parseFloat(compStyle.borderRadius) || 16;
      glowWrapper.style.top = `${rect.top}px`;
      glowWrapper.style.left = `${rect.left}px`;
      glowWrapper.style.width = `${rect.width}px`;
      glowWrapper.style.height = `${rect.height}px`;

      const rectEls = glowWrapper.querySelectorAll("rect");
      rectEls.forEach((r) => r.setAttribute("rx", borderRadius.toString()));
    }
  }

  updateAllPositions() {
    for (const [inputElement, record] of this.indicators.entries()) {
      if (!document.contains(inputElement)) {
        if (record.indicator) record.indicator.remove();
        if (record.glowWrapper) record.glowWrapper.remove();
        this.indicators.delete(inputElement);
        continue;
      }
      if (
        record.indicator.style.display !== "none" ||
        (record.glowWrapper && record.glowWrapper.style.display !== "none")
      ) {
        this.updatePosition(inputElement, record.indicator, record.glowWrapper);
      }
    }
  }

  setLoadingState(record) {
    record.indicator.classList.remove("webllm-hook-indicator--done");
    record.indicator.innerHTML = `
      <span class="webllm-hook-indicator__dots" aria-hidden="true">
        <span class="webllm-hook-indicator__dot"></span>
        <span class="webllm-hook-indicator__dot"></span>
        <span class="webllm-hook-indicator__dot"></span>
      </span>
    `;
  }

  setDoneState(record) {
    record.indicator.classList.add("webllm-hook-indicator--done");
    record.indicator.textContent = "\u2713";
  }

  start(inputElement) {
    if (!inputElement) return;

    const record = this.getRecord(inputElement);
    clearTimeout(record.hideTimer);
    this.setLoadingState(record);
    record.indicator.style.display = "inline-flex";
    if (record.glowWrapper) {
      record.glowWrapper.style.display = "block";
    }
    this.updatePosition(inputElement, record.indicator, record.glowWrapper);
  }

  complete(inputElement) {
    if (!inputElement) return;

    const record = this.indicators.get(inputElement);
    if (!record) return;

    clearTimeout(record.hideTimer);
    this.setDoneState(record);
    this.updatePosition(inputElement, record.indicator, record.glowWrapper);

    record.hideTimer = setTimeout(() => {
      this.hide(inputElement);
    }, 1200);
  }

  hide(inputElement) {
    const record = this.indicators.get(inputElement);
    if (!record) return;

    clearTimeout(record.hideTimer);
    record.indicator.style.display = "none";
    if (record.glowWrapper) {
      record.glowWrapper.style.display = "none";
    }
  }

  fail(inputElement) {
    this.hide(inputElement);
  }
}

class TextProcessor {
  constructor(inputElement, copyToClipboard = false, indicatorManager = null) {
    this.inputElement = inputElement;
    this.copyToClipboard = copyToClipboard;
    this.accumulatedText = "";
    this.isSlateEditor = inputElement.getAttribute("data-slate-editor") !== null;
    this.originalText = "";
    this.selectionStart = null;
    this.selectionEnd = null;
    this.selectedRange = null;
    this.port = null;
    this.indicatorManager = indicatorManager;
  }

  normalizeFinalOutput(text) {
    return (text || "").replace(/\r\n/g, "\n").trim();
  }

  getText() {
    const { isContentEditable } = this.inputElement;
    let text = this.isSlateEditor
      ? this.inputElement.querySelector("[data-slate-string]")?.textContent || ""
      : isContentEditable
      ? this.inputElement.innerText
      : this.inputElement.value;

    if (!isContentEditable) {
      this.selectionStart = this.inputElement.selectionStart;
      this.selectionEnd = this.inputElement.selectionEnd;
    } else {
      const sel = window.getSelection();
      this.selectionStart = 0;
      this.selectionEnd = text.length;

      if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        if (this.inputElement.contains(range.commonAncestorContainer)) {
          const selectedText = range.toString();
          if (selectedText && selectedText.trim().length > 0) {
            this.selectedRange = range.cloneRange();
            const preRange = document.createRange();
            preRange.setStart(this.inputElement, 0);
            preRange.setEnd(range.startContainer, range.startOffset);
            this.selectionStart = preRange.toString().length;
            this.selectionEnd = this.selectionStart + selectedText.length;
          } else {
            this.selectedRange = null;
          }
        }
      }
    }

    this.originalText = text;

    return this.selectionStart !== null &&
      this.selectionEnd !== null &&
      this.selectionStart !== this.selectionEnd &&
      this.selectionStart < text.length &&
      this.selectionEnd <= text.length
      ? text.substring(this.selectionStart, this.selectionEnd)
      : text;
  }

  updateContent(newContent) {
    if (this.copyToClipboard) {
      navigator.clipboard.writeText(newContent).catch((err) => console.error(err.message));
      return;
    }

    const input = this.inputElement;
    let finalContent = newContent;

    if (this.selectionStart !== null && this.selectionEnd !== null && this.selectionStart !== this.selectionEnd) {
      const before = this.originalText.substring(0, this.selectionStart);
      const after = this.originalText.substring(this.selectionEnd);
      finalContent = before + newContent + after;
    }

    if (this.isSlateEditor) {
      this.updateSlateContent(finalContent);
    } else if (input.isContentEditable) {
      this.updateContentEditable(finalContent);
    } else {
      input.value = finalContent;
      input.dispatchEvent(new Event("input", { bubbles: true }));

      if (this.selectionStart !== null) {
        const newPosition = this.selectionStart + newContent.length;
        input.setSelectionRange(newPosition, newPosition);
      }
    }
  }

  updateContentEditable(newContent) {
    const input = this.inputElement;
    if (this.selectedRange) {
      this.selectedRange.deleteContents();
      this.selectedRange.insertNode(document.createTextNode(newContent));

      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(this.selectedRange);
    } else {
      input.innerText = newContent;
    }
    this.inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  }

  updateSlateContent(newContent) {
    const textElement = this.inputElement.querySelector("[data-slate-string]");
    if (textElement) {
      textElement.dispatchEvent(new Event("compositionstart", { bubbles: true }));

      const selection = window.getSelection();
      const range = document.createRange();

      if (this.selectedRange) {
        selection.removeAllRanges();
        selection.addRange(this.selectedRange);
      } else {
        range.selectNodeContents(textElement);
        selection.removeAllRanges();
        selection.addRange(range);
      }

      document.dispatchEvent(new Event("selectionchange", { bubbles: true }));

      textElement.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "deleteContentBackward",
          bubbles: true,
          cancelable: true,
        })
      );

      textElement.dispatchEvent(
        new InputEvent("beforeinput", {
          inputType: "insertText",
          data: newContent,
          bubbles: true,
          cancelable: true,
        })
      );

      if (this.selectedRange) {
        this.selectedRange.deleteContents();
        this.selectedRange.insertNode(document.createTextNode(newContent));
      } else {
        textElement.textContent = newContent;
      }

      textElement.dispatchEvent(new Event("compositionend", { bubbles: true }));

      textElement.dispatchEvent(
        new InputEvent("input", {
          inputType: "insertText",
          data: newContent,
          bubbles: true,
          cancelable: false,
        })
      );

      range.selectNodeContents(textElement);
      selection.removeAllRanges();
      selection.addRange(range);

      this.inputElement.focus();
      textElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  async processText() {
    try {
      const text = this.getText();
      if (!text.trim()) return;
      this.indicatorManager?.start(this.inputElement);
      const port = chrome.runtime.connect({ name: "streamRewrite" });
      this.port = port;
      await this.setupStreamProcessing(port, text);
      this.indicatorManager?.complete(this.inputElement);
    } catch (error) {
      this.indicatorManager?.fail(this.inputElement);
      console.error("Rewrite error:", error.message);
    }
  }

  setupStreamProcessing(port, text) {
    return new Promise((resolve, reject) => {
      port.onMessage.addListener((response) => {
        if (response.error) {
          const message = response.error.message || response.message || "Unknown error";
          port.disconnect();
          reject(new Error(message));
          return;
        }

        this.handleStreamResponse(response);
        if (response.done) {
          port.disconnect();
          resolve();
        }
      });
      port.postMessage({ text });
    });
  }

  handleStreamResponse(response) {
    if (response.chunk) {
      this.accumulatedText += response.chunk;
    }

    if (this.isSlateEditor || this.inputElement.isContentEditable) {
      if (response.done) {
        const finalOutput = this.normalizeFinalOutput(this.accumulatedText);
        this.updateContent(finalOutput);
      }
      return;
    }

    if (response.chunk) {
      this.updateContent(this.accumulatedText);
    }

    if (response.done) {
      const finalOutput = this.normalizeFinalOutput(this.accumulatedText);
      this.updateContent(finalOutput);
    }
  }

  revertToOriginal() {
    this.indicatorManager?.complete(this.inputElement);
    if (this.originalText) {
      this.updateContent(this.originalText);
    }
  }
}

class InputHandler {
  static SUPPORTED_INPUTS = ["TEXTAREA", "INPUT", "DIV"];
  static MAX_HISTORY = 10;

  constructor() {
    this.copyToClipboard = false;
    this.ctrlSequence = [];
    this.ctrlTimer = null;
    this.activeProcessor = null;
    this.indicatorManager = new InputHookIndicatorManager();
    this.history = new WeakMap();
    this.loadSettings();
    this.initializeEventListeners();
    this.setupContextMenuListener();
  }

  async loadSettings() {
    const result = await chrome.storage.sync.get(["copyToClipboard"]);
    if (result.copyToClipboard !== undefined) this.copyToClipboard = result.copyToClipboard;
  }

  initializeEventListeners() {
    document.addEventListener("keydown", this.handleKeyPress.bind(this), true);
  }

  setupContextMenuListener() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.action === "contextMenuProofread") {
        const activeElement = document.activeElement;
        if (this.isValidTarget(activeElement)) {
          this.processInput(activeElement);
        }
      }
    });
  }

  isValidTarget(target) {
    if (!target) return false;
    const tagName = target.tagName?.toUpperCase();
    return (
      (InputHandler.SUPPORTED_INPUTS.includes(tagName) && (tagName !== "INPUT" || target.type === "text")) ||
      target.isContentEditable ||
      (target.getAttribute && target.getAttribute("role") === "textbox")
    );
  }

  handleKeyPress(event) {
    if (!this.isValidTarget(event.target)) return;

    if (event.key === "Escape" && this.activeProcessor) {
      this.cancelActiveRequest();
      return;
    }

    if (event.ctrlKey && event.key === "z" && !event.shiftKey) {
      const state = this.history.get(event.target);
      if (state && state.index > -1) {
        event.preventDefault();
        event.stopPropagation();
        this.undo(event.target);
        return;
      }
    }

    if (event.ctrlKey && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
      const state = this.history.get(event.target);
      if (state && state.index < state.entries.length - 1) {
        event.preventDefault();
        event.stopPropagation();
        this.redo(event.target);
        return;
      }
    }

    if (event.key === "Control") {
      this.handleControlKeyPress(event);
    } else {
      this.ctrlSequence = [];
    }
  }

  handleControlKeyPress(event) {
    this.ctrlSequence.push(Date.now());
    clearTimeout(this.ctrlTimer);

    this.ctrlTimer = setTimeout(() => {
      if (this.ctrlSequence.length === 2) {
        event.preventDefault();
        event.stopPropagation();
        this.processInput(event.target);
      }
      this.ctrlSequence = [];
    }, 400);
  }

  async processInput(inputElement) {
    this.cancelActiveRequest();
    const textProcessor = new TextProcessor(inputElement, this.copyToClipboard, this.indicatorManager);
    const beforeText = textProcessor.getText();
    this.activeProcessor = textProcessor;
    await textProcessor.processText();
    this.activeProcessor = null;
    const afterText = textProcessor.getText();
    if (beforeText !== afterText) {
      this.pushHistory(inputElement, beforeText, afterText);
    }
  }

  cancelActiveRequest() {
    if (this.activeProcessor) {
      const proc = this.activeProcessor;
      this.activeProcessor = null;
      if (proc.port) {
        proc.port.disconnect();
        proc.port = null;
      }
      proc.revertToOriginal();
    }
  }

  pushHistory(element, before, after) {
    let state = this.history.get(element);
    if (!state) {
      state = { entries: [], index: -1 };
      this.history.set(element, state);
    }
    state.entries = state.entries.slice(0, state.index + 1);
    state.entries.push({ before, after });
    if (state.entries.length > InputHandler.MAX_HISTORY) {
      state.entries.shift();
    }
    state.index = state.entries.length - 1;
    this.showHistoryToast(element, state);
  }

  undo(element) {
    const state = this.history.get(element);
    if (!state || state.index < 0) return;
    const entry = state.entries[state.index];
    state.index--;
    this.applyText(element, entry.before);
    this.showHistoryToast(element, state);
  }

  redo(element) {
    const state = this.history.get(element);
    if (!state || state.index >= state.entries.length - 1) return;
    state.index++;
    const entry = state.entries[state.index];
    this.applyText(element, entry.after);
    this.showHistoryToast(element, state);
  }

  applyText(element, text) {
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
      element.value = text;
    } else {
      element.innerText = text;
    }
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

  showHistoryToast(element, state) {
    const existing = document.getElementById("webllm-history-toast");
    if (existing) existing.remove();
    if (state.entries.length <= 1) return;

    const toast = document.createElement("div");
    toast.id = "webllm-history-toast";
    toast.textContent = `${state.index + 1}/${state.entries.length}`;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.75)",
      color: "#fff",
      padding: "6px 14px",
      borderRadius: "6px",
      fontSize: "13px",
      fontFamily: "system-ui",
      zIndex: "2147483647",
      pointerEvents: "none",
      transition: "opacity 0.3s",
    });
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; }, 1500);
    setTimeout(() => toast.remove(), 1800);
  }
}

new InputHandler();

class AdoWorkItemSummarizer {
  constructor() {
    this.inlineCardId = "webllm-ado-inline-summary-box";
    this.currentWorkItemId = null;
    this.autoRunTimer = null;
    this.isSummarizing = false;
    this.currentRequestId = 0;
    this.activePort = null;
    this._targetLanguage = "English";
    this._autoDelay = 4000;
    this._scrollAutoTriggered = false;
    this._cleanupScrollTrigger = null;
    // Load language preference and delay
    chrome.storage.sync.get(["adoTargetLanguage", "adoAutoDelay"], (res) => {
      this._targetLanguage = res.adoTargetLanguage || "English";
      this._autoDelay = typeof res.adoAutoDelay === "number" ? res.adoAutoDelay : 4000;
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.adoTargetLanguage) {
        this._targetLanguage = changes.adoTargetLanguage.newValue || "English";
      }
      if (changes.adoAutoDelay) {
        this._autoDelay = typeof changes.adoAutoDelay.newValue === "number" ? changes.adoAutoDelay.newValue : 4000;
      }
    });
    this.initObserver();
  }

  isAdoPage() {
    const host = window.location.hostname;
    return (
      host.includes("dev.azure.com") ||
      host.includes("visualstudio.com") ||
      host.includes("azure.com") ||
      document.querySelector(".work-item-form, .work-item-dialog, .work-item-view, .work-item-form-main-column") !== null
    );
  }

  isAdoDarkMode() {
    if (
      document.body.classList.contains("dark-theme") ||
      document.body.classList.contains("dark") ||
      document.documentElement.getAttribute("data-theme") === "dark" ||
      document.querySelector(".ms-Fabric--isFocusHidden.dark-theme") ||
      document.querySelector(".vss-Theme-dark")
    ) {
      return true;
    }
    const bg = window.getComputedStyle(document.body).backgroundColor;
    if (bg) {
      const rgb = bg.match(/\d+/g);
      if (rgb && rgb.length >= 3) {
        const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
        return brightness < 128;
      }
    }
    return false;
  }

  getThemeStyles() {
    const isDark = this.isAdoDarkMode();
    if (isDark) {
      return {
        background: "linear-gradient(180deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        headerBg: "rgba(56, 189, 248, 0.1)",
        headerBorder: "rgba(56, 189, 248, 0.2)",
        headerText: "#38bdf8",
        bodyText: "#e2e8f0",
        mutedText: "#94a3b8",
        shadow: "0 8px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
        btnGenBg: "#2563eb",
        btnGenText: "#ffffff",
        btnCancelBg: "rgba(239, 68, 68, 0.15)",
        btnCancelText: "#f87171",
        btnCancelBorder: "1px solid rgba(239, 68, 68, 0.3)",
        btnCopyBg: "rgba(255,255,255,0.1)",
        btnCopyBorder: "rgba(255,255,255,0.2)",
        btnCopyText: "#e2e8f0",
        scrollbar: "#475569 transparent",
        spinnerColor: "#38bdf8",
        spinnerBg: "rgba(56, 189, 248, 0.25)",
      };
    } else {
      return {
        background: "linear-gradient(180deg, #ffffff, #f8fafc)",
        border: "1px solid #0078d4",
        headerBg: "#eff6fc",
        headerBorder: "#c7e0f4",
        headerText: "#005a9e",
        bodyText: "#201f1e",
        mutedText: "#605e5c",
        shadow: "0 4px 14px rgba(0,0,0,0.08)",
        btnGenBg: "#0078d4",
        btnGenText: "#ffffff",
        btnCancelBg: "#fef2f2",
        btnCancelText: "#dc2626",
        btnCancelBorder: "1px solid #fca5a5",
        btnCopyBg: "#f3f2f1",
        btnCopyBorder: "#e1dfdd",
        btnCopyText: "#323130",
        scrollbar: "#c8c6c4 transparent",
        spinnerColor: "#0078d4",
        spinnerBg: "rgba(0, 120, 212, 0.2)",
      };
    }
  }

  getWorkItemId() {
    const match = window.location.href.match(/_workitems\/edit\/(\d+)/i) ||
                  window.location.href.match(/workitems\/edit\/(\d+)/i) ||
                  window.location.href.match(/_workitems\/(\d+)/i) ||
                  window.location.href.match(/workitem=(\d+)/i) ||
                  window.location.href.match(/workitem\/(\d+)/i);
    if (match && match[1]) return match[1];

    const idEl = document.querySelector(".work-item-form-id span, [aria-label='ID'], .work-item-form-id");
    if (idEl && idEl.innerText) {
      const numMatch = idEl.innerText.match(/\d+/);
      if (numMatch) return numMatch[0];
    }
    return null;
  }

  initObserver() {
    const checkAndInject = () => {
      if (!this.isAdoPage()) return;

      const workItemId = this.getWorkItemId();
      const hasForm = document.querySelector(".work-item-form, .work-item-dialog, .work-item-view, .work-item-form-main-column") !== null;
      if (!workItemId && !hasForm) return;

      // Only cancel/reset summary if switching from one valid work item ID to a different work item ID
      if (workItemId && this.currentWorkItemId && workItemId !== this.currentWorkItemId) {
        this.cancelCurrentSummary();
        const existing = document.getElementById(this.inlineCardId);
        if (existing) existing.remove();
        // Reset scroll auto-trigger for new work item
        this._scrollAutoTriggered = false;
        if (this._cleanupScrollTrigger) {
          this._cleanupScrollTrigger();
          this._cleanupScrollTrigger = null;
        }
      }

      if (workItemId) {
        this.currentWorkItemId = workItemId;
      }

      this.injectInlineBox();
    };

    checkAndInject();

    // Lightweight 1-second interval + navigation events to prevent CPU spikes
    setInterval(checkAndInject, 1000);
    window.addEventListener("popstate", checkAndInject);
    window.addEventListener("hashchange", checkAndInject);
    document.addEventListener("click", () => setTimeout(checkAndInject, 400));
  }

  findSummaryInsertionElement() {
    const activeForm = this.getActiveWorkItemForm() || document.body;

    // Find the main left content column — the direct parent of all work item sections
    const mainColumn = activeForm.querySelector(
      ".work-item-form-main-column, .work-item-left-pane, .work-item-form-content, .work-item-form-body"
    );

    if (mainColumn) {
      // Return the last direct child so insertBefore(nextSibling) places card at the very bottom
      const children = Array.from(mainColumn.children).filter(
        (c) => c.id !== this.inlineCardId
      );
      return children[children.length - 1] || mainColumn;
    }

    // Fallback: find Discussion by label and walk to its topmost section sibling
    const allLabels = Array.from(activeForm.querySelectorAll("label, .work-item-control-label, .ms-Label, h2, h3, span"));
    for (const label of allLabels) {
      if (/^discussion$/i.test((label.innerText || label.textContent || "").trim())) {
        // Walk up until we find a node whose parent has multiple section siblings
        let node = label;
        while (node && node.parentElement && node.parentElement !== document.body) {
          const siblings = node.parentElement.children.length;
          if (siblings >= 3) return node; // found a section-level container
          node = node.parentElement;
        }
        return node || label;
      }
    }

    return null;
  }

  injectInlineBox() {
    const existing = document.getElementById(this.inlineCardId);

    // If card already exists in the document DOM, keep it and return immediately
    if (existing && document.body.contains(existing)) {
      return;
    }
    if (existing) {
      existing.remove();
    }

    const anchorEl = this.findSummaryInsertionElement();
    if (!anchorEl) return;

    const theme = this.getThemeStyles();
    const box = document.createElement("div");
    box.id = this.inlineCardId;
    Object.assign(box.style, {
      marginTop: "16px",
      marginBottom: "20px",
      borderRadius: "12px",
      border: theme.border,
      background: theme.background,
      boxShadow: theme.shadow,
      color: theme.bodyText,
      fontFamily: "system-ui, -apple-system, sans-serif",
      overflow: "hidden",
      clear: "both",
      transition: "all 0.3s ease",
    });

    box.innerHTML = `
      <div style="padding: 12px 16px; background: ${theme.headerBg}; border-bottom: 1px solid ${theme.headerBorder}; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; color: ${theme.headerText};">
          <span>✨</span> Work Item Summary
        </div>
        <div style="display: flex; gap: 6px; align-items: center;">
          <button id="webllm-inline-generate-btn" type="button" style="background: ${theme.btnGenBg}; color: ${theme.btnGenText}; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">✨ Generate</button>
          <button id="webllm-inline-cancel-btn" type="button" title="Cancel summary" style="background: ${theme.btnCancelBg}; color: ${theme.btnCancelText}; border: ${theme.btnCancelBorder}; width: 26px; height: 26px; border-radius: 50%; display: none; align-items: center; justify-content: center; font-size: 13px; font-weight: bold; cursor: pointer; padding: 0;">✕</button>
          <button id="webllm-inline-copy-btn" type="button" style="background: ${theme.btnCopyBg}; color: ${theme.btnCopyText}; border: 1px solid ${theme.btnCopyBorder}; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; display: none;">📋 Copy</button>
          <button id="webllm-inline-clear-btn" type="button" title="Clear saved summary" style="background: ${theme.btnCopyBg}; color: ${theme.btnCopyText}; border: 1px solid ${theme.btnCopyBorder}; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; display: none;">🗑️</button>
        </div>
      </div>
      <div id="webllm-inline-body" style="padding: 16px; max-height: 260px; overflow-y: auto; font-size: 13.5px; line-height: 1.6; color: ${theme.bodyText}; scrollbar-width: thin; scrollbar-color: ${theme.scrollbar};">
        <span style="color: ${theme.mutedText}; font-style: italic;">Loading ticket details...</span>
      </div>
    `;

    if (anchorEl === document.body || !anchorEl.parentNode) {
      anchorEl.appendChild(box);
    } else if (anchorEl.nextSibling) {
      anchorEl.parentNode.insertBefore(box, anchorEl.nextSibling);
    } else {
      anchorEl.parentNode.appendChild(box);
    }

    const genBtn = document.getElementById("webllm-inline-generate-btn");
    const cancelBtn = document.getElementById("webllm-inline-cancel-btn");
    const clearBtn = document.getElementById("webllm-inline-clear-btn");

    if (genBtn) {
      genBtn.addEventListener("click", () => this.handleInlineSummarize(false));
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.cancelCurrentSummary());
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", () => this.clearSavedSummary());
    }

    // Check if summary is saved for this ticket ID, otherwise wait for manual click
    const workItemId = this.currentWorkItemId || this.getWorkItemId();
    const storageKey = workItemId ? `ado_summary_${workItemId}` : null;

    if (storageKey) {
      chrome.storage.local.get([storageKey], (res) => {
        const savedSummary = res[storageKey];
        if (savedSummary) {
          this.renderSummaryText(savedSummary, theme);
        } else {
          const inlineBody = document.getElementById("webllm-inline-body");
          if (inlineBody) {
            inlineBody.innerHTML = `<span style="color: ${theme.mutedText}; font-style: italic;">Click "Generate" to summarize this Work Item.</span>`;
          }
          this.showDiscussionWarningIfCollapsed(theme);
          this.setupScrollAutoTrigger();
        }
      });
    } else {
      const inlineBody = document.getElementById("webllm-inline-body");
      if (inlineBody) {
        inlineBody.innerHTML = `<span style="color: ${theme.mutedText}; font-style: italic;">Click "Generate" to summarize this Work Item.</span>`;
      }
      this.showDiscussionWarningIfCollapsed(theme);
      this.setupScrollAutoTrigger();
    }
  }

  setupScrollAutoTrigger() {
    if (this._scrollAutoTriggered) return;

    const onScroll = (event) => {
      const target = event.target;
      if (!target || target === document || target === document.documentElement) {
        // Fallback to page-level scrolling if body scrolls
        const scrollEl = document.scrollingElement || document.documentElement;
        const atBottom = scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 120;
        if (atBottom) {
          document.removeEventListener("scroll", onScroll, { capture: true });
          if (this._scrollAutoTriggered) return;
          this._scrollAutoTriggered = true;
          setTimeout(() => {
            const genBtn = document.getElementById("webllm-inline-generate-btn");
            if (genBtn) genBtn.click();
          }, this._autoDelay);
        }
        return;
      }

      // Check if the scroll target is inside the work item form
      const inWorkItem = target.closest?.(".work-item-view, .work-item-dialog, .work-item-form, .work-item-form-main-column");
      if (inWorkItem) {
        const atBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 120;
        if (atBottom) {
          document.removeEventListener("scroll", onScroll, { capture: true });
          if (this._scrollAutoTriggered) return;
          this._scrollAutoTriggered = true;
          setTimeout(() => {
            const genBtn = document.getElementById("webllm-inline-generate-btn");
            if (genBtn) genBtn.click();
          }, this._autoDelay);
        }
      }
    };

    document.addEventListener("scroll", onScroll, { capture: true, passive: true });

    // Clean up if the work item changes
    this._cleanupScrollTrigger = () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }

  showDiscussionWarningIfCollapsed(theme) {
    // Check if Discussion has visible comment content
    const commentSelectors = [
      '.work-item-comment-item-text',
      '.comment-item-content',
      '.comments-item-content',
      '.work-item-comment',
      '.discussion-messages',
    ];
    const hasVisibleComments = commentSelectors.some((sel) => {
      const el = document.querySelector(sel);
      return el && el.offsetHeight > 0;
    });

    // Also check raw text length of the discussion container
    const discussionEl = document.querySelector(
      '[aria-label*="Discussion"], .work-item-form-discussion, .workitem-control-discussion'
    );
    const discussionTextLen = discussionEl ? (discussionEl.innerText || "").trim().length : 0;
    const isExpanded = hasVisibleComments || discussionTextLen > 80;

    if (!isExpanded) {
      if (document.getElementById("webllm-discussion-warning")) return;
      const box = document.getElementById(this.inlineCardId);
      if (!box) return;
      const banner = document.createElement("div");
      banner.id = "webllm-discussion-warning";
      banner.style.cssText = [
        "display:flex", "align-items:center", "gap:8px",
        "padding:8px 16px",
        "background:rgba(251,191,36,0.12)",
        "border-bottom:1px solid rgba(251,191,36,0.3)",
        "font-size:12px", "color:#f59e0b",
      ].join(";");
      banner.innerHTML = `
        <span style="font-size:15px;">⚠️</span>
        <span>Discussion is collapsed — expand it first so comments are included in the summary.</span>
      `;
      const inlineBody = document.getElementById("webllm-inline-body");
      if (inlineBody) box.insertBefore(banner, inlineBody);
    }
  }

  renderMarkdownToHtml(mdText) {
    if (!mdText) return "";
    const lines = mdText.split(/\r?\n/);
    const htmlLines = [];
    let inList = false;
    let listType = ""; // "ul" or "ol"

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (inList) {
          htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
          inList = false;
        }
        htmlLines.push("<div style='height: 8px;'></div>");
        continue;
      }

      // Escape HTML
      let lineHtml = trimmed
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Inline formatting
      lineHtml = lineHtml
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: inherit; font-weight: 700;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(128,128,128,0.18); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;">$1</code>');

      // Headings (H1 - H6)
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        if (inList) {
          htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
          inList = false;
        }
        const level = headingMatch[1].length;
        const text = lineHtml.replace(/^#{1,6}\s+/, "");
        const fontSizes = { 1: "16px", 2: "15px", 3: "14px", 4: "13.5px", 5: "13px", 6: "12.5px" };
        const margins = { 1: "14px 0 6px 0", 2: "12px 0 6px 0", 3: "10px 0 4px 0", 4: "8px 0 4px 0", 5: "6px 0 2px 0", 6: "6px 0 2px 0" };
        const border = level <= 2 ? "border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 3px;" : "";
        htmlLines.push(`<h${level} style="margin: ${margins[level]}; font-size: ${fontSizes[level]}; font-weight: 700; color: inherit; ${border}">${text}</h${level}>`);
        continue;
      }

      // Unordered Lists (- or * or +)
      const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
      if (ulMatch) {
        if (!inList || listType !== "ul") {
          if (inList) htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
          htmlLines.push('<ul style="margin: 4px 0; padding-left: 20px;">');
          inList = true;
          listType = "ul";
        }
        htmlLines.push(`<li style="margin-bottom: 4px; line-height: 1.5;">${lineHtml.replace(/^[-*+]\s+/, "")}</li>`);
        continue;
      }

      // Ordered Lists (1. or 2.)
      const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (!inList || listType !== "ol") {
          if (inList) htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
          htmlLines.push('<ol style="margin: 4px 0; padding-left: 20px;">');
          inList = true;
          listType = "ol";
        }
        htmlLines.push(`<li style="margin-bottom: 4px; line-height: 1.5;">${lineHtml.replace(/^\d+\.\s+/, "")}</li>`);
        continue;
      }

      // Normal text line
      if (inList) {
        htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
        inList = false;
      }
      htmlLines.push(`<div style="margin-bottom: 4px; line-height: 1.5;">${lineHtml}</div>`);
    }

    if (inList) {
      htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
    }
    return htmlLines.join("");
  }

  setRunningState(isRunning) {
    this.isSummarizing = isRunning;
    const genBtn = document.getElementById("webllm-inline-generate-btn");
    const cancelBtn = document.getElementById("webllm-inline-cancel-btn");
    const copyBtn = document.getElementById("webllm-inline-copy-btn");
    const clearBtn = document.getElementById("webllm-inline-clear-btn");

    if (isRunning) {
      if (genBtn) genBtn.style.display = "none";
      if (copyBtn) copyBtn.style.display = "none";
      if (clearBtn) clearBtn.style.display = "none";
      if (cancelBtn) cancelBtn.style.display = "inline-flex";
    } else {
      if (genBtn) genBtn.style.display = "inline-block";
      if (cancelBtn) cancelBtn.style.display = "none";
    }
  }

  clearSavedSummary() {
    const workItemId = this.currentWorkItemId || this.getWorkItemId();
    if (workItemId) {
      chrome.storage.local.remove([`ado_summary_${workItemId}`]);
    }

    const inlineBody = document.getElementById("webllm-inline-body");
    const copyBtn = document.getElementById("webllm-inline-copy-btn");
    const clearBtn = document.getElementById("webllm-inline-clear-btn");
    const genBtn = document.getElementById("webllm-inline-generate-btn");
    const theme = this.getThemeStyles();

    this.setRunningState(false);

    if (genBtn) {
      genBtn.textContent = "✨ Generate";
      genBtn.style.background = theme.btnGenBg;
      genBtn.style.color = theme.btnGenText;
      genBtn.disabled = false;
    }

    if (copyBtn) copyBtn.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";

    if (inlineBody) {
      inlineBody.innerHTML = `<span style="color: ${theme.mutedText}; font-style: italic;">Saved summary cleared. Click "Generate" to start.</span>`;
    }
  }

  cancelCurrentSummary() {
    clearTimeout(this.autoRunTimer);
    if (this.activePort) {
      try { this.activePort.disconnect(); } catch (e) {}
      this.activePort = null;
    }
    this.currentRequestId++;
    this.setRunningState(false);

    const inlineBody = document.getElementById("webllm-inline-body");
    const theme = this.getThemeStyles();

    if (inlineBody) {
      inlineBody.innerHTML = `<span style="color: ${theme.mutedText}; font-style: italic;">Generation cancelled. Click "Generate" to start.</span>`;
    }
  }

  renderSummaryText(summaryText, theme = this.getThemeStyles()) {
    const inlineBody = document.getElementById("webllm-inline-body");
    const copyBtn = document.getElementById("webllm-inline-copy-btn");
    const clearBtn = document.getElementById("webllm-inline-clear-btn");
    const genBtn = document.getElementById("webllm-inline-generate-btn");

    this.setRunningState(false);

    if (genBtn) {
      genBtn.textContent = "🔄 Regenerate";
      genBtn.style.background = theme.btnGenBg;
      genBtn.style.color = theme.btnGenText;
      genBtn.disabled = false;
    }

    const renderedHtml = this.renderMarkdownToHtml(summaryText);

    if (inlineBody) {
      inlineBody.innerHTML = `<div style="font-size: 13.5px; color: ${theme.bodyText};">${renderedHtml}</div>`;
      inlineBody.scrollTop = inlineBody.scrollHeight;
    }

    if (copyBtn) {
      copyBtn.style.display = "inline-block";
      copyBtn.onclick = () => {
        // Copies the original raw unformatted markdown text byte-for-byte!
        navigator.clipboard.writeText(summaryText);
        copyBtn.textContent = "✓ Copied!";
        setTimeout(() => { copyBtn.textContent = "📋 Copy"; }, 2000);
      };
    }

    if (clearBtn) {
      clearBtn.style.display = "inline-block";
    }
  }

  getActiveWorkItemForm() {
    // Find active visible modal/dialog or main form column
    const containers = Array.from(document.querySelectorAll(".work-item-dialog, .work-item-form, .work-item-view, .work-item-form-main-column"));
    for (const container of containers) {
      if (container.offsetWidth > 0 && container.offsetHeight > 0 && window.getComputedStyle(container).display !== "none") {
        return container;
      }
    }
    // Fallback to closest parent container of the inline box
    const inlineBox = document.getElementById(this.inlineCardId);
    if (inlineBox) {
      const parentForm = inlineBox.closest(".work-item-form, .work-item-dialog, .work-item-view, .work-item-form-main-column");
      if (parentForm) return parentForm;
    }
    return document.body;
  }

  extractWorkItemData() {
    const activeForm = this.getActiveWorkItemForm();
    let descriptionText = "";
    let acceptanceCriteriaText = "";
    let commentsText = "";

    const isVisible = (el) => {
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return el.offsetWidth > 0 && el.offsetHeight > 0 && style.display !== "none" && style.visibility !== "hidden";
    };

    const getTextFromElement = (el) => {
      if (!el) return "";
      let text = (el.innerText || el.textContent || "").trim();

      // Check inner iframe if rich editor is framed in Azure DevOps
      const iframes = el.querySelectorAll("iframe");
      iframes.forEach((iframe) => {
        try {
          const iframeText = (iframe.contentWindow?.document?.body?.innerText || "").trim();
          if (iframeText) text += "\n" + iframeText;
        } catch (e) {}
      });

      return text.trim();
    };

    // Description selectors in active form
    const descSelectors = [
      '[aria-label*="Description"]',
      '.work-item-description',
      '[data-vss-mention-target*="Description"]',
      '.workitem-control-description',
      '.work-item-form-description',
    ];
    const descEls = Array.from(activeForm.querySelectorAll(descSelectors.join(", "))).filter(isVisible);
    descEls.forEach((el) => {
      const text = getTextFromElement(el);
      if (text) descriptionText += text + "\n";
    });

    // Acceptance criteria selectors in active form
    const acSelectors = [
      '[aria-label*="Acceptance Criteria"]',
      '.workitem-control-acceptance-criteria',
      '[data-vss-mention-target*="Acceptance"]',
    ];
    const acEls = Array.from(activeForm.querySelectorAll(acSelectors.join(", "))).filter(isVisible);
    acEls.forEach((el) => {
      const text = getTextFromElement(el);
      if (text) acceptanceCriteriaText += text + "\n";
    });

    // Discussion / Comments elements in active form
    const commentItemSelectors = [
      '.work-item-comment-item-text',
      '.comment-item-content',
      '.comments-item-content',
      '.activity-feed-comment-text',
      '.comment-text',
      '.comment-item',
      '.work-item-comment',
      '.discussion-messages .message-content',
      '.comments-thread .comment-content',
    ];

    let commentEls = Array.from(activeForm.querySelectorAll(commentItemSelectors.join(", "))).filter(isVisible);

    // Fallback if specific comment selectors returned nothing
    if (commentEls.length === 0) {
      const discussionContainer = activeForm.querySelector('[aria-label*="Discussion"], .workitem-control-discussion, [data-vss-mention-target*="Discussion"], .work-item-form-discussion');
      if (discussionContainer) {
        commentEls = Array.from(discussionContainer.querySelectorAll("p, div, span")).filter((el) => {
          return isVisible(el) && el.children.length === 0 && (el.innerText || el.textContent || "").trim().length > 5;
        });
      }
    }

    const seenTexts = new Set();
    commentEls.forEach((el) => {
      const text = getTextFromElement(el);
      if (
        text &&
        text.length > 3 &&
        !/^discussion$/i.test(text) &&
        !/^add a comment/i.test(text) &&
        !/^save$/i.test(text) &&
        !/^cancel$/i.test(text) &&
        !seenTexts.has(text)
      ) {
        seenTexts.add(text);
        commentsText += `- ${text}\n`;
      }
    });

    // Ultimate Fallback search strictly within active form if specific selectors yielded nothing
    if (!descriptionText.trim()) {
      const rawText = (activeForm.innerText || activeForm.textContent || "").trim();
      const lines = rawText.split(/\r?\n/).filter((l) => {
        const line = l.trim();
        return line.length > 10 && !line.includes("Work Item Summary") && !line.includes("✨ Generate");
      });
      descriptionText = lines.slice(0, 40).join("\n");
    }

    return { descriptionText, acceptanceCriteriaText, commentsText };
  }

  async handleInlineSummarize(isAutoRun = false) {
    const inlineBody = document.getElementById("webllm-inline-body");
    const theme = this.getThemeStyles();

    const requestId = ++this.currentRequestId;
    this.setRunningState(true);

    if (this.activePort) {
      try { this.activePort.disconnect(); } catch (e) {}
      this.activePort = null;
    }

    const data = this.extractWorkItemData();

    if (inlineBody) {
      inlineBody.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; color: ${theme.headerText};">
          <svg style="width: 20px; height: 20px; animation: webllm-spin 0.8s linear infinite; will-change: transform;" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="${theme.spinnerBg}" stroke-width="3"></circle>
            <path d="M12 2 a 10 10 0 0 1 10 10" stroke="${theme.spinnerColor}" stroke-width="3" stroke-linecap="round"></path>
          </svg>
          <span id="webllm-inline-status-text">${isAutoRun ? "Auto-generating summary..." : "Generating Work Item summary..."}</span>
        </div>
        <style>
          @keyframes webllm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `;
    }

    let accumulatedSummary = "";

    try {
      this.activePort = chrome.runtime.connect({ name: "streamAdoSummary" });

      this.activePort.onMessage.addListener((res) => {
        if (requestId !== this.currentRequestId || !this.isSummarizing) {
          if (this.activePort) {
            try { this.activePort.disconnect(); } catch (e) {}
            this.activePort = null;
          }
          return;
        }

        if (res.error) {
          this.setRunningState(false);
          if (inlineBody) {
            inlineBody.innerHTML = `<span style="color: #f87171;">Error generating summary: ${res.message || "Unknown error"}</span>`;
          }
          return;
        }

        if (res.chunk) {
          accumulatedSummary += res.chunk;
          const html = this.renderMarkdownToHtml(accumulatedSummary);
          if (inlineBody) {
            inlineBody.innerHTML = `<div style="font-size: 13.5px; color: ${theme.bodyText};">${html}</div>`;
            inlineBody.scrollTop = inlineBody.scrollHeight;
          }
        }

        if (res.done) {
          this.activePort = null;
          this.renderSummaryText(accumulatedSummary, theme);

          const workItemId = this.currentWorkItemId || this.getWorkItemId();
          if (workItemId) {
            chrome.storage.local.set({ [`ado_summary_${workItemId}`]: accumulatedSummary });
          }
        }
      });

      this.activePort.postMessage({
        descriptionText: data.descriptionText,
        acceptanceCriteriaText: data.acceptanceCriteriaText,
        commentsText: data.commentsText,
        targetLanguage: this._targetLanguage || "English",
      });
    } catch (err) {
      if (requestId !== this.currentRequestId) return;
      this.setRunningState(false);
      if (inlineBody) {
        inlineBody.innerHTML = `<span style="color: #f87171;">Error: ${err.message || String(err)}</span>`;
      }
    }
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "loadProgress" && msg.text) {
    const statusTextEl = document.getElementById("webllm-inline-status-text");
    if (statusTextEl) {
      const pct = Math.round((msg.progress || 0) * 100);
      statusTextEl.textContent = `Initializing WebGPU model (${pct}%)...`;
    }
  }
});

new AdoWorkItemSummarizer();

