# Game Code

## Purpose

Gameplay and game-specific infrastructure scripts for the grid-fill prototype.

## Structure

- `Infrastructure/` — game composition/controller scripts (`GameManager`, builders, shared services).
- `Grid/` — grid and level construction logic.
- `UI/` — UI-only scripts; call public gameplay/controller methods, do not mutate internals.
- `Gameplay/` — static level/enemy shape data only; runtime behavior lives in feature folders.

## Rules

- Serialized refs over runtime lookup; no `find()`.
- Grid size is one unit by default. Final gameplay positions must be integer grid coordinates multiplied by cell size.
- Expose small public methods so tutorial/external scripts can drive game flow.
- Keep gameplay state inside feature components; `Infrastructure` coordinates only.
- Delete unused data/scripts instead of keeping compatibility shells.
