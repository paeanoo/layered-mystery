/**
 * 高级视觉渲染系统
 * 提供精细、复杂的2D模型渲染
 */

export interface RenderContext {
  ctx: CanvasRenderingContext2D
  deltaTime: number
  gameTime: number
}

export interface AnimationFrame {
  frame: number
  duration: number
  effects?: string[]
}

export interface VisualEffect {
  type: string
  duration: number
  intensity: number
  color?: string
  particles?: ParticleConfig[]
}

export interface ParticleConfig {
  count: number
  speed: { min: number; max: number }
  size: { min: number; max: number }
  life: { min: number; max: number }
  color: string[]
  gravity?: number
  friction?: number
}

export class VisualRenderingSystem {
  private animationTime = 0
  private particleEffects: Map<string, any[]> = new Map()
  private telegraphs: Array<{
    type: 'circle' | 'cone' | 'line'
    x: number
    y: number
    radius?: number
    startAngle?: number
    endAngle?: number
    length?: number
    angle?: number
    color: string
    createdAt: number
    duration: number
  }> = []

  constructor() {
    this.initializeParticleSystems()
  }

  update(deltaTime: number) {
    this.animationTime += deltaTime
    this.updateParticles(deltaTime)
    // 清理过期预警
    const now = Date.now()
    this.telegraphs = this.telegraphs.filter(t => now - t.createdAt < t.duration)
  }

  // 更新玩家属性（用于测试功能）
  updatePlayerStats(playerStats: any) {
    // 这个方法主要用于同步玩家属性，实际渲染时会使用传入的参数
    // 这里可以添加一些需要缓存的属性更新逻辑
    console.log('玩家属性已更新:', playerStats)
  }

  private initializeParticleSystems() {
    this.particleEffects.set('spark', [])
    this.particleEffects.set('blood', [])
    this.particleEffects.set('magic', [])
    this.particleEffects.set('explosion', [])
    this.particleEffects.set('smoke', [])
  }

  // === 技能预警 API ===
  addTelegraphCircle(x: number, y: number, radius: number, duration: number, color = 'rgba(255,0,0,0.6)') {
    this.telegraphs.push({ type: 'circle', x, y, radius, color, createdAt: Date.now(), duration })
  }

  addTelegraphCone(x: number, y: number, startAngle: number, endAngle: number, radius: number, duration: number, color = 'rgba(255,80,0,0.5)') {
    this.telegraphs.push({ type: 'cone', x, y, startAngle, endAngle, radius, color, createdAt: Date.now(), duration })
  }

  addTelegraphLine(x: number, y: number, angle: number, length: number, duration: number, color = 'rgba(255,0,0,0.6)') {
    this.telegraphs.push({ type: 'line', x, y, angle, length, color, createdAt: Date.now(), duration })
  }

  drawTelegraphs(ctx: CanvasRenderingContext2D) {
    const now = Date.now()
    this.telegraphs.forEach(t => {
      const elapsed = now - t.createdAt
      const remain = Math.max(0, t.duration - elapsed)
      const alpha = Math.max(0.2, remain / t.duration) // 越接近结束越亮
      ctx.save()
      switch (t.type) {
        case 'circle': {
          if (!t.radius) { ctx.restore(); return }
          ctx.strokeStyle = this.applyAlpha(t.color, alpha)
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2)
          ctx.stroke()
          // 填充淡色
          ctx.fillStyle = this.applyAlpha(t.color, alpha * 0.2)
          ctx.beginPath()
          ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2)
          ctx.fill()
          break
        }
        case 'cone': {
          if (t.startAngle === undefined || t.endAngle === undefined || !t.radius) { ctx.restore(); return }
          ctx.fillStyle = this.applyAlpha(t.color, alpha * 0.3)
          ctx.beginPath()
          ctx.moveTo(t.x, t.y)
          ctx.arc(t.x, t.y, t.radius, t.startAngle, t.endAngle)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = this.applyAlpha(t.color, alpha)
          ctx.lineWidth = 2
          ctx.stroke()
          break
        }
        case 'line': {
          if (t.angle === undefined || !t.length) { ctx.restore(); return }
          ctx.strokeStyle = this.applyAlpha(t.color, alpha)
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(t.x, t.y)
          ctx.lineTo(t.x + Math.cos(t.angle) * t.length, t.y + Math.sin(t.angle) * t.length)
          ctx.stroke()
          break
        }
      }
      ctx.restore()
    })
  }

  private applyAlpha(color: string, alpha: number): string {
    // 支持 rgba 已带透明度的简单处理：用全局alpha叠加
    if (color.startsWith('rgba')) return color
    if (color.startsWith('#')) {
      // 简单转换为 rgba
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    return color
  }

  private updateParticles(deltaTime: number) {
    this.particleEffects.forEach((particles, type) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i]
        particle.life -= deltaTime
        particle.x += particle.vx * deltaTime / 1000
        particle.y += particle.vy * deltaTime / 1000
        
        if (particle.gravity) {
          particle.vy += particle.gravity * deltaTime / 1000
        }
        
        if (particle.friction) {
          particle.vx *= particle.friction
          particle.vy *= particle.friction
        }
        
        if (particle.life <= 0) {
          particles.splice(i, 1)
        }
      }
    })
  }

  /**
   * 绘制精细的玩家角色
   */
  drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, options?: {
    health?: number
    maxHealth?: number
    weapon?: string
    skin?: string
    animationState?: string
    effects?: VisualEffect[]
    lastAttackTime?: number  // 最后攻击时间，用于枪口闪烁同步
    weaponMode?: number  // 武器模式：0=高伤害，1=高攻速（形态大师）
  }) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)

    const animFrame = Math.floor(this.animationTime / 200) % 4
    const isMoving = options?.animationState === 'moving'
    const bobOffset = isMoving ? Math.sin(this.animationTime / 100) * 2 : 0

    // 绘制阴影
    this.drawShadow(ctx, 0, 3, 20)

    // 形态大师：根据模式绘制光环效果
    if (options?.weaponMode !== undefined) {
      this.drawWeaponModeAura(ctx, options.weaponMode)
    }

    // 绘制玩家身体
    this.drawPlayerBody(ctx, animFrame, bobOffset, options?.skin, options?.weaponMode)

    // 绘制武器
    this.drawPlayerWeapon(ctx, options?.weapon || 'rifle', animFrame, options?.lastAttackTime, options?.weaponMode)

    // 绘制状态效果
    if (options?.effects) {
      this.drawStatusEffects(ctx, options.effects)
    }

    // 绘制生命值装饰
    if (options?.health !== undefined && options?.maxHealth !== undefined) {
      this.drawPlayerHealthIndicator(ctx, options.health, options.maxHealth)
    }

    ctx.restore()
  }

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save()
    ctx.globalAlpha = 0.3
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.ellipse(x, y, size * 0.8, size * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  /**
   * 绘制武器模式光环（形态大师）
   */
  private drawWeaponModeAura(ctx: CanvasRenderingContext2D, weaponMode: number) {
    ctx.save()
    
    // 模式0（高伤害）：红色/橙色光环
    // 模式1（高攻速）：蓝色/青色光环
    const colors = weaponMode === 0 
      ? ['#FF0000', '#FF6600', '#FFAA00']  // 红色系
      : ['#00AAFF', '#00FF88', '#88FFFF']  // 蓝色系
    
    const pulse = Math.sin(this.animationTime / 200) * 0.3 + 0.7
    const radius = 25 + Math.sin(this.animationTime / 150) * 3
    
    // 外圈光环
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    gradient.addColorStop(0, `${colors[0]}00`)  // 中心透明
    gradient.addColorStop(0.5, `${colors[1]}${Math.floor(80 * pulse).toString(16).padStart(2, '0')}`)
    gradient.addColorStop(1, `${colors[2]}00`)  // 边缘透明
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.fill()
    
    // 内圈发光
    ctx.strokeStyle = colors[0]
    ctx.lineWidth = 2
    ctx.shadowColor = colors[0]
    ctx.shadowBlur = 8 * pulse
    ctx.beginPath()
    ctx.arc(0, 0, 22, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    ctx.restore()
  }

  // 精细化绘制辅助函数
  private drawDetailedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, 
                           baseColor: string, highlightColor?: string, shadowColor?: string, radius: number = 0) {
    // 绘制阴影
    if (shadowColor) {
      ctx.fillStyle = shadowColor
      ctx.beginPath()
      if (radius > 0) {
        this.drawRoundedRect(ctx, x + 1, y + 1, width, height, radius)
      } else {
        ctx.fillRect(x + 1, y + 1, width, height)
      }
      ctx.fill()
    }
    
    // 绘制主体
    ctx.fillStyle = baseColor
    ctx.beginPath()
    if (radius > 0) {
      this.drawRoundedRect(ctx, x, y, width, height, radius)
    } else {
      ctx.fillRect(x, y, width, height)
    }
    ctx.fill()
    
    // 绘制高光
    if (highlightColor) {
      const gradient = ctx.createLinearGradient(x, y, x, y + height * 0.3)
      gradient.addColorStop(0, highlightColor)
      gradient.addColorStop(1, 'transparent')
      ctx.fillStyle = gradient
      ctx.beginPath()
      if (radius > 0) {
        this.drawRoundedRect(ctx, x, y, width, height * 0.3, radius)
      } else {
        ctx.fillRect(x, y, width, height * 0.3)
      }
      ctx.fill()
    }
  }

  private drawPlayerBody(ctx: CanvasRenderingContext2D, animFrame: number, bobOffset: number, skin?: string, weaponMode?: number) {
    ctx.save()
    ctx.translate(0, bobOffset)
    
    // 启用高质量渲染
    ctx.imageSmoothingEnabled = true

    // 机甲装甲配色 - 金属质感
    // 形态大师：根据模式改变配色
    let armorColor = '#4A5568'    // 钛合金灰
    let accentColor = '#00D4FF'   // 青蓝色能源光
    let armorDark = '#2D3748'     // 深色装甲
    let armorLight = '#718096'    // 浅色装甲
    
    if (weaponMode !== undefined) {
      if (weaponMode === 0) {
        // 高伤害模式：红色/橙色系
        armorColor = '#5A3A3A'  // 深红灰
        accentColor = '#FF6600'  // 橙红色能源光
        armorDark = '#3A1A1A'
        armorLight = '#7A4A4A'
      } else {
        // 高攻速模式：蓝色/青色系
        armorColor = '#3A4A5A'  // 深蓝灰
        accentColor = '#00AAFF'  // 蓝色能源光
        armorDark = '#1A2A3A'
        armorLight = '#5A6A7A'
      }
    }

    // 超精细化主体机甲装甲 - 多层细节与纹理
    // 主体躯干基础层（带渐变和阴影）
    const bodyGradient = this.createGradient(ctx, armorLight, armorColor, 0, -20, 0, 20)
    ctx.fillStyle = bodyGradient
    this.drawRoundedRect(ctx, -10, -20, 20, 40, 4)
    
    // 主体阴影（左侧，多层阴影增强立体感）
    ctx.fillStyle = armorDark
    ctx.globalAlpha = 0.7
    this.drawRoundedRect(ctx, -10, -20, 4, 40, 4)
    ctx.globalAlpha = 0.4
    this.drawRoundedRect(ctx, -9, -19, 2, 38, 3)
    ctx.globalAlpha = 1
    
    // 主体高光（顶部和右侧，多层高光）
    const highlightGradient = this.createGradient(ctx, armorLight, 'transparent', 0, -20, 0, -8)
    ctx.fillStyle = highlightGradient
    this.drawRoundedRect(ctx, -8, -20, 16, 12, 3)
    
    // 顶部边缘高光
    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 0.3
    this.drawRoundedRect(ctx, -7, -20, 14, 2, 2)
    ctx.globalAlpha = 1
    
    const rightHighlightGradient = this.createGradient(ctx, armorLight, 'transparent', 8, -18, 8, 18)
    ctx.fillStyle = rightHighlightGradient
    this.drawRoundedRect(ctx, 6, -18, 4, 36, 2)
    
    // 右侧边缘高光
    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 0.2
    this.drawRoundedRect(ctx, 8, -16, 2, 32, 1)
    ctx.globalAlpha = 1
    
    // 金属质感纹理 - 细微划痕和磨损
    ctx.strokeStyle = armorDark
    ctx.lineWidth = 0.5
    ctx.globalAlpha = 0.3
    for (let i = 0; i < 8; i++) {
      const y = -18 + i * 5
      const xOffset = Math.sin(i * 0.5) * 2
      ctx.beginPath()
      ctx.moveTo(-8 + xOffset, y)
      ctx.lineTo(8 + xOffset, y + 1)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    
    // 装甲板接缝线（精细）
    ctx.strokeStyle = armorDark
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.6
    // 垂直接缝
    ctx.beginPath()
    ctx.moveTo(-5, -18)
    ctx.lineTo(-5, 18)
    ctx.moveTo(5, -18)
    ctx.lineTo(5, 18)
    ctx.stroke()
    // 水平接缝
    for (let i = 0; i < 4; i++) {
      const y = -15 + i * 10
      ctx.beginPath()
      ctx.moveTo(-9, y)
      ctx.lineTo(9, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // 超精细化胸部装甲板 - 多层装甲系统与装饰
    // 外层装甲板（带金属质感）
    const outerPlateGradient = this.createGradient(ctx, '#B8C5D1', '#9CA3AF', 0, -18, 0, 8)
    ctx.fillStyle = outerPlateGradient
    this.drawRoundedRect(ctx, -9, -18, 18, 28, 3)
    
    // 外层装甲板高光
    ctx.fillStyle = '#E5E7EB'
    ctx.globalAlpha = 0.4
    this.drawRoundedRect(ctx, -8, -18, 16, 8, 2)
    ctx.globalAlpha = 1
    
    // 中层装甲板
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', '#6B7280', 0, -16, 0, 6)
    this.drawRoundedRect(ctx, -8.5, -16, 17, 24, 2.5)
    
    // 内层装甲板（核心保护层）
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 0, -15, 0, 5)
    this.drawRoundedRect(ctx, -8, -15, 16, 22, 2)
    
    // 内层装甲板高光
    ctx.fillStyle = '#F3F4F6'
    ctx.globalAlpha = 0.3
    this.drawRoundedRect(ctx, -7, -15, 14, 6, 1.5)
    ctx.globalAlpha = 1
    
    // 装甲板细节线条和铆钉（增强版）
    ctx.strokeStyle = armorDark
    ctx.lineWidth = 1.2
    for (let i = 0; i < 3; i++) {
      const y = -12 + i * 8
      ctx.beginPath()
      ctx.moveTo(-7, y)
      ctx.lineTo(7, y)
      ctx.stroke()
      
      // 线条高光
      ctx.strokeStyle = '#E5E7EB'
      ctx.lineWidth = 0.5
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      ctx.moveTo(-7, y - 0.5)
      ctx.lineTo(7, y - 0.5)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.strokeStyle = armorDark
      ctx.lineWidth = 1.2
      
      // 铆钉装饰（多层，带高光）
      // 左铆钉阴影
      ctx.fillStyle = '#2D3748'
      ctx.beginPath()
      ctx.arc(-6, y + 0.5, 1.2, 0, Math.PI * 2)
      ctx.fill()
      // 左铆钉主体
      const rivetGradient = this.createGradient(ctx, '#6B7280', '#4A5568', -6, y - 1, -6, y + 1)
      ctx.fillStyle = rivetGradient
      ctx.beginPath()
      ctx.arc(-6, y, 1, 0, Math.PI * 2)
      ctx.fill()
      // 左铆钉高光
      ctx.fillStyle = '#9CA3AF'
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(-6, y - 0.3, 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      
      // 右铆钉阴影
      ctx.fillStyle = '#2D3748'
      ctx.beginPath()
      ctx.arc(6, y + 0.5, 1.2, 0, Math.PI * 2)
      ctx.fill()
      // 右铆钉主体
      ctx.fillStyle = rivetGradient
      ctx.beginPath()
      ctx.arc(6, y, 1, 0, Math.PI * 2)
      ctx.fill()
      // 右铆钉高光
      ctx.fillStyle = '#9CA3AF'
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(6, y - 0.3, 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    
    // 装甲板边缘装饰线
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 0.8
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.moveTo(-8, -17)
    ctx.lineTo(8, -17)
    ctx.moveTo(-8, 7)
    ctx.lineTo(8, 7)
    ctx.stroke()
    ctx.globalAlpha = 1
    
    // 装甲板标识/徽章位置（装饰性）
    ctx.fillStyle = accentColor
    ctx.globalAlpha = 0.2
    ctx.beginPath()
    ctx.arc(0, -10, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 0.5
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(0, -10, 3, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1

    // 超精细化能源线路系统 - 多层发光效果与动画
    // 能源线路基础层（较暗）
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 3
    ctx.globalAlpha = 0.3
    ctx.beginPath()
    ctx.moveTo(-7, -12)
    ctx.lineTo(7, -12)
    ctx.moveTo(-7, -2)
    ctx.lineTo(7, -2)
    ctx.moveTo(-7, 8)
    ctx.lineTo(7, 8)
    ctx.moveTo(0, -15)
    ctx.lineTo(0, 10)
    ctx.stroke()
    ctx.globalAlpha = 1
    
    // 主能源线路（带脉冲效果和发光）
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 8
    const pulse = Math.sin(this.animationTime / 200) * 0.3 + 0.7
    ctx.globalAlpha = pulse
    ctx.beginPath()
    ctx.moveTo(-7, -12)
    ctx.lineTo(7, -12)
    ctx.moveTo(-7, -2)
    ctx.lineTo(7, -2)
    ctx.moveTo(-7, 8)
    ctx.lineTo(7, 8)
    // 垂直连接线
    ctx.moveTo(0, -15)
    ctx.lineTo(0, 10)
    ctx.stroke()
    
    // 能源流动效果（沿线路移动的光点）
    const flowOffset = (this.animationTime / 50) % 14
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowBlur = 6
    ctx.globalAlpha = pulse * 0.8
    ctx.beginPath()
    ctx.arc(-7 + flowOffset, -12, 1.5, 0, Math.PI * 2)
    ctx.arc(-7 + (flowOffset * 0.7), -2, 1.5, 0, Math.PI * 2)
    ctx.arc(-7 + (flowOffset * 0.5), 8, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    
    // 能源节点（线路交叉点，多层发光）
    const nodePulse = Math.sin(this.animationTime / 150) * 0.2 + 0.8
    // 节点外圈
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 6
    ctx.globalAlpha = nodePulse * 0.6
    ctx.beginPath()
    ctx.arc(0, -12, 3, 0, Math.PI * 2)
    ctx.arc(0, -2, 3, 0, Math.PI * 2)
    ctx.arc(0, 8, 3, 0, Math.PI * 2)
    ctx.fill()
    
    // 节点中圈
    ctx.fillStyle = accentColor
    ctx.shadowBlur = 4
    ctx.globalAlpha = nodePulse
    ctx.beginPath()
    ctx.arc(0, -12, 2.5, 0, Math.PI * 2)
    ctx.arc(0, -2, 2.5, 0, Math.PI * 2)
    ctx.arc(0, 8, 2.5, 0, Math.PI * 2)
    ctx.fill()
    
    // 节点内核
    ctx.fillStyle = '#88EEFF'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(0, -12, 2, 0, Math.PI * 2)
    ctx.arc(0, -2, 2, 0, Math.PI * 2)
    ctx.arc(0, 8, 2, 0, Math.PI * 2)
    ctx.fill()
    
    // 节点核心亮点
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.arc(0, -12, 1, 0, Math.PI * 2)
    ctx.arc(0, -2, 1, 0, Math.PI * 2)
    ctx.arc(0, 8, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    
    // 能源线路连接器（小装饰）
    ctx.fillStyle = accentColor
    ctx.globalAlpha = 0.5
    for (let i = 0; i < 6; i++) {
      const x = -6 + i * 2.4
      ctx.beginPath()
      ctx.arc(x, -12, 0.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, -2, 0.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, 8, 0.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // 超精细化中央反应堆核心 - 多层发光效果与动态动画
    const corePulse = Math.sin(this.animationTime / 180) * 0.15 + 0.85
    
    // 最外圈能量环（扩散效果）
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 15
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.arc(0, -5, 7, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    
    // 外圈能量环（主环）
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2
    ctx.shadowBlur = 12
    ctx.globalAlpha = corePulse
    ctx.beginPath()
    ctx.arc(0, -5, 6, 0, Math.PI * 2)
    ctx.stroke()
    
    // 中圈能量（多层渐变）
    const coreGradient = ctx.createRadialGradient(0, -5, 0, 0, -5, 5)
    coreGradient.addColorStop(0, '#FFFFFF')
    coreGradient.addColorStop(0.3, '#88EEFF')
    coreGradient.addColorStop(0.7, accentColor)
    coreGradient.addColorStop(1, accentColor + '80')
    ctx.fillStyle = coreGradient
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(0, -5, 5, 0, Math.PI * 2)
    ctx.fill()
    
    // 内圈能量
    ctx.fillStyle = '#88EEFF'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(0, -5, 4, 0, Math.PI * 2)
    ctx.fill()
    
    // 内核高亮（脉冲）
    ctx.fillStyle = '#AAFFFF'
    ctx.shadowBlur = 6
    ctx.globalAlpha = corePulse
    ctx.beginPath()
    ctx.arc(0, -5, 3.5, 0, Math.PI * 2)
    ctx.fill()
    
    // 核心白点（最亮）
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(0, -5, 2.5, 0, Math.PI * 2)
    ctx.fill()
    
    // 核心超亮点（闪烁）
    const sparkle = Math.sin(this.animationTime / 80) > 0.5
    if (sparkle) {
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowBlur = 3
      ctx.beginPath()
      ctx.arc(0, -5, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    
    // 反应堆旋转能量环（多层，不同速度）
    const rotationAngle1 = this.animationTime / 100
    const rotationAngle2 = -this.animationTime / 120
    ctx.save()
    ctx.translate(0, -5)
    
    // 外层旋转环
    ctx.rotate(rotationAngle1)
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.2
    ctx.globalAlpha = 0.5
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(0, 0, 5.5, (i * Math.PI) / 3, (i * Math.PI) / 3 + Math.PI / 6)
      ctx.stroke()
    }
    
    // 内层旋转环（反向）
    ctx.rotate(rotationAngle2 - rotationAngle1)
    ctx.strokeStyle = '#88EEFF'
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.4
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.arc(0, 0, 4, (i * Math.PI) / 2, (i * Math.PI) / 2 + Math.PI / 4)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.restore()
    
    // 反应堆保护框架（装饰性）
    ctx.strokeStyle = armorDark
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    // 十字框架
    ctx.moveTo(-6, -5)
    ctx.lineTo(6, -5)
    ctx.moveTo(0, -11)
    ctx.lineTo(0, 1)
    ctx.stroke()
    // 框架连接点
    ctx.fillStyle = armorDark
    ctx.beginPath()
    ctx.arc(-6, -5, 1, 0, Math.PI * 2)
    ctx.arc(6, -5, 1, 0, Math.PI * 2)
    ctx.arc(0, -11, 1, 0, Math.PI * 2)
    ctx.arc(0, 1, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // 超精细化肩部装甲 - 多层结构与装饰细节
    // 左肩外层（带高光）
    const leftShoulderGradient = this.createGradient(ctx, '#E5E7EB', '#D1D5DB', -14, -18, -10, -18)
    ctx.fillStyle = leftShoulderGradient
    this.drawRoundedRect(ctx, -14, -18, 6, 12, 3)
    
    // 左肩外层高光
    ctx.fillStyle = '#F3F4F6'
    ctx.globalAlpha = 0.5
    this.drawRoundedRect(ctx, -13, -18, 4, 6, 2)
    ctx.globalAlpha = 1
    
    // 左肩中层
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', '#6B7280', -13.5, -17.5, -10.5, -17.5)
    this.drawRoundedRect(ctx, -13.5, -17.5, 5, 11, 2.5)
    
    // 左肩内层
    ctx.fillStyle = this.createGradient(ctx, armorColor, armorDark, -13, -17, -11, -17)
    this.drawRoundedRect(ctx, -13, -17, 4, 10, 2)
    
    // 左肩装饰线条
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 0.8
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.moveTo(-12, -16)
    ctx.lineTo(-12, -8)
    ctx.moveTo(-11, -15)
    ctx.lineTo(-11, -9)
    ctx.stroke()
    ctx.globalAlpha = 1
    
    // 左肩铆钉
    ctx.fillStyle = '#4A5568'
    ctx.beginPath()
    ctx.arc(-12.5, -15, 0.8, 0, Math.PI * 2)
    ctx.arc(-12.5, -10, 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6B7280'
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.arc(-12.5, -15, 0.5, 0, Math.PI * 2)
    ctx.arc(-12.5, -10, 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    
    // 右肩外层（带高光）
    const rightShoulderGradient = this.createGradient(ctx, '#E5E7EB', '#D1D5DB', 8, -18, 14, -18)
    ctx.fillStyle = rightShoulderGradient
    this.drawRoundedRect(ctx, 8, -18, 6, 12, 3)
    
    // 右肩外层高光
    ctx.fillStyle = '#F3F4F6'
    ctx.globalAlpha = 0.5
    this.drawRoundedRect(ctx, 9, -18, 4, 6, 2)
    ctx.globalAlpha = 1
    
    // 右肩中层
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', '#6B7280', 8.5, -17.5, 13.5, -17.5)
    this.drawRoundedRect(ctx, 8.5, -17.5, 5, 11, 2.5)
    
    // 右肩内层
    ctx.fillStyle = this.createGradient(ctx, armorColor, armorDark, 9, -17, 11, -17)
    this.drawRoundedRect(ctx, 9, -17, 4, 10, 2)
    
    // 右肩装饰线条
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 0.8
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.moveTo(12, -16)
    ctx.lineTo(12, -8)
    ctx.moveTo(11, -15)
    ctx.lineTo(11, -9)
    ctx.stroke()
    ctx.globalAlpha = 1
    
    // 右肩铆钉
    ctx.fillStyle = '#4A5568'
    ctx.beginPath()
    ctx.arc(12.5, -15, 0.8, 0, Math.PI * 2)
    ctx.arc(12.5, -10, 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#6B7280'
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.arc(12.5, -15, 0.5, 0, Math.PI * 2)
    ctx.arc(12.5, -10, 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // 精细化肩部推进器
    ctx.fillStyle = this.createGradient(ctx, '#4A5568', '#374151', -12, -15, -10, -15)
    this.drawRoundedRect(ctx, -12, -15, 2, 6, 1)
    ctx.fillStyle = this.createGradient(ctx, '#4A5568', '#374151', 10, -15, 12, -15)
    this.drawRoundedRect(ctx, 10, -15, 2, 6, 1)

    // 推进器发光效果（带脉冲）
    const thrusterPulse = Math.sin(this.animationTime / 150) * 0.4 + 0.6
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4 * thrusterPulse
    ctx.globalAlpha = thrusterPulse
    ctx.beginPath()
    ctx.arc(-11, -12, 1.5, 0, Math.PI * 2)
    ctx.arc(11, -12, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0

    // 精细化机甲头盔 - 多层装甲系统
    // 头盔外层
    const helmetGradient = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 0, -32, 0, -18)
    ctx.fillStyle = helmetGradient
    ctx.beginPath()
    ctx.ellipse(0, -26, 10, 9, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 头盔内层
    ctx.fillStyle = this.createGradient(ctx, armorColor, armorDark, 0, -30, 0, -22)
    ctx.beginPath()
    ctx.ellipse(0, -26, 8.5, 7.5, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 头盔顶部高光
    ctx.fillStyle = armorLight
    ctx.globalAlpha = 0.7
    ctx.beginPath()
    ctx.ellipse(0, -30, 8, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    
    // 精细化头盔能源线路
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    // 头盔顶部线路
    ctx.arc(0, -26, 7, 0, Math.PI)
    // 侧面线路
    ctx.moveTo(-6, -26)
    ctx.lineTo(-3, -23)
    ctx.moveTo(6, -26)
    ctx.lineTo(3, -23)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 精细化面罩 - 多层结构
    // 面罩外层
    ctx.fillStyle = '#1F2937'
    ctx.globalAlpha = 0.95
    ctx.beginPath()
    ctx.ellipse(0, -24, 6, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // 面罩边框（带高光）
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(0, -24, 6, 4, 0, 0, Math.PI * 2)
    ctx.stroke()
    
    // 面罩内层反光
    ctx.fillStyle = '#2D3748'
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.ellipse(0, -24, 5, 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // 精细化眼部发光系统 - 多层发光
    // 左眼外圈
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.ellipse(-2.5, -24, 2, 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 左眼内圈
    ctx.fillStyle = '#88EEFF'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.ellipse(-2.5, -24, 1.2, 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 左眼内核
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(-2.5, -24, 0.8, 0, Math.PI * 2)
    ctx.fill()
    
    // 右眼外圈
    ctx.fillStyle = accentColor
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.ellipse(2.5, -24, 2, 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 右眼内圈
    ctx.fillStyle = '#88EEFF'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.ellipse(2.5, -24, 1.2, 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 右眼内核
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(2.5, -24, 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 精细化HUD扫描线 - 动态效果
    if (Math.sin(this.animationTime / 150) > 0) {
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.moveTo(-5, -24)
      ctx.lineTo(5, -24)
      ctx.moveTo(-4, -22)
      ctx.lineTo(4, -22)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // 超精细化头盔侧面通风口 - 多层结构与细节
    // 通风口外框
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.6
    for (let i = 0; i < 3; i++) {
      const y = -28 + i * 2
      ctx.strokeRect(-8.5, y - 0.5, 3, 2)
      ctx.strokeRect(5.5, y - 0.5, 3, 2)
    }
    ctx.globalAlpha = 1
    
    // 通风口主体（多层）
    for (let i = 0; i < 3; i++) {
      const y = -28 + i * 2
      // 左通风口
      ctx.fillStyle = '#374151'
      this.drawRoundedRect(ctx, -8, y, 2, 1, 0.5)
      ctx.fillStyle = '#4A5568'
      ctx.globalAlpha = 0.7
      this.drawRoundedRect(ctx, -7.8, y + 0.1, 1.6, 0.8, 0.3)
      ctx.globalAlpha = 1
      // 通风口内部细节
      ctx.strokeStyle = '#1F2937'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(-7.5, y)
      ctx.lineTo(-7.5, y + 1)
      ctx.moveTo(-7, y)
      ctx.lineTo(-7, y + 1)
      ctx.moveTo(-6.5, y)
      ctx.lineTo(-6.5, y + 1)
      ctx.stroke()
      
      // 右通风口
      ctx.fillStyle = '#374151'
      this.drawRoundedRect(ctx, 6, y, 2, 1, 0.5)
      ctx.fillStyle = '#4A5568'
      ctx.globalAlpha = 0.7
      this.drawRoundedRect(ctx, 6.2, y + 0.1, 1.6, 0.8, 0.3)
      ctx.globalAlpha = 1
      // 通风口内部细节
      ctx.beginPath()
      ctx.moveTo(6.5, y)
      ctx.lineTo(6.5, y + 1)
      ctx.moveTo(7, y)
      ctx.lineTo(7, y + 1)
      ctx.moveTo(7.5, y)
      ctx.lineTo(7.5, y + 1)
      ctx.stroke()
    }
    
    // 头盔侧面警告标识（装饰性）
    ctx.fillStyle = '#FF4444'
    ctx.globalAlpha = 0.6
    ctx.beginPath()
    ctx.arc(-9, -25, 0.8, 0, Math.PI * 2)
    ctx.arc(9, -25, 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = '#FF6666'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.arc(-9, -25, 0.8, 0, Math.PI * 2)
    ctx.arc(9, -25, 0.8, 0, Math.PI * 2)
    ctx.stroke()

    // 绘制像素风格装甲四肢
    this.drawPlayerLimbs(ctx, animFrame, bobOffset)

    ctx.restore()
  }

  private drawPlayerLimbs(ctx: CanvasRenderingContext2D, animFrame: number, bobOffset: number) {
    const limbOffset = Math.sin(this.animationTime / 150) * 2
    const armorColor = '#4A5568'
    const accentColor = '#00D4FF'
    
    // 精细化左臂机甲装甲
    ctx.save()
    ctx.rotate(Math.sin(this.animationTime / 200) * 0.08)
    
    // 上臂装甲（多层结构）
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, -20, -12, -10, -12)
    this.drawRoundedRect(ctx, -20, -12, 14, 7, 2)
    
    // 上臂内层
    ctx.fillStyle = this.createGradient(ctx, armorColor, '#2D3748', -19, -11, -11, -11)
    this.drawRoundedRect(ctx, -19, -11, 12, 5, 1)
    
    // 前臂装甲（多层结构）
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', -18, -8, -10, -8)
    this.drawRoundedRect(ctx, -18, -8, 10, 5, 2)
    
    // 前臂内层
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, -17, -7, -11, -7)
    this.drawRoundedRect(ctx, -17, -7, 8, 3, 1)
    
    // 精细化能源管道（带发光效果）
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.moveTo(-18, -9)
    ctx.lineTo(-10, -9)
    ctx.moveTo(-16, -6)
    ctx.lineTo(-12, -6)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 能源节点
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.arc(-14, -9, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 精细化机甲手部
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', -22, -6, -18, -6)
    this.drawRoundedRect(ctx, -22, -6, 6, 4, 1)
    
    // 手部内层
    ctx.fillStyle = this.createGradient(ctx, '#374151', '#1F2937', -21, -5, -19, -5)
    this.drawRoundedRect(ctx, -21, -5, 4, 2, 0.5)
    
    // 手部发光能源（带脉冲）
    const handPulse = Math.sin(this.animationTime / 120) * 0.3 + 0.7
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4 * handPulse
    ctx.globalAlpha = handPulse
    ctx.beginPath()
    ctx.arc(-19, -4, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    ctx.restore()
    
    // 精细化右臂机甲装甲
    ctx.save()
    ctx.rotate(-Math.sin(this.animationTime / 200) * 0.08)
    
    // 上臂装甲（多层结构）
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 6, -12, 20, -12)
    this.drawRoundedRect(ctx, 6, -12, 14, 7, 2)
    
    // 上臂内层
    ctx.fillStyle = this.createGradient(ctx, armorColor, '#2D3748', 7, -11, 19, -11)
    this.drawRoundedRect(ctx, 7, -11, 12, 5, 1)
    
    // 前臂装甲（多层结构）
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 8, -8, 18, -8)
    this.drawRoundedRect(ctx, 8, -8, 10, 5, 2)
    
    // 前臂内层
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 9, -7, 17, -7)
    this.drawRoundedRect(ctx, 9, -7, 8, 3, 1)
    
    // 精细化能源管道（带发光效果）
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.moveTo(10, -9)
    ctx.lineTo(18, -9)
    ctx.moveTo(12, -6)
    ctx.lineTo(16, -6)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 能源节点
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.arc(14, -9, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 精细化机甲手部
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 16, -6, 22, -6)
    this.drawRoundedRect(ctx, 16, -6, 6, 4, 1)
    
    // 手部内层
    ctx.fillStyle = this.createGradient(ctx, '#374151', '#1F2937', 17, -5, 21, -5)
    this.drawRoundedRect(ctx, 17, -5, 4, 2, 0.5)
    
    // 手部发光能源（带脉冲）
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4 * handPulse
    ctx.globalAlpha = handPulse
    ctx.beginPath()
    ctx.arc(19, -4, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    ctx.restore()
    
    // 精细化机甲腿部装甲
    // 左大腿装甲（多层结构）
    const leftThighHeight = 15 + Math.abs(limbOffset * 0.3)
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, -6, 18, -6, 18 + leftThighHeight)
    this.drawRoundedRect(ctx, -6, 18, 5, leftThighHeight, 2)
    
    // 左大腿内层
    ctx.fillStyle = this.createGradient(ctx, armorColor, '#2D3748', -5, 19, -3, 19 + leftThighHeight - 2)
    this.drawRoundedRect(ctx, -5, 19, 3, leftThighHeight - 2, 1)
    
    // 右大腿装甲（多层结构）
    const rightThighHeight = 15 - Math.abs(limbOffset * 0.3)
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 1, 18, 1, 18 + rightThighHeight)
    this.drawRoundedRect(ctx, 1, 18, 5, rightThighHeight, 2)
    
    // 右大腿内层
    ctx.fillStyle = this.createGradient(ctx, armorColor, '#2D3748', 2, 19, 4, 19 + rightThighHeight - 2)
    this.drawRoundedRect(ctx, 2, 19, 3, rightThighHeight - 2, 1)
    
    // 左小腿装甲（多层结构）
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', '#D1D5DB', -5, 30 + limbOffset * 0.3, -1, 30 + limbOffset * 0.3 + 8)
    this.drawRoundedRect(ctx, -5, 30 + limbOffset * 0.3, 4, 8, 2)
    
    // 左小腿内层
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', -4, 31 + limbOffset * 0.3, -2, 31 + limbOffset * 0.3 + 6)
    this.drawRoundedRect(ctx, -4, 31 + limbOffset * 0.3, 2, 6, 1)
    
    // 右小腿装甲（多层结构）
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', '#D1D5DB', 2, 30 - limbOffset * 0.3, 6, 30 - limbOffset * 0.3 + 8)
    this.drawRoundedRect(ctx, 2, 30 - limbOffset * 0.3, 4, 8, 2)
    
    // 右小腿内层
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 2, 31 - limbOffset * 0.3, 4, 31 - limbOffset * 0.3 + 6)
    this.drawRoundedRect(ctx, 2, 31 - limbOffset * 0.3, 2, 6, 1)
    
    // 精细化腿部能源线路（带发光）
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.moveTo(-3, 22)
    ctx.lineTo(-3, 32)
    ctx.moveTo(3, 22)
    ctx.lineTo(3, 32)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 精细化机甲靴（多层结构）
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', -7, 36 + limbOffset, -1, 36 + limbOffset + 4)
    this.drawRoundedRect(ctx, -7, 36 + limbOffset, 6, 4, 2)
    
    // 左靴内层
    ctx.fillStyle = this.createGradient(ctx, '#374151', '#1F2937', -6, 37 + limbOffset, -2, 37 + limbOffset + 2)
    this.drawRoundedRect(ctx, -6, 37 + limbOffset, 4, 2, 1)
    
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 1, 36 - limbOffset, 7, 36 - limbOffset + 4)
    this.drawRoundedRect(ctx, 1, 36 - limbOffset, 6, 4, 2)
    
    // 右靴内层
    ctx.fillStyle = this.createGradient(ctx, '#374151', '#1F2937', 2, 37 - limbOffset, 6, 37 - limbOffset + 2)
    this.drawRoundedRect(ctx, 2, 37 - limbOffset, 4, 2, 1)
    
    // 精细化靴底推进器（带发光效果）
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.ellipse(-4, 40 + limbOffset, 2.5, 1.5, 0, 0, Math.PI * 2)
    ctx.ellipse(4, 40 - limbOffset, 2.5, 1.5, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 推进器内核
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.ellipse(-4, 40 + limbOffset, 1.2, 0.8, 0, 0, Math.PI * 2)
    ctx.ellipse(4, 40 - limbOffset, 1.2, 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 推进器发光效果（动态脉冲）
    if (Math.sin(this.animationTime / 100) > 0.5) {
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = '#FFFFFF'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(-4, 40 + limbOffset, 1, 0, Math.PI * 2)
      ctx.arc(4, 40 - limbOffset, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  private drawPlayerWeapon(ctx: CanvasRenderingContext2D, weaponType: string, animFrame: number, lastAttackTime?: number, weaponMode?: number) {
    ctx.save()
    
    const recoilOffset = Math.sin(this.animationTime / 50) * 0.5
    ctx.translate(recoilOffset, 0)

    // 形态大师：根据模式调整武器大小和颜色
    const weaponScale = weaponMode === 0 ? 1.2 : (weaponMode === 1 ? 0.9 : 1.0)  // 高伤害模式武器更大，高攻速模式武器更小
    const weaponColor = weaponMode === 0 ? '#FF6600' : (weaponMode === 1 ? '#00AAFF' : undefined)
    
    if (weaponScale !== 1.0) {
      ctx.save()
      ctx.scale(weaponScale, weaponScale)
    }
    
    switch (weaponType) {
      case 'rifle':
        this.drawRifle(ctx, lastAttackTime, weaponColor)
        break
      case 'smg':
      case 'submachine_gun':
        this.drawSMG(ctx, lastAttackTime, weaponColor)
        break
      case 'shotgun':
        this.drawShotgun(ctx, lastAttackTime, weaponColor)
        break
      case 'sniper':
        this.drawSniperRifle(ctx, lastAttackTime, weaponColor)
        break
      case 'bow':
        this.drawBow(ctx, lastAttackTime, weaponColor)
        break
      case 'talisman_sword':
        this.drawTalismanSword(ctx, lastAttackTime, weaponColor)
        break
      case 'laser_gun':
        this.drawLaserGun(ctx, lastAttackTime, weaponColor)
        break
      default:
        this.drawLaserGun(ctx, lastAttackTime, weaponColor)  // 默认武器改为激光枪
    }
    
    if (weaponScale !== 1.0) {
      ctx.restore()
    }

    ctx.restore()
  }

  private drawRifle(ctx: CanvasRenderingContext2D, lastAttackTime?: number, weaponColor?: string) {
    // 枪身
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(8, -2, 30, 4)
    
    // 枪管
    ctx.fillStyle = '#34495e'
    ctx.fillRect(35, -1, 15, 2)
    
    // 瞄准镜
    ctx.strokeStyle = '#7f8c8d'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(20, -4, 3, 0, Math.PI * 2)
    ctx.stroke()
    
    // 扳机护圈
    ctx.strokeStyle = '#2c3e50'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(12, 2, 3, 0, Math.PI)
    ctx.stroke()
    
    // 枪口闪光 - 基于实际射击时机
    const currentTime = Date.now()
    if (lastAttackTime && (currentTime - lastAttackTime) < 100) {
      this.drawMuzzleFlash(ctx, 50, 0)
    }
  }

  private drawShotgun(ctx: CanvasRenderingContext2D, lastAttackTime?: number, weaponColor?: string) {
    // 更粗的枪身
    ctx.fillStyle = '#8b4513'
    ctx.fillRect(8, -3, 25, 6)
    
    // 双管
    ctx.fillStyle = '#654321'
    ctx.fillRect(30, -2, 12, 2)
    ctx.fillRect(30, 1, 12, 2)
    
    // 装饰
    ctx.strokeStyle = '#daa520'
    ctx.lineWidth = 1
    ctx.strokeRect(8, -3, 25, 6)
  }
  
  private drawSMG(ctx: CanvasRenderingContext2D, lastAttackTime?: number, weaponColor?: string) {
    // 未来风格冲锋枪主体
    const mainGradient = ctx.createLinearGradient(0, -2, 0, 2)
    mainGradient.addColorStop(0, '#2c3e50')
    mainGradient.addColorStop(1, '#34495e')
    
    ctx.fillStyle = mainGradient
    ctx.fillRect(8, -2, 22, 4)
    
    // 枪管
    ctx.fillStyle = '#1a252f'
    ctx.fillRect(28, -1, 10, 2)
    
    // 科技线条装饰
    ctx.strokeStyle = '#3498db'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(10, -1)
    ctx.lineTo(26, -1)
    ctx.moveTo(10, 1)
    ctx.lineTo(26, 1)
    ctx.stroke()
    
    // 瞄准装置
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(18, -3, 2, 0, Math.PI * 2)
    ctx.stroke()
    
    // 枪口闪光抑制器
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(36, -1.5, 3, 3)
    
    // 科技发光点
    ctx.fillStyle = '#00ffff'
    ctx.beginPath()
    ctx.arc(15, 0, 0.5, 0, Math.PI * 2)
    ctx.arc(23, 0, 0.5, 0, Math.PI * 2)
    ctx.fill()
    
    // 扳机护圈
    ctx.strokeStyle = '#2c3e50'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(12, 2, 2, 0, Math.PI)
    ctx.stroke()
    
    // 枪口闪光效果 - 基于实际射击时机
    const currentTime = Date.now()
    if (lastAttackTime && (currentTime - lastAttackTime) < 100) {
      this.drawMuzzleFlash(ctx, 39, 0)
    }
  }
  
  private drawTalismanSword(ctx: CanvasRenderingContext2D, lastAttackTime?: number, weaponColor?: string) {
    // 桃木剑柄
    ctx.fillStyle = '#CD853F'
    ctx.fillRect(8, -1, 12, 2)
    
    // 剑柄缠绕的红绳
    ctx.strokeStyle = '#DC143C'
    ctx.lineWidth = 1
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * 2
      ctx.beginPath()
      ctx.arc(x, Math.sin(i) * 0.5, 0.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    
    // 桃木剑身
    const swordGradient = ctx.createLinearGradient(0, -3, 0, 3)
    swordGradient.addColorStop(0, '#DEB887')
    swordGradient.addColorStop(0.5, '#F5DEB3')
    swordGradient.addColorStop(1, '#DEB887')
    
    ctx.fillStyle = swordGradient
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.lineTo(18, -3)
    ctx.lineTo(35, -2)
    ctx.lineTo(40, 0)
    ctx.lineTo(35, 2)
    ctx.lineTo(18, 3)
    ctx.closePath()
    ctx.fill()
    
    // 剑身上的符文
    ctx.font = '8px serif'
    ctx.fillStyle = '#8B0000'
    ctx.textAlign = 'center'
    const talismanChars = ['雷', '火', '煞']
    for (let i = 0; i < 3; i++) {
      ctx.fillText(talismanChars[i], 22 + i * 5, 1)
    }
    
    // 剑身中央的血槽
    ctx.strokeStyle = '#8B0000'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(20, 0)
    ctx.lineTo(38, 0)
    ctx.stroke()
    
    // 护手
    ctx.fillStyle = '#B8860B'
    ctx.fillRect(18, -4, 2, 8)
    
    // 剑穗
    ctx.strokeStyle = '#FF6347'
    ctx.lineWidth = 1
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.moveTo(8 - i, 0)
      ctx.lineTo(4 - i, Math.sin(this.animationTime / 100 + i) * 3)
      ctx.stroke()
    }
    
    // 符纸效果（随机飘动）
    if (Math.random() < 0.1) {
      ctx.save()
      ctx.globalAlpha = 0.8
      ctx.fillStyle = '#FFFACD'
      const talismanX = 25 + Math.sin(this.animationTime / 200) * 2
      const talismanY = -5 + Math.sin(this.animationTime / 150) * 3
      ctx.fillRect(talismanX - 2, talismanY - 3, 4, 6)
      
      ctx.strokeStyle = '#DC143C'
      ctx.lineWidth = 1
      ctx.strokeRect(talismanX - 2, talismanY - 3, 4, 6)
      
      ctx.font = '6px serif'
      ctx.fillStyle = '#DC143C'
      ctx.textAlign = 'center'
      ctx.fillText('符', talismanX, talismanY + 1)
      ctx.restore()
    }
  }
  
  private drawLaserGun(ctx: CanvasRenderingContext2D, lastAttackTime?: number, weaponColor?: string) {
    // 激光枪主体 - 科技感设计
    const mainGradient = ctx.createLinearGradient(0, -3, 0, 3)
    mainGradient.addColorStop(0, '#2c3e50')
    mainGradient.addColorStop(0.5, '#34495e')
    mainGradient.addColorStop(1, '#2c3e50')
    
    ctx.fillStyle = mainGradient
    ctx.fillRect(8, -3, 25, 6)
    
    // 激光枪握把
    ctx.fillStyle = '#1a252f'
    ctx.fillRect(8, 2, 8, 6)
    ctx.fillRect(10, 8, 4, 3)
    
    // 激光枪枪管 - 发光效果
    const barrelGradient = ctx.createLinearGradient(0, -2, 0, 2)
    barrelGradient.addColorStop(0, '#00ffff')
    barrelGradient.addColorStop(0.5, '#0088ff')
    barrelGradient.addColorStop(1, '#00ffff')
    
    ctx.fillStyle = barrelGradient
    ctx.fillRect(32, -2, 12, 4)
    
    // 激光枪科技装饰
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 1
    ctx.beginPath()
    // 枪身线条
    ctx.moveTo(10, -2)
    ctx.lineTo(30, -2)
    ctx.moveTo(10, 2)
    ctx.lineTo(30, 2)
    
    // 科技格栅
    for (let i = 0; i < 4; i++) {
      const x = 12 + i * 5
      ctx.moveTo(x, -1)
      ctx.lineTo(x, 1)
    }
    ctx.stroke()
    
    // 瞄准器
    ctx.strokeStyle = '#3498db'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(20, -5, 2, 0, Math.PI)
    ctx.stroke()
    
    // 能量指示灯
    ctx.fillStyle = '#00ff00'
    ctx.shadowColor = '#00ff00'
    ctx.shadowBlur = 3
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(15 + i * 4, -4, 1, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0
    
    // 激光发射口发光效果 - 基于实际射击时机
    const currentTime = Date.now()
    if (lastAttackTime && (currentTime - lastAttackTime) < 150) {
      this.drawLaserMuzzle(ctx, 44, 0)
    }
    
    // 符文科技融合 - 在枪身上刻中文
    ctx.font = '6px serif'
    ctx.fillStyle = '#00ffff'
    ctx.textAlign = 'center'
    ctx.fillText('激', 18, 1)
    ctx.fillText('光', 26, 1)
  }
  
  private drawLaserMuzzle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save()
    
    // 激光发射口的强烈白光
    ctx.fillStyle = '#ffffff'
    ctx.shadowColor = '#00ffff'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
    
    // 激光束预览
    ctx.strokeStyle = '#00ffff'
    ctx.shadowColor = '#00ffff'
    ctx.shadowBlur = 5
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 15, y)
    ctx.stroke()
    
    // 能量波动效果
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(x, y, 5 + Math.sin(this.animationTime / 50) * 2, 0, Math.PI * 2)
    ctx.stroke()
    
    ctx.shadowBlur = 0
    ctx.restore()
  }

  private drawSniperRifle(ctx: CanvasRenderingContext2D, lastAttackTime?: number, weaponColor?: string) {
    // 长枪身
    ctx.fillStyle = '#2c3e50'
    ctx.fillRect(8, -2, 40, 4)
    
    // 长枪管
    ctx.fillStyle = '#34495e'
    ctx.fillRect(45, -1, 20, 2)
    
    // 大瞄准镜
    ctx.strokeStyle = '#7f8c8d'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(25, -6, 5, 0, Math.PI * 2)
    ctx.stroke()
    
    // 支撑脚架
    ctx.strokeStyle = '#2c3e50'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(35, 2)
    ctx.lineTo(32, 8)
    ctx.moveTo(35, 2)
    ctx.lineTo(38, 8)
    ctx.stroke()
  }

  private drawBow(ctx: CanvasRenderingContext2D, lastAttackTime?: number, weaponColor?: string) {
    // 弓身
    ctx.strokeStyle = '#8b4513'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(25, 0, 20, -Math.PI/3, Math.PI/3, false)
    ctx.stroke()
    
    // 弓弦
    const bowString = Math.sin(this.animationTime / 200) * 2
    ctx.strokeStyle = '#f4f4f4'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(15, -15)
    ctx.quadraticCurveTo(8 + bowString, 0, 15, 15)
    ctx.stroke()
    
    // 箭
    if (Math.random() < 0.2) {
      ctx.strokeStyle = '#8b4513'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(8, 0)
      ctx.lineTo(40, 0)
      ctx.stroke()
      
      // 箭头
      ctx.fillStyle = '#c0c0c0'
      ctx.beginPath()
      ctx.moveTo(40, 0)
      ctx.lineTo(35, -3)
      ctx.lineTo(35, 3)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawMuzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save()
    ctx.globalAlpha = 0.8
    
    const flashSize = 8 + Math.random() * 4
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, flashSize)
    gradient.addColorStop(0, '#ffffff')
    gradient.addColorStop(0.3, '#ffff00')
    gradient.addColorStop(0.6, '#ff8800')
    gradient.addColorStop(1, '#ff4400')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, flashSize, 0, Math.PI * 2)
    ctx.fill()
    
    // 添加火花粒子
    this.createParticles('spark', x, y, {
      count: 5,
      speed: { min: 50, max: 150 },
      size: { min: 1, max: 3 },
      life: { min: 100, max: 300 },
      color: ['#ffff00', '#ff8800', '#ffffff']
    })
    
    ctx.restore()
  }

  private drawPlayerHealthIndicator(ctx: CanvasRenderingContext2D, health: number, maxHealth: number) {
    const healthPercent = health / maxHealth
    
    // 健康光环效果
    if (healthPercent > 0.7) {
      ctx.save()
      ctx.globalAlpha = 0.3
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, 25 + Math.sin(this.animationTime / 300) * 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    } else if (healthPercent < 0.3) {
      // 危险效果
      ctx.save()
      ctx.globalAlpha = 0.5 + Math.sin(this.animationTime / 200) * 0.3
      ctx.strokeStyle = '#ff0000'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(0, 0, 28, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  private drawStatusEffects(ctx: CanvasRenderingContext2D, effects: VisualEffect[]) {
    effects.forEach((effect, index) => {
      const angle = (index / effects.length) * Math.PI * 2 + this.animationTime / 1000
      const radius = 30
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      
      ctx.save()
      ctx.translate(x, y)
      ctx.globalAlpha = 0.8
      
      switch (effect.type) {
        case 'speed_boost':
          this.drawSpeedBoostEffect(ctx)
          break
        case 'damage_boost':
          this.drawDamageBoostEffect(ctx)
          break
        case 'shield':
          this.drawShieldEffect(ctx)
          break
      }
      
      ctx.restore()
    })
  }

  private drawSpeedBoostEffect(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 2
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(0, 0, 3 + i * 2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  private drawDamageBoostEffect(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#ff4444'
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const x = Math.cos(angle) * 4
      const y = Math.sin(angle) * 4
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }

  private drawShieldEffect(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = '#88ffff'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(0, 0, 5, 0, Math.PI * 2)
    ctx.stroke()
  }

  private createGradient(ctx: CanvasRenderingContext2D, color1: string, color2: string, x1: number, y1: number, x2: number, y2: number): CanvasGradient {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
    gradient.addColorStop(0, color1)
    gradient.addColorStop(1, color2)
    return gradient
  }

  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.fill()
  }

  private darkenColor(color: string): string {
    // 简单的颜色变暗函数
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      
      const factor = 0.7
      const newR = Math.floor(r * factor)
      const newG = Math.floor(g * factor)
      const newB = Math.floor(b * factor)
      
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
    }
    return color
  }

  private lightenColor(color: string): string {
    // 简单的颜色变亮函数
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      
      const factor = 1.3
      const newR = Math.min(255, Math.floor(r * factor))
      const newG = Math.min(255, Math.floor(g * factor))
      const newB = Math.min(255, Math.floor(b * factor))
      
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`
    }
    return color
  }

  createParticles(type: string, x: number, y: number, config: ParticleConfig) {
    const particles = this.particleEffects.get(type) || []
    
    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = config.speed.min + Math.random() * (config.speed.max - config.speed.min)
      const size = config.size.min + Math.random() * (config.size.max - config.size.min)
      const life = config.life.min + Math.random() * (config.life.max - config.life.min)
      const color = config.color[Math.floor(Math.random() * config.color.length)]
      
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size,
        life,
        maxLife: life,
        color,
        gravity: config.gravity || 0,
        friction: config.friction || 1
      })
    }
    
    this.particleEffects.set(type, particles)
  }

  drawParticles(ctx: CanvasRenderingContext2D) {
    this.particleEffects.forEach((particles) => {
      particles.forEach((particle) => {
        ctx.save()
        
        const alpha = particle.life / particle.maxLife
        ctx.globalAlpha = alpha
        ctx.fillStyle = particle.color
        
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
      })
    })
  }
}
