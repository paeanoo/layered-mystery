/**
 * 投射物视觉系统
 * 提供各种投射物的精美视觉效果和动画
 */

export interface ProjectileRenderOptions {
  type: 'basic' | 'piercing' | 'explosive' | 'energy' | 'arrow' | 'grenade' | 'laser' | 'magic'
  size: number
  color: string
  isCrit?: boolean
  damage?: number
  velocity: { x: number; y: number }
  life?: number
  maxLife?: number
  effects?: string[]
}

export interface ExplosionEffect {
  x: number
  y: number
  size: number
  type: string
  life: number
  maxLife: number
  particles: any[]
}

export class ProjectileVisualSystem {
  private animationTime = 0
  private trailEffects: Map<string, any[]> = new Map()
  private explosions: ExplosionEffect[] = []

  constructor() {
    this.initializeTrailSystems()
  }

  private initializeTrailSystems() {
    this.trailEffects.set('basic', [])
    this.trailEffects.set('energy', [])
    this.trailEffects.set('magic', [])
    this.trailEffects.set('fire', [])
  }

  update(deltaTime: number) {
    this.animationTime += deltaTime
    this.updateTrails(deltaTime)
    this.updateExplosions(deltaTime)
  }

  /**
   * 绘制投射物
   */
  drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, options: ProjectileRenderOptions, projectileId?: string) {
    ctx.save()
    ctx.translate(x, y)

    // 计算旋转角度
    const angle = Math.atan2(options.velocity.y, options.velocity.x)
    ctx.rotate(angle)

    // 根据类型绘制不同的投射物
    switch (options.type) {
      case 'basic':
        this.drawBasicProjectile(ctx, options)
        break
      case 'piercing':
        this.drawPiercingProjectile(ctx, options)
        break
      case 'explosive':
        this.drawExplosiveProjectile(ctx, options)
        break
      case 'energy':
        this.drawEnergyProjectile(ctx, options)
        break
      case 'arrow':
        this.drawArrowProjectile(ctx, options)
        break
      case 'grenade':
        this.drawGrenadeProjectile(ctx, options)
        break
      case 'laser':
        this.drawLaserProjectile(ctx, options)
        break
      case 'magic':
        this.drawMagicProjectile(ctx, options)
        break
      default:
        this.drawBasicProjectile(ctx, options)
    }

    // 添加拖尾效果（激光不需要拖尾）
    if (projectileId && options.type !== 'laser') {
      this.addTrailEffect(projectileId, x, y, options)
    }

    ctx.restore()
  }

  private updateTrails(deltaTime: number) {
    this.trailEffects.forEach((trails, trailType) => {
      // 跳过激光类型的拖尾更新
      if (trailType === 'laser') {
        return
      }
      
      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i]
        trail.life -= deltaTime
        trail.alpha = trail.life / trail.maxLife
        
        if (trail.life <= 0) {
          trails.splice(i, 1)
        }
      }
    })
  }

  private updateExplosions(deltaTime: number) {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i]
      explosion.life -= deltaTime
      
      // 更新爆炸粒子
      explosion.particles.forEach(particle => {
        particle.x += particle.vx * deltaTime / 1000
        particle.y += particle.vy * deltaTime / 1000
        particle.life -= deltaTime
        particle.size *= 0.999 // 粒子逐渐缩小
        
        if (particle.gravity) {
          particle.vy += particle.gravity * deltaTime / 1000
        }
      })
      
      // 移除过期粒子
      explosion.particles = explosion.particles.filter(p => p.life > 0)
      
      if (explosion.life <= 0) {
        this.explosions.splice(i, 1)
      }
    }
  }


  private drawBasicProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const size = options.size
    const length = size * 3
    
    if (options.isCrit) {
      // 暴击弹丸 - 金色闪光
      ctx.save()
      ctx.shadowColor = '#ffff00'
      ctx.shadowBlur = 10
      
      // 主体
      const gradient = ctx.createLinearGradient(-length/2, 0, length/2, 0)
      gradient.addColorStop(0, '#ffaa00')
      gradient.addColorStop(0.5, '#ffff00')
      gradient.addColorStop(1, '#ffaa00')
      
      ctx.fillStyle = gradient
      ctx.fillRect(-length/2, -size/2, length, size)
      
      // 能量波纹
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.rect(-length/2 - i*2, -size/2 - i, length + i*4, size + i*2)
        ctx.stroke()
      }
      
      ctx.restore()
    } else {
      // 普通弹丸
      const gradient = ctx.createLinearGradient(-length/2, 0, length/2, 0)
      gradient.addColorStop(0, this.darkenColor(options.color))
      gradient.addColorStop(0.5, options.color)
      gradient.addColorStop(1, this.darkenColor(options.color))
      
      ctx.fillStyle = gradient
      ctx.fillRect(-length/2, -size/2, length, size)
      
      // 弹头
      ctx.fillStyle = this.lightenColor(options.color)
      ctx.beginPath()
      ctx.moveTo(length/2, 0)
      ctx.lineTo(length/2 - size, -size/2)
      ctx.lineTo(length/2 - size, size/2)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawPiercingProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const size = options.size
    const length = size * 4
    
    // 穿透弹 - 尖锐外形
    ctx.save()
    ctx.shadowColor = options.color
    ctx.shadowBlur = 8
    
    // 主体 - 流线型
    const gradient = ctx.createLinearGradient(-length/2, 0, length/2, 0)
    gradient.addColorStop(0, this.darkenColor(options.color))
    gradient.addColorStop(0.3, options.color)
    gradient.addColorStop(0.7, options.color)
    gradient.addColorStop(1, '#ffffff')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(-length/2, 0)
    ctx.lineTo(-length/4, -size/2)
    ctx.lineTo(length/3, -size/3)
    ctx.lineTo(length/2, 0)
    ctx.lineTo(length/3, size/3)
    ctx.lineTo(-length/4, size/2)
    ctx.closePath()
    ctx.fill()
    
    // 螺旋纹理
    ctx.strokeStyle = this.lightenColor(options.color)
    ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const offset = (this.animationTime / 100 + i * Math.PI / 2.5) % (Math.PI * 2)
      const waveY = Math.sin(offset) * size / 4
      ctx.beginPath()
      ctx.moveTo(-length/2 + i * length/5, waveY)
      ctx.lineTo(-length/2 + (i+1) * length/5, -waveY)
      ctx.stroke()
    }
    
    ctx.restore()
  }

  private drawExplosiveProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const size = options.size * 1.2
    const pulse = Math.sin(this.animationTime / 150) * 0.1 + 1
    
    ctx.save()
    ctx.scale(pulse, pulse)
    
    // 爆炸弹 - 危险的红色
    ctx.shadowColor = '#ff4400'
    ctx.shadowBlur = 12
    
    // 主体
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.3, '#ffaa00')
    gradient.addColorStop(0.7, '#ff4400')
    gradient.addColorStop(1, '#aa0000')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
    
    // 危险标记
    ctx.fillStyle = '#000000'
    ctx.font = 'bold 8px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('!', 0, 3)
    
    // 火花效果
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + this.animationTime / 200
      const sparkX = Math.cos(angle) * size * 1.2
      const sparkY = Math.sin(angle) * size * 1.2
      
      ctx.fillStyle = '#ffff00'
      ctx.beginPath()
      ctx.arc(sparkX, sparkY, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
  }

  private drawEnergyProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const size = options.size
    const energy = Math.sin(this.animationTime / 100) * 0.3 + 0.7
    
    ctx.save()
    ctx.globalAlpha = energy
    
    // 能量弹 - 发光效果
    ctx.shadowColor = options.color
    ctx.shadowBlur = 15
    
    // 核心
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size)
    coreGradient.addColorStop(0, '#ffffff')
    coreGradient.addColorStop(0.3, options.color)
    coreGradient.addColorStop(1, 'rgba(0,0,0,0)')
    
    ctx.fillStyle = coreGradient
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
    
    // 外层光环
    const auraGradient = ctx.createRadialGradient(0, 0, size, 0, 0, size * 2)
    auraGradient.addColorStop(0, `rgba(${this.hexToRgb(options.color)}, 0.8)`)
    auraGradient.addColorStop(1, 'rgba(0,0,0,0)')
    
    ctx.fillStyle = auraGradient
    ctx.beginPath()
    ctx.arc(0, 0, size * 2, 0, Math.PI * 2)
    ctx.fill()
    
    // 电弧效果
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + this.animationTime / 50
      const innerR = size * 0.5
      const outerR = size * 1.5
      
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR)
      ctx.stroke()
    }
    
    ctx.restore()
  }

  private drawArrowProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const length = options.size * 4
    const width = options.size * 0.8
    
    // 箭杆
    ctx.fillStyle = '#8B4513'
    ctx.fillRect(-length * 0.8, -width * 0.1, length * 0.7, width * 0.2)
    
    // 箭头
    ctx.fillStyle = '#C0C0C0'
    ctx.beginPath()
    ctx.moveTo(length * 0.4, 0)
    ctx.lineTo(-length * 0.1, -width * 0.3)
    ctx.lineTo(-length * 0.3, 0)
    ctx.lineTo(-length * 0.1, width * 0.3)
    ctx.closePath()
    ctx.fill()
    
    // 箭羽
    ctx.fillStyle = options.isCrit ? '#ff0000' : '#00ff00'
    ctx.beginPath()
    ctx.moveTo(-length * 0.8, 0)
    ctx.lineTo(-length * 0.6, -width * 0.4)
    ctx.lineTo(-length * 0.7, 0)
    ctx.lineTo(-length * 0.6, width * 0.4)
    ctx.closePath()
    ctx.fill()
    
    // 暴击箭矢特效
    if (options.isCrit) {
      ctx.save()
      ctx.shadowColor = '#ff0000'
      ctx.shadowBlur = 8
      ctx.strokeStyle = '#ffff00'
      ctx.lineWidth = 1
      ctx.strokeRect(-length * 0.8, -width * 0.4, length * 1.2, width * 0.8)
      ctx.restore()
    }
  }

  private drawGrenadeProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const size = options.size * 1.5
    const spin = this.animationTime / 100
    
    ctx.save()
    ctx.rotate(spin)
    
    // 手榴弹主体
    ctx.fillStyle = this.createGradient(ctx, '#2c3e50', '#34495e', 0, -size, 0, size)
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
    
    // 纹理线条
    ctx.strokeStyle = '#1a252f'
    ctx.lineWidth = 1
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(angle) * size * 0.8, Math.sin(angle) * size * 0.8)
      ctx.stroke()
    }
    
    // 引信
    ctx.fillStyle = '#ff4400'
    ctx.beginPath()
    ctx.arc(0, -size * 0.8, size * 0.2, 0, Math.PI * 2)
    ctx.fill()
    
    // 火花
    if (Math.random() < 0.3) {
      ctx.fillStyle = '#ffaa00'
      ctx.beginPath()
      ctx.arc(size * 0.2, -size * 0.9, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
  }

  private drawLaserProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const length = options.size * 8
    const width = options.size * 1.0  // 激光宽度，调整为 1.0
    
    ctx.save()
    ctx.shadowColor = options.color
    ctx.shadowBlur = 20
    
    // 激光核心
    const coreGradient = ctx.createLinearGradient(0, -width/2, 0, width/2)
    coreGradient.addColorStop(0, 'rgba(255,255,255,0)')
    coreGradient.addColorStop(0.5, '#ffffff')
    coreGradient.addColorStop(1, 'rgba(255,255,255,0)')
    
    ctx.fillStyle = coreGradient
    ctx.fillRect(-length/2, -width/4, length, width/2)
    
    // 激光外层
    const outerGradient = ctx.createLinearGradient(0, -width, 0, width)
    outerGradient.addColorStop(0, 'rgba(255,255,255,0)')
    outerGradient.addColorStop(0.5, options.color)
    outerGradient.addColorStop(1, 'rgba(255,255,255,0)')
    
    ctx.fillStyle = outerGradient
    ctx.fillRect(-length/2, -width/2, length, width)
    
    // 激光脉冲效果
    const pulse = Math.sin(this.animationTime / 50)
    ctx.globalAlpha = 0.5 + pulse * 0.3
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(-length/2, -width/6, length, width/3)
    
    ctx.restore()
  }

  private drawMagicProjectile(ctx: CanvasRenderingContext2D, options: ProjectileRenderOptions) {
    const size = options.size
    const magic = Math.sin(this.animationTime / 200) * 0.2 + 0.8
    
    ctx.save()
    ctx.globalAlpha = magic
    ctx.shadowColor = '#8A2BE2'
    ctx.shadowBlur = 15
    
    // 魔法球核心
    const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size)
    coreGradient.addColorStop(0, '#ffffff')
    coreGradient.addColorStop(0.3, '#DDA0DD')
    coreGradient.addColorStop(0.7, '#8A2BE2')
    coreGradient.addColorStop(1, '#4B0082')
    
    ctx.fillStyle = coreGradient
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
    
    // 魔法符文环绕
    ctx.save()
    ctx.rotate(this.animationTime / 300)
    
    const runes = ['◊', '※', '⚡', '◈', '✦', '❋']
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const runeX = Math.cos(angle) * size * 1.5
      const runeY = Math.sin(angle) * size * 1.5
      
      ctx.save()
      ctx.translate(runeX, runeY)
      ctx.rotate(-this.animationTime / 300) // 保持符文直立
      ctx.font = '10px serif'
      ctx.fillStyle = '#DDA0DD'
      ctx.textAlign = 'center'
      ctx.fillText(runes[i], 0, 3)
      ctx.restore()
    }
    
    ctx.restore()
    
    // 魔法粒子
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + this.animationTime / 100
      const particleX = Math.cos(angle) * size * 0.7
      const particleY = Math.sin(angle) * size * 0.7
      
      ctx.fillStyle = '#DDA0DD'
      ctx.globalAlpha = magic * 0.7
      ctx.beginPath()
      ctx.arc(particleX, particleY, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()
  }


  private addTrailEffect(projectileId: string, x: number, y: number, options: ProjectileRenderOptions) {
    // 激光束不需要拖尾效果，因为本身就是连续光束
    if (options.type === 'laser') {
      return
    }
    
    // 简单的拖尾效果实现
    const trailType = options.type === 'energy' ? 'energy' : 'basic'
    const trails = this.trailEffects.get(trailType) || []
    
    trails.push({
      x: x,
      y: y,
      life: 200, // 毫秒
      maxLife: 200,
      size: options.size * 0.7,
      color: options.color
    })
    
    this.trailEffects.set(trailType, trails)
  }

  drawTrails(ctx: CanvasRenderingContext2D) {
    this.trailEffects.forEach((trails, trailType) => {
      // 跳过激光类型的拖尾
      if (trailType === 'laser') {
        return
      }
      
      trails.forEach((trail) => {
        ctx.save()
        ctx.globalAlpha = trail.alpha
        ctx.fillStyle = trail.color
        ctx.beginPath()
        ctx.arc(trail.x, trail.y, trail.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    })
  }

  /**
   * 创建爆炸效果
   */
  createExplosion(x: number, y: number, size: number, type: string = 'normal') {
    const explosion: ExplosionEffect = {
      x, y, size, type,
      life: 1000, // 1秒
      maxLife: 1000,
      particles: []
    }

    // 根据爆炸类型创建不同的粒子
    const particleCount = type === 'large' ? 50 : type === 'small' ? 20 : 35
    const colors = type === 'energy' ? ['#00ffff', '#ffffff', '#0088ff'] : 
                  type === 'fire' ? ['#ff4400', '#ffaa00', '#ffffff'] :
                  ['#ff8800', '#ffaa00', '#ffffff']

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5
      const speed = 50 + Math.random() * 200
      const particleSize = 2 + Math.random() * 4
      const life = 300 + Math.random() * 700
      
      explosion.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: particleSize,
        life,
        maxLife: life,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: type === 'fire' ? -50 : 0
      })
    }

    this.explosions.push(explosion)
  }

  /**
   * 绘制爆炸效果
   */
  drawExplosions(ctx: CanvasRenderingContext2D) {
    this.explosions.forEach((explosion) => {
      // 绘制主爆炸波
      const progress = 1 - (explosion.life / explosion.maxLife)
      const currentSize = explosion.size * (1 + progress * 3)
      const alpha = explosion.life / explosion.maxLife
      
      ctx.save()
      ctx.globalAlpha = alpha * 0.5
      
      // 外圈
      const outerGradient = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, currentSize)
      outerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)')
      outerGradient.addColorStop(0.3, 'rgba(255, 170, 0, 0.6)')
      outerGradient.addColorStop(0.7, 'rgba(255, 68, 0, 0.4)')
      outerGradient.addColorStop(1, 'rgba(255, 68, 0, 0)')
      
      ctx.fillStyle = outerGradient
      ctx.beginPath()
      ctx.arc(explosion.x, explosion.y, currentSize, 0, Math.PI * 2)
      ctx.fill()
      
      // 内圈
      const innerGradient = ctx.createRadialGradient(explosion.x, explosion.y, 0, explosion.x, explosion.y, currentSize * 0.5)
      innerGradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
      innerGradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.8)')
      innerGradient.addColorStop(1, 'rgba(255, 255, 0, 0)')
      
      ctx.fillStyle = innerGradient
      ctx.beginPath()
      ctx.arc(explosion.x, explosion.y, currentSize * 0.5, 0, Math.PI * 2)
      ctx.fill()
      
      ctx.restore()

      // 绘制爆炸粒子
      explosion.particles.forEach((particle) => {
        ctx.save()
        ctx.globalAlpha = particle.life / particle.maxLife
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      })
    })
  }


  // 工具方法
  private createGradient(ctx: CanvasRenderingContext2D, color1: string, color2: string, x1: number, y1: number, x2: number, y2: number): CanvasGradient {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
    gradient.addColorStop(0, color1)
    gradient.addColorStop(1, color2)
    return gradient
  }

  private darkenColor(color: string): string {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgb(${Math.floor(r * 0.6)}, ${Math.floor(g * 0.6)}, ${Math.floor(b * 0.6)})`
    }
    return color
  }

  private lightenColor(color: string): string {
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgb(${Math.min(255, Math.floor(r * 1.4))}, ${Math.min(255, Math.floor(g * 1.4))}, ${Math.min(255, Math.floor(b * 1.4))})`
    }
    return color
  }

  private hexToRgb(hex: string): string {
    if (hex.startsWith('#')) {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      return `${r}, ${g}, ${b}`
    }
    return '255, 255, 255'
  }
}
