import { useEffect, useState, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { Joystick } from 'react-joystick-component';
import './App.css';
import Arena from './components/Arena';
import ConfigMenu from './components/ConfigMenu';
import { type GameState, type ArenaConfig, type Stroke, type TextObject, type Player, initialState } from './types';
import { hitTest, getSelectionBounds } from './utils';
import LandingPage from './components/LandingPage';
import PartyList from './components/PartyList';
import DebuffMenu from './components/DebuffMenu';
import WaymarkMenu from './components/WaymarkMenu';
import CollapsibleSection from './components/CollapsibleSection';
import PageControls from './components/PageControls';
import Credits from './components/Credits';
import Chat from './components/Chat';
import type { ChatMessage } from './types';
import InstanceTimer from './components/InstanceTimer';
import CastBar from './components/CastBar';

// In production, we connect DIRECTLY to Cloud Run to bypass Firebase Hosting proxy latency.
// CHECK: If running locally (localhost), use localhost even if built in PROD mode.
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ((import.meta.env.PROD && !isLocal) ? 'https://xiv-paint-sim-366274758228.us-south1.run.app' : 'http://localhost:3001');

function App() {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const socketRef = useRef<Socket | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');

  const [countdown, setCountdown] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // Loading State
  const [isProcessing, setIsProcessing] = useState(false);
  const [copyFeedbackSource, setCopyFeedbackSource] = useState<string | null>(null);

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
  const wasMovingRef = useRef<boolean>(false);
  // Physics state: Track position independently of React state to avoid frame drops/stutter
  const localPlayerRef = useRef<{ x: number, y: number } | null>(null);


  // Joystick state
  const joystickRef = useRef<{ x: number, y: number } | null>(null);

  // Knockback State
  const knockbackRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    startTime: number;
    duration: number;
  } | null>(null);

  // Remote Knockbacks (Map of PlayerID -> KnockbackState)
  const remoteKnockbacksRef = useRef<Record<string, { startX: number, startY: number, targetX: number, targetY: number, startTime: number, duration: number }>>({});

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // UI Visibility (Collapsed by default on mobile)
  // UI Visibility
  const [showConfig, setShowConfig] = useState(!isMobile);
  const [showTools, setShowTools] = useState(!isMobile);

  // Sub-menu states (Default: Tools open, Waymarks closed)
  const [isToolsOpen, setIsToolsOpen] = useState(!isMobile);
  const [isWaymarksOpen, setIsWaymarksOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [scale, setScale] = useState(1);
  const pinchRef = useRef<{ initialDist: number, initialScale: number } | null>(null);
  const manualScaleRef = useRef<boolean>(false);

  // Helper to safely get current page
  // Helper to safely get current page (unused, removed)

  // Fix Mobile Scroll/Drift
  // Fix Mobile Scroll/Drift
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (showConfig === undefined) setShowConfig(true);
      if (showTools === undefined) setShowTools(true);

      // Recalc Scale
      const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const hBuffer = mobile ? 20 : 50;
      const s = Math.min(w / 800, (h - hBuffer) / 600);
      
      if (!manualScaleRef.current) {
        setScale(s < 1 ? s : 1);
      }
    };

    window.addEventListener('resize', handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    // Initial call
    handleResize();

    // Persistence: Initialize Session ID
    const storedSessionId = localStorage.getItem('sessionId');
    if (!storedSessionId) {
      localStorage.setItem('sessionId', Math.random().toString(36).substring(2) + Date.now().toString(36));
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [showConfig, showTools]);





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

  const handleGrotesquerieAct2 = () => {
    if (!socketRef.current) return;

    // Logic ported from DebuffMenu.tsx
    const players = gameState.players;
    const allPlayers = Object.values(players);
    const thGroup: Player[] = [];
    const dpsGroup: Player[] = [];

    // Best effort role sorting
    allPlayers.forEach(p => {
      if (p.role === 'tank' || p.role === 'healer') {
        thGroup.push(p);
      } else if (p.role === 'dps') {
        dpsGroup.push(p);
      } else {
        dpsGroup.push(p);
      }
    });

    // Determine Alpha/Beta groups
    const groups = [thGroup, dpsGroup];
    const alphaIndex = Math.floor(Math.random() * groups.length);
    const alphaGroup = groups[alphaIndex];
    const betaGroup = groups[alphaIndex === 0 ? 1 : 0];

    // IDs
    const ID_ALPHA = 105;
    const ID_BETA = 106;
    const ID_1 = 101;
    const ID_2 = 102;
    const ID_3 = 103;
    const ID_4 = 104;
    const NUMBERS = [ID_1, ID_2, ID_3, ID_4];

    const updates: Record<string, number[]> = {};

    // Helper to shuffle
    const shuffle = <T,>(array: T[]): T[] => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    const processGroup = (group: Player[], greekId: number) => {
      const shuffledPlayers = shuffle(group);
      // Shuffle numbers so that a small group doesn't always get 1, 2...
      const shuffledNumbers = shuffle([...NUMBERS]);

      shuffledPlayers.forEach((p, i) => {
        const numId = i < 4 ? shuffledNumbers[i] : undefined;
        const db: number[] = [];
        if (numId) db.push(numId);
        db.push(greekId);
        updates[p.id] = db;
      });
    };

    processGroup(alphaGroup, ID_ALPHA);
    processGroup(betaGroup, ID_BETA);

    // Apply instantly
    // We only send updates for players that changed? Or all?
    // updateDebuffs expects a map of ALL debuffs to overwrite, 
    // OR just updates? Server implementation usually merges or overwrites.
    // Based on handleClearDebuffs above, it seems we send { id: [] } to clear.
    // So we should send { id: [new_mechanics] } for everyone involved.
    // Since we iterate allPlayers to build groups, 'updates' covers everyone in the room.
    socketRef.current.emit('updateDebuffs', updates);
  };

  const handleLimitCut = () => {
    socketRef.current?.emit('limitCut');
  };

  const handleClearLimitCut = () => {
    socketRef.current?.emit('clearLimitCut');
  };

  const handleCopyRoomId = (source: string) => {
    if (roomId) {
      navigator.clipboard.writeText(roomId).then(() => {
        setCopyFeedbackSource(source);
        setTimeout(() => setCopyFeedbackSource(null), 2000);
      }).catch(err => {
        console.error('Failed to copy room ID', err);
      });
    }
  };

  // Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'error' | 'done'>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importMessage, setImportMessage] = useState('');

  // Socket Events
  useEffect(() => {
    // If we have a socket already, don't recreate unless URL changed (it won't)
    // Actually, simple way: Just create one socket.
    // Use polling AND websocket for better reliability on Cloud Run / Firebase cold starts
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], // Prefer WebSocket
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnection: true,
      timeout: 20000
    });
    socketRef.current = newSocket;

    newSocket.on('connect', () => {
      console.log('Connected to server:', newSocket.id);
      setIsConnected(true);

      // Auto-rejoin if we were previously in a game
      if (lastJoinOptions.current) {
        console.log('Auto-rejoining game...');
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
      setJoinError(`Connection Error: ${err.message}`);
    });

    newSocket.on('chatMessage', (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg].slice(-50));
    });

    newSocket.on('stateUpdate', (newState: GameState) => {
      // Client-Side Authority:
      // If we are playing, IGNORE server's position for US.
      // We trust our local simulation.
      if (newSocket.id && newState.players[newSocket.id] && localPlayerRef.current) {
        // Keep our local position, but accept other data (role, color, etc)
        newState.players[newSocket.id].x = localPlayerRef.current.x;
        newState.players[newSocket.id].y = localPlayerRef.current.y;
      }

      // REMOTE ANIMATION OVERRIDE
      // Prevent server state (which might be laggy/stationary) from snapping animating players back
      const now = Date.now();
      Object.keys(remoteKnockbacksRef.current).forEach(pid => {
        const kb = remoteKnockbacksRef.current[pid];
        if (newState.players[pid]) {
          const elapsed = now - kb.startTime;
          if (elapsed < kb.duration) {
            const t = elapsed / kb.duration;
            newState.players[pid].x = kb.startX + (kb.targetX - kb.startX) * t;
            newState.players[pid].y = kb.startY + (kb.targetY - kb.startY) * t;
          } else {
            newState.players[pid].x = kb.targetX;
            newState.players[pid].y = kb.targetY;
          }
        }
      });

      setGameState(newState);
      if (newState.chatHistory) {
        setChatMessages(newState.chatHistory);
      }
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

    // --- KNOCKBACK LISTENER ---
    newSocket.on('forceKnockback', (data: { id: string, dx: number, dy: number, duration: number }) => {
      // We only care if *WE* are the target
      if (data.id === newSocket.id) {
        if (localPlayerRef.current) {
          const startX = localPlayerRef.current.x;
          const startY = localPlayerRef.current.y;
          const targetX = startX + data.dx;
          const targetY = startY + data.dy;

          knockbackRef.current = {
            active: true,
            startX,
            startY,
            targetX,
            targetY,
            startTime: Date.now(),
            duration: data.duration
          };
        }
      } else {
        // Remote Player
        const player = gameStateRef.current.players[data.id];
        if (player) {
          remoteKnockbacksRef.current[data.id] = {
            startX: player.x,
            startY: player.y,
            targetX: player.x + data.dx,
            targetY: player.y + data.dy,
            startTime: Date.now(),
            duration: data.duration
          };
        }
      }
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

    newSocket.on('importProgress', (data: { current: number, total: number, status: string }) => {
      setImportProgress(data.current);
      setImportTotal(data.total);
      setImportMessage(data.status);
    });

    newSocket.on('importError', (data: { message: string }) => {
      setImportStatus('error');
      setImportMessage(data.message);
      setIsProcessing(false);
    });

    newSocket.on('importComplete', () => {
      setImportStatus('done');
      setImportMessage('Import Complete!');
      setIsProcessing(false);
      setTimeout(() => {
        setShowImportModal(false);
        setImportStatus('idle');
      }, 1500);
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
    }, 5000); // Send heartbeat every 5s to keep server CPU awake (Anti-throttling aggressively)
    return () => clearInterval(interval);
  }, []);

  const handleJoin = (data: { action: 'create' | 'join', roomId?: string, name: string, color: number, role: 'tank' | 'healer' | 'dps' | 'spectator' }) => {
    if (socketRef.current && socketRef.current.connected) {
      console.log('Emitting joinGame:', data);
      setIsProcessing(true);
      setJoinError(''); // Clear previous errors

      // Seamless Reconnect: Send our last known local position if available
      const payload: any = { ...data };
      if (localPlayerRef.current) {
        payload.x = localPlayerRef.current.x;
        payload.y = localPlayerRef.current.y;
      }

      socketRef.current.emit('joinGame', payload);
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

  const handleDuplicatePage = () => {
    socketRef.current?.emit('duplicatePage');
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

  const handleImportRaidPlan = () => {
    setShowImportModal(true);
    setImportUrl('');
  };

  const executeImport = () => {
    if (!importUrl) return;
    if (!importUrl.includes('raidplan.io')) {
      alert("Invalid URL. Please use a raidplan.io link.");
      return;
    }

    setImportStatus('processing');
    setImportMessage('Initializing import...');
    setImportProgress(0);
    setImportTotal(0);

    // Emit socket event instead of HTTP fetch
    if (socketRef.current) {
      socketRef.current.emit('requestImport', importUrl);
    } else {
      setImportStatus('error');
      setImportMessage('Socket not connected.');
    }
  };

  // Input handling setup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Safety: If Alt or Meta (Windows) key is pressed, stop movement immediately
      if (e.key === 'Alt' || e.key === 'Meta' || e.key === 'Tab') {
        keysPressed.current = {};
        return;
      }

      // Undo Trigger (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        socketRef.current?.emit('undo');
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
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;

      // Limit dt to avoid wildly huge jumps if tab inactive
      const safeDt = Math.min(dt, 100);

      const myId = socketRef.current?.id;
      const me = gameStateRef.current.players[myId!];

      // Update Remote Animations
      const remoteIds = Object.keys(remoteKnockbacksRef.current);
      if (remoteIds.length > 0) {
        const dateNow = Date.now();
        const updatedPlayers: Record<string, Partial<Player>> = {};
        let hasUpdates = false;

        remoteIds.forEach(pid => {
          const kb = remoteKnockbacksRef.current[pid];
          const elapsed = dateNow - kb.startTime;

          if (elapsed < kb.duration) {
            const t = elapsed / kb.duration;
            updatedPlayers[pid] = {
              x: kb.startX + (kb.targetX - kb.startX) * t,
              y: kb.startY + (kb.targetY - kb.startY) * t
            };
            hasUpdates = true;
          } else {
            // Finish
            updatedPlayers[pid] = { x: kb.targetX, y: kb.targetY };
            hasUpdates = true;
            delete remoteKnockbacksRef.current[pid];
          }
        });

        if (hasUpdates) {
          setGameState(prev => {
            const newPlayers = { ...prev.players };
            Object.entries(updatedPlayers).forEach(([pid, pos]) => {
              if (newPlayers[pid]) {
                newPlayers[pid] = { ...newPlayers[pid], ...pos };
              }
            });
            return { ...prev, players: newPlayers };
          });
        }
      }

      if (!me) return;

      // Initialize or Sync Physics State if stale
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

      let newX = currentX;
      let newY = currentY;
      let moving = false;

      // KNOCKBACK OVERRIDE
      if (knockbackRef.current && knockbackRef.current.active) {
        const kb = knockbackRef.current;
        const nowMs = Date.now();
        const elapsed = nowMs - kb.startTime;

        if (elapsed < kb.duration) {
          // Interpolate
          const t = elapsed / kb.duration;
          // Linear interpolation
          newX = kb.startX + (kb.targetX - kb.startX) * t;
          newY = kb.startY + (kb.targetY - kb.startY) * t;
          dx = newX - currentX; // For "moving" check
          dy = newY - currentY;
          moving = true;
        } else {
          // Finish
          knockbackRef.current = null;
          // Force one last sync to target
          newX = kb.targetX;
          newY = kb.targetY;
          moving = true;
        }
      } else {
        // Normal Movement
        if (keysPressed.current['w']) dy -= moveAmount;
        if (keysPressed.current['s']) dy += moveAmount;
        if (keysPressed.current['a']) dx -= moveAmount;
        if (keysPressed.current['d']) dx += moveAmount;

        // Joystick override
        if (joystickRef.current) {
          const jx = joystickRef.current.x;
          const jy = joystickRef.current.y;
          // User confirmed values are -1 to 1.
          dx += jx * moveAmount;
          dy -= jy * moveAmount; // Joystick Y is inverted relative to screen coords
        }

        if (dx !== 0 || dy !== 0) {
          newX = currentX + dx;
          newY = currentY + dy;
          moving = true;
        }
      }

      if (moving) {
        // Boundary Checks

        // Boundary Checks - Keep within Drawable Area (Canvas 800x600)
        // We ignore the arena shape (Circle/Square) effectively allowing players to run "out of bounds" mechanic-wise,
        // but keeping them on screen.
        const playerRadius = 15; // 10 radius + 5 stroke/buffer
        // Wait, logic in this file seems to treat 800x600 as base. 
        // The previous logic used hardcoded centerX=400.
        // Let's stick to 800x600 base coord system which matches server state.

        // Clamp to current arena dimensions
        const currentPage = gameStateRef.current.pages[gameStateRef.current.currentPageIndex];
        // Default to 800x600 if no config or background, but our new pages have config.width/height
        const maxWidth = currentPage.config ? (currentPage.config.backgroundImageUrl ? currentPage.config.width : 800) : 800;
        const maxHeight = currentPage.config ? (currentPage.config.backgroundImageUrl ? currentPage.config.height : 600) : 600;

        // --- Collision Detection (Client Side - WASD) ---
        // Helper: Check if point (px, py) with radius r collides with any solid prop
        const isColliding = (px: number, py: number): boolean => {
          const props = gameStateRef.current.simulation.activeProps;
          const isKnockingBack = !!knockbackRef.current; // Check if we are in knockback state

          for (const p of props) {
            if (!p.isSolid) continue;

            // If we are being knocked back, and this prop ALLOWS knockbacks, ignore it.
            if (isKnockingBack && p.allowKnockback) continue;

            if (p.type === 'circle') {
              const rSum = (p.width || 0) + playerRadius;
              const diffX = px - p.x;
              const diffY = py - p.y;
              if ((diffX * diffX + diffY * diffY) < (rSum * rSum)) return true;
            } else if (p.type === 'rect') {
              // Simple AABB for unrotated rects, or rotated logic if needed.
              // Assuming unrotated for basic demo, or using the same logic as server hit check?
              // Let's implement Rotated Rect Check for robustness.
              const halfW = (p.width || 0) / 2;
              const halfH = (p.height || 0) / 2;
              // Transform point to local space of rect
              const rad = -(p.rotation || 0);
              const dx = px - p.x;
              const dy = py - p.y;
              const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
              const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

              // AABB Check in local space (Inflate rect by player radius roughly? Or just point check?)
              // Strictly speaking, circle vs rotated rect.
              // Approximation: Inflate rect by radius.
              if (
                localX > -halfW - playerRadius &&
                localX < halfW + playerRadius &&
                localY > -halfH - playerRadius &&
                localY < halfH + playerRadius
              ) {
                return true;
              }
            }
          }
          return false;
        };

        // Try moving full delta
        let potentialX = newX;
        let potentialY = newY;

        // If collision, try sliding (X only, then Y only)
        if (isColliding(potentialX, potentialY)) {
          // Try X only
          if (!isColliding(potentialX, currentY)) {
            potentialY = currentY;
          }
          // Try Y only
          else if (!isColliding(currentX, potentialY)) {
            potentialX = currentX;
          }
          // Blocked
          else {
            potentialX = currentX;
            potentialY = currentY;
          }
        }

        // Finalize
        newX = potentialX;
        newY = potentialY;

        // Boundary Check (after collision, to ensure we don't slide out of bounds)
        newX = Math.max(playerRadius, Math.min(newX, maxWidth - playerRadius));
        newY = Math.max(playerRadius, Math.min(newY, maxHeight - playerRadius));

        // Update Physics State Immediately
        localPlayerRef.current = { x: newX, y: newY };

        // 1. Optimistic Local Update (Client Prediction)
        // We update our own state IMMEDIATELY so it feels responsive
        setGameState(prev => ({
          ...prev,
          players: {
            ...prev.players,
            [myId!]: { ...prev.players[myId!], x: newX, y: newY }
          }
        }));

        // 2. Send to Server (Throttle this? For now, per frame movement emit might be high load but smoothest)
        // Optimization: Could throttle network sends to 20-30hz while simulating locally at high FPS.
        const now = performance.now();
        if (now - lastMoveEmit.current > 30) { // ~33 updates per second
          socketRef.current?.emit('move', { x: newX, y: newY });
          lastMoveEmit.current = now;
        }
      } else {
        // If we JUST stopped moving, send one final update to ensure server has exact position.
        // Otherwise, the last throttled update might be a few pixels off.
        if (wasMovingRef.current) {
          socketRef.current?.emit('move', { x: currentX, y: currentY });
          lastMoveEmit.current = performance.now();
        }
      }

      wasMovingRef.current = moving;
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
  const [opacity, setOpacity] = useState<number>(1);
  const [tool, setTool] = useState<'select' | 'brush' | 'eraser' | 'line' | 'text' | 'donut' | 'circle' | 'cone' | 'rect'>('brush');
  const [showLoadWarning, setShowLoadWarning] = useState<boolean>(false);

  // Clipboard & Shortcuts
  const [clipboard, setClipboard] = useState<{ strokes: Stroke[], text: TextObject[] } | null>(null);
  const mousePosRef = useRef<{ x: number, y: number } | null>(null);

  // Clear text input and selection when tool changes
  useEffect(() => {
    setTextInput(null);
    setSelectedIds([]);
    setSelectionBox(null);
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
  const [rectPreview, setRectPreview] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const conePhaseRef = useRef<number>(0);
  const coneStartRef = useRef<{ x: number, y: number, r: number, startAngle: number, lastAngle: number, totalRotation: number } | null>(null);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const dragStartRef = useRef<{ x: number, y: number, initialObjects: any } | null>(null); // Snapshot for diffing
  const isDraggingSelectionRef = useRef(false);
  const isBoxSelectingRef = useRef(false);



  const startStroke = (x: number, y: number) => {
    if (pinchRef.current) return;
    if (tool === 'rect') {
      setIsDrawing(true);
      currentStrokeIdRef.current = Math.random().toString(36).substr(2, 9);
      setRectPreview({ x, y, w: 0, h: 0 });
      return;
    }

    // If placing a marker, do that instead of drawing
    if (tool === 'select') {
      const page = gameState.pages[gameState.currentPageIndex];
      const hit = hitTest(x, y, page.strokes, page.text);
      const hitId = (hit && hit.type === 'object') ? hit.id : null;

      let clickingSelection = false;
      if (!hitId && selectedIds.length > 0) {
        // Check if inside selection bounds
        const sStrokes = page.strokes.filter(s => selectedIds.includes(s.id));
        const sText = page.text.filter(t => selectedIds.includes(t.id));
        const bounds = getSelectionBounds(selectedIds, sStrokes, sText);

        // Pad bounds slightly
        if (bounds && bounds.minX !== Infinity &&
          x >= bounds.minX - 10 && x <= bounds.maxX + 10 &&
          y >= bounds.minY - 10 && y <= bounds.maxY + 10) {
          clickingSelection = true;
        }
      }

      if (hitId) {
        // Hit something direct
        isBoxSelectingRef.current = false;
        if (selectedIds.includes(hitId)) {
          // Clicked on already selected item -> Start Move
          isDraggingSelectionRef.current = true;
        } else {
          // Clicked on new item -> Select it exclusive (TODO: Shift for add)
          setSelectedIds([hitId]);
          isDraggingSelectionRef.current = true;
        }

        // Snapshot initial positions for ALL selected items
        const selectedStrokes = page.strokes.filter(s => selectedIds.includes(s.id) || s.id === hitId).map(s => ({ ...s }));
        const selectedText = page.text.filter(t => selectedIds.includes(t.id) || t.id === hitId).map(t => ({ ...t }));

        dragStartRef.current = {
          x, y,
          initialObjects: { strokes: selectedStrokes, text: selectedText }
        };

      } else if (clickingSelection) {
        // Clicked inside bounds of existing selection
        isBoxSelectingRef.current = false;
        isDraggingSelectionRef.current = true;
        const selectedStrokes = page.strokes.filter(s => selectedIds.includes(s.id)).map(s => ({ ...s }));
        const selectedText = page.text.filter(t => selectedIds.includes(t.id)).map(t => ({ ...t }));

        dragStartRef.current = {
          x, y,
          initialObjects: { strokes: selectedStrokes, text: selectedText }
        };

      } else {
        // Hit nothing -> Start Box Selection
        setSelectedIds([]);
        setSelectionBox({ x, y, w: 0, h: 0 });
        isDraggingSelectionRef.current = false;
        isBoxSelectingRef.current = true;
      }
      return;
    }

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
        type: 'line',
        alpha: opacity
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
        type: tool,
        alpha: opacity
      });
    } else {
      socketRef.current?.emit('startStroke', {
        id,
        x,
        y,
        color: selectedColor,
        width: lineWidth,
        isEraser: tool === 'eraser',
        type: 'freehand',
        alpha: opacity
      });
    }
  };

  const moveStroke = (x: number, y: number) => {
    if (pinchRef.current) {
      if (isDrawing) {
        setIsDrawing(false);
        socketRef.current?.emit('endStroke', { id: currentStrokeIdRef.current });
      }
      return;
    }
    mousePosRef.current = { x, y };
    // Selection Tool Logic
    if (tool === 'select') {
      if (isDraggingSelectionRef.current && dragStartRef.current) {
        // Dragging Objects
        const dx = x - dragStartRef.current.x;
        const dy = y - dragStartRef.current.y;

        // Optimistically update GameState positions (Revert on End if needed, but here we just update)
        // We use setGameState function to ensure we don't stale-closure
        setGameState(prev => {
          // Shallow clone required
          return {
            ...prev,
            pages: prev.pages.map((p, i) => {
              if (i !== prev.currentPageIndex) return p;

              const newStrokes = p.strokes.map(s => {
                const init = dragStartRef.current?.initialObjects.strokes.find((is: any) => is.id === s.id);
                if (init) {
                  return {
                    ...s,
                    points: init.points.map((pt: any) => ({ x: pt.x + dx, y: pt.y + dy }))
                  };
                }
                return s;
              });

              const newText = p.text.map(t => {
                const init = dragStartRef.current?.initialObjects.text.find((it: any) => it.id === t.id);
                if (init) {
                  return { ...t, x: init.x + dx, y: init.y + dy };
                }
                return t;
              });

              return { ...p, strokes: newStrokes, text: newText };
            })
          };
        });

      } else if (isBoxSelectingRef.current) {
        // Box Selection
        setSelectionBox(prev => ({
          x: prev?.x ?? x, // Should be set in startStroke, but fallback
          y: prev?.y ?? y,
          w: x - (prev?.x ?? x),
          h: y - (prev?.y ?? y)
        }));
      }
      return;
    }

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

    if (tool === 'rect') {
      setRectPreview(prev => prev ? {
        ...prev,
        w: x - prev.x,
        h: y - prev.y
      } : null);
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
    // Selection Tool Logic
    if (tool === 'select') {
      if (isDraggingSelectionRef.current && dragStartRef.current) {
        // Did we actually move?
        // Optimistically we already updated local state.
        // Now we MUST emit the changes to server.
        const page = gameState.pages[gameState.currentPageIndex];

        const strokeUpdates: Partial<Stroke>[] = [];
        const textUpdates: Partial<TextObject>[] = [];

        // Find objects that moved (compare with initial)
        // Actually, just emit all selected objects' current state is safer?
        // No, sending delta or absolute? Server 'updateStrokes' takes Partial<Stroke>.

        const initStrokes = dragStartRef.current.initialObjects.strokes as Stroke[];
        const initText = dragStartRef.current.initialObjects.text as TextObject[];

        initStrokes.forEach(initIn => {
          const current = page.strokes.find(s => s.id === initIn.id);
          if (current) {
            // Check if changed
            // Ideally we check equality, but always emitting is fine for now
            strokeUpdates.push({ id: current.id, points: current.points });
          }
        });

        initText.forEach(initIn => {
          const current = page.text.find(t => t.id === initIn.id);
          if (current) {
            textUpdates.push({ id: current.id, x: current.x, y: current.y });
          }
        });

        if (strokeUpdates.length > 0) socketRef.current?.emit('updateStrokes', { updates: strokeUpdates });
        if (textUpdates.length > 0) socketRef.current?.emit('updateText', { updates: textUpdates });

      } else if (selectionBox) {
        // Commit Box Selection
        const { x, y, w, h } = selectionBox;
        // Normalize rect
        const bx = w < 0 ? x + w : x;
        const by = h < 0 ? y + h : y;
        const bw = Math.abs(w);
        const bh = Math.abs(h);

        const page = gameState.pages[gameState.currentPageIndex];
        const newSelected: string[] = [];

        // Box hit test
        // Text
        page.text.forEach(t => {
          if (t.x >= bx && t.x <= bx + bw && t.y >= by && t.y <= by + bh) { // simplified point in rect
            newSelected.push(t.id);
          }
        });
        // Strokes
        page.strokes.forEach(s => {
          // Check if ANY point is in rect? Or all? Usually Any.
          if (s.points.some(p => p.x >= bx && p.x <= bx + bw && p.y >= by && p.y <= by + bh)) {
            newSelected.push(s.id);
          }
        });

        setSelectedIds(newSelected);
        setSelectionBox(null);
      }

      dragStartRef.current = null;
      isDraggingSelectionRef.current = false;
      isBoxSelectingRef.current = false;
      return;
    }

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
            id, x: start.x, y: start.y, color: selectedColor, width: lineWidth, isEraser: false, type: 'cone', anticlockwise, alpha: opacity
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

    if (tool === 'rect' && rectPreview && currentStrokeIdRef.current) {
      const { x, y, w, h } = rectPreview;
      // Emit Start (Definition)
      socketRef.current?.emit('startStroke', {
        id: currentStrokeIdRef.current,
        x, y, // Start Point
        color: selectedColor,
        width: lineWidth,
        isEraser: false,
        type: 'rect',
        alpha: opacity
      });
      // Emit End Point (Top-Left + Size -> convert to p2)
      // Actually rect uses 2 points like line? Arena logic uses p1 and p2.
      // My preview uses x,y,w,h.
      // p1 = x,y. p2 = x+w, y+h.
      socketRef.current?.emit('drawPoint', { id: currentStrokeIdRef.current, x: x + w, y: y + h });
      // Clear
      setRectPreview(null);
    }

    if ((tool === 'donut' || tool === 'circle') && shapePreview && currentStrokeIdRef.current) {
      socketRef.current?.emit('drawPoint', { id: currentStrokeIdRef.current, x: shapePreview.x + shapePreview.r, y: shapePreview.y });
      setShapePreview(null);
    }

    setIsDrawing(false);
    currentStrokeIdRef.current = null;
    socketRef.current?.emit('endStroke');
  };

  // Global Mouse Up to handle releases outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing || isDraggingSelectionRef.current || isBoxSelectingRef.current) {
        endStroke();
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDrawing]);

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

  const handleSave = async () => {
    try {
      const pagesToSave = await Promise.all(gameState.pages.map(async (p) => {
        const page = JSON.parse(JSON.stringify(p)); // Deep clone
        if (page.config?.backgroundImageUrl && page.config.backgroundImageUrl.startsWith('/')) {
          try {
            // Fetch the local image
            const response = await fetch(page.config.backgroundImageUrl);
            const blob = await response.blob();
            // Convert to Base64
            const base64Data = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            page.config.backgroundImageUrl = base64Data;
          } catch (e) {
            console.error('Failed to inline image for save:', page.config.backgroundImageUrl, e);
            // Fallback: Check if it's already a data URI or keep path
          }
        }
        return page;
      }));

      const saveData = {
        pages: pagesToSave,
        currentPageIndex: gameState.currentPageIndex
      };

      const json = JSON.stringify(saveData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const timeStr = now.toLocaleTimeString('en-GB', { hour12: false }).replace(/:/g, '-'); // HH-MM-SS
      link.download = `xiv-paint-save-${dateStr}-${timeStr}.json`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
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

  // Slider Change Handlers
  const handleLineWidthChange = (val: number) => {
    setLineWidth(val);
    const updates: Partial<Stroke>[] = [];

    // Update active stroke if drawing
    if (currentStrokeIdRef.current) {
      updates.push({ id: currentStrokeIdRef.current, width: val });
    }

    if (selectedIds.length > 0) {
      const page = gameState.pages[gameState.currentPageIndex];
      selectedIds.forEach(id => {
        if (id !== currentStrokeIdRef.current) {
          const stroke = page.strokes.find(s => s.id === id);
          if (stroke) {
            updates.push({ id, width: val });
          }
        }
      });
    }
    if (updates.length > 0) socketRef.current?.emit('updateStrokes', { updates });
  };

  const handleOpacityChange = (val: number) => {
    setOpacity(val);
    const updates: Partial<Stroke>[] = [];

    // Update active stroke if drawing
    if (currentStrokeIdRef.current) {
      updates.push({ id: currentStrokeIdRef.current, alpha: val });
    }

    if (selectedIds.length > 0) {
      const page = gameState.pages[gameState.currentPageIndex];
      selectedIds.forEach(id => {
        if (id !== currentStrokeIdRef.current) {
          const stroke = page.strokes.find(s => s.id === id);
          if (stroke) {
            updates.push({ id, alpha: val });
          }
        }
      });
    }
    if (updates.length > 0) socketRef.current?.emit('updateStrokes', { updates });
  };

  // Debuff Menu State
  const [showDebuffMenu, setShowDebuffMenu] = useState(false);
  // Remove duplicate countdown state here

  useEffect(() => {
    // ... cleanup?
  }, []);

  // Ref pattern to access latest state in event listeners without re-binding
  const stateRef = useRef({
    gameState,
    selectedIds,
    textInput,
    clipboard,
    mousePos: mousePosRef.current
  });

  // Update ref on every render
  useEffect(() => {
    stateRef.current = {
      gameState,
      selectedIds,
      textInput,
      clipboard,
      mousePos: mousePosRef.current
    };
  });

  // Keyboard Shortcuts (Bound once)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { gameState, selectedIds, textInput, clipboard } = stateRef.current;

      console.log('Global KeyDown (Ref):', e.key, 'Ctrl:', e.ctrlKey || e.metaKey, 'Selected:', selectedIds.length);

      // Ignore if typing in text input (DOM check)
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
      // Also ignore if internal text input state is active
      if (textInput) return;

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          console.log('Delete Triggered. Items:', selectedIds.length);
          const page = gameState.pages[gameState.currentPageIndex];
          const strokeIds = page.strokes.filter(s => selectedIds.includes(s.id)).map(s => s.id);
          const textIds = page.text.filter(t => selectedIds.includes(t.id)).map(t => t.id);

          if (strokeIds.length > 0 || textIds.length > 0) {
            socketRef.current?.emit('deleteObjects', { strokeIds, textIds });
            setSelectedIds([]);
          }
        }
      }

      // Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (selectedIds.length > 0) {
          console.log('Copy Triggered. Items:', selectedIds.length);
          const page = gameState.pages[gameState.currentPageIndex];
          const strokes = page.strokes.filter(s => selectedIds.includes(s.id)).map(s => JSON.parse(JSON.stringify(s)));
          const text = page.text.filter(t => selectedIds.includes(t.id)).map(t => JSON.parse(JSON.stringify(t)));
          setClipboard({ strokes, text });
        }
      }

      // Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        const currentMouse = mousePosRef.current; // Use direct ref for mouse to be safest
        console.log('Paste Triggered. Clipboard:', !!clipboard, 'Mouse:', currentMouse);

        if (clipboard && currentMouse) {
          const { x: mx, y: my } = currentMouse;
          // Calculate center of clipboard items
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

          clipboard.strokes.forEach(s => {
            s.points.forEach(p => {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            });
          });
          clipboard.text.forEach(t => {
            if (t.x < minX) minX = t.x;
            if (t.x > maxX) maxX = t.x;
            if (t.y < minY) minY = t.y;
            if (t.y > maxY) maxY = t.y;
          });

          if (minX !== Infinity) {
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const dx = mx - cx;
            const dy = my - cy;

            // Prepare new items with new IDs and offset
            const newStrokes = clipboard.strokes.map(s => ({
              ...s,
              id: Math.random().toString(36).substr(2, 9),
              points: s.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
            }));
            const newText = clipboard.text.map(t => ({
              ...t,
              id: Math.random().toString(36).substr(2, 9),
              x: t.x + dx,
              y: t.y + dy
            }));

            socketRef.current?.emit('pasteObjects', { strokes: newStrokes, text: newText });
            setSelectedIds([...newStrokes.map(s => s.id), ...newText.map(t => t.id)]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty dependency array = Bound ONCE


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
                onSetDebuffs={() => setShowDebuffMenu(true)} // Re-open tools if needed, mainly for debuff menu
                onClearDebuffs={handleClearDebuffs}
                onLimitCut={handleLimitCut}
                onClearLimitCut={handleClearLimitCut}
                onCountdown={() => socketRef.current?.emit('countdown', 15)}
                onStartSim={(tid) => socketRef.current?.emit('startSim', tid)}
                onStopSim={() => socketRef.current?.emit('stopSim')}
                onResetSim={() => socketRef.current?.emit('resetSim')}
                simState={gameState.simulation}
                onClose={() => setShowConfig(false)}
                onGrotesquerieAct2={handleGrotesquerieAct2}
              />
            </div>
          </div>
        )
      }

      {/* Floating Honk Button (Left of Mute) */}
      <div
        onClick={() => {
          // Trigger visual feedback?
          // Just emit event
          socketRef.current?.emit('honk');
        }}
        style={{
          position: 'absolute',
          bottom: isMobile ? 70 : 80, // Match Mute button
          right: 75, // 20 (Mute) + 44 (Width) + 11 (Gap)
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
          color: '#fff',
          boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
          transition: 'all 0.2s ease'
        }}
        title="Honk!"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          {/* Mouthpiece */}
          <path d="M4 8a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z"></path>
          {/* Body & Bell */}
          <path d="M5 10h7c3 0 6-2 8-6v16c-2-4-5-6-8-6h-7z"></path>
          {/* Handle Loop */}
          <path d="M7 14v2a4 4 0 0 0 8 0v-2h-2v2a2 2 0 0 1-4 0v-2h-2z"></path>
        </svg>
      </div>

      {/* Floating Mute Button (Bottom Right) */}
      <div
        onClick={() => setMuteHonks(!muteHonks)}
        style={{
          position: 'absolute',
          bottom: isMobile ? 70 : 80, // Mobile: Above Credits (~50px). Desktop: Keep high.
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
          <div style={{ position: 'absolute', bottom: 120, left: 80, zIndex: 200 }}>
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
          <div
            onClick={() => handleCopyRoomId('indicator')}
            title="Copy Room Code"
            style={{
              display: 'flex', alignItems: 'center', // Ensure vertical alignment
              color: '#fff',
              fontSize: '13px', // Restored font size
              fontFamily: 'sans-serif',
              borderLeft: '1px solid #666',
              paddingLeft: '12px', // Restored padding
              height: '100%', // Full height for alignment
              letterSpacing: '0.5px',
              cursor: 'pointer',
              position: 'relative' // relative for absolute child
            }}>
            Room: {roomId}
            {copyFeedbackSource === 'indicator' && (
              <span style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#4CAF50',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                marginTop: '4px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}>
                Copied!
              </span>
            )}
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
            width: 'auto',
            maxWidth: 'calc(100vw - 20px)',
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

            {/* Brush Size & Opacity Section */}
            <div style={{
              gridArea: 'size',
              display: isMobile ? 'flex' : 'block',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderLeft: isMobile ? '1px solid #444' : 'none',
              paddingLeft: isMobile ? '10px' : '0'
            }}>
              {/* Header Removed */}

              <div style={{
                display: 'flex',
                flexDirection: isMobile ? 'column-reverse' : 'row',
                alignItems: 'center',
                gap: '15px',
                justifyContent: 'center',
                height: isMobile ? '100%' : 'auto',
                width: '100%'
              }}>
                <div style={{
                  display: 'flex',
                  flexDirection: isMobile ? 'row' : 'column',
                  gap: isMobile ? '10px' : '2px', // Tighter gap on desktop
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: isMobile ? '100%' : '45px', // Fixed height on desktop
                  flex: 1
                }}>
                  {/* Size Slider */}
                  <div style={isMobile ? {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '150px',
                    width: '30px',
                    position: 'relative'
                  } : { flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {isMobile && <div style={{ color: '#aaa', fontSize: '10px', marginBottom: '5px' }}>Size</div>}
                    {!isMobile && <div style={{ color: '#aaa', fontSize: '9px', lineHeight: '9px' }}>Size: {lineWidth}px</div>}
                    <input
                      type="range"
                      min="1"
                      max="40"
                      value={lineWidth}
                      onChange={(e) => handleLineWidthChange(Number(e.target.value))}
                      title={`Size: ${lineWidth}px`}
                      style={isMobile ? {
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        width: '30px',
                        height: '100%',
                        appearance: 'slider-vertical' as any
                      } : { width: '100%', height: '14px', margin: 0 }}
                    />
                  </div>

                  {/* Opacity Slider */}
                  <div style={isMobile ? {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '150px',
                    width: '30px',
                    position: 'relative',
                    marginLeft: '10px'
                  } : { flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {isMobile && <div style={{ color: '#aaa', fontSize: '10px', marginBottom: '5px' }}>Opac</div>}
                    {!isMobile && <div style={{ color: '#aaa', fontSize: '9px', lineHeight: '9px' }}>Opacity: {Math.round(opacity * 100)}%</div>}
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={opacity}
                      onChange={(e) => handleOpacityChange(Number(e.target.value))}
                      title={`Opacity: ${Math.round(opacity * 100)}%`}
                      style={isMobile ? {
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        width: '30px',
                        height: '100%',
                        appearance: 'slider-vertical' as any
                      } : { width: '100%', height: '14px', margin: 0 }}
                    />
                  </div>
                </div>


                {/* Preview Dot */}
                <div style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#222', borderRadius: '4px', border: '1px solid #555', flexShrink: 0 }}>
                  <div style={{ width: lineWidth + 'px', height: lineWidth + 'px', background: tool === 'eraser' ? '#fff' : '#' + selectedColor.toString(16).padStart(6, '0'), opacity: tool === 'eraser' ? 1 : opacity, borderRadius: '50%', border: tool === 'eraser' ? '1px solid #999' : 'none' }} />
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
                  {/* Select Tool */}
                  <button
                    className={`tool-button ${tool === 'select' ? 'active' : ''}`}
                    onClick={() => {
                      setTool('select');
                      if (isMobile) setIsToolsOpen(false);
                    }}
                  >
                    Select
                  </button>
                  {['brush', 'eraser', 'line', 'rect', 'donut', 'circle', 'text', 'cone'].map(t => (
                    <button
                      key={t}
                      className={`tool-button ${tool === t ? 'active' : ''}`}
                      onClick={() => {
                        setTool(t as any);
                        if (isMobile) setIsToolsOpen(false); // Only collapse Tools section
                      }}
                    >
                      {t === 'cone' ? 'Cone' : t === 'rect' ? 'Rect' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                  <button className="tool-button warning" onClick={() => socketRef.current?.emit('undo')}>Undo</button>
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

            {/* Import Modal */}
            {showImportModal && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000
              }}>
                <div style={{
                  background: '#222',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #444',
                  width: '400px',
                  maxWidth: '90%'
                }}>
                  <h3 style={{ color: '#fff', marginTop: 0 }}>Import from RaidPlan.io</h3>

                  {importStatus === 'processing' ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ color: '#fff', marginBottom: '10px' }}>{importMessage}</p>
                      <div style={{ width: '100%', height: '10px', background: '#444', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${importTotal > 0 ? (importProgress / importTotal) * 100 : 0}%`,
                          height: '100%',
                          background: '#4a90e2',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                      <p style={{ color: '#aaa', fontSize: '12px', marginTop: '5px' }}>
                        {importTotal > 0 ? `Page ${importProgress} of ${importTotal}` : 'Preparing...'}
                      </p>
                    </div>
                  ) : importStatus === 'error' ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ color: '#ff4444', marginBottom: '15px' }}>{importMessage}</p>
                      <button
                        onClick={() => setImportStatus('idle')}
                        style={{
                          padding: '8px 16px',
                          background: '#333',
                          border: '1px solid #555',
                          color: '#fff',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Try Again
                      </button>
                    </div>
                  ) : importStatus === 'done' ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <p style={{ color: '#00ff00', marginBottom: '15px' }}>{importMessage}</p>
                    </div>
                  ) : (
                    <>
                      <p style={{ color: '#aaa', fontSize: '14px' }}>Paste the full URL of the plan you want to import.</p>

                      <input
                        type="text"
                        placeholder="https://raidplan.io/plan/..."
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          background: '#333',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          color: '#fff',
                          marginBottom: '15px'
                        }}
                      />

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        <button
                          onClick={() => setShowImportModal(false)}
                          style={{
                            padding: '8px 16px',
                            background: 'transparent',
                            border: '1px solid #555',
                            color: '#fff',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={executeImport}
                          disabled={!importUrl}
                          style={{
                            padding: '8px 16px',
                            background: importUrl ? '#4a90e2' : '#2a2a2a',
                            border: 'none',
                            color: importUrl ? '#fff' : '#555',
                            borderRadius: '4px',
                            cursor: importUrl ? 'pointer' : 'default',
                            fontWeight: 'bold'
                          }}
                        >
                          Import
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

          </div>
        )
      }


      {!isMobile && <h1 style={{ color: '#eee', fontFamily: 'sans-serif', marginBottom: '1rem' }}>XIV Paint Sim</h1>}

      <div style={{ color: '#aaa', marginBottom: '1rem', fontSize: isMobile ? '0.8rem' : '1rem' }}>
        {myId ? (
          <>
            Connected as {gameState.players[myId]?.name || myId}
            {' '}
            <span
              onClick={() => handleCopyRoomId('main')}
              title="Copy Room Code"
              style={{ cursor: 'pointer', textDecoration: 'underline', color: '#fff', position: 'relative' }}
            >
              (Room: {roomId})
              {copyFeedbackSource === 'main' && (
                <span style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#4CAF50',
                  color: 'white',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  marginTop: '0px',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                  zIndex: 200
                }}>
                  Copied!
                </span>
              )}
            </span>
          </>
        ) : 'Connecting...'}
        {!isMobile && (
          <>
            <br />Use W/A/S/D to move. Press Space to Honk. Click and drag in arena to paint.
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ccc' }}>
              <span>Try importing a raid plan to get started:</span>
              <button
                onClick={handleImportRaidPlan}
                title="Import from RaidPlan.io"
                style={{
                  background: 'none',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#333'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00B4FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            </div>
          </>
        )}
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

      <div 
        style={{
          position: 'relative',
          width: ((gameState.pages[gameState.currentPageIndex].config?.backgroundImageUrl && gameState.pages[gameState.currentPageIndex].config?.width) || 800) * scale,
          height: ((gameState.pages[gameState.currentPageIndex].config?.backgroundImageUrl && gameState.pages[gameState.currentPageIndex].config?.height) || 600) * scale
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            manualScaleRef.current = true;
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            pinchRef.current = { initialDist: dist, initialScale: scale };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && pinchRef.current) {
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY
            );
            const zoomDelta = dist / pinchRef.current.initialDist;
            const newScale = pinchRef.current.initialScale * zoomDelta;
            
            const config = gameState.pages[gameState.currentPageIndex].config;
            const nativeWidth = (config?.backgroundImageUrl && config?.width) ? config.width : 800;
            const nativeHeight = (config?.backgroundImageUrl && config?.height) ? config.height : 600;
            
            const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
            const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            const hBuffer = isMobile ? 20 : 50;
            const minScale = Math.min(w / nativeWidth, (h - hBuffer) / nativeHeight);

            // Clamp scale: prevent zooming out past the fully visible canvas
            setScale(Math.min(Math.max(newScale, minScale), 5));
          }
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) {
            pinchRef.current = null;
          }
        }}
      >
        <Arena
          players={gameState.players}
          myId={socketRef.current?.id}
          config={gameState.pages[gameState.currentPageIndex].config}
          strokes={gameState.pages[gameState.currentPageIndex].strokes}
          activeProps={gameState.simulation?.activeProps}
          boss={gameState.simulation?.boss}
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
          currentOpacity={opacity}
          selectionBox={selectionBox}
          selectedIds={selectedIds}
          rectPreview={rectPreview}
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
        <CastBar simState={gameState.simulation} scale={scale} />
      </div>

      {
        isJoined && (
          <PageControls
            pages={gameState.pages}
            currentPageIndex={gameState.currentPageIndex}
            onAddPage={handleAddPage}
            onDuplicatePage={handleDuplicatePage}
            onDeletePage={handleDeletePage}
            onChangePage={handleChangePage}
            onImport={handleImportRaidPlan}
          />
        )
      }
      {isJoined && (
        <Chat
          messages={chatMessages}
          onSendMessage={(text) => socketRef.current?.emit('sendChat', text)}
          isMobile={isMobile}
        />
      )}
      <Credits />
      <InstanceTimer expiresAt={gameState.instanceExpiresAt} />
    </div >
  );
}

export default App
