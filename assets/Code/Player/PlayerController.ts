import { _decorator, Component, input, Input, EventTouch, Prefab, Vec2, Vec3, tween, Tween } from 'cc';
import { GridController } from '../Infrastructure/GridController';
const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property({ type: GridController, visible: false })
    public grid: GridController | null = null;

    @property
    public cellsPerSecond = 8;

    @property(Prefab)
    public playerTrail: Prefab | null = null;

    @property(Prefab)
    public playerFill: Prefab | null = null;

    @property
    public maxLives = 3;

    public minimumDragDistance = 0;

    private currentLives = 3;
    private readonly snapBackThreshold = 0.25;
    private touchStart = new Vec2();
    private moving = false;
    private direction = new Vec2();
    private lastCell = new Vec2(Number.NaN, Number.NaN);
    private hasTrail = false;
    private scriptedMove = false;
    private pendingLevelCompleteCell: Vec2 | null = null;
    private inputLocked = false;
    public onGameEnd: (() => void) | null = null;

    protected onEnable(): void {
        input.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
        Tween.stopAllByTarget(this.node);
        this.moving = false;
        this.direction.set(0, 0);
        this.hasTrail = false;
        this.scriptedMove = false;
        this.pendingLevelCompleteCell = null;
        this.inputLocked = false;
    }

    protected update(): void {
        if (this.moving) {
            this.paintCurrentCell();
            return;
        }

        if (this.pendingLevelCompleteCell) {
            this.moveThroughTunnelIfLevelComplete(this.pendingLevelCompleteCell);
        }
    }

    public setGrid(grid: GridController): void {
        this.grid = grid;
        this.currentLives = this.maxLives;
        this.fillSpawnCell();
    }

    public takeDamage(): boolean {
        this.currentLives = Math.max(0, this.currentLives - 1);
        return this.currentLives <= 0;
    }

    public getCurrentLives(): number {
        return this.currentLives;
    }

    public hideForDamage(): void {
        Tween.stopAllByTarget(this.node);
        this.moving = false;
        this.direction.set(0, 0);
        this.pendingLevelCompleteCell = null;
        this.scriptedMove = false;
        this.inputLocked = true;
        this.node.active = false;
    }

    public respawnAfterDamageAt(position: Vec3): void {
        this.node.setPosition(position);
        this.lastCell.set(Number.NaN, Number.NaN);
        this.hasTrail = false;
        this.node.active = true;
        this.inputLocked = false;
        this.fillSpawnCell();
    }

    public isActiveSlide(): boolean {
        return this.moving && !this.scriptedMove;
    }

    public getGridCell(): Vec2 | null {
        return this.grid ? this.grid.localToGrid(this.node.position) : null;
    }

    public getTouchedCells(): Vec2[] {
        if (!this.grid) {
            return [];
        }

        return this.grid.getTouchedCells(this.node.position);
    }

    public getFillPrefab(): Prefab | null {
        return this.playerFill;
    }

    public waitForLevelComplete(cell: Vec2): void {
        this.pendingLevelCompleteCell = cell;
    }

    private onTouchStart(event: EventTouch): void {
        this.touchStart = event.getUILocation();
    }

    private onTouchEnd(event: EventTouch): void {
        if (this.inputLocked || this.scriptedMove || this.pendingLevelCompleteCell) {
            return;
        }

        const delta = event.getUILocation().subtract(this.touchStart);
        if (!this.hasRequiredFields()) {
            return;
        }
        if (delta.length() < this.minimumDragDistance) {
            return;
        }

        const direction = Math.abs(delta.x) > Math.abs(delta.y)
            ? new Vec2(Math.sign(delta.x), 0)
            : new Vec2(0, delta.y > 0 ? -1 : 1);

        if (this.moving) {
            this.finishCurrentCell(() => {
                if (!this.commitTrailIfEndedOnFill()) {
                    this.slide(direction);
                }
            });
            return;
        }
        this.slide(direction);
    }

    private slide(direction: Vec2): void {
        if (!this.hasRequiredFields()) {
            return;
        }

        const start = this.grid!.localToGrid(this.node.position);
        this.lastCell.set(start.x, start.y);
        const target = this.grid!.getSlideTarget(start, direction);
        const distance = Vec3.distance(this.node.position, target);
        if (distance <= 0) {
            this.moving = false;
            this.direction.set(0, 0);
            return;
        }

        this.moving = true;
        this.direction.set(direction.x, direction.y);
        tween(this.node)
            .to(distance / this.cellsPerSecond, { position: target })
            .call(() => {
                this.node.setPosition(target);
                this.paintCurrentCell();
                this.moving = false;
                this.direction.set(0, 0);
                this.commitTrailAtCurrentCell();
            })
            .start();
    }

    private finishCurrentCell(done: () => void): void {
        if (!this.grid) {
            console.error('[PlayerController] Missing grid');
            return;
        }

        Tween.stopAllByTarget(this.node);
        const target = this.getCurrentCellTarget();
        const duration = Math.min(0.05, Vec3.distance(this.node.position, target) / this.cellsPerSecond);
        this.moving = true;
        tween(this.node)
            .to(duration, { position: target }, { easing: 'sineOut' })
            .call(() => {
                this.node.setPosition(target);
                this.paintCurrentCell();
                this.moving = false;
                this.direction.set(0, 0);
                done();
            })
            .start();
    }

    private commitTrailIfEndedOnFill(): boolean {
        if (!this.grid) {
            return false;
        }

        const cell = this.grid.localToGrid(this.node.position);
        return this.grid.isFilledGrid(cell.x, cell.y) && this.commitTrailAtCurrentCell();
    }

    private commitTrailAtCurrentCell(): boolean {
        if (!this.grid || !this.playerFill || !this.hasTrail) {
            return false;
        }

        const cell = this.grid.localToGrid(this.node.position);
        this.grid.commitTrailToFill(cell, this.playerFill);
        this.hasTrail = false;
        this.pendingLevelCompleteCell = this.grid.isLevelCompleteOrFilling(cell) ? cell : null;
        return true;
    }

    private moveThroughTunnelIfLevelComplete(cell: Vec2): void {
        if (!this.grid) {
            return;
        }

        const exit = this.grid.getCompleteLevelExit(cell);
        if (!exit) {
            return;
        }

        this.pendingLevelCompleteCell = null;
        const gameEnd = this.grid.isLastLevelCell(cell);
        this.scriptedMove = true;
        this.moving = true;
        const center = new Vec3(exit.x, this.node.position.y, this.node.position.z);
        const firstDuration = Vec3.distance(this.node.position, center) / this.cellsPerSecond;
        const secondDuration = Vec3.distance(center, exit) / this.cellsPerSecond;
        tween(this.node)
            .to(firstDuration, { position: center }, { easing: 'sineInOut' })
            .to(secondDuration, { position: exit }, { easing: 'sineInOut' })
            .call(() => {
                this.node.setPosition(exit);
                this.fillSpawnCell();
                this.moving = false;
                this.scriptedMove = false;
                if (gameEnd) {
                    this.onGameEnd?.();
                }
            })
            .start();
    }

    private fillSpawnCell(): void {
        if (!this.grid) {
            console.error('[PlayerController] Missing grid');
            return;
        }
        if (!this.playerFill) {
            console.error('[PlayerController] Missing playerFill');
            return;
        }

        const cell = this.grid.localToGrid(this.node.position);
        this.grid.fillCell(cell.x, cell.y, this.playerFill);
    }

    private paintCurrentCell(): void {
        if (!this.grid || !this.playerTrail) {
            return;
        }

        const cell = this.grid.localToGrid(this.node.position);
        if (cell.x === this.lastCell.x && cell.y === this.lastCell.y) {
            return;
        }

        this.lastCell.set(cell.x, cell.y);
        if (!this.grid.isEmptyFloorGrid(cell.x, cell.y)) {
            return;
        }

        this.grid.placeTrail(cell.x, cell.y, this.playerTrail);
        this.hasTrail = true;
    }

    private hasRequiredFields(): boolean {
        if (!this.grid) {
            console.error('[PlayerController] Missing grid');
            return false;
        }
        if (!this.playerTrail) {
            console.error('[PlayerController] Missing playerTrail');
            return false;
        }
        if (!this.playerFill) {
            console.error('[PlayerController] Missing playerFill');
            return false;
        }
        return true;
    }

    private getCurrentCellTarget(): Vec3 {
        if (!this.grid) {
            return this.node.position;
        }

        const position = this.node.position;
        let x = Math.round(position.x);
        let z = Math.round(position.z);

        if (this.direction.x !== 0) {
            const previous = this.direction.x > 0 ? Math.floor(position.x) : Math.ceil(position.x);
            const progress = Math.abs(position.x - previous);
            x = progress < this.snapBackThreshold ? previous : previous + this.direction.x;
            z = Math.round(position.z);
        } else if (this.direction.y !== 0) {
            const previous = this.direction.y > 0 ? Math.floor(position.z) : Math.ceil(position.z);
            const progress = Math.abs(position.z - previous);
            z = progress < this.snapBackThreshold ? previous : previous + this.direction.y;
            x = Math.round(position.x);
        }

        return this.grid.gridToLocal(x, z);
    }
}
