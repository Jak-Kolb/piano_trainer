# Build spec: Keys — a local piano practice trainer

You are the lead agent. Build this app end to end on this MacBook, autonomously, spinning off sub-agents per the work breakdown in §10. Do not ask the user design questions that this document already answers. Do ask about the one open item in §0.

---

## 0. The one thing you must confirm before building

**Does the user have a digital piano/keyboard with USB-MIDI out, or an acoustic piano?**

This changes the input layer, not the app. Build both paths (§3) but ask which is primary so you can default correctly and prioritize testing. Ask this once, in one line, then proceed.

---

## 1. What this is

A practice tool for one user, an adult returning to piano after years away. He can read notes slowly and play four pieces from muscle memory, but cannot sight-read and does not know chord theory. He is working toward being able to pick up unfamiliar sheet music and play it.

**The one job:** replace the paper chord charts, scale-fingering printouts, and random-draw index cards with one screen that sits on the music stand and runs his daily session without him touching paper.

**The physical situation this must survive:**

- Laptop on a music stand or on top of the piano, roughly 2–3 feet from his eyes, often above eye level and angled.
- His hands are on the keys. He is not holding a trackpad.
- The room may be dim.
- A drill lasts 30 seconds to 5 minutes and he glances at the screen between attempts, not continuously.

Everything about the design follows from that. If a decision is ambiguous, choose the option that is readable from 3 feet and operable with one finger.

---

## 2. Hard constraints

- Runs entirely on his MacBook (Apple Silicon, M3 Pro). No server, no account, no cloud, no network calls at runtime.
- Works fully offline after install.
- **Target browser is Chrome.** Safari does not support the Web MIDI API and there is no shipping date for it (WebKit bug 107250); Chrome has supported it since v43. Detect Safari on load and show a one-line notice telling him to open it in Chrome. Do not attempt a Safari workaround.
- Starts with one command. Provide a `start` script that builds and serves it, and print the local URL. Also provide a way to launch it that does not require a terminal — a small `.command` file on the Desktop that runs the server and opens the browser is acceptable.
- All state persists locally (IndexedDB). Nothing is lost on refresh or restart.
- Ships with an export-to-JSON button so his practice history isn't trapped.

---

## 3. Input layer

Three modes, in priority order. The app auto-selects the best available and lets him override.

**MIDI mode (preferred).** Web MIDI API. Listen for note-on/note-off, maintain a live set of currently-held notes, and evaluate drills automatically. This is the mode that makes the whole app work, because it can tell him he was wrong without him having to self-report. Handle device connect/disconnect mid-session gracefully. Show the connected device name somewhere small and persistent.

**Microphone mode (fallback, limited).** Monophonic pitch detection only (a YIN or McLeod implementation on the Web Audio API). Enable it ONLY for single-note drills — scales, arpeggios, note identification. Do not attempt polyphonic chord detection; it is unreliable and a wrong "correct" is worse than no feedback. Chord drills in mic mode fall back to self-report.

**Self-report mode (always available).** He plays, then taps one large button to reveal the answer and one of two buttons to log hit or miss. Everything must be usable this way, because his piano may not be MIDI-capable.

Design every drill so its logic is identical across modes; only the "did he get it right" signal differs. Put that behind a single `InputSource` interface.

---

## 4. The drills

Eight modules. Each is a full-screen focused view with no scrolling, no sidebar, and no visible chrome except a small exit control and the current streak.

### 4.1 Triad recall

Draws a random root from the 12 chromatic notes and a random quality, then shows just the chord symbol, enormous, centered. He plays it with both hands.

- Default quality pool: major and minor only. Diminished, augmented, sus2, sus4, and 7ths are togglable and **off by default**.
- Timer starts when the symbol appears. Target is under 2 seconds; show the elapsed time only after he answers, never as a running countdown (a ticking clock makes him rush and mis-hit).
- MIDI mode: correct when the held pitch classes equal the chord's pitch classes, in any octave, any voicing, any doubling. Do not require a specific inversion here.
- On a miss, show the correct notes on a keyboard diagram, then requeue that chord 3 draws later.
- Session = 12 draws by default. End screen: median time, slowest three chords, hit rate.
- Track per-chord response time across sessions and weight the random draw toward his slowest chords (roughly 60% weighted, 40% uniform, so it doesn't feel like it's only ever asking the hard ones).

### 4.2 Inversion drill

Two sub-modes.

_Shape mode:_ shows a chord symbol and a target inversion (root, 1st, 2nd). He must play that exact voicing, so here the bass note matters. Left hand alone, right hand alone, and both, selectable.

_Voice-leading mode:_ shows a short progression and asks him to play it with minimal hand movement. Ships with these, and lets him type in his own:

- C – F – G – C
- C – G – Am – F
- G – D – Em – C
- F – C – Dm – B♭
- Am – F – C – G

Evaluate on total semitone distance traveled by the top voice between chords. If he plays every chord in root position, tell him the distance he traveled versus the minimum, and show the efficient voicing. This is the single most useful drill in the app for the music he wants to play.

### 4.3 Slash chords and symbol reading

Flashcards for chord symbols as they actually appear on a page: `G/B`, `C/E`, `Dsus4`, `Am7`, `Fmaj7`, `B♭`. Shows the symbol, he plays it, reveal shows the notes and a plain-language gloss ("G major with B on the bottom"). Same weighted-draw logic as 4.1.

### 4.4 Scales

Displays the scale on a staff and on a keyboard diagram with **finger numbers on every note**, metronome running, two octaves.

- Selectable: right hand, left hand, both.
- Mode selector for the session: 4 notes per click, then 2, then 1, as he speeds up.
- MIDI mode grades three things separately and reports them separately: correct notes, even timing (standard deviation of inter-onset intervals), and even dynamics (spread of velocities). Evenness is the actual skill; note accuracy alone is not enough.
- **Fingering data is hardcoded from a published reference, never derived algorithmically.** See §6.

### 4.5 Arpeggios

Same structure as scales: staff, keyboard diagram, finger numbers, metronome, two octaves, root position. Major and minor.

### 4.6 Left-hand pattern trainer

Pick a progression (default C – G – Am – F) and a pattern, then loop it with a metronome and a visual guide showing which note comes next.

Patterns, on a C chord:
| Pattern | Notes |
|---|---|
| Block | C, E, G struck together |
| Broken 1-5-8 | C, G, C (octave up), one at a time |
| Broken 1-5-10 | C, G, E (tenth above the root) |
| Alberti | C, G, E, G, repeating |

Must transpose the whole thing to any key. The point of the drill is that the shape stays the same while the key changes, so make that visually obvious — the pattern graphic should not redraw itself differently when the key changes.

### 4.7 Sight-reading generator

The most important module for his stated goal, and the one most likely to be built wrong. Read this whole subsection before building it.

Generates short, **unseen, single-use** exercises and renders them as real notation.

- Difficulty levels 1–10, starting at level 1, which should be genuinely trivial: 4 bars, right hand alone, 5-finger position in C, quarter and half notes only, stepwise motion.
- Progression across levels adds, roughly in this order: both hands; larger intervals; keys with one then two sharps or flats; eighth notes; dotted rhythms; ties; hand-position shifts; 3/4 and 6/8; simple syncopation.
- Every exercise is newly generated and **never repeated**. Keep a hash of what he's seen and never serve it twice. A repeated exercise is rehearsal, not reading, and silently destroys the purpose of the module.
- Generation must produce musical, playable material, not random pitch soup: constrain to the key, favor stepwise motion with occasional leaps within the chord, resolve phrase ends to a chord tone, and keep both hands within a fixed position unless the level allows shifts.
- **The run-through rule:** a 30-second preview timer, then the metronome counts in one bar and the exercise runs at a fixed tempo. He plays along without stopping. No pause, no rewind, no replay of the same exercise. If the app lets him stop and fix notes, it has become a repertoire tool and the module has failed.
- MIDI mode scores notes hit and — more importantly — **continuity**: how many beats he was lost for. Report those as two separate numbers. A run with three wrong notes and no hesitation is a better result than a run with perfect notes and four stalls, and the end screen should say so.
- Auto-advance a level after 3 consecutive runs above 85% notes with under 2 beats lost. Drop a level after 3 runs below 60%.
- A big counter somewhere in the app: **distinct exercises read, lifetime.** That is the number that predicts his progress. Make it the most prominent stat in the whole app.

### 4.8 Rhythm trainer

Displays one bar of rhythm on a single-line staff. He taps it — spacebar, screen tap, or any MIDI key. Scores onset timing against the beat grid in milliseconds and shows where he drifted. Includes a two-hand mode with independent rhythms on two lines, since that's the coordination his pieces demand.

---

## 5. Session runner and progress

### Session runner

A "Start today's practice" button that runs the session unattended, advancing between blocks on its own timer with an audible cue so he never touches the laptop mid-practice:

| Block      | Default | Content                                                            |
| ---------- | ------- | ------------------------------------------------------------------ |
| Warm-up    | 5 min   | Rotates by weekday: scale + arpeggio + inversions in the day's key |
| Reading    | 15 min  | Sight-reading generator, plus 2–3 min rhythm trainer               |
| Repertoire | 20 min  | Metronome + a stopwatch + a notes field; no drills                 |

- Weekday rotation of warm-up keys is editable.
- A "10 minutes only" button that runs the reading block alone.
- The repertoire block is deliberately dumb. Do not build a piece-learning module, a score viewer, or an annotation tool. He is reading from paper there, and that is correct.

### Progress

One screen, no dashboard sprawl. Four things:

1. Distinct sight-reading exercises read, lifetime, and this week.
2. Sight-reading level over time.
3. Median triad recall time over time.
4. A piece log: piece name, date started, date first clean play-through, and the day count between them. That gap closing is the entire 12-month goal, so this is the app's headline metric alongside the exercise count.

Plus a plain practice-day streak and a manual field for logging an external sight-reading assessment score.

---

## 6. Music theory core — the correctness spine

**This is the highest-risk part of the build.** A wrong fingering or a wrong chord doesn't produce a visible bug; it silently trains him to play incorrectly, and he has no way to catch it. Build this as one pure TypeScript library with no UI dependencies, and put your heaviest testing here.

Rules:

**Chords are computed, and spelled correctly.** Derive triads from intervals, but spell them enharmonically correctly from the key context: F♯ major is F♯–A♯–C♯, never F♯–B♭–D♭. Unit-test the spelling of all 12 major and 12 minor triads plus every inversion against a fixture table.

**Fingerings are data, not logic.** Never generate scale or arpeggio fingerings algorithmically — the thumb-under rules have too many exceptions and a plausible-looking generated fingering is exactly the failure mode that hurts him. Hardcode them in a fixture file, and **cross-check every entry against two independent published fingering charts before shipping.** Flag in the file any entry you could not verify against two sources, and surface an "unverified" marker in the UI for those rather than hiding the uncertainty.

The keys in scope for the first six months, which you should verify and ship first:

- Major: C, G, D, A, E, F
- Minor: A, E, D (natural and harmonic)

Everything else can come later.

Starting reference for the six majors above, ascending, two octaves — **treat this as a draft to verify, not as ground truth:**

| Scale               | Right hand      | Left hand       |
| ------------------- | --------------- | --------------- |
| C, G, D, A, E major | 1 2 3 1 2 3 4 5 | 5 4 3 2 1 3 2 1 |
| F major             | 1 2 3 4 1 2 3 4 | 5 4 3 2 1 3 2 1 |

Descending is the same sequence reversed. F major's right hand is the notable exception among white-key majors. Verify each one, including the minors and all arpeggios, before it reaches the UI.

**Everything the user sees comes from this one library.** No module computes its own chord tones or note names. One source of truth.

---

## 7. Design direction

The brief is a high-contrast instrument panel read at distance in low light, glanced at between physical actions. Not a dashboard, not a course, not a game. The nearest honest reference is a stage monitor or a studio hardware display: enormous primary information, everything else nearly invisible until needed.

**Palette.** Drawn from the inside of a piano — ebony, ivory, hammer felt, pedal brass. Six tokens:

| Token    | Hex       | Use                                                    |
| -------- | --------- | ------------------------------------------------------ |
| `ink`    | `#101A2B` | Ground. A deep midnight blue-black, not a tinted grey. |
| `ivory`  | `#EDE4D3` | Primary type and the big symbol. Warm, not white.      |
| `dust`   | `#5C6478` | Secondary type, staff lines, inactive keys.            |
| `felt`   | `#7A2F3A` | Misses and the active-attention state. Used sparingly. |
| `brass`  | `#C08B3E` | Hits, completion, streak.                              |
| `shadow` | `#0A1120` | The one recessed surface.                              |

Do not add a gradient anywhere. Do not add a second accent.

**Type.** Two families, clearly distinct: **Bricolage Grotesque** for the display layer (chord symbols, note names, big numerals) and **IBM Plex Sans** for UI text. Notation uses **Bravura**, the SMuFL standard font, which is what the notation library ships with — do not substitute.

The chord symbol during a drill should be genuinely enormous — on the order of 20–25% of the viewport height. Err large. If it looks absurd on a desktop monitor, it is probably right on a music stand.

**Layout.** One thing per screen. Full-bleed. The primary information is vertically centered and the drill never scrolls. Controls live at the bottom edge, within thumb reach if the laptop is flat, at a minimum 64px tap target. Left-align text blocks; center only the single primary symbol.

**Motion.** One place only: the hit/miss state change, as an immediate color shift with no easing longer than 120ms. No page transitions, no fade-and-slide-up on load, no hover animations. He is not looking at the screen when the state changes; he is looking at his hands and catching it peripherally. That means the signal must be a large area of color, not a small icon.

**Things that would make this look like every other generated app — avoid all of them:** all-caps tracked-out eyebrow labels above headings; identical rounded cards for every piece of content; the same soft grey shadow under everything; `01 / 02 / 03` numbered markers on things that aren't sequences; a monospace face for small data labels; arrows appended to button text; a cream background with a terracotta accent.

**Copy.** Plain, active, specific. Buttons say what happens: "Start today's practice," "Play it," "Show me." Failure states say what to do next, not what went wrong emotionally. Empty states invite one action. The app never congratulates him in more than three words.

---

## 8. Tech stack

- Vite + React + TypeScript
- Tailwind for styling, with the palette above as the token set
- **VexFlow** for notation rendering
- **Tone.js** for the metronome, count-ins, and any pitch playback
- Web MIDI API directly (no wrapper library unless one demonstrably saves significant work)
- Dexie or idb for IndexedDB
- Vitest for unit tests
- No router library if a simple state machine will do; no state management library; no component kit

Pin dependency versions. Check current versions of VexFlow and Tone.js at build time rather than assuming — their APIs have changed across majors.

---

## 9. Acceptance tests

The build is not done until all of these pass on the actual machine:

1. Launches from a single action with no terminal knowledge required, in Chrome, offline.
2. With a MIDI keyboard connected: playing a C major triad in any inversion, any octave, any doubling registers as correct in triad recall.
3. Playing C–E–G♯ registers as incorrect and shows the correct notes.
4. Disconnecting the MIDI device mid-drill does not crash; the app falls back and says so in one line.
5. Every scale and arpeggio fingering in the six-month key set matches two published charts. Write the verification down in a file in the repo.
6. All 24 triads and their inversions spell correctly, including sharp and flat keys, verified by unit test.
7. The sight-reading generator produces 200 exercises at level 3 with zero repeats, zero unplayable hand positions, and zero notes outside the key.
8. A sight-reading exercise cannot be paused, rewound, or replayed.
9. The session runner advances between blocks on its own with an audible cue, untouched, start to finish.
10. Close the browser, reopen: all history, levels, and stats intact.
11. Put the laptop 3 feet away at a 30° angle in a dim room. Every drill screen is readable and every control is hittable with one finger.

Test 11 is not optional and cannot be done from a screenshot. Actually check it.

---

## 10. Work breakdown for sub-agents

Run these in this order. Agents 2 and 3 can run in parallel after 1. Agents 5a–5d can run in parallel after 2, 3, and 4.

| #   | Agent              | Owns                                                                                                 | Done when                                                                       |
| --- | ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | Scaffold           | Vite/React/TS setup, Tailwind token system, fonts, layout primitives, launch script                  | App boots to an empty shell with the design tokens in place                     |
| 2   | Theory core        | §6 library: notes, intervals, chords, spelling, key signatures, fingering fixtures, verification doc | All §9 tests 5 and 6 pass; zero UI imports                                      |
| 3   | Input layer        | `InputSource` interface, MIDI, mic pitch detection, self-report, device management                   | §9 tests 2, 3, 4 pass against a stub drill                                      |
| 4   | Notation + audio   | VexFlow rendering wrapper, keyboard diagram component, Tone.js metronome and count-in                | Renders an arbitrary passage from the theory core; metronome is sample-accurate |
| 5a  | Chord drills       | 4.1, 4.2, 4.3                                                                                        | Playable end to end in all three input modes                                    |
| 5b  | Technique drills   | 4.4, 4.5, 4.6                                                                                        | Playable end to end; fingerings displayed on every note                         |
| 5c  | Reading drills     | 4.7, 4.8                                                                                             | §9 tests 7, 8 pass                                                              |
| 5d  | Session + progress | §5                                                                                                   | §9 tests 9, 10 pass                                                             |
| 6   | Integration QA     | Cross-module bugs, persistence, the physical test                                                    | All of §9 passes                                                                |

**Standing instructions for every agent:**

- Import chord and fingering data from the theory core. Never recompute it locally. This rule has no exceptions.
- Write the test before the feature for anything in the theory core.
- If you find yourself unsure whether a music-theory fact is correct, stop and verify it against a published source rather than picking the plausible option. Wrong output here is invisible to the user and gets drilled into his hands.
- Do not add features not in this spec. If you think something is missing, note it in a `PROPOSED.md` at the repo root instead of building it.

---

## 11. Non-goals

Explicitly out of scope. Do not build these, do not stub them, do not leave menu entries for them:

- Any score library, song database, or bundled sheet music. He owns his scores on paper and in purchased PDFs, and bundling copyrighted arrangements is both a legal problem and a distraction.
- A piece-learning or falling-notes mode.
- Video lessons, written theory lessons, or an explanation layer. He has other sources for that; this app is reps.
- Accounts, sync, sharing, social features, leaderboards.
- Gamification beyond the streak and the counters in §5. No badges, no XP, no levels other than the sight-reading difficulty level, no celebratory animations.
- Mobile or tablet layouts. One machine, one screen size, landscape.
- A settings page for anything not listed in this spec.

---

## 12. Ship order

Build in this sequence and make each stage usable before starting the next, so there's something to practice with from day one:

1. Theory core + triad recall + self-report input
2. MIDI input
3. Scales, arpeggios, inversions
4. Sight-reading generator
5. Session runner + progress
6. Rhythm trainer, left-hand patterns, slash chords

Stage 1 alone replaces the paper index cards. Do not let stages 4–6 block his access to stage 1.
