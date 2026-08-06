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

class ImageVisionManager {
  constructor() {
    this.processedImages = new WeakSet();
    this.activeModal = null;
    this.initObserver();
    this.scanImages();
  }

  initObserver() {
    const observer = new MutationObserver(() => this.scanImages());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", () => this.scanImages());
  }

  scanImages() {
    const images = Array.from(document.querySelectorAll("img"));
    images.forEach((img) => {
      if (this.processedImages.has(img)) return;

      const checkAndAddBadge = () => {
        if (img.width >= 300 || img.naturalWidth >= 300) {
          this.processedImages.add(img);
          this.attachBadge(img);
        }
      };

      if (img.complete) {
        checkAndAddBadge();
      } else {
        img.addEventListener("load", checkAndAddBadge, { once: true });
      }
    });
  }

  attachBadge(img) {
    if (img.dataset.webllmVisionBadge) return;
    img.dataset.webllmVisionBadge = "true";

    let parent = img.parentElement;
    if (!parent) return;

    const compStyle = window.getComputedStyle(parent);
    if (compStyle.position === "static") {
      parent.style.position = "relative";
    }

    const badge = document.createElement("button");
    badge.className = "webllm-vision-badge";
    badge.innerHTML = `👁 Describe`;
    Object.assign(badge.style, {
      position: "absolute",
      top: "8px",
      right: "8px",
      zIndex: "2147483640",
      background: "rgba(30, 41, 59, 0.82)",
      color: "#f8fafc",
      border: "1px solid rgba(255, 255, 255, 0.25)",
      borderRadius: "999px",
      padding: "4px 10px",
      fontSize: "11px",
      fontWeight: "600",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      cursor: "pointer",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
      backdropFilter: "blur(8px)",
      transition: "all 0.2s ease",
    });

    badge.addEventListener("mouseenter", () => {
      badge.style.background = "rgba(79, 70, 229, 0.92)";
      badge.style.transform = "scale(1.05)";
    });
    badge.addEventListener("mouseleave", () => {
      badge.style.background = "rgba(30, 41, 59, 0.82)";
      badge.style.transform = "scale(1)";
    });

    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.analyzeAndShowModal(img);
    });

    parent.appendChild(badge);
  }

  async getImageDataUrl(img) {
    try {
      const origW = img.naturalWidth || img.width || 400;
      const origH = img.naturalHeight || img.height || 300;

      // Downscale to max 640px long edge to prevent GPU RAM spike & PC freeze
      const maxDim = 640;
      let targetW = origW;
      let targetH = origH;

      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetW, targetH);
      return canvas.toDataURL("image/jpeg", 0.75);
    } catch (err) {
      console.warn("[WebLLM Vision] Canvas conversion failed, fallback to src:", err);
      return img.src;
    }
  }

  async analyzeAndShowModal(img) {
    this.closeModal();

    const modal = document.createElement("div");
    modal.className = "webllm-vision-modal";
    Object.assign(modal.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      width: "360px",
      maxHeight: "420px",
      zIndex: "2147483647",
      background: "rgba(15, 23, 42, 0.88)",
      color: "#f8fafc",
      borderRadius: "16px",
      padding: "16px",
      boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15)",
      backdropFilter: "blur(16px)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      animation: "webllm-modal-fade 0.3s ease-out",
    });

    modal.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 8px;">
        <span style="font-weight:700; font-size:13px; color:#e2e8f0; display:flex; align-items:center; gap:6px;">
          👁 Image Analysis
        </span>
        <button class="webllm-modal-close" style="background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer; padding:0 4px;">&times;</button>
      </div>
      <div class="webllm-modal-body" style="font-size:12px; line-height:1.6; color:#cbd5e1; overflow-y:auto; flex:1; max-height:300px;">
        <div style="display:flex; align-items:center; gap:8px; color:#94a3b8;">
          <span style="display:inline-block; width:12px; height:12px; border:2px solid #818cf8; border-top-color:transparent; border-radius:50%; animation:webllm-spin 0.8s linear infinite;"></span>
          Analyzing image contents...
        </div>
      </div>
    `;

    const closeBtn = modal.querySelector(".webllm-modal-close");
    closeBtn.addEventListener("click", () => this.closeModal());

    document.body.appendChild(modal);
    this.activeModal = modal;

    // Listen for model load progress updates
    const progressListener = (msg) => {
      if (msg.type === "loadProgress" && this.activeModal) {
        const bodyEl = this.activeModal.querySelector(".webllm-modal-body");
        if (bodyEl) {
          const pct = Math.round((msg.progress || 0) * 100);
          bodyEl.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:6px; color:#94a3b8;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:12px; height:12px; border:2px solid #818cf8; border-top-color:transparent; border-radius:50%; animation:webllm-spin 0.8s linear infinite;"></span>
                <span>${msg.text || "Loading model weights..."}</span>
              </div>
              <div style="width:100%; height:4px; background:rgba(255,255,255,0.1); border-radius:2px; overflow:hidden;">
                <div style="width:${pct}%; height:100%; background:#6366f1; transition:width 0.2s;"></div>
              </div>
            </div>
          `;
        }
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    const dataUrl = await this.getImageDataUrl(img);

    chrome.runtime.sendMessage(
      {
        type: "analyzeImage",
        imageUrl: dataUrl,
        prompt: "Describe what is inside this image in detail.",
      },
      (res) => {
        chrome.runtime.onMessage.removeListener(progressListener);
        const bodyEl = modal.querySelector(".webllm-modal-body");
        if (!bodyEl) return;

        if (res?.error) {
          bodyEl.innerHTML = `<span style="color:#f87171;">⚠️ ${res.error}</span>`;
        } else if (res?.description) {
          bodyEl.textContent = res.description;
        } else {
          bodyEl.textContent = "No description received.";
        }
      }
    );
  }

  closeModal() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }
}

// Add CSS keyframe for spinner
const spinStyle = document.createElement("style");
spinStyle.textContent = `
  @keyframes webllm-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  @keyframes webllm-modal-fade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
`;
document.documentElement.appendChild(spinStyle);

new InputHandler();
new ImageVisionManager();

