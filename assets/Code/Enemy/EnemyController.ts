import { _decorator, Color, Component, GradientRange, Material, MeshRenderer, Node, ParticleSystem, Prefab, Vec2, Vec3, instantiate, tween } from 'cc';
import { GridController } from '../Grid/GridController';
import { SoundManager } from '../Services/SoundManager';
const { ccclass, property } = _decorator;

interface EnemyCell {
    offset: Vec2;
    node: Node;
}

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
    public onDestroyed: ((cell: Vec2) => void) | null = null;

    public setup(grid: GridController, enemyCellPrefab: Prefab, shape: number[][], start: Vec2, end?: Vec2, soundManager: SoundManager | null = null, colors?: Record<number, string>, destroyParticlePrefab: Prefab | null = null): void {
        this.grid = grid;
        this.enemyCellPrefab = enemyCellPrefab;
        this.destroyParticlePrefab = destroyParticlePrefab;
        this.soundManager = soundManager;
        this.startPos = start.clone();
        this.endPos = end?.clone() ?? start.clone();
        this.buildShape(shape, colors);
        this.node.setPosition(this.grid.gridToLocal(start.x, start.y));
        if (end && !this.sameCell(start, end)) {
            this.moveNext();
        }
    }

    protected update(): void {
        this.destroyFilledCells();
    }

    public getOccupiedCells(): Vec2[] {
        const touched = new Map<string, Vec2>();
        for (const cell of this.cells) {
            for (const gridCell of this.getTouchedCells(cell.node)) {
                touched.set(`${gridCell.x},${gridCell.y}`, gridCell);
            }
        }
        return [...touched.values()];
    }

    private buildShape(shape: number[][], colors?: Record<number, string>): void {
        if (!this.enemyCellPrefab) {
            console.error('[EnemyController] Missing enemyCellPrefab');
            return;
        }

        const height = shape.length;
        const width = shape.reduce((max, row) => Math.max(max, row.length), 0);
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < shape[z].length; x++) {
                if (shape[z][x] === 0) continue;
                const cell = new Vec2(x - Math.floor(width / 2), z - Math.floor(height / 2));
                const node = instantiate(this.enemyCellPrefab);
                node.setParent(this.node, false);
                node.setPosition(new Vec3(cell.x, 0, cell.y));
                this.applyColor(node, colors?.[shape[z][x]]);
                this.cells.push({ offset: cell, node });
            }
        }
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
            const touched = this.getTouchedCells(cell.node);
            const hitCell = touched.find(gridCell => this.grid!.isSettledFilledGrid(gridCell.x, gridCell.y));
            if (!hitCell) continue;
            const delay = Math.random() * 0.12;
            if (!this.hasNearbyBurst(hitCell, burstCells)) {
                const soundPosition = cell.node.worldPosition.clone();
                this.scheduleOnce(() => this.soundManager.playEnemyDestroy(soundPosition), delay);
                this.spawnDestroyBurst(cell.node, delay);
                burstCells.add(`${hitCell.x},${hitCell.y}`);
            }
            this.playDestroy(cell.node, delay);
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

    private getTouchedCells(node: Node): Vec2[] {
        if (!this.grid) {
            return [];
        }

        const center = this.grid.worldToGrid(node.worldPosition);
        const cells = [center];
        const local = new Vec3();
        this.grid.node.inverseTransformPoint(local, node.worldPosition);
        const dx = local.x - center.x;
        const dz = local.z - center.y;
        const threshold = 0.2;
        if (dx > threshold) cells.push(new Vec2(center.x + 1, center.y));
        if (dx < -threshold) cells.push(new Vec2(center.x - 1, center.y));
        if (dz > threshold) cells.push(new Vec2(center.x, center.y + 1));
        if (dz < -threshold) cells.push(new Vec2(center.x, center.y - 1));
        return cells;
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
