import { ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { pipeline, env } from "@xenova/transformers";

// Configure transformers.js environment for extension offscreen context
env.allowLocalModels = false;
env.allowRemoteModels = true;

let objectDetector: ObjectDetector | null = null;
let captionerInstance: any = null;
let isCaptionerLoading = false;

async function getImageCaptioner() {
  if (captionerInstance) return captionerInstance;
  if (isCaptionerLoading) {
    while (isCaptionerLoading) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (captionerInstance) return captionerInstance;
  }

  isCaptionerLoading = true;
  try {
    captionerInstance = await pipeline("image-to-text", "Xenova/vit-gpt2-image-captioning");
    return captionerInstance;
  } finally {
    isCaptionerLoading = false;
  }
}

async function downscaleImage(imageDataUrl: string, maxDimension = 384): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = (err) => reject(err);
    img.src = imageDataUrl;
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen") return false;

  if (message.type === "describeImage") {
    (async () => {
      try {
        const captioner = await getImageCaptioner();
        const resizedUrl = await downscaleImage(message.imageDataUrl, 384).catch(() => message.imageDataUrl);
        const result = await captioner(resizedUrl);
        const description = result?.[0]?.generated_text || "Image showing visual content";
        sendResponse({ success: true, description });
      } catch (err: any) {
        console.error("[Offscreen Captioner]", err);
        sendResponse({ error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message.type === "mediapipeDetect") {
    (async () => {
      try {
        const detector = await initDetector();

        const img = new Image();
        img.src = message.imageDataUrl;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image in offscreen document"));
        });

        const result = detector.detect(img);
        const detections = (result.detections ?? []).map((d) => ({
          name: d.categories[0]?.categoryName ?? "object",
          score: Math.round((d.categories[0]?.score ?? 0) * 100),
        }));

        sendResponse({ success: true, detections });
      } catch (err: any) {
        console.error("[Offscreen MediaPipe]", err);
        sendResponse({ error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message.type === "clipClassifyAd") {
    (async () => {
      try {
        const classifier = await getClipClassifier();
        const candidate_labels = [
          "gambling advertisement banner",
          "promotional ad banner",
          "sports betting banner",
          "regular website photo or graphic"
        ];

        const output = await classifier(message.imageDataUrl, candidate_labels);
        sendResponse({ success: true, results: output });
      } catch (err: any) {
        console.error("[Offscreen CLIP]", err);
        sendResponse({ error: err?.message || String(err) });
      }
    })();
    return true;
  }

  return false;
});

