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

// In production (Single Service), we want to connect to the same origin (relative path)
// If VITE_SOCKET_URL is set (e.g. for split hosting), use that.
// If dev, default to localhost.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? undefined : 'http://localhost:3001');

function App() {
  const [gameState, setGameState] = useState<GameState>({
    players: {},
    config: { shape: 'circle', width: 500, height: 500 },
    strokes: []
  });
  const socketRef = useRef<Socket | null>(null);
  const myIdRef = useRef<string | null>(null);

  const [hasJoined, setHasJoined] = useState(false);

  // Movement state
  const keysPressed = useRef<Record<string, boolean>>({});

  // Joystick state
  const joystickRef = useRef<{ x: number, y: number } | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // UI Visibility (Collapsed by default on mobile)
  const [showConfig, setShowConfig] = useState(!isMobile);
  const [showTools, setShowTools] = useState(!isMobile);
  const [scale, setScale] = useState(1);

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
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      myIdRef.current = socket.id || null;
    });

    socket.on('stateUpdate', (newState: GameState) => {
      setGameState(prevState => {
        const myId = socketRef.current?.id;
        if (myId && prevState.players[myId] && newState.players[myId]) {
          return {
            ...newState,
            players: {
              ...newState.players,
              [myId]: {
                ...newState.players[myId],
                x: prevState.players[myId].x,
                y: prevState.players[myId].y
              }
            }
          };
        }
        return newState;
      });
    });

    socket.on('joinError', (msg: string) => {
      alert(msg);
      setHasJoined(false);
    });

    socket.on('honk', (id: string) => {
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
      socket.disconnect();
    };
  }, []);

  // Input handling setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
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
        let newX = me.x + dx;
        let newY = me.y + dy;

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
        // For simple MVP, sending every frame is OK for local/LAN, but we should consider throttling.
        socket.emit('move', { x: newX, y: newY });
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
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeIdRef = useRef<string | null>(null);

  const startStroke = (x: number, y: number) => {
    const id = Math.random().toString(36).substr(2, 9);
    currentStrokeIdRef.current = id;
    setIsDrawing(true);
    socketRef.current?.emit('startStroke', {
      id,
      x,
      y,
      color: selectedColor,
      width: lineWidth,
      isEraser: tool === 'eraser'
    });
  };

  const moveStroke = (x: number, y: number) => {
    if (!isDrawing || !currentStrokeIdRef.current) return;
    socketRef.current?.emit('drawPoint', { id: currentStrokeIdRef.current, x, y });
  };

  const endStroke = () => {
    setIsDrawing(false);
    currentStrokeIdRef.current = null;
    socketRef.current?.emit('endStroke');
  };

  const handleJoin = (name: string, color: number, role: 'tank' | 'healer' | 'dps' | 'spectator') => {
    if (socketRef.current) {
      socketRef.current.emit('joinGame', { name, color, role });
      setSelectedColor(color);
      setHasJoined(true);
    }
  };

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

  // Debuff Menu State
  const [showDebuffMenu, setShowDebuffMenu] = useState(false);
  const [countdown, setCountdown] = useState<string | null>(null);

  const handleApplyDebuffs = (updates: Record<string, number[]>) => {
    if (socketRef.current) {
      // Use the new countdown event instead of immediate update
      socketRef.current.emit('startDebuffCountdown', updates);
    }
  };

  useEffect(() => {
    if (!socketRef.current) return;

    socketRef.current.on('countdown', (text: string | null) => {
      setCountdown(text);
    });

    return () => {
      socketRef.current?.off('countdown');
    };
  }, [socketRef.current]);

  if (!hasJoined) {
    // ... no change to this logic, just ensuring context
    const playersList = Object.values(gameState.players);
    const takenNames = playersList.map(p => p.name);
    const takenColors = playersList
      .filter(p => p.role !== 'spectator')
      .map(p => p.color);

    return <LandingPage onJoin={handleJoin} takenNames={takenNames} takenColors={takenColors} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111' }}>

      {/* ... (Config Toggle, Menu, Joystick, Tools Toggle, Color Picker) code omitted for brevity in search, focusing on insertion point */}

      {/* Debuff Menu Overlay */}
      {showDebuffMenu && (
        <DebuffMenu
          players={gameState.players}
          onApply={handleApplyDebuffs}
          onClose={() => setShowDebuffMenu(false)}
        />
      )}

      {/* Existing Config Menu Logic... handled above in code flow but visual placement next */}

      {!isMobile && <h1 style={{ color: '#eee', fontFamily: 'sans-serif', marginBottom: '1rem' }}>FFXIV MSPaint Sim</h1>}

      <div style={{ color: '#aaa', marginBottom: '1rem', fontSize: isMobile ? '0.8rem' : '1rem' }}>
        {myId ? `Connected as ${gameState.players[myId]?.name || myId}` : 'Connecting...'}
        {!isMobile && <><br />Use W/A/S/D to move. Press Space to Honk. Click and drag in arena to paint.</>}
      </div>

      {/* Party List and Debuff Button Container */}
      <div style={{ position: 'absolute', top: 170, left: 20, display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
        <PartyList players={gameState.players} myId={myId} />

        <button
          onClick={() => setShowDebuffMenu(true)}
          style={{
            background: '#333',
            border: '1px solid #555',
            color: '#eee',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '12px',
            width: '100%' // Match Party List width roughly
          }}
        >
          Set Debuffs
        </button>
        <button
          onClick={() => {
            if (socketRef.current) {
              const updates: Record<string, number[]> = {};
              Object.keys(gameState.players).forEach(id => {
                updates[id] = [];
              });
              socketRef.current.emit('updateDebuffs', updates);
            }
          }}
          style={{
            background: '#d9534f',
            border: '1px solid #d43f3a',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '12px',
            width: '100%'
          }}
        >
          Clear Debuffs
        </button>
      </div>

      {/* Countdown Overlay */}
      {countdown && (
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
      )}

      {/* Config Menu Toggle (Mobile) */}
      {isMobile && !showConfig && (
        <button
          onClick={() => setShowConfig(true)}
          style={{
            position: 'absolute', top: 20, left: 20, zIndex: 110,
            background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px', padding: '10px'
          }}
        >
          ⚙️
        </button>
      )}

      {/* Config Menu */}
      {(showConfig || !isMobile) && (
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 120 }}>
          <div style={{ position: 'relative' }}>
            <ConfigMenu config={gameState.config} onUpdate={handleConfigUpdate} />
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
      )}

      {/* Mobile Joystick - Bottom Left */}
      {isMobile && (
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
      )}

      {/* Tools Toggle (Mobile) */}
      {isMobile && !showTools && (
        <button
          onClick={() => setShowTools(true)}
          style={{
            position: 'absolute', top: 20, right: 20, zIndex: 110,
            background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '4px', padding: '10px'
          }}
        >
          🎨
        </button>
      )}

      {/* Color Picker UI */}
      {(showTools || !isMobile) && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={() => setTool('eraser')}
                style={{
                  padding: '8px',
                  background: tool === 'eraser' ? '#4a90e2' : '#333',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Eraser
              </button>
              <button
                onClick={handleClear}
                style={{
                  padding: '8px',
                  background: '#d9534f',
                  border: '1px solid #d43f3a',
                  borderRadius: '4px',
                  color: 'white',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Line Width Slider */}
          <div>
            <h3 style={{ margin: '10px 0 5px', color: '#eee', fontFamily: 'sans-serif', fontSize: '14px' }}>Size: {lineWidth}px</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="range"
                min="1"
                max="20"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                style={{ width: '100px' }}
              />
              {/* Size Indicator */}
              <div style={{
                width: '20px',
                height: '20px',
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

        </div>
      )}



      <Arena
        players={gameState.players}
        myId={myId}
        config={gameState.config}
        strokes={gameState.strokes}
        onStrokeStart={startStroke}
        onStrokeMove={moveStroke}
        onStrokeEnd={endStroke}
        scale={scale}
        honkingPlayers={honkingPlayers}
      />
    </div>
  );
}

export default App
