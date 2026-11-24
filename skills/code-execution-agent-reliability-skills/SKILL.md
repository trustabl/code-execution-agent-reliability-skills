---
name: code-execution-agent-reliability-skills
description: Generate a pre-coding reliability skill for a repository with Trustabl Forge by writing and running a short script, so the rules for the agent SDKs it uses are in place before code is written. Use when the user wants agent code written to Trustabl's reliability rules, asks for a reliability or safety skill for their repository, or starts building with an agent SDK, and you can run code (a sandbox, a container, or a terminal).
---

# Trustabl Forge, by code execution

Forge reads a repository's dependency manifests (`package.json`,
`pyproject.toml`, `requirements.txt`, `go.mod` and others), finds the agent SDKs
it uses, and builds a `SKILL.md` from Trustabl's detection rules for exactly
those SDKs. The skill is tens of kilobytes. Write it to disk, then show the
user what was installed: the destination path and the sections it covers, and
tell them they can open that file to read it in full. Print a summary, not the
whole body — but never leave the install silent.

## Setup (once per sandbox)

```bash
npm install @trustabl/code-execution-agent-reliability-skills
```

Needs Node 20+ and network access to github.com: the first call downloads the
pinned `trustabl` release and verifies it against the release `checksums.txt`.
It refuses to run a binary that does not match. Set `GITHUB_TOKEN` if GitHub
rate-limits the download.

## The API

```js
import { forge, SKILL_DESTINATION } from "@trustabl/code-execution-agent-reliability-skills";

const r = await forge(".", { outputPath: SKILL_DESTINATION });
console.log(`Skill for ${r.sdks.join(", ")} written to ${r.written}`);
```

`forge(target, options)` options:
- `outputPath`: write the skill here, relative to the repository (usually
  `SKILL_DESTINATION`, `.claude/skills/trustabl-pre-coding/SKILL.md`). It must
  stay inside the repository, and an existing file is replaced only if Forge
  generated it. Omit it to get the content without writing.
- `policy`: SDK categories to add when one is not declared in a manifest, e.g.
  `["mcp"]`.
- `lang`: languages to add (`python`, `typescript`, `go`).

The result has `skill` (the content), `sdks`, `stamp`, `written` and `note`.

## Patterns

Write it and show the user what was installed (path, SDKs, sections, and where
to read it in full):

```js
const r = await forge(".", { outputPath: SKILL_DESTINATION });
console.log(`Installed Trustabl reliability skill -> ${r.written}`);
console.log(`Covers SDKs: ${r.sdks.join(", ")}`);
console.log("Sections:\n" + r.skill.split("\n").filter((l) => l.startsWith("## ")).join("\n"));
console.log(`Open ${r.written} to read the full skill before building.`);
```

Preview without writing (omit `outputPath`) to show the content first:

```js
const r = await forge(".");
console.log(r.skill.split("\n").filter((l) => l.startsWith("## ")).join("\n"));
```

## Notes

- If forge() says no supported SDK was found but the repository does use one
  (for example declared only in a subfolder's manifest), call it again with
  `policy` naming it.
- Regenerate when dependencies change: the skill follows the SDKs in the
  manifests and Trustabl's current rules.
- After writing code, check it with the Trustabl Agent Reliability Analyzer
  (`@trustabl/code-execution-agent-reliability-analyzer`).
