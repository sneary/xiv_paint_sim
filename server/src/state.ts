export interface Player {
    id: string;
    x: number;
    y: number;
    color: number; // Hex color for paint/ring
    name: string;
    role: 'tank' | 'healer' | 'dps';
}

export interface ArenaConfig {
    shape: 'circle' | 'square';
    width: number;
    height: number;
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

export interface GameState {
    players: Record<string, Player>;
    config: ArenaConfig;
    strokes: Stroke[];
}

export const initialState: GameState = {
    players: {},
    config: {
        shape: 'circle',
        width: 500,
        height: 500,
    },
    strokes: [],
};
