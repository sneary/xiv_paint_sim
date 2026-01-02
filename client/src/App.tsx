import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { Joystick } from 'react-joystick-component';
import './App.css';
import Arena from './components/Arena';
import ConfigMenu from './components/ConfigMenu';
import type { GameState, ArenaConfig } from './types';

import LandingPage from './components/LandingPage';

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
  const [debugInfo, setDebugInfo] = useState<string>("No Input");

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleJoystickMove = (event: any) => {
    // console.log('Joystick move:', event);
    if (event) {
      // Values seem to be null when stopped?
      // react-joystick-component usually returns x/y/direction/distance
      // Let's log it to be sure what we get on mobile.
      // console.log(event.x, event.y);
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
        // If we have a local position for ourselves, keep it (Client Prediction)
        // Otherwise, accept server state
        if (myId && prevState.players[myId] && newState.players[myId]) {
          // Create a merged state where WE stay where we are locally
          // This prevents rubber-banding when the server echoes back our old position
          return {
            ...newState,
            players: {
              ...newState.players,
              [myId]: {
                ...newState.players[myId], // Keep server props like color/role
                x: prevState.players[myId].x, // Keep local X
                y: prevState.players[myId].y  // Keep local Y
              }
            }
          };
        }
        return newState;
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Input handling setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
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
    const loop = setInterval(() => {
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
      const speed = 5;

      if (keys['w']) dy -= speed;
      if (keys['s']) dy += speed;
      if (keys['a']) dx -= speed;
      if (keys['d']) dx += speed;

      // Joystick override
      if (joystickRef.current) {
        // Joystick x/y are roughly -50 to 50 based on size 100
        const jx = joystickRef.current.x;
        const jy = joystickRef.current.y;
        // Normalize to speed (max throw is roughly 50)
        dx += (jx / 50) * speed;
        dy -= (jy / 50) * speed; // Joystick Y is inverted relative to screen coords
      }

      if (dx !== 0 || dy !== 0) {
        const newX = me.x + dx;
        const newY = me.y + dy;

        // 1. Optimistic Local Update (Client Prediction)
        // We update our own state IMMEDIATELY so it feels responsive
        setGameState(prev => ({
          ...prev,
          players: {
            ...prev.players,
            [myId]: { ...prev.players[myId], x: newX, y: newY }
          }
        }));

        // 2. Send to Server
        socket.emit('move', { x: newX, y: newY });
      }
    }, 20); // Increased tick rate slightly for smoother local feel (50fps)

    return () => clearInterval(loop);
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

  const handleJoin = (name: string, color: number) => {
    if (socketRef.current) {
      socketRef.current.emit('joinGame', { name, color });
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

  if (!hasJoined) {
    return <LandingPage onJoin={handleJoin} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#111' }}>
      <ConfigMenu config={gameState.config} onUpdate={handleConfigUpdate} />

      {/* Mobile Joystick - Bottom Left */}
      {isMobile && (
        <div style={{ position: 'absolute', bottom: 30, left: 30, zIndex: 200 }}>
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

      {/* Color Picker UI */}
      <div style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(30,30,30,0.9)', padding: '15px', borderRadius: '8px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Color Grid */}
        <div>
          <h3 style={{ margin: '0 0 10px', color: '#eee', fontFamily: 'sans-serif', fontSize: '14px' }}>Paint Color</h3>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', maxWidth: '150px' }}>
            {[0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffffff, 0x000000].map(color => (
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

      <h1 style={{ color: '#eee', fontFamily: 'sans-serif', marginBottom: '1rem' }}>FFXIV MSPaint Sim</h1>
      <div style={{ color: '#aaa', marginBottom: '1rem' }}>
        {myId ? `Connected as ${gameState.players[myId]?.name || myId}` : 'Connecting...'}
        <br />
        Use W/A/S/D to move. Click and drag in arena to paint.
        <br />
        Debug: {debugInfo}
      </div>
      <Arena
        players={gameState.players}
        myId={myId}
        config={gameState.config}
        strokes={gameState.strokes}
        onStrokeStart={startStroke}
        onStrokeMove={moveStroke}
        onStrokeEnd={endStroke}
      />
    </div>
  );
}

export default App
