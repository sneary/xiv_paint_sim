export interface Player {
    id: string;
    x: number;
    y: number;
    color: number; // Hex color for paint/ring
    name: string;
    role: 'tank' | 'healer' | 'dps' | 'spectator';
    debuffs: number[];
    limitCut?: number; // 1-8, for Limit Cut mechanic
}

export interface ArenaConfig {
    shape: 'circle' | 'square';
    width: number;
    height: number;
    showGrid?: boolean;
    waymarkPreset?: string;
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

export interface GameState {
    players: Record<string, Player>;
    config: ArenaConfig;
    strokes: Stroke[];
    markers: Record<string, Point>;
    text: TextObject[];
}

export const initialState: GameState = {
    players: {},
    config: {
        shape: 'circle',
        width: 500,
        height: 500,
        showGrid: false
    },
    strokes: [],
    markers: {},
    text: []
};
