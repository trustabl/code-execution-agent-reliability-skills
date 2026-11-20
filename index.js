// Trustabl Forge as plain functions, for agents that write and run code in a
// sandbox. forge() builds a pre-coding reliability skill (SKILL.md) for a
// repository from the agent SDKs it uses; write it, or read just the parts the
// request needs.

import { spawnSync } from "node:child_process";
import path from "node:path";

import { writeSkill } from "./lib/output.js";
import { parseStamp } from "./lib/stamp.js";
import { ensureTrustabl } from "./lib/trustabl-bin.js";

export { ensureTrustabl, parseStamp };

/** Where coding agents look for the skill. */
export const SKILL_DESTINATION = ".claude/skills/trustabl-pre-coding/SKILL.md";
const TIMEOUT_MS = 120_000;
const clean = (values) => (values ?? []).map((v) => v.trim()).filter(Boolean);

function run(bin, args) {
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  if (r.error?.code === "ETIMEDOUT") {
    throw new Error(`trustabl forge did not finish within ${TIMEOUT_MS / 1000}s. The first run also fetches the rules; retry, or check the network.`);
  }
  if (r.error) throw new Error(`Could not run trustabl: ${r.error.message}`);
  return r;
}

/**
 * Generate the skill for a repository. Writes a file only when outputPath is
 * given (inside the repository; an existing file is replaced only if Forge
 * generated it).
 */
export async function forge(target, { policy, lang, outputPath } = {}) {
  if (typeof target !== "string" || !target) throw new Error("forge(target): pass the repository directory");
  const dir = path.resolve(target);
  const args = ["forge", dir];
  if (clean(policy).length) args.push("--policy", clean(policy).join(","));
  if (clean(lang).length) args.push("--lang", clean(lang).join(","));

  const r = run(await ensureTrustabl(), args);
  if (r.status === 1 && /no SDKs detected/.test(r.stderr)) {
    throw new Error(
      "Forge found no supported agent SDK in this repository's dependency manifests. If it does use one (for " +
        'example declared only in a subfolder), call forge() again with policy naming it, such as { policy: ["mcp"] }.\n\n' +
        r.stderr.trim(),
    );
  }
  if (r.status !== 0) throw new Error(`trustabl forge exited with code ${r.status}:\n${r.stderr.trim() || "(no error output)"}`);

  const stamp = parseStamp(r.stdout);
  const written = outputPath?.trim() ? writeSkill(dir, outputPath.trim(), r.stdout) : null;
  return { skill: r.stdout, sdks: stamp?.sdks ?? [], stamp, written, note: r.stderr.trim() };
}

/** The analyzer's version, commit and build date. */
export async function version() {
  const r = run(await ensureTrustabl(), ["version"]);
  if (r.status !== 0) throw new Error(`trustabl version failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}
