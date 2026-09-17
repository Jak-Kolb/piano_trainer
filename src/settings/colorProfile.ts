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
    blurb: 'Dark stand · current default',
    vars: {
      '--color-ink': '#101A2B',
      '--color-ivory': '#EDE4D3',
      '--color-dust': '#5C6478',
      '--color-felt': '#7A2F3A',
      '--color-brass': '#C08B3E',
      '--color-shadow': '#0A1120',
      '--color-staff': '#7A8496',
      '--color-rest': '#5C6478',
      '--color-active': '#C08B3E',
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
      '--color-ivory': '#2C241C',
      '--color-dust': '#7A6A55',
      '--color-felt': '#9B3B3B',
      '--color-brass': '#8B5A2B',
      '--color-shadow': '#D4C4A0',
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
      '--color-ivory': '#FFFFFF',
      '--color-dust': '#A0A0A0',
      '--color-felt': '#FF4D4D',
      '--color-brass': '#FFC107',
      '--color-shadow': '#141414',
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
      '--color-ivory': '#DCE8DC',
      '--color-dust': '#6A7D6E',
      '--color-felt': '#8B3A3A',
      '--color-brass': '#C4A35A',
      '--color-shadow': '#08120E',
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
    note: g('--color-ivory', '#EDE4D3'),
    staff: g('--color-staff', '#7A8496'),
    rest: g('--color-rest', '#5C6478'),
    active: g('--color-active', '#C08B3E'),
    ledger: g('--color-ledger', '#9AA3B5'),
    dynamic: g('--color-dynamic', '#C4B8A0'),
    ink: g('--color-ink', '#101A2B'),
  }
}
