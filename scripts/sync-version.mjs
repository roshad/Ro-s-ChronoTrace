import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const packageJsonPath = path.join(root, "package.json");
const tauriConfigPath = path.join(root, "src-tauri", "tauri.conf.json");
const cargoTomlPath = path.join(root, "src-tauri", "Cargo.toml");

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
};

const packageJson = readJson(packageJsonPath);
const version = packageJson.version;

if (!version || typeof version !== "string") {
  throw new Error("Could not read version from package.json");
}

const tauriConfig = readJson(tauriConfigPath);
tauriConfig.version = version;
fs.writeFileSync(tauriConfigPath, JSON.stringify(tauriConfig, null, 2) + "\n", "utf8");

const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
const lines = cargoToml.split(/\r?\n/);
let inPackage = false;
let versionUpdated = false;

for (let i = 0; i < lines.length; i += 1) {
  const line = lines[i].trim();
  if (line.startsWith("[") && line.endsWith("]")) {
    inPackage = line === "[package]";
    continue;
  }

  if (inPackage && /^version\s*=/.test(line)) {
    lines[i] = `version = "${version}"`;
    versionUpdated = true;
    break;
  }
}

if (!versionUpdated) {
  throw new Error("Failed to update [package].version in src-tauri/Cargo.toml");
}

const lineEnding = cargoToml.includes("\r\n") ? "\r\n" : "\n";
fs.writeFileSync(cargoTomlPath, lines.join(lineEnding), "utf8");

console.log(`Synced version ${version} to tauri.conf.json and Cargo.toml`);
