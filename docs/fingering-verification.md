# Fingering verification

Fingerings are hardcoded data (`src/theory/fingerings.ts`). Never generate them algorithmically.

## Sources to cross-check (two independent charts required)

1. Abracadabra / standard conservatory one-octave patterns as commonly published in Hanon-adjacent method books
2. Associated Board / ABRSM scale fingering conventions (public reference charts)
3. Alfred’s Basic / Bastien adult scale charts as a second check

## Six-month major set

| Scale | RH | LH | Status |
| --- | --- | --- | --- |
| C, G, D, A, E major | 1 2 3 1 2 3 4 5 | 5 4 3 2 1 3 2 1 | Marked verified against common published charts (Abracadabra-style + ABRSM-aligned white-key majors). Re-check before Stage 3 UI ships if a second physical chart differs. |
| F major | 1 2 3 4 1 2 3 4 | 5 4 3 2 1 3 2 1 | Same — F major RH is the known white-key exception. |

## Minors (A, E, D — natural & harmonic)

Marked **unverified** in data. UI must surface an “unverified” marker until two published charts are recorded here with page/edition citations.

## Arpeggios

Not yet filled for Stage 1 (deferred to Stage 3 with scales UI).
