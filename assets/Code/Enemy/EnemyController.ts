import { _decorator, Component, Node, Prefab, Vec2, Vec3, instantiate, tween } from 'cc';
import { GridController } from '../Grid/GridController';
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

    @property
    public cellsPerSecond = 3;

    private readonly cells: EnemyCell[] = [];
    private start = new Vec2();
    private end = new Vec2();
    private goingToEnd = true;
    private destroyed = false;
    public onDestroyed: ((cell: Vec2) => void) | null = null;

    public setup(grid: GridController, enemyCellPrefab: Prefab, shape: number[][], start: Vec2, end?: Vec2): void {
        this.grid = grid;
        this.enemyCellPrefab = enemyCellPrefab;
        this.start = start.clone();
        this.end = end?.clone() ?? start.clone();
        this.buildShape(shape);
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

    private buildShape(shape: number[][]): void {
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
                node.setParent(this.node);
                node.setPosition(new Vec3(cell.x, 0, cell.y));
                this.cells.push({ offset: cell, node });
            }
        }
    }

    private moveNext(): void {
        if (!this.grid) {
            console.error('[EnemyController] Missing grid');
            return;
        }

        const current = this.grid.localToGrid(this.node.position);
        if (this.sameCell(current, this.goingToEnd ? this.end : this.start)) {
            this.goingToEnd = !this.goingToEnd;
        }

        const goal = this.goingToEnd ? this.end : this.start;
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

        for (let i = this.cells.length - 1; i >= 0; i--) {
            const cell = this.cells[i];
            const touched = this.getTouchedCells(cell.node);
            const hitCell = touched.find(gridCell => this.grid!.isFilledGrid(gridCell.x, gridCell.y));
            if (!hitCell) continue;
            const delay = Math.random() * 0.12;
            this.spawnDestroyBurst(cell.node, delay);
            this.playDestroy(cell.node, delay);
            this.cells.splice(i, 1);
            if (this.cells.length === 0 && !this.destroyed) {
                this.destroyed = true;
                this.onDestroyed?.(hitCell);
            }
        }
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
        if (!this.enemyCellPrefab) {
            console.error('[EnemyController] Missing enemyCellPrefab');
            return;
        }

        const start = node.worldPosition.clone();
        start.y += 0.45;
        for (let i = 0; i < 12; i++) {
            const particle = instantiate(this.enemyCellPrefab);
            particle.setParent(this.node.parent);
            particle.setWorldPosition(start);
            particle.setScale(0.5, 0.5, 0.5);
            const angle = Math.random() * Math.PI * 2;
            const distance = 0.55 + Math.random() * 0.55;
            const target = new Vec3(
                particle.position.x + Math.cos(angle) * distance,
                particle.position.y + 0.35 + Math.random() * 0.45,
                particle.position.z + Math.sin(angle) * distance,
            );
            tween(particle)
                .delay(delay)
                .to(0.22, { position: target, scale: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
                .call(() => particle.destroy())
                .start();
        }
    }

    private playDestroy(node: Node, delay: number): void {
        tween(node)
            .delay(delay)
            .to(0.15, { scale: new Vec3(0, 0, 0) }, { easing: 'backIn' })
            .call(() => node.destroy())
            .start();
    }
}
