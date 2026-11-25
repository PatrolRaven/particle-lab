import type { PresetId, Settings, Tool } from './settings'

const tau = Math.PI * 2
const colorSteps = 16
const shadeCount = 4
const background = '#02040b'
type RGB = [number, number, number]
type Point = { x: number; y: number }

interface Particle extends Point {
  offsetX: number
  offsetY: number
  velocityX: number
  velocityY: number
  distance: number
  angle: number
  u: number
  v: number
  w: number
  size: number
  shade: number
  color: number
  halo: boolean
  ink: number
}

function randomGenerator(seed: number) {
  return () => {
    seed += 0x6D2B79F5
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n)
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296
  }
}

function rgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16)
  return [value >> 16, (value >> 8) & 255, value & 255]
}

function hex([r, g, b]: RGB) {
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function rgba([r, g, b]: RGB, alpha: number) {
  return `rgba(${r},${g},${b},${alpha})`
}

function mix(from: RGB, to: RGB, amount: number): RGB {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ]
}

function makeHalo(color: RGB, soft = false) {
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = 64
  const context = sprite.getContext('2d')!
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  gradient.addColorStop(0, rgba(soft ? color : mix(color, [255, 255, 255], 0.84), soft ? 0.64 : 1))
  gradient.addColorStop(0.12, rgba(color, soft ? 0.53 : 0.86))
  gradient.addColorStop(0.31, rgba(color, soft ? 0.3 : 0.32))
  gradient.addColorStop(0.58, rgba(color, 0.085))
  gradient.addColorStop(1, rgba(color, 0))
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  return sprite
}

const arms = [0.30, 1.13, 2.15, 3.38, 4.00, 5.24]
const armWidths = [0.96, 1.22, 1.58, 0.80, 1.50, 1.20]

function spiral(distance: number, arm: number) {
  return -1.6 * Math.log(0.047 + distance) + arms[arm]
    + Math.sin(distance * 6.4 + arm * 1.86) * Math.min(distance * 1.16, 0.46)
}

function galaxyTint(angle: number, distance: number, variation: number) {
  const rim = Math.min(1, distance * 2.65)
  const corner = Math.max(0, Math.min(1, 0.47 + 0.55 * Math.cos(angle + 0.47)))
  return Math.floor(Math.min(1, Math.max(0, rim * (corner * 0.92 + variation * 0.57))) * (colorSteps - 1))
}

function generateParticles(count: number, preset: PresetId) {
  const random = randomGenerator(693701)
  const particles: Particle[] = []
  const galaxy = preset === 'galaxy'
  for (let i = 0; i < count; i++) {
    const u = random()
    const v = random()
    const w = random()
    const arm = Math.floor(random() * arms.length)
    const scatter = (random() + random() + random() - 1.5)
    let distance = Math.pow(u, 0.62)
    let angle = v * tau
    let cluster = 0
    if (galaxy) {
      const rawDistance = Math.pow(u, 0.99) * (1.25 + 0.17 * Math.sin(arm * 2.4 + 0.9))
      // Alternating compression and expansion creates denser knots along each arm.
      distance = rawDistance + 0.041 * Math.sin(rawDistance * 19 + arm * 2.1) * Math.min(1, rawDistance * 5)
      cluster = 0.5 - 0.5 * Math.cos(rawDistance * 19 + arm * 2.1)
      const width = (0.12 + distance * 0.44) * armWidths[arm]
      const fork = Math.sin(distance * 10.5 + arm * 1.9) * distance * 0.31
      angle = spiral(distance, arm) + (v > 0.72 ? fork : 0)
        + scatter * (w > 0.86 ? 1.9 : width * (1.18 - cluster * 0.55))
    }
    const flash = random() + cluster * 0.037
    const size = random()
    const shade = flash > 0.955 ? 3 : flash > 0.67 ? 2 : flash > 0.23 ? 1 : 0
    const color = galaxy ? galaxyTint(angle, distance, w - 0.32) : Math.round((w * 0.65 + u * 0.35) * (colorSteps - 1))
    particles.push({
      x: 0, y: 0, offsetX: 0, offsetY: 0, velocityX: 0, velocityY: 0,
      distance, angle, u, v, w, size: galaxy
        ? (0.34 + size * size * 0.95) * (0.74 + v * 0.53)
        : 0.38 + size * size * 0.84,
      shade, color, halo: shade === 3 || (shade === 2 && size > 0.84), ink: color * shadeCount + shade,
    })
  }
  return particles
}

function makeStars() {
  const random = randomGenerator(18871)
  return Array.from({ length: 285 }, () => ({
    x: random(), y: random(), size: random(), tint: Math.floor(random() * colorSteps), alpha: random(),
  }))
}

export class Simulation {
  private readonly context: CanvasRenderingContext2D
  private readonly backdrop = document.createElement('canvas')
  private readonly backdropContext = this.backdrop.getContext('2d', { alpha: false })!
  private readonly stars = makeStars()
  private readonly observer: ResizeObserver
  private particles: Particle[] = []
  private drawOrder: Particle[] = []
  private glints: Particle[] = []
  private litDust: Particle[] = []
  private colors: RGB[] = []
  private styles: string[] = []
  private halos: HTMLCanvasElement[] = []
  private softHalos: HTMLCanvasElement[] = []
  private width = 1
  private height = 1
  private ratio = 0
  private deviceRatio = 0
  private frame = 0
  private lastTime = 0
  private time = 0
  private paused: boolean
  private centerX = 0.53
  private centerY = 0.5
  private tool: Tool = 'pointer'
  private pointer = { x: 0, y: 0, active: false }
  private pressed = false
  private grab: Point = { x: 0, y: 0 }

  constructor(private readonly canvas: HTMLCanvasElement, private settings: Settings, paused: boolean) {
    this.context = canvas.getContext('2d', { alpha: false })!
    this.paused = paused
    this.rebuildPalette()
    this.reset()
    this.observer = new ResizeObserver(this.resize)
    this.observer.observe(canvas)
    window.addEventListener('resize', this.resize)
    this.resize()
    this.schedule()
  }

  private resize = () => {
    const width = Math.max(1, this.canvas.clientWidth)
    const height = Math.max(1, this.canvas.clientHeight)
    const deviceRatio = window.devicePixelRatio || 1
    const ratio = Math.min(deviceRatio, 2, Math.sqrt(2_500_000 / (width * height)))
    this.deviceRatio = deviceRatio
    if (width === this.width && height === this.height && ratio === this.ratio) return
    this.width = width
    this.height = height
    this.ratio = ratio
    this.canvas.width = Math.round(width * ratio)
    this.canvas.height = Math.round(height * ratio)
    this.context.setTransform(this.canvas.width / width, 0, 0, this.canvas.height / height, 0, 0)
    this.rebuildBackdrop()
    this.render(0)
  }

  update(settings: Settings, resetScene = false) {
    const previous = this.settings
    if (previous === settings) return
    this.settings = settings
    const paletteChanged = previous.first !== settings.first || previous.second !== settings.second
    if (paletteChanged) this.rebuildPalette()
    else if (previous.opacity !== settings.opacity) this.rebuildStyles()
    if (paletteChanged || previous.stars !== settings.stars || previous.glow !== settings.glow) {
      this.rebuildBackdrop()
    }
    if (resetScene || previous.preset !== settings.preset || previous.count !== settings.count) {
      this.reset(resetScene || previous.preset !== settings.preset)
    }
    else if (this.paused) this.render(0)
  }

  private reset(restart = true) {
    if (restart) {
      this.time = 0
      this.centerX = this.settings.preset === 'galaxy' ? 0.53 : 0.5
      this.centerY = this.settings.preset === 'fire' ? 0.83 : 0.5
    }
    this.particles = generateParticles(this.settings.count, this.settings.preset)
    this.drawOrder = [...this.particles].sort((a, b) => a.ink - b.ink)
    this.glints = this.drawOrder.filter((particle) => particle.shade === 3)
    this.litDust = this.drawOrder.filter((particle) => particle.shade === 2 && particle.halo)
    if (this.paused && this.ratio) this.render(0)
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return
    this.paused = paused
    this.lastTime = 0
    if (paused) cancelAnimationFrame(this.frame)
    else this.schedule()
  }

  setTool(tool: Tool) {
    this.tool = tool
    this.pressed = false
    this.pointer.active = false
    if (this.paused) this.render(0)
  }

  setPointer(x: number, y: number, down = false) {
    if (this.tool === 'pointer' || this.tool === 'sample') return
    this.pointer = { x, y, active: true }
    if (down) {
      this.pressed = true
      this.grab = { x: x - this.centerX * this.width, y: y - this.centerY * this.height }
    }
    if (this.tool === 'move' && this.pressed) {
      this.centerX = Math.max(-0.3, Math.min(1.3, (x - this.grab.x) / this.width))
      this.centerY = Math.max(-0.3, Math.min(1.3, (y - this.grab.y) / this.height))
    }
    if (this.paused && (this.tool !== 'move' || this.pressed)) this.render(0)
  }

  releasePointer(leave: boolean) {
    const changed = this.pressed || (leave && this.pointer.active)
    this.pressed = false
    if (leave) this.pointer.active = false
    if (changed && this.paused) this.render(0)
  }

  sample(x: number, y: number) {
    let nearest: Particle | undefined
    let distance = Infinity
    for (const particle of this.particles) {
      const dx = particle.x - x
      const dy = particle.y - y
      const squared = dx * dx + dy * dy
      if (squared < distance) {
        nearest = particle
        distance = squared
      }
    }
    return nearest ? hex(this.colors[nearest.color]).toUpperCase() : this.settings.first
  }

  destroy() {
    cancelAnimationFrame(this.frame)
    this.observer.disconnect()
    window.removeEventListener('resize', this.resize)
  }

  private schedule() {
    if (!this.paused) this.frame = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    if (this.deviceRatio !== window.devicePixelRatio) this.resize()
    const step = this.lastTime ? Math.min((now - this.lastTime) / (1000 / 60), 2.4) : 0
    this.lastTime = now
    this.time += step / 60
    this.render(step)
    this.schedule()
  }

  private rebuildPalette() {
    const start = rgb(this.settings.first)
    const end = rgb(this.settings.second)
    this.colors = Array.from({ length: colorSteps }, (_, index) => {
      const t = index / (colorSteps - 1)
      const base = mix(start, end, t)
      const blue = Math.max(0, base[2] - Math.max(base[0], base[1]) * 0.66) / 255
      return [base[0], Math.round(base[1] * (1 - Math.sin(t * Math.PI) * blue * 0.62)), base[2]]
    })
    this.halos = this.colors.map((color) => makeHalo(color))
    this.softHalos = this.colors.map((color) => makeHalo(color, true))
    this.rebuildStyles()
  }

  private rebuildStyles() {
    const white: RGB = [244, 249, 255]
    this.styles = this.colors.flatMap((color) => [
      rgba(color, this.settings.opacity * 0.51),
      rgba(color, this.settings.opacity * 0.95),
      rgba(mix(color, white, 0.24), Math.min(1, this.settings.opacity * 1.23)),
      rgba(mix(color, white, 0.82), Math.min(1, this.settings.opacity * 1.3)),
    ])
  }

  private rebuildBackdrop() {
    this.backdrop.width = this.canvas.width
    this.backdrop.height = this.canvas.height
    const context = this.backdropContext
    context.setTransform(this.backdrop.width / this.width, 0, 0, this.backdrop.height / this.height, 0, 0)
    context.fillStyle = background
    context.fillRect(0, 0, this.width, this.height)
    if (!this.settings.stars) return
    const { width, height } = this
    for (const star of this.stars) {
      const x = star.x * width
      const y = star.y * height
      if (this.settings.glow && star.size > 0.86) {
        const diameter = 7 + star.alpha * 24
        const tint = x < width * 0.52 ? Math.floor(star.tint * 0.39) : 8 + Math.floor(star.tint * 0.47)
        context.globalAlpha = 0.16 + star.alpha * 0.48
        context.drawImage(this.softHalos[tint], x - diameter / 2, y - diameter / 2, diameter, diameter)
      } else {
        const size = 0.65 + star.size * 1.25
        context.globalAlpha = 0.06 + star.alpha * 0.36
        context.fillStyle = hex(this.colors[star.tint])
        context.fillRect(x, y, size, size)
      }
    }
    context.globalAlpha = 1
  }

  private render(step: number) {
    const context = this.context
    const { width, height, settings, time } = this
    const { preset, size, opacity, glow, trails } = settings
    const centerX = width * this.centerX
    const centerY = height * this.centerY
    const scale = Math.max(height * 0.6, width * 0.44)
    const stretch = Math.max(0.86, Math.min(1.32, width / height * 0.76))
    const spin = time * (0.087 + settings.gravity * 0.14)
    const galaxySpin = 0.36 * Math.sin(time * (0.21 + settings.gravity * 0.075))
      + 0.1 * Math.sin(time * 0.56)
    const settle = (0.045 + Math.abs(settings.gravity) * 0.075) * step
    const damping = Math.pow(settings.drag, step * 2.3)
    const { x: px, y: py, active } = this.pointer
    const affecting = active && (this.tool === 'attract' || this.tool === 'repel' || this.tool === 'vortex')
    const radiusSquared = settings.radius * settings.radius
    const force = settings.strength * step * (this.pressed ? 1.4 : 0.78)

    context.drawImage(this.backdrop, 0, 0, width, height)

    for (const particle of this.particles) {
      const { u, v, w, angle, distance } = particle
      let x: number
      let y: number

      switch (preset) {
        case 'galaxy': {
          const a = angle + galaxySpin * (0.24 + 0.28 / (0.17 + distance)) + 0.035 * Math.sin(time * 0.7 + angle)
          const r = distance * scale * (1 - settings.gravity * 0.11)
          x = centerX + Math.cos(a) * r * stretch
          y = centerY + Math.sin(a) * r * (0.86 + 0.18 * Math.cos(a + 0.51))
          break
        }
        case 'vortex': {
          const a = Math.floor(v * 5) * (tau / 5) + spin * (1 + 1.6 / (0.15 + distance))
            + distance * 5.2 + (w - 0.5) * (0.7 + distance * 0.9)
          const r = distance * scale * (0.88 - settings.gravity * 0.14)
          x = centerX + Math.cos(a) * r * stretch
          y = centerY + Math.sin(a) * r * 0.62 + (distance - 0.42) * height * 0.46
          break
        }
        case 'waves': {
          const band = Math.floor(v * 9) / 8 - 0.5
          x = centerX + (u - 0.5) * width * 1.18
          y = centerY + (band * 0.48 + Math.sin(u * 12 + band * 4 + time * 1.35) * 0.16
            + Math.sin(u * 20 - time * 0.48) * 0.057 + (w - 0.5) * 0.038 + settings.gravity * 0.15) * height
          break
        }
        case 'network': {
          x = centerX + (u - 0.5) * width * 0.99 + Math.sin(time * 0.46 + angle) * 27
          y = centerY + (v - 0.5) * height * 0.87 + Math.cos(time * 0.39 + w * tau) * 24 + settings.gravity * height * 0.13
          break
        }
        case 'nebula': {
          const bend = v * tau + time * 0.085
          const r = distance * scale * (1.02 - settings.gravity * 0.14)
          x = centerX + Math.cos(bend) * r * stretch + Math.sin(w * 11 + time * 0.27) * scale * 0.31
          y = centerY + Math.sin(bend * 2.0 + u) * r * 0.52 + Math.cos(w * 14 + time * 0.22) * scale * 0.26
          break
        }
        case 'fire': {
          const rate = 0.18 + w * 0.18 - settings.gravity * 0.075
          const age = (u + time * rate) % 1
          const flame = 0.17 + Math.sin(age * Math.PI) * 0.39 - age * 0.1
          x = centerX + ((v - 0.5) * flame + Math.sin(age * 12 + time * 1.2 + w * 9) * age * 0.086) * width
          y = centerY - (Math.pow(age, 1.38) * (0.29 + w * 0.5) + Math.sin(v * tau) * 0.041) * height
          break
        }
      }

      if (step) {
        particle.velocityX -= particle.offsetX * settle * 0.15
        particle.velocityY -= particle.offsetY * settle * 0.15
        if (affecting) {
          const dx = px - x - particle.offsetX
          const dy = py - y - particle.offsetY
          const squared = dx * dx + dy * dy
          if (squared < radiusSquared) {
            const influence = force * (1 - squared / radiusSquared) / Math.sqrt(squared + 140)
            if (this.tool === 'vortex') {
              particle.velocityX += (dy + dx * 0.19) * influence
              particle.velocityY += (-dx + dy * 0.19) * influence
            } else {
              const direction = this.tool === 'repel' ? -1 : 1
              particle.velocityX += dx * influence * direction
              particle.velocityY += dy * influence * direction
            }
          }
        }
        particle.velocityX *= damping
        particle.velocityY *= damping
        particle.offsetX += particle.velocityX * step
        particle.offsetY += particle.velocityY * step
      }

      particle.x = x + particle.offsetX
      particle.y = y + particle.offsetY
    }

    if (trails) {
      if (preset === 'galaxy') this.drawGalaxyTraces(centerX, centerY)
      else if (preset === 'network') this.drawLinks()
      else this.drawStreaks()
    }
    const sizeScale = (preset === 'galaxy' ? 1.02 : 0.88) * size
    let previousStyle = -1
    for (const particle of this.drawOrder) {
      const { x, y, shade, ink } = particle
      if (x < -12 || x > width + 12 || y < -12 || y > height + 12) continue
      const diameter = particle.size * sizeScale * (shade === 3 ? 1.95 : 1)
      if (ink !== previousStyle) {
        context.fillStyle = this.styles[ink]
        previousStyle = ink
      }
      context.fillRect(x - diameter / 2, y - diameter / 2, diameter, diameter)
    }
    if (glow) {
      this.drawParticleGlow(this.litDust, sizeScale * 5.8, opacity * 0.70)
      this.drawParticleGlow(this.glints, sizeScale * 1.95 * 8.2, Math.min(1, opacity * 1.18))
      context.globalAlpha = 1
    }

    if (glow && preset === 'galaxy') {
      const core = Math.max(48, scale * 0.22) * (0.95 + 0.05 * Math.sin(time * 1.3))
      context.globalCompositeOperation = 'lighter'
      context.globalAlpha = opacity * 0.54
      context.drawImage(this.halos[0], centerX - core / 2, centerY - core / 2, core, core)
      context.globalAlpha = opacity * 0.26
      context.drawImage(this.softHalos[2], centerX - core, centerY - core, core * 2, core * 2)
      const spark = core * 0.27
      context.globalAlpha = opacity * 0.76
      context.drawImage(this.halos[0], centerX - spark / 2, centerY - spark / 2, spark, spark)
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
    }

    if (affecting) {
      context.beginPath()
      context.arc(px, py, settings.radius, 0, tau)
      context.strokeStyle = rgba(this.colors[this.tool === 'repel' ? colorSteps - 1 : 0], this.pressed ? 0.44 : 0.22)
      context.lineWidth = 1
      context.stroke()
    }
  }

  private drawParticleGlow(particles: Particle[], scale: number, alpha: number) {
    const context = this.context
    context.globalAlpha = alpha
    for (const { x, y, color, size } of particles) {
      const diameter = size * scale
      const radius = diameter / 2
      if (x < -radius || x > this.width + radius || y < -radius || y > this.height + radius) continue
      context.drawImage(this.halos[color], x - radius, y - radius, diameter, diameter)
    }
  }

  private drawGalaxyTraces(cx: number, cy: number) {
    const context = this.context
    context.beginPath()
    for (let i = 0; i < this.particles.length; i += 10) {
      const { x, y, distance, size, velocityX, velocityY } = this.particles[i]
      if (x < 0 || x > this.width || y < 0 || y > this.height) continue
      const arc = 0.012 * size / (0.24 + distance)
      context.moveTo(x, y)
      context.lineTo(
        x + (y - cy) * arc - Math.max(-6, Math.min(6, velocityX * 1.4)),
        y - (x - cx) * arc - Math.max(-6, Math.min(6, velocityY * 1.4)),
      )
    }
    context.lineWidth = 0.7
    context.strokeStyle = rgba(this.colors[5], this.settings.opacity * 0.25)
    context.stroke()
  }

  private drawStreaks() {
    const context = this.context
    const { preset, opacity } = this.settings
    const vertical = preset === 'fire' ? 8 : 0
    const horizontal = preset === 'waves' ? 6 : 2
    context.beginPath()
    for (let i = 0; i < this.particles.length; i += 6) {
      const { x, y, velocityX, velocityY, w } = this.particles[i]
      context.moveTo(x, y)
      context.lineTo(x - velocityX * 1.7 + horizontal * (w - 0.5), y - velocityY * 1.7 + vertical * w)
    }
    context.lineWidth = 0.8
    context.strokeStyle = rgba(this.colors[5], opacity * 0.19)
    context.stroke()
  }

  private drawLinks() {
    const context = this.context
    const reach = Math.min(122, this.width * 0.15)
    const nodeCount = Math.min(115, this.particles.length)
    context.beginPath()
    for (let i = 0; i < nodeCount; i++) {
      const node = this.particles[i]
      for (let j = i + 1; j < nodeCount; j++) {
        const neighbor = this.particles[j]
        const dx = node.x - neighbor.x
        const dy = node.y - neighbor.y
        if (dx * dx + dy * dy < reach * reach) {
          context.moveTo(node.x, node.y)
          context.lineTo(neighbor.x, neighbor.y)
        }
      }
    }
    context.lineWidth = 0.8
    context.strokeStyle = rgba(this.colors[5], this.settings.opacity * 0.32)
    context.stroke()
    context.fillStyle = hex(this.colors[0])
    for (let i = 0; i < nodeCount; i++) {
      const { x, y } = this.particles[i]
      context.fillRect(x - 1.3, y - 1.3, 2.6, 2.6)
    }
  }
}
