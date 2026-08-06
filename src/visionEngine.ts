import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;

let visionClassifier: any = null;
let isInitializing = false;

export async function getVisionClassifier(progressCallback?: (progress: number, status: string) => void) {
  if (visionClassifier) return visionClassifier;

  if (isInitializing) {
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (visionClassifier) return visionClassifier;
  }

  isInitializing = true;
  try {
    if (progressCallback) progressCallback(0.1, "Initializing ONNX WebGPU vision engine...");

    // Load lightweight MobileNetV4 image classification model (~12MB) for zero-freeze micro vision
    visionClassifier = await pipeline("image-classification", "Xenova/mobilenetv4_conv_small.e2400_r224_in1k", {
      device: "webgpu",
      progress_callback: (info: any) => {
        if (info.status === "progress" && progressCallback) {
          const pct = info.progress ? info.progress / 100 : 0.5;
          progressCallback(pct, `Loading vision model: ${Math.round(pct * 100)}%`);
        }
      },
    });

    if (progressCallback) progressCallback(1.0, "Vision engine ready");
    return visionClassifier;
  } catch (err: any) {
    console.error("[ONNX Vision] Error loading WebGPU vision model:", err);
    throw err;
  } finally {
    isInitializing = false;
  }
}

export async function classifyImage(imageDataUrl: string, progressCallback?: (progress: number, status: string) => void) {
  const classifier = await getVisionClassifier(progressCallback);
  const results = await classifier(imageDataUrl, { topk: 5 });

  // Keywords that identify advertisement / banner / commercial graphics
  const adKeywords = [
    "banner",
    "web banner",
    "advertisement",
    "advertising",
    "billboard",
    "poster",
    "flyer",
    "signboard",
    "display board",
    "label",
    "menu",
    "book jacket",
    "packet",
  ];

  let highestAdScore = 0;
  let topLabel = results[0]?.label || "Image";

  for (const item of results) {
    const labelLower = (item.label || "").toLowerCase();
    if (adKeywords.some((kw) => labelLower.includes(kw))) {
      if (item.score > highestAdScore) {
        highestAdScore = item.score;
      }
    }
  }

  const isAd = highestAdScore > 0.15;
  const description = results
    .map((r: any) => `${r.label} (${Math.round(r.score * 100)}%)`)
    .slice(0, 3)
    .join(", ");

  return {
    isAd,
    confidence: highestAdScore,
    topLabel,
    description: `Contains: ${description}`,
  };
}
