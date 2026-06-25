import { _decorator, Color, Component, GradientRange, Material, MeshRenderer, Node, ParticleSystem, Prefab, Vec2, Vec3, instantiate, tween } from 'cc';
import { GridController } from '../Infrastructure/GridController';
import { SoundManager } from '../Infrastructure/Services/SoundManager';
const { ccclass, property } = _decorator;
const DEBUG_ENEMY_HIT = false;
const DEBUG_ENEMY_HIT_INTERVAL = 30;

type EnemyCell = [number, number, Node];

@ccclass('EnemyController')
export class EnemyController extends Component {
    @property({ type: GridController, visible: false })
    public grid: GridController | null = null;

    @property(Prefab)
    public enemyCellPrefab: Prefab | null = null;

    @property(Prefab)
    public destroyParticlePrefab: Prefab | null = null;

    @property
    public cellsPerSecond = 3;

    @property({ type: SoundManager, visible: false })
    public soundManager: SoundManager | null = null;

    private readonly cells: EnemyCell[] = [];
    private readonly materialsByColor = new Map<string, Material>();
    private startPos = new Vec2();
    private endPos = new Vec2();
    private goingToEnd = true;
    private destroyed = false;
    private debugFrame = 0;
    public onDestroyed: ((cell: Vec2) => void) | null = null;

    public setup(grid: GridController, enemyCellPrefab: Prefab, shape: number[][], start: Vec2, end?: Vec2, soundManager: SoundManager | null = null, colors?: Record<number, string>, destroyParticlePrefab: Prefab | null = null): void {
        this.grid = grid;
        this.enemyCellPrefab = enemyCellPrefab;
        this.destroyParticlePrefab = destroyParticlePrefab;
        this.soundManager = soundManager;
        this.startPos = start.clone();
        this.endPos = end?.clone() ?? start.clone();
        if (DEBUG_ENEMY_HIT) console.debug(`[DEBUG-EnemyHit] Enemy.setup start=(${start.x},${start.y}) end=(${this.endPos.x},${this.endPos.y}) rows=${shape.length} rowLengths=${shape.map(row => row.length).join(',')}`);
        this.buildShape(shape, colors);
        if (DEBUG_ENEMY_HIT) console.debug(`[DEBUG-EnemyHit] Enemy.setup builtCells=${this.cells.length} rawFirst=${this.formatRawCell(this.cells[0])} rawLast=${this.formatRawCell(this.cells[this.cells.length - 1])}`);
        this.node.setPosition(this.grid.gridToLocal(start.x, start.y));
        if (DEBUG_ENEMY_HIT) console.debug(`[DEBUG-EnemyHit] Enemy.setup nodePos=(${this.node.position.x},${this.node.position.z}) children=${this.node.children.length}`);
        if (end && !this.sameCell(start, end)) {
            this.moveNext();
        }
    }

    protected update(): void {
        this.destroyFilledCells();
    }

    public getOccupiedCells(): Vec2[] {
        this.debugFrame++;
        const shouldLog = DEBUG_ENEMY_HIT && this.debugFrame % DEBUG_ENEMY_HIT_INTERVAL === 0;
        const seen = new Set<string>();
        const result: Vec2[] = [];
        if (shouldLog) console.debug(`[DEBUG-EnemyHit] Enemy.getOccupied start cells=${this.cells.length} children=${this.node.children.length} nodePos=(${this.node.position.x.toFixed(2)},${this.node.position.z.toFixed(2)}) raw0=${this.formatRawCell(this.cells[0])} raw1=${this.formatRawCell(this.cells[1])}`);
        for (let i = 0; i < this.cells.length; i++) {
            const cell = this.cells[i];
            const gridCells = this.getTouchedCells(cell);
            if (shouldLog && i < 3) console.debug(`[DEBUG-EnemyHit] Enemy.getOccupied cellIndex=${i} raw=${this.formatRawCell(cell)} touched=${this.formatVecs(gridCells)}`);
            for (const gridCell of gridCells) {
                const key = `${gridCell.x},${gridCell.y}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                result.push(gridCell);
            }
        }
        if (shouldLog) console.debug(`[DEBUG-EnemyHit] Enemy.getOccupied resultCount=${result.length} result=${this.formatVecs(result.slice(0, 12))}`);
        return result;
    }

    private buildShape(shape: number[][], colors?: Record<number, string>): void {
        if (!this.enemyCellPrefab) {
            console.error('[EnemyController] Missing enemyCellPrefab');
            return;
        }

        const height = shape.length;
        const width = shape.reduce((max, row) => Math.max(max, row.length), 0);
        let built = 0;
        if (DEBUG_ENEMY_HIT) console.debug(`[DEBUG-EnemyHit] Enemy.buildShape height=${height} width=${width} nonZeroPerRow=${shape.map(row => row.filter(value => value !== 0).length).join(',')}`);
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < shape[z].length; x++) {
                if (shape[z][x] === 0) continue;
                const offsetX = x - Math.floor(width / 2);
                const offsetZ = z - Math.floor(height / 2);
                const node = instantiate(this.enemyCellPrefab);
                node.setParent(this.node, false);
                node.setPosition(new Vec3(offsetX, 0, offsetZ));
                this.applyColor(node, colors?.[shape[z][x]]);
                this.cells.push([offsetX, offsetZ, node]);
                built++;
                if (DEBUG_ENEMY_HIT && built <= 5) console.debug(`[DEBUG-EnemyHit] Enemy.buildShape add#${built} shape[${z}][${x}]=${shape[z][x]} offset=(${offsetX},${offsetZ}) nodePos=(${node.position.x},${node.position.z})`);
            }
        }
        if (DEBUG_ENEMY_HIT) console.debug(`[DEBUG-EnemyHit] Enemy.buildShape done built=${built} stored=${this.cells.length} children=${this.node.children.length}`);
    }

    private applyColor(node: Node, hex?: string): void {
        if (!hex) {
            return;
        }

        const renderer = node.getComponentInChildren(MeshRenderer);
        const base = renderer?.getSharedMaterial(0);
        if (!renderer || !base) {
            return;
        }

        let material = this.materialsByColor.get(hex);
        if (!material) {
            material = new Material();
            material.copy(base);
            material.setProperty('mainColor', new Color().fromHEX(hex));
            this.materialsByColor.set(hex, material);
        }

        renderer.setSharedMaterial(material, 0);
    }

    private moveNext(): void {
        if (!this.grid) {
            console.error('[EnemyController] Missing grid');
            return;
        }

        const current = this.grid.localToGrid(this.node.position);
        if (this.sameCell(current, this.goingToEnd ? this.endPos : this.startPos)) {
            this.goingToEnd = !this.goingToEnd;
        }

        const goal = this.goingToEnd ? this.endPos : this.startPos;
        const target = this.grid.gridToLocal(goal.x, goal.y);
        const distance = Vec3.distance(this.node.position, target);
        if (DEBUG_ENEMY_HIT) console.debug(`[DEBUG-EnemyHit] Enemy.move current=(${current.x},${current.y}) goal=(${goal.x},${goal.y}) target=(${target.x},${target.z}) distance=${distance.toFixed(2)} goingToEnd=${this.goingToEnd}`);
        tween(this.node)
            .to(distance / this.cellsPerSecond, { position: target }, { easing: 'quadInOut' })
            .call(() => {
                this.node.setPosition(target);
                this.goingToEnd = !this.goingToEnd;
                this.moveNext();
            })
            .start();
    }

    private sameCell(a: Vec2, b: Vec2): boolean {
        return a.x === b.x && a.y === b.y;
    }

    private destroyFilledCells(): void {
        if (!this.grid) {
            console.error('[EnemyController] Missing grid');
            return;
        }

        const burstCells = new Set<string>();
        for (let i = this.cells.length - 1; i >= 0; i--) {
            const cell = this.cells[i];
            const touched = this.getTouchedCells(cell);
            const hitCell = touched.find(gridCell => this.grid!.isSettledFilledGrid(gridCell.x, gridCell.y));
            if (!hitCell) continue;
            const delay = Math.random() * 0.12;
            if (!this.hasNearbyBurst(hitCell, burstCells)) {
                const soundPosition = cell[2].worldPosition.clone();
                this.scheduleOnce(() => this.soundManager?.playEnemyDestroy(soundPosition), delay);
                this.spawnDestroyBurst(cell[2], delay);
                burstCells.add(`${hitCell.x},${hitCell.y}`);
            }
            this.playDestroy(cell[2], delay);
            this.cells.splice(i, 1);
            if (this.cells.length === 0 && !this.destroyed) {
                this.destroyed = true;
                this.onDestroyed?.(hitCell);
            }
        }
    }

    private hasNearbyBurst(cell: Vec2, burstCells: Set<string>): boolean {
        return burstCells.has(`${cell.x},${cell.y}`)
            || burstCells.has(`${cell.x + 1},${cell.y}`)
            || burstCells.has(`${cell.x - 1},${cell.y}`)
            || burstCells.has(`${cell.x},${cell.y + 1}`)
            || burstCells.has(`${cell.x},${cell.y - 1}`);
    }

    private getTouchedCells(cell: EnemyCell): Vec2[] {
        if (!this.grid) {
            return [];
        }

        const local = new Vec3(
            this.node.position.x + cell[0],
            0,
            this.node.position.z + cell[1],
        );
        const center = this.grid.localToGrid(local);
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

    private formatRawCell(cell: EnemyCell | undefined): string {
        if (!cell) {
            return 'none';
        }
        const anyCell = cell as unknown as Record<string, unknown>;
        return `array=${Array.isArray(cell)} len=${cell.length} 0=${cell[0]} 1=${cell[1]} keys=${Object.keys(anyCell).join('|')}`;
    }

    private formatVecs(cells: Vec2[]): string {
        return `[${cells.map(cell => `(${cell.x},${cell.y})`).join(' ')}]`;
    }

    private spawnDestroyBurst(node: Node, delay: number): void {
        if (!this.destroyParticlePrefab) {
            console.error('[EnemyController] Missing destroyParticlePrefab');
            return;
        }

        const start = node.worldPosition.clone();
        start.y += 0.45;
        const sourceColor = node.getComponentInChildren(MeshRenderer)?.getSharedMaterial(0)?.getProperty('mainColor') as Color | null;
        this.scheduleOnce(() => {
            const effect = instantiate(this.destroyParticlePrefab!);
            effect.setParent(this.node.parent);
            effect.setWorldPosition(start);
            effect.setScale(1.3, 1.3, 1.3);
            const particles = effect.getComponent(ParticleSystem);
            if (particles && sourceColor) {
                particles.startColor.mode = GradientRange.Mode.Color;
                particles.startColor.color = sourceColor.clone();
            }
            particles?.stop();
            particles?.clear();
            particles?.play();
            this.scheduleOnce(() => effect.destroy(), 2);
        }, delay);
    }

    private playDestroy(node: Node, delay: number): void {
        tween(node)
            .delay(delay)
            .to(0.15, { scale: new Vec3(0, 0, 0) }, { easing: 'backIn' })
            .call(() => node.destroy())
            .start();
    }
}
