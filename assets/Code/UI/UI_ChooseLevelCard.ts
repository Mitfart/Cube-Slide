import { _decorator, Component, instantiate, Node, Prefab, Sprite, SpriteFrame, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { ParentSizeScaler } from './ParentSizeScaler';
import { UI_ChooseLevelParticles } from './UI_ChooseLevelParticles';
const { ccclass, property } = _decorator;

@ccclass('UI_ChooseLevelCard')
export class UI_ChooseLevelCard extends Component {
    @property(UIOpacity)
    public coverOpacity: UIOpacity | null = null;

    @property(Sprite)
    public bannerSprite: Sprite | null = null;

    @property(ParentSizeScaler)
    public bannerScaler: ParentSizeScaler | null = null;

    @property(UIOpacity)
    public light: UIOpacity | null = null;

    @property(Prefab)
    public chooseParticlesPrefab: Prefab | null = null;

    private index = -1;
    private onSelected: ((index: number) => void) | null = null;

    public initialize(index: number, onSelected: (index: number) => void): void {
        this.deinitialize();
        this.index = index;
        this.onSelected = onSelected;
        this.node.on(Node.EventType.TOUCH_END, this.handleTouch, this);
    }

    public deinitialize(): void {
        this.node.off(Node.EventType.TOUCH_END, this.handleTouch, this);
        Tween.stopAllByTarget(this.node);
        this.onSelected = null;
        this.index = -1;
    }

    public normalize(): void {
        if (this.coverOpacity) this.coverOpacity.node.active = false;
        if (this.bannerSprite) this.bannerSprite.node.active = false;
        this.hideGuideLight();
    }

    public hideResult(): void {
        this.normalize();
    }

    public showResult(spriteFrame: SpriteFrame, animated: boolean): void {
        if (!this.coverOpacity) {
            console.error('[UI_ChooseLevelCard] Missing coverOpacity');
            return;
        }
        if (!this.bannerSprite) {
            console.error('[UI_ChooseLevelCard] Missing bannerSprite');
            return;
        }

        this.coverOpacity.node.active = true;
        this.coverOpacity.opacity = 125;
        this.bannerSprite.node.active = true;
        this.bannerSprite.spriteFrame = spriteFrame;

        if (animated) this.playBannerScaleIn();
    }

    public block() {
        this.deinitialize();
        this.hideGuideLight();
    }

    public playGuideLight(onComplete: () => void): boolean {
        if (!this.light) {
            console.error('[UI_ChooseLevelCard] Missing light');
            return false;
        }

        Tween.stopAllByTarget(this.light);
        this.light.node.active = true;
        this.light.opacity = 0;
        tween(this.light)
            .to(0.65, { opacity: 210 }, { easing: 'sineInOut' })
            .delay(0.8)
            .to(0.65, { opacity: 0 }, { easing: 'sineInOut' })
            .delay(0.45)
            .call(() => {
                if (this.light) this.light.node.active = false;
                onComplete();
            })
            .start();

        return true;
    }

    public hideGuideLight(): void {
        if (!this.light) return;

        Tween.stopAllByTarget(this.light);
        this.light.opacity = 0;
        this.light.node.active = false;
    }

    private handleTouch(): void {
        this.node.off(Node.EventType.TOUCH_END, this.handleTouch, this);
        this.onSelected?.(this.index);
        this.playChooseParticles();
        this.playChooseBounce();
    }

    private playChooseParticles(): void {
        if (!this.chooseParticlesPrefab) {
            console.error('[UI_ChooseLevelCard] Missing chooseParticlesPrefab');
            return;
        }

        const parent = this.node.parent?.parent ?? this.node.parent;
        if (!parent) return;

        const burst = instantiate(this.chooseParticlesPrefab);
        this.setLayerRecursively(burst, this.node.layer);
        burst.setParent(parent);
        burst.setWorldPosition(this.node.worldPosition);
        burst.setSiblingIndex(9999);

        const size = this.node.getComponent(UITransform)?.contentSize;
        const scale = size ? Math.min(size.width, size.height) / 300 : 1;
        burst.getComponent(UI_ChooseLevelParticles)?.play(scale);
    }

    private setLayerRecursively(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) {
            this.setLayerRecursively(child, layer);
        }
    }

    private playChooseBounce(): void {
        const targetScale = this.node.scale.clone();
        const upScale = new Vec3(targetScale.x * 1.16, targetScale.y * 1.16, targetScale.z);

        Tween.stopAllByTarget(this.node);
        tween(this.node)
            .to(0.35, { scale: upScale }, { easing: 'quadOut' })
            .to(0.55, { scale: targetScale }, { easing: 'backOut' })
            .start();
    }

    private playBannerScaleIn(): void {
        if (!this.bannerSprite) return;

        const banner = this.bannerSprite.node;
        this.bannerScaler?.updateScale();
        const targetScale = banner.scale.clone();

        Tween.stopAllByTarget(banner);
        if (this.bannerScaler) this.bannerScaler.enabled = false;
        banner.setScale(Vec3.ZERO);
        tween(banner)
            .to(0.25, { scale: targetScale }, { easing: 'backOut' })
            .call(() => {
                if (!this.bannerScaler) return;
                this.bannerScaler.enabled = true;
                this.bannerScaler.updateScale();
            })
            .start();
    }
}
