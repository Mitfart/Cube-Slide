import { Vec2 } from 'cc';
import { CUBE_SHAPE, CUTE_FACE_SHAPE } from './EnemyShapes';

export interface LevelConfig {
    rows: string[];
    tunnelLength: number;

    cameraZoomLandscape: number;
    cameraZoomPortrait: number;
    cameraOffsetZPortrait?: number;
    cameraOffsetZLandscape?: number;

    enemyShape?: number[][];
    enemyPositionStart?: Vec2;
    enemyPositionEnd?: Vec2;
}

export const LEVELS: LevelConfig[] = [
    {
        rows: [
            '#############',
            '#C.........C#',
            '#...........#',
            '#...........#',
            '#...........#',
            '#...........#',
            '#...........#',
            '#...........#',
            '#...........#',
            '#...........#',
            '#...........#',
            '#C.........C#',
            '#############',
        ],
        tunnelLength: 6,
        cameraOffsetZPortrait: 1,
        cameraOffsetZLandscape: -1,
        cameraZoomPortrait: .9,
        cameraZoomLandscape: .55,
        enemyShape: CUBE_SHAPE,
    },
    {
        rows: [
            '###################',
            '#.................#',
            '#......CCCCC......#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#.................#',
            '#...#.........#...#',
            '#####.........#####',
            '###################',
        ],
        tunnelLength: 6,
        cameraOffsetZPortrait: 0,
        cameraOffsetZLandscape: -1.5,
        cameraZoomPortrait: 1.45,
        cameraZoomLandscape: 1,
        enemyShape: CUTE_FACE_SHAPE,
        enemyPositionStart: new Vec2(0, 0),
        enemyPositionEnd: new Vec2(0, 6),
    },
];

// Non-playable end cap after the main level.
export const EMPTY_LEVEL: LevelConfig = {
    rows: [],
    tunnelLength: 0,
    cameraOffsetZPortrait: 0,
    cameraOffsetZLandscape: 0,
    cameraZoomPortrait: 1,
    cameraZoomLandscape: 1,
};
