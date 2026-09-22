# Agent Fighter

A browser-based 2D arcade fighter built around hand-assembled pixel art.

- **`context.md`** — the project brief: goals, roster, art direction, constraints.
- **`web/`** — the arcade cabinet: the playable Clawd prototype and every screen
  around it. See [`web/README.md`](web/README.md).
- **`output/clawd-animation/`** — Clawd's animation study: atlas, frames, metadata,
  editable `.ase`/`.aseprite` files, and an offline frame-by-frame preview.
- **`output/agent-fighters/`** — approved concept art for all five fighters.
- **`scripts/`** — the asset build (`build-clawd.cjs`) and the independent
  pixel-for-pixel verifier (`verify-clawd.py`).

```bash
cd web && npm install && npm run dev
```
