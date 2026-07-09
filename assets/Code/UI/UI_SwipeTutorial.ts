import { _decorator, Component, EventTouch, input, Input, Sprite, SpriteFrame, Texture2D, tween, Tween, UIOpacity, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UI_SwipeTutorial')
export class UI_SwipeTutorial extends Component {
    @property(UIOpacity)
    public opacity: UIOpacity | null = null;

    @property
    public swipeDistance = 80;

    private touchStart = new Vec2();
    private initialScale = new Vec3();
    private hiddenByPlayer = false;
    private onHidden: (() => void) | null = null;

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.handleTouchStart, this);
        input.off(Input.EventType.TOUCH_END, this.handleTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.handleTouchEnd, this);
        Tween.stopAllByTarget(this.node);
        if (this.opacity) Tween.stopAllByTarget(this.opacity);
        this.unschedule(this.playLoop);
    }

    public play(onHidden: () => void): void {
        if (!this.opacity) {
            console.error('[UI_SwipeTutorial] Missing opacity');
            return;
        }

        this.onHidden = onHidden;
        this.hiddenByPlayer = false;
        this.initialScale = this.node.scale.clone();
        this.node.active = true;

        input.on(Input.EventType.TOUCH_START, this.handleTouchStart, this);
        input.on(Input.EventType.TOUCH_END, this.handleTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.handleTouchEnd, this);

        this.playLoop();
    }

    public hide(): void {
        this.hideInternal(true);
    }

    private playLoop(): void {
        if (this.hiddenByPlayer || !this.opacity) return;

        this.node.setPosition(0, -220, 0);
        this.node.setScale(this.initialScale);
        this.opacity.opacity = 0;

        const pressedScale = new Vec3(this.initialScale.x * 0.82, this.initialScale.y * 0.82, this.initialScale.z);
        tween(this.opacity)
            .to(0.25, { opacity: 255 }, { easing: 'sineOut' })
            .start();
        tween(this.node)
            .delay(0.15)
            .to(0.12, { scale: pressedScale }, { easing: 'quadOut' })
            .to(0.65, { position: new Vec3(0, 0, 0) }, { easing: 'sineInOut' })
            .to(0.12, { scale: this.initialScale }, { easing: 'backOut' })
            .delay(0.25)
            .to(0.12, { scale: pressedScale }, { easing: 'quadOut' })
            .to(0.65, { position: new Vec3(180, 0, 0) }, { easing: 'sineInOut' })
            .to(0.12, { scale: this.initialScale }, { easing: 'backOut' })
            .delay(0.15)
            .call(() => this.hideInternal(false))
            .start();
    }

    private hideInternal(byPlayer: boolean): void {
        if (this.hiddenByPlayer) return;
        this.hiddenByPlayer = byPlayer;
        Tween.stopAllByTarget(this.node);

        if (byPlayer) {
            input.off(Input.EventType.TOUCH_START, this.handleTouchStart, this);
            input.off(Input.EventType.TOUCH_END, this.handleTouchEnd, this);
            input.off(Input.EventType.TOUCH_CANCEL, this.handleTouchEnd, this);
            this.unschedule(this.playLoop);
        }

        if (!this.opacity) {
            if (byPlayer) this.onHidden?.();
            return;
        }

        Tween.stopAllByTarget(this.opacity);
        tween(this.opacity)
            .to(0.25, { opacity: 0 }, { easing: 'sineIn' })
            .call(() => {
                if (byPlayer) {
                    this.onHidden?.();
                    return;
                }
                this.scheduleOnce(this.playLoop, 0.35);
            })
            .start();
    }

    private handleTouchStart(event: EventTouch): void {
        this.touchStart = event.getUILocation();
    }

    private handleTouchEnd(event: EventTouch): void {
        if (event.getUILocation().subtract(this.touchStart).length() >= this.swipeDistance) {
            this.hide();
        }
    }
}
