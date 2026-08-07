# Azure DevOps Work Item Summary Specification & Implementation Guide

This document contains the complete technical specification, DOM selector strategy, streaming architecture, UI design system, and prompt structure for the **Azure DevOps Work Item Summarizer** feature in the WebLLM Chrome Extension.

---

## 1. Feature Architecture Overview

The Azure DevOps (ADO) Work Item Summarizer automatically extracts ticket context (Description, Acceptance Criteria, and Discussion Comments), sends the payload to a local WebGPU LLM (`Qwen2.5-0.5B-Instruct` via `@mlc-ai/web-llm`) or an OpenAI-compatible API, and streams a 5-section structured summary directly into an inline card embedded within the Azure DevOps Work Item UI.

```
+-------------------------------------------------------------------------+
|                       Azure DevOps Work Item Page                       |
|                                                                         |
|  [ Work Item Description ]                                              |
|  [ Acceptance Criteria ]                                                |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | ✨ Work Item Summary               [✨ Generate] [📋 Copy] [🗑️]   |  |
|  +-------------------------------------------------------------------+  |
|  |  ### Executive Summary                                            |  |
|  |  ...                                                              |  |
|  |  ### Investigation & Discussion Insights                          |  |
|  |  ...                                                              |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  [ Discussion & Activity Comments Feed ]                                |
+-------------------------------------------------------------------------+
```

---

## 2. Key Capabilities & Requirements

### 2.1 UI & Layout Integration
1. **Inline Embedded Summary Box**:
   - Injected into the active Work Item form below Acceptance Criteria or Description.
   - Theme-aware styles matching ADO Light Theme and Dark Mode.
   - Smooth card container with rounded corners, distinct header background, and scrollable body.
2. **Action Controls**:
   - **`✨ Generate` / `🔄 Regenerate`**: Triggers summarization on demand.
   - **`✕` (Cancel Icon Button)**: Displays while generating; immediately aborts streaming and stops inference.
   - **`📋 Copy`**: Appears when summary exists; copies the **raw unformatted Markdown string** byte-for-byte to `navigator.clipboard`.
   - **`🗑️` (Clear Icon Button)**: Appears when summary exists; deletes saved ticket summary from `chrome.storage.local` and resets UI.
3. **Live Streaming & Auto-Scroll**:
   - Long-lived Port connection (`streamAdoSummary`) streams tokens live.
   - Parses Markdown HTML dynamically during streaming.
   - Auto-scrolls `inlineBody.scrollTop = inlineBody.scrollHeight` as new tokens arrive.

### 2.2 Local Storage & Persistence
- Saves completed ticket summaries in `chrome.storage.local` under key `ado_summary_${workItemId}`.
- Re-opening the same ticket displays the saved summary instantly without re-generating.

---

## 3. DOM Extraction & Selector Strategy

### 3.1 Form Isolation Strategy
To prevent multi-ticket data leakage when switching between modal dialogs or boards:
```javascript
getActiveWorkItemForm() {
  const containers = Array.from(document.querySelectorAll(
    ".work-item-dialog, .work-item-form, .work-item-view, .work-item-form-main-column"
  ));
  for (const container of containers) {
    if (container.offsetWidth > 0 && container.offsetHeight > 0 && window.getComputedStyle(container).display !== "none") {
      return container;
    }
  }
  return document.body;
}
```

### 3.2 Data Extraction Selectors

#### Description:
```javascript
activeForm.querySelectorAll(
  '[aria-label*="Description"], .work-item-description, [data-vss-mention-target*="Description"]'
)
```

#### Acceptance Criteria:
```javascript
activeForm.querySelectorAll(
  '[aria-label*="Acceptance Criteria"], .workitem-control-acceptance-criteria, [data-vss-mention-target*="Acceptance"]'
)
```

#### Discussion & Activity Feed Comments:
```javascript
const commentSelectors = [
  '.work-item-comment-item-text',
  '.comment-item-content',
  '.comments-item-content',
  '.activity-feed-comment-text',
  '.comment-text',
  '.comment-item',
  '.work-item-comment',
  '.discussion-messages .message-content',
  '.comments-thread .comment-content'
];
```

#### UI Noise Filtering:
Filters out button titles and generic text:
```javascript
!/^discussion$/i.test(text) &&
!/^add a comment/i.test(text) &&
!/^save$/i.test(text) &&
!/^cancel$/i.test(text)
```

---

## 4. Markdown Rendering Engine

Built-in zero-dependency Markdown parser in `content.js`:

```javascript
renderMarkdownToHtml(mdText) {
  if (!mdText) return "";
  const lines = mdText.split(/\r?\n/);
  const htmlLines = [];
  let inList = false;
  let listType = "";

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

    let lineHtml = trimmed
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Inline formatting: Bold, Italic, Code
    lineHtml = lineHtml
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: rgba(128,128,128,0.18); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>');

    // Headings (H1 - H6)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (inList) {
        htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
        inList = false;
      }
      const level = headingMatch[1].length;
      const text = lineHtml.replace(/^#{1,6}\s+/, "");
      htmlLines.push(`<h${level} style="margin: 8px 0 4px 0; font-weight: 700;">${text}</h${level}>`);
      continue;
    }

    // Unordered Lists
    const ulMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        if (inList) htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
        htmlLines.push('<ul style="margin: 4px 0; padding-left: 20px;">');
        inList = true;
        listType = "ul";
      }
      htmlLines.push(`<li style="margin-bottom: 4px;">${lineHtml.replace(/^[-*+]\s+/, "")}</li>`);
      continue;
    }

    // Paragraph
    if (inList) {
      htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
      inList = false;
    }
    htmlLines.push(`<div style="margin-bottom: 4px;">${lineHtml}</div>`);
  }

  if (inList) htmlLines.push(listType === "ol" ? "</ol>" : "</ul>");
  return htmlLines.join("");
}
```

---

## 5. System Prompt & Prompt Template

### 5.1 System Prompt Instructions (`background.ts`)
```typescript
{
  role: "system",
  content: "You are an Agile Business Analyst. Synthesize the Work Item details into Markdown with headings '### Executive Summary', '### Key Requirements & Scope', '### Investigation & Discussion Insights', '### Proposed / Implemented Solution', and '### Acceptance Criteria Summary'. Output ONLY the summary content. Do NOT echo system prompts or instructions."
}
```

### 5.2 User Prompt Template (`constants.ts`)
```typescript
export const DEFAULT_ADO_SUMMARY_PROMPT = `Synthesize the following Azure DevOps Work Item details into a clear, structured summary:

Work Item Description:
{description}

Acceptance Criteria:
{acceptance_criteria}

Discussion & Comments:
{comments}`;
```

---

## 6. WebLLM Engine & Model Configurations

### 6.1 Model Filtering
- Exclude `Gemma-3` / `gemma3` models due to `@mlc-ai/web-llm` internal configuration conflicts (`context_window_size: 4096` vs `sliding_window_size: 512`).
- Recommended Models:
  - **`Qwen2.5-0.5B-Instruct-q4f16_1-MLC`** (~350MB - Ultra-fast, low VRAM)
  - **`Qwen3.5-0.8B-q4f16_1-MLC`** (~550MB - Higher accuracy)

### 6.2 Model Overrides (`background.ts`)
```typescript
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
});
```

### 6.3 Background Startup Preloading
```typescript
chrome.runtime.onStartup?.addListener(() => {
  ensureEngine().catch((e) => console.warn("[WebLLM] Auto-load on startup failed:", e.message));
});
```

---

## 7. Extension Popup UI Tabs

The popup is divided into two tabs:
1. **`⚙️ General & LLM`**: Provider selector (WebLLM vs OpenAI), Model selector, Proofread prompt, API keys.
2. **`📋 Work Item Summary`**:
   - `adoAutoSummary`: Toggle auto-summary on opening work items.
   - `adoAutoDelay`: Delay input in ms (default 1000ms - 2500ms).
   - `adoSummaryPrompt`: Textarea for custom summary template with reset button.
   - **Clear Saved Ticket Summaries**: Button to flush all cached `ado_summary_*` keys from `chrome.storage.local`.

---

*This specification document can be referenced anytime to re-implement or expand the Azure DevOps Work Item Summarizer feature.*
