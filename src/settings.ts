export type PresetId = 'galaxy' | 'vortex' | 'waves' | 'network' | 'nebula' | 'fire'
export type Tool = 'pointer' | 'move' | 'attract' | 'vortex' | 'repel' | 'sample'

export interface Settings {
  preset: PresetId
  count: number
  size: number
  opacity: number
  gravity: number
  strength: number
  radius: number
  drag: number
  first: string
  second: string
  glow: boolean
  trails: boolean
  stars: boolean
}

export const ranges = {
  count: { label: 'Количество', min: 500, max: 18000, step: 100, digits: 0 },
  size: { label: 'Размер', min: 0.6, max: 4.8, step: 0.1, digits: 1 },
  opacity: { label: 'Прозрачность', min: 0.05, max: 1, step: 0.01, digits: 2 },
  gravity: { label: 'Гравитация', min: -0.5, max: 1.8, step: 0.01, digits: 2 },
  strength: { label: 'Сила взаимодействия', min: 0, max: 1.4, step: 0.01, digits: 2 },
  radius: { label: 'Радиус влияния', min: 40, max: 360, step: 5, digits: 0 },
  drag: { label: 'Сопротивление', min: 0.9, max: 0.999, step: 0.001, digits: 3 },
} as const

export type RangeKey = keyof typeof ranges

export const presets: Record<PresetId, { name: string; description: string } & Partial<Settings>> = {
  galaxy: { name: 'Галактика', description: 'Спиральные рукава вокруг яркого ядра' },
  vortex: { name: 'Вихрь', description: 'Потоки частиц в закрученной воронке', first: '#19ECC8', second: '#5477FF', gravity: 0.38, drag: 0.97 },
  waves: { name: 'Волны', description: 'Слои частиц на волновой поверхности', first: '#30E6FF', second: '#FF5BBF', gravity: 0.04, count: 8400 },
  network: { name: 'Сеть', description: 'Подвижные узлы и связи между ними', first: '#5EF5A5', second: '#36A9FF', gravity: 0.08, count: 4200, size: 1.7 },
  nebula: { name: 'Туманность', description: 'Облака звёздной пыли', first: '#FF6EAC', second: '#8558FF', gravity: 0.06, count: 12800, opacity: 0.67 },
  fire: { name: 'Огонь', description: 'Восходящий поток искр и углей', first: '#FFCB42', second: '#FF4258', gravity: -0.1, count: 7500, drag: 0.965 },
}

export function initialSettings(preset: PresetId = 'galaxy'): Settings {
  const { name: _name, description: _description, ...overrides } = presets[preset]
  return {
    preset, count: 12000, size: 2, opacity: 0.75, gravity: 0.2, strength: 1, radius: 150,
    drag: 0.98, first: '#00D4FF', second: '#A855F7', glow: true, trails: true, stars: true,
    ...overrides,
  }
}

const storageKey = 'particle-lab:settings:v1'
const hexColor = /^#[0-9a-f]{6}$/i

export function loadSettings(): Settings {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (!stored || typeof stored !== 'object') return initialSettings()
    const data = stored as Partial<Settings>
    const preset = data.preset && Object.hasOwn(presets, data.preset) ? data.preset : 'galaxy'
    const settings = initialSettings(preset)
    for (const key of Object.keys(ranges) as RangeKey[]) {
      const value = data[key]
      const { min, max } = ranges[key]
      if (typeof value === 'number' && Number.isFinite(value)) {
        settings[key] = Math.min(max, Math.max(min, key === 'count' ? Math.round(value) : value))
      }
    }
    for (const key of ['first', 'second'] as const) {
      const value = data[key]
      if (typeof value === 'string' && hexColor.test(value)) settings[key] = value.toUpperCase()
    }
    for (const key of ['glow', 'trails', 'stars'] as const) {
      const value = data[key]
      if (typeof value === 'boolean') settings[key] = value
    }
    return settings
  } catch {
    return initialSettings()
  }
}

export function saveSettings(settings: Settings) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings))
  } catch {
    // Browser privacy settings can make local storage unavailable.
  }
}
