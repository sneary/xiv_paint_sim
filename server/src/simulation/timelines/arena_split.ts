import { ScriptedEvent } from '../../state';

const CENTER_X = 512;
const CENTER_Y = 287;

export const ARENA_SPLIT_TIMELINE: ScriptedEvent[] = [
    {
        time: 0,
        type: 'countdown',
        data: { duration: 3 }
    },
    // Setup Arena
    {
        time: 0,
        type: 'arena_config',
        data: {
            shape: 'none',
            backgroundImageUrl: '/m11s_split.png',
            width: 1024,
            height: 575,
            showGrid: false
        }
    },
    {
        time: 500,
        type: 'spawn_boss',
        data: { x: 512, y: 287, duration: 999999 } // Center of custom arena
    },
    {
        time: 100,
        type: 'play_sound',
        data: { name: 'begin' }
    },
    {
        time: 3000,
        type: 'boss_cast',
        data: { name: 'Flatliner', duration: 6000 }
    },
    {
        time: 9000,
        type: 'knockback',
        data: { x: 512, y: 287, distance: 200, duration: 1000, radius: 9999 } // Push 200px if within 150px
    },
    {
        time: 10000,
        type: 'spawn_prop',
        data: {
            id: 'solid_wall_test',
            type: 'rect',
            x: 512,
            y: 287,
            width: 170,
            height: 575,
            color: 0xFF0000,
            alpha: 0.1,
            duration: 999999,
            isSolid: true,
            allowKnockback: true
        }
    },
    {
        time: 11000,
        type: 'boss_cast',
        data: { name: 'Majestic Meteor', duration: 5000 }
    },
    // 4 Knockback Circles (Gold Donuts) - DOUBLED SIZE
    // Left Top
    {
        time: 16000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_lt', type: 'donut', x: 256, y: 150, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Left Bottom
    {
        time: 16000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_lb', type: 'donut', x: 256, y: 420, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Right Top
    {
        time: 16000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_rt', type: 'donut', x: 768, y: 150, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Right Bottom
    {
        time: 16000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_rb', type: 'donut', x: 768, y: 420, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Random Rectangles Configuration
    {
        time: 16000,
        type: 'spawn_random_props',
        data: {
            assignTethers: true,
            variants: [
                // Config A: Left (Outer), Right (Inner)
                [
                    // Left 1 (Top)
                    { type: 'rect', x: 134, y: 71, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Left 4 (Bottom)
                    { type: 'rect', x: 134, y: 502, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 2 (Mid-Top)
                    { type: 'rect', x: 890, y: 215, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 3 (Mid-Bottom)
                    { type: 'rect', x: 890, y: 358, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                ],
                // Config B: Left (Inner), Right (Outer)
                [
                    // Left 2 (Mid-Top)
                    { type: 'rect', x: 134, y: 215, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Left 3 (Mid-Bottom)
                    { type: 'rect', x: 134, y: 358, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 1 (Top)
                    { type: 'rect', x: 890, y: 71, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 4 (Bottom)
                    { type: 'rect', x: 890, y: 502, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                ]
            ]
        }
    },
    {
        time: 16000,
        type: 'spawn_random_props',
        data: {
            variants: [
                // Config A: Left (Outer), Right (Inner)
                [
                    // Center Lines (Inner)
                    { type: 'rect', x: 205, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 675, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 205, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.05, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                    { type: 'rect', x: 675, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.05, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                ],
                // Config B: Left (Inner), Right (Outer)
                [
                    // Center Lines (Inner)
                    { type: 'rect', x: 350, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 815, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 350, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.1, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                    { type: 'rect', x: 815, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.1, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                ]
            ]
        }
    },
    {
        time: 16000,
        type: 'boss_cast',
        data: { name: 'Knockback', duration: 10000 }
    },
    // Trigger Knockbacks (Sync with visual end)
    {
        time: 26000,
        type: 'knockback',
        data: { x: 256, y: 150, distance: 360, radius: 80, duration: 2000 }
    },
    {
        time: 26000,
        type: 'knockback',
        data: { x: 256, y: 420, distance: 360, radius: 80, duration: 2000 }
    },
    {
        time: 26000,
        type: 'knockback',
        data: { x: 768, y: 150, distance: 360, radius: 80, duration: 2000 }
    },
    {
        time: 26000,
        type: 'knockback',
        data: { x: 768, y: 420, distance: 360, radius: 80, duration: 2000 }
    },

    // 4 Red Arrow Markers (Closest to Center)
    {
        time: 29000,
        type: 'apply_target_debuff',
        data: {
            criteria: 'nearest',
            count: 4,
            origin: { x: 512, y: 287 },
            debuffId: 99, // Red Arrow
            // Duration handled by explicit removal event below or timeout
            duration: 10000
        }
    },
    {
        time: 30000,
        type: 'boss_cast',
        data: { name: 'Fire Breath', duration: 5000 }
    },

    // Puddle Drop (2s after arrows)
    {
        time: 31500,
        type: 'spawn_target_prop',
        data: {
            criteria: 'all',
            propType: 'circle',
            width: 60, // Radius
            color: 0xFFA500, // Orange
            alpha: 0.5,
            duration: 1500,
            damageOnExpiration: true,
            name: 'Puddle'
        }
    },
    {
        time: 33000,
        type: 'spawn_target_prop',
        data: {
            criteria: 'all',
            propType: 'circle',
            width: 60, // Radius
            color: 0xFFA500, // Orange
            alpha: 0.5,
            duration: 1500,
            damageOnExpiration: true,
            name: 'Puddle'
        }
    },
    {
        time: 34500,
        type: 'spawn_target_prop',
        data: {
            criteria: 'all',
            propType: 'circle',
            width: 60, // Radius
            color: 0xFFA500, // Orange
            alpha: 0.5,
            duration: 1500,
            damageOnExpiration: true,
            name: 'Puddle'
        }
    },

    // 34s: Line AOEs
    // 1. Through Arrow Debuff Players
    {
        time: 37000,
        type: 'spawn_target_prop',
        data: {
            criteria: 'has_debuff',
            debuffId: 99,
            aimFromOrigin: true,
            origin: { x: 512, y: 287 }, // Boss Center
            propType: 'rect',
            width: 2000, // Length (Off screen)
            height: 60,  // Thickness
            color: 0xFF0000,
            alpha: 0.3,
            duration: 3000,
            // Apply Vuln (ID 2). Stacks. If >=2, applies Damage (ID 1/Skull).
            applyDebuffIdOnStart: 2,
            name: 'Fire Breath'
        }
    },
    // 2. Through Tethered Players
    {
        time: 37000,
        type: 'spawn_target_prop',
        data: {
            criteria: 'is_tethered',
            aimFromOrigin: true,
            origin: 'tether_source', // Use their tether anchor
            propType: 'rect',
            width: 2000, // Length
            height: 80,  // Slightly wider
            color: 0xFF00FF, // Magenta for tethers
            alpha: 0.3,
            duration: 3000,
            // Apply Vuln (ID 2)
            applyDebuffIdOnStart: 2,
            name: 'Majestic Meteowrath (Tether)'
        }
    },
    {
        time: 40000,
        type: 'boss_cast',
        data: { name: 'Majestic Meteor', duration: 5000 }
    },
    // 4 Knockback Circles (Gold Donuts) - DOUBLED SIZE
    // Left Top
    {
        time: 45000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_lt', type: 'donut', x: 256, y: 150, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Left Bottom
    {
        time: 45000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_lb', type: 'donut', x: 256, y: 420, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Right Top
    {
        time: 45000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_rt', type: 'donut', x: 768, y: 150, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Right Bottom
    {
        time: 45000,
        type: 'spawn_prop',
        data: { id: 'kb_circle_rb', type: 'donut', x: 768, y: 420, width: 80, height: 70, color: 0xFFD700, duration: 10000 }
    },
    // Random Rectangles Configuration
    {
        time: 45000,
        type: 'spawn_random_props',
        data: {
            assignTethers: true,
            variants: [
                // Config A: Left (Outer), Right (Inner)
                [
                    // Left 1 (Top)
                    { type: 'rect', x: 134, y: 71, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Left 4 (Bottom)
                    { type: 'rect', x: 134, y: 502, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 2 (Mid-Top)
                    { type: 'rect', x: 890, y: 215, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 3 (Mid-Bottom)
                    { type: 'rect', x: 890, y: 358, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                ],
                // Config B: Left (Inner), Right (Outer)
                [
                    // Left 2 (Mid-Top)
                    { type: 'rect', x: 134, y: 215, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Left 3 (Mid-Bottom)
                    { type: 'rect', x: 134, y: 358, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 1 (Top)
                    { type: 'rect', x: 890, y: 71, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                    // Right 4 (Bottom)
                    { type: 'rect', x: 890, y: 502, width: 15, height: 140, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'Tether' },
                ]
            ]
        }
    },
    {
        time: 45000,
        type: 'spawn_random_props',
        data: {
            variants: [
                // Config A: Left (Outer), Right (Inner)
                [
                    // Center Lines (Inner)
                    { type: 'rect', x: 205, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 675, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 205, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.05, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                    { type: 'rect', x: 675, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.05, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                ],
                // Config B: Left (Inner), Right (Outer)
                [
                    // Center Lines (Inner)
                    { type: 'rect', x: 350, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 815, y: 287, width: 5, height: 600, color: 0xFFFFFF, alpha: 0.5, duration: 21000, name: 'White Line' },
                    { type: 'rect', x: 350, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.05, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                    { type: 'rect', x: 815, y: 287, width: 145, height: 600, color: 0xFFFFFF, alpha: 0.05, duration: 21000, damageOnExpiration: true, name: 'White Line AOE' },
                ]
            ]
        }
    },
    {
        time: 45000,
        type: 'boss_cast',
        data: { name: 'Knockback', duration: 7000 }
    },
    // Trigger Knockbacks (Sync with visual end)
    {
        time: 52000,
        type: 'knockback',
        data: { x: 256, y: 150, distance: 360, radius: 80, duration: 2000 }
    },
    {
        time: 52000,
        type: 'knockback',
        data: { x: 256, y: 420, distance: 360, radius: 80, duration: 2000 }
    },
    {
        time: 52000,
        type: 'knockback',
        data: { x: 768, y: 150, distance: 360, radius: 80, duration: 2000 }
    },
    {
        time: 52000,
        type: 'knockback',
        data: { x: 768, y: 420, distance: 360, radius: 80, duration: 2000 }
    },

    // 4 Red Arrow Markers (Closest to Center)
    {
        time: 57000,
        type: 'apply_target_debuff',
        data: {
            criteria: 'nearest',
            count: 4,
            origin: { x: 512, y: 287 },
            debuffId: 99, // Red Arrow
            // Duration handled by explicit removal event below or timeout
            duration: 10000
        }
    },
    {
        time: 59000,
        type: 'boss_cast',
        data: { name: 'Fire Breath', duration: 5000 }
    },

    // Puddle Drop (2s after arrows)
    {
        time: 59500,
        type: 'spawn_target_prop',
        data: {
            criteria: 'all',
            propType: 'circle',
            width: 60, // Radius
            color: 0xFFA500, // Orange
            alpha: 0.5,
            duration: 1500,
            damageOnExpiration: true,
            name: 'Puddle'
        }
    },
    {
        time: 62000,
        type: 'spawn_target_prop',
        data: {
            criteria: 'all',
            propType: 'circle',
            width: 60, // Radius
            color: 0xFFA500, // Orange
            alpha: 0.5,
            duration: 1500,
            damageOnExpiration: true,
            name: 'Puddle'
        }
    },
    {
        time: 63500,
        type: 'spawn_target_prop',
        data: {
            criteria: 'all',
            propType: 'circle',
            width: 60, // Radius
            color: 0xFFA500, // Orange
            alpha: 0.5,
            duration: 1500,
            damageOnExpiration: true,
            name: 'Puddle'
        }
    },

    // 34s: Line AOEs
    // 1. Through Arrow Debuff Players
    {
        time: 66000,
        type: 'spawn_target_prop',
        data: {
            criteria: 'has_debuff',
            debuffId: 99,
            aimFromOrigin: true,
            origin: { x: 512, y: 287 }, // Boss Center
            propType: 'rect',
            width: 2000, // Length (Off screen)
            height: 60,  // Thickness
            color: 0xFF0000,
            alpha: 0.3,
            duration: 3000,
            // Apply Vuln (ID 2). Stacks. If >=2, applies Damage (ID 1/Skull).
            applyDebuffIdOnStart: 2,
            name: 'Fire Breath'
        }
    },
    // 2. Through Tethered Players
    {
        time: 66000,
        type: 'spawn_target_prop',
        data: {
            criteria: 'is_tethered',
            aimFromOrigin: true,
            origin: 'tether_source', // Use their tether anchor
            propType: 'rect',
            width: 2000, // Length
            height: 80,  // Slightly wider
            color: 0xFF00FF, // Magenta for tethers
            alpha: 0.3,
            duration: 3000,
            // Apply Vuln (ID 2)
            applyDebuffIdOnStart: 2,
            name: 'Majestic Meteowrath (Tether)'
        }
    },

    // Cleanup
    {
        time: 70000,
        type: 'clear_props',
        data: {}
    }
];
