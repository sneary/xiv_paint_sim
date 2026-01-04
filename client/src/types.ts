export interface Player {
    id: string;
    x: number;
    y: number;
    color: number;
    name: string;
    role: 'tank' | 'healer' | 'dps' | 'spectator';
    debuffs: number[];
    limitCut?: number;
}

export interface Point {
    x: number;
    y: number;
}

export interface Stroke {
    id: string;
    color: number;
    points: Point[];
    width: number;
    isEraser?: boolean;
}

export interface TextObject {
    id: string;
    x: number;
    y: number;
    text: string;
    color: number;
    fontSize: number;
}

export interface ArenaConfig {
    shape: 'circle' | 'square';
    width: number;
    height: number;
    showGrid?: boolean;
    waymarkPreset?: string;
}

export interface Page {
    id: string;
    config: ArenaConfig;
    strokes: Stroke[];
    markers: Record<string, Point>;
    text: TextObject[];
}

export interface GameState {
    players: Record<string, Player>;
    currentPageIndex: number;
    pages: Page[];
}

export const initialState: GameState = {
    players: {},
    currentPageIndex: 0,
    pages: [
        {
            id: 'page-1',
            config: {
                shape: 'circle',
                width: 500,
                height: 500,
                showGrid: false
            },
            strokes: [],
            markers: {},
            text: []
        }
    ]
};
