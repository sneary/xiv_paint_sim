import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

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

    io.emit('stateUpdate', gameState);

    socket.on('joinGame', (data: { name: string, color: number }) => {
        gameState.players[socket.id] = {
            id: socket.id,
            x: 400,
            y: 300,
            role: 'dps',
            name: data.name,
            color: data.color
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
        gameState.config = { ...gameState.config, ...newConfig };
        io.emit('stateUpdate', gameState);
    });

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

    socket.on('clearStrokes', () => {
        console.log('Clearing all strokes');
        gameState.strokes = [];
        io.emit('stateUpdate', gameState);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        delete gameState.players[socket.id];
        io.emit('stateUpdate', gameState);
    });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
