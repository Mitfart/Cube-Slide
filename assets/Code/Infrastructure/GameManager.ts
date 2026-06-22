import { _decorator, Camera, Component, instantiate, Mat4, Node, ParticleSystem, Prefab, Vec2, Vec3, view } from 'cc';
import { LevelConfig, LEVELS } from '../Gameplay/Levels';
import { GridController } from '../Grid/GridController';
import { EnemyController } from '../Enemy/EnemyController';
import { PlayerController } from '../Player/PlayerController';
import { Analytics, AnalyticEvents } from '../Services/Analytics';
import { SoundManager } from '../Services/SoundManager';
import { UIManager } from '../UI/UIManager';
const { ccclass, property } = _decorator;

interface CameraTarget {
    levelIndex: number;
    nextLevelIndex: number;
    t: number;
}

@ccclass('GameManager')
export class GameManager extends Component {
    @property(GridController)
    public grid: GridController | null = null;

    @property(Prefab)
    public playerPrefab: Prefab | null = null;

    @property(Prefab)
    public enemyPrefab: Prefab | null = null;

    @property(Prefab)
    public enemyDestroyParticlePrefab: Prefab | null = null;

    @property(Prefab)
    public confettiEffectPrefab: Prefab | null = null;

    @property(Camera)
    public camera: Camera | null = null;

    @property(UIManager)
    public uiManager: UIManager | null = null;

    @property(SoundManager)
    public soundManager: SoundManager | null = null;

    @property
    public minimumDragDistance = 40;

    private player: Node | null = null;
    private readonly enemies: EnemyController[] = [];
    private ended = false;
    private hurtLocked = false;
    private currentLevels: LevelConfig[] = [];
    private baseOrthoHeight = 0;
    private baseCameraLocalY = 0;
    private baseCameraPitch = 0;

    protected start(): void {
        this.startGame();
    }

    public startGame(): void {
        this.buildLevel(LEVELS[0]);
    }

    public restartGame(): void {
        this.startGame();
    }

    protected update(): void {
        if (this.currentLevels.length === 0) {
            return;
        }

        this.updateCamera();
        this.updateLevelProgress();
        this.checkEnemyHit();
        this.checkCoinCollect();
    }

    public buildLevel(level: LevelConfig): void {
        this.buildLevels([level]);
    }

    public buildLevels(levels: LevelConfig[]): void {
        this.ended = false;
        this.hurtLocked = false;
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
        this.grid.setSoundManager(this.soundManager);
        this.grid.onCoinCollected = coin => {
            if (!this.camera || !this.uiManager) {
                coin.destroy();
                return;
            }
            this.uiManager.collectCoin(coin, this.camera);
        };
        this.grid.buildLevels(levels);
        this.spawnPlayer(levels[0]);
        this.spawnEnemies(levels);
        this.updateCamera();
        this.updateLevelProgress();
    }

    public clearLevel(): void {
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }

        this.grid.onCoinCollected = null;
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
        this.player.setParent(this.grid.node, false);
        this.player.setPosition(this.grid.getBuiltLevelSpawn(0) ?? this.grid.getBuiltLevelCenter(0) ?? this.grid.getLevelCenter(level));

        const playerController = this.player.getComponent(PlayerController);
        if (!playerController) {
            console.error('[GameManager] Missing PlayerController on playerPrefab');
            return;
        }
        playerController.onGameEnd = () => this.endGame();
        playerController.minimumDragDistance = this.minimumDragDistance;
        playerController.setGrid(this.grid);
        this.uiManager?.setupLives(playerController.maxLives);
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
            node.setParent(this.grid.node, false);
            const enemy = node.addComponent(EnemyController);
            const start = this.getEnemyCell(i, level.enemyPositionStart, level.enemyShape) ?? this.grid.localToGrid(this.grid.getBuiltLevelCenter(i) ?? new Vec3());
            const end = this.getEnemyCell(i, level.enemyPositionEnd, level.enemyShape);
            enemy.setup(this.grid, this.enemyPrefab, level.enemyShape, start, end ?? undefined, this.soundManager, level.enemyColors, this.enemyDestroyParticlePrefab);
            enemy.onDestroyed = cell => {
                this.fillLevelAfterEnemyDestroyed(cell);
                this.playConfetti();
            };
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
        if (this.player) {
            (this.soundManager ?? SoundManager.current)?.playWin(this.player.worldPosition);
        }
        this.uiManager.showWin();
        Analytics.emit(AnalyticEvents.CHALLENGE_SOLVED);
        Analytics.emit(AnalyticEvents.ENDCARD_SHOWN);
        const playable = window as Window & { gameEnd?: () => void };
        playable.gameEnd?.();
    }

    private playConfetti(): void {
        if (!this.confettiEffectPrefab) {
            console.error('[GameManager] Missing confettiEffectPrefab');
            return;
        }
        const effect = instantiate(this.confettiEffectPrefab);
        effect.setParent(this.node.parent ?? this.node);
        effect.setSiblingIndex(9999);
        effect.setPosition(0, 6, 0);
        effect.setScale(new Vec3(2.2, 1, 2.2));
        const particles = effect.getComponent(ParticleSystem);
        particles?.stop();
        particles?.clear();
        particles?.play();
        this.scheduleOnce(() => effect.destroy(), 5);
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

    private checkCoinCollect(): void {
        if (!this.grid || !this.player || !this.camera || !this.uiManager || this.ended) {
            return;
        }

        const playerController = this.player.getComponent(PlayerController);
        const cell = playerController?.getGridCell();
        if (!cell) {
            return;
        }

        this.grid.collectCoinAt(cell.x, cell.y);
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
                    this.handlePlayerHit(playerController);
                    return;
                }
            }
        }
    }

    private handlePlayerHit(playerController: PlayerController | null | undefined): void {
        if (this.hurtLocked) {
            return;
        }
        if (!playerController) {
            console.error('[GameManager] Missing PlayerController');
            return;
        }

        (this.soundManager ?? SoundManager.current)?.playEnemyHit(playerController.node.worldPosition);
        const failed = playerController.takeDamage();
        this.uiManager?.popLife();
        if (failed) {
            this.failGame();
            return;
        }

        if (!this.uiManager) {
            console.error('[GameManager] Missing uiManager');
            return;
        }
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }

        const hitCell = playerController.getGridCell();
        const levelIndex = hitCell ? this.grid.getNearestBuiltLevelIndex(hitCell.y) : 0;
        const spawn = this.grid.getBuiltLevelSpawn(levelIndex) ?? this.grid.getBuiltLevelSpawn(0);
        if (!hitCell || !spawn) {
            console.error('[GameManager] Missing damage respawn data');
            return;
        }

        this.hurtLocked = true;
        playerController.hideForDamage();
        this.grid.clearPaintForLevel(hitCell, this.grid.localToGrid(spawn));
        this.uiManager.showHurt();
        this.scheduleOnce(() => playerController.respawnAfterDamageAt(spawn), 0.45);
        this.scheduleOnce(() => this.uiManager?.hideHurt(), 1.7);
        this.scheduleOnce(() => this.hurtLocked = false, 1);
    }

    private updateLevelProgress(): void {
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }
        if (!this.uiManager) {
            console.error('[GameManager] Missing uiManager');
            return;
        }

        const levelIndex = this.getCameraTarget().levelIndex;
        this.uiManager.setLevelProgress(levelIndex + 1, this.grid.getLevelProgress(levelIndex));
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
            const localPosition = new Vec3();
            this.grid.node.inverseTransformPoint(localPosition, this.camera.node.worldPosition);
            this.baseOrthoHeight = this.camera.orthoHeight;
            this.baseCameraLocalY = localPosition.y;
            this.baseCameraPitch = Math.abs(this.camera.node.eulerAngles.x) * Math.PI / 180;
        }

        const isLandscape = this.isLandscape();
        const targetLevel = this.getCameraTarget();
        const zoom = this.getCameraZoom(isLandscape, targetLevel);
        const offsetZ = this.getCameraOffsetZ(isLandscape, targetLevel);
        const center = this.getCameraCenter(targetLevel);
        const localLookPosition = new Vec3(center.x, center.y, center.z + offsetZ);
        const zDistance = Math.abs(this.baseCameraLocalY - localLookPosition.y) / Math.max(0.001, Math.tan(this.baseCameraPitch));
        const localPosition = new Vec3(localLookPosition.x, this.baseCameraLocalY, localLookPosition.z + zDistance);
        const worldPosition = new Vec3();
        Vec3.transformMat4(worldPosition, localPosition, this.grid.node.getWorldMatrix(new Mat4()));

        this.camera.node.setWorldPosition(worldPosition);
        this.camera.orthoHeight = this.baseOrthoHeight * zoom;
    }

    private getCameraCenter(target: CameraTarget): Vec3 {
        if (!this.grid) {
            return new Vec3();
        }

        const a = this.grid.getBuiltLevelCenter(target.levelIndex);
        const b = this.grid.getBuiltLevelCenter(target.nextLevelIndex);
        if (!a || !b) {
            return a ?? new Vec3();
        }

        return new Vec3(
            this.lerp(a.x, b.x, target.t),
            this.lerp(a.y, b.y, target.t),
            this.lerp(a.z, b.z, target.t),
        );
    }

    private getCameraZoom(isLandscape: boolean, target: CameraTarget): number {
        const a = this.currentLevels[target.levelIndex];
        const b = this.currentLevels[target.nextLevelIndex];
        const zoomA = isLandscape ? a.cameraZoomLandscape : a.cameraZoomPortrait;
        const zoomB = b ? (isLandscape ? b.cameraZoomLandscape : b.cameraZoomPortrait) : zoomA;
        return this.lerp(zoomA, zoomB, target.t);
    }

    private getCameraOffsetZ(isLandscape: boolean, target: CameraTarget): number {
        const a = this.currentLevels[target.levelIndex];
        const b = this.currentLevels[target.nextLevelIndex];
        const offsetA = isLandscape ? (a.cameraOffsetZLandscape ?? 0) : (a.cameraOffsetZPortrait ?? 0);
        const offsetB = b ? (isLandscape ? (b.cameraOffsetZLandscape ?? 0) : (b.cameraOffsetZPortrait ?? 0)) : offsetA;
        return this.lerp(offsetA, offsetB, target.t);
    }

    private getCameraTarget(): CameraTarget {
        if (!this.grid || !this.player) {
            return { levelIndex: 0, nextLevelIndex: 0, t: 0 };
        }

        const z = this.player.position.z;
        for (let i = 0; i < this.grid.getBuiltLevelCount() - 1; i++) {
            const t = this.grid.getLevelTransitionT(i, z);
            if (t === null) continue;
            return { levelIndex: i, nextLevelIndex: i + 1, t };
        }

        const levelIndex = this.grid.getNearestBuiltLevelIndex(z);
        return { levelIndex, nextLevelIndex: levelIndex, t: 0 };
    }

    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    private isLandscape(): boolean {
        const size = view.getVisibleSize();
        return size.width > size.height;
    }
}
