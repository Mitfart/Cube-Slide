import { _decorator, Camera, Component, instantiate, Node, Prefab, Vec2, Vec3, view, tween } from 'cc';
import { LevelConfig, LEVELS } from '../Gameplay/Levels';
import { GridController } from '../Grid/GridController';
import { EnemyController } from '../Enemy/EnemyController';
import { PlayerController } from '../Player/PlayerController';
import { Analytics, AnalyticEvents } from '../Services/Analytics';
import { UIManager } from '../UI/UIManager';
const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    @property(GridController)
    public grid: GridController | null = null;

    @property(Prefab)
    public playerPrefab: Prefab | null = null;

    @property(Prefab)
    public enemyPrefab: Prefab | null = null;

    @property(Camera)
    public camera: Camera | null = null;

    @property(UIManager)
    public uiManager: UIManager | null = null;

    private player: Node | null = null;
    private readonly enemies: EnemyController[] = [];
    private ended = false;
    private currentLevels: LevelConfig[] = [];
    private baseOrthoHeight = 0;
    private lastLandscape = false;

    protected start(): void {
        this.startGame();
    }

    public startGame(): void {
        this.buildLevels([LEVELS[0], LEVELS[1]]);
    }

    public restartGame(): void {
        this.startGame();
    }

    protected update(): void {
        if (this.currentLevels.length === 0) {
            return;
        }

        this.lastLandscape = this.isLandscape();
        this.updateCamera();
        this.checkEnemyHit();
    }

    public buildLevel(level: LevelConfig): void {
        this.buildLevels([level]);
    }

    public buildLevels(levels: LevelConfig[]): void {
        this.ended = false;
        if (!this.uiManager) {
            console.error('[GameManager] Missing uiManager');
            return;
        }
        this.uiManager.reset();
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }
        if (levels.length === 0) {
            console.error('[GameManager] Missing level');
            return;
        }

        this.currentLevels = levels;
        this.grid.buildLevels(levels);
        this.spawnPlayer(levels[0]);
        this.spawnEnemies(levels);
        this.updateCamera();
    }

    public clearLevel(): void {
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }

        this.grid.clearLevel();
        this.currentLevels = [];
        if (this.player) {
            this.player.destroy();
            this.player = null;
        }
        this.clearEnemies();
    }

    private spawnPlayer(level: LevelConfig): void {
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }
        if (!this.playerPrefab) {
            console.error('[GameManager] Missing playerPrefab');
            return;
        }

        if (this.player) {
            this.player.destroy();
        }

        this.player = instantiate(this.playerPrefab);
        this.player.setParent(this.grid.node);
        this.player.setPosition(this.grid.getBuiltLevelSpawn(0) ?? this.grid.getBuiltLevelCenter(0) ?? this.grid.getLevelCenter(level));

        const playerController = this.player.getComponent(PlayerController);
        if (!playerController) {
            console.error('[GameManager] Missing PlayerController on playerPrefab');
            return;
        }
        playerController.onGameEnd = () => this.endGame();
        playerController.setGrid(this.grid);
    }

    private spawnEnemies(levels: LevelConfig[]): void {
        this.clearEnemies();
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }
        if (!this.enemyPrefab) {
            console.error('[GameManager] Missing enemyPrefab');
            return;
        }

        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            if (!level.enemyShape) continue;

            const node = new Node(`Enemy_${i}`);
            node.setParent(this.grid.node);
            const enemy = node.addComponent(EnemyController);
            const start = this.getEnemyCell(i, level.enemyPositionStart, level.enemyShape) ?? this.grid.localToGrid(this.grid.getBuiltLevelCenter(i) ?? new Vec3());
            const end = this.getEnemyCell(i, level.enemyPositionEnd, level.enemyShape);
            enemy.setup(this.grid, this.enemyPrefab, level.enemyShape, start, end ?? undefined);
            enemy.onDestroyed = cell => this.fillLevelAfterEnemyDestroyed(cell);
            this.enemies.push(enemy);
        }
    }

    private clearEnemies(): void {
        for (const enemy of this.enemies) {
            enemy.node.destroy();
        }
        this.enemies.length = 0;
    }

    private getEnemyCell(levelIndex: number, position: Vec2 | undefined, shape: number[][]): Vec2 | null {
        if (!position || !this.grid) {
            return null;
        }
        return this.grid.getBuiltLevelTopCell(levelIndex, position.x, position.y + Math.floor(shape.length / 2));
    }

    private fillLevelAfterEnemyDestroyed(cell: Vec2): void {
        if (!this.grid || !this.player) {
            return;
        }

        const playerController = this.player.getComponent(PlayerController);
        const fillPrefab = playerController?.getFillPrefab();
        if (!fillPrefab) {
            console.error('[GameManager] Missing playerFill');
            return;
        }

        this.grid.fillRemainingLevel(cell, fillPrefab);
        playerController.waitForLevelComplete(playerController.getGridCell() ?? cell);
    }

    private endGame(): void {
        if (this.ended) {
            return;
        }

        if (!this.uiManager) {
            console.error('[GameManager] Missing uiManager');
            return;
        }

        this.ended = true;
        this.playConfetti();
        this.uiManager.showWin();
        Analytics.emit(AnalyticEvents.CHALLENGE_SOLVED);
        Analytics.emit(AnalyticEvents.ENDCARD_SHOWN);
        const playable = window as Window & { gameEnd?: () => void };
        playable.gameEnd?.();
    }

    private playConfetti(): void {
        if (!this.enemyPrefab) {
            console.error('[GameManager] Missing enemyPrefab');
            return;
        }
        if (!this.grid || !this.player) {
            return;
        }

        const origin = this.player.worldPosition.clone();
        origin.y += 1;
        for (let i = 0; i < 40; i++) {
            const piece = instantiate(this.enemyPrefab);
            piece.setParent(this.grid.node);
            piece.setWorldPosition(origin);
            piece.setScale(0.25, 0.25, 0.25);
            const angle = Math.random() * Math.PI * 2;
            const radius = 1 + Math.random() * 3;
            const target = new Vec3(
                piece.position.x + Math.cos(angle) * radius,
                piece.position.y + 1 + Math.random() * 2,
                piece.position.z + Math.sin(angle) * radius,
            );
            tween(piece)
                .to(0.45 + Math.random() * 0.25, { position: target, scale: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
                .call(() => piece.destroy())
                .start();
        }
    }

    public failGame(): void {
        if (this.ended) {
            return;
        }

        if (!this.uiManager) {
            console.error('[GameManager] Missing uiManager');
            return;
        }

        this.ended = true;
        this.uiManager.showFail();
        Analytics.emit(AnalyticEvents.CHALLENGE_FAILED);
        Analytics.emit(AnalyticEvents.ENDCARD_SHOWN);
    }

    private checkEnemyHit(): void {
        if (!this.grid || !this.player || this.ended) {
            return;
        }

        const playerController = this.player.getComponent(PlayerController);
        const playerCell = playerController?.getGridCell();

        for (const enemy of this.enemies) {
            for (const cell of enemy.getOccupiedCells()) {
                if (this.grid.hasTrailGrid(cell.x, cell.y) || (playerController?.isActiveSlide() && playerCell && cell.x === playerCell.x && cell.y === playerCell.y)) {
                    this.failGame();
                    return;
                }
            }
        }
    }

    private updateCamera(): void {
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }
        if (!this.camera) {
            console.error('[GameManager] Missing camera');
            return;
        }

        if (this.baseOrthoHeight <= 0) {
            this.baseOrthoHeight = this.camera.orthoHeight;
        }

        const isLandscape = this.isLandscape();
        this.lastLandscape = isLandscape;
        const zoom = this.getCameraZoom(isLandscape);
        const offsetZ = this.getCameraOffsetZ(isLandscape);
        const center = this.getCameraCenter();
        const gridPosition = this.grid.node.worldPosition;
        const position = this.camera.node.worldPosition;
        const target = new Vec3(gridPosition.x + center.x, gridPosition.y + center.y, gridPosition.z + center.z + offsetZ);
        const forward = new Vec3(0, 0, -1);
        Vec3.transformQuat(forward, forward, this.camera.node.worldRotation);
        const distance = forward.y === 0 ? 0 : (target.y - position.y) / forward.y;

        this.camera.node.setWorldPosition(new Vec3(target.x - forward.x * distance, position.y, target.z - forward.z * distance));
        this.camera.orthoHeight = this.baseOrthoHeight * zoom;
    }

    private getCameraCenter(): Vec3 {
        if (!this.grid || !this.player) {
            return new Vec3();
        }

        const a = this.grid.getBuiltLevelCenter(0);
        const b = this.grid.getBuiltLevelCenter(1);
        if (!a || !b) {
            return a ?? new Vec3();
        }

        const transition = this.grid.getCameraTransitionZ(0);
        if (!transition) {
            return a;
        }

        const t = this.getCameraTransitionT();
        return new Vec3(
            a.x + (b.x - a.x) * t,
            a.y + (b.y - a.y) * t,
            a.z + (b.z - a.z) * t,
        );
    }

    private getCameraZoom(isLandscape: boolean): number {
        const a = this.currentLevels[0];
        const b = this.currentLevels[1];
        const zoomA = isLandscape ? a.cameraZoomLandscape : a.cameraZoomPortrait;
        if (!b) {
            return zoomA;
        }

        const zoomB = isLandscape ? b.cameraZoomLandscape : b.cameraZoomPortrait;
        return this.lerp(zoomA, zoomB, this.getCameraTransitionT());
    }

    private getCameraOffsetZ(isLandscape: boolean): number {
        const a = this.currentLevels[0];
        const b = this.currentLevels[1];
        const offsetA = isLandscape ? (a.cameraOffsetZLandscape ?? 0) : (a.cameraOffsetZPortrait ?? 0);
        if (!b) {
            return offsetA;
        }

        const offsetB = isLandscape ? (b.cameraOffsetZLandscape ?? 0) : (b.cameraOffsetZPortrait ?? 0);
        return this.lerp(offsetA, offsetB, this.getCameraTransitionT());
    }

    private getCameraTransitionT(): number {
        if (!this.grid || !this.player) {
            return 0;
        }

        const transition = this.grid.getCameraTransitionZ(0);
        if (!transition) {
            return 0;
        }

        const t = Math.max(0, Math.min(1, (this.player.position.z - transition.x) / (transition.y - transition.x)));
        return t * t * (3 - 2 * t);
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    private isLandscape(): boolean {
        const size = view.getVisibleSize();
        return size.width > size.height;
    }
}
