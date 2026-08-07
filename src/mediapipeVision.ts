import { ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision";

let objectDetector: ObjectDetector | null = null;
let isInitializing = false;

export async function getObjectDetector(): Promise<ObjectDetector> {
  if (objectDetector) return objectDetector;

  if (isInitializing) {
    while (isInitializing) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (objectDetector) return objectDetector;
  }

  isInitializing = true;
  try {
    const wasmBase = (typeof chrome !== "undefined" && chrome.runtime?.getURL)
      ? chrome.runtime.getURL("wasm")
      : "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

    const vision = await FilesetResolver.forVisionTasks(wasmBase);

    objectDetector = await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
        delegate: "CPU",
      },
      scoreThreshold: 0.3,
      runningMode: "IMAGE",
    });

    return objectDetector;
  } catch (err: any) {
    isInitializing = false;
    const msg = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
    console.error("[MediaPipe Vision] Init failed:", msg, err);
    throw new Error(`MediaPipe Init Error: ${msg}`);
  } finally {
    isInitializing = false;
  }
}

export async function detectObjects(imageElement: HTMLImageElement | HTMLCanvasElement) {
  const detector = await getObjectDetector();
  const result = detector.detect(imageElement);
  return result.detections ?? [];
}
