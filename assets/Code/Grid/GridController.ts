import { _decorator, Component, instantiate, Node, Prefab, Vec2, Vec3, tween } from 'cc';
import { LevelConfig, LEVELS } from '../Gameplay/Levels';
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

    private readonly cellSize = 1;
    private readonly spawned: Node[] = [];
    private readonly walkableTiles = new Set<string>();
    private readonly fillableTiles = new Set<string>();
    private readonly filledTiles = new Set<string>();
    private readonly trailNodes = new Map<string, Node>();
    private readonly fillNodes = new Map<string, Node>();
    private readonly levelLockNodes: (Node | null)[] = [];
    private readonly levelFillableTiles: Set<string>[] = [];
    private readonly levelBoundaryTiles: Set<string>[] = [];
    private readonly levelTiles: Set<string>[] = [];
    private readonly levelExitZ: number[] = [];
    private readonly levelCenters: Vec3[] = [];
    private readonly levelSpawns: Vec3[] = [];
    private readonly cameraTransitionZ: Vec2[] = [];

    public buildDefaultLevel(): void {
        this.buildLevels([LEVELS[0], LEVELS[1]]);
    }

    public buildLevel(level: LevelConfig): void {
        this.buildLevels([level]);
    }

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
            this.levelFillableTiles.push(fillable);
            this.levelBoundaryTiles.push(boundary);
            this.levelTiles.push(levelTiles);
            this.levelExitZ.push(bounds.tunnelMinZ - 2);
            this.levelLockNodes.push(this.spawnTunnelLock(base.centerX, bounds.tunnelStartZ));
            this.levelCenters.push(this.gridToLocal(base.centerX, base.centerZ + zOffset));
            this.levelSpawns.push(this.gridToLocal(base.centerX, base.bottomZ + zOffset - 1));
            if (i > 0) {
                this.cameraTransitionZ.push(new Vec2(previousTunnelStartZ, base.bottomZ + zOffset));
            }
            previousTunnelStartZ = bounds.tunnelStartZ;
            nextBottomZ = bounds.tunnelMinZ - 1;
        }

        this.spawnMergedWalls(tiles);
        for (const [key, symbol] of tiles) {
            if (symbol !== '#') {
                const [x, z] = this.parseKey(key);
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

    public getCameraTransitionZ(index: number): Vec2 | null {
        return this.cameraTransitionZ[index] ?? null;
    }

    public clearLevel(): void {
        for (const tile of this.spawned) {
            tile.destroy();
        }
        this.spawned.length = 0;
        this.walkableTiles.clear();
        this.fillableTiles.clear();
        this.filledTiles.clear();
        this.trailNodes.clear();
        this.fillNodes.clear();
        this.levelLockNodes.length = 0;
        this.levelFillableTiles.length = 0;
        this.levelBoundaryTiles.length = 0;
        this.levelTiles.length = 0;
        this.levelExitZ.length = 0;
        this.levelCenters.length = 0;
        this.levelSpawns.length = 0;
        this.cameraTransitionZ.length = 0;
    }

    public getCellSize(): number {
        return this.cellSize;
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

    public isWalkableGrid(x: number, z: number): boolean {
        const key = this.key(x, z);
        return this.walkableTiles.has(key) && this.fillableTiles.has(key) && !this.filledTiles.has(key) && !this.fillNodes.has(key);
    }

    public isFilledGrid(x: number, z: number): boolean {
        return this.filledTiles.has(this.key(x, z));
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
        let movedThroughEmpty = false;
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

    public fillCell(x: number, z: number, fillPrefab: Prefab): void {
        this.setFilled(x, z, fillPrefab, true, 0, true);
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

    public placeTrail(x: number, z: number, prefab: Prefab): void {
        const key = this.key(x, z);
        if (!this.isEmptyFloorGrid(x, z)) {
            return;
        }

        const trail = this.spawnPrefab(prefab, x, z);
        this.playTrailSpawn(trail);
        this.trailNodes.set(key, trail);
    }

    public commitTrailToFill(playerCell: Vec2, fillPrefab: Prefab): void {
        const trailKeys = [...this.trailNodes.keys()];
        for (let i = 0; i < trailKeys.length; i++) {
            const [x, z] = this.parseKey(trailKeys[i]);
            this.setFilled(x, z, fillPrefab, true, i * 0.015);
        }
        this.trailNodes.clear();
        this.fillClosedAreas(playerCell, fillPrefab);
    }

    public fillRemainingLevel(cell: Vec2, fillPrefab: Prefab): void {
        const levelIndex = this.getLevelIndex(cell);
        if (levelIndex < 0) {
            return;
        }

        const keys = [...this.levelFillableTiles[levelIndex]].filter(key => !this.filledTiles.has(key) && !this.fillNodes.has(key));
        const delays = this.getAStarFillDelays(keys, cell);
        for (const key of keys) {
            const [x, z] = this.parseKey(key);
            this.setFilled(x, z, fillPrefab, true, (delays.get(key) ?? 0) * 0.04);
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
                if (symbol === '#' && y !== 0) {
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

            const [x, z] = this.parseKey(key);
            if (walls.has(this.key(x, z - 1))) continue;

            const depth = this.countRun(walls, x, z, 0, 1);
            if (depth <= 1) continue;

            this.spawnWallRun(x, z, 1, depth, tiles);
            this.deleteRun(walls, x, z, 0, 1, depth);
        }

        for (const key of [...walls]) {
            if (!walls.has(key)) continue;

            const [x, z] = this.parseKey(key);
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

            const [tileX, tileZ] = this.parseKey(key);
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
        tile.setParent(this.node);
        tile.setPosition(this.gridToLocal(x, z));
        this.spawned.push(tile);
        return tile;
    }

    private setFilled(x: number, z: number, prefab: Prefab, animate: boolean, delay = 0, force = false): void {
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
        this.fillNodes.set(key, fill);
        if (animate) {
            this.playFillSpawn(fill, delay, () => this.filledTiles.add(key));
            return;
        }

        this.filledTiles.add(key);
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

    private fillClosedAreas(playerCell: Vec2, fillPrefab: Prefab): void {
        const levelIndex = this.getLevelIndex(playerCell);
        if (levelIndex < 0) {
            return;
        }

        const bounds = this.getKeyBounds(this.levelTiles[levelIndex]);
        const blocked = new Set([...this.levelBoundaryTiles[levelIndex], ...this.filledTiles, ...this.fillNodes.keys()]);
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
            const [x, z] = this.parseKey(queue[i]);
            add(x + 1, z);
            add(x - 1, z);
            add(x, z + 1);
            add(x, z - 1);
        }

        const inner = [...this.levelFillableTiles[levelIndex]].filter(key => !this.filledTiles.has(key) && !outside.has(key));
        const delays = this.getAStarFillDelays(inner, playerCell);
        for (const key of inner) {
            const [x, z] = this.parseKey(key);
            this.setFilled(x, z, fillPrefab, true, (delays.get(key) ?? 0) * 0.04);
        }
    }

    private getKeyBounds(keys: Set<string>): { minX: number; maxX: number; minZ: number; maxZ: number } {
        let minX = Number.MAX_SAFE_INTEGER;
        let maxX = Number.MIN_SAFE_INTEGER;
        let minZ = Number.MAX_SAFE_INTEGER;
        let maxZ = Number.MIN_SAFE_INTEGER;
        for (const key of keys) {
            const [x, z] = this.parseKey(key);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minZ = Math.min(minZ, z);
            maxZ = Math.max(maxZ, z);
        }
        return { minX, maxX, minZ, maxZ };
    }

    private getAStarFillDelays(keys: string[], playerCell: Vec2): Map<string, number> {
        const area = new Set(keys);
        area.add(this.key(playerCell.x, playerCell.y));
        const delays = new Map<string, number>();
        let min = Number.MAX_SAFE_INTEGER;

        for (const key of keys) {
            const distance = this.getAStarDistance(playerCell, key, area);
            delays.set(key, distance);
            min = Math.min(min, distance);
        }

        for (const key of keys) {
            delays.set(key, (delays.get(key) ?? min) - min);
        }
        return delays;
    }

    private getAStarDistance(start: Vec2, targetKey: string, area: Set<string>): number {
        const [targetX, targetZ] = this.parseKey(targetKey);
        const startKey = this.key(start.x, start.y);
        const open = [startKey];
        const cost = new Map<string, number>([[startKey, 0]]);

        for (let guard = 0; open.length > 0 && guard < area.size * 4; guard++) {
            open.sort((a, b) => this.getAStarScore(a, targetX, targetZ, cost) - this.getAStarScore(b, targetX, targetZ, cost));
            const current = open.shift()!;
            if (current === targetKey) {
                return cost.get(current) ?? 0;
            }

            const [x, z] = this.parseKey(current);
            const nextCost = (cost.get(current) ?? 0) + 1;
            for (const next of [this.key(x + 1, z), this.key(x - 1, z), this.key(x, z + 1), this.key(x, z - 1)]) {
                if (!area.has(next) || nextCost >= (cost.get(next) ?? Number.MAX_SAFE_INTEGER)) continue;
                cost.set(next, nextCost);
                open.push(next);
            }
        }

        return Math.abs(targetX - start.x) + Math.abs(targetZ - start.y);
    }

    private getAStarScore(key: string, targetX: number, targetZ: number, cost: Map<string, number>): number {
        const [x, z] = this.parseKey(key);
        return (cost.get(key) ?? 0) + Math.abs(targetX - x) + Math.abs(targetZ - z);
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
        if (symbol === '.') return this.levelFloor;
        if (symbol === 'L') return this.levelLock;
        return null;
    }

    private getLevelBounds(rows: string[], tunnelLength: number): LevelBounds {
        const width = this.getWidth(rows);
        const depth = rows.length + tunnelLength;
        const offsetX = -(width - 1) / 2;
        const offsetZ = -(depth - 1) / 2;
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

    private parseKey(key: string): [number, number] {
        const parts = key.split(',');
        return [Number(parts[0]), Number(parts[1])];
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
        return true;
    }

    private usesLock(rows: string[]): boolean {
        return rows.some(row => row.includes('L'));
    }
}
