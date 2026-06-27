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
    playerColor?: string;
}

const STATIC_LEVEL_ROWS = [
    '#########################',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#.......................#',
    '#....#.............#....#',
    '######......p......######',
    '#########################',
];

function createLevel(enemyShape: number[][], enemyColors?: Record<number, string>, playerColor?: string): LevelConfig {
    return {
        rows: STATIC_LEVEL_ROWS,
        tunnelLength: 6,
        cameraOffsetZPortrait: 0,
        cameraOffsetZLandscape: -1.5,
        cameraZoomPortrait: 33 / 16,
        cameraZoomLandscape: 25 / 19,
        enemyShape,
        enemyColors,
        enemyPositionStart: new Vec2(0, 0),
        enemyPositionEnd: new Vec2(0, 12),
        playerColor,
    };
}

export const LEVELS: LevelConfig[] = [
    createLevel(PIG_SHAPE, LEVEL_ENEMY_COLORS),
    createLevel(BANANA_SHAPE, LEVEL_ENEMY_COLORS),
    createLevel(PARROT_SHAPE, LEVEL_ENEMY_COLORS),
    createLevel(CUTE_FACE_SHAPE, { 1: LEVEL_ENEMY_COLORS[9] }, '#ff60ee'),
];
