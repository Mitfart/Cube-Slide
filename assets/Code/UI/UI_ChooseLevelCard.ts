import { _decorator, Component, Node, Sprite, SpriteFrame, tween, Tween, UIOpacity, Vec3 } from 'cc';
import { ParentSizeScaler } from './ParentSizeScaler';
const { ccclass, property } = _decorator;

@ccclass('UI_ChooseLevelCard')
export class UI_ChooseLevelCard extends Component {
    @property(UIOpacity)
    public coverOpacity: UIOpacity | null = null;

    @property(Sprite)
    public bannerSprite: Sprite | null = null;

    @property(ParentSizeScaler)
    public bannerScaler: ParentSizeScaler | null = null;

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
        this.onSelected = null;
        this.index = -1;
    }

    public normalize(): void {
        if (this.coverOpacity) this.coverOpacity.node.active = false;
        if (this.bannerSprite) this.bannerSprite.node.active = false;
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
    }


    private handleTouch(): void {
        this.onSelected?.(this.index);
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
