# Game Code

## Purpose

Gameplay and game-specific infrastructure scripts for the grid-fill prototype.

## Structure

- `Infrastructure/` — composition and shared services: `GameManager`, `GridController`, `Analytics`, `SoundManager`, toon material color helpers.
- `Player/` — swipe input, grid sliding, trail/fill painting, lives, and tunnel-complete movement.
- `Enemy/` — moving enemy shape behavior, collision occupancy, destruction visuals/sounds.
- `Gameplay/` — static level configs, enemy masks, and per-level color data.
- `UI/` — UI-only scripts; call public gameplay/controller methods, do not mutate internals.

## Rules

- Serialized refs over runtime lookup; no `find()`.
- Grid size is one unit by default. Final gameplay positions must be integer grid coordinates multiplied by cell size.
- `GridController` is the only source of truth for grid/local conversion, touched cells, tile keys, fill state, coins, locks, and level progress.
- `GameManager` composes flow only: build/clear levels, spawn player/enemies, wire UI/sound/analytics, win/fail, camera.
- Runtime behavior lives in feature folders (`Player`, `Enemy`, `Infrastructure`); `Gameplay` stays data-only.
- Delete unused data/scripts instead of keeping compatibility shells.
