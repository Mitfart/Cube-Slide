# DOX framework

- DOX is the AGENTS.md hierarchy for this repo.
- AGENTS.md files are binding work contracts for their subtrees.
- Before editing, read this file, then every child AGENTS.md on the path to the target.
- After meaningful changes, update the nearest AGENTS.md if purpose, structure, workflow, rules, or durable behavior changed.
- Keep docs concise and operational; delete stale rules instead of explaining history.

## Project

Cocos Creator 3.8.8 grid-fill game prototype. Player will swipe a square on a unit grid and paint/claim the level field.

## Global work rules

- Default communication: `skill://caveman` unless user asks otherwise.
- Use Cocos Creator TypeScript style: `_decorator`, `@ccclass`, `@property`, one component per file, class name matches filename.
- Prefer serialized editor references. Never use `find()` or scene-wide string path lookup.
- Required serialized refs must log `console.error('[ComponentName] Missing fieldName')` and return/disable safely.
- Editor-owned data (`.scene`, `.prefab`, `.meta`, materials, animations) changes go through CodeMode/Cocos editor, not raw file edits.
- Source/config/docs may be edited directly.
- No speculative interfaces/factories/config layers.

## Verification

- For TypeScript changes, keep imports/types Cocos 3.8 compatible.
- After editor wiring, reload/update Cocos and check console.

## Child DOX Index

- `assets/Code/AGENTS.md` — game scripts and domain components.
- `assets/Cocos_Engine/AGENTS.md` — reusable imported engine/tutorial tooling.
