import { _decorator, Color, Component, Node, Sprite, SpriteFrame, tween, UITransform, Vec2, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('UI_ChooseLevelParticles')
export class UI_ChooseLevelParticles extends Component {
    @property(SpriteFrame)
    public spriteFrame: SpriteFrame | null = null;

    @property
    public count = 26;

    @property(Vec2)
    public particleSizeRange = new Vec2(34, 54);

    @property(Vec2)
    public distanceRange = new Vec2(130, 230);

    @property(Vec2)
    public lifetimeRange = new Vec2(0.75, 1.1);

    @property(Vec2)
    public fadeStartRange = new Vec2(0.55, 0.75);

    @property([Color])
    public colors: Color[] = [
        new Color(255, 255, 255, 255),
        new Color(112, 214, 255, 255),
        new Color(255, 224, 105, 255),
    ];

    public play(cardSizeScale = 1): void {
        if (!this.spriteFrame) {
            console.error('[UI_ChooseLevelParticles] Missing spriteFrame');
            return;
        }

        for (let i = 0; i < this.count; i++) {
            this.spawnParticle(i, cardSizeScale);
        }

        this.scheduleOnce(() => this.node.destroy(), Math.max(this.lifetimeRange.x, this.lifetimeRange.y) + 0.05);
    }

    private spawnParticle(index: number, cardSizeScale: number): void {
        const particle = new Node('Particle');
        particle.layer = this.node.layer;
        particle.setParent(this.node);

        const sprite = particle.addComponent(Sprite);
        sprite.spriteFrame = this.spriteFrame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.color = this.colors[index % this.colors.length] ?? Color.WHITE;
        const particleSize = this.randomRange(this.particleSizeRange);
        particle.addComponent(UITransform).setContentSize(particleSize, particleSize);

        const angle = Math.PI * 2 * index / this.count + (Math.random() - 0.5) * 0.35;
        const startRadius = 45 * cardSizeScale * Math.random();
        const distance = this.randomRange(this.distanceRange);
        const travel = distance * cardSizeScale;
        const start = new Vec3(Math.cos(angle) * startRadius, Math.sin(angle) * startRadius, 0);
        const end = new Vec3(Math.cos(angle) * travel, Math.sin(angle) * travel, 0);
        const scale = 0.85 + Math.random() * 0.45;

        const lifetime = this.randomRange(this.lifetimeRange);
        const fadeStart = this.randomRange(this.fadeStartRange);

        particle.setPosition(start);
        particle.setScale(scale, scale, scale);
        tween(particle)
            .to(lifetime, { position: end }, { easing: 'backOut' })
            .start();
        tween(sprite)
            .delay(lifetime * fadeStart)
            .to(lifetime * (1 - fadeStart), { color: new Color(sprite.color.r, sprite.color.g, sprite.color.b, 0) }, { easing: 'quadIn' })
            .start();
    }

    private randomRange(range: Vec2): number {
        return range.x + Math.random() * (range.y - range.x);
    }
}
