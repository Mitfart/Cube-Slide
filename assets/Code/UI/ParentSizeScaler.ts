import { _decorator, Component, UITransform, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('ParentSizeScaler')
export class ParentSizeScaler extends Component {
    @property
    public scaleByWidth = true;

    @property
    public scaleByHeight = false;

    private readonly baseScale = new Vec3();
    private baseParentWidth = 0;
    private baseParentHeight = 0;

    protected onLoad(): void {
        this.baseScale.set(this.node.scale);
        this.captureBaseParentSize();
        this.applyScale();
    }

    protected update(): void {
        this.updateScale();
    }

    public updateScale(): void {
        this.applyScale();
    }

    private captureBaseParentSize(): void {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) {
            console.error('[ParentSizeScaler] Missing parent UITransform');
            this.enabled = false;
            return;
        }

        this.baseParentWidth = parentTransform.width;
        this.baseParentHeight = parentTransform.height;

        if ((this.scaleByWidth && this.baseParentWidth <= 0) || (this.scaleByHeight && this.baseParentHeight <= 0)) {
            console.error('[ParentSizeScaler] Parent size must be greater than 0');
            this.enabled = false;
        }
    }

    private applyScale(): void {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;

        let ratio = 1;
        if (this.scaleByWidth && this.scaleByHeight) {
            ratio = Math.min(parentTransform.width / this.baseParentWidth, parentTransform.height / this.baseParentHeight);
        } else if (this.scaleByWidth) {
            ratio = parentTransform.width / this.baseParentWidth;
        } else if (this.scaleByHeight) {
            ratio = parentTransform.height / this.baseParentHeight;
        }

        this.node.setScale(this.baseScale.x * ratio, this.baseScale.y * ratio, this.baseScale.z * ratio);
    }
}
