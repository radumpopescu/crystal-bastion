# Crystal Bastion

A browser-based **isometric tower defense roguelite** built in pure TypeScript + Canvas 2D. You defend a central base from escalating waves of monsters while collecting gold, deploying towers to expand your safe zone, picking up stat cards, and earning crystals that unlock permanent relics between runs.

---

## Core Loop

1. **Survive the wave** — move with WASD / joystick, dash to reposition, and let your auto-firing weapons cut down monsters pouring in from the edge.
2. **Between waves** — spend gold on base upgrades and tower deployments; buy stat cards from the shop.
3. **Level up** — every few kills you pick one of four cards to buff your build.
4. **Die** — your run ends when either the base falls or your character dies. You convert progress into **crystals**.
5. **Unlock relics** — spend crystals in the Relics menu for permanent, account-wide boosts that carry into future runs.

### Key mechanics
- **Leash / safe zone** — you can't stray far from the base or its towers. Towers chain their safe zones outward so building outposts expands where you can safely fight.
- **Wave timer** — waves auto-start after a countdown. Starting early gives a gold bonus.
- **Base aura** — the base has a close-range damage aura that chews up anything that gets close.
- **Kill attribution** — each kill is tagged by who landed the killing blow (Player / Base / Towers) and the totals show in the sidebar.

---

## Enemies

| Enemy | HP | Speed | Damage | Gold | Notes |
|---|---|---|---|---|---|
| 🔴 **Grunt** | 50 | 70 | 9 | 3 | Baseline teardrop blob, angry eyebrow. Shows up everywhere. |
| 🟠 **Rusher** | 28 | 145 | 6 | 2 | Fast diamond-shaped sprinter with motion lines. Gets on you quickly. |
| 🟣 **Brute** | 220 | 48 | 24 | 7 | Wide horned bruiser, hits hard and takes punishment. |
| ⚫ **Tank** | 500 | 32 | 35 | 14 | Hexagonal armor-plated monster. Late-wave wall. |

All enemies share a giant googly eye whose pupil tracks the player in real time.

### Wave scaling
- Base count: **4** monsters in wave 1
- Growth factor: **×1.22** per wave
- Interval between waves: **32s** (extendable with a relic)

---

## Player Weapons

You can carry up to **6 weapons** (more with a relic). Duplicates of a weapon stack into levels 1→4; each level adds a specific bonus listed below. Every weapon auto-fires at the nearest enemy in range.

| Weapon | Icon | Rarity | Damage | Range | Rate | Notes & Level Bonuses |
|---|---|---|---|---|---|---|
| **Pistol** | 🔫 | Common | 22 | 240 | 1.2/s | Reliable starter. L2 +25% dmg · L3 +30% rate · L4 +40% range & dmg |
| **Shotgun** | 💥 | Common | 14 | 160 | 0.55/s | 6-pellet spread. L2 +2 pellets · L3 +35% dmg · L4 +45% dmg & +2 pellets |
| **Assault Rifle** | ⚡ | Common | 13 | 220 | 3.5/s | High rate of fire. L2 +40% rate · L3 +30% dmg · L4 +50% dmg & rate |
| **Sword** | ⚔️ | Common | 45 | 90 | 1.1/s | Melee arc, hits everything nearby. L2 +30% dmg & range · L3 +50% dmg · L4 +80% dmg, bigger arc |
| **Flamethrower** | 🔥 | Uncommon | 8 | 140 | 8/s | Short cone, burns enemies. L2 +40% dmg · L3 +50% range · L4 +60% dmg & range |
| **Grenade** | 💣 | Uncommon | 80 | 300 | 0.5/s | Arcing explosive, blast radius 90. L2 +40% blast · L3 +50% dmg · L4 +70% dmg & radius |
| **Boomerang** | 🪃 | Uncommon | 38 | 260 | 0.7/s | Returns to you, hits twice. L2 +3 bounces · L3 +40% dmg · L4 +60% dmg & extra spin |
| **Sniper** | 🎯 | Rare | 70 | 500 | 0.4/s | Pierces enemies. L2 +50% dmg · L3 +30% rate · L4 +80% dmg, pierces all |
| **Lightning** | ⚡🌩 | Rare | 35 | 280 | 0.9/s | Chains 3 enemies. L2 +2 chains · L3 +45% dmg · L4 +60% dmg & +3 chains |
| **Minigun** | 🌀 | Rare | 9 | 200 | 0.5→9/s | Spins up to crazy rate. L2 +50% dmg · L3 faster spin-up · L4 +70% dmg & rate |

---

## The Base (Tower)

Your central structure — if its HP hits 0, the run ends.

- **HP**: 600 (base)
- **Attack range**: 300, **damage**: 28, **fire rate**: 0.9/s
- **Aura**: 140 radius, 4 dmg/s to anything inside
- **Safe zone radius**: 700

### Base Upgrades (in-run, bought with gold)

| Upgrade | Effect | Cost (per level) | Max Level |
|---|---|---|---|
| **Base HP +150** | Raises base HP pool | 60 · 100 · 150 · 210 · 280 | 5 |
| **Base Range +60** | Extends attack range | 70 · 120 · 180 · 250 · 330 · 430 · 560 · 720 | 8 |
| **Base Damage +40%** | Multiplicative per level | 80 · 130 · 190 · 260 · 340 | 5 |
| **Multishot +1 target** | Hits N enemies at once | 90 · 150 · 220 · 300 | 4 |

The base's rotating turret barrel visibly aims at the nearest monster and projectiles launch from the turret tip with an arc down to the ground.

---

## Towers (Outposts)

Placed by the player for **55 gold** each (cheaper with relics/cards). Towers chain safe zones, have their own HP and auto-attack, and share a **global level (1-5)** — upgrading one upgrades all.

- **HP**: 100 (base), **attack**: 20 dmg, **range**: 240
- **Safe zone range**: 550
- **Level scaling**: +28% damage and +18 range per level
- **Visual tint by level**: L1 blue → L2 cyan → L3 teal → L4 orange → L5 gold (glowing orb on top)

---

## Level-Up Cards (Stat Upgrades)

Picked from a 4-card draft after leveling up. Max count = per-stack cap.

### Player cards
| Card | Effect | Max |
|---|---|---|
| ❤️ **Max HP** | +30 max health | 8 |
| 💚 **Regeneration** | +0.1 HP/sec regen | 6 |
| 🩸 **Life Steal** | +0.15 HP on hit | 5 |
| 💢 **Raw Damage** | +22% weapon damage (multiplicative) | 6 |
| ⚡ **Attack Speed** | +22% attack speed | 6 |
| 👟 **Move Speed** | +35 movement speed | 5 |
| 🔭 **Range** | +22% weapon range | 5 |
| 🛡️ **Armor** | -12% damage taken (capped at 85% reduction) | 5 |
| 💵 **Gold Finder** | +20% gold from kills | 5 |
| 🍀 **Lucky** *(uncommon)* | +1 luck — rarer cards appear more often | 4 |
| 🌀 **Dash Level** | +15% dash speed, +12% dash duration | 5 |
| 💨 **Dash Charge** | +1 max dash charge | 5 |

### Base cards
| Card | Effect |
|---|---|
| 🏰 **Base Repair** *(uncommon)* | Restore 200 base HP (only appears when damaged) |
| 🗼 **Base Overcharge** *(uncommon)* | +30% base damage for the run |
| 📡 **Base Radar** *(uncommon)* | +120 base attack range |
| 🌀 **Base Rapid Fire** *(uncommon)* | +35% base fire rate |

### Tower cards
| Card | Effect |
|---|---|
| 🔧 **Repair Towers** *(uncommon)* | Fully heal all towers |
| ⚔️ **Tower Arsenal** *(uncommon)* | +55% tower damage for the run |
| 💰 **Supply Lines** *(uncommon)* | Towers cost 5 less gold |
| ⬆️ **Tower Mastery** *(rare)* | All towers +1 global level (max 5) |

---

## Relics (Meta Upgrades)

Permanent upgrades bought with **crystals** earned at the end of each run. Crystal reward scales with wave reached and the `Crystal Attunement` relic.

### 👤 Player
| Relic | Effect | Cost | Max |
|---|---|---|---|
| **Iron Constitution** | +20 max HP | 6 | 8 |
| **Second Wind** | +0.1 HP/sec regen | 8 | 5 |
| **Hardened Scales** | +6% damage reduction | 10 | 5 |
| **Wrath Sigil** | +15% all damage | 10 | 6 |
| **Phantom Step** | +1 starting dash charge | 8 | 3 |
| **Windwalker** | +15 movement speed | 8 | 4 |

### 💰 Economy
| Relic | Effect | Cost | Max |
|---|---|---|---|
| **Buried Stash** | +35 starting gold | 5 | 6 |
| **Crystal Attunement** | +15% crystals earned per wave | 14 | 4 |
| **Blitz Pact** | +30% early-wave gold bonus | 10 | 4 |
| **Black Market** | -5 gold on shop cards | 12 | 3 |
| **Loaded Dice** | -1 starting reroll cost | 10 | 2 |

### 🏰 Base
| Relic | Effect | Cost | Max |
|---|---|---|---|
| **Ancient Foundation** | +200 base HP | 8 | 6 |
| **Siege Runes** | +25% base damage | 10 | 5 |
| **Beacon Lens** | +100 base attack range | 9 | 4 |
| **Overclock** | +20% base fire rate | 10 | 4 |
| **Scorched Earth** | +25% base aura damage | 10 | 4 |

### 🔵 Towers
| Relic | Effect | Cost | Max |
|---|---|---|---|
| **Granite Walls** | +80 tower HP | 9 | 5 |
| **Ballistae** | +40% tower damage | 10 | 4 |
| **Signal Fires** | +100 tower safe-zone range | 9 | 4 |
| **Supply Lines** | -8 gold tower cost | 12 | 3 |

### 🔓 Unlocks
| Relic | Effect | Cost | Max |
|---|---|---|---|
| **Ancestral Armory** | Start with the Assault Rifle | 12 | 1 |
| **Ceasefire Accord** | +8s between waves | 8 | 4 |
| **Pioneer's Kit** | Start with extra gold | 15 | 3 |
| **Arcane Masons** | Hold Shift to auto-build towers while walking | 20 | 1 |
| **Dual Wielder** | Start with an extra weapon slot | 18 | 1 |

---

## Controls

### Desktop
- **WASD** — move
- **Space / Shift** — dash
- **E** — place tower (near safe-zone edge)
- **Click** — buttons / shops
- **P / Esc** — pause

### Mobile landscape
- **Left virtual joystick** — move
- **Right action buttons** — dash, place tower
- Dedicated UI drawer for stats, loadout, and between-wave decisions

---

## Tech

- **Pure TypeScript + Canvas 2D**, no framework
- **Bun** build system (`bun run build`) with hashed JS/CSS bundles for cache-busting
- Procedural graphics: no sprite sheets — everything drawn with primitives and cached to offscreen canvases via a `getSprite()` helper
- Meta progression persisted in `localStorage` under `towerMeta3d`
- Isometric projection via `w2s()`; camera lerps toward player

---

## Dev Menu

Hold on the menu logo for 2 seconds to reveal a sandbox menu where you can:
- Preset gold, wave, every weapon level, every stat card count, every relic level
- Jump straight into a test wave with an exact loadout
- Zero/max all relics with one click — useful for balancing against both extremes

---

*Version tracked in `src/version.ts` (YYYY.MM.DD.build format).*
