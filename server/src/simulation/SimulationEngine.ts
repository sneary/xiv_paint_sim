
import { GameState, ScriptedEvent, SimulationState, Prop, Player } from '../state';

export class SimulationEngine {
    private state: SimulationState;
    private events: ScriptedEvent[] = [];
    private eventPointer: number = 0;
    private timer: NodeJS.Timeout | null = null;
    private lastTickTime: number = 0;

    // Callbacks
    private onStateUpdate: (simState: SimulationState) => void;
    private getPlayers: () => Record<string, any>; // Using any to avoid circular dependency if possible, or Player[]
    private onApplyDebuff: (playerId: string, debuffs: number[], history?: any[]) => void;
    private onKnockback: (playerId: string, dx: number, dy: number, duration: number) => void;
    private onConfigUpdate: (config: any) => void;
    private onCountdown: (duration: number) => void;

    private onLogStart: (msg: string) => void;

    constructor(
        state: SimulationState,
        onUpdate: (s: SimulationState) => void,
        getPlayers: () => Record<string, any>,
        onApplyDebuff: (playerId: string, debuffs: number[], history?: any[]) => void,
        onKnockback: (pid: string, dx: number, dy: number, duration: number) => void,
        onConfigUpdate: (config: any) => void,
        onCountdown: (duration: number) => void,
        onLogMessage: (msg: string) => void
    ) {
        this.state = state;
        this.onStateUpdate = onUpdate;
        this.getPlayers = getPlayers;
        this.onApplyDebuff = onApplyDebuff;
        this.onKnockback = onKnockback;
        this.onConfigUpdate = onConfigUpdate;
        this.onCountdown = onCountdown;
        this.onLogStart = onLogMessage;
    }

    private logGameEvent(msg: string) {
        if (this.onLogStart) {
            this.onLogStart(msg);
        }
    }

    public loadTimeline(timeline: ScriptedEvent[]) {
        // Sort events by time just in case
        this.events = [...timeline].sort((a, b) => a.time - b.time);
        this.eventPointer = 0;
        console.log(`[Sim] Loaded timeline with ${this.events.length} events.`);
    }

    public start() {
        if (this.state.isRunning) return;

        this.state.isRunning = true;
        this.state.startTime = Date.now();
        this.state.activeProps = [];
        this.eventPointer = 0;
        this.lastTickTime = Date.now();

        // Clear Player Debuffs on Start
        const players = this.getPlayers();
        Object.keys(players).forEach(pid => {
            this.onApplyDebuff(pid, [], []);
        });

        // 30 TPS loop
        this.timer = setInterval(() => this.tick(), 33);
        console.log('[Sim] Started.');
    }

    public stop() {
        if (this.timer) clearInterval(this.timer);
        this.state.isRunning = false;
        this.state.startTime = undefined;
        this.state.activeProps = [];
        console.log('[Sim] Stopped.'); // Fixed consoleLog typo
        this.onStateUpdate(this.state);
    }

    // reset/clear
    public reset() {
        this.stop();
        this.state.activeProps = [];
        this.eventPointer = 0;
        this.onStateUpdate(this.state);
    }

    private tick() {
        if (!this.state.isRunning || !this.state.startTime) return;

        const now = Date.now();
        // Elapsed time in simulation
        const elapsed = (now - this.state.startTime) * this.state.playbackSpeed;

        // Process matching events
        while (this.eventPointer < this.events.length) {
            const event = this.events[this.eventPointer];
            if (event.time <= elapsed) {
                this.executeEvent(event);
                this.eventPointer++;
            } else {
                break; // Next event is in future
            }
        }

        // Sync Attached Props
        const currentPlayers = this.getPlayers();
        this.state.activeProps.forEach(p => {
            if (p.attachTo) {
                const target = currentPlayers[p.attachTo];
                if (target) {
                    p.x = target.x;
                    p.y = target.y;
                }
            }
        });

        // Cleanup expired props & handle Tether resolution
        const remainingProps: Prop[] = [];
        this.state.activeProps.forEach(p => {
            if (p.duration && p.createdAt + p.duration < now) {
                // Prop Expired
                if (p.tetherTo) {
                    // Check Tether Resolution
                    const players = this.getPlayers();
                    const player = players[p.tetherTo];
                    if (player) {
                        const dist = Math.hypot(player.x - p.x, player.y - p.y);
                        // Logic: < 560 is BAD (Red), >= 560 is GOOD (Green)
                        if (dist < 575) {
                            console.log(`[Sim] Tether Failed (Dist: ${dist.toFixed(0)} < 560). Damage!`);
                            const currentDebuffs = player.debuffs || [];
                            let history = player.debuffHistory || [];

                            // Log ALWAYS if condition met
                            this.logGameEvent(`${player.name} failed ${p.name || 'Tether'} (Too Short)`);

                            if (!currentDebuffs.includes(1)) {
                                const newHistory = [...history, {
                                    id: 1,
                                    source: p.name || 'Tether (Too Short)',
                                    timestamp: Date.now()
                                }];
                                this.onApplyDebuff(player.id, [...currentDebuffs, 1], newHistory);
                            }
                        } else {
                            console.log(`[Sim] Tether Safe (Dist: ${dist.toFixed(0)} >= 560).`);
                        }
                    }
                }

                // Check damageOnExpiration OR applyDebuffIdOnExpiration
                if (p.damageOnExpiration || p.applyDebuffIdOnExpiration !== undefined) {
                    const players = Object.values(this.getPlayers());
                    players.forEach((player: any) => {
                        if (player.role === 'spectator') return;
                        // Check collision with prop
                        let hit = false;
                        if (p.type === 'circle' && p.width) {
                            const dist = Math.hypot(player.x - p.x, player.y - p.y);
                            if (dist <= p.width) hit = true;
                        } else if (p.type === 'rect' && p.width && p.height) {
                            // Simple AABB centered
                            // Note: If rotated, this needs better collision.
                            // But previous impl was AABB. Current Line AOEs use Rotation.
                            // We need Rotated Rect collision!
                            // Convert player point to local space of rect
                            const rot = p.rotation || 0;
                            const dx = player.x - p.x;
                            const dy = player.y - p.y;
                            const cos = Math.cos(-rot);
                            const sin = Math.sin(-rot);
                            const lx = dx * cos - dy * sin;
                            const ly = dx * sin + dy * cos;

                            const halfW = p.width / 2;
                            const halfH = p.height / 2;

                            if (lx >= -halfW && lx <= halfW &&
                                ly >= -halfH && ly <= halfH) {
                                hit = true;
                            }
                        }

                        if (hit) {
                            let currentDebuffs = player.debuffs || [];
                            let history = player.debuffHistory || [];
                            let debuffsChanged = false;

                            // 1. Apply Specific Debuff (e.g. Vuln ID 2)
                            if (p.applyDebuffIdOnExpiration !== undefined) {
                                // Always add to history for tracking source
                                history = [...history, {
                                    id: p.applyDebuffIdOnExpiration,
                                    source: p.name || 'Unknown',
                                    timestamp: Date.now()
                                }];

                                currentDebuffs = [...currentDebuffs, p.applyDebuffIdOnExpiration];
                                debuffsChanged = true;

                                // Stacking Check: If >= 2 of this ID, add Damage (ID 1)
                                const count = currentDebuffs.filter((d: number) => d === p.applyDebuffIdOnExpiration).length;
                                if (count >= 2) {
                                    // Find sources
                                    const sources = history
                                        .filter((h: any) => h.id === p.applyDebuffIdOnExpiration)
                                        .map((h: any) => h.source);

                                    // Start with the latest two sources (allow duplicates)
                                    const lastTwoSources = sources.slice(-2);

                                    this.logGameEvent(`${player.name || 'Player'} took damage from ${lastTwoSources.join(' and ')}`);

                                    if (!currentDebuffs.includes(1)) {
                                        currentDebuffs = [...currentDebuffs, 1];
                                    }
                                }
                            }

                            // 2. Default Damage (ID 1)
                            if (p.damageOnExpiration) {
                                // Log ALWAYS
                                this.logGameEvent(`${player.name || 'Player'} took damage from ${p.name || 'Effect'}`);

                                if (!currentDebuffs.includes(1)) { // 1 = Damage Debuff
                                    currentDebuffs = [...currentDebuffs, 1];
                                    debuffsChanged = true;
                                }
                            }

                            if (debuffsChanged) {
                                this.onApplyDebuff(player.id, currentDebuffs, history);
                            }
                        }
                    });
                }

                // Do not keep
                return;
            }
            remainingProps.push(p);
        });
        this.state.activeProps = remainingProps;

        // Cleanup expired cast
        if (this.state.bossCast && now > this.state.bossCast.startTime + this.state.bossCast.duration) {
            this.state.bossCast = null;
        }

        // Cleanup expired boss
        if (this.state.boss && this.state.boss.duration && now > this.state.boss.createdAt + this.state.boss.duration) {
            this.state.boss = null;
        }

        // Hit Detection
        this.checkHits();

        // Broadcast
        this.onStateUpdate(this.state);
    }

    private checkHits() {
        const players = this.getPlayers();
        const damagingProps = this.state.activeProps.filter(p => p.isDamaging);

        if (damagingProps.length === 0) return;

        Object.values(players).forEach((player: any) => {
            if (player.role === 'spectator') return; // Spectators don't get hit

            let isHit = false;
            damagingProps.forEach(prop => {
                if (isHit) return; // Already hit by something this tick? (Maybe allow multiple?)

                // Simple collision detection
                if (prop.type === 'circle' && prop.width) {
                    const r = prop.width;
                    const dx = player.x - prop.x;
                    const dy = player.y - prop.y;
                    if (Math.hypot(dx, dy) < r) isHit = true;
                } else if (prop.type === 'rect' && prop.width && prop.height) {
                    // Rotated Rectangle Check
                    // Transform player point to rect's local space
                    const rectDx = player.x - prop.x;
                    const rectDy = player.y - prop.y;
                    const rectR = (prop.rotation || 0);

                    // Rotate point by -r
                    const localX = rectDx * Math.cos(-rectR) - rectDy * Math.sin(-rectR);
                    const localY = rectDx * Math.sin(-rectR) + rectDy * Math.cos(-rectR);

                    const halfW = prop.width / 2;
                    const halfH = prop.height / 2;

                    if (
                        localX >= -halfW &&
                        localX <= halfW &&
                        localY >= -halfH &&
                        localY <= halfH
                    ) {
                        isHit = true;
                    }
                }
            });

            if (isHit) {
                // Apply 'Damage Down' (ID: 1 is arbitrary, let's use 1)
                // Debuff logic: toggle or add? Add.
                const currentDebuffs = player.debuffs || [];
                if (!currentDebuffs.includes(1)) {
                    this.onApplyDebuff(player.id, [...currentDebuffs, 1]);
                }
            }
        });
    }

    private executeEvent(event: ScriptedEvent) {
        console.log(`[Sim] Event: ${event.type} @ ${event.time}ms`);
        switch (event.type) {
            case 'spawn_prop':
                const propData = event.data as Partial<Prop>;
                const newProp: Prop = {
                    id: propData.id || `prop_${Date.now()}_${Math.random()}`,
                    type: propData.type || 'circle',
                    x: propData.x || 0,
                    y: propData.y || 0,
                    color: propData.color || 0xFF0000,
                    alpha: propData.alpha ?? 1,
                    width: propData.width,
                    height: propData.height,
                    createdAt: Date.now(), // Server time
                    duration: propData.duration,
                    isDamaging: propData.isDamaging,
                    damageAmount: propData.damageAmount,
                    isSolid: propData.isSolid,
                    allowKnockback: propData.allowKnockback
                };
                this.state.activeProps.push(newProp);
                break;

            case 'remove_prop':
                const removeId = event.data.id;
                this.state.activeProps = this.state.activeProps.filter(p => p.id !== removeId);
                break;

            case 'clear_props':
                this.state.activeProps = [];
                break;

                // Old knockback removed
                break;

            case 'arena_config':
                this.onConfigUpdate(event.data);
                break;

            case 'spawn_target_prop':
                // Logic: Find targets based on criteria -> Calculate Position -> Spawn
                const targetData = event.data;
                const allPlayers = Object.values(this.getPlayers());
                const eligible = allPlayers.filter((p: any) => p.role !== 'spectator');

                let targets: any[] = [];

                if (targetData.criteria === 'role') {
                    targets = eligible.filter((p: any) => targetData.roles.includes(p.role));
                } else if (targetData.criteria === 'all') {
                    targets = eligible;
                } else if (targetData.criteria === 'has_debuff') {
                    targets = eligible.filter((p: any) => p.debuffs && p.debuffs.includes(targetData.debuffId));
                } else if (targetData.criteria === 'is_tethered') {
                    // Find players who are tether targets
                    const tetheredIds = this.state.activeProps
                        .filter(pr => pr.tetherTo)
                        .map(pr => pr.tetherTo);
                    targets = eligible.filter((p: any) => tetheredIds.includes(p.id));
                } else if (targetData.criteria === 'nearest' || targetData.criteria === 'furthest') {
                    // Sort by distance from origin (default center)
                    const ox = targetData.origin ? targetData.origin.x : 400;
                    const oy = targetData.origin ? targetData.origin.y : 300;

                    eligible.sort((a: any, b: any) => {
                        const da = Math.hypot(a.x - ox, a.y - oy);
                        const db = Math.hypot(b.x - ox, b.y - oy);
                        return targetData.criteria === 'nearest' ? da - db : db - da;
                    });

                    const count = targetData.count || 1;
                    targets = eligible.slice(0, count);
                }

                targets.forEach((t: any) => {
                    let tx = t.x;
                    let ty = t.y;
                    let rot = 0;

                    // Dynamic Origin Logic
                    let ox = targetData.origin ? targetData.origin.x : 0;
                    let oy = targetData.origin ? targetData.origin.y : 0;

                    if (targetData.origin === 'tether_source') {
                        // Find the prop tethered to this player
                        const tetherProp = this.state.activeProps.find(pr => pr.tetherTo === t.id);
                        if (tetherProp) {
                            ox = tetherProp.x;
                            oy = tetherProp.y;
                        }
                    }

                    if (targetData.aimFromOrigin) {
                        // Calculate Line AOE (Rect) position and rotation
                        // We want a rect starting at Ox,Oy going through Tx,Ty
                        // Width = Length of AOE (e.g. 2000)
                        // Height = Thickness (e.g. 60)
                        // Rotation = Angle to player
                        // Pixi Rect is centered. So Center X = Ox + cos(angle)*Len/2
                        const angle = Math.atan2(ty - oy, tx - ox);
                        const len = targetData.width || 1000;
                        tx = ox + Math.cos(angle) * (len / 2);
                        ty = oy + Math.sin(angle) * (len / 2);
                        rot = angle;
                        // For 'rect', standard rotation rotates around the center.
                        // If we place center at `tx,ty` (midpoint), and rotate, it covers Start->End.
                    } else {
                        tx += (targetData.offset ? targetData.offset.x : 0);
                        ty += (targetData.offset ? targetData.offset.y : 0);
                    }

                    const newProp: Prop = {
                        id: `prop_${Date.now()}_${Math.random()}`,
                        type: targetData.propType || 'circle',
                        x: tx,
                        y: ty,
                        rotation: rot,
                        color: targetData.color || 0xFF0000,
                        alpha: targetData.alpha ?? 1,
                        width: targetData.width,
                        height: targetData.height,
                        createdAt: Date.now(),
                        duration: targetData.duration,
                        isDamaging: targetData.isDamaging,
                        damageAmount: targetData.damageAmount,
                        isSolid: targetData.isSolid,
                        allowKnockback: targetData.allowKnockback,
                        tetherTo: targetData.tetherToPlayer ? t.id : undefined,
                        attachTo: targetData.attachToPlayer ? t.id : undefined, // Attach to player position
                        imageUrl: targetData.imageUrl,
                        damageOnExpiration: targetData.damageOnExpiration,
                        applyDebuffIdOnExpiration: targetData.applyDebuffIdOnExpiration,
                        applyDebuffIdOnStart: targetData.applyDebuffIdOnStart,
                        name: targetData.name
                    };
                    this.state.activeProps.push(newProp);

                    // Handle Start Debuff
                    if (newProp.applyDebuffIdOnStart !== undefined) {
                        const players = Object.values(this.getPlayers());
                        players.forEach((player: any) => {
                            if (player.role === 'spectator') return;

                            // For Start Logic, we might need to handle 'offset' from player origin if attachTo?
                            // But usually collision is based on absolute X/Y. newProp has absolute X/Y.
                            if (this.isPlayerHit(newProp, player)) {
                                this.applyStackingDebuff(player, newProp.applyDebuffIdOnStart!, newProp.name);
                            }
                        });
                    }
                });
                break;

            case 'apply_target_debuff':
                const debuffData = event.data;
                const allP = Object.values(this.getPlayers());
                const eligibleP = allP.filter((p: any) => p.role !== 'spectator');
                let targs: any[] = [];

                if (debuffData.criteria === 'role') {
                    targs = eligibleP.filter((p: any) => debuffData.roles.includes(p.role));
                } else if (debuffData.criteria === 'nearest' || debuffData.criteria === 'furthest') {
                    const ox = debuffData.origin ? debuffData.origin.x : 400;
                    const oy = debuffData.origin ? debuffData.origin.y : 300;
                    eligibleP.sort((a: any, b: any) => {
                        const da = Math.hypot(a.x - ox, a.y - oy);
                        const db = Math.hypot(b.x - ox, b.y - oy);
                        return debuffData.criteria === 'nearest' ? da - db : db - da;
                    });
                    const count = debuffData.count || 1;
                    targs = eligibleP.slice(0, count);
                }

                targs.forEach((t: any) => {
                    const currentDebuffs = t.debuffs || [];
                    if (!currentDebuffs.includes(debuffData.debuffId)) {
                        this.onApplyDebuff(t.id, [...currentDebuffs, debuffData.debuffId]);
                        // Optional: Keep setTimeout for backward compatibility or simple duration
                        if (debuffData.duration) {
                            setTimeout(() => {
                                const currentPlayers = this.getPlayers();
                                const p = currentPlayers[t.id];
                                if (p) {
                                    this.onApplyDebuff(t.id, p.debuffs.filter((d: number) => d !== debuffData.debuffId));
                                }
                            }, debuffData.duration);
                        }
                    }
                });
                break;

            case 'remove_target_debuff':
                const removeData = event.data;
                const rPlayers = Object.values(this.getPlayers());
                rPlayers.forEach((p: any) => {
                    // Check criteria if needed? Or just remove from ALL if no criteria?
                    // Usually removal is specific. Let's support 'all' or criteria.
                    // For simplicity: Remove debuffId from ALL players unless criteria specified.
                    // If criteria matches 'apply' criteria, we can target same group.
                    // Let's assume matching criteria logic or just 'role'/'all'.

                    let shouldRemove = false;
                    if (!removeData.criteria || removeData.criteria === 'all') {
                        shouldRemove = true;
                    } else if (removeData.criteria === 'role' && removeData.roles.includes(p.role)) {
                        shouldRemove = true;
                    } else if (removeData.criteria === 'nearest') {
                        // Re-calculating nearest might target DIFFERENT players if they moved!
                        // This is tricky. usually removal events are "Remove from everyone" or "Remove from ID".
                        // For this specific mechanic, "remove from everyone who has it" is safest.
                        if (p.debuffs && p.debuffs.includes(removeData.debuffId)) {
                            shouldRemove = true;
                        }
                    }

                    if (shouldRemove && p.debuffs && p.debuffs.includes(removeData.debuffId)) {
                        this.onApplyDebuff(p.id, p.debuffs.filter((d: number) => d !== removeData.debuffId));
                    }
                });
                break;

            case 'boss_cast':
                this.state.bossCast = {
                    name: event.data.name || 'Unknown Cast',
                    startTime: Date.now(),
                    duration: event.data.duration || 3000,
                    x: event.data.x,
                    y: event.data.y,
                    scale: event.data.scale
                };
                break;

            case 'knockback':
                // Origin
                const kx = event.data.x || 0;
                const ky = event.data.y || 0;
                const dist = event.data.distance || 0;
                const duration = event.data.duration || 500; // ms
                const radius = event.data.radius; // Optional radius

                // Get all players
                const players = this.getPlayers(); // Record<string, Player>
                Object.values(players).forEach((p: any) => {
                    // Calc vector from origin to player
                    let dx = p.x - kx;
                    let dy = p.y - ky;
                    const len = Math.sqrt(dx * dx + dy * dy);

                    // Radius Check
                    if (radius !== undefined && len > radius) {
                        return; // Player is safe (outside radius)
                    }

                    // Normalize
                    if (len > 0) {
                        dx /= len;
                        dy /= len;
                    } else {
                        // Player is exactly on origin? Push random or UP
                        dx = 0;
                        dy = -1;
                    }

                    // Calculate target delta
                    let targetDx = dx * dist;
                    let targetDy = dy * dist;

                    // --- Knockback Collision Check ---
                    // 1. Separate "Hard Walls" vs "Permeable Walls"
                    const solidProps = this.state.activeProps.filter(pr => pr.isSolid);

                    if (solidProps.length > 0) {
                        const startX = p.x;
                        const startY = p.y;
                        const fullDist = dist;
                        let minHitDist = fullDist;
                        const proposedEndX = startX + targetDx;
                        const proposedEndY = startY + targetDy;

                        // Helper: Check if Point is inside Prop
                        const isPointInsideProp = (px: number, py: number, prop: Prop): boolean => {
                            if (prop.type === 'circle') {
                                const r = (prop.width || 0);
                                const dx = px - prop.x;
                                const dy = py - prop.y;
                                return (dx * dx + dy * dy) <= r * r;
                            } else if (prop.type === 'rect') {
                                const rw = prop.width || 0;
                                const rh = prop.height || 0;
                                const rad = -(prop.rotation || 0);
                                const relX = px - prop.x;
                                const relY = py - prop.y;
                                const locX = relX * Math.cos(rad) - relY * Math.sin(rad);
                                const locY = relX * Math.sin(rad) + relY * Math.cos(rad);
                                return (locX >= -rw / 2 && locX <= rw / 2 && locY >= -rh / 2 && locY <= rh / 2);
                            }
                            return false;
                        };

                        solidProps.forEach(prop => {
                            // Logic:
                            // If !prop.allowKnockback => Always check collision. (Hard Wall)
                            // If prop.allowKnockback => Only check collision IF destination is inside. (Permeable Wall logic)
                            //    Actually, if dest is inside, we want to STOP at the wall (entrance), not allow partial entry.
                            //    So if (allowKnockback && !isPointInside(End)) => SKIP.

                            if (prop.allowKnockback) {
                                if (!isPointInsideProp(proposedEndX, proposedEndY, prop)) {
                                    // Player fully traverses! Ignore this prop.
                                    return;
                                }
                                // Else: Player ends inside. Effectively treat as solid wall to prevent ending inside.
                            }

                            // Ray-Circle or Ray-Rect Intersection logic (same as before)
                            // We need to find "t" (0 to 1) along the vector where hit occurs.

                            // Simplified Ray vs Circle
                            if (prop.type === 'circle') {
                                const cx = prop.x;
                                const cy = prop.y;
                                const r = (prop.width || 0);
                                // Vector from Start to Circle Center
                                const fx = startX - cx;
                                const fy = startY - cy;
                                const a = targetDx * targetDx + targetDy * targetDy;
                                const b = 2 * (fx * targetDx + fy * targetDy);
                                const c = (fx * fx + fy * fy) - r * r;

                                // Quadratic eq: at^2 + bt + c = 0
                                let discriminant = b * b - 4 * a * c;
                                if (discriminant >= 0) {
                                    discriminant = Math.sqrt(discriminant);
                                    const t1 = (-b - discriminant) / (2 * a);
                                    if (t1 >= 0 && t1 <= 1) {
                                        minHitDist = Math.min(minHitDist, t1 * fullDist);
                                    }
                                }
                            }
                            // Simplified Ray vs Rect (Rotated)
                            else if (prop.type === 'rect') {
                                // Transform Ray to local space of rect
                                const rw = prop.width || 0;
                                const rh = prop.height || 0;
                                const rad = -(prop.rotation || 0);

                                // Transform Start Point
                                const relX = startX - prop.x;
                                const relY = startY - prop.y;
                                const locX = relX * Math.cos(rad) - relY * Math.sin(rad);
                                const locY = relX * Math.sin(rad) + relY * Math.cos(rad);

                                // Transform Direction Vector
                                const locDx = targetDx * Math.cos(rad) - targetDy * Math.sin(rad);
                                const locDy = targetDx * Math.sin(rad) + targetDy * Math.cos(rad);

                                // Liang-Barsky line clipping
                                let tMin = 0;
                                let tMax = 1;
                                const p_ = [-locDx, locDx, -locDy, locDy];
                                const q_ = [
                                    locX - (-rw / 2), (rw / 2) - locX, locY - (-rh / 2), (rh / 2) - locY
                                ];

                                let hit = true;
                                for (let i = 0; i < 4; i++) {
                                    if (p_[i] === 0) {
                                        if (q_[i] < 0) { hit = false; break; }
                                    } else {
                                        const t = q_[i] / p_[i];
                                        if (p_[i] < 0) {
                                            if (t > tMax) { hit = false; break; }
                                            if (t > tMin) tMin = t;
                                        } else {
                                            if (t < tMin) { hit = false; break; }
                                            if (t < tMax) tMax = t;
                                        }
                                    }
                                }

                                if (hit && tMin < 1 && tMin >= 0) {
                                    minHitDist = Math.min(minHitDist, tMin * fullDist);
                                }
                            }
                        });


                        if (minHitDist < fullDist) {
                            // Collision detected! Shorten vector.
                            // Back off slightly to avoid sticking inside
                            const safeDist = Math.max(0, minHitDist - 5);
                            targetDx = dx * safeDist;
                            targetDy = dy * safeDist;
                            console.log(`Knockback collision! Shortened from ${dist} to ${safeDist}`);
                        }
                    }

                    console.log(`Knocking back ${p.name} by ${dist} (${targetDx}, ${targetDy})`);

                    // UPDATE SERVER STATE IMMEDIATELY
                    // This ensures that when the client finishes animation, the server agrees on the new position.
                    p.x += targetDx;
                    p.y += targetDy;

                    if (this.onKnockback) {
                        this.onKnockback(p.id, targetDx, targetDy, duration);
                    }
                });
                break;

            case 'spawn_boss':
                this.state.boss = {
                    id: 'boss-' + Date.now(),
                    x: event.data.x,
                    y: event.data.y,
                    opacity: 1,
                    duration: event.data.duration,
                    createdAt: Date.now()
                };
                break;

            case 'countdown':
                const cdDuration = event.data.duration !== undefined ? event.data.duration : 3;
                this.onCountdown(cdDuration);
                break;

            case 'spawn_random_props':
                const variants = event.data.variants; // Prop[][]
                if (!variants || variants.length === 0) break;

                const selection = variants[Math.floor(Math.random() * variants.length)];

                // Tether Logic
                let tetherTargets: string[] = [];
                if (event.data.assignTethers) {
                    const players = Object.values(this.getPlayers()) as Player[];
                    const leftSide = players.filter(p => p.x < 512); // Center is 512
                    const rightSide = players.filter(p => p.x >= 512);

                    // Shuffle helper
                    const shuffle = (arr: any[]) => {
                        for (let i = arr.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [arr[i], arr[j]] = [arr[j], arr[i]];
                        }
                        return arr;
                    };

                    const selectedLeft = shuffle([...leftSide]).slice(0, 2);
                    const selectedRight = shuffle([...rightSide]).slice(0, 2);

                    // Combine and shuffle again to randomize which prop gets which player
                    tetherTargets = shuffle([...selectedLeft, ...selectedRight]).map(p => p.id);
                }

                selection.forEach((propData: any, index: number) => {
                    const newProp: Prop = {
                        id: propData.id || `prop_${Date.now()}_${Math.random()}`,
                        type: propData.type,
                        x: propData.x,
                        y: propData.y,
                        rotation: propData.rotation || 0,
                        color: propData.color || 0xFF0000,
                        alpha: propData.alpha ?? 1,
                        width: propData.width,
                        height: propData.height,
                        createdAt: Date.now(),
                        duration: propData.duration,
                        isDamaging: propData.isDamaging,
                        damageAmount: propData.damageAmount,
                        // Copy extra logic fields
                        damageOnExpiration: propData.damageOnExpiration,
                        applyDebuffIdOnExpiration: propData.applyDebuffIdOnExpiration,
                        applyDebuffIdOnStart: propData.applyDebuffIdOnStart,
                        name: propData.name,
                        // Assign tether if available for this index
                        tetherTo: tetherTargets[index]
                    };
                    this.state.activeProps.push(newProp);
                });
                break;
        }
    }

    private isPlayerHit(p: Prop, player: Player): boolean {
        if (p.type === 'circle' && p.width) {
            const dist = Math.hypot(player.x - p.x, player.y - p.y);
            return dist <= p.width;
        } else if (p.type === 'rect' && p.width && p.height) {
            const rot = p.rotation || 0;
            const dx = player.x - p.x;
            const dy = player.y - p.y;
            const cos = Math.cos(-rot);
            const sin = Math.sin(-rot);
            const lx = dx * cos - dy * sin;
            const ly = dx * sin + dy * cos;

            const halfW = p.width / 2;
            const halfH = p.height / 2;

            return (lx >= -halfW && lx <= halfW &&
                ly >= -halfH && ly <= halfH);
        }
        return false;
    }

    private applyStackingDebuff(player: Player, debuffId: number, propName?: string) {
        let currentDebuffs = player.debuffs || [];

        // Add new stack
        currentDebuffs = [...currentDebuffs, debuffId];

        // Update history (optional but good for consistency, though we log immediately now)
        let history = player.debuffHistory || [];
        history = [...history, {
            id: debuffId,
            source: propName || 'Unknown',
            timestamp: Date.now()
        }];

        // Check Stacks
        const count = currentDebuffs.filter((d: number) => d === debuffId).length;
        if (count >= 2) {
            // Find sources
            const sources = history
                .filter((h: any) => h.id === debuffId)
                .map((h: any) => h.source);

            // Start with the latest two sources (allow duplicates)
            const lastTwoSources = sources.slice(-2);

            this.logGameEvent(`${player.name || 'Player'} took damage from ${lastTwoSources.join(' and ')}`);

            if (!currentDebuffs.includes(1)) {
                currentDebuffs = [...currentDebuffs, 1]; // Add Skull
            }
        }
        this.onApplyDebuff(player.id, currentDebuffs, history);
    }

    private consoleLog(msg: string) {
        console.log(msg);
    }
}
