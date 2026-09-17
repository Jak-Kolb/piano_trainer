export type ColorProfileId = 'night' | 'parchment' | 'contrast' | 'forest'

export interface ColorProfile {
  id: ColorProfileId
  label: string
  /** Short blurb for Settings */
  blurb: string
  vars: Record<string, string>
}

/** Music-stand-friendly palettes (readable ~3ft, dim or bright rooms). */
export const COLOR_PROFILES: ColorProfile[] = [
  {
    id: 'night',
    label: 'Night',
    blurb: 'Concert hall dark · default',
    vars: {
      '--color-ink': '#0c1220',
      '--color-ink-raised': '#141c2e',
      '--color-ink-soft': '#1a2438',
      '--color-ivory': '#f3ead9',
      '--color-ivory-dim': '#d9cfbc',
      '--color-dust': '#8b93a7',
      '--color-dust-muted': '#5c6478',
      '--color-felt': '#8e3542',
      '--color-felt-deep': '#6b2832',
      '--color-brass': '#c8963f',
      '--color-brass-bright': '#e0b056',
      '--color-shadow': '#0a0f1a',
      '--color-panel': '#121a2b',
      '--color-panel-border': '#2a354c',
      '--color-key-white': '#ffffff',
      '--color-key-white-edge': '#c8beab',
      '--color-key-black': '#161b28',
      '--color-key-black-edge': '#2e3648',
      '--color-lh': '#c45c6a',
      '--color-lh-deep': '#8b3a48',
      '--color-middle-c': '#b8bec9',
      '--color-staff': '#7A8496',
      '--color-rest': '#5C6478',
      '--color-active': '#c8963f',
      '--color-ledger': '#9AA3B5',
      '--color-dynamic': '#C4B8A0',
    },
  },
  {
    id: 'parchment',
    label: 'Parchment',
    blurb: 'Warm paper · soft lamp light',
    vars: {
      '--color-ink': '#E8D9B8',
      '--color-ink-raised': '#F0E4C8',
      '--color-ink-soft': '#F6ECD4',
      '--color-ivory': '#2C241C',
      '--color-ivory-dim': '#4A3C30',
      '--color-dust': '#7A6A55',
      '--color-dust-muted': '#6B5C48',
      '--color-felt': '#9B3B3B',
      '--color-felt-deep': '#7A2F2F',
      '--color-brass': '#8B5A2B',
      '--color-brass-bright': '#A66B35',
      '--color-shadow': '#D4C4A0',
      '--color-panel': '#E0D0A8',
      '--color-panel-border': '#C4B48A',
      '--color-key-white': '#ffffff',
      '--color-key-white-edge': '#c8beab',
      '--color-key-black': '#1a1f2e',
      '--color-key-black-edge': '#2e3648',
      '--color-lh': '#c45c6a',
      '--color-lh-deep': '#8b3a48',
      '--color-middle-c': '#b8bec9',
      '--color-staff': '#6B5C48',
      '--color-rest': '#8A7A64',
      '--color-active': '#8B5A2B',
      '--color-ledger': '#7A6A55',
      '--color-dynamic': '#5C4A38',
    },
  },
  {
    id: 'contrast',
    label: 'High contrast',
    blurb: 'Black / white / amber · max pop',
    vars: {
      '--color-ink': '#000000',
      '--color-ink-raised': '#141414',
      '--color-ink-soft': '#1e1e1e',
      '--color-ivory': '#FFFFFF',
      '--color-ivory-dim': '#E0E0E0',
      '--color-dust': '#A0A0A0',
      '--color-dust-muted': '#707070',
      '--color-felt': '#FF4D4D',
      '--color-felt-deep': '#CC3333',
      '--color-brass': '#FFC107',
      '--color-brass-bright': '#FFD54F',
      '--color-shadow': '#141414',
      '--color-panel': '#0a0a0a',
      '--color-panel-border': '#333333',
      '--color-key-white': '#ffffff',
      '--color-key-white-edge': '#c8beab',
      '--color-key-black': '#000000',
      '--color-key-black-edge': '#444444',
      '--color-lh': '#FF6B7A',
      '--color-lh-deep': '#CC4455',
      '--color-middle-c': '#C8C8C8',
      '--color-staff': '#C8C8C8',
      '--color-rest': '#9A9A9A',
      '--color-active': '#FFC107',
      '--color-ledger': '#E0E0E0',
      '--color-dynamic': '#FFEB3B',
    },
  },
  {
    id: 'forest',
    label: 'Forest',
    blurb: 'Deep green · low glare',
    vars: {
      '--color-ink': '#0E1A14',
      '--color-ink-raised': '#15241C',
      '--color-ink-soft': '#1C2E24',
      '--color-ivory': '#DCE8DC',
      '--color-ivory-dim': '#B8C9B8',
      '--color-dust': '#6A7D6E',
      '--color-dust-muted': '#5C6E60',
      '--color-felt': '#8B3A3A',
      '--color-felt-deep': '#6B2A2A',
      '--color-brass': '#C4A35A',
      '--color-brass-bright': '#D4B56A',
      '--color-shadow': '#08120E',
      '--color-panel': '#122018',
      '--color-panel-border': '#2A3C30',
      '--color-key-white': '#ffffff',
      '--color-key-white-edge': '#c8beab',
      '--color-key-black': '#121812',
      '--color-key-black-edge': '#2A342A',
      '--color-lh': '#c45c6a',
      '--color-lh-deep': '#8b3a48',
      '--color-middle-c': '#b8bec9',
      '--color-staff': '#6E8574',
      '--color-rest': '#5C6E60',
      '--color-active': '#D4B56A',
      '--color-ledger': '#8FA396',
      '--color-dynamic': '#B8C9B8',
    },
  },
]

const STORAGE_KEY = 'keys.colorProfile'

export function loadColorProfileId(): ColorProfileId {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (COLOR_PROFILES.some((p) => p.id === v)) return v as ColorProfileId
  } catch {
    /* ignore */
  }
  return 'night'
}

export function profileById(id: ColorProfileId): ColorProfile {
  return COLOR_PROFILES.find((p) => p.id === id) ?? COLOR_PROFILES[0]!
}

/** Apply CSS variables on <html> so Tailwind tokens + sheet canvas stay in sync. */
export function applyColorProfile(id: ColorProfileId): void {
  const profile = profileById(id)
  const root = document.documentElement
  root.dataset.theme = profile.id
  for (const [key, value] of Object.entries(profile.vars)) {
    root.style.setProperty(key, value)
  }
  try {
    localStorage.setItem(STORAGE_KEY, profile.id)
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent('keys-color-profile', { detail: profile.id }),
  )
}

/** Sheet/VexFlow colors from the live CSS variables. */
export function sheetThemeColors(): {
  note: string
  staff: string
  rest: string
  active: string
  ledger: string
  dynamic: string
  ink: string
} {
  const s = getComputedStyle(document.documentElement)
  const g = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback
  return {
    note: g('--color-ivory', '#f3ead9'),
    staff: g('--color-staff', '#7A8496'),
    rest: g('--color-rest', '#5C6478'),
    active: g('--color-active', '#c8963f'),
    ledger: g('--color-ledger', '#9AA3B5'),
    dynamic: g('--color-dynamic', '#C4B8A0'),
    ink: g('--color-ink', '#0c1220'),
  }
}
