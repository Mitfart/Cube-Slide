import { _decorator, Color, Component, GradientRange, Material, MeshRenderer, Node, ParticleSystem, Prefab, Vec2, Vec3, instantiate, tween } from 'cc';
import { GridController } from '../Infrastructure/GridController';
import { SoundManager } from '../Infrastructure/Services/SoundManager';
const { ccclass, property } = _decorator;
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
        this.cullFilledCells();
    }

    public getOccupiedCells(): Vec2[] {
        this.cullFilledCells();
        const seen = new Set<string>();
        const result: Vec2[] = [];
        for (const cell of this.cells) {
            for (const gridCell of this.getTouchedCells(cell)) {
                const key = `${gridCell.x},${gridCell.y}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                result.push(gridCell);
            }
        }
        return result;
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
                const offsetX = x - Math.floor(width / 2);
                const offsetZ = z - Math.floor(height / 2);
                const node = instantiate(this.enemyCellPrefab);
                node.setParent(this.node, false);
                node.setPosition(new Vec3(offsetX, 0, offsetZ));
                this.applyColor(node, colors?.[shape[z][x]]);
                this.cells.push([offsetX, offsetZ, node]);
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

    private cullFilledCells(): void {
        if (!this.grid) {
            console.error('[EnemyController] Missing grid');
            return;
        }

        const burstCells = new Set<string>();
        for (let i = this.cells.length - 1; i >= 0; i--) {
            const cell = this.cells[i];
            const touched = this.getTouchedCells(cell);
            const hitCell = touched.find(gridCell => this.grid!.isFilledGrid(gridCell.x, gridCell.y));
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
        return this.grid.getTouchedCells(local);
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
