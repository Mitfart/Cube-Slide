import { _decorator, Color, Component, instantiate, MeshRenderer, Node, Prefab, Vec2, Vec3, tween } from 'cc';
import { LevelConfig } from '../Gameplay/Levels';
import { SoundManager } from './Services/SoundManager';
const { ccclass, property } = _decorator;

interface LevelBounds {
    offsetX: number;
    offsetZ: number;
    centerX: number;
    centerZ: number;
    bottomZ: number;
}

@ccclass('GridController')
export class GridController extends Component {
    @property(Prefab)
    public levelFloor: Prefab | null = null;

    @property(Prefab)
    public levelWall: Prefab | null = null;

    @property(Prefab)
    public levelWallShadow: Prefab | null = null;

    @property(Vec2)
    public wallShadowOffset = new Vec2(0, 0);

    @property(Prefab)
    public levelLock: Prefab | null = null;

    @property(Prefab)
    public coinPrefab: Prefab | null = null;

    @property({ type: SoundManager, visible: false })
    public soundManager: SoundManager | null = null;

    private readonly cellSize = 1;
    private readonly spawned: Node[] = [];
    private readonly walkableTiles = new Set<string>();
    private readonly fillableTiles = new Set<string>();
    private readonly filledTiles = new Set<string>();
    private readonly trailNodes = new Map<string, Node>();
    private readonly fillNodes = new Map<string, Node>();
    private readonly coinNodes = new Map<string, Node>();
    private readonly levelLockNodes: (Node | null)[] = [];
    private readonly levelFillableTiles: Set<string>[] = [];
    private readonly levelProgressIgnoredTiles: Set<string>[] = [];
    private readonly levelBoundaryTiles: Set<string>[] = [];
    private readonly levelTiles: Set<string>[] = [];
    private readonly levelExitZ: number[] = [];
    private readonly levelCenters: Vec3[] = [];
    private readonly levelSpawns: Vec3[] = [];
    private readonly cameraTransitionZ: Vec2[] = [];
    public onCoinCollected: ((coin: Node) => void) | null = null;
    private fillSoundActive = false;
    private fillSoundTicket = 0;

    public buildLevels(levels: LevelConfig[]): void {
        if (!levels.every(level => this.validatePrefabs(level))) {
            return;
        }

        this.clearLevel();

        const tiles = new Map<string, string>();
        let nextBottomZ = 0;
        let previousTunnelStartZ = 0;
        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            const base = this.getLevelBounds(level.rows, level.tunnelLength);
            const zOffset = i === 0 ? 0 : nextBottomZ - base.bottomZ;
            const fillable = new Set<string>();
            const boundary = new Set<string>();
            const levelTiles = new Set<string>();
            const bounds = this.addRows(tiles, level.rows, level.tunnelLength, zOffset, i > 0, fillable, boundary, levelTiles);
            this.spawnCoins(level, zOffset);
            this.levelFillableTiles.push(fillable);
            this.levelProgressIgnoredTiles.push(new Set<string>());
            this.levelBoundaryTiles.push(boundary);
            this.levelTiles.push(levelTiles);
            this.levelExitZ.push(bounds.tunnelMinZ - 2);
            this.levelLockNodes.push(this.spawnTunnelLock(base.centerX, bounds.tunnelStartZ));
            this.levelCenters.push(this.gridToLocal(base.centerX, base.centerZ + zOffset));
            this.levelSpawns.push(this.getLevelSpawn(level.rows, level.tunnelLength, zOffset) ?? this.gridToLocal(base.centerX, base.bottomZ + zOffset - 1));
            if (i > 0) {
                this.cameraTransitionZ.push(new Vec2(previousTunnelStartZ, base.bottomZ + zOffset));
            }
            previousTunnelStartZ = bounds.tunnelStartZ;
            nextBottomZ = bounds.tunnelMinZ - 1;
        }

        this.spawnMergedWalls(tiles);
        for (const [key, symbol] of tiles) {
            if (symbol !== '#') {
                const [x, z] = this.parseTile(key);
                this.walkableTiles.add(key);
                this.spawnTile(symbol, x, z);
            }
        }
    }

    public getLevelCenter(level: LevelConfig): Vec3 {
        const bounds = this.getLevelBounds(level.rows, level.tunnelLength);
        return this.gridToLocal(bounds.centerX, bounds.centerZ);
    }

    public getBuiltLevelCenter(index: number): Vec3 | null {
        return this.levelCenters[index] ?? null;
    }

    public getBuiltLevelSpawn(index: number): Vec3 | null {
        return this.levelSpawns[index] ?? null;
    }

    public getBuiltLevelCount(): number {
        return this.levelCenters.length;
    }

    public getLevelProgress(levelIndex: number): number {
        const tiles = this.levelFillableTiles[levelIndex];
        if (!tiles || tiles.size === 0) {
            return 0;
        }

        const ignored = this.levelProgressIgnoredTiles[levelIndex] ?? new Set<string>();
        const total = tiles.size - ignored.size;
        if (total <= 0) {
            return 0;
        }

        let filled = 0;
        for (const key of tiles) {
            if (ignored.has(key)) continue;
            if (this.filledTiles.has(key) || this.fillNodes.has(key) || this.trailNodes.has(key)) {
                filled++;
            }
        }
        return Math.max(0, Math.min(1, filled / total));
    }

    public getNearestBuiltLevelIndex(z: number): number {
        let bestIndex = 0;
        let bestDistance = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < this.levelCenters.length; i++) {
            const distance = Math.abs(z - this.levelCenters[i].z);
            if (distance >= bestDistance) continue;
            bestDistance = distance;
            bestIndex = i;
        }
        return bestIndex;
    }

    public getLevelTransitionT(index: number, z: number): number | null {
        const transition = this.cameraTransitionZ[index];
        if (!transition) return null;
        const min = Math.min(transition.x, transition.y);
        const max = Math.max(transition.x, transition.y);
        if (z < min || z > max) return null;
        const t = Math.max(0, Math.min(1, (z - transition.x) / (transition.y - transition.x)));
        return t * t * (3 - 2 * t);
    }

    public clearLevel(): void {
        for (const tile of this.spawned) {
            if (tile.isValid) {
                tile.destroy();
            }
        }
        this.spawned.length = 0;
        this.walkableTiles.clear();
        this.fillableTiles.clear();
        this.filledTiles.clear();
        this.trailNodes.clear();
        this.fillNodes.clear();
        this.coinNodes.clear();
        this.levelLockNodes.length = 0;
        this.levelFillableTiles.length = 0;
        this.levelProgressIgnoredTiles.length = 0;
        this.levelBoundaryTiles.length = 0;
        this.levelTiles.length = 0;
        this.levelExitZ.length = 0;
        this.levelCenters.length = 0;
        this.levelSpawns.length = 0;
        this.cameraTransitionZ.length = 0;
    }

    public setSoundManager(soundManager: SoundManager | null): void {
        this.soundManager = soundManager;
    }

    public gridToLocal(x: number, z: number): Vec3 {
        return new Vec3(x * this.cellSize, 0, z * this.cellSize);
    }

    public localToGrid(position: Vec3): Vec2 {
        return new Vec2(Math.round(position.x / this.cellSize), Math.round(position.z / this.cellSize));
    }

    public worldToGrid(position: Vec3): Vec2 {
        const local = new Vec3();
        this.node.inverseTransformPoint(local, position);
        return this.localToGrid(local);
    }

    public getTouchedCells(local: Vec3): Vec2[] {
        const center = this.localToGrid(local);
        const cells = [center];
        const dx = local.x - center.x;
        const dz = local.z - center.y;
        const threshold = 0.2;
        if (dx > threshold) cells.push(new Vec2(center.x + 1, center.y));
        if (dx < -threshold) cells.push(new Vec2(center.x - 1, center.y));
        if (dz > threshold) cells.push(new Vec2(center.x, center.y + 1));
        if (dz < -threshold) cells.push(new Vec2(center.x, center.y - 1));
        return cells;
    }

    public isWalkableGrid(x: number, z: number): boolean {
        const key = this.key(x, z);
        return this.walkableTiles.has(key) && this.fillableTiles.has(key) && !this.filledTiles.has(key) && !this.fillNodes.has(key);
    }

    public isFilledGrid(x: number, z: number): boolean {
        const key = this.key(x, z);
        return this.filledTiles.has(key) || this.fillNodes.has(key);
    }

    public isEmptyFloorGrid(x: number, z: number): boolean {
        const key = this.key(x, z);
        return this.fillableTiles.has(key) && !this.filledTiles.has(key) && !this.fillNodes.has(key) && !this.trailNodes.has(key);
    }

    public hasTrailGrid(x: number, z: number): boolean {
        return this.trailNodes.has(this.key(x, z));
    }

    public getBuiltLevelTopCell(levelIndex: number, x: number, cellsFromTop: number): Vec2 | null {
        const tiles = this.levelFillableTiles[levelIndex];
        if (!tiles) {
            return null;
        }

        const bounds = this.getKeyBounds(tiles);
        return new Vec2(x, bounds.minZ + cellsFromTop);
    }

    public isBlockingGrid(x: number, z: number): boolean {
        return !this.isWalkableGrid(x, z);
    }

    public getSlideTarget(start: Vec2, direction: Vec2): Vec3 {
        let x = start.x;
        let z = start.y;
        const startFilled = this.isFilledGrid(x, z);
        let movedThroughEmpty = !startFilled;
        while (true) {
            const nextX = x + direction.x;
            const nextZ = z + direction.y;
            if (this.isFilledGrid(nextX, nextZ)) {
                if (movedThroughEmpty) {
                    return this.gridToLocal(nextX, nextZ);
                }
                x = nextX;
                z = nextZ;
                continue;
            }
            if (this.isBlockingGrid(nextX, nextZ)) {
                return this.gridToLocal(x, z);
            }
            movedThroughEmpty = this.isEmptyFloorGrid(nextX, nextZ);
            x = nextX;
            z = nextZ;
        }
    }

    public collectCoinAt(x: number, z: number): void {
        const coin = this.takeCoin(this.key(x, z));
        if (coin) {
            this.soundManager.playCoin(coin.worldPosition);
            this.onCoinCollected?.(coin);
        }
    }

    public fillCell(x: number, z: number, fillPrefab: Prefab, color?: Color): void {
        const levelIndex = this.getLevelIndex(new Vec2(x, z));
        if (levelIndex >= 0) {
            this.levelProgressIgnoredTiles[levelIndex].add(this.key(x, z));
        }
        this.setFilled(x, z, fillPrefab, true, 0, true, color);
    }

    public getCompleteLevelExit(playerCell: Vec2): Vec3 | null {
        const levelIndex = this.getCompletedLevelIndex(playerCell);
        if (levelIndex < 0) {
            return null;
        }

        const center = this.levelCenters[levelIndex];
        this.openTunnelLock(levelIndex);
        return new Vec3(center.x, 0, this.levelExitZ[levelIndex]);
    }

    public isLastLevelCell(cell: Vec2): boolean {
        const levelIndex = this.getCompletedLevelIndex(cell);
        return levelIndex >= 0 && levelIndex === this.levelFillableTiles.length - 1;
    }

    public isLevelCompleteOrFilling(cell: Vec2): boolean {
        const levelIndex = this.getLevelIndex(cell);
        if (levelIndex < 0) {
            return false;
        }

        for (const key of this.levelFillableTiles[levelIndex]) {
            if (!this.filledTiles.has(key) && !this.fillNodes.has(key)) {
                return false;
            }
        }
        return true;
    }

    public placeTrail(x: number, z: number, prefab: Prefab, color?: Color): Node | null {
        const key = this.key(x, z);
        if (!this.isEmptyFloorGrid(x, z)) {
            return null;
        }

        const trail = this.spawnPrefab(prefab, x, z);
        if (color) this.applyMaterialColor(trail, color);
        this.soundManager.playCellTrail(trail.worldPosition);
        this.playTrailSpawn(trail);
        this.trailNodes.set(key, trail);
        return trail;
    }

    public commitTrailToFill(playerCell: Vec2, fillPrefab: Prefab, color?: Color): void {
        const trailKeys = Array.from(this.trailNodes.keys());
        if (trailKeys.length > 0) {
            this.playFillSounds(playerCell, trailKeys.length * 0.015 + 0.16);
        }
        for (let i = 0; i < trailKeys.length; i++) {
            const [x, z] = this.parseTile(trailKeys[i]);
            this.setFilled(x, z, fillPrefab, true, i * 0.015, false, color);
        }
        this.trailNodes.clear();
        this.fillClosedAreas(playerCell, fillPrefab, color);
    }

    public clearPaintForLevel(cell: Vec2, keepFilledCell: Vec2 | null = null): void {
        const levelIndex = this.getLevelIndex(cell);
        if (levelIndex < 0) {
            return;
        }

        const keepKey = keepFilledCell ? this.key(keepFilledCell.x, keepFilledCell.y) : '';
        for (const key of this.levelFillableTiles[levelIndex]) {
            if (key === keepKey) {
                this.filledTiles.add(key);
                continue;
            }
            const trail = this.trailNodes.get(key);
            if (trail) {
                trail.destroy();
                this.trailNodes.delete(key);
            }
            const fill = this.fillNodes.get(key);
            if (fill) {
                fill.destroy();
                this.fillNodes.delete(key);
            }
            this.filledTiles.delete(key);
        }
    }

    public fillRemainingLevel(cell: Vec2, fillPrefab: Prefab, color?: Color): void {
        const levelIndex = this.getLevelIndex(cell);
        if (levelIndex < 0) {
            return;
        }

        const keys: string[] = [];
        for (const key of this.levelFillableTiles[levelIndex]) {
            if (!this.filledTiles.has(key) && !this.fillNodes.has(key)) {
                keys.push(key);
            }
        }
        const delays = this.getFillDelays(keys, cell);
        if (keys.length > 0) {
            this.playFillSounds(cell, this.getMaxFillDelay(keys, delays) + 0.16);
        }
        for (const key of keys) {
            const [x, z] = this.parseTile(key);
            this.setFilled(x, z, fillPrefab, true, (delays.get(key) ?? 0) * 0.04, false, color);
        }
    }

    private addRows(tiles: Map<string, string>, rows: string[], tunnelLength: number, zOffset: number, openBottom: boolean, fillable: Set<string>, boundary: Set<string>, levelTiles: Set<string>): { tunnelMinZ: number; tunnelStartZ: number } {
        const bounds = this.getLevelBounds(rows, tunnelLength);
        const offsetX = bounds.offsetX;
        const offsetZ = bounds.offsetZ + zOffset;

        for (let y = 0; y < rows.length; y++) {
            const row = rows[y];
            for (let x = 0; x < row.length; x++) {
                const symbol = this.getTileSymbol(rows, x, y, openBottom);
                const key = this.key(offsetX + x, offsetZ + y);
                tiles.set(key, symbol);
                levelTiles.add(key);
                if (row[x] === '#' && y !== 0) {
                    boundary.add(key);
                }
                if (symbol !== '#' && row[x] !== '#') {
                    this.fillableTiles.add(key);
                    fillable.add(key);
                }
            }
        }

        const centerX = bounds.centerX;
        for (let z = offsetZ - tunnelLength; z < offsetZ; z++) {
            tiles.set(this.key(centerX - 1, z), '#');
            tiles.set(this.key(centerX, z), '.');
            tiles.set(this.key(centerX + 1, z), '#');
        }

        return { tunnelMinZ: offsetZ - tunnelLength, tunnelStartZ: offsetZ };
    }

    private collectCoinKey(key: string): void {
        const coin = this.takeCoin(key);
        if (coin) {
            this.onCoinCollected?.(coin);
        }
    }

    private takeCoin(key: string): Node | null {
        const coin = this.coinNodes.get(key);
        if (!coin) {
            return null;
        }

        this.coinNodes.delete(key);
        return coin;
    }

    private spawnTunnelLock(x: number, z: number): Node | null {
        if (!this.levelLock) {
            return null;
        }

        return this.spawnPrefab(this.levelLock, x, z);
    }

    private openTunnelLock(levelIndex: number): void {
        const lock = this.levelLockNodes[levelIndex];
        if (!lock) {
            return;
        }

        this.levelLockNodes[levelIndex] = null;
        tween(lock)
            .to(0.18, { scale: new Vec3(0, 0, 0) }, { easing: 'backIn' })
            .call(() => lock.destroy())
            .start();
    }

    private spawnMergedWalls(tiles: Map<string, string>): void {
        const walls = new Set([...tiles].filter(([, symbol]) => symbol === '#').map(([key]) => key));

        for (const key of [...walls]) {
            if (!walls.has(key)) continue;

            const [x, z] = this.parseTile(key);
            if (walls.has(this.key(x, z - 1))) continue;

            const depth = this.countRun(walls, x, z, 0, 1);
            if (depth <= 1) continue;

            this.spawnWallRun(x, z, 1, depth, tiles);
            this.deleteRun(walls, x, z, 0, 1, depth);
        }

        for (const key of [...walls]) {
            if (!walls.has(key)) continue;

            const [x, z] = this.parseTile(key);
            if (walls.has(this.key(x - 1, z))) continue;

            const width = this.countRun(walls, x, z, 1, 0);
            this.spawnWallRun(x, z, width, 1, tiles);
            this.deleteRun(walls, x, z, 1, 0, width);
        }
    }

    private countRun(walls: Set<string>, x: number, z: number, stepX: number, stepZ: number): number {
        let length = 1;
        while (walls.has(this.key(x + stepX * length, z + stepZ * length))) {
            length++;
        }
        return length;
    }

    private deleteRun(walls: Set<string>, x: number, z: number, stepX: number, stepZ: number, length: number): void {
        for (let i = 0; i < length; i++) {
            walls.delete(this.key(x + stepX * i, z + stepZ * i));
        }
    }

    private spawnWallRun(x: number, z: number, width: number, depth: number, tiles: Map<string, string>): void {
        const centerX = x + (width - 1) / 2;
        const centerZ = z + (depth - 1) / 2;
        this.spawnScaled(this.levelWall, centerX, centerZ, width, depth);
        this.spawnShadow(centerX, centerZ, width, depth, tiles);
    }

    private spawnTile(symbol: string, x: number, z: number): void {
        this.spawnScaled(this.getPrefab(symbol), x, z, 1, 1);
    }

    private spawnShadow(x: number, z: number, width: number, depth: number, tiles: Map<string, string>): void {
        const shadowMinX = x + this.wallShadowOffset.x - width / 2;
        const shadowMaxX = x + this.wallShadowOffset.x + width / 2;
        const shadowMinZ = z + this.wallShadowOffset.y - depth / 2;
        const shadowMaxZ = z + this.wallShadowOffset.y + depth / 2;

        for (const [key, symbol] of tiles) {
            if (symbol === '#') continue;

            const [tileX, tileZ] = this.parseTile(key);
            const minX = Math.max(shadowMinX, tileX - 0.5);
            const maxX = Math.min(shadowMaxX, tileX + 0.5);
            const minZ = Math.max(shadowMinZ, tileZ - 0.5);
            const maxZ = Math.min(shadowMaxZ, tileZ + 0.5);
            if (minX >= maxX || minZ >= maxZ) continue;

            this.spawnScaled(this.levelWallShadow, (minX + maxX) / 2, (minZ + maxZ) / 2, maxX - minX, maxZ - minZ);
        }
    }

    private spawnScaled(prefab: Prefab | null, x: number, z: number, width: number, depth: number): void {
        if (!prefab) {
            return;
        }

        const tile = this.spawnPrefab(prefab, x, z);
        tile.setScale(width, 1, depth);
    }

    private spawnPrefab(prefab: Prefab, x: number, z: number): Node {
        const tile = instantiate(prefab);
        tile.setParent(this.node, false);
        tile.setPosition(this.gridToLocal(x, z));
        this.spawned.push(tile);
        return tile;
    }

    private setFilled(x: number, z: number, prefab: Prefab, animate: boolean, delay = 0, force = false, color?: Color): void {
        const key = this.key(x, z);
        if ((!force && !this.fillableTiles.has(key)) || this.fillNodes.has(key)) {
            return;
        }

        const trail = this.trailNodes.get(key);
        if (trail) {
            trail.destroy();
            this.trailNodes.delete(key);
        }

        const fill = this.spawnPrefab(prefab, x, z);
        if (color) this.applyMaterialColor(fill, color);
        this.fillNodes.set(key, fill);
        if (animate) {
            this.playFillSpawn(fill, delay, () => {
                this.filledTiles.add(key);
                this.collectCoinKey(key);
            });
            return;
        }

        this.filledTiles.add(key);
        this.collectCoinKey(key);
    }

    private applyMaterialColor(node: Node, color: Color): void {
        for (const renderer of node.getComponentsInChildren(MeshRenderer)) {
            for (let i = 0; i < Math.max(1, renderer.materials.length); i++) {
                renderer.getMaterialInstance(i)!.setProperty('mainColor', color);
            }
        }
    }

    private playTrailSpawn(node: Node): void {
        node.setScale(0, 0, 0);
        tween(node)
            .to(0.18, { scale: new Vec3(1, 1, 1) }, { easing: 'sineOut' })
            .call(() => {
                tween(node)
                    .repeatForever(
                        tween()
                            .to(0.22, { scale: new Vec3(1.04, 1.04, 1.04) }, { easing: 'sineInOut' })
                            .to(0.22, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
                    )
                    .start();
            })
            .start();
    }

    private playFillSpawn(node: Node, delay: number, onTouchFilled?: () => void): void {
        node.setScale(0, 0, 0);
        tween(node)
            .delay(delay)
            .to(0.06, { scale: new Vec3(1.2, 1.2, 1.2) }, { easing: 'backOut' })
            .call(() => onTouchFilled?.())
            .to(0.05, { scale: new Vec3(0.92, 0.92, 0.92) }, { easing: 'quadInOut' })
            .to(0.04, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
    }

    private playFillSounds(cell: Vec2, duration: number): void {
        const position = this.gridToLocal(cell.x, cell.y);
        Vec3.add(position, position, this.node.worldPosition);
        if (!this.fillSoundActive) {
            this.fillSoundActive = true;
            this.soundManager.playCellsFillStart(position);
        }

        const ticket = ++this.fillSoundTicket;
        this.scheduleOnce(() => {
            if (ticket !== this.fillSoundTicket) {
                return;
            }
            this.fillSoundActive = false;
        }, duration);
    }

    private getMaxFillDelay(keys: string[], delays: Map<string, number>): number {
        return keys.reduce((max, key) => Math.max(max, delays.get(key) ?? 0), 0) * 0.04;
    }

    private fillClosedAreas(playerCell: Vec2, fillPrefab: Prefab, color?: Color): void {
        const levelIndex = this.getLevelIndex(playerCell);
        if (levelIndex < 0) {
            return;
        }

        const bounds = this.getKeyBounds(this.levelTiles[levelIndex]);
        const fillable = this.levelFillableTiles[levelIndex];
        const blocked = new Set<string>();
        this.addKeys(blocked, this.levelBoundaryTiles[levelIndex]);
        this.addKeys(blocked, this.filledTiles);
        this.addKeys(blocked, this.fillNodes.keys());

        const outside = new Set<string>();
        const queue = [this.key(bounds.minX - 1, bounds.minZ - 1)];
        outside.add(queue[0]);

        const add = (x: number, z: number): void => {
            if (x < bounds.minX - 1 || x > bounds.maxX + 1 || z < bounds.minZ - 1 || z > bounds.maxZ + 1) return;
            const key = this.key(x, z);
            if (outside.has(key) || blocked.has(key)) return;
            outside.add(key);
            queue.push(key);
        };

        for (let i = 0; i < queue.length; i++) {
            const [x, z] = this.parseTile(queue[i]);
            add(x + 1, z);
            add(x - 1, z);
            add(x, z + 1);
            add(x, z - 1);
        }

        const inner: string[] = [];
        for (const key of fillable) {
            if (this.filledTiles.has(key) || this.fillNodes.has(key) || outside.has(key)) {
                continue;
            }
            inner.push(key);
        }

        const delays = this.getFillDelays(inner, playerCell);
        if (inner.length > 0) {
            this.playFillSounds(playerCell, this.getMaxFillDelay(inner, delays) + 0.16);
        }
        for (const key of inner) {
            const [x, z] = this.parseTile(key);
            this.setFilled(x, z, fillPrefab, true, (delays.get(key) ?? 0) * 0.04, false, color);
        }
    }

    private addKeys(target: Set<string>, keys: Iterable<string>): void {
        for (const key of keys) {
            target.add(key);
        }
    }

    private getKeyBounds(keys: Set<string>): { minX: number; maxX: number; minZ: number; maxZ: number } {
        let minX = Number.MAX_SAFE_INTEGER;
        let maxX = Number.MIN_SAFE_INTEGER;
        let minZ = Number.MAX_SAFE_INTEGER;
        let maxZ = Number.MIN_SAFE_INTEGER;
        for (const key of keys) {
            const [x, z] = this.parseTile(key);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }
        return { minX, maxX, minZ, maxZ };
    }

    private getFillDelays(keys: string[], playerCell: Vec2): Map<string, number> {
        const area = new Set<string>(keys);
        const startKey = this.key(playerCell.x, playerCell.y);
        area.add(startKey);

        const delays = new Map<string, number>([[startKey, 0]]);
        const queue = [startKey];
        for (let i = 0; i < queue.length; i++) {
            const [x, z] = this.parseTile(queue[i]);
            const nextDelay = (delays.get(queue[i]) ?? 0) + 1;
            for (const next of [this.key(x + 1, z), this.key(x - 1, z), this.key(x, z + 1), this.key(x, z - 1)]) {
                if (!area.has(next) || delays.has(next)) continue;
                delays.set(next, nextDelay);
                queue.push(next);
            }
        }

        for (const key of keys) {
            if (delays.has(key)) continue;
            const [x, z] = this.parseTile(key);
            delays.set(key, Math.abs(x - playerCell.x) + Math.abs(z - playerCell.y));
        }
        return delays;
    }

    private getCompletedLevelIndex(cell: Vec2): number {
        const levelIndex = this.getLevelIndex(cell);
        if (levelIndex < 0) {
            return -1;
        }
        for (const key of this.levelFillableTiles[levelIndex]) {
            if (!this.filledTiles.has(key)) {
                return -1;
            }
        }
        return levelIndex;
    }

    private getLevelIndex(cell: Vec2): number {
        const key = this.key(cell.x, cell.y);
        for (let i = 0; i < this.levelFillableTiles.length; i++) {
            if (this.levelFillableTiles[i].has(key)) {
                return i;
            }
        }
        for (let i = 0; i < this.levelFillableTiles.length; i++) {
            if (this.levelFillableTiles[i].has(this.key(cell.x + 1, cell.y)) || this.levelFillableTiles[i].has(this.key(cell.x - 1, cell.y)) || this.levelFillableTiles[i].has(this.key(cell.x, cell.y + 1)) || this.levelFillableTiles[i].has(this.key(cell.x, cell.y - 1))) {
                return i;
            }
        }
        return -1;
    }

    private getTileSymbol(rows: string[], x: number, y: number, openBottom: boolean): string {
        const row = rows[y];
        const isCenterWall = x === Math.floor(row.length / 2) && row[x] === '#';
        const isTopOpening = y === 0 && isCenterWall;
        const isBottomOpening = openBottom && y === rows.length - 1 && isCenterWall;
        return isTopOpening || isBottomOpening ? '.' : row[x];
    }

    private getPrefab(symbol: string): Prefab | null {
        if (symbol === '.' || symbol === 'C' || symbol === 'p') return this.levelFloor;
        if (symbol === 'L') return this.levelLock;
        return null;
    }

    private getLevelSpawn(rows: string[], tunnelLength: number, zOffset: number): Vec3 | null {
        const bounds = this.getLevelBounds(rows, tunnelLength);
        for (let y = 0; y < rows.length; y++) {
            const x = rows[y].indexOf('p');
            if (x >= 0) return this.gridToLocal(bounds.offsetX + x, bounds.offsetZ + zOffset + y);
        }
        return null;
    }

    private spawnCoins(level: LevelConfig, zOffset: number): void {
        if (!this.coinPrefab) {
            return;
        }

        const bounds = this.getLevelBounds(level.rows, level.tunnelLength);
        const offsetX = bounds.offsetX;
        const offsetZ = bounds.offsetZ + zOffset;

        for (let y = 0; y < level.rows.length; y++) {
            const row = level.rows[y];
            for (let x = 0; x < row.length; x++) {
                if (row[x] === 'C') {
                    const gridX = offsetX + x;
                    const gridZ = offsetZ + y;
                    this.coinNodes.set(this.key(gridX, gridZ), this.spawnPrefab(this.coinPrefab, gridX, gridZ));
                }
            }
        }
    }

    private getLevelBounds(rows: string[], tunnelLength: number): LevelBounds {
        const width = this.getWidth(rows);
        const depth = rows.length + tunnelLength;
        const offsetX = -Math.floor(width / 2);
        const offsetZ = -Math.floor(depth / 2);
        return {
            offsetX,
            offsetZ,
            centerX: offsetX + Math.floor(width / 2),
            centerZ: offsetZ + (rows.length - 1) / 2,
            bottomZ: offsetZ + rows.length - 1,
        };
    }

    private getWidth(rows: string[]): number {
        return rows.reduce((width, row) => Math.max(width, row.length), 0);
    }

    private key(x: number, z: number): string {
        return `${x},${z}`;
    }

    private parseTile(key: string): [number, number] {
        const [x, z] = key.split(',').map(Number);
        return [x, z];
    }

    private validatePrefabs(level: LevelConfig): boolean {
        if (!this.levelFloor) {
            console.error('[GridController] Missing levelFloor');
            return false;
        }
        if (!this.levelWall) {
            console.error('[GridController] Missing levelWall');
            return false;
        }
        if (!this.levelWallShadow) {
            console.error('[GridController] Missing levelWallShadow');
            return false;
        }
        if (!this.levelLock) {
            console.error('[GridController] Missing levelLock');
            return false;
        }
        if (!this.coinPrefab && level.rows.some(row => row.includes('C'))) {
            console.error('[GridController] Missing coinPrefab');
            return false;
        }
        return true;
    }

}
