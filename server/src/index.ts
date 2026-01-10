import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import path from 'path';
import https from 'https';
import fs from 'fs';
import { URL } from 'url';
// @ts-ignore
import puppeteer from 'puppeteer';

const app = express();
app.use(cors());

// Serve static files from the client build
app.use(cors());
app.use(express.json());

const clientDistPath = path.join(__dirname, '../../client/dist');
const uploadsPath = path.join(__dirname, '../public/uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use(express.static(clientDistPath));
app.use('/uploads', express.static(uploadsPath));




const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000, // 60s timeout (default 20s is too sensitive)
    pingInterval: 25000, // 25s ping
    transports: ['websocket', 'polling'] // Allow both, but prefer WS
});

import { GameState, initialState, ArenaConfig } from './state';

// Room State Management
// Room State Management
const rooms: Record<string, GameState> = {};
const roomDeletionTimers: Record<string, NodeJS.Timeout> = {};
const roomPlayerActivity: Record<string, number> = {}; // Key: "roomId:playerName", Value: lastActiveTimestamp

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

    // Inactivity Tracking
    socket.data.lastActive = Date.now();
    socket.data.warningStage = 0; // 0=None, 1=30m, 2=15m, 3=5m

    // Update activity on ANY event
    socket.onAny(() => {
        const now = Date.now();
        socket.data.lastActive = now;

        // Update persistent map if user is in a room (we need to know their name/room)
        // Unfortunately onAny doesn't easy give us access to 'name' unless we stored it on socket
        // But we DO store roomId on socket! We just need name.
        if (currentRoomId && socket.data.name) { // We'll add name to socket.data in joinGame
            roomPlayerActivity[`${currentRoomId}:${socket.data.name}`] = now;
        }

        if (socket.data.warningStage !== 0) {
            // Reset warnings if they became active
            socket.data.warningStage = 0;
        }
    });

    // Persistent AFK Tracking (Room:Name -> LastActive Timestamp)
    // This ensures disconnects don't reset the timer.
    const afkPersistence: Record<string, number> = {};

    socket.on('joinGame', (data: {
        action: 'create' | 'join',
        roomId?: string,
        name: string,
        color: number,
        role: 'tank' | 'healer' | 'dps' | 'spectator',
        x?: number,
        y?: number
    }) => {
        let roomId = data.roomId?.toUpperCase();

        if (data.action === 'create') {
            roomId = generateRoomId();
            rooms[roomId] = createInitialState();
            console.log(`Room created: ${roomId} `);
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
        socket.data.name = data.name; // Store for AFK tracking

        // AFK Persistence Logic
        const userKey = `${currentRoomId}:${data.name}`;
        if (roomPlayerActivity[userKey]) {
            // Restore previous activity time (don't reset to now)
            socket.data.lastActive = roomPlayerActivity[userKey];
        } else {
            // New user or expired
            socket.data.lastActive = Date.now();
            roomPlayerActivity[userKey] = Date.now();
        }

        // Add Player
        gameState.players[socket.id] = {
            id: socket.id,
            // Seamless Reconnect: Use provided position if available (and valid-ish), else default
            x: (data.x !== undefined && data.y !== undefined) ? data.x : 400,
            y: (data.x !== undefined && data.y !== undefined) ? data.y : 300,
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
            type: data.type || 'freehand',
            anticlockwise: data.anticlockwise
        });
        if (!page.actionHistory) page.actionHistory = [];
        page.actionHistory.push({ type: 'add_stroke', id: data.id });

        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('addText', (textObj) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];
        if (!page.text) page.text = [];
        page.text.push(textObj);

        if (!page.actionHistory) page.actionHistory = [];
        page.actionHistory.push({ type: 'add_text', id: textObj.id });

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

    socket.on('endStroke', () => { });

    socket.on('updateStrokes', (data: { updates: Partial<any>[] }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];

        if (!page.actionHistory) page.actionHistory = [];

        data.updates.forEach(update => {
            const index = page.strokes.findIndex(s => s.id === update.id);
            if (index !== -1) {
                const prev = JSON.parse(JSON.stringify(page.strokes[index]));
                // Apply update
                Object.assign(page.strokes[index], update);
                const next = JSON.parse(JSON.stringify(page.strokes[index]));

                // Record Action
                page.actionHistory!.push({
                    type: 'update_stroke',
                    id: update.id,
                    prev,
                    next
                });
            }
        });
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('updateText', (data: { updates: Partial<any>[] }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];

        if (!page.actionHistory) page.actionHistory = [];

        data.updates.forEach(update => {
            const index = page.text.findIndex(t => t.id === update.id);
            if (index !== -1) {
                const prev = JSON.parse(JSON.stringify(page.text[index]));
                Object.assign(page.text[index], update);
                const next = JSON.parse(JSON.stringify(page.text[index]));

                page.actionHistory!.push({
                    type: 'update_text',
                    id: update.id,
                    prev,
                    next
                });
            }
        });
        io.to(currentRoomId).emit('stateUpdate', gs);
        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('pasteObjects', (data: { strokes: any[], text: any[] }) => {
        console.log('Server received pasteObjects:', data.strokes?.length, data.text?.length);
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];

        if (!page.actionHistory) page.actionHistory = [];
        const batchActions: any[] = []; // Type issue: server Action is inferred. Using any for now or explicit Action[]

        if (data.strokes) {
            data.strokes.forEach(s => {
                page.strokes.push(s);
                batchActions.push({ type: 'add_stroke', id: s.id });
            });
        }
        if (data.text) {
            data.text.forEach(t => {
                // Determine if ID collision (unlikely with new random IDs from client)
                page.text.push(t);
                batchActions.push({ type: 'add_text', id: t.id });
            });
        }

        if (batchActions.length > 0) {
            page.actionHistory.push({ type: 'batch', actions: batchActions });
        }

        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('deleteObjects', (data: { strokeIds: string[], textIds: string[] }) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];

        if (!page.actionHistory) page.actionHistory = [];
        const batchActions: any[] = [];

        if (data.strokeIds) {
            data.strokeIds.forEach(id => {
                const index = page.strokes.findIndex(s => s.id === id);
                if (index !== -1) {
                    const prev = page.strokes[index];
                    page.strokes.splice(index, 1);
                    batchActions.push({ type: 'delete_stroke', prev });
                }
            });
        }
        if (data.textIds) {
            data.textIds.forEach(id => {
                const index = page.text.findIndex(t => t.id === id);
                if (index !== -1) {
                    const prev = page.text[index];
                    page.text.splice(index, 1);
                    batchActions.push({ type: 'delete_text', prev });
                }
            });
        }

        if (batchActions.length > 0) {
            page.actionHistory.push({ type: 'batch', actions: batchActions });
        }

        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('requestImport', async (url: string) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        console.log(`User requested import for ${url} [V3-LOGIC]`);

        socket.emit('importProgress', { current: 0, total: 0, status: 'Initializing Browser...' });

        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--window-size=1920,1080'
                ]
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });

            socket.emit('importProgress', { current: 0, total: 0, status: 'Navigating to RaidPlan...' });

            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

            // Strategy 1: User provided class names
            const selector = '.nhcyE a.M_f5h';

            // Wait for canvas
            try {
                await page.waitForSelector('.canvas-container', { timeout: 5000 });
            } catch (e) {
                console.log('Canvas container not found, proceeding...');
            }

            // Wait for buttons
            try {
                // Wait for ANY generic button-like interaction area just in case.
                await page.waitForFunction(() => {
                    const buttons = Array.from(document.querySelectorAll('a, button'));
                    return buttons.some(b => !isNaN(parseInt(b.textContent || '', 10)));
                }, { timeout: 5000 });
            } catch (e) {
                console.log('Generic number buttons not found immediately, waiting...');
            }

            let buttons: any[] = await page.$$(selector);

            // Strategy 2: Fallback to finding by Text Content if explicit class fails or finds too few
            if (buttons.length <= 1) {
                console.log(`Class selector found ${buttons.length} buttons. Trying text-based search...`);

                // Evaluate inside the page to find elements containing numbers 1..25
                const numberButtonHandle = await page.evaluateHandle(() => {
                    const candidates = Array.from(document.querySelectorAll('a, button, div[role="button"]'));
                    return candidates.filter(el => {
                        const txt = el.textContent?.trim();
                        // Exact match integer less than 100
                        return txt && /^\d+$/.test(txt) && parseInt(txt) < 100;
                    });
                });

                const properties = await numberButtonHandle.getProperties();
                buttons = [];
                for (const prop of properties.values()) {
                    const elementHandle = prop.asElement();
                    if (elementHandle) buttons.push(elementHandle);
                }
            }

            // Debugging: Log what we found
            if (buttons.length === 0) {
                console.log("Still no buttons found. Dumping body HTML snippet for debug...");
                const html = await page.content();
                console.log(html.substring(0, 1500) + '...');
            }

            // Sort buttons by their numeric text value to ensure correct order
            if (buttons.length > 0) {
                const buttonValPairs = [];
                for (const btn of buttons) {
                    const txt = await (await btn.getProperty('textContent')).jsonValue();
                    const val = parseInt(txt as string, 10);
                    if (!isNaN(val)) {
                        buttonValPairs.push({ btn, val });
                    }
                }
                // Sort by val
                buttonValPairs.sort((a, b) => a.val - b.val);
                buttons = buttonValPairs.map(p => p.btn);
            }

            const pagesData: any[] = [];
            const totalSteps = buttons.length > 0 ? buttons.length : 1;

            socket.emit('importProgress', { current: 0, total: totalSteps, status: 'Starting capture...' });

            if (buttons.length === 0) {
                // Single page capture
                const filename = `import_${Date.now()}_step_0.png`;
                const filepath = path.join(uploadsPath, filename);

                const container = await page.$('.canvas-container') || await page.$('canvas');
                if (container) {
                    await container.screenshot({ path: filepath });
                } else {
                    await page.screenshot({ path: filepath });
                }

                pagesData.push({
                    id: Math.random().toString(36).substr(2, 9),
                    config: {
                        shape: 'square',
                        width: 1200,
                        height: 675,
                        backgroundImageUrl: '/uploads/' + filename,
                        showGrid: false
                    },
                    strokes: [],
                    markers: {},
                    text: [],
                    actionHistory: []
                });
            } else {
                console.log(`Found ${buttons.length} steps.`);
                for (let i = 0; i < buttons.length; i++) {
                    socket.emit('importProgress', { current: i + 1, total: totalSteps, status: `Capturing Page ${i + 1}...` });

                    // Re-query
                    const currentButtons = await page.$$(selector);
                    if (currentButtons[i]) {
                        await currentButtons[i].click();
                        // Wait for update
                        await new Promise(r => setTimeout(r, 1500));

                        const filename = `import_${Date.now()}_step_${i}.png`;
                        const filepath = path.join(uploadsPath, filename);

                        const container = await page.$('.canvas-container') || await page.$('canvas');
                        if (container) {
                            await container.screenshot({ path: filepath });
                        } else {
                            await page.screenshot({ path: filepath });
                        }

                        // Get dimensions
                        const size = await page.evaluate(() => {
                            const c = document.querySelector('canvas');
                            return c ? { w: c.width, h: c.height } : { w: 1200, h: 675 };
                        });

                        pagesData.push({
                            id: Math.random().toString(36).substr(2, 9),
                            config: {
                                shape: 'square',
                                width: size.w,
                                height: size.h,
                                backgroundImageUrl: '/uploads/' + filename,
                                showGrid: false
                            },
                            strokes: [],
                            markers: {},
                            text: [],
                            actionHistory: []
                        });
                    }
                }
            }

            await browser.close();

            // Add pages to room
            const gs = rooms[currentRoomId];
            gs.pages.push(...pagesData);
            // Switch to first imported page
            gs.currentPageIndex = gs.pages.length - pagesData.length;

            io.to(currentRoomId).emit('stateUpdate', gs);
            socket.emit('importComplete');

        } catch (e: any) {
            console.error("Puppeteer Import Error:", e);
            if (browser) await browser.close();
            socket.emit('importError', { message: e.message || 'Unknown Error' });
        }
    });

    socket.on('undo', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const page = gs.pages[gs.currentPageIndex];

        if (page.actionHistory && page.actionHistory.length > 0) {
            const action = page.actionHistory.pop();

            if (action?.type === 'add_stroke') {
                page.strokes = page.strokes.filter(s => s.id !== action.id);
            } else if (action?.type === 'add_text') {
                page.text = page.text.filter(t => t.id !== action.id);
            } else if (action?.type === 'update_stroke') {
                const index = page.strokes.findIndex(s => s.id === action.id);
                if (index !== -1 && action.prev) {
                    page.strokes[index] = action.prev;
                }
            } else if (action?.type === 'update_text') {
                const index = page.text.findIndex(t => t.id === action.id);
                if (index !== -1 && action.prev) {
                    page.text[index] = action.prev;
                }
            } else if (action?.type === 'delete_stroke') {
                // To implement delete undo, we'd need to re-add it. 
                // (Not implemented yet, but placeholders useful)
                if (action.prev) page.strokes.push(action.prev);
            }
            else if (action?.type === 'delete_text') {
                if (action.prev) page.text.push(action.prev);
            } else if (action?.type === 'batch') {
                // Reverse iterate sub-actions
                const subActions = [...action.actions].reverse();
                subActions.forEach(sub => {
                    if (sub.type === 'add_stroke') {
                        page.strokes = page.strokes.filter(s => s.id !== sub.id);
                    } else if (sub.type === 'add_text') {
                        page.text = page.text.filter(t => t.id !== sub.id);
                    } else if (sub.type === 'delete_stroke') {
                        if (sub.prev) page.strokes.push(sub.prev);
                    } else if (sub.type === 'delete_text') {
                        if (sub.prev) page.text.push(sub.prev);
                    } else if (sub.type === 'update_stroke') {
                        const index = page.strokes.findIndex(s => s.id === sub.id);
                        if (index !== -1 && sub.prev) page.strokes[index] = sub.prev;
                    } else if (sub.type === 'update_text') {
                        const index = page.text.findIndex(t => t.id === sub.id);
                        if (index !== -1 && sub.prev) page.text[index] = sub.prev;
                    }
                });
            }

            io.to(currentRoomId).emit('stateUpdate', gs);
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
            // Ensure chatHistory is initialized if not present in savedState
            if (!gs.chatHistory) {
                gs.chatHistory = [];
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

    socket.on('startCountdown', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const room = currentRoomId;

        // Exactly mimics startDebuffCountdown logic (3s)
        io.to(room).emit('countdown', '3');
        setTimeout(() => {
            io.to(room).emit('countdown', '2');
            setTimeout(() => {
                io.to(room).emit('countdown', '1');
                setTimeout(() => {
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

    socket.on('importPages', (pages: any[]) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];

        // Append all imported pages
        // Assign new IDs just in case
        pages.forEach(p => {
            if (!p.id) p.id = Math.random().toString(36).substr(2, 9);
            gs.pages.push(p);
        });

        // Switch to the first imported page
        gs.currentPageIndex = gs.pages.length - pages.length;

        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('duplicatePage', () => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const currentPage = gs.pages[gs.currentPageIndex];

        // Deep copy the current page
        const newPage = JSON.parse(JSON.stringify(currentPage));

        // Assign new ID and reset ephemeral state
        newPage.id = Math.random().toString(36).substr(2, 9);
        newPage.actionHistory = []; // Start fresh history for the new page

        // Insert after current page
        gs.pages.splice(gs.currentPageIndex + 1, 0, newPage);
        gs.currentPageIndex += 1; // Switch to the new page

        io.to(currentRoomId).emit('stateUpdate', gs);
    });

    socket.on('sendChat', (text: string) => {
        if (!currentRoomId || !rooms[currentRoomId]) return;
        const gs = rooms[currentRoomId];
        const player = gs.players[socket.id];

        if (!player || !text.trim()) return;

        const message = {
            id: Math.random().toString(36).substr(2, 9),
            sender: player.name,
            text: text.trim(),
            color: player.color, // Use player's color
            timestamp: Date.now()
        };

        // Add to history (Limit 50)
        gs.chatHistory.push(message);
        if (gs.chatHistory.length > 50) gs.chatHistory.shift();

        // Broadcast JUST the message for performance
        io.to(currentRoomId).emit('chatMessage', message);
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
            console.log(`User ${socket.id} disconnected from room ${currentRoomId} `);
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
                    console.log(`Room ${currentRoomId} is empty.Scheduling deletion in 5 minutes.`);
                    roomDeletionTimers[currentRoomId] = setTimeout(() => {
                        if (currentRoomId && rooms[currentRoomId]) {
                            // Double check if empty (though timer should be cleared if acted upon)
                            if (Object.keys(rooms[currentRoomId].players).length === 0) {
                                console.log(`Deleting empty room: ${currentRoomId} `);
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
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 60 Minutes
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

setInterval(() => {
    const now = Date.now();
    io.sockets.sockets.forEach((socket) => {
        const lastActive = socket.data.lastActive || now; // Default to now if missing
        const inactiveDuration = now - lastActive;
        const timeRemaining = INACTIVITY_LIMIT_MS - inactiveDuration;

        if (inactiveDuration > INACTIVITY_LIMIT_MS) {
            // Kick
            console.log(`Kicking inactive socket ${socket.id}`);
            socket.emit('kick', 'You have been disconnected due to inactivity (60 minutes).');
            socket.disconnect(true);
            return;
        }

        let stage = 0;
        if (timeRemaining <= 5 * 60 * 1000) stage = 3; // 5 mins
        else if (timeRemaining <= 15 * 60 * 1000) stage = 2; // 15 mins
        else if (timeRemaining <= 30 * 60 * 1000) stage = 1; // 30 mins

        // If we reached a new warning stage (higher than current), warn them
        if (stage > (socket.data.warningStage || 0)) {
            socket.data.warningStage = stage;
            const minutes = Math.ceil(timeRemaining / 60000);

            // Send system message
            socket.emit('chatMessage', {
                id: 'system-' + Date.now(),
                sender: 'System Warning',
                text: `You will be disconnected in ${minutes} minute${minutes !== 1 ? 's' : ''} due to inactivity. Move or chat to stay connected.`,
                color: 0xff0000, // Red
                timestamp: Date.now()
            });
        }
    });
}, CHECK_INTERVAL_MS);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} `);
});
