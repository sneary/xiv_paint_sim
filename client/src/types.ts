export interface DebuffEntry {
    id: number;
    source: string;
    timestamp: number;
}

export interface Player {
    id: string;
    x: number;
    y: number;
    color: number;
    name: string;
    role: 'tank' | 'healer' | 'dps' | 'spectator';
    debuffs: number[];
    debuffHistory?: DebuffEntry[];
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
    type?: 'freehand' | 'line' | 'circle' | 'donut' | 'cone' | 'rect';
    anticlockwise?: boolean;
    alpha?: number;
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
    shape: 'circle' | 'square' | 'none';
    width: number;
    height: number;
    showGrid?: boolean;
    waymarkPreset?: string;
    backgroundImageUrl?: string; // URL for background image (e.g. from RaidPlan)
}

export interface Page {
    id: string;
    config: ArenaConfig;
    strokes: Stroke[];
    markers: Record<string, Point>;
    text: TextObject[];
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


// Simulation Types
export interface Prop {
    id: string;
    type: 'circle' | 'rect' | 'cone' | 'donut' | 'text';
    x: number;
    y: number;
    rotation?: number;

    // Interaction
    isDamaging?: boolean;
    damageAmount?: number;

    // Visuals
    color: number;
    alpha: number;
    width?: number; // Radius for circle/donut, Width for rect
    height?: number; // InnerRadius for donut, Height for rect
    text?: string;

    // Lifecycle
    createdAt: number;
    duration?: number;
    tetherTo?: string; // ID of object/player to tether to

    // Physics
    isSolid?: boolean;
    allowKnockback?: boolean;
    attachTo?: string; // Player ID to attach to
    imageUrl?: string; // For image props
    damageOnExpiration?: boolean;
    applyDebuffIdOnExpiration?: number;
    applyDebuffIdOnStart?: number;
    name?: string;
}

export interface SimulationState {
    isRunning: boolean;
    startTime?: number;
    playbackSpeed: number;
    activeTimelineId?: string;
    activeProps: Prop[];
    bossCast?: {
        name: string;
        startTime: number;
        duration: number;
        x?: number; // Percent 0-100 or Pixels
        y?: number;
        scale?: number;
    } | null;
    boss?: {
        id: string;
        x: number;
        y: number;
        opacity: number;
        duration?: number;
        createdAt: number;
    } | null;
}

export interface GameState {

    players: Record<string, Player>;
    currentPageIndex: number;
    pages: Page[];
    chatHistory: ChatMessage[];
    instanceExpiresAt?: number;

    // Active Simulation
    simulation: SimulationState;
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
    ],
    chatHistory: [],
    simulation: {
        isRunning: false,
        playbackSpeed: 1,
        activeProps: [],
        bossCast: null
    }
};
