# Aitu Dating

## Agent skills

### Issue tracker

Specs and tickets live in GitHub Issues of kuanyshs/aitu_dating. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Working agreement

Work autonomously and do not ask the user for confirmation:

- Make product and design decisions yourself, taking the option you would recommend; record them in the spec and report them afterwards instead of asking.
- Publish specs and tickets, implement, commit, push, check CI and close tickets without waiting for «да, публикуй» or «переходи к следующему тикету».
- Ask only when the user's documents directly contradict each other and the choice changes what gets built, or before an action that cannot be undone (deleting data, rewriting history).
