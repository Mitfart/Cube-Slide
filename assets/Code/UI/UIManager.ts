import { _decorator, Camera, Color, Component, instantiate, isValid, Label, Layers, Node, Prefab, ProgressBar, Sprite, SpriteFrame, Texture2D, tween, Tween, UIOpacity, UITransform, Vec3, view } from 'cc';
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

    @property(Texture2D)
    public confettiTexture: Texture2D | null = null;

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
    public overlayCeiling: Node | null = null;

    private endScreen: UI_Screen | null = null;
    private confettiEffect: Node | null = null;
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
            if (isValid(screen.node)) screen.node.destroy();
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
                if (isValid(hurtUi)) hurtUi.destroy();
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
        this.setVisibleUiLayer(this.lifes);
        for (let i = 0; i < maxLives; i++) {
            const life = instantiate(this.lifePrefab);
            life.setParent(this.lifes);
            this.setVisibleUiLayer(life);
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
                if (isValid(flyCoin)) flyCoin.destroy();
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
        if (this.hurtUi) {
            this.hurtUi.destroy();
            this.hurtUi = null;
        }
        if (this.hurtEffect) {
            this.hurtEffect.destroy();
            this.hurtEffect = null;
        }
        if (this.lifes) {
            if (this.getSceneLifesRoot() === this.lifes) {
                this.lifes.removeAllChildren();
                this.lifes.active = false;
            } else {
                this.lifes.destroy();
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
            this.hurtUi.destroy();
        }
        this.hurtUi = instantiate(this.hurtUiPrefab);
        this.hurtUi.setParent(this.uiRoot ?? this.node);
        this.setVisibleUiLayer(this.hurtUi);
        this.hurtUi.setPosition(0, 0, 0);
        const label = this.findLabel(this.hurtUi);
        if (!label) {
            console.error('[UIManager] Missing Label in hurtUiPrefab');
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
            this.hurtEffect.destroy();
        }
        this.hurtEffect = instantiate(this.hurtEffectPrefab);
        this.hurtEffect.setParent(this.uiRoot ?? this.node);
        this.setVisibleUiLayer(this.hurtEffect);
        this.hurtEffect.setPosition(0, 0, 0);
        const opacity = this.hurtEffect.getComponent(UIOpacity) ?? this.hurtEffect.addComponent(UIOpacity);
        opacity.opacity = 0;
        tween(opacity)
            .to(0.05, { opacity: 255 }, { easing: 'quadOut' })
            .to(0.35, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                if (this.hurtEffect && isValid(this.hurtEffect)) this.hurtEffect.destroy();
                this.hurtEffect = null;
            })
            .start();
    }

    private setVisibleUiLayer(node: Node): void {
        node.layer = this.levelLabel?.node.layer ?? 33554432;
        for (const child of node.children) {
            this.setVisibleUiLayer(child);
        }
    }

    private findLabel(node: Node): Label | null {
        const label = node.getComponent(Label);
        if (label) {
            return label;
        }
        for (const child of node.children) {
            const childLabel = this.findLabel(child);
            if (childLabel) {
                return childLabel;
            }
        }
        return null;
    }

    private showEndScreen(prefab: Prefab | null, fieldName: string): void {
        this.clearEndEffects();
        if (!prefab) {
            console.error(`[UIManager] Missing ${fieldName}`);
            return;
        }

        const screenNode = instantiate(prefab);
        screenNode.setParent(this.uiRoot ?? this.node);
        this.placeBelowOverlayCeiling(screenNode);
        this.endScreen = screenNode.getComponent(UI_Screen);
        if (!this.endScreen) {
            console.error(`[UIManager] Missing UI_Screen on ${fieldName}`);
            screenNode.destroy();
            return;
        }
        this.endScreen.show();
    }

    private getSceneLifesRoot(): Node | null {
        return this.uiRoot?.getChildByName('Lifes') ?? null;
    }

    private placeBelowOverlayCeiling(node: Node): void {
        if (!this.overlayCeiling || node.parent !== this.overlayCeiling.parent) return;
        node.setSiblingIndex(this.overlayCeiling.getSiblingIndex());
    }

    private playConfettiEffect(): void {
        const root = this.uiRoot ?? this.node;
        if (this.confettiEffect) {
            this.confettiEffect.destroy();
        }
        this.confettiEffect = new Node('UIConfettiRoot');
        this.confettiEffect.layer = Layers.Enum.UI_2D;
        this.confettiEffect.setParent(root);
        this.confettiEffect.setSiblingIndex(9999);
        this.confettiEffect.setPosition(0, 0, 0);
        this.playUiConfetti(this.confettiEffect);
    }

    private playUiConfetti(root: Node): void {
        if (!this.confettiTexture) {
            console.error('[UIManager] Missing confettiTexture');
            return;
        }

        const size = view.getVisibleSize();
        const frame = new SpriteFrame();
        frame.texture = this.confettiTexture;
        const colors = [Color.RED, Color.YELLOW, Color.GREEN, Color.CYAN, Color.MAGENTA, Color.WHITE];
        for (let i = 0; i < 34; i++) {
            const piece = new Node('UIConfetti');
            piece.layer = Layers.Enum.UI_2D;
            piece.setParent(root);
            piece.addComponent(UITransform).setContentSize(9 + Math.random() * 7, 3 + Math.random() * 4);
            piece.setPosition(0, size.height * 0.2, 0);
            const scale = 0.35 + Math.random() * 0.45;
            piece.setScale(scale, scale * (0.45 + Math.random() * 0.5), 1);
            piece.setRotationFromEuler(0, 0, Math.random() * 360);
            piece.setSiblingIndex(9999);

            const sprite = piece.addComponent(Sprite);
            sprite.spriteFrame = frame;
            sprite.color = colors[i % colors.length];
            piece.addComponent(UIOpacity).opacity = 180 + Math.random() * 75;

            const angle = Math.PI * (0.08 + Math.random() * 0.84);
            const power = size.height * (0.22 + Math.random() * 0.22);
            const burst = new Vec3(Math.cos(angle) * power * 1.25, Math.sin(angle) * power, 0);
            const fall = new Vec3((Math.random() - 0.5) * size.width * 0.22, -size.height * (0.32 + Math.random() * 0.22), 0);
            const spin = (Math.random() > 0.5 ? 1 : -1) * (260 + Math.random() * 620);

            tween(piece)
                .delay(Math.random() * 0.08)
                .by(0.32 + Math.random() * 0.12, { position: burst, angle: spin * 0.35 }, { easing: 'quadOut' })
                .by(1.15 + Math.random() * 0.45, { position: fall, angle: spin }, { easing: 'quadIn' })
                .call(() => {
                    if (isValid(piece)) piece.destroy();
                })
                .start();
        }
    }

    private setLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayerRecursively(child, layer);
        }
    }
}
