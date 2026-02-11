export interface DebuffEntry {
    id: number;
    source: string;
    timestamp: number;
}

export interface Player {
    id: string;
    x: number;
    y: number;
    color: number; // Hex color for paint/ring
    name: string;
    role: 'tank' | 'healer' | 'dps' | 'spectator';
    debuffs: number[];
    debuffHistory?: any[]; // Keep flexible
    limitCut?: number;
    sessionId?: string;
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


// Simulation Types
export interface Prop {
    id: string;
    type: 'circle' | 'rect' | 'cone' | 'donut' | 'text';
    x: number;
    y: number;
    rotation?: number;
    name?: string;

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
    attachTo?: string;
    imageUrl?: string;
    damageOnExpiration?: boolean;
    applyDebuffIdOnExpiration?: number;
    applyDebuffIdOnStart?: number;
}

export type ScriptedEventType =
    | 'spawn_prop'
    | 'spawn_target_prop' // New: Spawn relative to target
    | 'remove_prop'
    | 'clear_props'
    | 'arena_config'
    | 'play_sound'
    | 'knockback'
    | 'boss_cast'
    | 'spawn_boss'
    | 'countdown'
    | 'spawn_random_props'
    | 'apply_target_debuff'
    | 'remove_target_debuff'
    | 'assign_tether';

export interface ScriptedEvent {
    time: number; // Offset in ms
    type: ScriptedEventType;
    data: any;
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
        x?: number;
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
            text: [],
            actionHistory: []
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
