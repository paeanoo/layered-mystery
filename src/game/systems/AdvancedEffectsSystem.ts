/**
 * 高级特效系统
 * 处理游戏中的各种视觉特效，包括粒子系统、屏幕特效等
 */

export interface ParticleEffect {
  id: string
  type: string
  x: number
  y: number
  particles: Particle[]
  life: number
  maxLife: number
  config: ParticleConfig
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  life: number
  maxLife: number
  color: string
  alpha: number
  rotation?: number
  rotationSpeed?: number
  gravity?: number
  friction?: number
  scale?: number
  scaleSpeed?: number
}

export interface ParticleConfig {
  count: number
  spread: number
  speed: { min: number; max: number }
  size: { min: number; max: number }
  life: { min: number; max: number }
  colors: string[]
  gravity?: number
  friction?: number
  fadeOut?: boolean
  scaleDown?: boolean
  rotate?: boolean
}

export interface ScreenEffect {
  type: 'shake' | 'flash' | 'fade' | 'blur' | 'chromatic'
  intensity: number
  duration: number
  remaining: number
  color?: string
}

export class AdvancedEffectsSystem {
  private particleEffects: Map<string, ParticleEffect> = new Map()
  private screenEffects: ScreenEffect[] = []
  private animationTime = 0

  constructor() {
    this.initializePresets()
  }

  private initializePresets() {
    // 预设的粒子效果配置将在这里定义
  }

  update(deltaTime: number) {
    this.animationTime += deltaTime
    this.updateParticleEffects(deltaTime)
    this.updateScreenEffects(deltaTime)
  }

  private updateParticleEffects(deltaTime: number) {
    this.particleEffects.forEach((effect, id) => {
      // 更新效果生命周期
      effect.life -= deltaTime
      
      // 更新粒子
      for (let i = effect.particles.length - 1; i >= 0; i--) {
        const particle = effect.particles[i]
        
        // 更新位置
        particle.x += particle.vx * deltaTime / 1000
        particle.y += particle.vy * deltaTime / 1000
        
        // 应用重力
        if (particle.gravity) {
          particle.vy += particle.gravity * deltaTime / 1000
        }
        
        // 应用摩擦
        if (particle.friction) {
          particle.vx *= Math.pow(particle.friction, deltaTime / 1000)
          particle.vy *= Math.pow(particle.friction, deltaTime / 1000)
        }
        
        // 更新旋转
        if (particle.rotation !== undefined && particle.rotationSpeed) {
          particle.rotation += particle.rotationSpeed * deltaTime / 1000
        }
        
        // 更新缩放
        if (particle.scale !== undefined && particle.scaleSpeed) {
          particle.scale += particle.scaleSpeed * deltaTime / 1000
          particle.scale = Math.max(0, particle.scale)
        }
        
        // 更新生命和透明度
        particle.life -= deltaTime
        particle.alpha = Math.max(0, particle.life / particle.maxLife)
        
        // 移除过期粒子
        if (particle.life <= 0) {
          effect.particles.splice(i, 1)
        }
      }
      
      // 移除过期效果
      if (effect.life <= 0 && effect.particles.length === 0) {
        this.particleEffects.delete(id)
      }
    })
  }

  private updateScreenEffects(deltaTime: number) {
    for (let i = this.screenEffects.length - 1; i >= 0; i--) {
      const effect = this.screenEffects[i]
      effect.remaining -= deltaTime
      
      if (effect.remaining <= 0) {
        this.screenEffects.splice(i, 1)
      }
    }
  }

  /**
   * 创建粒子效果
   */
  createParticleEffect(type: string, x: number, y: number, config?: Partial<ParticleConfig>): string {
    const effectId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const effectConfig = this.getEffectConfig(type, config)
    
    const effect: ParticleEffect = {
      id: effectId,
      type,
      x, y,
      particles: [],
      life: 3000, // 3秒默认生命周期
      maxLife: 3000,
      config: effectConfig
    }

    // 创建粒子
    for (let i = 0; i < effectConfig.count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = effectConfig.speed.min + Math.random() * (effectConfig.speed.max - effectConfig.speed.min)
      const size = effectConfig.size.min + Math.random() * (effectConfig.size.max - effectConfig.size.min)
      const life = effectConfig.life.min + Math.random() * (effectConfig.life.max - effectConfig.life.min)
      const color = effectConfig.colors[Math.floor(Math.random() * effectConfig.colors.length)]
      
      // 考虑扩散角度
      const spread = effectConfig.spread * (Math.PI / 180)
      const finalAngle = angle + (Math.random() - 0.5) * spread
      
      const particle: Particle = {
        x, y,
        vx: Math.cos(finalAngle) * speed,
        vy: Math.sin(finalAngle) * speed,
        size,
        life,
        maxLife: life,
        color,
        alpha: 1,
        gravity: effectConfig.gravity,
        friction: effectConfig.friction
      }
      
      if (effectConfig.rotate) {
        particle.rotation = Math.random() * Math.PI * 2
        particle.rotationSpeed = (Math.random() - 0.5) * 4
      }
      
      if (effectConfig.scaleDown) {
        particle.scale = 1
        particle.scaleSpeed = -1 / (life / 1000) // 在生命周期内缩放到0
      }
      
      effect.particles.push(particle)
    }

    this.particleEffects.set(effectId, effect)
    return effectId
  }

  private getEffectConfig(type: string, override?: Partial<ParticleConfig>): ParticleConfig {
    let baseConfig: ParticleConfig

    switch (type) {
      case 'hit_spark':
        baseConfig = {
          count: 8,
          spread: 360,
          speed: { min: 50, max: 150 },
          size: { min: 1, max: 3 },
          life: { min: 200, max: 500 },
          colors: ['#ffff00', '#ff8800', '#ffffff'],
          gravity: -100,
          friction: 0.95,
          fadeOut: true
        }
        break
      
      case 'blood_splatter':
        baseConfig = {
          count: 12,
          spread: 180,
          speed: { min: 30, max: 100 },
          size: { min: 2, max: 5 },
          life: { min: 500, max: 1200 },
          colors: ['#aa0000', '#cc0000', '#880000'],
          gravity: 200,
          friction: 0.8,
          fadeOut: true
        }
        break
      
      case 'magic_burst':
        baseConfig = {
          count: 15,
          spread: 360,
          speed: { min: 80, max: 180 },
          size: { min: 2, max: 6 },
          life: { min: 800, max: 1500 },
          colors: ['#8A2BE2', '#DDA0DD', '#ffffff'],
          gravity: -50,
          friction: 0.92,
          fadeOut: true,
          rotate: true
        }
        break
      
      case 'explosion_debris':
        baseConfig = {
          count: 25,
          spread: 360,
          speed: { min: 100, max: 300 },
          size: { min: 1, max: 4 },
          life: { min: 600, max: 1200 },
          colors: ['#ff4400', '#ff8800', '#ffaa00', '#444444'],
          gravity: 150,
          friction: 0.85,
          fadeOut: true,
          rotate: true
        }
        break
      
      case 'heal_sparkles':
        baseConfig = {
          count: 10,
          spread: 60,
          speed: { min: 20, max: 80 },
          size: { min: 1, max: 3 },
          life: { min: 1000, max: 2000 },
          colors: ['#00ff00', '#88ff88', '#ffffff'],
          gravity: -80,
          friction: 0.98,
          fadeOut: true,
          rotate: true
        }
        break
      
      case 'energy_discharge':
        baseConfig = {
          count: 20,
          spread: 360,
          speed: { min: 60, max: 200 },
          size: { min: 1, max: 4 },
          life: { min: 300, max: 800 },
          colors: ['#00ffff', '#0088ff', '#ffffff'],
          gravity: 0,
          friction: 0.9,
          fadeOut: true
        }
        break
      
      case 'dust_cloud':
        baseConfig = {
          count: 18,
          spread: 120,
          speed: { min: 20, max: 60 },
          size: { min: 3, max: 8 },
          life: { min: 1500, max: 3000 },
          colors: ['#888888', '#aaaaaa', '#666666'],
          gravity: -20,
          friction: 0.95,
          fadeOut: true,
          scaleDown: false
        }
        break

      case 'fire_burst':
        baseConfig = {
          count: 16,
          spread: 180,
          speed: { min: 40, max: 120 },
          size: { min: 2, max: 6 },
          life: { min: 400, max: 1000 },
          colors: ['#ff4400', '#ff8800', '#ffaa00', '#fff200'],
          gravity: -120,
          friction: 0.88,
          fadeOut: true,
          scaleDown: true
        }
        break

      case 'shadow_particles':
        baseConfig = {
          count: 20,
          spread: 360,
          speed: { min: 60, max: 150 },
          size: { min: 2, max: 5 },
          life: { min: 400, max: 800 },
          colors: ['#4400AA', '#8800FF', '#AA44FF'],
          gravity: -50,
          friction: 0.9,
          fadeOut: true,
          rotate: true
        }
        break

      default:
        baseConfig = {
          count: 10,
          spread: 360,
          speed: { min: 50, max: 100 },
          size: { min: 2, max: 4 },
          life: { min: 500, max: 1000 },
          colors: ['#ffffff'],
          fadeOut: true
        }
    }

    return { ...baseConfig, ...override }
  }

  /**
   * 创建屏幕效果
   */
  addScreenEffect(type: ScreenEffect['type'], intensity: number, duration: number, color?: string) {
    const effect: ScreenEffect = {
      type,
      intensity,
      duration,
      remaining: duration,
      color
    }
    
    this.screenEffects.push(effect)
  }

  /**
   * 绘制所有粒子效果
   */
  drawParticleEffects(ctx: CanvasRenderingContext2D) {
    this.particleEffects.forEach((effect) => {
      effect.particles.forEach((particle) => {
        ctx.save()
        
        ctx.globalAlpha = particle.alpha
        ctx.translate(particle.x, particle.y)
        
        if (particle.rotation !== undefined) {
          ctx.rotate(particle.rotation)
        }
        
        if (particle.scale !== undefined) {
          ctx.scale(particle.scale, particle.scale)
        }
        
        ctx.fillStyle = particle.color
        
        // 根据效果类型绘制不同形状
        switch (effect.type) {
          case 'hit_spark':
            this.drawSpark(ctx, particle.size)
            break
          case 'blood_splatter':
            this.drawBloodDrop(ctx, particle.size)
            break
          case 'magic_burst':
            this.drawMagicParticle(ctx, particle.size)
            break
          case 'explosion_debris':
            this.drawDebris(ctx, particle.size)
            break
          case 'heal_sparkles':
            this.drawSparkle(ctx, particle.size)
            break
          case 'energy_discharge':
            this.drawEnergyBolt(ctx, particle.size)
            break
          case 'dust_cloud':
            this.drawDustParticle(ctx, particle.size)
            break
          case 'fire_burst':
            this.drawFlame(ctx, particle.size)
            break
          default:
            ctx.beginPath()
            ctx.arc(0, 0, particle.size, 0, Math.PI * 2)
            ctx.fill()
        }
        
        ctx.restore()
      })
    })
  }

  /**
   * 应用屏幕效果
   */
  applyScreenEffects(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    this.screenEffects.forEach((effect) => {
      const progress = 1 - (effect.remaining / effect.duration)
      const currentIntensity = effect.intensity * (effect.remaining / effect.duration)
      
      switch (effect.type) {
        case 'shake':
          this.applyScreenShake(ctx, currentIntensity)
          break
        case 'flash':
          this.applyScreenFlash(ctx, canvas, currentIntensity, effect.color || '#ffffff')
          break
        case 'fade':
          this.applyScreenFade(ctx, canvas, currentIntensity, effect.color || '#000000')
          break
        case 'blur':
          this.applyScreenBlur(ctx, currentIntensity)
          break
        case 'chromatic':
          this.applyChromaticAberration(ctx, currentIntensity)
          break
      }
    })
  }

  // 粒子绘制方法
  private drawSpark(ctx: CanvasRenderingContext2D, size: number) {
    ctx.shadowColor = ctx.fillStyle as string
    ctx.shadowBlur = size * 2
    ctx.beginPath()
    ctx.moveTo(-size, 0)
    ctx.lineTo(size, 0)
    ctx.lineTo(0, -size)
    ctx.lineTo(0, size)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private drawBloodDrop(ctx: CanvasRenderingContext2D, size: number) {
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
    
    // 血滴形状
    ctx.beginPath()
    ctx.moveTo(0, -size)
    ctx.quadraticCurveTo(size * 0.7, -size * 0.3, 0, size)
    ctx.quadraticCurveTo(-size * 0.7, -size * 0.3, 0, -size)
    ctx.fill()
  }

  private drawMagicParticle(ctx: CanvasRenderingContext2D, size: number) {
    // 魔法星形
    ctx.shadowColor = ctx.fillStyle as string
    ctx.shadowBlur = size * 3
    
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
      const x = Math.cos(angle) * size
      const y = Math.sin(angle) * size
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
      
      const innerAngle = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2
      const innerX = Math.cos(innerAngle) * size * 0.4
      const innerY = Math.sin(innerAngle) * size * 0.4
      ctx.lineTo(innerX, innerY)
    }
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private drawDebris(ctx: CanvasRenderingContext2D, size: number) {
    // 不规则碎片
    ctx.beginPath()
    ctx.moveTo(-size, -size * 0.5)
    ctx.lineTo(size * 0.8, -size * 0.3)
    ctx.lineTo(size, size * 0.7)
    ctx.lineTo(-size * 0.6, size)
    ctx.closePath()
    ctx.fill()
  }

  private drawSparkle(ctx: CanvasRenderingContext2D, size: number) {
    ctx.shadowColor = ctx.fillStyle as string
    ctx.shadowBlur = size * 4
    
    // 十字形闪光
    ctx.lineWidth = size * 0.5
    ctx.strokeStyle = ctx.fillStyle as string
    ctx.beginPath()
    ctx.moveTo(-size, 0)
    ctx.lineTo(size, 0)
    ctx.moveTo(0, -size)
    ctx.lineTo(0, size)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  private drawEnergyBolt(ctx: CanvasRenderingContext2D, size: number) {
    ctx.shadowColor = ctx.fillStyle as string
    ctx.shadowBlur = size * 2
    
    // 闪电形状
    ctx.lineWidth = size * 0.3
    ctx.strokeStyle = ctx.fillStyle as string
    ctx.beginPath()
    ctx.moveTo(-size, -size * 0.5)
    ctx.lineTo(-size * 0.3, 0)
    ctx.lineTo(size * 0.3, -size * 0.3)
    ctx.lineTo(size, size * 0.8)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  private drawDustParticle(ctx: CanvasRenderingContext2D, size: number) {
    ctx.globalAlpha *= 0.6
    ctx.beginPath()
    ctx.arc(0, 0, size, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawFlame(ctx: CanvasRenderingContext2D, size: number) {
    // 火焰形状
    ctx.beginPath()
    ctx.moveTo(0, size)
    ctx.quadraticCurveTo(-size * 0.8, size * 0.2, -size * 0.3, -size * 0.5)
    ctx.quadraticCurveTo(0, -size, size * 0.3, -size * 0.5)
    ctx.quadraticCurveTo(size * 0.8, size * 0.2, 0, size)
    ctx.fill()
  }

  // 屏幕效果方法
  private applyScreenShake(ctx: CanvasRenderingContext2D, intensity: number) {
    const shakeX = (Math.random() - 0.5) * intensity * 2
    const shakeY = (Math.random() - 0.5) * intensity * 2
    ctx.translate(shakeX, shakeY)
  }

  private applyScreenFlash(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, intensity: number, color: string) {
    ctx.save()
    ctx.globalAlpha = intensity
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  private applyScreenFade(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, intensity: number, color: string) {
    ctx.save()
    ctx.globalAlpha = intensity
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  private applyScreenBlur(ctx: CanvasRenderingContext2D, intensity: number) {
    // 模糊效果需要在绘制前应用
    ctx.filter = `blur(${intensity}px)`
  }

  private applyChromaticAberration(ctx: CanvasRenderingContext2D, intensity: number) {
    // 色差效果的简单实现
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.translate(intensity, 0)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
    ctx.translate(-intensity * 2, 0)
    ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'
    ctx.restore()
  }

  /**
   * 便捷方法：创建击中效果
   */
  createHitEffect(x: number, y: number, isCrit: boolean = false) {
    if (isCrit) {
      this.createParticleEffect('hit_spark', x, y, {
        count: 15,
        colors: ['#ffff00', '#ff4400', '#ffffff'],
        size: { min: 2, max: 5 },
        speed: { min: 80, max: 200 }
      })
      // 移除暴击闪屏效果
      // this.addScreenEffect('flash', 0.3, 100, '#ffff00')
    } else {
      this.createParticleEffect('hit_spark', x, y)
    }
  }

  /**
   * 便捷方法：创建死亡效果
   */
  createDeathEffect(x: number, y: number, enemyType: string) {
    // 基础死亡粒子
    this.createParticleEffect('blood_splatter', x, y)
    
    // 根据敌人类型添加特殊效果
    switch (enemyType) {
      case 'energy':
        this.createParticleEffect('energy_discharge', x, y)
        break
      case 'magic':
        this.createParticleEffect('magic_burst', x, y)
        break
      case 'fire':
        this.createParticleEffect('fire_burst', x, y)
        break
      default:
        this.createParticleEffect('dust_cloud', x, y)
    }
  }

  /**
   * 便捷方法：创建爆炸效果
   */
  createExplosionEffect(x: number, y: number, size: number = 50) {
    this.createParticleEffect('explosion_debris', x, y, {
      count: Math.floor(size / 2),
      speed: { min: size * 2, max: size * 4 },
      size: { min: 2, max: size / 10 }
    })
    
    this.addScreenEffect('shake', size / 10, 200)
    // 移除闪屏效果
    // this.addScreenEffect('flash', 0.5, 150, '#ff8800')
  }

  /**
   * 便捷方法：创建治疗效果
   */
  createHealEffect(x: number, y: number) {
    this.createParticleEffect('heal_sparkles', x, y)
  }

  /**
   * 清理所有效果
   */
  clear() {
    this.particleEffects.clear()
    this.screenEffects.length = 0
  }

  /**
   * 获取当前效果数量（用于性能监控）
   */
  getEffectCount(): { particles: number; screens: number } {
    let particleCount = 0
    this.particleEffects.forEach(effect => {
      particleCount += effect.particles.length
    })
    
    return {
      particles: particleCount,
      screens: this.screenEffects.length
    }
  }
}
