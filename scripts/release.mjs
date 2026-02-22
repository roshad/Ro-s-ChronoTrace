import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const input = process.argv[2] ?? "patch";
const allowedBumps = new Set(["patch", "minor", "major"]);
const isExplicitVersion = /^\d+\.\d+\.\d+$/.test(input);

if (!allowedBumps.has(input) && !isExplicitVersion) {
  throw new Error('Usage: node scripts/release.mjs [patch|minor|major|x.y.z]');
}

function run(command) {
  console.log(`\n> ${command}`);
  execSync(command, { cwd: root, stdio: "inherit" });
}

function runCapture(command) {
  return execSync(command, { cwd: root, stdio: "pipe" }).toString().trim();
}

function readVersion() {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

run(`npm version ${input} --no-git-tag-version`);

const version = readVersion();
if (!version) {
  throw new Error("Failed to read version from package.json");
}

run("git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml");
const stagedFiles = runCapture("git diff --cached --name-only");
if (stagedFiles) {
  run(`git commit -m "chore: release v${version}"`);
} else {
  console.log(`\nNo version file changes to commit for v${version}.`);
}

const hasLocalTag = runCapture(`git tag --list v${version}`) !== "";
if (!hasLocalTag) {
  run(`git tag v${version}`);
} else {
  console.log(`\nTag v${version} already exists locally, skipping tag creation.`);
}

const currentBranch = runCapture("git rev-parse --abbrev-ref HEAD");
if (!currentBranch || currentBranch === "HEAD") {
  throw new Error("Cannot determine current branch (detached HEAD).");
}

run(`git push origin ${currentBranch}`);
run(`git push origin v${version}`);

console.log(`\nRelease completed: v${version}`);
