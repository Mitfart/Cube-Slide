# Context

## Glossary

- **Grid** — unit-spaced coordinate system where every gameplay object lands on integer cell coordinates.
- **Cell** — one square of the grid.
- **Level Floor** — paintable/playable cell spawned from `Level_Floor` prefab.
- **Level Wall** — blocking boundary or obstacle cell spawned from `Level_Wall` prefab.
- **Level Lock** — visual blocking cell spawned from `Level_Lock` prefab at the tunnel entrance; future rule: this tile will be removed/unlocked.
- **Level** — a rectangular arrangement of cells built from floor, wall, and lock prefabs.
- **Tunnel** — generated corridor from the top-center wall of the current level and extending upward; length is defined by the source level.
- **Wall Shadow** — spawned only where an offset wall shadow overlaps non-wall tiles, so shadows stick out onto floor/lock tiles only.
- **Game Manager** — composition root that builds selected levels, spawns player/enemies, owns win/fail flow, coin collection hooks, camera follow/zoom, and UI progress.
- **Enemy Shape** — static `number[][]` mask in `EnemyShapes.ts`; enemy visuals are instantiated from one serialized prefab per occupied cell.
- **Player Controller** — swipe-driven grid mover on the player prefab. Runtime-injected grid ref is hidden from inspector. A swipe slides smoothly until blocked; mid-slide swipe finishes the current cell using a small snap-back threshold, then starts the new direction.

## Working implementation notes

- `GridController` builds levels on X/Z plane, with Y fixed at `0`.
- `LevelConfig.rows[0]` is the top row. Tunnel is generated above that row, centered on the top wall opening, and extends upward.
- `GameManager` builds `LEVELS` in one grid. Any next level is attached to the previous level through the tunnel; only the center bottom wall cell is opened.
- Walls are merged into straight runs after all connected levels are tiled. Shadows are clipped per floor/lock tile overlap, so a later level wall shadow can fall onto an earlier tunnel floor.
- `GridController.getLevelCenter(level)` returns the standalone main level center without tunnel. `getBuiltLevelCenter(index)` returns placed connected-level centers.
- Camera keeps scene rotation/Y height. During tunnel travel, camera position, Z offset, and ortho zoom ease between neighboring level configs; outside tunnels it stays on the nearest level center.
- Player prefab must have `PlayerController` directly. `GameManager` only injects `GridController`; it does not add gameplay components at runtime. Swipes choose grid directions; movement tween goes to the final wall-stop target for smooth sliding. Mid-slide direction changes finish the current cell first, with snap-back before 25% cell progress.
- Grid/touch logic has one source of truth: convert only local X/Z positions through `GridController`, keep keys as `"x,z"` strings, and use `GridController.getTouchedCells()` for player/enemy overlap. Recent bugs came from mixing raw cells, parsed keys, local positions, and enemy offsets in separate code paths.
- Removed stale gameplay data: `TileType`, `EMPTY_LEVEL`, unused enemy color table, unused `PrefabBurst`, and unused UI confetti code. Current tile state is held in `GridController` sets/maps.
