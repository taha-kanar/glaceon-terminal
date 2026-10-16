# Memory leaks and renderer performance

## Context

On 2026-10-11 we measured the installed build (`/Applications/Glaceon Terminal.app`, built Oct 5 from this
rewrite; its asar contains `XtermViewRegistry`) after it had been open for 6 days. The **GPU process used
6.4 GB, mostly IOSurface**, and the **renderer used 1.5 GB** (see mem note `mac-multi-session-memory`). The
existing leak test (`apps/desktop/e2e/stress.spec.ts:54`) only opens and closes 200 panes and checks
views, sessions, DOM nodes and JS heap. It can't see GPU memory, tab switching, theme changes, tab moves
or hours of colorful output.

An earlier leak pass is already in the working tree but not committed: `SessionManager.release` settles
incoming transfers and clears `#focusRequest`, acks are guarded after wiring is disposed, `HostSession` no
longer keeps `deps`, the transfer coordinator drops queued imports, and drags clean up their pointer
listeners (`use-pointer-drag.ts`, `drag-cleanup.test.tsx`). We keep all of it and build on top. Nothing
gets committed unless you ask.

## Findings

### Memory

| # | Problem | Where | Status |
|---|---|---|---|
| M1 | The **WebGL glyph atlas grows to GBs, and each WebGL context holds its own copy**. In addon-webgl 0.19, `TextureAtlas` keeps up to 16 pages (`MAX_TEXTURE_IMAGE_UNITS`). Merged pages double in size up to the GL `MAX_TEXTURE_SIZE`, which is 16384 on Apple GPUs (the 4096 limit is only a fallback). A glyph that is too wide gets a page of `MAX_TEXTURE_SIZE²`, which is 1 GiB. `clearTexture()` empties pages but never shrinks them. Glyphs are stored per fg/bg color, so truecolor animations (like the Claude Code shimmer) keep adding entries. `GlyphRenderer` uploads every page as a texture **in every context**. The atlas is only freed when the last terminal using it drops WebGL (`CharAtlasCache.removeTerminalFromCache`). | `node_modules/.pnpm/@xterm+addon-webgl@0.19.0/.../TextureAtlas.ts:155-200,794`, `GlyphRenderer.ts:121-195` | Code reading shows it. Most likely cause of the 6.4 GB; Phase 0 confirms |
| M2 | **Disposed WebGL contexts stay alive until GC.** `WebglRenderer.dispose` deletes programs, buffers and textures but never calls `loseContext()`. The canvas and its drawing buffers stay until V8 collects them, and they still count toward Chromium's 16-context limit. Past that limit Chromium drops the *oldest* context, which can be a visible pane's. That is exactly what `WEBGL_CONTEXT_BUDGET = 12` tries to prevent. Each tab switch can release up to 12 contexts and create up to 12 new ones. | `xterm-terminal-view.ts:309-330` | Confirmed in library code |
| M3 | **Quake prewarm ignores `quakeEnabled`.** A hidden renderer, a shell and a WebGL context stay alive even when quake is turned off. | `apps/desktop/src/main/quake.ts:63,127` | Confirmed |
| M4 | **Clipboard ring entries have no size limit.** The 1 s poll stores clips of any size (only the IPC copy path has the 16 MB cap at `main/tools.ts:43`). Every window keeps a copy of the full ring (`renderer/tools.ts:43`). | `packages/application/src/clipboard/clipboard-ring-service.ts:54-68` | Confirmed |
| M5 | The pty-host `connections` map keeps disposed entries when a port closes by itself (for example, a renderer crash). The leak is tiny. | `apps/desktop/src/pty-host/composition-root.ts:34-49` | Confirmed |

### Renderer performance

| # | Problem | Where |
|---|---|---|
| P1 | **Hidden tabs keep rendering.** `.pane--hidden` uses `visibility:hidden`. xterm only pauses when its IntersectionObserver reports "not intersecting" (`RenderService._handleIntersectionChange`), and that check ignores visibility. Hidden panes use the DOM renderer (their WebGL was released), so background output (spinners, dev servers, Claude Code) rebuilds DOM rows nobody can see. | `packages/ui/src/styles/index.css:385` |
| P2 | **Hidden panes are refitted on every resize.** For every pane of every tab, each window-resize frame runs ResizeObserver → `fit()`, which reflows 10k lines of scrollback and sends a pty resize (SIGWINCH). | `xterm-terminal-view.ts:93-96,289-294` |
| P3 | **Divider drag and window resize** refit and resize the pty every frame. `setSplitRatio` runs on every pointermove (120 Hz on ProMotion) and re-renders the whole `App`. | `packages/ui/src/panes/Divider.tsx:38-41` |
| P4 | **Any settings change rebuilds every terminal's atlas.** `viewOptions()` builds a new theme object (`view-options.ts:10`) and `setOptions` assigns all options (`xterm-terminal-view.ts:169`). Every pane then gets `onChangeColors`, re-acquires its atlas and redraws everything. `applyTheme`/`applyBackground` rewrite the root CSS variables, which recalculates styles for the whole document. Dragging the opacity slider triggers all of this on every tick. | `apps/desktop/src/renderer/composition-root.ts:124-131` |
| P5 | A full-window grain layer with `mix-blend-mode: overlay` sits above the terminals at z-index 30, so the window has to be blended again every frame any pane draws. Not measured yet. | `index.css:80-90` |
| P6 | `App` re-renders everything (all panes of all tabs, the tab bar, the title bar) on any session-info or workspace change. Nothing in `ui/` is memoized. This is minor; we measure it before changing anything. | `packages/ui/src/app/App.tsx:25-33` |

## Phase 0: Measure before fixing

1. **Add more probe data.** Extend `ProbeResources` (`apps/desktop/src/renderer/global.d.ts:50`,
   `e2e-probe.ts:26`) with:
   - `atlasBytes`: the registry keeps a `Map<HTMLCanvasElement, bytes>` filled from each view's
     `WebglAddon.onAddTextureAtlasCanvas` / `onRemoveTextureAtlasCanvas`. The map de-duplicates because
     the shared atlas fires once per view.
   - `contextLosses`: `webglcontextlost` events we didn't cause.
   - `maxTextureSize`.
   - `renders(pane)`: a per-view `terminal.onRender` counter.
2. **Add a `gpuMemory()` fixture helper** (`apps/desktop/e2e/fixtures/app.ts`). It finds the GPU and
   renderer pids with `electronApp.evaluate(({ app }) => app.getAppMetrics())` and reads
   `/usr/bin/footprint -p <pid>`, which includes IOSurface.
3. **Add bench cases** to `apps/desktop/e2e/bench.spec.ts` (measurement only, `pnpm bench`):
   - *truecolor soak*: 4 visible panes print shimmering 24-bit colored text at about 30 fps for 3 min.
     Sample `atlasBytes`, GPU footprint and renderer memory every 15 s.
   - *tab switching*: two tabs with 6 panes each, switched 50 times. Record latency to the first render,
     `contextLosses`, and Chromium's "Too many active WebGL contexts" console warning.
   - *background output*: a hidden tab runs `while :; do date; sleep 0.02; done`. Record renderer CPU
     (`getAppMetrics`) and `renders(pane)`.
   - *divider drag*: 2 panes with full scrollback, 200 drag steps. Record frame times from rAF deltas
     collected in the page.
   - *settings change*: change `backgroundOpacity` 20 times. Record the time taken and the atlas changes.
4. Write the baseline numbers down. If the renderer JS heap grows in the soak, take a heap snapshot
   diff (CDP `HeapProfiler`) to explain the 1.5 GB.

## Phase 1: Memory fixes

1. **M2: free contexts right away.** In `XtermTerminalView.#attachWebgl`, note which canvases the addon
   adds under `.xterm-screen` (compare before and after `loadAddon`). In `#detachWebgl`, after
   `dispose()`, call `getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()` on them;
   a 2D canvas returns null here, which is harmless. Count unexpected `webglcontextlost` events for the
   probe.
2. **M1: limit the atlas.** The view reports atlas page add/remove events to `XtermViewRegistry`, which
   keeps the byte map from Phase 0. When the total passes `ATLAS_RECYCLE_BYTES` (start at 256 MB and
   tune it from the Phase 0 numbers), the registry schedules a recycle with `requestIdleCallback`
   (timeout 2 s, at most once every 60 s):
   - Remove WebGL from all views, so the atlas has no owner left and is disposed.
   - Clear the map.
   - Re-attach WebGL to the visible views through the existing `upgradeRenderer` path.

   Because of M2, the GPU memory comes back immediately. If an old atlas inflates the count after a theme
   change, we just recycle a bit early, which does no harm. If the soak shows recycles happening too
   often, raise the threshold. Patching the vendor code is out of scope.
3. **M3:** prewarm the quake window only when `quakeEnabled` is on. When it is turned off, close the
   prewarmed window with `forceClose`; when it is turned back on, prewarm again.
4. **M4:** add a max clip size constant to `packages/domain/src/clipboard/clipboard-ring.ts`.
   `pushClip`/`#record` leave larger clips out of the ring (they stay on the system clipboard), and
   `main/tools.ts` uses the same constant. Add unit tests in domain and application.
5. **M5:** remove the `connections` entry when the served connection closes by itself, by giving
   `servePtyConnection` an `onClose` callback.
6. **Extend the leak test** (`stress.spec.ts`) with no forced GC between steps:
   - 30 switches between two 6-pane tabs: `contextLosses` stays 0, visible panes stay `webgl`, and
     `domNodes` returns to baseline.
   - 20 theme changes: `atlasBytes` returns close to baseline and the heap stays flat.
   - 50 exit → restart cycles.
   - Moving a tab to a new window and back 10 times: sessions, views and heap stay flat.

## Phase 2: Renderer performance (in order of expected gain)

1. **P1: pause hidden panes.** Add `transform: translateX(-100vw)` to `.pane--hidden` (keep
   `visibility:hidden`). This moves the pane outside the viewport while keeping its layout size, so fitting
   stays correct, and xterm's IntersectionObserver pauses rendering. When the pane is shown again, xterm
   redraws it fully on its own (`_needsFullRefresh`).
2. **P2: fit hidden views lazily.** `#scheduleFit` skips hidden views and marks them `#needsFit`.
   `setVisible(true)` already fits, and the pty gets the size at that point.
3. **P3: coalesce resizes.**
   - `Divider` calls `onRatio` at most once per animation frame (it keeps the last ratio and sends it on
     pointerup).
   - In `XtermTerminalView`, check `fitAddon.proposeDimensions()`. A change in rows is applied
     immediately. A change in columns while the buffer is large (more than 200 lines) gets a 100 ms
     trailing debounce, the same approach as VS Code's resize debouncer. Reflow and SIGWINCH then happen
     once at the end of a drag.
4. **P4: apply only changed options.**
   - Memoize `toXtermTheme` per `Theme` identity with a WeakMap.
   - `XtermTerminalView.setOptions` assigns only keys whose value is `!==` the current one. It calls
     `#scheduleFit` only when a metric option changes (fontFamily, fontSize, lineHeight, letterSpacing).
   - `applyAppearance` (`renderer/composition-root.ts:124`) skips `applyTheme`/`applyBackground` when
     their inputs haven't changed.
5. **P5: grain layer.** Turn the layer off with a devtools toggle and compare GPU process CPU during the
   throughput bench. If the cost is real, move the grain below the panes (z-index -1 like `.app::before`,
   no blend mode). The look barely changes (2% noise); confirm with screenshots before and after (helper
   from mem note `e2e-screenshot-helper`).
6. **P6: React.** Only if the React Profiler shows `App` renders over about 2 ms with 24 panes:
   - `memo` `PaneSlot`, `TabItem` and `TitleBar`, and make `PaneArea`'s per-pane callbacks stable.
   - In `usePaneDrag`, skip `setTarget` when the pane and zone haven't changed.
7. **Hot-path micro-optimization.** Only if a CPU profile of the throughput bench shows it: cache the
   `Emitter.emit` listener snapshot instead of copying the set on every data chunk
   (`packages/domain/src/shared/emitter.ts:18`).

## Verification

- For each change: targeted `pnpm vitest run <file>`, plus lint and typecheck for the touched packages.
- e2e (hidden windows): `pnpm e2e -- -g "<name>"` for the stress leak checks and the affected specs:
  smoke, workspace, settings, windows, quake, background, search-links.
- Benches: run `pnpm bench` before and after and compare `test-results/bench.json`. Look at the truecolor
  soak GPU footprint plateau, tab-switch latency, background-output CPU, divider-drag frame times and
  settings-change time.
- Real-world check: `pnpm package`, run it for a day with Claude Code sessions, and compare
  `footprint -p <gpu pid>` with the 6.4 GB baseline.
- Run `pnpm verify` at the end.
- Once M1 is confirmed, save the addon-webgl atlas growth as a gotcha with `mem add`.
