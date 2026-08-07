const fs = require("fs");
const path = require("path");

// 1. Copy WASM files from node_modules to dist/wasm
const wasmSrc = path.join(__dirname, "../node_modules/@mediapipe/tasks-vision/wasm");
const wasmDest = path.join(__dirname, "../dist/wasm");

if (!fs.existsSync(wasmDest)) {
  fs.mkdirSync(wasmDest, { recursive: true });
}

const wasmFiles = fs.readdirSync(wasmSrc);
for (const file of wasmFiles) {
  fs.copyFileSync(path.join(wasmSrc, file), path.join(wasmDest, file));
}
console.log("✓ MediaPipe WASM files copied to dist/wasm/");

// 2. Patch dist/manifest.json
const manifestPath = path.join(__dirname, "../dist/manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

// Remove any invalid offscreen_document field Parcel might have passed through
delete manifest.offscreen_document;

// Add web_accessible_resources for ALL wasm files
const resources = wasmFiles.map((f) => `wasm/${f}`);
const wasmResource = {
  resources,
  matches: ["<all_urls>"],
};

if (!manifest.web_accessible_resources) {
  manifest.web_accessible_resources = [];
}
manifest.web_accessible_resources = manifest.web_accessible_resources.filter(
  (r) => !Array.isArray(r.resources) || !r.resources.some((res) => res.startsWith("wasm/"))
);
manifest.web_accessible_resources.push(wasmResource);

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`✓ dist/manifest.json patched — declared ${resources.length} WASM resources`);

// 3. Find the hashed offscreen HTML in dist and copy as offscreen.html
// Parcel names it with a hash. Find it by looking at what HTML files exist besides popup.
const distDir = path.join(__dirname, "../dist");
const htmlFiles = fs.readdirSync(distDir).filter(f => f.endsWith(".html") && !f.startsWith("popup"));

if (htmlFiles.length > 0) {
  // The most recently modified one is the offscreen
  const sorted = htmlFiles
    .map(f => ({ name: f, mtime: fs.statSync(path.join(distDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  const offscreenHashed = sorted[0].name;
  fs.copyFileSync(path.join(distDir, offscreenHashed), path.join(distDir, "offscreen.html"));
  console.log(`✓ offscreen.html copied from ${offscreenHashed}`);
} else {
  console.warn("⚠ No offscreen HTML found in dist/");
}
