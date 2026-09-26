# Project skills

Skills vendored into this repo so they are available in every Claude Code session
(local and cloud) working on Aitu Dating. Copied as-is from upstream; Codex-only
`agents/` folders and upstream test folders were dropped.

| Skill | Source (commit) | License |
|---|---|---|
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill (`823b0a1`) | MIT |
| `animate-expo`, `emil-design-eng`, `review-animations`, `find-animation-opportunities`, `improve-animations` | emilkowalski/skills (`d16ebe6`) | MIT |
| `playwright-cli`, `playwright-trace` | microsoft/playwright, `packages/playwright-core/src/tools/skills` (`b9a34ac`) | Apache-2.0 |
| `grill-with-docs`, `grilling`, `grill-me`, `domain-modeling`, `setup-matt-pocock-skills`, `to-spec`, `to-tickets`, `to-questionnaire`, `implement`, `tdd`, `diagnosing-bugs`, `codebase-design`, `improve-codebase-architecture`, `prototype`, `research`, `resolving-merge-conflicts`, `wayfinder`, `handoff`, `ask-matt`, `writing-for-agents` | mattpocock/skills (`c55ee46`) | MIT |
| `mobile-principles` | AThevon/genjutsu, `skills/_jutsu/mobile-principles` (`e92bb1b`); `VERSIONS.md` copied into the skill folder | MIT |

Local changes:

- `mattpocock/skills` `code-review` is not vendored: it would shadow Claude Code's
  built-in `/code-review`. `implement` and `tdd` fall back to the built-in one.
- `mobile-principles/SKILL.md`: path to `VERSIONS.md` adjusted to the skill folder.

To update a skill, re-copy its folder from upstream and bump the commit here.
