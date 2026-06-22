import { instantiate, Node, Prefab, tween, Vec3 } from 'cc';

export interface BurstOptions {
    count: number;
    scale: number;
    minRadius: number;
    maxRadius: number;
    minHeight: number;
    maxHeight: number;
    minDuration: number;
    maxDuration: number;
    onSpawn?: (node: Node) => void;
}

export function spawnPrefabBurst(prefab: Prefab, parent: Node | null, origin: Vec3, options: BurstOptions, delay = 0): void {
    for (let i = 0; i < options.count; i++) {
        const particle = instantiate(prefab);
        particle.setParent(parent);
        particle.setWorldPosition(origin);
        particle.setScale(options.scale, options.scale, options.scale);
        options.onSpawn?.(particle);

        const angle = Math.random() * Math.PI * 2;
        const radius = options.minRadius + Math.random() * (options.maxRadius - options.minRadius);
        const target = new Vec3(
            particle.position.x + Math.cos(angle) * radius,
            particle.position.y + options.minHeight + Math.random() * (options.maxHeight - options.minHeight),
            particle.position.z + Math.sin(angle) * radius,
        );

        tween(particle)
            .delay(delay)
            .to(options.minDuration + Math.random() * (options.maxDuration - options.minDuration), { position: target, scale: new Vec3(0, 0, 0) }, { easing: 'quadOut' })
            .call(() => particle.destroy())
            .start();
    }
}
