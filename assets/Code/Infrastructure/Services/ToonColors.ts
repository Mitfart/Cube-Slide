import { Color, Material } from 'cc';

function shade(color: Color, factor: number, blue: number): Color {
    return new Color(
        Math.max(0, Math.round(color.r * factor - blue * 0.4)),
        Math.max(0, Math.round(color.g * factor - blue * 0.2)),
        Math.min(255, Math.round(color.b * factor + blue)),
        color.a,
    );
}

export function applyToonColor(material: Material, color: Color): void {
    material.setProperty('baseColor', color);
    material.setProperty('mainColor', color);
    material.setProperty('shadeColor1', shade(color, 0.72, 18));
    material.setProperty('shadeColor2', shade(color, 0.48, 34));
}
