// Resolves a runnable, checksum-verified `trustabl` binary.
//
// Order: TRUSTABL_BIN (a binary you already have) -> the release named by
// TRUSTABL_VERSION (default DEFAULT_VERSION), downloaded for this OS/arch,
// sha256-verified against the release checksums.txt, and cached under
// ~/.trustabl-code-execution/analyzer/<version>/.
//
// Same resolver as @trustabl/code-execution-agent-reliability-analyzer; both share
// the verified cache, so an agent using both downloads the binary once.
// ponytail: no "latest" lookup or offline fallback; pin a tag. Add both if users ask.

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_VERSION = "v0.1.16";
const REPO = "trustabl/agent-reliability-analyzer";
const log = (msg) => process.stderr.write(`[trustabl] ${msg}\n`);

// A host that leaves an unset ${VAR} placeholder unsubstituted passes the literal; treat it as unset.
export const setting = (value) => {
  const v = value?.trim();
  return v && !/^\$\{[^}]*\}$/.test(v) ? v : undefined;
};

/** Release tags are v-prefixed; accept a bare "0.1.16" too. */
export const normalizeTag = (value) => (/^\d/.test(value) ? `v${value}` : value);

/** linux/darwin/windows + amd64/arm64, matching the release asset matrix. */
export function platformTarget(platform = process.platform, arch = process.arch) {
  const osName = { linux: "linux", darwin: "darwin", win32: "windows" }[platform];
  if (!osName) throw new Error(`Unsupported OS: ${platform}`);
  const goArch = { x64: "amd64", arm64: "arm64" }[arch];
  if (!goArch) throw new Error(`Unsupported architecture: ${arch}`);
  // Windows releases are amd64-only (arm64 Windows runs them via emulation).
  return osName === "windows"
    ? { osName, arch: "amd64", ext: "zip", exe: "trustabl.exe" }
    : { osName, arch: goArch, ext: "tar.gz", exe: "trustabl" };
}

export const assetName = (version, { osName, arch, ext }) =>
  `trustabl_${version.replace(/^v/, "")}_${osName}_${arch}.${ext}`;

/** The sha256 that checksums.txt lists for exactly this asset, or null. */
export function expectedChecksum(checksumsText, asset) {
  for (const line of checksumsText.split("\n")) {
    const [sum, name] = line.trim().split(/\s+/);
    if (name === asset) return sum;
  }
  return null;
}

function extract(archivePath, destDir) {
  // Windows ships a .zip. Windows' own bsdtar (System32\tar.exe, Windows 10+) reads zip; GNU tar
  // from Git cannot, and Expand-Archive has been seen to exit 0 on CI without extracting anything.
  const sysTar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  const ps = (p) => p.replaceAll("'", "''");
  const [cmd, args] =
    process.platform !== "win32" || fs.existsSync(sysTar)
      ? [process.platform === "win32" ? sysTar : "tar", ["-xf", archivePath, "-C", destDir]]
      : ["powershell", ["-NoProfile", "-NonInteractive", "-Command",
          `$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath '${ps(archivePath)}' -DestinationPath '${ps(destDir)}' -Force`]];
  const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true });
  if (r.error || r.status !== 0) {
    throw new Error(`Could not extract ${path.basename(archivePath)}: ${r.error?.message ?? r.stderr?.trim() ?? `exit ${r.status}`}`);
  }
  return `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
}

async function get(url, headers) {
  let res;
  try {
    res = await fetch(url, { headers, redirect: "follow" });
  } catch (err) {
    throw new Error(`Could not reach ${url} (${err.cause?.message ?? err.message}). Check the sandbox has network access.`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

async function install(version, target, finalDir, headers) {
  const asset = assetName(version, target);
  const base = `https://github.com/${REPO}/releases/download/${version}`;
  fs.mkdirSync(path.dirname(finalDir), { recursive: true });
  // Unpack into a temp folder and rename into place, so two cold starts never run a half-extracted binary.
  const tmpDir = path.join(path.dirname(finalDir), `.tmp-${version}-${process.pid}-${randomBytes(4).toString("hex")}`);
  fs.mkdirSync(tmpDir);
  try {
    log(`downloading ${asset}...`);
    const archive = Buffer.from(await (await get(`${base}/${asset}`, headers)).arrayBuffer());
    // A missing checksums.txt, or an asset it does not list, is a hard failure: never run an unverified binary.
    const expected = expectedChecksum(await (await get(`${base}/checksums.txt`, headers)).text(), asset);
    if (!expected) throw new Error(`${asset} is not listed in checksums.txt; refusing to run an unverified binary.`);
    const actual = createHash("sha256").update(archive).digest("hex");
    if (expected !== actual) throw new Error(`Checksum mismatch for ${asset}: expected ${expected}, got ${actual}`);
    const archivePath = path.join(tmpDir, asset);
    fs.writeFileSync(archivePath, archive);
    const extractOutput = extract(archivePath, tmpDir);
    fs.rmSync(archivePath, { force: true });
    if (!fs.existsSync(path.join(tmpDir, target.exe))) {
      const found = fs.readdirSync(tmpDir).join(", ") || "nothing";
      throw new Error(`${asset} did not contain ${target.exe} (extracted: ${found}). ${extractOutput}`.trim());
    }
    if (target.osName !== "windows") fs.chmodSync(path.join(tmpDir, target.exe), 0o755);
    try {
      fs.renameSync(tmpDir, finalDir);
    } catch (err) {
      // Another process installed the same verified version first: keep theirs.
      if (!fs.existsSync(path.join(finalDir, target.exe))) throw err;
    }
    log(`installed trustabl ${version} (checksum verified)`);
    return path.join(finalDir, target.exe);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function resolveBinary(env, home) {
  const override = setting(env.TRUSTABL_BIN);
  if (override) {
    const r = spawnSync(override, ["version"], { stdio: "ignore" });
    if (r.error || r.status !== 0) throw new Error(`TRUSTABL_BIN is ${override}, but \`${override} version\` failed.`);
    return override;
  }
  const version = normalizeTag(setting(env.TRUSTABL_VERSION) ?? DEFAULT_VERSION);
  const target = platformTarget();
  // Shared with the analyzer code-execution package: Forge runs the same binary.
  const finalDir = path.join(home, ".trustabl-code-execution", "analyzer", version);
  const bin = path.join(finalDir, target.exe);
  if (fs.existsSync(bin)) return bin;
  const headers = { "User-Agent": "code-execution-agent-reliability-skills" };
  const token = setting(env.GITHUB_TOKEN);
  if (token) headers.Authorization = `Bearer ${token}`;
  return install(version, target, finalDir, headers);
}

let pending = null;

/** Absolute path of a runnable `trustabl`, downloaded and verified on first use. Memoized; a failure is retried next call. */
export function ensureTrustabl({ env = process.env, home = os.homedir() } = {}) {
  pending ??= resolveBinary(env, home).catch((err) => {
    pending = null;
    throw err;
  });
  return pending;
}
