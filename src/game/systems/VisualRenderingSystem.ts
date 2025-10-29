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

  constructor() {
    this.initializeParticleSystems()
  }

  update(deltaTime: number) {
    this.animationTime += deltaTime
    this.updateParticles(deltaTime)
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
  }) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)

    const animFrame = Math.floor(this.animationTime / 200) % 4
    const isMoving = options?.animationState === 'moving'
    const bobOffset = isMoving ? Math.sin(this.animationTime / 100) * 2 : 0

    // 绘制阴影
    this.drawShadow(ctx, 0, 3, 20)

    // 绘制玩家身体
    this.drawPlayerBody(ctx, animFrame, bobOffset, options?.skin)

    // 绘制武器
    this.drawPlayerWeapon(ctx, options?.weapon || 'rifle', animFrame, options?.lastAttackTime)

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

  private drawPlayerBody(ctx: CanvasRenderingContext2D, animFrame: number, bobOffset: number, skin?: string) {
    ctx.save()
    ctx.translate(0, bobOffset)

    // 机甲装甲配色 - 金属质感
    const armorColor = '#4A5568'    // 钛合金灰
    const accentColor = '#00D4FF'   // 青蓝色能源光

    // 绘制主体机甲装甲 - 厚重机械感
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', armorColor, 0, -20, 0, 20)
    this.drawRoundedRect(ctx, -10, -20, 20, 40, 3)

    // 胸部装甲板 - 多层装甲
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', '#6B7280', 0, -18, 0, 8)
    this.drawRoundedRect(ctx, -9, -18, 18, 28, 2)
    
    // 内层装甲
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 0, -15, 0, 5)
    this.drawRoundedRect(ctx, -8, -15, 16, 22, 2)

    // 机甲能源线路系统
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4
    ctx.beginPath()
    // 主能源线路
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
    ctx.shadowBlur = 0

    // 中央反应堆核心 - 更大更亮
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(0, -5, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 反应堆内核
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = '#FFFFFF'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(0, -5, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 反应堆外环
    ctx.strokeStyle = '#FFFFFF'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, -5, 5, 0, Math.PI * 2)
    ctx.stroke()

    // 厚重肩部装甲 - 机甲风格
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 0, 0, 15, 0)
    this.drawRoundedRect(ctx, -14, -18, 6, 12, 2)
    this.drawRoundedRect(ctx, 8, -18, 6, 12, 2)

    // 肩部推进器
    ctx.fillStyle = this.createGradient(ctx, '#374151', '#1F2937', 0, 0, 8, 0)
    this.drawRoundedRect(ctx, -12, -15, 2, 6, 1)
    this.drawRoundedRect(ctx, 10, -15, 2, 6, 1)

    // 推进器发光
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(-11, -12, 1, 0, Math.PI * 2)
    ctx.arc(11, -12, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 绘制机甲头盔 - 更厚重更机械
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 0, -32, 0, -18)
    ctx.beginPath()
    ctx.ellipse(0, -26, 10, 9, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头盔外装甲层
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 0, -30, 0, -22)
    ctx.beginPath()
    ctx.ellipse(0, -26, 8.5, 7.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头盔能源线路
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
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

    // 机甲面罩 - 全封闭式
    ctx.fillStyle = '#1F2937'
    ctx.globalAlpha = 0.95
    ctx.beginPath()
    ctx.ellipse(0, -24, 6, 4, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // 面罩边框
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(0, -24, 6, 4, 0, 0, Math.PI * 2)
    ctx.stroke()

    // 机甲眼部发光系统
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.ellipse(-2.5, -24, 1.5, 1, 0, 0, Math.PI * 2)
    ctx.ellipse(2.5, -24, 1.5, 1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 眼部内核
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = '#FFFFFF'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(-2.5, -24, 0.8, 0, Math.PI * 2)
    ctx.arc(2.5, -24, 0.8, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 机甲HUD扫描线 - 更科技感
    if (Math.sin(this.animationTime / 150) > 0) {
      ctx.strokeStyle = accentColor
      ctx.lineWidth = 0.8
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.moveTo(-5, -24)
      ctx.lineTo(5, -24)
      ctx.moveTo(-4, -22)
      ctx.lineTo(4, -22)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // 头盔侧面通风口/散热器
    ctx.fillStyle = '#374151'
    for (let i = 0; i < 3; i++) {
      const y = -28 + i * 2
      this.drawRoundedRect(ctx, -8, y, 2, 1, 0.5)
      this.drawRoundedRect(ctx, 6, y, 2, 1, 0.5)
    }

    // 绘制装甲四肢
    this.drawPlayerLimbs(ctx, animFrame, bobOffset)

    ctx.restore()
  }

  private drawPlayerLimbs(ctx: CanvasRenderingContext2D, animFrame: number, bobOffset: number) {
    const limbOffset = Math.sin(this.animationTime / 150) * 2
    const armorColor = '#4A5568'
    const accentColor = '#00D4FF'
    
    // 左臂机甲装甲 - 厚重外骨骼
    ctx.save()
    ctx.rotate(Math.sin(this.animationTime / 200) * 0.08)
    
    // 上臂装甲
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 0, 0, -18, 0)
    this.drawRoundedRect(ctx, -20, -12, 14, 7, 2)
    
    // 前臂装甲
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 0, 0, -12, 0)
    this.drawRoundedRect(ctx, -18, -8, 10, 5, 2)
    
    // 能源管道
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.moveTo(-18, -9)
    ctx.lineTo(-10, -9)
    ctx.moveTo(-16, -6)
    ctx.lineTo(-12, -6)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 机甲手部 - 机械爪
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 0, 0, -8, 0)
    this.drawRoundedRect(ctx, -22, -6, 6, 4, 1)
    
    // 手部发光能源
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(-19, -4, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.restore()
    
    // 右臂机甲装甲
    ctx.save()
    ctx.rotate(-Math.sin(this.animationTime / 200) * 0.08)
    
    // 上臂装甲
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 0, 0, 18, 0)
    this.drawRoundedRect(ctx, 6, -12, 14, 7, 2)
    
    // 前臂装甲
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 0, 0, 12, 0)
    this.drawRoundedRect(ctx, 8, -8, 10, 5, 2)
    
    // 能源管道
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.moveTo(10, -9)
    ctx.lineTo(18, -9)
    ctx.moveTo(12, -6)
    ctx.lineTo(16, -6)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 机甲手部 - 机械爪
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 0, 0, 8, 0)
    this.drawRoundedRect(ctx, 16, -6, 6, 4, 1)
    
    // 手部发光能源
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(19, -4, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.restore()
    
    // 机甲腿部装甲 - 厚重外骨骼
    // 大腿装甲
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', armorColor, 0, 18, 0, 35)
    this.drawRoundedRect(ctx, -6, 18, 5, 15 + Math.abs(limbOffset * 0.3), 2)
    this.drawRoundedRect(ctx, 1, 18, 5, 15 - Math.abs(limbOffset * 0.3), 2)
    
    // 小腿装甲
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', '#9CA3AF', 0, 30, 0, 40)
    this.drawRoundedRect(ctx, -5, 30 + limbOffset * 0.3, 4, 8, 2)
    this.drawRoundedRect(ctx, 2, 30 - limbOffset * 0.3, 4, 8, 2)
    
    // 腿部能源线路
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.moveTo(-3, 22)
    ctx.lineTo(-3, 32)
    ctx.moveTo(3, 22)
    ctx.lineTo(3, 32)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 机甲靴 - 厚重推进靴
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 0, 35, 0, 42)
    this.drawRoundedRect(ctx, -7, 36 + limbOffset, 6, 4, 2)
    this.drawRoundedRect(ctx, 1, 36 - limbOffset, 6, 4, 2)
    
    // 靴底推进器
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.ellipse(-4, 40 + limbOffset, 2, 1, 0, 0, Math.PI * 2)
    ctx.ellipse(4, 40 - limbOffset, 2, 1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 推进器发光效果
    if (Math.sin(this.animationTime / 100) > 0.5) {
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = '#FFFFFF'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.arc(-4, 40 + limbOffset, 0.8, 0, Math.PI * 2)
      ctx.arc(4, 40 - limbOffset, 0.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }
  }

  private drawPlayerWeapon(ctx: CanvasRenderingContext2D, weaponType: string, animFrame: number, lastAttackTime?: number) {
    ctx.save()
    
    const recoilOffset = Math.sin(this.animationTime / 50) * 0.5
    ctx.translate(recoilOffset, 0)

    switch (weaponType) {
      case 'rifle':
        this.drawRifle(ctx, lastAttackTime)
        break
      case 'smg':
      case 'submachine_gun':
        this.drawSMG(ctx, lastAttackTime)
        break
      case 'shotgun':
        this.drawShotgun(ctx, lastAttackTime)
        break
      case 'sniper':
        this.drawSniperRifle(ctx, lastAttackTime)
        break
      case 'bow':
        this.drawBow(ctx, lastAttackTime)
        break
      case 'talisman_sword':
        this.drawTalismanSword(ctx, lastAttackTime)
        break
      case 'laser_gun':
        this.drawLaserGun(ctx, lastAttackTime)
        break
      default:
        this.drawLaserGun(ctx, lastAttackTime)  // 默认武器改为激光枪
    }

    ctx.restore()
  }

  private drawRifle(ctx: CanvasRenderingContext2D, lastAttackTime?: number) {
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

  private drawShotgun(ctx: CanvasRenderingContext2D, lastAttackTime?: number) {
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
  
  private drawSMG(ctx: CanvasRenderingContext2D, lastAttackTime?: number) {
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
  
  private drawTalismanSword(ctx: CanvasRenderingContext2D, lastAttackTime?: number) {
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
  
  private drawLaserGun(ctx: CanvasRenderingContext2D, lastAttackTime?: number) {
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

  private drawSniperRifle(ctx: CanvasRenderingContext2D, lastAttackTime?: number) {
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

  private drawBow(ctx: CanvasRenderingContext2D, lastAttackTime?: number) {
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
