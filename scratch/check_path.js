const path = require('path');

const artifactDir = "C:\\Users\\Moham\\.gemini\\antigravity-ide\\brain\\32378487-c74a-4f0a-bcd1-7509e31ea80c";
const workspaceDir = "c:\\Users\\Moham\\Desktop\\APPAGQ";

console.log("Workspace: ", workspaceDir);
console.log("Artifact Dir: ", artifactDir);

const testPaths = [
  "/Users/Moham/.gemini/antigravity-ide/brain/32378487-c74a-4f0a-bcd1-7509e31ea80c/development_workflow_roadmap_1780445697071.png",
  "/C:/Users/Moham/.gemini/antigravity-ide/brain/32378487-c74a-4f0a-bcd1-7509e31ea80c/development_workflow_roadmap_1780445697071.png",
  "/C:\\Users\\Moham\\.gemini\\antigravity-ide\\brain\\32378487-c74a-4f0a-bcd1-7509e31ea80c\\development_workflow_roadmap_1780445697071.png",
  "\\\\C:\\Users\\Moham\\.gemini\\antigravity-ide\\brain\\32378487-c74a-4f0a-bcd1-7509e31ea80c\\development_workflow_roadmap_1780445697071.png",
  "C:\\Users\\Moham\\.gemini\\antigravity-ide\\brain\\32378487-c74a-4f0a-bcd1-7509e31ea80c\\development_workflow_roadmap_1780445697071.png",
  "C:/Users/Moham/.gemini/antigravity-ide/brain/32378487-c74a-4f0a-bcd1-7509e31ea80c/development_workflow_roadmap_1780445697071.png"
];

for (const p of testPaths) {
  const resolved = path.resolve(workspaceDir, p);
  const startsWith = resolved.toLowerCase().startsWith(artifactDir.toLowerCase());
  const startsWithExact = resolved.startsWith(artifactDir);
  console.log(`\nInput: ${p}`);
  console.log(`Resolved: ${resolved}`);
  console.log(`Starts with (case-insensitive): ${startsWith}`);
  console.log(`Starts with (exact): ${startsWithExact}`);
}
