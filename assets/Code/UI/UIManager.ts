import { _decorator, Camera, Component, instantiate, isValid, Label, Node, Prefab, ProgressBar, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { UI_Screen } from '../../Cocos_Engine/General/Code/ui/UI_Screen';
import { AnalyticEvents, Analytics } from '../Services/Analytics';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {
    @property({ type: Prefab })
    public winScreenPrefab: Prefab | null = null;

    @property({ type: Prefab })
    public failScreenPrefab: Prefab | null = null;

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

    @property(Prefab)
    public hurtUiPrefab: Prefab | null = null;

    @property(Prefab)
    public hurtEffectPrefab: Prefab | null = null;

    @property(Prefab)
    public lifesPrefab: Prefab | null = null;

    @property(Prefab)
    public lifePrefab: Prefab | null = null;

    @property([String])
    public hurtMessages: string[] = [];

    @property(Node)
    public uiRoot: Node | null = null;

    @property(Node)
    public lifesRoot: Node | null = null;

    private endScreen: UI_Screen | null = null;
    private hurtUi: Node | null = null;
    private hurtEffect: Node | null = null;
    private lifes: Node | null = null;
    private readonly lifeNodes: Node[] = [];
    private hurtMessageIndex = 0;
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
    }

    public showFail(): void {
        this.showEndScreen(this.failScreenPrefab, 'failScreenPrefab');
    }

    public hideEndScreen(): void {
        const screen = this.endScreen;
        if (!screen) return;
        this.endScreen = null;
        screen.hide(false, () => {
            this.destroyNode(screen.node);
        });
    }

    public showHurt(): void {
        this.showHurtEffect();
        this.scheduleOnce(() => this.showHurtUi(), 0.12);
    }

    public hideHurt(): void {
        if (!this.hurtUi) {
            return;
        }

        const hurtUi = this.hurtUi;
        this.hurtUi = null;
        const opacity = hurtUi.getComponent(UIOpacity) ?? hurtUi.addComponent(UIOpacity);
        tween(opacity)
            .to(0.12, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                this.destroyNode(hurtUi);
            })
            .start();
    }

    public setupLives(maxLives: number): void {
        this.lifeNodes.length = 0;
        if (!this.lifePrefab) {
            console.error('[UIManager] Missing lifePrefab');
            return;
        }

        this.lifes = this.getSceneLifesRoot() ?? this.lifes;
        if (!this.lifes) {
            if (!this.lifesPrefab) {
                console.error('[UIManager] Missing lifesPrefab');
                return;
            }
            this.lifes = instantiate(this.lifesPrefab);
            this.lifes.setParent(this.uiRoot ?? this.node);
            this.lifes.setPosition(0, 0, 0);
        }
        this.lifes.active = true;
        this.lifes.removeAllChildren();
        for (let i = 0; i < maxLives; i++) {
            const life = instantiate(this.lifePrefab);
            life.setParent(this.lifes);
            this.lifeNodes.push(life);
        }
    }

    public popLife(): void {
        const life = this.lifeNodes.pop();
        if (!life) {
            return;
        }

        const opacity = life.getComponent(UIOpacity) ?? life.addComponent(UIOpacity);
        opacity.opacity = 255;
        tween(life)
            .to(0.12, { scale: new Vec3(1.7, 1.7, 1.7) }, { easing: 'quadOut' })
            .start();
        tween(opacity)
            .to(0.12, { opacity: 0 }, { easing: 'quadOut' })
            .start();
    }

    public collectCoin(coin: Node, camera: Camera): void {
        const worldPosition = coin.worldPosition.clone();
        this.destroyNode(coin);

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
                this.destroyNode(flyCoin);
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
            this.destroyNode(this.endScreen.node);
            this.endScreen = null;
        }
        if (this.hurtUi) {
            this.destroyNode(this.hurtUi);
            this.hurtUi = null;
        }
        if (this.hurtEffect) {
            this.destroyNode(this.hurtEffect);
            this.hurtEffect = null;
        }
        if (this.lifes) {
            if (this.getSceneLifesRoot() === this.lifes) {
                this.lifes.removeAllChildren();
                this.lifes.active = false;
            } else {
                this.destroyNode(this.lifes);
            }
            this.lifes = null;
        }
        this.lifeNodes.length = 0;
        this.hurtMessageIndex = 0;
    }

    private showHurtUi(): void {
        if (!this.hurtUiPrefab) {
            console.error('[UIManager] Missing hurtUiPrefab');
            return;
        }

        if (this.hurtUi) {
            this.destroyNode(this.hurtUi);
        }
        this.hurtUi = instantiate(this.hurtUiPrefab);
        this.hurtUi.setParent(this.uiRoot ?? this.node);
        this.hurtUi.setPosition(0, 0, 0);
        const label = this.hurtUi.getComponentInChildren(Label);
        if (!label) {
            console.error('[UIManager] Missing Label on hurtUiPrefab root');
            return;
        }
        label.string = this.hurtMessages[this.hurtMessageIndex] ?? label.string;
        this.hurtMessageIndex++;
        const opacity = this.hurtUi.getComponent(UIOpacity) ?? this.hurtUi.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity)
            .to(0.08, { opacity: 255 }, { easing: 'quadOut' })
            .start();
    }

    private showHurtEffect(): void {
        if (!this.hurtEffectPrefab) {
            console.error('[UIManager] Missing hurtEffectPrefab');
            return;
        }

        if (this.hurtEffect) {
            this.destroyNode(this.hurtEffect);
        }
        this.hurtEffect = instantiate(this.hurtEffectPrefab);
        this.hurtEffect.setParent(this.uiRoot ?? this.node);
        const opacity = this.hurtEffect.getComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity)
            .to(0.05, { opacity: 255 }, { easing: 'quadOut' })
            .to(0.35, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                if (this.hurtEffect) this.destroyNode(this.hurtEffect);
                this.hurtEffect = null;
            })
            .start();
    }

    private destroyNode(node: Node): void {
        if (!isValid(node, true)) return;
        Tween.stopAllByTarget(node);
        node.destroy();
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
            this.destroyNode(screenNode);
            return;
        }
        this.endScreen.show();
    }

    private getSceneLifesRoot(): Node | null {
        return this.lifesRoot;
    }

}
