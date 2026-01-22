export interface Player {
    id: string;
    x: number;
    y: number;
    color: number; // Hex color for paint/ring
    name: string;
    role: 'tank' | 'healer' | 'dps' | 'spectator';
    debuffs: number[];
    limitCut?: number;
}

export interface ArenaConfig {
    shape: 'circle' | 'square' | 'none';
    width: number;
    height: number;
    showGrid?: boolean;
    waymarkPreset?: string;
    backgroundImageUrl?: string;
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
    type?: 'freehand' | 'line' | 'circle' | 'donut' | 'cone' | 'rect';
    anticlockwise?: boolean;
}

export interface TextObject {
    id: string;
    x: number;
    y: number;
    text: string;
    color: number;
    fontSize: number;
}

export interface Page {
    id: string;
    config: ArenaConfig;
    strokes: Stroke[];
    markers: Record<string, Point>;
    text: TextObject[];
    // History of actions for Undo/Redo
    actionHistory?: Action[];
}

export type Action =
    | { type: 'add_stroke'; id: string }
    | { type: 'add_text'; id: string }
    | { type: 'update_stroke'; id: string; prev: Stroke; next: Stroke }
    | { type: 'update_text'; id: string; prev: TextObject; next: TextObject }
    | { type: 'delete_stroke'; prev: Stroke }
    | { type: 'delete_text'; prev: TextObject }
    | { type: 'batch'; actions: Action[] };


export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    color: number;
    timestamp: number;
}

export interface GameState {
    players: Record<string, Player>;
    currentPageIndex: number;
    pages: Page[];
    chatHistory: ChatMessage[];
    instanceExpiresAt?: number;
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
            text: [],
            actionHistory: []
        }
    ],
    chatHistory: []
};
