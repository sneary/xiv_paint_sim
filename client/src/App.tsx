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
import CollapsibleSection from './components/CollapsibleSection';
import PageControls from './components/PageControls';

// In production, we connect DIRECTLY to Cloud Run to bypass Firebase Hosting proxy latency.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? 'https://xiv-paint-sim-366274758228.us-south1.run.app' : 'http://localhost:3001');

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
  // Loading State
  const [isProcessing, setIsProcessing] = useState(false);

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
  // UI Visibility
  const [showConfig, setShowConfig] = useState(!isMobile);
  const [showTools, setShowTools] = useState(!isMobile);

  // Sub-menu states (Default: Tools open, Waymarks closed)
  const [isToolsOpen, setIsToolsOpen] = useState(!isMobile);
  const [isWaymarksOpen, setIsWaymarksOpen] = useState(false);

  const [scale, setScale] = useState(1);

  // Helper to safely get current page
  // Helper to safely get current page (unused, removed)

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Default to shown on desktop, but allow closing
      if (showConfig === undefined) setShowConfig(true);
      if (showTools === undefined) setShowTools(true);

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

  // Mute State
  const [muteHonks, setMuteHonks] = useState(false);
  const muteHonksRef = useRef(false);
  useEffect(() => { muteHonksRef.current = muteHonks; }, [muteHonks]);

  // Handlers for Config Menu (Hoist them here or use inline, but defining is cleaner)
  const handleClearDebuffs = () => {
    if (socketRef.current) {
      const updates: Record<string, number[]> = {};
      // We need to access current gameState players... 
      // Ideally we pass this logic or define it where gameState is accessible.
      // gameState is state, so accessible here.
      Object.keys(gameState.players).forEach(id => {
        updates[id] = [];
      });
      socketRef.current.emit('updateDebuffs', updates);
    }
  };

  const handleLimitCut = () => {
    socketRef.current?.emit('limitCut');
  };

  const handleClearLimitCut = () => {
    socketRef.current?.emit('clearLimitCut');
  };

  // Socket Events
  useEffect(() => {
    // If we have a socket already, don't recreate unless URL changed (it won't)
    // Actually, simple way: Just create one socket.
    // Use polling AND websocket for better reliability on Cloud Run / Firebase cold starts
    const newSocket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      upgrade: true,
      reconnectionAttempts: 5
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected to server via', newSocket.io.engine.transport.name);
      setIsConnected(true);
      setJoinError(''); // Clear error on connect

      // Auto-rejoin if we were previously in a game
      if (lastJoinOptions.current) {
        console.log('Auto-rejoining game...');
        // Add a small delay to ensure server is ready or to avoid race conditions
        setTimeout(() => {
          newSocket.emit('joinGame', lastJoinOptions.current);
        }, 100);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err);
      // We can set a visible error state here if needed, or rely on isConnected being false
      // Maybe setJoinError to show it on landing page?
      setJoinError(`Connection Error: ${err.message}`);
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

    // Loading State was here (removed)

    // ... (keep existing useEffects)

    newSocket.on('joinSuccess', (data: { roomId: string }) => {
      setRoomId(data.roomId);
      setIsJoined(true);
      setJoinError('');
      setIsProcessing(false); // Stop loading

      // Update persistence so if we crash/reconnect, we rejoin THIS room, not create a new one
      if (lastJoinOptions.current) {
        lastJoinOptions.current.roomId = data.roomId;
        lastJoinOptions.current.action = 'join';
      }
    });

    newSocket.on('joinError', (msg: string) => {
      setJoinError(msg);
      setIsJoined(false);
      setIsProcessing(false); // Stop loading
    });

    newSocket.on('countdown', (val: string | null) => {
      setCountdown(val);
    });

    // Helper for sound
    const playHonkSound = () => {
      try {
        const audio = new Audio('/honk.mp3');
        audio.volume = 0.1; // Reduced volume as requested
        audio.play().catch(e => {
          console.warn('Honk playback failed (user interaction needed?):', e);
        });
      } catch (e) {
        console.error('Audio error', e);
      }
    };

    newSocket.on('honk', (id: string) => {
      // Trigger visual effect
      setHonkingPlayers(prev => ({ ...prev, [id]: Date.now() }));

      // Check mute state from ref
      if (!muteHonksRef.current) {
        playHonkSound();
      }

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
    if (socketRef.current && socketRef.current.connected) {
      console.log('Emitting joinGame:', data);
      setIsProcessing(true);
      setJoinError(''); // Clear previous errors

      socketRef.current.emit('joinGame', data);
      lastJoinOptions.current = data;

      // Timeout Safety Net
      setTimeout(() => {
        setIsProcessing(prev => {
          if (prev) {
            setJoinError('Server timed out. Please try again.');
            return false;
          }
          return false;
        });
      }, 10000); // 10 seconds timeout

    } else {
      console.error('Socket not connected');
      setJoinError('Socket not connected. Please wait...');
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
  const [secondaryColor, setSecondaryColor] = useState<number>(0x000000);
  const [customPalette, setCustomPalette] = useState<(number | null)[]>([null, null, null, null, null, null]);
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'line' | 'text' | 'donut' | 'circle' | 'cone'>('brush');
  const [showLoadWarning, setShowLoadWarning] = useState<boolean>(false);

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

  // Cone Interaction State
  const [conePreview, setConePreview] = useState<{ x: number, y: number, r: number, startAngle: number, endAngle: number, anticlockwise?: boolean } | null>(null);
  const conePhaseRef = useRef<number>(0); // 0: Idle, 1: Drag 1 (Radius), 2: Wait, 3: Drag 2 (Arc)
  const coneStartRef = useRef<{ x: number, y: number, r: number, startAngle: number, lastAngle: number, totalRotation: number } | null>(null);

  const startStroke = (x: number, y: number) => {
    // If placing a marker, do that instead of drawing
    if (activeMarker) {
      socketRef.current?.emit('placeMarker', { type: activeMarker, x, y });
      return;
    }

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
      if (tool === 'text') {
        setTextInput({ x, y, value: '' });
        setIsDrawing(false);
        return;
      }
    }

    if (tool === 'text') {
      setTextInput({ x, y, value: '' });
      setIsDrawing(false);
      return;
    }

    if (tool === 'cone') {
      if (conePhaseRef.current === 0) {
        // Start Phase 1: Center determined.
        conePhaseRef.current = 1;
        coneStartRef.current = { x, y, r: 0, startAngle: 0, lastAngle: 0, totalRotation: 0 };
        setShapePreview({ x, y, r: 0 }); // Start with 0 radius circle
        setConePreview(null);
        setIsDrawing(true);
      } else if (conePhaseRef.current === 2) {
        // Start Phase 3: Axis determined. Dragging for spread.
        conePhaseRef.current = 3;
        // Initialize winding tracking
        const start = coneStartRef.current;
        if (start) {
          const dx = x - start.x;
          const dy = y - start.y;
          const currentAngle = Math.atan2(dy, dx);
          coneStartRef.current = { ...start, lastAngle: currentAngle, totalRotation: 0 };
        }
        setIsDrawing(true);
      }
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
        type: tool
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

    if (tool === 'cone') {
      if (!isDrawing && conePhaseRef.current !== 2) return;
      const start = coneStartRef.current;
      if (!start) return;

      if (conePhaseRef.current === 1) {
        // Drag 1: Update Radius. Angle ignored for preview (Circle).
        const dx = x - start.x;
        const dy = y - start.y;
        const r = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx);
        coneStartRef.current = { ...start, r, startAngle: angle, lastAngle: angle, totalRotation: 0 };
        setShapePreview({ x: start.x, y: start.y, r });
        setConePreview(null);
      } else if (conePhaseRef.current === 2) {
        // Hover: Update Main Axis Angle. Preview: Circle + Line.
        // Radius is fixed from Phase 1.
        const angle = Math.atan2(y - start.y, x - start.x);
        coneStartRef.current = { ...start, startAngle: angle, lastAngle: angle, totalRotation: 0 };

        setShapePreview({ x: start.x, y: start.y, r: start.r }); // Keep circle
        setConePreview({ x: start.x, y: start.y, r: start.r, startAngle: angle, endAngle: angle, anticlockwise: false }); // Show Axis
      } else if (conePhaseRef.current === 3) {
        // Drag 2: Update Spread.
        const dx = x - start.x;
        const dy = y - start.y;
        const currentAngle = Math.atan2(dy, dx);

        // Calculate winding
        let diff = currentAngle - start.lastAngle;
        // Normalize -PI to PI
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;

        const newTotal = start.totalRotation + diff;
        coneStartRef.current = { ...start, lastAngle: currentAngle, totalRotation: newTotal };

        const anticlockwise = newTotal < 0;
        setShapePreview({ x: start.x, y: start.y, r: start.r });
        setConePreview({ x: start.x, y: start.y, r: start.r, startAngle: start.startAngle, endAngle: currentAngle, anticlockwise });
      }
      return;
    }

    if (!isDrawing || !currentStrokeIdRef.current) return;

    if (tool === 'line') {
      setLinePreview(prev => prev ? { ...prev, x2: x, y2: y } : null);
      return;
    }

    if (tool === 'donut' || tool === 'circle') {
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
    if (tool === 'cone') {
      if (conePhaseRef.current === 1) {
        // End Phase 1. Go to Phase 2.
        conePhaseRef.current = 2;
        setIsDrawing(false);
        // Don't clear preview, we want the circle to persist in Phase 2 hover
      } else if (conePhaseRef.current === 3) {
        // Emit
        const start = coneStartRef.current;
        if (start && conePreview) {
          const id = Math.random().toString(36).substr(2, 9);
          const anticlockwise = start.totalRotation < 0;
          socketRef.current?.emit('startStroke', {
            id, x: start.x, y: start.y, color: selectedColor, width: lineWidth, isEraser: false, type: 'cone', anticlockwise
          });
          const p1x = start.x + start.r * Math.cos(start.startAngle);
          const p1y = start.y + start.r * Math.sin(start.startAngle);
          socketRef.current?.emit('drawPoint', { id, x: p1x, y: p1y });

          const p2x = start.x + start.r * Math.cos(conePreview.endAngle);
          const p2y = start.y + start.r * Math.sin(conePreview.endAngle);
          socketRef.current?.emit('drawPoint', { id, x: p2x, y: p2y });
          socketRef.current?.emit('endStroke');
        }
        conePhaseRef.current = 0;
        setConePreview(null);
        setShapePreview(null);
        setIsDrawing(false);
      }
      return;
    }

    if (tool === 'line' && linePreview && currentStrokeIdRef.current) {
      socketRef.current?.emit('drawPoint', { id: currentStrokeIdRef.current, x: linePreview.x2, y: linePreview.y2 });
      setLinePreview(null);
    }

    if ((tool === 'donut' || tool === 'circle') && shapePreview && currentStrokeIdRef.current) {
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
          isConnected={isConnected}
          socketId={socketRef.current?.id}
          isLoading={isProcessing}
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
            fontWeight: 'bold',
            zIndex: 1000
          }}>
            {joinError}
          </div>
        )}
        {!isConnected && (
          <div style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(255, 165, 0, 0.9)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            fontSize: '0.8rem',
            zIndex: 1000
          }}>
            ⚠ Disconnected (Reconnecting...)
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111' }}>



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
        showConfig && (
          <div style={{ position: 'absolute', top: 60, left: 10, zIndex: 120, transform: 'scale(0.9)', transformOrigin: 'top left' }}>
            <div style={{ position: 'relative' }}>
              <ConfigMenu
                config={gameState.pages[gameState.currentPageIndex].config}
                onUpdate={handleConfigUpdate}
                onSetDebuffs={() => setShowDebuffMenu(true)}
                onClearDebuffs={handleClearDebuffs}
                onLimitCut={handleLimitCut}
                onClearLimitCut={handleClearLimitCut}
                onClose={() => setShowConfig(false)}
              />
            </div>
          </div>
        )
      }

      {/* Floating Mute Button (Bottom Right) */}
      <div
        onClick={() => setMuteHonks(!muteHonks)}
        style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          width: 44,
          height: 44,
          borderRadius: '50%',
          backgroundColor: 'rgba(20, 20, 25, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 1000,
          color: muteHonks ? '#ff4444' : '#fff',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease'
        }}
        title={muteHonks ? "Unmute Honks" : "Mute Honks"}
      >
        {muteHonks ? (
          /* Muted Icon (Simple Cross) */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        ) : (
          /* Speaker Icon */
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        )}
      </div>

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

      {/* Tools Toggle (Visible when Tools are hidden) */}
      {
        !showTools && (
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

      {/* Status Indicator (Top Left) */}
      <div style={{
        position: 'absolute',
        top: 10, // Tighter to corner
        left: 10, // Moved to Left
        display: 'flex',
        gap: '12px', // Restored gap
        alignItems: 'center',
        zIndex: 110,
        background: 'rgba(0,0,0,0.8)',
        padding: '8px 16px', // Restored padding
        borderRadius: '20px', // Restored radius
        border: '1px solid #444',
        boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
        transform: isMobile ? 'scale(0.75)' : 'none', // Mobile: scaled down from larger base
        transformOrigin: 'top left'
      }}>
        {/* Connected Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: 8, // Restored dot size
            height: 8,
            borderRadius: '50%',
            background: isConnected ? '#4CAF50' : '#f44336',
            boxShadow: isConnected ? '0 0 3px #4CAF50' : 'none'
          }} />
          <span style={{ color: '#eee', fontSize: '13px', fontFamily: 'sans-serif', fontWeight: 500 }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Room Code */}
        {roomId && (
          <div style={{
            display: 'flex', alignItems: 'center', // Ensure vertical alignment
            color: '#fff',
            fontSize: '13px', // Restored font size
            fontFamily: 'sans-serif',
            borderLeft: '1px solid #666',
            paddingLeft: '12px', // Restored padding
            height: '100%', // Full height for alignment
            letterSpacing: '0.5px'
          }}>
            Room: {roomId}
          </div>
        )}
      </div>

      {/* Color Picker UI */}
      {
        showTools && (
          <div style={{
            position: 'absolute',
            top: 10, // Moved to top
            right: 10, // Symmetrical with left
            background: isMobile ? 'rgba(20,20,20,0.95)' : 'rgba(30,30,30,0.9)',
            padding: '15px',
            borderRadius: '8px',
            zIndex: 100,
            maxHeight: '90vh',
            overflowY: 'auto',
            width: isMobile ? '265px' : '230px',
            overflowX: 'hidden',
            display: 'grid',
            gap: '10px',
            gridTemplateColumns: isMobile ? '1fr auto' : '1fr',
            gridTemplateRows: 'auto 1fr', // Auto for header, rest content
            gridTemplateAreas: isMobile ?
              `"header header"
               "colors size"
               "tools size"
               "waymarks size"`
              :
              `"header"
               "colors"
               "size"
               "tools"
               "waymarks"`
          }}>
            {/* Colors Header with Close Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid #444', paddingBottom: '5px', gridArea: 'header' }}>
              <h3 style={{ margin: 0, color: '#eee', fontFamily: 'sans-serif', fontSize: '14px' }}>Colors</h3>
              <button
                onClick={() => setShowTools(false)}
                style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '20px', cursor: 'pointer', padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            {/* Colors Section (Static) */}
            <div style={{ gridArea: 'colors' }}>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 30px)',
                gap: '6px',
              }}>
                {(() => {
                  const PALETTE_COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0xCC5500];
                  const renderSwatch = (color: number) => (
                    <div
                      key={color}
                      className={`color-swatch ${tool === 'brush' && selectedColor === color ? 'selected' : ''}`}
                      onClick={() => { setTool('brush'); setSelectedColor(color); }}
                      style={{ backgroundColor: '#' + color.toString(16).padStart(6, '0'), width: '100%', height: '100%' }}
                    />
                  );
                  const renderCustomSlot = (index: number) => {
                    const color = customPalette[index];
                    const isSelected = tool === 'brush' && selectedColor === color;
                    return (
                      <div
                        key={`custom-${index}`}
                        className={`custom-slot ${isSelected ? 'selected' : ''}`}
                        style={color !== null ? { backgroundColor: '#' + color.toString(16).padStart(6, '0') } : {}}
                      >
                        <input type="color" value={color !== null ? '#' + color.toString(16).padStart(6, '0') : '#000000'} onChange={(e) => {
                          const val = parseInt(e.target.value.replace('#', ''), 16);
                          const newPalette = [...customPalette];
                          newPalette[index] = val;
                          setCustomPalette(newPalette);
                          setSelectedColor(val);
                          setTool('brush');
                        }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }} />
                        {color === null && <span>+</span>}
                      </div>
                    );
                  };
                  return (
                    <>
                      {PALETTE_COLORS.slice(0, 4).map(renderSwatch)}
                      {renderCustomSlot(0)}
                      {renderCustomSlot(1)}
                      {PALETTE_COLORS.slice(4, 8).map(renderSwatch)}
                      {renderCustomSlot(2)}
                      {renderCustomSlot(3)}
                      <div className={`rainbow-button ${tool === 'brush' && !PALETTE_COLORS.includes(selectedColor) && !customPalette.includes(selectedColor) ? 'selected' : ''}`} style={{ position: 'relative', overflow: 'hidden', gridColumn: 'span 2', width: '100%' }}>
                        <input type="color" value={'#' + selectedColor.toString(16).padStart(6, '0')} onChange={(e) => { setSelectedColor(parseInt(e.target.value.replace('#', ''), 16)); setTool('brush'); }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0 }} />
                      </div>
                      <div className="swap-control" title="Swap Colors" style={{ gridColumn: 'span 2', width: '100%' }} onClick={() => { const old = selectedColor; setSelectedColor(secondaryColor); setSecondaryColor(old); }}>
                        <div className="swap-secondary" style={{ backgroundColor: '#' + secondaryColor.toString(16).padStart(6, '0') }} />
                        <div className="swap-primary" style={{ backgroundColor: '#' + selectedColor.toString(16).padStart(6, '0') }} />
                        <div className="swap-icon">↹</div>
                      </div>
                      {renderCustomSlot(4)}
                      {renderCustomSlot(5)}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Brush Size Section */}
            <div style={{
              gridArea: 'size',
              display: isMobile ? 'flex' : 'block',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center', // Center vertically in its grid cell
              borderLeft: isMobile ? '1px solid #444' : 'none',
              paddingLeft: isMobile ? '10px' : '0'
            }}>
              {!isMobile && <h3 style={{ margin: '0 0 10px', color: '#eee', fontFamily: 'sans-serif', fontSize: '14px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>Brush Size: {lineWidth}px</h3>}

              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column-reverse' : 'row',
                alignItems: 'center',
                gap: '15px',
                justifyContent: 'center',
                height: isMobile ? '100%' : 'auto'
              }}>
                {/* Slider */}
                <div style={isMobile ? {
                  display: 'flex',
                  alignItems: 'center',
                  height: '150px', // REDUCED HEIGHT back to 150px
                  width: '30px',
                  position: 'relative'
                } : { flex: 1 }}>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    style={isMobile ? {
                      writingMode: 'vertical-lr',
                      direction: 'rtl',
                      width: '30px',
                      height: '100%',
                      appearance: 'slider-vertical' as any
                    } : { width: '100%' }}
                  />
                </div>

                {/* Preview Dot */}
                <div style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', borderRadius: '4px', border: '1px solid #555', flexShrink: 0 }}>
                  <div style={{ width: lineWidth + 'px', height: lineWidth + 'px', background: tool === 'eraser' ? '#fff' : '#' + selectedColor.toString(16).padStart(6, '0'), borderRadius: '50%', border: tool === 'eraser' ? '1px solid #999' : 'none' }} />
                </div>
              </div>
            </div>

            {/* Tools Section */}
            <div style={{ gridArea: 'tools', ...(isMobile ? { maxWidth: '210px' } : {}) }}>
              <CollapsibleSection
                title={`Tools${tool ? ` (${tool.charAt(0).toUpperCase() + tool.slice(1)})` : ''}`}
                isOpen={isToolsOpen}
                onToggle={() => setIsToolsOpen(!isToolsOpen)}
              >
                <div className="tool-grid" style={isMobile ? { margin: 0 } : {}}>
                  {['brush', 'eraser', 'line', 'donut', 'circle', 'text', 'cone'].map(t => (
                    <button
                      key={t}
                      className={`tool-button ${tool === t ? 'active' : ''}`}
                      onClick={() => {
                        setTool(t as any);
                        if (isMobile) setIsToolsOpen(false); // Only collapse Tools section
                      }}
                    >
                      {t === 'cone' ? 'Cone' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                  <button className="tool-button warning" onClick={() => socketRef.current?.emit('undoStroke')}>Undo</button>
                  <button className="tool-button danger" onClick={handleClear} style={{ gridColumn: 'span 2' }}>Clear All</button>

                  {/* Save/Load (Moved Inside) */}
                  <button onClick={handleSave} style={{ gridColumn: 'span 1', background: '#4CAF50', border: '1px solid #388E3C', borderRadius: '4px', color: 'white', padding: '8px', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setShowLoadWarning(!showLoadWarning)} style={{ gridColumn: 'span 1', background: '#2196F3', border: '1px solid #1976D2', borderRadius: '4px', color: 'white', padding: '8px', cursor: 'pointer' }}>Load</button>
                </div>

                {/* Load Warning Flow (Inside Tools now) */}
                {showLoadWarning && (
                  <div style={{ marginTop: '10px', padding: '10px', background: '#330000', border: '1px solid #ff4444', borderRadius: '4px' }}>
                    <div style={{ color: '#ff4444', fontSize: '12px', marginBottom: '10px' }}>
                      Warning: Loading will fully replace all current pages.
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <label style={{ padding: '5px 10px', background: '#d32f2f', border: '1px solid #b71c1c', borderRadius: '4px', color: 'white', fontSize: '12px', display: 'inline-block', cursor: 'pointer' }}>
                        Confirm Load
                        <input type="file" accept=".json" onChange={(e) => { handleLoad(e); setShowLoadWarning(false); }} style={{ display: 'none' }} />
                      </label>
                      <button onClick={() => setShowLoadWarning(false)} style={{ padding: '5px 10px', background: '#555', border: '1px solid #777', borderRadius: '4px', color: 'white', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </CollapsibleSection>
            </div>

            {/* Waymarks Section (Universal) */}
            <div style={{ gridArea: 'waymarks', ...(isMobile ? { maxWidth: '210px' } : {}) }}>
              <CollapsibleSection
                title={`Waymarks${activeMarker ? ` (${activeMarker})` : ''}`}
                isOpen={isWaymarksOpen}
                onToggle={() => setIsWaymarksOpen(!isWaymarksOpen)}
              >
                <div style={isMobile ? { margin: 0 } : {}}>
                  <WaymarkMenu
                    activeMarker={activeMarker}
                    onSelect={(m) => {
                      setActiveMarker(m);
                      if (m) {
                        setTool('brush');
                        if (isMobile) setIsWaymarksOpen(false); // Only collapse Waymarks section
                      }
                    }}
                    onClearAll={() => socketRef.current?.emit('clearMarkers')}
                  />
                </div>
              </CollapsibleSection>
            </div>

          </div>
        )
      }


      {!isMobile && <h1 style={{ color: '#eee', fontFamily: 'sans-serif', marginBottom: '1rem' }}>XIV Paint Sim</h1>}

      <div style={{ color: '#aaa', marginBottom: '1rem', fontSize: isMobile ? '0.8rem' : '1rem' }}>
        {myId ? `Connected as ${gameState.players[myId]?.name || myId} (Room: ${roomId})` : 'Connecting...'}
        {!isMobile && <><br />Use W/A/S/D to move. Press Space to Honk. Click and drag in arena to paint.</>}
      </div>

      {/* Party List Container */}
      <div style={{
        position: 'absolute',
        top: isMobile ? '10px' : '320px', // Mobile: Top padding (match indicator). Desktop: Below Config.
        left: isMobile ? '50%' : '10px', // Mobile: Center. Desktop: Left aligned.
        transform: isMobile ? 'translateX(-50%) scale(0.9)' : 'none', // Mobile: Centered & 10% smaller
        transformOrigin: 'top center',
        zIndex: 50, // Lower layer
        // pointerEvents: 'none' // Removed to allow interaction if needed, though z-index handles layering
      }}>
        <PartyList
          players={gameState.players}
          myId={myId}
        />
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

      {/* Config Menu Toggle */}
      {
        !showConfig && (
          <button
            onClick={() => setShowConfig(true)}
            style={{
              position: 'absolute', top: 50, left: 10, zIndex: 110, // Moved down (50px) to clear Status Indicator
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
          conePreview={conePreview}
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

      {
        isJoined && (
          <PageControls
            pages={gameState.pages}
            currentPageIndex={gameState.currentPageIndex}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
            onChangePage={handleChangePage}
          />
        )
      }

    </div >
  );
}

export default App
