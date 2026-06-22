import { Vec2 } from 'cc';
import { BANANA_SHAPE, CUTE_FACE_SHAPE, LEVEL_ENEMY_COLORS, PARROT_SHAPE, PIG_SHAPE } from './EnemyShapes';

export interface LevelConfig {
    rows: string[];
    tunnelLength: number;

    cameraZoomLandscape: number;
    cameraZoomPortrait: number;
    cameraOffsetZPortrait?: number;
    cameraOffsetZLandscape?: number;

    enemyShape?: number[][];
    enemyColors?: Record<number, string>;
    enemyPositionStart?: Vec2;
    enemyPositionEnd?: Vec2;
}

function createEnemyLevel(enemyShape: number[][], enemyColors?: Record<number, string>): LevelConfig {
    const width = makeOdd(getShapeWidth(enemyShape) + 2);
    const height = makeOdd(enemyShape.length + 14);
    const wall = '#'.repeat(width);
    const floor = `#${'.'.repeat(width - 2)}#`;
    const coinFloor = width >= 4 ? `#C${'.'.repeat(width - 4)}C#` : floor;

    return {
        rows: [wall, coinFloor, ...Array.from({ length: height - 4 }, () => floor), coinFloor, wall],
        tunnelLength: 6,
        cameraOffsetZPortrait: 0,
        cameraOffsetZLandscape: -1.5,
        cameraZoomPortrait: Math.max(1, height / 16),
        cameraZoomLandscape: Math.max(0.8, width / 19),
        enemyShape,
        enemyColors,
        enemyPositionStart: new Vec2(0, 0),
        enemyPositionEnd: new Vec2(0, 12),
    };
}

function getShapeWidth(shape: number[][]): number {
    return shape.reduce((max, row) => Math.max(max, row.length), 0);
}

function makeOdd(value: number): number {
    return value % 2 === 0 ? value + 1 : value;
}

export const LEVELS: LevelConfig[] = [
    createEnemyLevel(PIG_SHAPE, LEVEL_ENEMY_COLORS),
    createEnemyLevel(BANANA_SHAPE, LEVEL_ENEMY_COLORS),
    createEnemyLevel(PARROT_SHAPE, LEVEL_ENEMY_COLORS),
    createEnemyLevel(CUTE_FACE_SHAPE, { 1: LEVEL_ENEMY_COLORS[9] }),
];
