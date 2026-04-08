# PixelForge Architecture Audit

**Date:** 2026-03-25
**Auditor:** System Architecture Designer
**Scope:** Full architecture review against industry-standard tile map editors (Tiled, LDtk, RPG Maker, Aseprite)

---

## 1. MISSING FEATURES AND CAPABILITIES

### Critical (blocks professional use)

| ID | Missing Feature | Rationale |
|----|----------------|-----------|
| F-01 | **Undo/Redo system (Command pattern)** | Not mentioned anywhere in the architecture. Without a robust undo stack (50-100+ operations minimum), the editor is unusable for real work. Must support compound operations (e.g., flood fill = one undo step). |
| F-02 | **Auto-tile / terrain rules engine** | Tiled, LDtk, and RPG Maker all have auto-tiling (Wang tiles, bitmask-based terrain). Without this, placing terrain is painfully manual. Mana Seed packs include terrain-compatible tiles -- this must be supported. |
| F-03 | **Animation support** | No mention of animated tiles (water, torches, foliage). Requires: frame sequencing per tile, animation preview in editor, export with animation metadata. Aseprite files inherently contain animation data -- the importer must extract it. |
| F-04 | **Collision / physics layer system** | The layer manager is mentioned but no collision layers. Unity devs need: collision shapes per tile (box, polygon, none), trigger zones, one-way platforms. This is a hard requirement for game-ready exports. |
| F-05 | **Object/Entity layer** | Only tile layers implied. Games need entity placement: spawn points, NPCs, triggers, light sources, particle emitters. LDtk and Tiled both have dedicated object layers with custom properties. |
| F-06 | **Custom properties system** | Tiles and objects need arbitrary key-value metadata (e.g., "damage: 5", "walkable: false", "sound: grass_step"). This is how game logic connects to map data. Every major editor supports this. |
| F-07 | **Multi-map / world map organization** | No mention of managing multiple maps or a world-level view. LDtk has world layout with neighbor connections. RPG Maker has map trees. Indie devs typically have 50-200+ maps per project. |

### Important (significantly impacts workflow)

| ID | Missing Feature | Rationale |
|----|----------------|-----------|
| F-08 | **Flood fill / paint bucket tool** | Only lasso tool mentioned. Need: paint bucket, rectangle fill, line tool, shape tools, eyedropper. These are baseline editor tools. |
| F-09 | **Tile brush patterns** | Scatter brushes, random tile placement from a set, weighted random. Essential for natural-looking terrain (e.g., 5 grass variants placed randomly). |
| F-10 | **Grid snapping and multi-grid support** | LimeZu uses 16/32/48px tiles. Need per-layer grid sizes or sub-grid snapping to mix tile scales on the same map. |
| F-11 | **Map templates / prefabs** | Save and reuse tile arrangements (a house, a dungeon room). Critical for prompt-based generation -- the AI should output prefab-like chunks. |
| F-12 | **Tile transformation tools** | Flip horizontal/vertical, rotate 90/180/270. Must be per-placement (same tile ID, different transform flags -- Tiled supports this in TMX). |
| F-13 | **Copy/paste across maps** | Standard editor operation. Must support cross-map clipboard with all layers. |
| F-14 | **Project file format / save system** | No mention of a native project file format. Need: project save/load, auto-save, crash recovery, recent files list. |
| F-15 | **Zoom and pan controls** | Not mentioned. Need: mouse wheel zoom, middle-click pan, fit-to-screen, zoom-to-selection. Minimum 25%-3200% range. |
| F-16 | **Mini-map / overview panel** | For large maps, a thumbnail navigator is essential. |
| F-17 | **Tile search and filtering** | With 2400+ tiles from LimeZu alone, users need: search by name/tag, filter by classification, favorites/recent tiles panel. |

### Nice-to-have (polish and competitive advantage)

| ID | Missing Feature | Rationale |
|----|----------------|-----------|
| F-18 | **Parallax layer support** | Scroll-rate metadata per layer for parallax backgrounds. |
| F-19 | **Light/shadow layer** | Ambient lighting overlay, day/night tinting. Increasingly expected in modern 2D games. |
| F-20 | **Tile variation aliases** | Mark tiles as "variants of X" so auto-tile can randomly pick between them. |
| F-21 | **In-editor playtest mode** | Walk around the map with a character sprite to test feel. RPG Maker has this built in. |
| F-22 | **Plugin/extension API** | Let users write custom tools, importers, exporters. |
| F-23 | **Collaborative editing** | Real-time or async multi-user map editing. Differentiator for teams. |

---

## 2. TECHNICAL RISKS AND EDGE CASES

### Critical

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R-01 | **Electron memory pressure with large tilesets** | LimeZu = 2400+ tiles as PNG spritesheets. Loading all as individual Phaser textures will exhaust GPU memory. At 48x48 with padding, a single atlas can exceed 4096x4096 (max texture size on older GPUs). | Use texture atlas packing with multiple pages. Implement virtual scrolling in tile palette. Lazy-load tile pages. Query `gl.MAX_TEXTURE_SIZE` at startup. |
| R-02 | **LLM endpoint reliability** | Free tiers (Groq, NVIDIA, Mistral) have aggressive rate limits, unstable uptime, and may change APIs without notice. If 3+ providers fail simultaneously, the copilot is dead. | Implement circuit breaker pattern per provider. Cache successful generation results. Provide offline fallback (rule-based generation). Track provider health metrics. |
| R-03 | **Color harmonization accuracy** | Mapping arbitrary palettes to Mana Seed's specific 3-4 color ramp system is a hard color science problem. Naive nearest-color matching will produce muddy results, especially with LimeZu's different art style (more colors, different shading approach). | Use perceptual color space (OKLAB, not RGB/HSL) for matching. Allow manual ramp assignment override. Preview before committing. Support per-tile or per-region harmonization tuning. |
| R-04 | **Aseprite file parsing** | .aseprite is a binary format with layers, frames, blend modes, indexed palettes, and cel linking. Incomplete parsing will silently drop data. | Use a battle-tested parser (aseprite-reader npm package). Validate against edge cases: linked cels, blend modes, tilemap mode (Aseprite v1.3+), color profiles. |
| R-05 | **Map size scaling** | No stated map size limits. A 500x500 tile map at 16x16 = 8000x8000 pixels = 64 megapixels. Phaser's Canvas/WebGL renderer will choke on a single draw call for this. | Implement chunked rendering (only draw visible + 1-chunk buffer). Use camera culling. Set reasonable max map size (e.g., 1024x1024) with warnings. |

### Important

| ID | Risk | Impact | Mitigation |
|----|------|--------|------------|
| R-06 | **TMX export fidelity** | TMX format has specific requirements for tile GIDs, tileset references, and encoding (base64, zlib, csv). Subtle errors produce maps that load in Tiled but crash in game engines. | Write comprehensive TMX export tests. Validate output against Tiled's XSD schema. Test round-trip: export TMX, open in Tiled, re-export, diff. |
| R-07 | **AI prompt injection via world generation** | If the prompt bar sends raw user text to LLM endpoints, adversarial prompts could cause unexpected behavior or token waste. | Sanitize and template-wrap all user prompts. Use system prompts with strict output format constraints. Validate LLM output against expected tile placement schema before applying. |
| R-08 | **File system race conditions** | Non-destructive editing means maintaining original + harmonized cache. Concurrent file operations (import + harmonize + classify) on the same pack can corrupt cache. | Use file locks or a write queue per pack directory. Implement cache invalidation checksums. |
| R-09 | **Cross-platform path handling** | Electron on Windows vs macOS vs Linux. Tile pack paths, project saves, and cache directories behave differently. | Use `path.join()` everywhere. Never hardcode separators. Use `app.getPath()` for standard directories. Test on all three platforms. |
| R-10 | **AI-generated tile placement validation** | The WorldGenerator will produce tile coordinates. If the LLM hallucinates invalid coordinates, tile IDs, or impossible placements (wall floating in air), the result is garbage. | Validate all AI output against a placement rule engine: adjacency rules, z-ordering, boundary checks. Post-process with constraint satisfaction. Let user accept/reject per-region. |

---

## 3. UX GAPS

### Critical

| ID | Gap | Problem | Solution |
|----|-----|---------|----------|
| U-01 | **No visible undo/redo feedback** | Users have no confidence that actions are reversible. Fear of making mistakes slows workflow. | Undo/redo buttons in toolbar + Ctrl+Z/Y. Show operation name in tooltip ("Undo: Fill 12x8 region"). Consider an operation history panel. |
| U-02 | **Tile classification is invisible** | Auto-classify runs but user cannot see or correct results. Misclassified tiles (wall tagged as ground) will break AI generation silently. | Show classification tags on tiles in palette. Allow drag-to-reclassify. Highlight low-confidence classifications. |
| U-03 | **No harmonization preview** | Palette harmonization is destructive to visual identity. Users need to see before/after and adjust. | Side-by-side preview with A/B toggle. Per-ramp adjustment sliders. "Harmonization strength" slider (0% = original, 100% = full remap). |
| U-04 | **Prompt bar lacks context awareness** | "Add a forest" means nothing without knowing: which layer, what tile types are available, what is already placed. The AI will guess wrong. | Show active layer/tileset context in prompt bar. Auto-suggest based on available tiles. Let user select a region first, then prompt ("fill this area with forest"). |

### Important

| ID | Gap | Problem | Solution |
|----|-----|---------|----------|
| U-05 | **No tile pack management UI** | "Drop files incrementally" needs visual management: see what is in each pack, remove tiles, reorganize, see harmonization status. | Pack browser panel with: tile count, preview grid, harmonization status badge, right-click context menu for operations. |
| U-06 | **Layer management is underspecified** | Only "layer manager" mentioned. No details on: reordering, visibility toggle, opacity, lock, merge, group, blend modes. | Full layer panel with: drag reorder, eye icon (visibility), lock icon, opacity slider, layer type indicator (tile/object/collision), right-click menu. |
| U-07 | **No keyboard shortcut system** | Game dev editors live and die by shortcuts. No mention of hotkeys. | Full rebindable shortcut system. At minimum: B (brush), E (eraser), G (fill), S (select), Space (pan), number keys for layers, bracket keys for brush size. |
| U-08 | **Missing progress feedback for AI operations** | World generation and harmonization are slow (2-5s per LLM call, potentially chained). Users will think the app froze. | Progress bar with estimated time. Streaming preview (show tiles as they are placed). Cancel button. "AI is thinking..." indicator with provider name. |
| U-09 | **No error recovery for failed imports** | Corrupted PNGs, unsupported Aseprite versions, wrong tile sizes -- what happens? | Graceful error dialogs with: what failed, why, how to fix. Partial import support (skip bad files, import the rest). Import log/report. |
| U-10 | **Export configuration is too simple** | "PNG + Tiled TMX" -- but which PNG? Whole map? Per layer? What scale? What about Unity-specific needs? | Export wizard with options: format selection, layer filtering, scale multiplier, atlas vs individual tiles, include/exclude collision data, Unity package option. |

### Nice-to-have

| ID | Gap | Problem | Solution |
|----|-----|---------|----------|
| U-11 | **No onboarding / tutorial** | New users will not understand the import-classify-harmonize workflow. | Interactive first-run tutorial. Tooltip hints. Sample project with pre-imported Mana Seed tiles. |
| U-12 | **No map statistics** | Devs want to know: tile count, unique tiles used, map dimensions, layer count, estimated memory usage at runtime. | Stats panel or status bar with key metrics. |

---

## 4. MISSING ARCHITECTURAL COMPONENTS

### Critical

| ID | Component | Purpose |
|----|-----------|---------|
| A-01 | **CommandManager (Undo/Redo)** | Command pattern implementation. Every editor operation is a Command object with execute() and undo(). Maintains a bounded stack. Supports compound commands for multi-step operations. |
| A-02 | **RuleEngine / AutoTiler** | Bitmask-based auto-tiling. Manages terrain rule definitions. Supports Wang tile sets (2-corner, 2-edge, full). Integrates with AI for rule suggestion. |
| A-03 | **EntityManager** | Manages non-tile objects on object layers. Supports custom property schemas. Handles selection, movement, snapping. |
| A-04 | **ProjectManager** | Native project file format (.pxf or similar). Save/load, auto-save timer, crash recovery journal, recent projects list. Manages relative paths for portability. |
| A-05 | **CollisionLayerEditor** | Visual collision shape editing. Per-tile collision assignment. Shape types: AABB, polygon, circle, none. Exportable as separate data or embedded in TMX. |
| A-06 | **AnimationManager** | Frame sequencing for animated tiles. Playback preview. Export animation metadata. Aseprite animation data extraction. |

### Important

| ID | Component | Purpose |
|----|-----------|---------|
| A-07 | **CacheManager** | Centralized cache for: harmonized tiles, AI generation results, texture atlases, classification data. LRU eviction. Disk-backed with memory budget. |
| A-08 | **InputManager / ShortcutRegistry** | Centralized input handling. Rebindable shortcuts. Context-aware (different shortcuts for map canvas vs palette). Gamepad support for playtest mode. |
| A-09 | **ChunkRenderer** | Chunked tile rendering for large maps. Camera-based culling. Only renders visible chunks + buffer zone. Dirty-region tracking for partial redraws. |
| A-10 | **ValidationEngine** | Pre-export validation: orphan tiles, missing tilesets, out-of-bounds placements, unresolved entity references. AI output validation against placement rules. |
| A-11 | **PluginHost** | Extension API for custom tools, importers, exporters. Sandboxed execution. Event hooks for all editor operations. |
| A-12 | **TelemetryManager** | Anonymous usage analytics (opt-in). LLM provider success/failure rates. Performance metrics. Crash reporting. |

---

## 5. PERFORMANCE CONSIDERATIONS

| ID | Concern | Detail |
|----|---------|--------|
| P-01 | **Tile palette rendering with 2400+ tiles** | LimeZu Modern Exteriors has 2400+ tiles. Rendering all in a scrollable palette will lag. Use virtualized list rendering -- only render visible rows. |
| P-02 | **Spritesheet slicing at import** | Slicing a 2400-tile spritesheet into individual tile textures at import is CPU-intensive. Do this in a Web Worker. Show progress. Cache the result. |
| P-03 | **Harmonization batch processing** | Re-harmonizing 2400+ tiles when the primary palette changes is expensive. Process incrementally. Use Web Workers. Allow cancellation. |
| P-04 | **LLM response parsing** | World generation may produce large JSON payloads describing tile placements. Parse and validate in a Web Worker to avoid blocking the UI thread. |
| P-05 | **Electron IPC overhead** | Heavy file I/O (tile import, project save) should happen in the main process with IPC streaming, not by sending large buffers over IPC in one shot. |
| P-06 | **Texture memory budget** | Track VRAM usage. At 16x16 with RGBA, 2400 tiles = ~2.4 MB raw, but atlas padding and power-of-two textures inflate this. With multiple packs, budget carefully. Implement texture page swapping if needed. |

---

## 6. UNITY-SPECIFIC EXPORT REQUIREMENTS

Indie Unity devs need more than PNG + TMX. Here is what the export pipeline should support:

| ID | Requirement | Priority |
|----|-------------|----------|
| E-01 | **Unity Tilemap format** | Critical -- Unity uses its own Tilemap system. Export as a Unity package (.unitypackage) with: Tile assets, Tilemap Palette, Grid + Tilemap GameObjects as a prefab. Alternatively, export as a Unity-compatible JSON that a companion Unity editor script can import. |
| E-02 | **Sprite atlas with metadata** | Critical -- Unity needs sprites sliced in its atlas format. Export a texture + .meta file with sprite rects, pivot points, and pixels-per-unit. |
| E-03 | **Collision data as Tilemap Collider 2D** | Important -- Export collision shapes so Unity can auto-generate TilemapCollider2D or CompositeCollider2D. |
| E-04 | **Rule Tiles export** | Important -- If PixelForge has auto-tile rules, export them as Unity Rule Tile assets. This saves massive setup time in Unity. |
| E-05 | **Sorting layers mapping** | Important -- Map PixelForge layers to Unity sorting layers with correct order values. |
| E-06 | **Animated Tiles** | Nice-to-have -- Unity has AnimatedTile support. Export frame data as Unity AnimatedTile assets. |
| E-07 | **Custom property export as ScriptableObjects** | Nice-to-have -- Export tile/entity custom properties as ScriptableObject data so Unity scripts can reference them. |
| E-08 | **Godot Tilemap export** | Nice-to-have -- Many indie devs use Godot. Export as .tscn or .tres format. Broadens market significantly. |

---

## 7. ADDITIONAL FILE FORMAT SUPPORT

| Format | Priority | Rationale |
|--------|----------|-----------|
| **LDtk (.ldtk)** | Important | Increasingly popular. Bidirectional support (import and export) would be a major draw. |
| **RPG Maker (.rpgmvp, .json)** | Nice-to-have | Large community. Import support lets users migrate projects. |
| **GameMaker room format** | Nice-to-have | Another large indie engine. |
| **JSON tilemap (generic)** | Important | Simple JSON export for custom engines. Configurable schema. |
| **Tiled .tsx (tileset)** | Important | Currently only TMX mentioned. Need standalone tileset export/import for tileset sharing. |

---

## 8. SUMMARY RISK MATRIX

| Severity | Count | Top Concern |
|----------|-------|-------------|
| Critical | 7 features, 5 risks, 4 UX gaps, 6 components | Undo system, auto-tiling, collision layers, and LLM reliability are all blockers for professional use. |
| Important | 10 features, 5 risks, 6 UX gaps, 6 components | Tile search/filter, harmonization preview, project save format, and Unity export fidelity are essential for the target audience. |
| Nice-to-have | 6 features, 0 risks, 2 UX gaps, 0 components | Plugin API, collaborative editing, and playtest mode are differentiators but not launch blockers. |

---

## 9. RECOMMENDED ARCHITECTURE ADDITIONS (Component Diagram)

```
+------------------------------------------------------------------+
|                        PixelForge Application                     |
+------------------------------------------------------------------+
|  UI Layer                                                         |
|  +------------+ +----------+ +---------+ +--------+ +---------+  |
|  | TilePalette| | MapCanvas| | LayerMgr| |PromptBar| |PackBrowser|
|  | (virtual   | | (chunked | | (full   | |(context | |(pack mgmt |
|  |  scroll)   | |  render) | |  panel) | | aware)  | | UI)       |
|  +------------+ +----------+ +---------+ +--------+ +---------+  |
+------------------------------------------------------------------+
|  Editor Engine                                                    |
|  +----------+ +-----------+ +-----------+ +----------+           |
|  |CommandMgr| |AutoTiler   | |EntityMgr   | |ProjectMgr|          |
|  |(undo/redo)| |(wang/bitmask)|(objects)   | |(save/load)|         |
|  +----------+ +-----------+ +-----------+ +----------+           |
|  +----------+ +-----------+ +-----------+ +----------+           |
|  |SelectionEng|AnimationMgr| |CollisionEd | |InputMgr  |          |
|  |(lasso,rect)|(frames,prev)|(shapes,poly)| |(shortcuts)|         |
|  +----------+ +-----------+ +-----------+ +----------+           |
+------------------------------------------------------------------+
|  AI Copilot                                                       |
|  +----------+ +-----------+ +-----------+ +----------+           |
|  |WorldGen  | |TileClassify| |PaletteHarm | |ValidationEng|       |
|  |(prompt)   | |(tags,conf) | |(OKLAB)     | |(rules,adj)  |       |
|  +----------+ +-----------+ +-----------+ +----------+           |
+------------------------------------------------------------------+
|  Data Layer                                                       |
|  +----------+ +-----------+ +-----------+ +----------+           |
|  |CacheManager|ChunkRenderer|ExportManager|TelemetryMgr|          |
|  |(LRU,disk) | |(culling)   |(TMX,Unity, | |(opt-in)   |          |
|  |           | |            | JSON,LDtk) | |           |          |
|  +----------+ +-----------+ +-----------+ +----------+           |
+------------------------------------------------------------------+
|  Provider Layer                                                   |
|  +----------+ +-----------+ +-----------+                        |
|  |LLM Router | |Circuit    | |SD3 Asset  |                        |
|  |(priority) | |Breaker    | |Generator  |                        |
|  +----------+ +-----------+ +-----------+                        |
+------------------------------------------------------------------+
```

---

## 10. RECOMMENDED IMPLEMENTATION ORDER

**Phase 1 (MVP must-haves):**
1. CommandManager (undo/redo) -- F-01, A-01
2. ProjectManager (save/load) -- F-14, A-04
3. Basic tool palette (fill, eyedropper, flip/rotate) -- F-08, F-12
4. Zoom/pan controls -- F-15
5. Keyboard shortcuts -- U-07
6. Tile search/filter in palette -- F-17
7. Harmonization preview -- U-03
8. Classification review UI -- U-02
9. ChunkRenderer for large maps -- A-09, R-05
10. Input validation for AI output -- R-10, A-10

**Phase 2 (Post-MVP essentials):**
1. Auto-tile / terrain rules -- F-02, A-02
2. Collision layer editor -- F-04, A-05
3. Object/entity layer -- F-05, A-03
4. Custom properties -- F-06
5. Animation support -- F-03, A-06
6. Multi-map world view -- F-07
7. Unity export pipeline -- E-01 through E-05

**Phase 3 (Differentiators):**
1. Plugin API -- F-22, A-11
2. LDtk import/export
3. Godot export
4. Playtest mode -- F-21
5. Collaborative editing -- F-23
