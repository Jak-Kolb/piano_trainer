# Triad adaptive stats — implementation plan

## Goal
Persist per-chord triad recall performance across sessions so draws favor weak/slow chords forever, and Progress can show median time over time.

## Current state
- In-session only: `drawPrompt` uses ~60% weight on slow `medianMsById` from this session's `attempts`.
- `src/storage/progress.ts` only has coarse `triadHits` / `triadMisses`.
- Spec §4.1 + §5 Progress items 2–3.

## Data model (IndexedDB via idb, store `triadStats`)
Per chord id (`${letter}${accidental}|${quality}` e.g. `C|major`, `F#|minor`):
```ts
interface TriadChordStats {
  id: string
  timesMs: number[]      // keep last N (e.g. 30) correct+incorrect or correct-only? Prefer all attempts; weight slow correct+misses
  hits: number
  misses: number
  updatedAt: string
}
interface TriadHistoryPoint {
  day: string            // YYYY-MM-DD
  medianMs: number
  hitRate: number
  samples: number
}
```
Also store daily aggregates array for Progress chart (cap ~365 days).

## Files to add/change
1. `src/storage/triadStats.ts` — load/save chord map + daily history; `recordAttempt(id, ms, correct)`; `mediansForDraw(): Record<string, number>`; bump miss weight (e.g. treat miss as max(ms, 4000) or add flat missPenalty).
2. `src/drills/TriadRecall.tsx` — on grade, call `recordAttempt`; seed `drawPrompt` with `mediansForDraw()` merged with session medians (session can override/blend).
3. `src/drills/ProgressView.tsx` — show median triad time over time from daily history; list slowest chords.
4. Tests for record/median/draw seeding.
5. Do **not** expand scope to other drills in this task.

## Draw policy (keep spec)
- 60% weighted by median response time (and miss penalty), 40% uniform.
- Requeue misses 3 later (already in TriadRecall).

## Constraints
- Repo: `/Users/jakkolb/Desktop/Coding/GitHub/piano_trainer` on Jak's MacBook (`machineId` 75c84b31-d530-4e10-884e-2d0a54d04fef).
- Branch: work on `implement-skills-pieces` (or a short-lived branch off it).
- Follow Coding guidelines skill: surgical, simple, test theory/storage helpers.
- Commit + push when done; report PR/commit URL back to Hobby Dev.

## Done when
- Closing the browser and reopening still biases toward previously slow/missed triads.
- Progress shows a simple median-time trend and weak-chord list.
- `npm test` and `npm run build` pass.
