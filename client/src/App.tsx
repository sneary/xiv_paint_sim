import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { Joystick } from 'react-joystick-component';
import './App.css';
import Arena from './components/Arena';
import ConfigMenu from './components/ConfigMenu';
import type { GameState, ArenaConfig } from './types';

import LandingPage from './components/LandingPage';
import PartyList from './components/PartyList';
import DebuffMenu from './components/DebuffMenu';
import WaymarkMenu from './components/WaymarkMenu';
import PageControls from './components/PageControls';

// In production (Single Service), we want to connect to the same origin (relative path)
// If VITE_SOCKET_URL is set (e.g. for split hosting), use that.
// If dev, default to localhost.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? undefined : 'http://localhost:3001');

function App() {
  const [gameState, setGameState] = useState<GameState>({
    players: {},
    currentPageIndex: 0,
    pages: [{
      id: 'init',
      config: { shape: 'circle', width: 500, height: 500 },
      strokes: [],
      markers: {},
      text: []
    }]
  });
  const socketRef = useRef<Socket | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');

  const [countdown, setCountdown] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Store join options for auto-reconnect
  const lastJoinOptions = useRef<{
    action: 'create' | 'join',
    roomId?: string,
    name: string,
    color: number,
    role: 'tank' | 'healer' | 'dps' | 'spectator'
  } | null>(null);

  // Movement state
  const keysPressed = useRef<Record<string, boolean>>({});
  const lastMoveEmit = useRef<number>(0);
  // Physics state: Track position independently of React state to avoid frame drops/stutter
  const localPlayerRef = useRef<{ x: number, y: number } | null>(null);


  // Joystick state
  const joystickRef = useRef<{ x: number, y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // UI Visibility (Collapsed by default on mobile)
  const [showConfig, setShowConfig] = useState(!isMobile);
  const [showTools, setShowTools] = useState(!isMobile);
  const [scale, setScale] = useState(1);

  // Helper to safely get current page
  const currentPage = gameState.pages[gameState.currentPageIndex] || gameState.pages[0];

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        // Force show on desktop if resized larger
        setShowConfig(true);
        setShowTools(true);
      }

      // Calculate Scale
      // Base size is 800x600.
      // We want some padding.
      const w = window.innerWidth;
      const h = window.innerHeight;
      // Reduce buffer on mobile to maximize size
      const hBuffer = mobile ? 20 : 50;
      const s = Math.min(w / 800, (h - hBuffer) / 600);
      setScale(s < 1 ? s : 1);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Init
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleJoystickMove = (event: any) => {
    if (event) {
      if (event.x !== null && event.y !== null && event.x !== undefined && event.y !== undefined) {
        joystickRef.current = { x: event.x, y: event.y };
      } else {
        joystickRef.current = null;
      }
    }
  };

  const handleJoystickStop = () => {
    joystickRef.current = null;
  };

  // Honk State
  const [honkingPlayers, setHonkingPlayers] = useState<Record<string, number>>({});


  // Socket Events
  useEffect(() => {
    // If we have a socket already, don't recreate unless URL changed (it won't)
    // Actually, simple way: Just create one socket.
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);

      // Auto-rejoin if we were previously in a game
      if (lastJoinOptions.current) {
        console.log('Auto-rejoining game...');
        // Add a small delay to ensure server is ready or to avoid race conditions
        setTimeout(() => {
          newSocket.emit('joinGame', lastJoinOptions.current);
        }, 100);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('stateUpdate', (newState: GameState) => {
      setGameState(newState);
    });

    newSocket.on('playerMoved', (data: { id: string, x: number, y: number }) => {
      // Ignore our own movement from server to prevent rubberbanding/stuttering
      // We are already updating locally in the animation loop.
      if (data.id === newSocket.id) return;

      setGameState(prev => {
        if (!prev.players[data.id]) return prev; // Player not found (race condition?)
        return {
          ...prev,
          players: {
            ...prev.players,
            [data.id]: {
              ...prev.players[data.id],
              x: data.x,
              y: data.y
            }
          }
        };
      });
    });

    newSocket.on('joinSuccess', (data: { roomId: string }) => {
      setRoomId(data.roomId);
      setIsJoined(true);
      setJoinError('');

      // Update persistence so if we crash/reconnect, we rejoin THIS room, not create a new one
      if (lastJoinOptions.current) {
        lastJoinOptions.current.roomId = data.roomId;
        lastJoinOptions.current.action = 'join';
      }
    });

    newSocket.on('joinError', (msg: string) => {
      setJoinError(msg);
      setIsJoined(false);
    });

    newSocket.on('countdown', (val: string | null) => {
      setCountdown(val);
    });

    newSocket.on('honk', (id: string) => {
      // Trigger visual effect
      setHonkingPlayers(prev => ({ ...prev, [id]: Date.now() }));
      // Clear effect after 200ms
      setTimeout(() => {
        setHonkingPlayers(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 200);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Keepalive Loop for Cloud Run (Serverless) anti-throttling
  useEffect(() => {
    const interval = setInterval(() => {
      if (socketRef.current) {
        socketRef.current.emit('keepalive');
      }
    }, 15000); // Send heartbeat every 15s to keep server CPU awake
    return () => clearInterval(interval);
  }, []);

  const handleJoin = (data: { action: 'create' | 'join', roomId?: string, name: string, color: number, role: 'tank' | 'healer' | 'dps' | 'spectator' }) => {
    // Save for auto-reconnect
    lastJoinOptions.current = data;

    if (socketRef.current) {
      socketRef.current.emit('joinGame', data);
    }
  };

  const handleAddPage = () => {
    socketRef.current?.emit('addPage');
  };

  const handleDeletePage = () => {
    socketRef.current?.emit('deletePage');
  };

  const handleChangePage = (index: number) => {
    socketRef.current?.emit('changePage', index);
  };


  const handleCheckRoom = (roomId: string) => {
    return new Promise<{ exists: boolean, takenNames: string[], takenColors: number[] }>((resolve) => {
      if (!socketRef.current) {
        resolve({ exists: false, takenNames: [], takenColors: [] });
        return;
      }
      socketRef.current.emit('checkRoom', roomId, (response: any) => {
        resolve(response);
      });
    });
  };

  // Input handling setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Safety: If Alt or Meta (Windows) key is pressed, stop movement immediately
      if (e.key === 'Alt' || e.key === 'Meta' || e.key === 'Tab') {
        keysPressed.current = {};
        return;
      }

      keysPressed.current[e.key.toLowerCase()] = true;
      if (e.key === ' ' && !e.repeat) {
        socketRef.current?.emit('honk');
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    const handleBlur = () => {
      // Reset all keys when window loses focus
      keysPressed.current = {};
    };

    // Standard listener
    window.addEventListener('blur', handleBlur);
    // Chrome workaround: Also listen on document with capture phase
    document.addEventListener('blur', handleBlur, true);
    // Chrome workaround: Direct property assignment as fallback
    window.onblur = handleBlur;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('blur', handleBlur, true);
      window.onblur = null;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Quick fix for loop access to state:
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = () => {
      animationFrameId = requestAnimationFrame(loop);

      const currentTime = performance.now();
      const dt = currentTime - lastTime;
      lastTime = currentTime;

      // Cap dt to prevent huge jumps if tab was inactive
      const safeDt = Math.min(dt, 100);

      if (!socketRef.current) return;

      const keys = keysPressed.current;
      const socket = socketRef.current;
      const myId = socket.id;

      if (!myId) return;

      // We need to read the VERY LATEST state from the ref to avoid stale closures
      const currentState = gameStateRef.current;
      const me = currentState.players[myId];

      if (!me) return;

      // Initialize or Sync Physics State if stale (e.g. teleported/respawned externally?)
      // Actually, we generally trust local physics over server for position.
      if (!localPlayerRef.current) {
        localPlayerRef.current = { x: me.x, y: me.y };
      }

      // Physics Calculation
      let { x: currentX, y: currentY } = localPlayerRef.current;

      let dx = 0;
      let dy = 0;
      // Previous: 5px per 20ms = 250px per second
      const SPEED_PER_SEC = 250;
      const moveAmount = SPEED_PER_SEC * (safeDt / 1000);

      if (keys['w']) dy -= moveAmount;
      if (keys['s']) dy += moveAmount;
      if (keys['a']) dx -= moveAmount;
      if (keys['d']) dx += moveAmount;

      // Joystick override
      if (joystickRef.current) {
        const jx = joystickRef.current.x;
        const jy = joystickRef.current.y;
        // User confirmed values are -1 to 1.
        dx += jx * moveAmount;
        dy -= jy * moveAmount; // Joystick Y is inverted relative to screen coords
      }

      if (dx !== 0 || dy !== 0) {
        let newX = currentX + dx;
        let newY = currentY + dy;

        // Boundary Checks - Keep within Drawable Area (Canvas 800x600)
        // We ignore the arena shape (Circle/Square) effectively allowing players to run "out of bounds" mechanic-wise,
        // but keeping them on screen.
        const playerRadius = 15; // 10 radius + 5 stroke/buffer
        // Wait, logic in this file seems to treat 800x600 as base. 
        // The previous logic used hardcoded centerX=400.
        // Let's stick to 800x600 base coord system which matches server state.

        // Clamp to 800x600
        newX = Math.max(playerRadius, Math.min(newX, 800 - playerRadius));
        newY = Math.max(playerRadius, Math.min(newY, 600 - playerRadius));

        // Update Physics State Immediately
        localPlayerRef.current = { x: newX, y: newY };

        // 1. Optimistic Local Update (Client Prediction)
        // We update our own state IMMEDIATELY so it feels responsive
        setGameState(prev => ({
          ...prev,
          players: {
            ...prev.players,
            [myId]: { ...prev.players[myId], x: newX, y: newY }
          }
        }));

        // 2. Send to Server (Throttle this? For now, per frame movement emit might be high load but smoothest)
        // Optimization: Could throttle network sends to 20-30hz while simulating locally at high FPS.
        const now = performance.now();
        if (now - lastMoveEmit.current > 30) { // ~33 updates per second
          socket.emit('move', { x: newX, y: newY });
          lastMoveEmit.current = now;
        }
      }
    };

    loop();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const myId = socketRef.current?.id;

  const handleConfigUpdate = (newConfig: Partial<ArenaConfig>) => {
    socketRef.current?.emit('updateConfig', newConfig);
  };


  const [selectedColor, setSelectedColor] = useState<number>(0xff0000);
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'line' | 'text' | 'donut' | 'circle'>('brush');

  // Clear text input when tool changes
  useEffect(() => {
    setTextInput(null);
  }, [tool]);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [linePreview, setLinePreview] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const [shapePreview, setShapePreview] = useState<{ x: number, y: number, r: number } | null>(null);
  const [textInput, setTextInput] = useState<{ x: number, y: number, value: string } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textInput && textInputRef.current) {
      // slight delay to ensure render? usually not needed with effect, but safety
      setTimeout(() => textInputRef.current?.focus(), 0);
    }
  }, [textInput]);

  const currentStrokeIdRef = useRef<string | null>(null);

  const startStroke = (x: number, y: number) => {
    // If placing a marker, do that instead of drawing
    if (activeMarker) {
      socketRef.current?.emit('placeMarker', { type: activeMarker, x, y });
      return;
    }

    // If we have an active text input, commit it first (unless we just clicked it, but the input prevents clicks to canvas propagation usually? 
    // Actually, Input is DOM, Canvas is below. Clicking Input doesn't trigger startStroke. Clicking canvas does.
    if (textInput) {
      if (textInput.value.trim()) {
        socketRef.current?.emit('addText', {
          id: Math.random().toString(36).substr(2, 9),
          x: textInput.x,
          y: textInput.y,
          text: textInput.value,
          color: selectedColor,
          fontSize: Math.max(12, lineWidth * 2)
        });
      }
      setTextInput(null);
      // If we are in text tool, we want to start a NEW text input at this location
      if (tool === 'text') {
        setTextInput({ x, y, value: '' });
        setIsDrawing(false);
        return;
      }
      // If we are NOT in text tool (unreachable due to useEffect clearing checking tool? No, maybe useEffect hasn't run yet if we just clicked? 
      // Actually if tool changed, input is gone. So this is for when we are IN text tool and click elsewhere.
      // But wait, if I am in Brush mode, `textInput` should be null. 
      // So this block mainly handles "I am in text mode, I have an open input, and I clicked elsewhere".
    }

    if (tool === 'text') {
      setTextInput({ x, y, value: '' });
      setIsDrawing(false);
      return;
    }

    const id = Math.random().toString(36).substr(2, 9);
    currentStrokeIdRef.current = id;
    setIsDrawing(true);

    if (tool === 'line') {
      setLinePreview({ x1: x, y1: y, x2: x, y2: y });
      socketRef.current?.emit('startStroke', {
        id,
        x,
        y,
        color: selectedColor,
        width: lineWidth,
        isEraser: false,
        type: 'line'
      });
    } else if (tool === 'donut' || tool === 'circle') {
      setShapePreview({ x, y, r: 0 });
      socketRef.current?.emit('startStroke', {
        id,
        x,
        y,
        color: selectedColor,
        width: lineWidth,
        isEraser: false,
        type: tool // 'donut' or 'circle'
      });
    } else {
      socketRef.current?.emit('startStroke', {
        id,
        x,
        y,
        color: selectedColor,
        width: lineWidth,
        isEraser: tool === 'eraser',
        type: 'freehand'
      });
    }
  };

  const moveStroke = (x: number, y: number) => {
    if (activeMarker) return;
    if (!isDrawing || !currentStrokeIdRef.current) return;

    if (tool === 'line') {
      setLinePreview(prev => prev ? { ...prev, x2: x, y2: y } : null);
      return;
    }

    if (tool === 'donut' || tool === 'circle') {
      // Calculate radius
      // circlePreview has x,y (center).
      setShapePreview(prev => {
        if (!prev) return null;
        const r = Math.sqrt(Math.pow(x - prev.x, 2) + Math.pow(y - prev.y, 2));
        return { ...prev, r };
      });
      return;
    }

    socketRef.current?.emit('drawPoint', { id: currentStrokeIdRef.current, x, y });
  };

  const endStroke = () => {
    if (tool === 'line' && linePreview && currentStrokeIdRef.current) {
      // Emit the final point to complete the line
      socketRef.current?.emit('drawPoint', { id: currentStrokeIdRef.current, x: linePreview.x2, y: linePreview.y2 });
      setLinePreview(null);
    }

    if ((tool === 'donut' || tool === 'circle') && shapePreview && currentStrokeIdRef.current) {
      // We emit the final point which determines the radius (Center is Point 0, Radius Point is Point 1)
      socketRef.current?.emit('drawPoint', { id: currentStrokeIdRef.current, x: shapePreview.x + shapePreview.r, y: shapePreview.y });
      setShapePreview(null);
    }

    setIsDrawing(false);
    currentStrokeIdRef.current = null;
    socketRef.current?.emit('endStroke');
  };

  // Join handler is defined above (line 147)

  const handleClear = () => {
    console.log('Clear button clicked');
    // confirm() might be blocked or failing. Removing for now to ensure functionality.
    console.log('Emitting clearStrokes');
    if (socketRef.current) {
      socketRef.current.emit('clearStrokes');
    } else {
      console.error('Socket not connected');
    }
  };

  const handleSave = () => {
    try {
      const saveData = {
        pages: gameState.pages,
        currentPageIndex: gameState.currentPageIndex
      };
      const json = JSON.stringify(saveData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `xiv-sim-save-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();

      // Cleanup after a small delay to ensure the download triggers
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Save failed', err);
      alert('Failed to save file');
    }
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (socketRef.current) {
          socketRef.current.emit('restoreState', json);
        }
      } catch (err) {
        console.error('Failed to parse save file', err);
        alert('Invalid save file');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // Debuff Menu State
  const [showDebuffMenu, setShowDebuffMenu] = useState(false);
  // Remove duplicate countdown state here

  useEffect(() => {
    // ... cleanup?
  }, []);

  if (!isJoined) {
    return (
      <div className="app-container">
        <LandingPage
          onJoin={handleJoin}
          onCheckRoom={handleCheckRoom}
        />
        {joinError && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 0, 0, 0.8)',
            padding: '10px 20px',
            borderRadius: '4px',
            color: 'white',
            fontWeight: 'bold'
          }}>
            {joinError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111' }}>

      {/* Room Code Display */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: isMobile ? '60px' : '10px', // Shift left on mobile to avoid tools button if needed, or just below
        background: 'rgba(0, 0, 0, 0.6)',
        padding: '5px 10px',
        borderRadius: '4px',
        color: 'rgba(255, 255, 255, 0.7)',
        fontFamily: 'monospace',
        zIndex: 1000,
        fontSize: '14px',
        pointerEvents: 'none'
      }}>
        Room: <span style={{ color: 'white', fontWeight: 'bold' }}>{roomId}</span>
      </div>

      {/* Connection Status Indicator */}
      <div style={{
        position: 'absolute',
        top: '40px', // Below Room ID
        right: isMobile ? '60px' : '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 10px',
        borderRadius: '4px',
        background: 'rgba(0,0,0,0.4)',
        pointerEvents: 'none',
        zIndex: 1000
      }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isConnected ? '#4CAF50' : '#f44336',
          boxShadow: isConnected ? '0 0 5px #4CAF50' : 'none'
        }} />
        <span style={{
          fontSize: '12px',
          color: isConnected ? 'rgba(255,255,255,0.7)' : '#ff6b6b',
          fontWeight: isConnected ? 'normal' : 'bold'
        }}>
          {isConnected ? 'Connected' : 'Reconnecting...'}
        </span>
      </div>

      {/* ... (Config Toggle, Menu, Joystick, Tools Toggle, Color Picker) code omitted for brevity in search, focusing on insertion point */}

      {/* Debuff Menu Overlay */}
      {showDebuffMenu && (
        <DebuffMenu
          players={gameState.players}
          onApply={(debuffUpdates, limitCutUpdates, useCountdown) => {
            if (socketRef.current) {
              if (useCountdown) {
                socketRef.current.emit('startDebuffCountdown', {
                  debuffs: debuffUpdates,
                  limitCuts: limitCutUpdates
                });
              } else {
                socketRef.current.emit('updateDebuffs', debuffUpdates);
                socketRef.current.emit('updateLimitCuts', limitCutUpdates);
              }
            }
          }}
          onClose={() => setShowDebuffMenu(false)}
        />
      )}

      {/* Config Menu */}
      {
        (showConfig || !isMobile) && (
          <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 120 }}>
            <div style={{ position: 'relative' }}>
              <ConfigMenu
                config={currentPage.config}
                onUpdate={handleConfigUpdate}
                onSetDebuffs={() => setShowDebuffMenu(true)}
                onClearDebuffs={() => {
                  if (socketRef.current) {
                    const updates: Record<string, number[]> = {};
                    Object.keys(gameState.players).forEach(id => {
                      updates[id] = [];
                    });
                    socketRef.current.emit('updateDebuffs', updates);
                  }
                }}
                onLimitCut={() => {
                  if (socketRef.current) {
                    socketRef.current.emit('limitCut');
                  }
                }}
                onClearLimitCut={() => {
                  if (socketRef.current) {
                    socketRef.current.emit('clearLimitCut');
                  }
                }}
              />
              {isMobile && (
                <button
                  onClick={() => setShowConfig(false)}
                  style={{ position: 'absolute', top: -10, right: -10, background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer' }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )
      }

      {/* Mobile Joystick - Bottom Left */}
      {
        isMobile && (
          <div style={{ position: 'absolute', bottom: 80, left: 80, zIndex: 200 }}>
            <Joystick
              size={100}
              sticky={false}
              baseColor="#333"
              stickColor="#555"
              move={handleJoystickMove}
              stop={handleJoystickStop}
            />
          </div>
        )
      }

      {/* Tools Toggle (Mobile) */}
      {
        isMobile && !showTools && (
          <button
            onClick={() => setShowTools(true)}
            style={{
              position: 'absolute', top: 20, right: 20, zIndex: 110,
              background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px', padding: '10px'
            }}
          >
            🎨
          </button>
        )
      }

      {/* Color Picker UI */}
      {
        (showTools || !isMobile) && (
          <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(30,30,30,0.9)', padding: '15px', borderRadius: '8px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isMobile && (
              <button
                onClick={() => setShowTools(false)}
                style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer', padding: 0, margin: '-5px 0 0 0' }}
              >
                ×
              </button>
            )}

            {/* Color Grid */}
            <div>
              <h3 style={{ margin: '0 0 10px', color: '#eee', fontFamily: 'sans-serif', fontSize: '14px' }}>Paint Color</h3>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxWidth: '150px' }}>
                {[0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0xCC5500].map(color => (
                  <div
                    key={color}
                    onClick={() => {
                      setTool('brush');
                      setSelectedColor(color);
                    }}
                    style={{
                      width: '30px',
                      height: '30px',
                      backgroundColor: '#' + color.toString(16).padStart(6, '0'),
                      border: (tool === 'brush' && selectedColor === color) ? '2px solid white' : '1px solid #555',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                  />
                ))}

              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: '#555', margin: '5px 0' }}></div>

            {/* Tools */}
            <div>
              <h3 style={{ margin: '0 0 10px', color: '#eee', fontFamily: 'sans-serif', fontSize: '14px' }}>Tools</h3>
              <div className="tool-grid">
                <button
                  className={`tool-button ${tool === 'eraser' ? 'active' : ''}`}
                  onClick={() => setTool('eraser')}
                >
                  Eraser
                </button>
                <button
                  className={`tool-button ${tool === 'line' ? 'active' : ''}`}
                  onClick={() => setTool('line')}
                >
                  Line
                </button>
                <button
                  className={`tool-button ${tool === 'donut' ? 'active' : ''}`}
                  onClick={() => setTool('donut')}
                >
                  Donut
                </button>
                <button
                  className={`tool-button ${tool === 'circle' ? 'active' : ''}`}
                  onClick={() => setTool('circle')}
                >
                  Circle
                </button>
                <button
                  className={`tool-button ${tool === 'text' ? 'active' : ''}`}
                  onClick={() => setTool('text')}
                >
                  Text
                </button>
                <button
                  className="tool-button warning"
                  onClick={() => socketRef.current?.emit('undoStroke')}
                >
                  Undo
                </button>
                <button
                  className="tool-button danger"
                  onClick={handleClear}
                  style={{ gridColumn: 'span 2' }}
                >
                  Clear All
                </button>
              </div>

              {/* Save/Load */}
              <div style={{ display: 'flex', gap: '5px' }}>
                <button
                  onClick={handleSave}
                  style={{
                    padding: '8px',
                    background: '#4CAF50',
                    border: '1px solid #388E3C',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  Save
                </button>
                <label style={{
                  padding: '8px',
                  background: '#2196F3',
                  border: '1px solid #1976D2',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 0
                }}>
                  Load
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleLoad}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            {/* Line Width Slider */}
            <div>
              <h3 style={{ margin: '10px 0 5px', color: '#eee', fontFamily: 'sans-serif', fontSize: '14px' }}>Size: {lineWidth}px</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="range"
                  min="1"
                  max="40"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  style={{ width: '100px' }}
                />
                {/* Size Indicator */}
                <div style={{
                  width: '45px',
                  height: '45px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: lineWidth + 'px',
                    height: lineWidth + 'px',
                    background: tool === 'eraser' ? '#fff' : '#' + selectedColor.toString(16).padStart(6, '0'),
                    borderRadius: '50%',
                    border: tool === 'eraser' ? '1px solid #999' : 'none'
                  }} />
                </div>
              </div>
            </div>

            {!isMobile && (
              <WaymarkMenu
                activeMarker={activeMarker}
                onSelect={(m) => {
                  setActiveMarker(m);
                  if (m) setTool('brush'); // Ensure brush isn't eraser? Or purely visual.
                }}
                onClearAll={() => socketRef.current?.emit('clearMarkers')}
              />
            )}


          </div>
        )
      }


      {!isMobile && <h1 style={{ color: '#eee', fontFamily: 'sans-serif', marginBottom: '1rem' }}>FFXIV MSPaint Sim</h1>}

      <div style={{ color: '#aaa', marginBottom: '1rem', fontSize: isMobile ? '0.8rem' : '1rem' }}>
        {myId ? `Connected as ${gameState.players[myId]?.name || myId} (Room: ${roomId})` : 'Connecting...'}
        {!isMobile && <><br />Use W/A/S/D to move. Press Space to Honk. Click and drag in arena to paint.</>}
      </div>

      {/* Party List Container */}
      <div style={{
        position: 'absolute',
        top: isMobile ? 50 : 320, // Mobile: Top center. Desktop: Left column (lower to clear Config Menu).
        left: isMobile ? '50%' : 20,
        transform: isMobile ? 'translateX(-50%)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        alignItems: isMobile ? 'center' : 'flex-start',
        zIndex: 150 // Ensure above arena
      }}>
        <PartyList players={gameState.players} myId={myId} />
      </div>

      {/* Countdown Overlay */}
      {
        countdown && (
          <div style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '8rem',
            fontWeight: 'bold',
            color: '#FFD700', // Gold
            textShadow: '0 0 20px #000, 2px 2px 0px #000',
            fontFamily: "'Outfit', sans-serif",
            pointerEvents: 'none',
            zIndex: 1000
          }}>
            {countdown}
          </div>
        )
      }

      {/* Config Menu Toggle (Mobile) */}
      {
        isMobile && !showConfig && (
          <button
            onClick={() => setShowConfig(true)}
            style={{
              position: 'absolute', top: 20, left: 20, zIndex: 110,
              background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px', padding: '10px'
            }}
          >
            ⚙️
          </button>
        )
      }

      <div style={{ position: 'relative', width: 800 * scale, height: 600 * scale }}>
        <Arena
          players={gameState.players}
          myId={socketRef.current?.id}
          config={gameState.pages[gameState.currentPageIndex].config}
          strokes={gameState.pages[gameState.currentPageIndex].strokes}
          onStrokeStart={startStroke}
          onStrokeMove={moveStroke}
          onStrokeEnd={endStroke}
          scale={scale}
          honkingPlayers={honkingPlayers}
          markers={gameState.pages[gameState.currentPageIndex].markers}
          linePreview={linePreview}
          shapePreview={shapePreview}
          text={gameState.pages[gameState.currentPageIndex].text}
          currentTool={tool}
          currentColor={selectedColor}
          currentWidth={lineWidth}
        />
        {textInput && (
          <input
            ref={textInputRef}
            autoFocus
            style={{
              position: 'absolute',
              left: textInput.x * scale,
              top: textInput.y * scale,
              transform: 'translate(0, -100%)',
              zIndex: 1000,
              background: 'rgba(0,0,0,0.5)',
              color: '#' + selectedColor.toString(16).padStart(6, '0'),
              border: '1px solid white',
              padding: '5px',
              borderRadius: '4px',
              fontSize: Math.max(12, lineWidth * 2) + 'px',
              fontFamily: 'Arial',
              textShadow: '0 0 2px black'
            }}
            value={textInput.value}
            onChange={e => setTextInput({ ...textInput, value: e.target.value })}
            onKeyDown={e => {
              e.stopPropagation(); // Stop bubbling to game keys
              if (e.key === 'Enter') {
                if (textInput.value.trim()) {
                  socketRef.current?.emit('addText', {
                    id: Math.random().toString(36).substr(2, 9),
                    x: textInput.x,
                    y: textInput.y,
                    text: textInput.value,
                    color: selectedColor,
                    fontSize: Math.max(12, lineWidth * 2)
                  });
                }
                setTextInput(null);
              } else if (e.key === 'Escape') {
                setTextInput(null);
              }
            }}
            onBlur={() => {
              // We do NOT auto-close on blur anymore to prevent premature closing.
              // Instead, we rely on startStroke or tool change or Enter/Esc to close it.
            }}
          />
        )}
      </div>

      {isJoined && (
        <PageControls
          pages={gameState.pages}
          currentPageIndex={gameState.currentPageIndex}
          onAddPage={handleAddPage}
          onDeletePage={handleDeletePage}
          onChangePage={handleChangePage}
        />
      )}

    </div>
  );
}

export default App
