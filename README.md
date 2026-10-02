# Keys

A music-stand piano practice app focused on **MIDI playthrough**: import a piece, read real sheet music, and practise it on a USB keyboard. Learn it step by step, play along in time with grading, listen to it, or perform it with any keys.

**Open it in Chrome: https://jak-kolb.github.io/piano_trainer/** (use Chrome's Install button in the address bar to give it its own window and icon).

![Playthrough](docs/screenshots/04-playthrough.png)

## Highly recommended: USB-MIDI piano

Keys is built around a **real piano / digital keyboard over USB-MIDI** (for example a Kawai with USB-B). That is the intended way to use playthrough and Skills drills.

1. Connect the keyboard to your computer with a USB cable.
2. Open Keys in **Chrome** (Web MIDI).
3. On Home, choose **MIDI**.
4. Play: held notes are graded automatically.

**Bluetooth instead of a cable:** if your piano has Bluetooth MIDI (the Kawai KDP110 does), turn it on at the piano. Then on Home choose **MIDI** → **Bluetooth piano** → **Connect**, and pick the piano in Chrome's list. Keys reconnects to it next time. On a Mac, Chrome may ask for Bluetooth permission (System Settings → Privacy & Security → Bluetooth). With the USB cable plugged in too, the cable is used and Bluetooth stands by; unplug it and Bluetooth takes over.

Only the Keys tab or window in front listens to the keyboard, so a Keys tab left open in the background can't play along to your keys.

Self-report (Hit / Miss) exists as a fallback when no keyboard is available, but playthrough and practice feel much better with MIDI connected.

## Practising a piece

1. Open **Pieces** → **Import MIDI** (`.mid` / `.midi`).
2. Pick a mode:
   - **Learn** waits for you to play each step on your keyboard. You can hear a bar or a line first.
   - **Play along** keeps time with a metronome and a one-bar count-in. It grades every note as on time, early, late, missed or wrong, colours the noteheads, and ends with a results card.
   - **Listen** plays the piece, a bar or a line, with the sustain pedal.
   - **Perform** works like Concert Magic: any key plays the next notes, loud or soft as you press, at your pace. It always plays the whole song, both hands. Choose **Every note** (a press for each new note) or **Assisted** (a press for every note down to eighth notes, triplets included; faster 16ths and 32nds play by themselves). A press always plays the next note that hasn't sounded yet, so it never skips: press for each 16th and you get each one at your speed, press eighths and the 16ths fill in. Assisted never plays faster than written (at your tempo setting): press faster and each note waits for its time; press slower and it follows you. A press that comes much too soon (a rolled chord, a double hit) is ignored. Keys switches the piano's Local Control off while you perform, so only the music sounds, and back on when you leave; if your piano ignores that, turn Local Control off on the piano. Once you use the sustain pedal, notes last as long as their keys and the pedal holds them, as on a piano.
3. Choose **RH / LH / Both** and the tempo. Click and drag across bars on the sheet, or on the **bar strip** under it, to practise just those bars. Click any bar to go there (that clears the selection). **← →** move by bar, and **Space** plays, pauses or skips.

**Practice options** (top right) are switches, saved with each piece:

| Switch | What it does |
| --- | --- |
| Play the other hand for me | While you practise one hand, the app plays the other (after each step in Learn, in time in Play along). Starts off each time you open a piece |
| Show my keys and wrong notes | Your held keys light up on the on-screen piano; wrong notes turn red |
| Repeat the range / Speed up after clean passes | Loop the range, raising the tempo a step after each pass with no mistakes |
| Metronome / Count in one bar | For Play along |
| Remember settings for this piece | Tempo, hands, range and these switches |
| Track practice stats | Time practised, clean runs, best tempo, and where mistakes cluster (tinted on the bar strip) |

The sheet music is engraved from the MIDI file:
- 6/8 and cut time are written correctly.
- Triplets and sextuplets are detected.
- Held notes move to a second voice.
- Key and time signature changes are drawn, and minor keys are spelled correctly.
- A hand that sits far outside its clef switches clef for that line.
- Each line holds as many bars as fit.

The **Pieces** list shows how practice is going, including the date of your first clean play-through of each piece. To rename a piece, double-click its name at the top of its practice screen.

Imported pieces and practice history stay in this browser's IndexedDB on your machine. They are not uploaded anywhere. Each address keeps its own copy: the hosted site, `npm start` (127.0.0.1:5173) and `npm run dev` (localhost:5173) don't share pieces or history.

| Sheet (light on dark) | Sheet (dark on light) |
| --- | --- |
| ![Playthrough](docs/screenshots/04-playthrough.png) | ![Paper](docs/screenshots/05-playthrough-paper.png) |

| Practice options | Pieces |
| --- | --- |
| ![Practice options](docs/screenshots/06-practice-options.png) | ![Pieces](docs/screenshots/07-library.png) |

## Also included

- **Skills**
  - A **10-minute warmup** in a key that changes each day:
    1. a scale and an arpeggio with fingering;
    2. triads;
    3. inversions;
    4. a chord progression, played once with names and once from the numerals;
    5. quick theory questions (intervals, key signatures, scale degrees, chord names).
  - Each of these is also a drill on its own, alongside slash chords and left-hand patterns.
  - With a MIDI keyboard everything is graded as you play.
- **Color profiles** — Night, Parchment, High contrast, Forest (Settings)
- **Play sound through your piano** (Settings): Listen, the other hand, Perform and every “Hear it” go out over MIDI to your own piano instead of the computer speakers (the USB cable when it's plugged in, else Bluetooth)
- **Your sustain pedal works everywhere:** it's passed on to whatever plays the music, your piano or the built-in one

| Home | Settings |
| --- | --- |
| ![Home](docs/screenshots/01-home.png) | ![Settings](docs/screenshots/02-settings.png) |

![Skills](docs/screenshots/03-skills.png)

## Requirements

- Node.js 20+ (or current LTS)
- **Google Chrome** (Web MIDI)
- USB-MIDI keyboard strongly recommended

## Install & run

```bash
git clone https://github.com/Jak-Kolb/piano_trainer.git
cd piano_trainer
npm install
npm start
```

Opens **http://127.0.0.1:5173/** — use Chrome.

```bash
npm run dev    # hot reload
npm test       # unit tests
npm run build  # production build
```

macOS: after `npm install`, you can double-click `scripts/Keys.command`.

## Publishing

Every push to `main` runs the tests, builds, and publishes the site to GitHub Pages (`.github/workflows/pages.yml`). A failing test stops the deploy and the old version stays up.

## Stack

Vite · React · TypeScript · Tailwind · VexFlow · Tone.js · `@tonejs/midi`
