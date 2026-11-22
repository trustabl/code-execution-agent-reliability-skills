# code-execution-agent-reliability-skills

Trustabl Forge, by code execution. This plugin gives your coding agent one skill:
it installs the npm package [`@trustabl/code-execution-agent-reliability-skills`](https://www.npmjs.com/package/@trustabl/code-execution-agent-reliability-skills),
writes a short script against it, runs it, and reports only what you asked for.
The full result stays on your machine instead of filling the conversation.

It is a separate plugin from Trustabl's MCP-server plugins and sits alongside them.

## What it does on your machine

- **Installs the npm package** `@trustabl/code-execution-agent-reliability-skills` (no runtime dependencies) when the agent first needs it.
- **Downloads the pinned `trustabl` release (Forge runs `trustabl forge`) from [trustabl/agent-reliability-analyzer](https://github.com/trustabl/agent-reliability-analyzer/releases)** on first use, verifies it against the release `checksums.txt`, and refuses to run a binary that does not match. It is cached under `~/.trustabl-code-execution/`.
- **Rules are fetched** from [trustabl/agent-reliability-rules](https://github.com/trustabl/agent-reliability-rules) when the skill is generated.
- **It writes one file** only when asked, inside your repository, and only replaces a file Forge generated.
- **Everything runs locally.** No account, no API key, no source code upload, and no model in the analysis.

The plugin ships no scripts, hooks or MCP servers: only the skill (Markdown) and a logo.

## Requirements

Node 20 or later, and network access to npmjs.com and github.com for the first install.

## Privacy

The plugin does not collect personal data and sends nothing to Trustabl. The
only network calls are the package install from npm and the release and rules
downloads from GitHub described above. See the
[privacy policy](https://trustabl.ai/privacy) · privacy@trustabl.ai

## License

Apache-2.0
