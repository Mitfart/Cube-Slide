import { _decorator, Camera, Component, instantiate, Label, Node, Prefab, ProgressBar, tween, Tween, Vec3 } from 'cc';
import { UI_Screen } from '../../Cocos_Engine/General/Code/ui/UI_Screen';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property({ type: Prefab })
    public winScreenPrefab: Prefab | null = null;

    @property({ type: Prefab })
    public failScreenPrefab: Prefab | null = null;

    @property({ type: Prefab })
    public confettiEffectPrefab: Prefab | null = null;

    @property(ProgressBar)
    public levelProgressBar: ProgressBar | null = null;

    @property(Label)
    public levelLabel: Label | null = null;

    @property
    public levelLabelPrefix = '';

    @property
    public levelLabelPostfix = '';

    @property(Node)
    public coinTarget: Node | null = null;

    @property(Label)
    public coinsLabel: Label | null = null;

    @property(Prefab)
    public coinFlyPrefab: Prefab | null = null;

    @property(Node)
    public uiRoot: Node | null = null;

    private endScreen: UI_Screen | null = null;
    private confettiEffect: Node | null = null;
    private targetProgress = -1;
    private coins = 0;

    public reset(): void {
        this.coins = 0;
        this.updateCoinsLabel();
        this.setLevelProgress(1, 0, false);
        this.clearEndEffects();
    }

    public showWin(): void {
        this.showEndScreen(this.winScreenPrefab, 'winScreenPrefab');
        this.playConfettiEffect();
    }

    public showFail(): void {
        this.showEndScreen(this.failScreenPrefab, 'failScreenPrefab');
    }

    public collectCoin(coin: Node, camera: Camera): void {
        const worldPosition = coin.worldPosition.clone();
        coin.destroy();

        if (!this.coinTarget) {
            console.error('[UIManager] Missing coinTarget');
            return;
        }
        if (!this.coinFlyPrefab) {
            console.error('[UIManager] Missing coinFlyPrefab');
            this.addCoin();
            return;
        }

        const parent = this.coinTarget.parent ?? this.node;
        const flyCoin = instantiate(this.coinFlyPrefab);
        const start = camera.convertToUINode(worldPosition, parent);
        const target = this.coinTarget.position;
        const state = { t: 0 };

        flyCoin.setParent(parent);
        flyCoin.setPosition(start);
        flyCoin.setScale(0.65, 0.65, 0.65);
        tween(state)
            .to(0.48, { t: 1 }, {
                easing: 'sineInOut',
                onUpdate: () => this.updateFlyCoin(flyCoin, start, target, state.t),
            })
            .call(() => {
                flyCoin.destroy();
                this.addCoin();
            })
            .start();
    }

    public setLevelProgress(levelNumber: number, progress: number, animate = true): void {
        if (!this.levelProgressBar) {
            console.error('[UIManager] Missing levelProgressBar');
            return;
        }
        if (!this.levelLabel) {
            console.error('[UIManager] Missing levelLabel');
            return;
        }

        const target = Math.max(0, Math.min(1, progress));
        this.levelLabel.string = `${this.levelLabelPrefix}${levelNumber}${this.levelLabelPostfix}`;
        if (this.targetProgress === target) {
            return;
        }

        this.targetProgress = target;
        Tween.stopAllByTarget(this.levelProgressBar);
        if (!animate) {
            this.levelProgressBar.progress = target;
            return;
        }
        tween(this.levelProgressBar)
            .to(0.15, { progress: target }, { easing: 'sineOut' })
            .start();
    }

    private addCoin(): void {
        this.coins++;
        this.updateCoinsLabel();
    }

    private updateFlyCoin(coin: Node, start: Vec3, target: Vec3, t: number): void {
        const arc = Math.sin(t * Math.PI) * 55;
        const scale = t < 0.5 ? 0.65 + t * 0.7 : 1 - (t - 0.5) * 0.2;
        coin.setPosition(
            start.x + (target.x - start.x) * t,
            start.y + (target.y - start.y) * t + arc,
            0,
        );
        coin.setScale(scale, scale, scale);
    }

    private updateCoinsLabel(): void {
        if (!this.coinsLabel) {
            console.error('[UIManager] Missing coinsLabel');
            return;
        }

        this.coinsLabel.string = `${this.coins}`;
    }

    private clearEndEffects(): void {
        if (this.endScreen) {
            this.endScreen.node.destroy();
            this.endScreen = null;
        }
        if (this.confettiEffect) {
            this.confettiEffect.destroy();
            this.confettiEffect = null;
        }
    }

    private showEndScreen(prefab: Prefab | null, fieldName: string): void {
        this.clearEndEffects();
        if (!prefab) {
            console.error(`[UIManager] Missing ${fieldName}`);
            return;
        }

        const screenNode = instantiate(prefab);
        screenNode.setParent(this.uiRoot ?? this.node);
        this.endScreen = screenNode.getComponent(UI_Screen);
        if (!this.endScreen) {
            console.error(`[UIManager] Missing UI_Screen on ${fieldName}`);
            screenNode.destroy();
            return;
        }
        this.endScreen.show();
    }

    private playConfettiEffect(): void {
        if (!this.confettiEffectPrefab) {
            console.error('[UIManager] Missing confettiEffectPrefab');
            return;
        }

        this.confettiEffect = instantiate(this.confettiEffectPrefab);
        this.confettiEffect.setParent(this.uiRoot ?? this.node);
        this.confettiEffect.setPosition(0, 0, 0);
        this.confettiEffect.setScale(new Vec3(5, 5, 5));
    }

}
