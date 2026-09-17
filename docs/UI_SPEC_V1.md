# Keys UI spec v1 (frozen 2026-09-14)

Collaborative decisions for the Skills + Pieces product. Build against this.

## Home — Skills | Pieces hub

- Two large entry points: **Skills** and **Pieces**
- Small persistent MIDI status line (connected device name, or “Plug in USB”)
- Input mode (MIDI / Mic / Self-report) available from home or a compact control — default MIDI when available
- Design language unchanged: ink / ivory / dust / felt / brass; stand-readable; 64px+ taps

## Skills

- Opens to a **simple flat grid** of all drills (triads, inversions, slash chords, scales, arpeggios, LH patterns, sight-reading, rhythm, session, progress, …)
- Starting a drill = full-screen focused view (existing pattern)
- Mic: monophonic only; chord drills fall back to Hit/Miss
- Piece verification is MIDI-only (not mic)

## Pieces — library first

- List of imported pieces + **Import MIDI**
- Local persistence (IndexedDB); rename/delete later as needed
- Tap a piece → piece page

## Piece page

Shared controls above:

- Tempo
- Loop A–B (bar range)
- Hands: both / RH / LH when tracks allow; else all notes

Three big mode buttons:

1. **Listen** — hear the MIDI target (optional count-in)
2. **Walk-through** — learn note-by-note / beat-by-beat
3. **Verify** — timed run with scoring

## Walk-through

- **Piano-roll follow with a now-line**; upcoming notes visible
- Waits for correct notes from the Kawai (USB-MIDI) before advancing
- Uses shared tempo / loop / hands

## Verify

- Runs at chosen tempo; scores pitch + timing
- On miss: **flash and keep going**
- **End review**: list missed spots; jump back to practice those bars (with loop)
- Bar-range loop available throughout

## Display (pieces v1)

- Piano roll + clear now-line (MIDI-native)
- MusicXML / engraved notation = later phase

## Build order (after USB cable + sample MIDI files)

1. Prove Kawai USB-MIDI end-to-end on triad recall
2. Pieces library (import `.mid`, IndexedDB)
3. Walk-through (piano roll + wait-for-correct)
4. Verify + tempo + loop + end review
5. Listen + hand filter polish
6. Optional: MusicXML notation

## Out of v1

- PDF/photo OMR as source of truth
- Mic grading of full pieces
- Falling-notes game chrome
- Cloud sync / accounts
