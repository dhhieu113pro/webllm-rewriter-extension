"use strict";

// Content script for WebLLM text rewriting
// Ported from typollama, adapted to use web-llm via background service worker

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
      .webllm-hook-target {
        border-radius: 12px !important;
        box-shadow: 0 0 0 2px rgba(120,154,255,0.52), 0 0 0 4px rgba(73,201,255,0.22), 0 0 22px rgba(127,122,255,0.35), inset 0 0 14px rgba(156,198,255,0.14) !important;
        animation: webllm-target-glow 1.8s ease-in-out infinite;
        transition: box-shadow 0.2s ease;
      }
      .webllm-hook-indicator {
        position: fixed; display: none; align-items: center; justify-content: center;
        min-width: 46px; height: 26px; padding: 0 9px; border-radius: 999px;
        background: linear-gradient(120deg, rgba(82,119,255,0.93), rgba(53,209,255,0.92), rgba(165,100,255,0.9));
        background-size: 220% 220%; color: #fff; font-size: 13px; font-weight: 700;
        z-index: 2147483646; border: 1px solid rgba(255,255,255,0.32);
        box-shadow: 0 8px 20px rgba(68,113,255,0.34), 0 2px 8px rgba(0,0,0,0.22);
        backdrop-filter: blur(6px); pointer-events: none;
        animation: webllm-gradient-flow 2.2s linear infinite;
      }
      .webllm-hook-indicator__dots { display: inline-flex; gap: 3px; }
      .webllm-hook-indicator__dot {
        width: 5px; height: 5px; border-radius: 50%; background: currentColor;
        opacity: 0.4; box-shadow: 0 0 7px rgba(255,255,255,0.75);
        animation: webllm-dot-pulse 1s infinite ease-in-out;
      }
      .webllm-hook-indicator__dot:nth-child(2) { animation-delay: 0.16s; }
      .webllm-hook-indicator__dot:nth-child(3) { animation-delay: 0.32s; }
      .webllm-hook-indicator--done {
        background: linear-gradient(120deg, rgba(17,124,84,0.94), rgba(36,181,119,0.93));
        box-shadow: 0 8px 20px rgba(20,148,97,0.34), 0 2px 8px rgba(0,0,0,0.22);
        animation: none;
      }
      @keyframes webllm-target-glow {
        0%, 100% { box-shadow: 0 0 0 2px rgba(120,154,255,0.52), 0 0 0 4px rgba(73,201,255,0.22), 0 0 18px rgba(127,122,255,0.3), inset 0 0 12px rgba(156,198,255,0.12); }
        50% { box-shadow: 0 0 0 2px rgba(120,154,255,0.65), 0 0 0 5px rgba(73,201,255,0.3), 0 0 26px rgba(142,128,255,0.42), inset 0 0 18px rgba(160,205,255,0.22); }
      }
      @keyframes webllm-gradient-flow { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
      @keyframes webllm-dot-pulse {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
        40% { transform: translateY(-2.5px) scale(1.03); opacity: 1; }
      }

    `;
    document.documentElement.appendChild(style);
  }

  bindPositionUpdaters() {
    const update = () => {
      if (this.animationFrame !== null) return;
      this.animationFrame = requestAnimationFrame(() => {
        this.animationFrame = null;
        this.updateAllPositions();
      });
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
  }

  createIndicatorElement() {
    const indicator = document.createElement("div");
    indicator.className = "webllm-hook-indicator";
    indicator.innerHTML = '<span class="webllm-hook-indicator__dots"><span class="webllm-hook-indicator__dot"></span><span class="webllm-hook-indicator__dot"></span><span class="webllm-hook-indicator__dot"></span></span>';
    document.body.appendChild(indicator);
    return indicator;
  }

  getRecord(el) {
    let r = this.indicators.get(el);
    if (!r) { r = { indicator: this.createIndicatorElement(), hideTimer: null }; this.indicators.set(el, r); }
    return r;
  }

  updatePosition(el, ind) {
    if (!el || !ind || !document.contains(el)) return;
    const rect = el.getBoundingClientRect();
    ind.style.top = Math.max(8, rect.top - 30) + "px";
    ind.style.left = Math.max(8, rect.right - ind.offsetWidth) + "px";
  }

  updateAllPositions() {
    for (const [el, r] of this.indicators.entries()) {
      if (!document.contains(el)) { r.indicator.remove(); this.indicators.delete(el); continue; }
      if (r.indicator.style.display !== "none") this.updatePosition(el, r.indicator);
    }
  }

  start(el) {
    if (!el) return;
    const r = this.getRecord(el);
    clearTimeout(r.hideTimer);
    r.indicator.classList.remove("webllm-hook-indicator--done");
    r.indicator.innerHTML = '<span class="webllm-hook-indicator__dots"><span class="webllm-hook-indicator__dot"></span><span class="webllm-hook-indicator__dot"></span><span class="webllm-hook-indicator__dot"></span></span>';
    el.classList.add("webllm-hook-target");
    r.indicator.style.display = "inline-flex";
    this.updatePosition(el, r.indicator);
  }

  complete(el) {
    if (!el) return;
    const r = this.indicators.get(el);
    if (!r) return;
    clearTimeout(r.hideTimer);
    r.indicator.classList.add("webllm-hook-indicator--done");
    r.indicator.textContent = "\u2713";
    this.updatePosition(el, r.indicator);
    r.hideTimer = setTimeout(() => this.hide(el), 1200);
  }

  hide(el) {
    const r = this.indicators.get(el);
    if (!r) return;
    clearTimeout(r.hideTimer);
    r.indicator.style.display = "none";
    el.classList.remove("webllm-hook-target");
  }

  fail(el) { this.hide(el); }
}

class TextProcessor {
  constructor(inputElement, copyToClipboard, indicatorManager) {
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

  getText() {
    const { isContentEditable } = this.inputElement;
    let text = this.isSlateEditor
      ? (this.inputElement.querySelector("[data-slate-string]")?.textContent || "")
      : isContentEditable ? this.inputElement.innerText : this.inputElement.value;

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
    return (this.selectionStart !== null && this.selectionEnd !== null &&
      this.selectionStart !== this.selectionEnd && this.selectionStart < text.length &&
      this.selectionEnd <= text.length)
      ? text.substring(this.selectionStart, this.selectionEnd) : text;
  }

  updateContent(newContent) {
    if (this.copyToClipboard) {
      navigator.clipboard.writeText(newContent).catch(e => console.error(e));
      return;
    }
    const input = this.inputElement;
    let finalContent = newContent;
    if (this.selectionStart !== null && this.selectionEnd !== null && this.selectionStart !== this.selectionEnd) {
      finalContent = this.originalText.substring(0, this.selectionStart) + newContent + this.originalText.substring(this.selectionEnd);
    }
    if (this.isSlateEditor) { this.updateSlateContent(finalContent); }
    else if (input.isContentEditable) { this.updateContentEditable(finalContent); }
    else {
      input.value = finalContent;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      if (this.selectionStart !== null) input.setSelectionRange(this.selectionStart + newContent.length, this.selectionStart + newContent.length);
    }
  }

  updateContentEditable(newContent) {
    if (this.selectedRange) {
      this.selectedRange.deleteContents();
      this.selectedRange.insertNode(document.createTextNode(newContent));
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(this.selectedRange);
    } else { this.inputElement.innerText = newContent; }
    this.inputElement.dispatchEvent(new Event("input", { bubbles: true }));
  }

  updateSlateContent(newContent) {
    const textEl = this.inputElement.querySelector("[data-slate-string]");
    if (!textEl) return;
    textEl.dispatchEvent(new Event("compositionstart", { bubbles: true }));
    const sel = window.getSelection(); const range = document.createRange();
    if (this.selectedRange) { sel.removeAllRanges(); sel.addRange(this.selectedRange); }
    else { range.selectNodeContents(textEl); sel.removeAllRanges(); sel.addRange(range); }
    document.dispatchEvent(new Event("selectionchange", { bubbles: true }));
    textEl.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true }));
    textEl.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: newContent, bubbles: true, cancelable: true }));
    if (this.selectedRange) { this.selectedRange.deleteContents(); this.selectedRange.insertNode(document.createTextNode(newContent)); }
    else { textEl.textContent = newContent; }
    textEl.dispatchEvent(new Event("compositionend", { bubbles: true }));
    textEl.dispatchEvent(new InputEvent("input", { inputType: "insertText", data: newContent, bubbles: true, cancelable: false }));
    range.selectNodeContents(textEl); sel.removeAllRanges(); sel.addRange(range);
    this.inputElement.focus();
  }

  async processText() {
    try {
      const text = this.getText();
      if (!text.trim()) return;
      this.indicatorManager?.start(this.inputElement);
      const port = chrome.runtime.connect({ name: "streamRewrite" });
      this.port = port;
      await new Promise((resolve, reject) => {
        port.onMessage.addListener((response) => {
          if (response.error) { port.disconnect(); reject(new Error(response.message || "Unknown error")); return; }
          if (response.chunk) this.accumulatedText += response.chunk;
          if (response.chunk) this.updateContent(this.accumulatedText);
          if (response.done) {
            this.updateContent((this.accumulatedText || "").replace(/\r\n/g, "\n").trim());
            port.disconnect();
            resolve();
          }
        });
        port.onDisconnect.addListener(() => reject(new Error("Connection lost")));
        port.postMessage({ text });
      });
      this.indicatorManager?.complete(this.inputElement);
    } catch (error) {
      this.indicatorManager?.fail(this.inputElement);
      console.error("WebLLM rewrite error:", error.message);
    }
  }

  revertToOriginal() {
    this.indicatorManager?.complete(this.inputElement);
    if (this.originalText) this.updateContent(this.originalText);
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
        const el = document.activeElement;
        if (this.isValidTarget(el)) this.processInput(el);
      }
    });
  }

  isValidTarget(target) {
    if (!target) return false;
    const tag = target.tagName?.toUpperCase();
    return (InputHandler.SUPPORTED_INPUTS.includes(tag) && (tag !== "INPUT" || target.type === "text"))
      || target.isContentEditable
      || (target.getAttribute && target.getAttribute("role") === "textbox");
  }

  handleKeyPress(event) {
    if (!this.isValidTarget(event.target)) return;
    if (event.key === "Escape" && this.activeProcessor) { this.cancelActiveRequest(); return; }
    if (event.ctrlKey && event.key === "z" && !event.shiftKey) {
      const state = this.history.get(event.target);
      if (state && state.index > -1) { event.preventDefault(); event.stopPropagation(); this.undo(event.target); return; }
    }
    if (event.ctrlKey && (event.key === "y" || (event.key === "z" && event.shiftKey))) {
      const state = this.history.get(event.target);
      if (state && state.index < state.entries.length - 1) { event.preventDefault(); event.stopPropagation(); this.redo(event.target); return; }
    }
    if (event.key === "Control") this.handleControlKeyPress(event);
    else this.ctrlSequence = [];
  }

  handleControlKeyPress(event) {
    this.ctrlSequence.push(Date.now());
    clearTimeout(this.ctrlTimer);
    this.ctrlTimer = setTimeout(() => {
      if (this.ctrlSequence.length === 2) { event.preventDefault(); event.stopPropagation(); this.processInput(event.target); }
      this.ctrlSequence = [];
    }, 400);
  }

  async processInput(inputElement) {
    this.cancelActiveRequest();
    const proc = new TextProcessor(inputElement, this.copyToClipboard, this.indicatorManager);
    const beforeText = proc.getText();
    this.activeProcessor = proc;
    await proc.processText();
    this.activeProcessor = null;
    const afterText = proc.getText();
    if (beforeText !== afterText) this.pushHistory(inputElement, beforeText, afterText);
  }

  cancelActiveRequest() {
    if (this.activeProcessor) {
      const proc = this.activeProcessor;
      this.activeProcessor = null;
      if (proc.port) { proc.port.disconnect(); proc.port = null; }
      proc.revertToOriginal();
    }
  }

  pushHistory(element, before, after) {
    let state = this.history.get(element);
    if (!state) { state = { entries: [], index: -1 }; this.history.set(element, state); }
    state.entries = state.entries.slice(0, state.index + 1);
    state.entries.push({ before, after });
    if (state.entries.length > InputHandler.MAX_HISTORY) state.entries.shift();
    state.index = state.entries.length - 1;
  }



  undo(element) {
    const state = this.history.get(element);
    if (!state || state.index < 0) return;
    const entry = state.entries[state.index]; state.index--;
    this.applyText(element, entry.before);
  }

  redo(element) {
    const state = this.history.get(element);
    if (!state || state.index >= state.entries.length - 1) return;
    state.index++; const entry = state.entries[state.index];
    this.applyText(element, entry.after);
  }

  applyText(element, text) {
    if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") element.value = text;
    else element.innerText = text;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }

}

// Initialize
new InputHandler();
