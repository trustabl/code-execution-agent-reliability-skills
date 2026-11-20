# Code execution for Trustabl Forge

[Trustabl Forge](https://github.com/trustabl/agent-reliability-skills) as plain
functions, for agents that write and run code in a sandbox.

Forge builds a pre-coding reliability skill (`SKILL.md`) for a repository: it
reads the dependency manifests, finds the agent SDKs in use, and writes
Trustabl's rules for exactly those SDKs, so they are applied while code is
written. The skill is tens of kilobytes. With this package an agent writes it
to disk from a script and tells the model only what it needs.

```js
import { forge, SKILL_DESTINATION } from "@trustabl/code-execution-agent-reliability-skills";

const r = await forge(".", { outputPath: SKILL_DESTINATION });
console.log(`Skill for ${r.sdks.join(", ")} written to ${r.written}`);
```

On the fixture in `test/fixture`, the generated skill is 34,693 characters;
the script above prints about 150.

This package sits alongside Forge's MCP server and plugins. It does not replace
any of them.

## Install

```bash
npm install @trustabl/code-execution-agent-reliability-skills
```

Node 20 or later. On first use the package downloads the pinned `trustabl`
release (Forge runs `trustabl forge`) from GitHub Releases, checks it against
the release's `checksums.txt`, and caches it in
`~/.trustabl-code-execution/analyzer/`, the same cache the analyzer's
code-execution package uses. A binary that does not match is never run.

| Variable | Effect |
| --- | --- |
| `TRUSTABL_BIN` | Use this `trustabl` binary instead of downloading one. |
| `TRUSTABL_VERSION` | Download this release tag instead of the pinned one (0.1.14 or later). |
| `GITHUB_TOKEN` | Authenticate the download, to avoid GitHub's anonymous rate limit. |

## API

- `forge(target, options?)`: generate the skill for a repository directory.
  Options: `outputPath` (write it there, inside the repository; an existing
  file is replaced only if Forge generated it), `policy` (SDK categories to
  add), `lang` (languages to add). Resolves to `skill`, `sdks`, `stamp`,
  `written` and `note`.
- `parseStamp(content)`: the Forge stamp in a `SKILL.md`, or `null` when Forge
  did not generate it.
- `SKILL_DESTINATION`: `.claude/skills/trustabl-pre-coding/SKILL.md`.
- `version()`: the analyzer's version.

Types ship in `index.d.ts`.

## Skill

`skills/code-execution-agent-reliability-skills/SKILL.md` teaches an agent this
workflow. Copy it into your agent's skills folder.

## Sandbox

The `Dockerfile` builds a reference sandbox with Node, this package and a
verified binary:

```bash
docker build -t code-execution-agent-reliability-skills .
docker run --rm -v "$PWD:/workspace" code-execution-agent-reliability-skills node script.mjs
```

## License

Apache-2.0
