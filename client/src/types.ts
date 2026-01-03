export interface Player {
    id: string;
    x: number;
    y: number;
    role: 'tank' | 'healer' | 'dps' | 'spectator';
    name: string;
    color: number;
    debuffs: number[];
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
    isComplete?: boolean; // Potentially for optimization or logic
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
