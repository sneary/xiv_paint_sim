import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';

const app = express();
app.use(cors());

// Serve static files from the client build
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

import { GameState, initialState, ArenaConfig } from './state';

// Room State Management
const rooms: Record<string, GameState> = {};
const roomDeletionTimers: Record<string, NodeJS.Timeout> = {};

function generateRoomId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure uniqueness (unlikely to collide, but safe)
    if (rooms[result]) return generateRoomId();
    return result;
}

// Helper to deep copy initial state
function createInitialState(): GameState {
    return JSON.parse(JSON.stringify(initialState));
}

io.on('connection', (socket: Socket) => {
    console.log('User connected:', socket.id);
    // Do NOT emit initial state yet. User must Join or Create a room first.

    // Store room ID on socket for easy access
    let currentRoomId: string | null = null;

    socket.on('joinGame', (data: {
        action: 'create' | 'join',
        roomId?: string,
        name: string,
        color: number,
        role: 'tank' | 'healer' | 'dps' | 'spectator'
    }) => {
        let roomId = data.roomId?.toUpperCase();

        if (data.action === 'create') {
            roomId = generateRoomId();
            rooms[roomId] = createInitialState();
            console.log(`Room created: ${roomId}`);
        } else {
            // Join existing
            if (!roomId || !rooms[roomId]) {
                socket.emit('joinError', 'Room not found');
                return;
            }

            // If room was scheduled for deletion, cancel it because someone joined
            if (roomDeletionTimers[roomId]) {
                console.log(`Cancelled deletion for room ${roomId}`);
                clearTimeout(roomDeletionTimers[roomId]);
                delete roomDeletionTimers[roomId];
            }
        }

        // Validate Name/Color Uniqueness within the ROOM (Only for Joining)
        const gameState = rooms[roomId!]; // Ensure gameState is available in scope

        if (data.action === 'join') {
            const players = Object.values(gameState.players);

            const nameTaken = players.some(p => p.name.toLowerCase() === data.name.toLowerCase());
            if (nameTaken) {
                socket.emit('joinError', 'Name is already taken in this room');
                return;
            }

            if (data.role !== 'spectator') {
                const colorTaken = players.some(p => p.role !== 'spectator' && p.color === data.color);
                if (colorTaken) {
                    socket.emit('joinError', 'Color is already taken in this room');
                    return;
                }
            }
        }

        // Success - Join Room
        currentRoomId = roomId!;
        socket.join(currentRoomId);

        // Add Player
        gameState.players[socket.id] = {
            id: socket.id,
            x: 400,
            y: 300,
            color: data.color || 0xffffff,
            name: data.name,
            role: data.role || 'dps',
            debuffs: []
        };

        // Ensure state is valid (if legacy cleanup needed, though new rooms use new init)
        if (!gameState.pages) {
            // Should not happen for new rooms, but good safety
            gameState.pages = [{ id: 'default', config: (gameState as any).config || { shape: 'circle', width: 500, height: 500 }, strokes: [], markers: {}, text: [] }];
            gameState.currentPageIndex = 0;
        }

        // Emit Success with Room ID
        socket.emit('joinSuccess', { roomId: currentRoomId });

        // Broadcast Update to Room
        io.to(currentRoomId).emit('stateUpdate', gameState);
    });

    // --- All other events must check currentRoomId ---

    // Pre-flight check for Landing Page
    socket.on('checkRoom', (roomId: string, callback: (response: { exists: boolean, takenNames: string[], takenColors: number[] }) => void) => {
        const rId = roomId?.toUpperCase();
        if (!rId || !rooms[rId]) {
            callback({ exists: false, takenNames: [], takenColors: [] });
            return;
        }

        const gs = rooms[rId];
        const players = Object.values(gs.players);
        const takenNames = players.map(p => p.name);
        // Only count colors of non-spectators
        const takenColors = players.filter(p => p.role !== 'spectator').map(p => p.color);

        callback({ exists: true, takenNames, takenColors });
    });

    socket.on('move', (pos: { x: number; y: number }) => {
        if (currentRoomId && rooms[currentRoomId]) {
            const gs = rooms[currentRoomId];
            if (gs.players[socket.id]) {
                gs.players[socket.id].x = pos.x;
                gs.players[socket.id].y = pos.y;
                // Optimization: Don't broadcast full state on every move.
                // Just send the player's new position.
                io.to(currentRoomId).emit('playerMoved', { id: socket.id, x: pos.x, y: pos.y });
            }
        }
    });

    socket.on('updateConfig', (newConfig: any) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];

        // Apply Preset Logic (Copied from previous)
        if (newConfig.waymarkPreset === 'waymarks-1') {
            const cx = 400; const cy = 300;
            page.markers = {
                'A': { x: cx, y: cy - 150 }, 'B': { x: cx + 150, y: cy },
                'C': { x: cx, y: cy + 150 }, 'D': { x: cx - 150, y: cy },
                '1': { x: cx - 100, y: cy - 100 }, '2': { x: cx + 100, y: cy - 100 },
                '3': { x: cx + 100, y: cy + 100 }, '4': { x: cx - 100, y: cy + 100 }
            };
        } else if (newConfig.waymarkPreset === 'waymarks-2') {
            const cx = 400; const cy = 300; const d = 150;
            page.markers = {
                '1': { x: cx - d, y: cy - d }, 'A': { x: cx, y: cy - d },
                '2': { x: cx + d, y: cy - d }, 'D': { x: cx - d, y: cy },
                'B': { x: cx + d, y: cy }, '4': { x: cx - d, y: cy + d },
                'C': { x: cx, y: cy + d }, '3': { x: cx + d, y: cy + d }
            };
        } else if (newConfig.waymarkPreset === 'waymarks-3') {
            const cx = 400; const cy = 300; const far = 150; const near = 100;
            page.markers = {
                '1': { x: cx - far, y: cy - far }, '2': { x: cx + far, y: cy - far },
                '3': { x: cx + far, y: cy + far }, '4': { x: cx - far, y: cy + far },
                'A': { x: cx, y: cy - near }, 'B': { x: cx + near, y: cy },
                'C': { x: cx, y: cy + near }, 'D': { x: cx - near, y: cy }
            };
        } else if (newConfig.waymarkPreset === 'waymarks-4') {
            const cx = 400; const cy = 300; const cd = 200; const id = 100;
            page.markers = {
                '1': { x: cx - id, y: cy - id }, '2': { x: cx + id, y: cy - id },
                '3': { x: cx + id, y: cy + id }, '4': { x: cx - id, y: cy + id },
                'A': { x: cx, y: cy - cd }, 'B': { x: cx + cd, y: cy },
                'C': { x: cx, y: cy + cd }, 'D': { x: cx - cd, y: cy }
            };
        }

        page.config = { ...page.config, ...newConfig };
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('startStroke', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        page.strokes.push({
            id: data.id,
            color: data.color,
            points: [{ x: data.x, y: data.y }],
            width: data.width || 3,
            isEraser: !!data.isEraser,
            type: data.type || 'freehand'
        });
        if (!page.actionHistory) page.actionHistory = [];
        page.actionHistory.push('stroke');

        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('addText', (textObj) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        if (!page.text) page.text = [];
        page.text.push(textObj);

        if (!page.actionHistory) page.actionHistory = [];
        page.actionHistory.push('text');

        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('drawPoint', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        const stroke = page.strokes.find(s => s.id === data.id);
        if (stroke) {
            stroke.points.push({ x: data.x, y: data.y });
            io.to(currentRoomId).emit('stateUpdate', gs);
        }
    });

    socket.on('endStroke', () => { }); // No-op

    // Undo logic simplified for Room context
    socket.on('undoStroke', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        // Ideally we'd have a per-room action history.
        // Check actionHistory first
        if (page.actionHistory && page.actionHistory.length > 0) {
            const lastAction = page.actionHistory.pop();
            if (lastAction === 'stroke') {
                if (page.strokes.length > 0) page.strokes.pop();
            } else if (lastAction === 'text') {
                if (page.text && page.text.length > 0) page.text.pop();
            }
            io.to(currentRoomId).emit('stateUpdate', gs);
        } else {
            // Legacy fallback if no history (or old rooms)
            if (page.strokes.length > 0) {
                page.strokes.pop();
                io.to(currentRoomId).emit('stateUpdate', gs);
            }
        }
    });

    socket.on('restoreState', (savedState: any) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        // Validation & Assign
        if (savedState && typeof savedState === 'object') {
            // Check for legacy flat format
            if (!savedState.pages) {
                // Migrate to page 1
                gs.pages = [{
                    id: 'restored',
                    config: savedState.config || { shape: 'circle', width: 500, height: 500 },
                    strokes: Array.isArray(savedState.strokes) ? savedState.strokes : [],
                    markers: savedState.markers || {},
                    text: Array.isArray(savedState.text) ? savedState.text : []
                }];
                gs.currentPageIndex = 0;
            } else {
                // New format
                if (Array.isArray(savedState.pages)) {
                    gs.pages = savedState.pages;
                    gs.currentPageIndex = typeof savedState.currentPageIndex === 'number' ? savedState.currentPageIndex : 0;
                }
            }
            io.to(currentRoomId).emit('stateUpdate', gs);
        }
    });

    socket.on('clearStrokes', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        page.strokes = [];
        page.text = [];
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('honk', () => {
        if (!currentRoomId) return;
        io.to(currentRoomId).emit('honk', socket.id);
    });

    // Debuff Logic
    socket.on('startDebuffCountdown', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = currentRoomId;
        const gs = rooms[room];

        io.to(room).emit('countdown', '3');
        setTimeout(() => {
            io.to(room).emit('countdown', '2');
            setTimeout(() => {
                io.to(room).emit('countdown', '1');
                setTimeout(() => {
                    // Apply
                    if (data.debuffs) {
                        Object.entries(data.debuffs).forEach(([pid, d]) => {
                            if (gs.players[pid]) gs.players[pid].debuffs = d as number[];
                        });
                    }
                    if (data.limitCuts) {
                        Object.entries(data.limitCuts).forEach(([pid, lc]) => {
                            if (gs.players[pid]) {
                                if (lc) gs.players[pid].limitCut = lc as number;
                                else delete gs.players[pid].limitCut;
                            }
                        });
                    }
                    io.to(room).emit('stateUpdate', gs);
                    io.to(room).emit('countdown', 'START');
                    setTimeout(() => io.to(room).emit('countdown', null), 1000);
                }, 1000);
            }, 1000);
        }, 1000);
    });

    socket.on('updateDebuffs', (updates) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        Object.entries(updates).forEach(([pid, debuffs]) => {
            if (gs.players[pid]) gs.players[pid].debuffs = debuffs as number[];
        });
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('updateLimitCuts', (updates) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        Object.entries(updates).forEach(([pid, lc]) => {
            if (gs.players[pid]) {
                if (lc) gs.players[pid].limitCut = lc as number;
                else delete gs.players[pid].limitCut;
            }
        });
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('limitCut', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = currentRoomId;
        const gs = rooms[room];

        io.to(room).emit('countdown', '3');
        setTimeout(() => {
            io.to(room).emit('countdown', '2');
            setTimeout(() => {
                io.to(room).emit('countdown', '1');
                setTimeout(() => {
                    // Logic
                    const nonSpectators = Object.values(gs.players).filter(p => p.role !== 'spectator');
                    const numbers = [1, 2, 3, 4, 5, 6, 7, 8];
                    // Shuffle
                    for (let i = numbers.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
                    }
                    nonSpectators.forEach((p, i) => {
                        if (i < 8) gs.players[p.id].limitCut = numbers[i];
                    });

                    io.to(room).emit('stateUpdate', gs);
                    io.to(room).emit('countdown', 'START');
                    setTimeout(() => io.to(room).emit('countdown', null), 1000);
                }, 1000);
            }, 1000);
        }, 1000);
    });

    socket.on('clearLimitCut', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        Object.values(gs.players).forEach(p => delete p.limitCut);
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('placeMarker', (data) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        page.markers[data.type] = { x: data.x, y: data.y };
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('removeMarker', (type) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        delete page.markers[type];
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('clearMarkers', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        page.markers = {};
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    // --- Page Management ---
    socket.on('addPage', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const prevPage = gs.pages[gs.pages.length - 1];

        // Inherit config from previous page
        const newPage = {
            id: Math.random().toString(36).substr(2, 9),
            config: prevPage ? JSON.parse(JSON.stringify(prevPage.config)) : { shape: 'circle', width: 500, height: 500 },
            strokes: [],
            markers: {},
            text: []
        };

        gs.pages.push(newPage);
        gs.currentPageIndex = gs.pages.length - 1; // Auto-switch to new page? Usually yes.
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('deletePage', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        if (gs.pages.length <= 1) return; // Cannot delete last page

        gs.pages.splice(gs.currentPageIndex, 1);
        // Correct index if out of bounds
        if (gs.currentPageIndex >= gs.pages.length) {
            gs.currentPageIndex = gs.pages.length - 1;
        }
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('changePage', (index: number) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        if (index >= 0 && index < gs.pages.length) {
            gs.currentPageIndex = index;
            io.to(currentRoomId).emit('stateUpdate', gs);
        }
    });


    socket.on('keepalive', () => {
        // No-op: just processing the packet wakes the Cloud Run CPU loop
    });

    socket.on('disconnect', () => {
        if (currentRoomId && rooms[currentRoomId]) {
            console.log(`User ${socket.id} disconnected from room ${currentRoomId}`);
            delete rooms[currentRoomId].players[socket.id];

            // Logic to clean up empty rooms?
            if (Object.keys(rooms[currentRoomId].players).length === 0) {
                // Determine if we should delete. Maybe timeout?
                // For now, keep it simple. If everyone leaves, room data is cleared immediately to free memory,
                // OR we keep it allowing Re-join. 
                // Let's DUMP it for now to avoid memory leaks in this simple impl.
                // Actually user might want to refresh and re-join, deleting immediately is harsh. 
                // Let's keep it for now.

                // If room is empty, schedule deletion in 5 minutes
                if (!roomDeletionTimers[currentRoomId]) {
                    console.log(`Room ${currentRoomId} is empty. Scheduling deletion in 5 minutes.`);
                    roomDeletionTimers[currentRoomId] = setTimeout(() => {
                        if (currentRoomId && rooms[currentRoomId]) {
                            // Double check if empty (though timer should be cleared if acted upon)
                            if (Object.keys(rooms[currentRoomId].players).length === 0) {
                                console.log(`Deleting empty room: ${currentRoomId}`);
                                delete rooms[currentRoomId];
                                delete roomDeletionTimers[currentRoomId];
                            }
                        }
                    }, 5 * 60 * 1000);
                }
            }

            io.to(currentRoomId).emit('stateUpdate', rooms[currentRoomId]);
        }
    });

});

// React Route fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
