import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(cors());

// Serve static files from the client build
// In production (dist/index.js), this goes up two levels to find client/dist
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for now, lock down later
        methods: ["GET", "POST"]
    }
});

import { GameState, initialState, ArenaConfig } from './state';

const gameState: GameState = { ...initialState };

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // gameState.players[socket.id] = { ... } -- Removed auto-spawn

    socket.on('joinGame', (data: { name: string, color: number, role: 'tank' | 'healer' | 'dps' | 'spectator' }) => {
        // Validation
        const players = Object.values(gameState.players);
        const nameTaken = players.some(p => p.name.toLowerCase() === data.name.toLowerCase());
        if (nameTaken) {
            socket.emit('joinError', 'Name is already taken');
            return;
        }

        if (data.role !== 'spectator') {
            const colorTaken = players.some(p => p.role !== 'spectator' && p.color === data.color);
            if (colorTaken) {
                socket.emit('joinError', 'Color is already taken');
                return;
            }
        }

        gameState.players[socket.id] = {
            id: socket.id,
            x: 400,
            y: 300,
            color: data.color || 0xffffff,
            name: data.name,
            role: data.role || 'dps',
            debuffs: []
        };
        io.emit('stateUpdate', gameState);
    });

    socket.on('move', (pos: { x: number; y: number }) => {
        if (gameState.players[socket.id]) {
            gameState.players[socket.id].x = pos.x;
            gameState.players[socket.id].y = pos.y;
            io.emit('stateUpdate', gameState);
        }
    });

    socket.on('updateConfig', (newConfig: any) => {
        // Basic validation could go here

        // If waymarkPreset is 'waymarks-1', apply preset markers
        if (newConfig.waymarkPreset === 'waymarks-1') {
            const cx = 400;
            const cy = 300;
            gameState.markers = {
                'A': { x: cx, y: cy - 150 },      // North
                'B': { x: cx + 150, y: cy },      // East
                'C': { x: cx, y: cy + 150 },      // South
                'D': { x: cx - 150, y: cy },      // West
                '1': { x: cx - 100, y: cy - 100 }, // NW
                '2': { x: cx + 100, y: cy - 100 }, // NE
                '3': { x: cx + 100, y: cy + 100 }, // SE
                '4': { x: cx - 100, y: cy + 100 }  // SW
            };
        } else if (newConfig.waymarkPreset === 'waymarks-2') {
            const cx = 400;
            const cy = 300;
            const d = 150;
            gameState.markers = {
                '1': { x: cx - d, y: cy - d }, // NW
                'A': { x: cx, y: cy - d },     // N
                '2': { x: cx + d, y: cy - d }, // NE
                'D': { x: cx - d, y: cy },     // W
                'B': { x: cx + d, y: cy },     // E
                '4': { x: cx - d, y: cy + d }, // SW
                'C': { x: cx, y: cy + d },     // S
                '3': { x: cx + d, y: cy + d }  // SE
            };
        } else if (newConfig.waymarkPreset === 'waymarks-3') {
            const cx = 400;
            const cy = 300;
            const far = 150;
            const near = 100;
            gameState.markers = {
                '1': { x: cx - far, y: cy - far }, // NW (Far)
                '2': { x: cx + far, y: cy - far }, // NE (Far)
                '3': { x: cx + far, y: cy + far }, // SE (Far)
                '4': { x: cx - far, y: cy + far }, // SW (Far)
                'A': { x: cx, y: cy - near },      // N (Near)
                'B': { x: cx + near, y: cy },      // E (Near)
                'C': { x: cx, y: cy + near },      // S (Near)
                'D': { x: cx - near, y: cy }       // W (Near)
            };
        } else if (newConfig.waymarkPreset === 'waymarks-4') {
            const cx = 400;
            const cy = 300;
            const cardinalDist = 200;
            const interDist = 100;
            gameState.markers = {
                '1': { x: cx - interDist, y: cy - interDist }, // NW
                '2': { x: cx + interDist, y: cy - interDist }, // NE
                '3': { x: cx + interDist, y: cy + interDist }, // SE
                '4': { x: cx - interDist, y: cy + interDist }, // SW
                'A': { x: cx, y: cy - cardinalDist },          // N
                'B': { x: cx + cardinalDist, y: cy },          // E
                'C': { x: cx, y: cy + cardinalDist },          // S
                'D': { x: cx - cardinalDist, y: cy }           // W
            };
        }

        gameState.config = { ...gameState.config, ...newConfig };
        io.emit('stateUpdate', gameState);
    });

    const actionHistory: { type: 'stroke' | 'text', id: string }[] = [];

    socket.on('startStroke', (data: { id: string, x: number, y: number, color: number, width?: number, isEraser?: boolean }) => {
        console.log('startStroke received', data.id);
        const newStroke = {
            id: data.id,
            color: data.color,
            points: [{ x: data.x, y: data.y }],
            width: data.width || 3,
            isEraser: !!data.isEraser
        };
        gameState.strokes.push(newStroke);
        actionHistory.push({ type: 'stroke', id: data.id });
        io.emit('stateUpdate', gameState);
    });

    socket.on('addText', (textObj) => {
        if (!gameState.text) gameState.text = [];
        gameState.text.push(textObj);
        actionHistory.push({ type: 'text', id: textObj.id });
        io.emit('stateUpdate', gameState);
    });

    socket.on('drawPoint', (data: { id: string, x: number, y: number }) => {
        // console.log('drawPoint', data);
        const stroke = gameState.strokes.find(s => s.id === data.id);
        if (stroke) {
            stroke.points.push({ x: data.x, y: data.y });
            // Optimization: could just emit the new point to everyone instead of full state
            // But for Simplicity/MVP, full state sync is safer
            io.emit('stateUpdate', gameState);
        } else {
            console.log('drawPoint ignored, stroke not found', data.id);
        }
    });

    socket.on('endStroke', () => {
        // distinct end event might not be needed for state mod if points are just added
        // but useful if we want to "finalize" a stroke or cleanup
    });

    socket.on('undoStroke', () => {
        const lastAction = actionHistory.pop();
        if (lastAction) {
            if (lastAction.type === 'stroke') {
                const index = gameState.strokes.findIndex(s => s.id === lastAction.id);
                if (index !== -1) {
                    gameState.strokes.splice(index, 1);
                }
            } else if (lastAction.type === 'text') {
                if (gameState.text) {
                    const index = gameState.text.findIndex(t => t.id === lastAction.id);
                    if (index !== -1) {
                        gameState.text.splice(index, 1);
                    }
                }
            }
            io.emit('stateUpdate', gameState);
        } else {
            // Fallback for legacy/save-loaded state where history might be empty
            // Try to undo last stroke if available
            if (gameState.strokes.length > 0) {
                gameState.strokes.pop();
                io.emit('stateUpdate', gameState);
            }
        }
    });

    socket.on('restoreState', (savedState: any) => {
        // Basic validation
        if (savedState && typeof savedState === 'object') {
            if (Array.isArray(savedState.strokes)) gameState.strokes = savedState.strokes;
            if (savedState.markers) gameState.markers = savedState.markers;
            if (Array.isArray(savedState.text)) gameState.text = savedState.text;
            if (savedState.config) gameState.config = { ...gameState.config, ...savedState.config };

            // Clear history on load to prevent weird states
            actionHistory.length = 0;

            io.emit('stateUpdate', gameState);
        }
    });

    socket.on('clearStrokes', () => {
        console.log('Clearing all strokes');
        gameState.strokes = [];
        gameState.text = [];
        actionHistory.length = 0;
        io.emit('stateUpdate', gameState);
    });

    socket.on('honk', () => {
        // Broadcast honk to all players (including sender) to sync sound/effect
        io.emit('honk', socket.id);
    });

    socket.on('startDebuffCountdown', (updates: Record<string, number[]>) => {
        // 3
        io.emit('countdown', '3');
        setTimeout(() => {
            // 2
            io.emit('countdown', '2');
            setTimeout(() => {
                // 1
                io.emit('countdown', '1');
                setTimeout(() => {
                    // START - Apply Changes
                    Object.entries(updates).forEach(([playerId, debuffs]) => {
                        if (gameState.players[playerId]) {
                            gameState.players[playerId].debuffs = debuffs;
                        }
                    });

                    io.emit('stateUpdate', gameState);
                    io.emit('countdown', 'START');

                    // Clear countdown text after 1s
                    setTimeout(() => {
                        io.emit('countdown', null);
                    }, 1000);
                }, 1000);
            }, 1000);
        }, 1000);
    });

    socket.on('updateDebuffs', (updates: Record<string, number[]>) => {
        Object.entries(updates).forEach(([playerId, debuffs]) => {
            if (gameState.players[playerId]) {
                gameState.players[playerId].debuffs = debuffs;
            }
        });
        io.emit('stateUpdate', gameState);
    });

    socket.on('placeMarker', (data: { type: string, x: number, y: number }) => {
        // Enforce Valid Types
        const validTypes = ['1', '2', '3', '4', 'A', 'B', 'C', 'D'];
        if (validTypes.includes(data.type)) {
            gameState.markers[data.type] = { x: data.x, y: data.y };
            io.emit('stateUpdate', gameState);
        }
    });

    socket.on('removeMarker', (type: string) => {
        if (gameState.markers[type]) {
            delete gameState.markers[type];
            io.emit('stateUpdate', gameState);
        }
    });

    socket.on('clearMarkers', () => {
        gameState.markers = {};
        io.emit('stateUpdate', gameState);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete gameState.players[socket.id];
        io.emit('stateUpdate', gameState);
    });
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
