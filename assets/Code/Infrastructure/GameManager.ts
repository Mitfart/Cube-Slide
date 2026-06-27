import { _decorator, Button, Camera, Color, Component, instantiate, Mat4, Node, ParticleSystem, Prefab, SpriteRenderer, Vec2, Vec3, view } from 'cc';
import { LevelConfig, LEVELS } from '../Gameplay/Levels';
import { GridController } from './GridController';
import { EnemyController } from '../Enemy/EnemyController';
import { PlayerController } from '../Player/PlayerController';
import { Analytics, AnalyticEvents } from './Services/Analytics';
import { SoundManager } from './Services/SoundManager';
import { UIManager } from '../UI/UIManager';
import { UI_ChooseLevelController } from '../UI/UI_ChooseLevelController';
import { UI_GameDownloadBtn } from '../../Cocos_Engine/General/Code/export/UI_GameDownloadBtn';
const { ccclass, property } = _decorator;
interface CameraTarget {
    levelIndex: number;
    nextLevelIndex: number;
    t: number;
}

@ccclass('LevelViewConfig')
class LevelViewConfig {
    @property(Prefab)
    public prefab: Prefab | null = null;

    @property
    public paddingPixels = 0;

    @property
    public bottomPaddingPixels = 0;
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

    @property(UI_ChooseLevelController)
    public chooseLevelUI: UI_ChooseLevelController | null = null;

    @property
    public resultScreenDuration = 1.5;

    @property
    public minimumDragDistance = 40;

    @property([LevelViewConfig])
    public levelViews: LevelViewConfig[] = [];

    private player: Node | null = null;
    private readonly enemies: EnemyController[] = [];
    private readonly spawnedLevelViews: Node[] = [];
    private ended = false;
    private currentLevels: LevelConfig[] = [];
    private baseOrthoHeight = 0;
    private baseCameraLocalY = 0;
    private baseCameraPitch = 0;
    private currentLevelIndex = -1;

    private hasEmitted25Percent: boolean = false;
    private hasEmitted50Percent: boolean = false;
    private hasEmitted75Percent: boolean = false;

    protected onLoad(): void {
        Analytics.emit(AnalyticEvents.LOADING);
        
        this.node._persistNode = true;
    }

    protected start(): void {
        Analytics.emit(AnalyticEvents.LOADED);
        this.startGame();
        Analytics.emit(AnalyticEvents.DISPLAYED);
    }

    public startGame(): void {
        if (this.chooseLevelUI) {
            this.clearLevel();
            this.chooseLevelUI.setGameManager(this);
            this.chooseLevelUI.show();
            return;
        }

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
        this.currentLevelIndex = LEVELS.indexOf(level);
        this.buildLevels([level]);
        
        Analytics.emit(AnalyticEvents.CHALLENGE_STARTED);
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
        this.grid.setSoundManager(this.soundManager);
        this.grid.onCoinCollected = coin => {
            if (!this.camera || !this.uiManager) {
                coin.destroy();
                return;
            }
            this.uiManager.collectCoin(coin, this.camera);
        };
        this.grid.buildLevels(levels);
        this.spawnLevelViews(levels);
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
        this.clearLevelViews();
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
        const playerColor = this.parseColor(level.playerColor);
        if (playerColor) playerController.playerColor = playerColor;
        playerController.setGrid(this.grid);
        this.uiManager?.setupLives(playerController.maxLives);
    }

    private parseColor(hex: string | undefined): Color | null {
        if (!hex) return null;
        const match = /^#?([0-9a-f]{6})$/i.exec(hex);
        if (!match) {
            console.error('[GameManager] Invalid playerColor');
            return null;
        }
        const value = Number.parseInt(match[1], 16);
        return new Color((value >> 16) & 255, (value >> 8) & 255, value & 255, 255);
    }

    private spawnLevelViews(levels: LevelConfig[]): void {
        this.clearLevelViews();
        if (!this.grid) {
            console.error('[GameManager] Missing grid');
            return;
        }

        const defaultConfig = this.levelViews[0];
        if (!defaultConfig?.prefab) {
            console.error('[GameManager] Missing levelView prefab');
            return;
        }
        for (let i = 0; i < levels.length; i++) {
            const center = this.grid.getBuiltLevelCenter(i);
            if (!center) continue;

            const config = this.levelViews[i] ?? defaultConfig;
            const prefab = config.prefab ?? defaultConfig.prefab;
            const node = instantiate(prefab);
            node.name = `LevelView_${i}`;
            node.setParent(this.grid.node, false);

            const sprite = node.getComponent(SpriteRenderer) ?? node.getComponentInChildren(SpriteRenderer);
            const spriteFrame = sprite?.spriteFrame;
            const spriteWidth = spriteFrame?.width ?? 0;
            const spriteHeight = spriteFrame?.height ?? 0;

            if (spriteWidth <= 0 || spriteHeight <= 0) {
                console.error('[GameManager] Missing LevelView SpriteRenderer spriteFrame size');
                node.destroy();
                continue;
            }

            const contentWidthPixels = spriteWidth - config.paddingPixels * 2;
            if (contentWidthPixels <= 0) {
                console.error('[GameManager] LevelView padding is larger than spriteFrame width');
                node.destroy();
                continue;
            }

            const scale = this.getLevelWidth(levels[i]) / (contentWidthPixels / 100);
            const bottomOffset = (spriteHeight / 2 - config.bottomPaddingPixels) / 100 * scale;
            node.setPosition(center.x, center.y, this.getLevelBottom(levels[i], center) - bottomOffset + 0.5);
            node.setScale(scale, scale, scale);
            this.spawnedLevelViews.push(node);
        }
    }

    private clearLevelViews(): void {
        for (const view of this.spawnedLevelViews) {
            view.destroy();
        }
        this.spawnedLevelViews.length = 0;
    }

    private getLevelWidth(level: LevelConfig): number {
        return level.rows.reduce((width, row) => Math.max(width, row.replace(/#/g, '').length), 0);
    }

    private getLevelBottom(level: LevelConfig, center: Vec3): number {
        return center.z + (level.rows.length - 3) / 2;
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
            enemy.onDestroyed = (cell: Vec2) => {
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

        this.grid.fillRemainingLevel(cell, fillPrefab, playerController.getFillColor());
        playerController.waitForLevelComplete(playerController.getGridCell() ?? cell);
    }

    private playConfetti(): void {
        if (!this.confettiEffectPrefab) {
            console.error('[GameManager] Missing confettiEffectPrefab');
            return;
        }
        const effect = instantiate(this.confettiEffectPrefab);
        effect.setParent(this.node.parent ?? this.node);
        effect.setPosition(0, this.camera.node.worldPosition.y - 5, 10);
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
        this.chooseLevelUI?.setLevelResult(this.currentLevelIndex, false);
        this.uiManager.showFail();
        
        this.scheduleOnce(() => {
            this.uiManager?.hideEndScreen();
            this.clearLevel();
            this.chooseLevelUI?.setGameManager(this);
            this.chooseLevelUI?.show(() => {
                this.enableDownloadEndCard();
                this.chooseLevelUI?.blockInput();
                Analytics.emit(AnalyticEvents.ENDCARD_SHOWN);
            });
        }, this.resultScreenDuration);

        Analytics.emit(AnalyticEvents.CHALLENGE_FAILED);
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
            this.soundManager.playWin(this.player.worldPosition);
        }
        this.chooseLevelUI?.setLevelResult(this.currentLevelIndex, true);
        this.uiManager.showWin();

        this.scheduleOnce(() => {
            this.uiManager?.hideEndScreen();
            
            this.clearLevel();
            this.chooseLevelUI.setGameManager(this);
            this.chooseLevelUI.show(() => { 
                this.enableDownloadEndCard();
                this.chooseLevelUI.blockInput();
                Analytics.emit(AnalyticEvents.ENDCARD_SHOWN); 
            });
        }, this.resultScreenDuration);
    
        Analytics.emit(AnalyticEvents.CHALLENGE_SOLVED);
    }

    private enableDownloadEndCard(): void {
        if (!this.chooseLevelUI) {
            console.error('[GameManager] Missing chooseLevelUI');
            return;
        }

        this.chooseLevelUI.getComponent(Button) ?? this.chooseLevelUI.addComponent(Button);
        const download = this.chooseLevelUI.getComponent(UI_GameDownloadBtn) ?? this.chooseLevelUI.addComponent(UI_GameDownloadBtn);
        download.enabled = false;
        download.enabled = true;
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
        if (!playerController || !playerController.node.activeInHierarchy) {
            return;
        }

        const playerCells = playerController.getTouchedCells();
        for (const enemy of this.enemies) {
            for (const cell of enemy.getOccupiedCells()) {
                const trailHit = this.grid.hasTrailGrid(cell.x, cell.y);
                const bodyHit = playerCells.some(playerCell => cell.x === playerCell.x && cell.y === playerCell.y);
                if (trailHit || bodyHit) {
                    this.handlePlayerHit(playerController);
                    return;
                }
            }
        }
    }

    private handlePlayerHit(playerController: PlayerController | null | undefined): void {
        if (!playerController) {
            console.error('[GameManager] Missing PlayerController');
            return;
        }

        this.soundManager?.playEnemyHit(playerController.node.worldPosition);
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

        playerController.hideForDamage();
        this.grid.clearPaintForLevel(hitCell, this.grid.localToGrid(spawn));
        this.uiManager.showHurt();
        this.scheduleOnce(() => playerController.respawnAfterDamageAt(spawn), 0.45);
        this.scheduleOnce(() => this.uiManager?.hideHurt(), 1.7);
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
        const levelProgress = this.grid.getLevelProgress(levelIndex);
    
        this.uiManager.setLevelProgress(levelIndex + 1, levelProgress);

        this.scheduleOnce(() => {
            if (levelProgress >= .25 && !this.hasEmitted25Percent) {
                Analytics.emit(AnalyticEvents.CHALLENGE_PASS_25);
                this.hasEmitted25Percent = true;
            }
        }, 0);
        
        this.scheduleOnce(() => {
            if (levelProgress >= .5 && !this.hasEmitted50Percent) {
                Analytics.emit(AnalyticEvents.CHALLENGE_PASS_50);
                this.hasEmitted50Percent = true;
            }
        }, .05);

        this.scheduleOnce(() => {
            if (levelProgress >= .75 && !this.hasEmitted75Percent) {
                Analytics.emit(AnalyticEvents.CHALLENGE_PASS_75);
                this.hasEmitted75Percent = true;
            }
        }, .1);
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
