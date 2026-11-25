import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  Activity, ArrowLeftRight, Atom, Box, CircleHelp, Cloud, Flame, Hand, Layers, Magnet, Maximize,
  Minimize, MousePointer2, Network, Orbit, Palette, Pause, Pipette, Play, RotateCcw, Settings as SettingsIcon,
  Shell, SlidersHorizontal, Sparkles, Sun, Waves, X,
} from 'lucide-react'
import { Simulation } from './simulation'
import { initialSettings, loadSettings, presets, ranges, saveSettings } from './settings'
import type { PresetId, RangeKey, Settings, Tool } from './settings'

const presetIcons = { galaxy: Shell, vortex: Orbit, waves: Waves, network: Network, nebula: Cloud, fire: Flame }
const presetIds = Object.keys(presets) as PresetId[]
const tools = [
  { id: 'pointer', label: 'Указатель', icon: MousePointer2, description: 'Наблюдайте за движением частиц.' },
  { id: 'move', label: 'Перемещение', icon: Hand, description: 'Перетащите поле, чтобы сместить центр сцены.' },
  { id: 'attract', label: 'Притяжение', icon: Magnet, description: 'Подведите курсор, чтобы притянуть частицы.' },
  { id: 'vortex', label: 'Вихрь', icon: Orbit, description: 'Закрутите частицы вокруг курсора.' },
  { id: 'repel', label: 'Отталкивание', icon: Sun, description: 'Разгоните частицы от курсора.' },
  { id: 'sample', label: 'Пипетка', icon: Pipette, description: 'Нажмите на поле, чтобы взять цвет ближайшей частицы.' },
] as const

const tabs = [
  { id: 'parameters', label: 'Параметры', icon: SlidersHorizontal },
  { id: 'presets', label: 'Пресеты', icon: Layers },
  { id: 'effects', label: 'Эффекты', icon: Sparkles },
] as const
type Tab = typeof tabs[number]['id']

const effects = [
  { id: 'glow', label: 'Свечение', description: 'Неоновые ореолы вокруг ярких частиц', icon: Sun },
  { id: 'trails', label: 'Линии движения', description: 'Шлейфы потоков и связи между узлами', icon: Waves },
  { id: 'stars', label: 'Звёздный фон', description: 'Рассеянные точки света в глубине поля', icon: Sparkles },
] as const

function Slider({ field, value, onChange }: { field: RangeKey; value: number; onChange: (value: number) => void }) {
  const { label, min, max, step, digits } = ranges[field]
  const formatted = field === 'count' ? new Intl.NumberFormat('ru-RU').format(value) : value.toFixed(digits)
  return (
    <div className="slider">
      <div className="slider-heading">
        <label htmlFor={`parameter-${field}`}>{label}</label>
        <output htmlFor={`parameter-${field}`}>{formatted}</output>
      </div>
      <input id={`parameter-${field}`} type="range" min={min} max={max} step={step} value={value}
        style={{ '--progress': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)} />
    </div>
  )
}

function ColorField({ color, label, onChange }: { color: string; label: string; onChange: (color: string) => void }) {
  const selectColor = (event: FormEvent<HTMLInputElement>) => onChange(event.currentTarget.value.toUpperCase())
  return (
    <div className="color-field">
      <input className="color-swatch" type="color" value={color.toLowerCase()} aria-label={label}
        onInput={selectColor} onChange={selectColor} />
      <input className="hex-input" key={color} defaultValue={color} aria-label={`HEX — ${label.toLowerCase()}`}
        maxLength={7} spellCheck={false} autoComplete="off"
        onBlur={(event) => {
          const input = event.currentTarget
          const next = `#${input.value.trim().replace(/^#/, '').toUpperCase()}`
          if (/^#[0-9A-F]{6}$/.test(next)) {
            input.value = next
            onChange(next)
          } else input.value = color
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            event.currentTarget.value = color
            event.currentTarget.blur()
          }
        }} />
    </div>
  )
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [tool, setTool] = useState<Tool>('pointer')
  const [paused, setPaused] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [tab, setTab] = useState<Tab>('parameters')
  const [panelOpen, setPanelOpen] = useState(() => !matchMedia('(max-width: 760px)').matches)
  const [fullscreen, setFullscreen] = useState(false)
  const [notice, setNotice] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<Simulation>(null)
  const help = useRef<HTMLDialogElement>(null)
  const initial = useRef({ settings, paused })
  const noticeTimer = useRef<number>(undefined)

  useLayoutEffect(() => {
    if (!canvas.current) return
    const simulation = new Simulation(canvas.current, initial.current.settings, initial.current.paused)
    engine.current = simulation
    return () => {
      engine.current = null
      simulation.destroy()
    }
  }, [])

  useEffect(() => {
    engine.current?.update(settings)
    saveSettings(settings)
  }, [settings])

  useEffect(() => engine.current?.setPaused(paused), [paused])
  useEffect(() => engine.current?.setTool(tool), [tool])

  useEffect(() => {
    const compact = matchMedia('(max-width: 760px)')
    const resize = () => setPanelOpen(!compact.matches)
    const syncFullscreen = () => setFullscreen(Boolean(document.fullscreenElement))
    compact.addEventListener('change', resize)
    document.addEventListener('fullscreenchange', syncFullscreen)
    return () => {
      compact.removeEventListener('change', resize)
      document.removeEventListener('fullscreenchange', syncFullscreen)
      window.clearTimeout(noticeTimer.current)
    }
  }, [])

  function update<K extends keyof Settings>(field: K, value: Settings[K]) {
    setSettings((previous) => previous[field] === value ? previous : { ...previous, [field]: value })
  }

  function choosePreset(id: PresetId) {
    if (id === settings.preset) return
    setSettings({ ...initialSettings(id), glow: settings.glow, trails: settings.trails, stars: settings.stars })
  }

  function reset() {
    const defaults = initialSettings(settings.preset)
    engine.current?.update(defaults, true)
    setSettings(defaults)
    showNotice('Настройки пресета сброшены')
  }

  function showNotice(message: string) {
    window.clearTimeout(noticeTimer.current)
    setNotice(message)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2200)
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      showNotice('Полноэкранный режим недоступен в этом браузере')
    }
  }

  function keyboard(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || help.current?.open) return
    const target = event.target instanceof HTMLElement ? event.target : null
    if (target?.closest('input, textarea, select, [contenteditable]')) return
    const nextTool = tools[Number(event.key) - 1]
    if (nextTool) setTool(nextTool.id)
    if (event.code === 'Space' && !target?.closest('button')) {
      event.preventDefault()
      setPaused((value) => !value)
    }
    if (event.code === 'KeyR') reset()
    if (event.code === 'KeyF') void toggleFullscreen()
    if (event.key === 'Escape' && matchMedia('(max-width: 760px)').matches) setPanelOpen(false)
  }

  function pointer(event: ReactPointerEvent<HTMLCanvasElement>, down = false) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    if (down && tool === 'sample' && engine.current) {
      const color = engine.current.sample(x, y)
      update('first', color)
      showNotice(`Цвет частицы ${color}`)
      return
    }
    if (down) event.currentTarget.setPointerCapture(event.pointerId)
    engine.current?.setPointer(x, y, down)
  }

  function sliders(fields: RangeKey[]) {
    return fields.map((field) => <Slider key={field} field={field} value={settings[field]} onChange={(value) => update(field, value)} />)
  }

  return (
    <div className={`lab${panelOpen ? ' lab--panel' : ''}`} onKeyDown={keyboard}>
      <header className="topbar">
        <div className="identity">
          <span className="brand-mark" aria-hidden="true"><Atom size={43} strokeWidth={1.5} /></span>
          <h1>Particle Lab</h1>
          <p>Интерактивная песочница частиц</p>
        </div>
        <div className="top-actions">
          <button className="icon-button" type="button" aria-label="Справка" title="Справка" onClick={() => help.current?.showModal()}><CircleHelp /></button>
          <button className="icon-button" type="button" aria-label={fullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим'}
            title={fullscreen ? 'Выйти из полноэкранного режима' : 'Полноэкранный режим (F)'} aria-pressed={fullscreen}
            onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize /> : <Maximize />}</button>
          <button className="icon-button settings-button" type="button" aria-label={panelOpen ? 'Скрыть настройки' : 'Открыть настройки'} title={panelOpen ? 'Скрыть настройки' : 'Открыть настройки'}
            aria-expanded={panelOpen} aria-controls="inspector" onClick={() => setPanelOpen((value) => !value)}><SettingsIcon /></button>
        </div>
      </header>

      <main className="scene" aria-label="Поле симуляции">
        <canvas ref={canvas} className={`simulation simulation--${tool}`} aria-label={`Симуляция частиц «${presets[settings.preset].name}»`} tabIndex={0}
          onPointerDown={(event) => { if (event.isPrimary && event.button === 0) pointer(event, true) }}
          onPointerMove={(event) => { if (event.isPrimary) pointer(event) }}
          onPointerUp={(event) => engine.current?.releasePointer(event.pointerType !== 'mouse')}
          onPointerCancel={() => engine.current?.releasePointer(true)}
          onLostPointerCapture={(event) => engine.current?.releasePointer(event.pointerType !== 'mouse')}
          onPointerLeave={() => engine.current?.releasePointer(true)} />
        <div className="tool-rail" role="group" aria-label="Инструменты взаимодействия">
          {tools.map(({ id, icon: Icon, label }, index) => (
            <button key={id} className="icon-button tool-button" aria-label={label} title={`${label} (${index + 1})`}
              type="button" aria-pressed={tool === id} onClick={() => setTool(id)}><Icon /></button>
          ))}
        </div>
        {!panelOpen && <button className="quiet-play icon-button" type="button" aria-label={paused ? 'Продолжить' : 'Пауза'}
          title={paused ? 'Продолжить' : 'Пауза'} onClick={() => setPaused((value) => !value)}>{paused ? <Play /> : <Pause />}</button>}
        <div className="scene-notice" role="status">{notice && <span>{notice}</span>}</div>
      </main>

      <nav className="preset-dock" aria-label="Быстрое переключение пресетов">
        <span className="dock-label"><Layers /> Пресеты</span>
        <div className="dock-items">
          {presetIds.map((id) => {
            const Icon = presetIcons[id]
            return <button key={id} type="button" className="preset-button" aria-pressed={settings.preset === id}
              onClick={() => choosePreset(id)}><Icon /><span>{presets[id].name}</span></button>
          })}
        </div>
      </nav>

      <aside id="inspector" className="inspector" aria-label="Настройки симуляции" hidden={!panelOpen}>
        <div className="panel-tabs" role="tablist" aria-label="Разделы настроек">
          {tabs.map(({ id, label, icon: Icon }, index) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id}
              aria-controls="panel-content" tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)}
              onKeyDown={(event) => {
                const next = { ArrowLeft: (index + 2) % tabs.length, ArrowRight: (index + 1) % tabs.length, Home: 0, End: 2 }[event.key]
                if (next === undefined) return
                event.preventDefault()
                setTab(tabs[next].id)
                document.getElementById(`tab-${tabs[next].id}`)?.focus()
              }}><Icon /><span>{label}</span></button>
          ))}
        </div>
        <div className="panel-content" id="panel-content" role="tabpanel" aria-labelledby={`tab-${tab}`} key={tab}>
          {tab === 'parameters' && <>
            <section className="parameter-group" aria-labelledby="particles-title">
              <h2 id="particles-title"><Box /> Частицы</h2>
              {sliders(['count', 'size', 'opacity'])}
            </section>
            <section className="parameter-group physics-group" aria-labelledby="physics-title">
              <h2 id="physics-title"><Activity /> Физика</h2>
              {sliders(['gravity', 'strength', 'radius', 'drag'])}
            </section>
            <section className="parameter-group color-group" aria-labelledby="palette-title">
              <h2 id="palette-title"><Palette /> Цвета</h2>
              <div className="palette-fields">
                <ColorField color={settings.first} label="Первый цвет" onChange={(color) => update('first', color)} />
                <button type="button" className="swap-button" aria-label="Поменять цвета местами" title="Поменять цвета местами"
                  onClick={() => setSettings((value) => ({ ...value, first: value.second, second: value.first }))}><ArrowLeftRight /></button>
                <ColorField color={settings.second} label="Второй цвет" onChange={(color) => update('second', color)} />
              </div>
              <div className="palette-preview" aria-hidden="true" style={{ '--first': settings.first, '--second': settings.second } as CSSProperties} />
            </section>
          </>}
          {tab === 'presets' && <section className="gallery" aria-label="Доступные пресеты">
            {presetIds.map((id) => {
              const Icon = presetIcons[id]
              const { first, second } = initialSettings(id)
              return <button key={id} type="button" className="gallery-item" aria-pressed={settings.preset === id}
                onClick={() => choosePreset(id)} style={{ '--first': first, '--second': second } as CSSProperties}>
                <span className="gallery-icon"><Icon /></span><span><strong>{presets[id].name}</strong><small>{presets[id].description}</small></span>
                <span className="gallery-swatch" aria-hidden="true" />
              </button>
            })}
          </section>}
          {tab === 'effects' && <section className="effects" aria-label="Настройки эффектов">
            {effects.map(({ id, label, description, icon: Icon }) => <label className="effect-row" key={id}>
              <Icon /><span><strong>{label}</strong><small>{description}</small></span>
              <input type="checkbox" role="switch" aria-label={label} checked={settings[id]}
                onChange={(event) => update(id, event.currentTarget.checked)} />
            </label>)}
          </section>}
        </div>
        <div className="panel-actions">
          <button type="button" className="action-button" onClick={reset} title="Сбросить настройки пресета (R)"><RotateCcw /> Сбросить</button>
          <button type="button" className="action-button primary-action" onClick={() => setPaused((value) => !value)}
            title={paused ? 'Продолжить (Пробел)' : 'Пауза (Пробел)'}>{paused ? <Play /> : <Pause />} {paused ? 'Продолжить' : 'Пауза'}</button>
        </div>
      </aside>

      <dialog ref={help} className="help-dialog" aria-labelledby="help-title" onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}>
        <div className="help-inner">
          <div className="help-heading"><h2 id="help-title">Управление</h2>
            <form method="dialog"><button className="icon-button" aria-label="Закрыть справку"><X /></button></form>
          </div>
          <ul className="help-tools">
            {tools.map(({ id, label, description, icon: Icon }, index) => <li key={id}>
              <Icon /><span><strong>{label}</strong><small>{description}</small></span><kbd>{index + 1}</kbd>
            </li>)}
          </ul>
          <div className="help-keys"><span><kbd>Пробел</kbd> Пауза</span><span><kbd>R</kbd> Сброс</span><span><kbd>F</kbd> Полный экран</span></div>
        </div>
      </dialog>
    </div>
  )
}
