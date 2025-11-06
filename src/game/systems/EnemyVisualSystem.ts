/**
 * 敌人视觉渲染系统
 * 为不同类型的敌人提供精细的2D模型渲染
 */

import type { RenderContext, ParticleConfig } from './VisualRenderingSystem'

export interface EnemyRenderOptions {
  type: string
  health: number
  maxHealth: number
  shield?: number
  maxShield?: number
  isElite?: boolean
  animationState?: 'idle' | 'moving' | 'attacking' | 'hit' | 'dying' | 'special'
  size: number
  color: string
  glowColor?: string
  statusEffects?: any[]
}

export class EnemyVisualSystem {
  private animationTime = 0
  private hitEffects: Map<string, { time: number; intensity: number }> = new Map()

  update(deltaTime: number) {
    this.animationTime += deltaTime
    
    // 更新击中效果
    this.hitEffects.forEach((effect, id) => {
      effect.time -= deltaTime
      effect.intensity = Math.max(0, effect.time / 500) // 0.5秒淡出
      if (effect.time <= 0) {
        this.hitEffects.delete(id)
      }
    })
  }

  /**
   * 绘制精细的敌人模型
   */
  drawEnemy(ctx: CanvasRenderingContext2D, x: number, y: number, options: EnemyRenderOptions, enemyId?: string) {
    ctx.save()
    ctx.translate(x, y)

    // 绘制阴影
    this.drawShadow(ctx, 0, 3, options.size * 0.8)

    // 击中效果
    const hitEffect = enemyId ? this.hitEffects.get(enemyId) : null
    if (hitEffect) {
      ctx.save()
      ctx.globalAlpha = hitEffect.intensity
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, 0, options.size + 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // 精英光环
    if (options.isElite) {
      this.drawEliteAura(ctx, options.size)
    }

    // 根据敌人类型绘制不同的模型
    switch (options.type) {
      case 'bug':
        this.drawBugEnemy(ctx, options)
        break
      case 'charger':
      case 'runner':
        this.drawRunnerEnemy(ctx, options)
        break
      case 'archer':
        this.drawArcherEnemy(ctx, options)
        break
      case 'sniper':
        this.drawSniperEnemy(ctx, options)
        break
      case 'shieldguard':
      case 'shield':
        this.drawShieldEnemy(ctx, options)
        break
      case 'bomb_bat':
      case 'exploder':
        this.drawExploderEnemy(ctx, options)
        break
      case 'healer':
        this.drawHealerEnemy(ctx, options)
        break
      case 'grenadier':
        this.drawGrenadierEnemy(ctx, options)
        break
      case 'summoner':
        this.drawSummonerEnemy(ctx, options)
        break
      case 'phantom':
        this.drawPhantomEnemy(ctx, options)
        break
      case 'boss':
        this.drawBossEnemy(ctx, options)
        break
      // Boss 原型：第5/10/15/20层
      case 'infantry_captain': // 第5层 重装指挥官（视觉：厚重装甲+肩炮+护盾暗示）
        this.drawCommanderBoss(ctx, options)
        break
      case 'fortress_guard': // 第10层 虫巢母体（视觉：巢穴触须与孵化脉动）
        this.drawHiveMotherBoss(ctx, options)
        break
      case 'void_shaman': // 第15层 暗影刺客（视觉：隐身残影与刀光）
        this.drawShadowAssassinBoss(ctx, options)
        break
      case 'legion_commander': // 第20层 混沌造物（视觉：能量核与形态混沌纹）
        this.drawChaosConstructBoss(ctx, options)
        break
      case 'infantry':
      default:
        // 默认士兵风格
        this.drawModernSoldier(ctx, options)
        break
    }

    // 绘制生命值条
    this.drawHealthBar(ctx, options)

    // 绘制状态效果
    if (options.statusEffects && options.statusEffects.length > 0) {
      this.drawStatusEffects(ctx, options.statusEffects, options.size)
    }

    ctx.restore()
  }

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    ctx.save()
    ctx.globalAlpha = 0.2
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.ellipse(x, y, size * 0.6, size * 0.3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  private drawEliteAura(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save()
    
    const pulseSize = size + 8 + Math.sin(this.animationTime / 300) * 4
    const gradient = ctx.createRadialGradient(0, 0, size, 0, 0, pulseSize)
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0)')
    gradient.addColorStop(0.7, 'rgba(255, 215, 0, 0.3)')
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, pulseSize, 0, Math.PI * 2)
    ctx.fill()
    
    // 环形光效
    ctx.strokeStyle = '#FFD700'
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.8
    for (let i = 0; i < 3; i++) {
      const radius = size + 3 + i * 3 + Math.sin(this.animationTime / 200 + i) * 2
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    
    ctx.restore()
  }

  private drawModernSoldier(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const animFrame = Math.floor(this.animationTime / 200) % 4
    const isMoving = options.animationState === 'moving'
    const walkBob = isMoving ? Math.sin(this.animationTime / 100) * 1 : 0

    ctx.save()
    ctx.translate(0, walkBob)

    // 根据敌人类型微调颜色
    let primaryColor = '#4A5568'
    let accentColor = '#68D391'
    let weaponType = 'rifle'
    
    switch (options.type) {
      case 'bug':
      case 'swarm':
        primaryColor = '#4A6741'
        accentColor = '#68D391'
        weaponType = 'heavy'
        break
      case 'runner':
      case 'charger':
        primaryColor = '#2563EB'
        accentColor = '#60A5FA'
        weaponType = 'smg'
        break
      case 'shooter':
      case 'archer':
        primaryColor = '#7C3AED'
        accentColor = '#A78BFA'
        weaponType = 'sniper'
        break
      case 'shield':
      case 'shieldguard':
        primaryColor = '#059669'
        accentColor = '#34D399'
        weaponType = 'shield'
        break
      case 'exploder':
      case 'bomb_bat':
        primaryColor = '#DC2626'
        accentColor = '#F87171'
        weaponType = 'grenade'
        break
      case 'boss':
        primaryColor = '#7C2D12'
        accentColor = '#FB923C'
        weaponType = 'heavy'
        break
    }

    // 绘制机甲身体 - 厚重装甲
    const bodyGradient = this.createGradient(ctx, '#9CA3AF', this.darkenColor(primaryColor), 0, -size*0.6, 0, size*0.6)
    ctx.fillStyle = bodyGradient
    this.drawRoundedRect(ctx, -size*0.2, -size*0.5, size*0.4, size*1.0, 3)

    // 内层装甲
    ctx.fillStyle = this.createGradient(ctx, primaryColor, this.darkenColor(primaryColor), 0, -size*0.45, 0, size*0.45)
    this.drawRoundedRect(ctx, -size*0.18, -size*0.45, size*0.36, size*0.9, 2)

    // 机甲能源线路
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1.5
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.moveTo(-size*0.15, -size*0.3)
    ctx.lineTo(size*0.15, -size*0.3)
    ctx.moveTo(-size*0.12, -size*0.1)
    ctx.lineTo(size*0.12, -size*0.1)
    ctx.moveTo(-size*0.1, size*0.1)
    ctx.lineTo(size*0.1, size*0.1)
    // 垂直能源线
    ctx.moveTo(0, -size*0.4)
    ctx.lineTo(0, size*0.3)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 胸前反应堆
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(0, -size*0.2, size*0.08, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 反应堆内核
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = '#FFFFFF'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(0, -size*0.2, size*0.04, 0, Math.PI * 2)  
    ctx.fill()
    ctx.shadowBlur = 0

    // 厚重肩部装甲
    ctx.fillStyle = this.createGradient(ctx, '#D1D5DB', primaryColor, 0, 0, size*0.3, 0)
    this.drawRoundedRect(ctx, -size*0.28, -size*0.48, size*0.12, size*0.15, 2)
    this.drawRoundedRect(ctx, size*0.16, -size*0.48, size*0.12, size*0.15, 2)

    // 肩部推进器
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 0, 0, size*0.15, 0)
    this.drawRoundedRect(ctx, -size*0.25, -size*0.42, size*0.06, size*0.08, 1)
    this.drawRoundedRect(ctx, size*0.19, -size*0.42, size*0.06, size*0.08, 1)

    // 推进器发光
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(-size*0.22, -size*0.38, size*0.02, 0, Math.PI * 2)
    ctx.arc(size*0.22, -size*0.38, size*0.02, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 绘制机甲头盔 - 厚重装甲头盔
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', this.darkenColor(primaryColor), 0, -size*0.75, 0, -size*0.55)
    ctx.beginPath()
    ctx.ellipse(0, -size*0.65, size*0.16, size*0.12, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头盔内层
    ctx.fillStyle = this.createGradient(ctx, primaryColor, this.darkenColor(primaryColor), 0, -size*0.72, 0, -size*0.58)
    ctx.beginPath()
    ctx.ellipse(0, -size*0.65, size*0.13, size*0.09, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头盔能源线路
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.arc(0, -size*0.65, size*0.11, 0, Math.PI)
    // 侧面线路
    ctx.moveTo(-size*0.1, -size*0.65)
    ctx.lineTo(-size*0.05, -size*0.6)
    ctx.moveTo(size*0.1, -size*0.65)
    ctx.lineTo(size*0.05, -size*0.6)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 机甲面罩 - 全封闭
    ctx.fillStyle = '#1F2937'
    ctx.globalAlpha = 0.95
    ctx.beginPath()
    ctx.ellipse(0, -size*0.62, size*0.09, size*0.05, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // 面罩边框
    ctx.strokeStyle = '#6B7280'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(0, -size*0.62, size*0.09, size*0.05, 0, 0, Math.PI * 2)
    ctx.stroke()

    // 机甲眼部系统
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.ellipse(-size*0.04, -size*0.62, size*0.025, size*0.02, 0, 0, Math.PI * 2)
    ctx.ellipse(size*0.04, -size*0.62, size*0.025, size*0.02, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 眼部内核
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowColor = '#FFFFFF'
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.arc(-size*0.04, -size*0.62, size*0.015, 0, Math.PI * 2)
    ctx.arc(size*0.04, -size*0.62, size*0.015, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 头盔散热口
    ctx.fillStyle = '#374151'
    for (let i = 0; i < 2; i++) {
      const y = -size*0.72 + i * size*0.03
      this.drawRoundedRect(ctx, -size*0.13, y, size*0.04, size*0.015, 0.5)
      this.drawRoundedRect(ctx, size*0.09, y, size*0.04, size*0.015, 0.5)
    }

    // 绘制标准化四肢
    this.drawUnifiedLimbs(ctx, size, animFrame, isMoving, primaryColor, accentColor)

    // 绘制武器
    this.drawUnifiedWeapon(ctx, size, weaponType, primaryColor, accentColor)

    ctx.restore()
  }

  private drawBugEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const scuttle = Math.sin(this.animationTime / 120) * 1.5

    ctx.save()
    ctx.translate(0, scuttle)

    // 绘制机械虫族主体 - 装甲外壳
    const shellGradient = this.createGradient(ctx, '#4A6741', '#2F4F2F', 0, -size*0.4, 0, size*0.4)
    ctx.fillStyle = shellGradient
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.35, size * 0.25, 0, 0, Math.PI * 2)
    ctx.fill()

    // 装甲分节线
    ctx.strokeStyle = '#68D391'
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const y = -size * 0.15 + i * size * 0.15
      ctx.moveTo(-size * 0.3, y)
      ctx.lineTo(size * 0.3, y)
    }
    ctx.stroke()

    // 生物发光斑点 - 对称排列
    ctx.fillStyle = '#68D391'
    ctx.shadowColor = '#68D391'
    ctx.shadowBlur = 3
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const spotX = Math.cos(angle) * size * 0.2
      const spotY = Math.sin(angle) * size * 0.12
      ctx.beginPath()
      ctx.arc(spotX, spotY, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0

    // 复眼系统 - 对称设计
    ctx.fillStyle = '#2D3748'
    ctx.beginPath()
    ctx.arc(-size * 0.12, -size * 0.15, size * 0.08, 0, Math.PI * 2)
    ctx.arc(size * 0.12, -size * 0.15, size * 0.08, 0, Math.PI * 2)
    ctx.fill()

    // 复眼发光
    ctx.fillStyle = '#68D391'
    ctx.shadowColor = '#68D391'
    ctx.shadowBlur = 2
    for (let eye = 0; eye < 2; eye++) {
      const eyeX = eye === 0 ? -size * 0.12 : size * 0.12
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + this.animationTime / 500
        const lensX = eyeX + Math.cos(angle) * size * 0.03
        const lensY = -size * 0.15 + Math.sin(angle) * size * 0.03
        ctx.beginPath()
        ctx.arc(lensX, lensY, 0.8, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.shadowBlur = 0

    // 绘制机械腿部
    this.drawMechLegs(ctx, size)

    // 胸部科技标识
    ctx.strokeStyle = '#68D391'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.08, 0, Math.PI * 2)
    ctx.stroke()
    
    // 中央能源核心
    ctx.fillStyle = '#68D391'
    ctx.shadowColor = '#68D391'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.03, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.restore()
  }

  private drawRunnerEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const speedEffect = options.animationState === 'moving' ? Math.sin(this.animationTime / 30) * 6 : 0
    const dashingMotion = options.animationState === 'moving' ? Math.sin(this.animationTime / 80) * 2 : 0

    ctx.save()
    ctx.translate(speedEffect, dashingMotion)

    // 绘制高速突击者身体 - 流线型设计
    const bodyGradient = this.createGradient(ctx, '#2563EB', '#1E40AF', 0, -size*0.6, 0, size*0.6)
    ctx.fillStyle = bodyGradient
    this.drawRoundedRect(ctx, -size*0.15, -size*0.45, size*0.3, size*0.9, 6)

    // 动力装甲纹路
    ctx.strokeStyle = '#60A5FA'
    ctx.lineWidth = 1
    ctx.beginPath()
    // 流线型装饰条纹
    for (let i = 0; i < 4; i++) {
      const y = -size*0.3 + i * size*0.2
      ctx.moveTo(-size*0.12, y)
      ctx.lineTo(size*0.12, y)
    }
    ctx.stroke()

    // 能量推进器 - 背部
    ctx.fillStyle = '#1E40AF'
    this.drawRoundedRect(ctx, -size*0.08, size*0.2, size*0.16, size*0.25, 3)
    
    // 推进器发光效果
    if (options.animationState === 'moving') {
      ctx.fillStyle = '#60A5FA'
      ctx.shadowColor = '#60A5FA'
      ctx.shadowBlur = 8
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const flameY = size * (0.45 + i * 0.05)
        const flameSize = 2 - i * 0.5
        ctx.arc(-size*0.04 + (i%2)*size*0.08, flameY, flameSize, 0, Math.PI * 2)
        ctx.arc(size*0.04 - (i%2)*size*0.08, flameY, flameSize, 0, Math.PI * 2)
      }
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // 绘制流线型头盔
    ctx.fillStyle = this.createGradient(ctx, '#3B82F6', '#1E40AF', 0, -size*0.7, 0, -size*0.4)
    ctx.beginPath()
    ctx.ellipse(0, -size*0.55, size*0.12, size*0.15, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头盔护目镜 - 战术HUD
    ctx.fillStyle = '#1E293B'
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.ellipse(0, -size*0.52, size*0.09, size*0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // HUD发光显示
    ctx.fillStyle = '#60A5FA'
    ctx.shadowColor = '#60A5FA'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(-size*0.03, -size*0.52, 1, 0, Math.PI * 2)
    ctx.arc(size*0.03, -size*0.52, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 动态速度拖尾效果
    if (options.animationState === 'moving') {
      ctx.globalAlpha = 0.6
      for (let i = 1; i <= 5; i++) {
        const trailOffset = -i * 8
        const trailAlpha = 0.6 / (i * 1.5)
        ctx.globalAlpha = trailAlpha
        ctx.fillStyle = '#60A5FA'
        ctx.beginPath()
        ctx.ellipse(trailOffset, 0, size * 0.2, size * 0.4, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // 绘制高速移动四肢
    this.drawRunnerLimbs(ctx, size)

    // 肩部能量指示器
    ctx.fillStyle = '#60A5FA'
    ctx.shadowColor = '#60A5FA'
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.arc(-size*0.18, -size*0.25, 1.5, 0, Math.PI * 2)
    ctx.arc(size*0.18, -size*0.25, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.restore()
  }

  private drawArcherEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const spellShake = options.animationState === 'attacking' ? Math.sin(this.animationTime / 80) * 1 : 0
    const floatOffset = Math.sin(this.animationTime / 250) * 2

    ctx.save()
    ctx.translate(spellShake, floatOffset)

    // 绘制妖道身体 - 黑色道袍
    ctx.fillStyle = this.createGradient(ctx, '#1C1C1C', '#4B0000', 0, -size*0.7, 0, size*0.7)
    this.drawRoundedRect(ctx, -size*0.22, -size*0.6, size*0.44, size*1.2, 4)

    // 邪恶妖道纹身/符印
    ctx.fillStyle = '#8B0000'
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + this.animationTime / 600
      const x = Math.cos(angle) * size * 0.12
      const y = Math.sin(angle) * size * 0.25
      ctx.beginPath()
      ctx.arc(x, y, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制妖道头颅
    ctx.fillStyle = this.createGradient(ctx, '#2F2F2F', '#000000', 0, -size*0.8, 0, -size*0.5)
    ctx.beginPath()
    ctx.arc(0, -size * 0.65, size * 0.18, 0, Math.PI * 2)
    ctx.fill()

    // 绘制妖道帽
    ctx.fillStyle = '#1C1C1C'
    ctx.beginPath()
    ctx.arc(0, -size * 0.7, size * 0.2, Math.PI, 0)
    ctx.fill()

    // 帽子上的邪恶法印
    ctx.strokeStyle = '#8B0000'
    ctx.lineWidth = 1.5
    ctx.font = `${size * 0.08}px serif`
    ctx.fillStyle = '#8B0000'
    ctx.textAlign = 'center'
    ctx.fillText('妖', 0, -size * 0.63)

    // 绘制邪恶法眼 - 血红色
    ctx.fillStyle = '#8B0000'
    ctx.shadowColor = '#8B0000'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.arc(-size * 0.06, -size * 0.68, 2.5, 0, Math.PI * 2)
    ctx.arc(size * 0.06, -size * 0.68, 2.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 竖瞳 - 妖异
    ctx.fillStyle = '#000000'
    ctx.fillRect(-size * 0.075, -size * 0.7, 0.3, 4)
    ctx.fillRect(size * 0.045, -size * 0.7, 0.3, 4)

    // 绘制法杖而非弓箭
    this.drawMysticStaff(ctx, size, options.animationState === 'attacking')

    // 绘制符袋而非箭袋
    this.drawTalismanPouch(ctx, size)

    // 施法时的符纸飘散效果
    if (options.animationState === 'attacking') {
      this.drawFloatingTalismans(ctx, size)
    }

    ctx.restore()
  }

  private drawShieldEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const guardPulse = Math.sin(this.animationTime / 300) * 0.1 + 1

    ctx.save()

    // 绘制护法金刚身躯 - 石质纹理
    ctx.fillStyle = this.createGradient(ctx, '#708090', '#2F4F4F', 0, -size*0.8, 0, size*0.8)
    this.drawRoundedRect(ctx, -size*0.25, -size*0.6, size*0.5, size*1.2, 6)

    // 金刚石质纹理
    ctx.fillStyle = '#556B2F'
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const x = Math.cos(angle) * size * 0.15
      const y = Math.sin(angle) * size * 0.3
      ctx.beginPath()
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制护法头颅 - 威严狮相
    ctx.fillStyle = this.createGradient(ctx, '#B8860B', '#8B6914', 0, -size*0.8, 0, -size*0.5)
    ctx.beginPath()
    ctx.arc(0, -size * 0.65, size * 0.2, 0, Math.PI * 2)
    ctx.fill()

    // 护法狮鬃
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const x = Math.cos(angle) * size * 0.25
      const y = Math.sin(angle) * size * 0.25 - size * 0.65
      ctx.fillStyle = '#DAA520'
      ctx.beginPath()
      ctx.arc(x, y, size * 0.04, 0, Math.PI * 2)
      ctx.fill()
    }

    // 威严法眼 - 金色神光
    ctx.fillStyle = '#FFD700'
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.arc(-size * 0.06, -size * 0.68, 2.5 * guardPulse, 0, Math.PI * 2)
    ctx.arc(size * 0.06, -size * 0.68, 2.5 * guardPulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 法眼瞳孔
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(-size * 0.06, -size * 0.68, 1.2, 0, Math.PI * 2)
    ctx.arc(size * 0.06, -size * 0.68, 1.2, 0, Math.PI * 2)
    ctx.fill()

    // 绘制护法法盾
    this.drawMysticShield(ctx, size, guardPulse)

    // 绘制降魔杵
    this.drawDemonSubduingStaff(ctx, size)

    // 额头法印
    ctx.fillStyle = '#FFD700'
    ctx.font = `${size * 0.07}px serif`
    ctx.textAlign = 'center'
    ctx.fillText('护', 0, -size * 0.58)

    ctx.restore()
  }

  private drawBruteEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size * 1.2 // 更大的体型
    const breathe = Math.sin(this.animationTime / 500) * 2

    ctx.save()
    ctx.scale(1.2, 1.2)
    ctx.translate(0, breathe)

    // 绘制巨大身躯
    ctx.fillStyle = this.createGradient(ctx, options.color, this.darkenColor(options.color), 0, -size/2, 0, size/2)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.5, size * 0.9, 0, 0, Math.PI * 2)
    ctx.fill()

    // 绘制肌肉纹理
    ctx.strokeStyle = this.darkenColor(options.color)
    ctx.lineWidth = 2
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(-size * 0.3, -size * 0.3 + i * size * 0.2)
      ctx.lineTo(size * 0.3, -size * 0.3 + i * size * 0.2)
      ctx.stroke()
    }

    // 绘制巨大头部
    ctx.fillStyle = this.lightenColor(options.color)
    ctx.beginPath()
    ctx.arc(0, -size * 0.7, size * 0.3, 0, Math.PI * 2)
    ctx.fill()

    // 绘制凶狠的眼睛
    ctx.fillStyle = '#ff0000'
    ctx.beginPath()
    ctx.arc(-size * 0.12, -size * 0.75, 4, 0, Math.PI * 2)
    ctx.arc(size * 0.12, -size * 0.75, 4, 0, Math.PI * 2)
    ctx.fill()

    // 绘制獠牙
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.moveTo(-size * 0.1, -size * 0.6)
    ctx.lineTo(-size * 0.05, -size * 0.5)
    ctx.lineTo(-size * 0.15, -size * 0.5)
    ctx.closePath()
    ctx.moveTo(size * 0.1, -size * 0.6)
    ctx.lineTo(size * 0.05, -size * 0.5)
    ctx.lineTo(size * 0.15, -size * 0.5)
    ctx.closePath()
    ctx.fill()

    // 绘制强壮四肢
    this.drawBruteLimbs(ctx, size)

    ctx.restore()
  }

  private drawExploderEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const pulse = Math.sin(this.animationTime / 150) * 2
    const isDangerous = options.health / options.maxHealth < 0.3
    const floatOffset = Math.sin(this.animationTime / 300) * 3

    ctx.save()
    ctx.translate(0, floatOffset)

    // 危险时脉动效果
    if (isDangerous) {
      ctx.scale(1 + pulse * 0.15, 1 + pulse * 0.15)
    }

    // 绘制纸人身体 - 扁平纸质感
    ctx.fillStyle = this.createGradient(ctx, '#FFFACD', '#F5DEB3', 0, -size*0.6, 0, size*0.6)
    this.drawRoundedRect(ctx, -size*0.2, -size*0.5, size*0.4, size*1.0, 3)

    // 纸人折痕线
    ctx.strokeStyle = '#DEB887'
    ctx.lineWidth = 1
    for (let i = 1; i <= 4; i++) {
      const y = -size*0.5 + i * (size / 5)
      ctx.beginPath()
      ctx.moveTo(-size*0.18, y)
      ctx.lineTo(size*0.18, y)
      ctx.stroke()
    }

    // 绘制纸人头部
    ctx.fillStyle = this.createGradient(ctx, '#FFFACD', '#DEB887', 0, -size*0.7, 0, -size*0.4)
    ctx.beginPath()
    ctx.arc(0, -size * 0.55, size * 0.15, 0, Math.PI * 2)
    ctx.fill()

    // 绘制纸人五官 - 简笔画风格
    ctx.fillStyle = '#8B0000'
    // 眼睛
    ctx.beginPath()
    ctx.arc(-size * 0.05, -size * 0.58, 1.5, 0, Math.PI * 2)
    ctx.arc(size * 0.05, -size * 0.58, 1.5, 0, Math.PI * 2)
    ctx.fill()
    
    // 嘴巴 - 一条线
    ctx.strokeStyle = '#8B0000'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(-size * 0.06, -size * 0.52)
    ctx.lineTo(size * 0.06, -size * 0.52)
    ctx.stroke()

    // 纸人身上的爆破符文
    ctx.fillStyle = '#DC143C'
    ctx.font = `${size * 0.08}px serif`
    ctx.textAlign = 'center'
    const explodeRunes = ['爆', '炸', '轰']
    for (let i = 0; i < 3; i++) {
      const y = -size * 0.2 + i * size * 0.25
      ctx.fillText(explodeRunes[i], 0, y)
    }

    // 危险时的红光效果
    if (isDangerous) {
      ctx.shadowColor = '#FF0000'
      ctx.shadowBlur = 10 + pulse * 3
      ctx.fillStyle = '#FF4500'
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(0, 0, size * 0.3 + pulse, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1

      // 符文发光
      this.drawGlowingRunes(ctx, size, pulse)
    }

    // 纸人四肢 - 简单线条
    ctx.strokeStyle = '#DEB887'
    ctx.lineWidth = 2
    // 手臂
    ctx.beginPath()
    ctx.moveTo(-size * 0.2, -size * 0.1)
    ctx.lineTo(-size * 0.3, size * 0.1)
    ctx.moveTo(size * 0.2, -size * 0.1)
    ctx.lineTo(size * 0.3, size * 0.1)
    // 腿部
    ctx.moveTo(-size * 0.1, size * 0.45)
    ctx.lineTo(-size * 0.15, size * 0.7)
    ctx.moveTo(size * 0.1, size * 0.45)
    ctx.lineTo(size * 0.15, size * 0.7)
    ctx.stroke()

    ctx.restore()
  }

  private drawSniperEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const steady = options.animationState === 'attacking' ? 0 : Math.sin(this.animationTime / 800) * 1

    ctx.save()
    ctx.translate(0, steady)

    // 绘制隐蔽的身体
    ctx.fillStyle = this.createGradient(ctx, '#2d4a3e', this.darkenColor('#2d4a3e'), 0, -size/2, 0, size/2)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.3, size * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()

    // 绘制吉利服纹理
    ctx.fillStyle = '#3a5f4a'
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const x = Math.cos(angle) * size * 0.25
      const y = Math.sin(angle) * size * 0.35
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制瞄准镜反光
    if (options.animationState === 'attacking') {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, -size * 0.4, 1, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制狙击步枪
    this.drawSniperRifle(ctx, size)

    ctx.restore()
  }

  private drawHealerEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const float = Math.sin(this.animationTime / 400) * 3

    ctx.save()
    ctx.translate(0, float)

    // 绘制法袍身体
    ctx.fillStyle = this.createGradient(ctx, options.color, this.lightenColor(options.color), 0, -size/2, 0, size/2)
    ctx.beginPath()
    // 绘制法袍形状
    ctx.moveTo(0, -size * 0.8)
    ctx.quadraticCurveTo(-size * 0.4, -size * 0.3, -size * 0.5, size * 0.5)
    ctx.lineTo(size * 0.5, size * 0.5)
    ctx.quadraticCurveTo(size * 0.4, -size * 0.3, 0, -size * 0.8)
    ctx.closePath()
    ctx.fill()

    // 绘制头部
    ctx.fillStyle = this.lightenColor(options.color)
    ctx.beginPath()
    ctx.arc(0, -size * 0.6, size * 0.2, 0, Math.PI * 2)
    ctx.fill()

    // 绘制法师帽
    ctx.fillStyle = '#4a0080'
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.8)
    ctx.quadraticCurveTo(-size * 0.15, -size * 1.1, size * 0.1, -size * 0.9)
    ctx.quadraticCurveTo(size * 0.15, -size * 0.75, 0, -size * 0.8)
    ctx.fill()

    // 绘制治疗光环
    this.drawHealingAura(ctx, size)

    // 绘制法杖
    this.drawStaff(ctx, size)

    ctx.restore()
  }

  private drawGrenadierEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const sway = Math.sin(this.animationTime / 200) * 1.5

    ctx.save()
    ctx.translate(sway, 0)

    // 绘制重装投弹手身体 - 厚重装甲
    const bodyGradient = this.createGradient(ctx, options.color, this.darkenColor(options.color), 0, -size*0.6, 0, size*0.6)
    ctx.fillStyle = bodyGradient
    this.drawRoundedRect(ctx, -size*0.22, -size*0.5, size*0.44, size*1.0, 4)

    // 装甲板
    ctx.fillStyle = this.darkenColor(options.color)
    for (let i = 0; i < 3; i++) {
      const y = -size*0.3 + i * size*0.25
      this.drawRoundedRect(ctx, -size*0.2, y, size*0.4, size*0.1, 1)
    }

    // 头盔 - 厚重保护
    ctx.fillStyle = this.createGradient(ctx, '#8B4513', '#654321', 0, -size*0.75, 0, -size*0.5)
    ctx.beginPath()
    ctx.ellipse(0, -size*0.62, size*0.18, size*0.15, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头盔观察窗
    ctx.fillStyle = '#1A1A1A'
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.ellipse(0, -size*0.62, size*0.1, size*0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    // 投弹装置 - 肩部发射器
    ctx.fillStyle = '#2C2C2C'
    this.drawRoundedRect(ctx, -size*0.3, -size*0.4, size*0.15, size*0.2, 2)
    this.drawRoundedRect(ctx, size*0.15, -size*0.4, size*0.15, size*0.2, 2)

    // 发射口发光
    ctx.fillStyle = '#FF8800'
    ctx.shadowColor = '#FF8800'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(-size*0.225, -size*0.3, size*0.04, 0, Math.PI * 2)
    ctx.arc(size*0.225, -size*0.3, size*0.04, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 绘制四肢
    this.drawSoldierLimbs(ctx, size, 0, options.animationState === 'moving')

    // 弹药背包
    ctx.fillStyle = '#4A4A4A'
    this.drawRoundedRect(ctx, -size*0.15, size*0.3, size*0.3, size*0.4, 2)

    // 弹药指示
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#FF0000'
      ctx.beginPath()
      ctx.arc(-size*0.05 + i * size*0.05, size*0.4, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  private drawSummonerEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const float = Math.sin(this.animationTime / 500) * 2
    const mysticalPulse = Math.sin(this.animationTime / 300) * 0.1 + 1

    ctx.save()
    ctx.translate(0, float)
    ctx.scale(mysticalPulse, mysticalPulse)

    // 绘制召唤师身体 - 神秘法袍
    ctx.fillStyle = this.createGradient(ctx, '#7C3AED', '#4C1D95', 0, -size*0.6, 0, size*0.6)
    this.drawRoundedRect(ctx, -size*0.24, -size*0.5, size*0.48, size*1.0, 5)

    // 法袍上的召唤符文
    ctx.fillStyle = '#A78BFA'
    ctx.shadowColor = '#A78BFA'
    ctx.shadowBlur = 3
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + this.animationTime / 800
      const x = Math.cos(angle) * size * 0.15
      const y = Math.sin(angle) * size * 0.25
      ctx.font = `${size * 0.06}px serif`
      ctx.textAlign = 'center'
      const runes = ['召', '唤', '灵', '兽', '魔', '物', '精', '怪']
      ctx.fillText(runes[i], x, y + 3)
    }
    ctx.shadowBlur = 0

    // 召唤师头部 - 兜帽
    ctx.fillStyle = '#5B21B6'
    ctx.beginPath()
    ctx.ellipse(0, -size*0.7, size*0.18, size*0.12, 0, 0, Math.PI * 2)
    ctx.fill()

    // 兜帽阴影
    ctx.fillStyle = '#1E1B4B'
    ctx.beginPath()
    ctx.ellipse(0, -size*0.65, size*0.12, size*0.08, 0, 0, Math.PI * 2)
    ctx.fill()

    // 兜帽下的发光眼睛
    ctx.fillStyle = '#A78BFA'
    ctx.shadowColor = '#A78BFA'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(-size*0.05, -size*0.65, 2, 0, Math.PI * 2)
    ctx.arc(size*0.05, -size*0.65, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 召唤法杖
    ctx.strokeStyle = '#7C3AED'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(size*0.4, -size*0.3)
    ctx.lineTo(size*0.4, size*0.5)
    ctx.stroke()

    // 法杖顶部 - 召唤水晶
    ctx.fillStyle = '#A78BFA'
    ctx.shadowColor = '#A78BFA'
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.arc(size*0.4, -size*0.35, size*0.05, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 水晶内的召唤符文
    ctx.font = `${size * 0.04}px serif`
    ctx.fillStyle = '#FFFFFF'
    ctx.textAlign = 'center'
    ctx.fillText('召', size*0.4, -size*0.32)

    // 召唤能量环
    ctx.strokeStyle = '#A78BFA'
    ctx.lineWidth = 2
    ctx.globalAlpha = 0.6
    for (let i = 0; i < 3; i++) {
      const radius = size * (0.4 + i * 0.1) + Math.sin(this.animationTime / 200 + i) * 3
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // 绘制四肢
    this.drawSoldierLimbs(ctx, size, 0, options.animationState === 'moving')

    ctx.restore()
  }

  private drawPhantomEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const stealthPulse = Math.sin(this.animationTime / 150) * 0.2 + 0.8
    const shadowTrail = Math.sin(this.animationTime / 100) * 2

    ctx.save()
    
    // 隐身效果 - 透明度变化
    ctx.globalAlpha = stealthPulse

    // 绘制幻影身体 - 半透明刺客
    ctx.fillStyle = this.createGradient(ctx, '#9900FF', '#6600AA', 0, -size*0.5, 0, size*0.5)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.25, size * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()

    // 幻影纹路
    ctx.strokeStyle = '#BB00FF'
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.5
    for (let i = 0; i < 6; i++) {
      const y = -size*0.4 + i * size*0.15
      ctx.beginPath()
      ctx.moveTo(-size*0.2, y)
      ctx.lineTo(size*0.2, y)
      ctx.stroke()
    }
    ctx.globalAlpha = stealthPulse

    // 幻影头部 - 兜帽
    ctx.fillStyle = '#7700CC'
    ctx.beginPath()
    ctx.arc(0, -size*0.65, size*0.12, 0, Math.PI * 2)
    ctx.fill()

    // 兜帽下的红色眼睛
    ctx.fillStyle = '#FF0000'
    ctx.shadowColor = '#FF0000'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.arc(-size*0.04, -size*0.65, 1.5, 0, Math.PI * 2)
    ctx.arc(size*0.04, -size*0.65, 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 幻影武器 - 双匕首
    // 左匕首
    ctx.strokeStyle = '#9900FF'
    ctx.lineWidth = 2
    ctx.shadowColor = '#9900FF'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.moveTo(-size*0.3, -size*0.1)
    ctx.lineTo(-size*0.45, size*0.1)
    ctx.stroke()
    ctx.fillStyle = '#BB00FF'
    ctx.beginPath()
    ctx.moveTo(-size*0.45, size*0.1)
    ctx.lineTo(-size*0.4, size*0.15)
    ctx.lineTo(-size*0.35, size*0.12)
    ctx.closePath()
    ctx.fill()
    
    // 右匕首
    ctx.beginPath()
    ctx.moveTo(size*0.3, -size*0.1)
    ctx.lineTo(size*0.45, size*0.1)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(size*0.45, size*0.1)
    ctx.lineTo(size*0.4, size*0.15)
    ctx.lineTo(size*0.35, size*0.12)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // 隐身能量波动
    ctx.strokeStyle = '#9900FF'
    ctx.lineWidth = 1
    ctx.globalAlpha = 0.4
    for (let i = 0; i < 2; i++) {
      const radius = size * (0.3 + i * 0.1) + Math.sin(this.animationTime / 200) * 2
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = stealthPulse

    // 残影效果
    ctx.globalAlpha = 0.3
    for (let i = 1; i <= 3; i++) {
      const offset = -shadowTrail * i * 0.5
      ctx.fillStyle = '#7700CC'
      ctx.beginPath()
      ctx.ellipse(offset, 0, size * 0.2, size * 0.55, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = stealthPulse

    // 绘制四肢 - 修长刺客体型
    this.drawPhantomLimbs(ctx, size, options.animationState === 'moving')

    ctx.restore()
  }

  private drawPhantomLimbs(ctx: CanvasRenderingContext2D, size: number, isMoving: boolean) {
    const limbOffset = isMoving ? Math.sin(this.animationTime / 150) * 2 : 0
    
    // 修长的手臂
    ctx.strokeStyle = '#9900FF'
    ctx.lineWidth = 2
    ctx.shadowColor = '#9900FF'
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.moveTo(-size*0.2, -size*0.15)
    ctx.lineTo(-size*0.4, -size*0.05 + limbOffset)
    ctx.moveTo(size*0.2, -size*0.15)
    ctx.lineTo(size*0.4, -size*0.05 - limbOffset)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 修长的腿部
    ctx.beginPath()
    ctx.moveTo(-size*0.08, size*0.5)
    ctx.lineTo(-size*0.15, size*0.8 + limbOffset)
    ctx.moveTo(size*0.08, size*0.5)
    ctx.lineTo(size*0.15, size*0.8 - limbOffset)
    ctx.stroke()
    
    // 脚部
    ctx.fillStyle = '#7700CC'
    ctx.beginPath()
    ctx.ellipse(-size*0.15, size*0.85 + limbOffset, size*0.04, size*0.02, 0, 0, Math.PI * 2)
    ctx.ellipse(size*0.15, size*0.85 - limbOffset, size*0.04, size*0.02, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawHunterEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size
    const prowl = Math.sin(this.animationTime / 180) * 1

    ctx.save()
    ctx.translate(prowl, 0)

    // 绘制野兽般的身体
    ctx.fillStyle = this.createGradient(ctx, options.color, this.darkenColor(options.color), 0, -size/2, 0, size/2)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.6, size * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()

    // 绘制狼头
    ctx.fillStyle = this.lightenColor(options.color)
    ctx.beginPath()
    ctx.ellipse(-size * 0.3, 0, size * 0.25, size * 0.2, 0, 0, Math.PI * 2)
    ctx.fill()

    // 绘制耳朵
    ctx.fillStyle = options.color
    ctx.beginPath()
    ctx.moveTo(-size * 0.4, -size * 0.15)
    ctx.lineTo(-size * 0.5, -size * 0.3)
    ctx.lineTo(-size * 0.35, -size * 0.25)
    ctx.closePath()
    ctx.moveTo(-size * 0.4, size * 0.15)
    ctx.lineTo(-size * 0.5, size * 0.3)
    ctx.lineTo(-size * 0.35, size * 0.25)
    ctx.closePath()
    ctx.fill()

    // 绘制狼眼 - 发光
    ctx.fillStyle = '#00ff00'
    ctx.shadowColor = '#00ff00'
    ctx.shadowBlur = 5
    ctx.beginPath()
    ctx.arc(-size * 0.45, -size * 0.05, 3, 0, Math.PI * 2)
    ctx.arc(-size * 0.45, size * 0.05, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 绘制尾巴
    this.drawTail(ctx, size)

    // 绘制四肢
    this.drawHunterLimbs(ctx, size)

    ctx.restore()
  }

  private drawBossEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size * 1.5 // Boss更大
    const majesty = Math.sin(this.animationTime / 600) * 5

    ctx.save()
    ctx.scale(1.5, 1.5)
    ctx.translate(0, majesty)

    // 绘制威严的身体
    ctx.fillStyle = this.createGradient(ctx, options.color, this.darkenColor(options.color), 0, -size/2, 0, size/2)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 0.6, size * 1.2, 0, 0, Math.PI * 2)
    ctx.fill()

    // 绘制王冠/头饰
    this.drawCrown(ctx, size)

    // 绘制Boss特有的纹身/符文
    this.drawRunes(ctx, size)

    // 绘制强大的武器
    this.drawBossWeapon(ctx, size)

    // 绘制威严光环
    this.drawMajesticAura(ctx, size)

    ctx.restore()
  }

  // === Boss 专属外观 ===
  private drawCommanderBoss(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size * 2.0 // 优化：更协调的比例
    const breathe = Math.sin(this.animationTime / 500) * 2
    const turretRot = (this.animationTime / 800) % (Math.PI * 2)
    ctx.save()
    ctx.translate(0, breathe)

    // === 主体：重装机甲 - 更协调的流线型设计 ===
    // 主身体（使用圆角矩形，更协调）
    const bodyGradient = ctx.createLinearGradient(0, -size*0.6, 0, size*0.4)
    bodyGradient.addColorStop(0, '#4A4A4A') // 顶部较亮
    bodyGradient.addColorStop(0.5, '#2F2F2F') // 中间
    bodyGradient.addColorStop(1, '#1A1A1A') // 底部较暗
    ctx.fillStyle = bodyGradient
    this.drawRoundedRect(ctx, -size*0.25, -size*0.5, size*0.5, size*1.0, size*0.08)

    // 胸部装甲板（更精致的层次）
    ctx.fillStyle = this.createGradient(ctx, '#6B6B6B', '#4A4A4A', 0, -size*0.3, 0, size*0.1)
    this.drawRoundedRect(ctx, -size*0.22, -size*0.3, size*0.44, size*0.4, size*0.06)
    
    // 中央能源核心（更明显）
    const corePulse = Math.sin(this.animationTime / 300) * 0.3 + 1.0
    ctx.fillStyle = '#FF4444'
    ctx.shadowColor = '#FF4444'
    ctx.shadowBlur = 12
    ctx.beginPath()
    ctx.arc(0, -size*0.05, 6 * corePulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 核心外环
    ctx.strokeStyle = '#FF8888'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, -size*0.05, 8, 0, Math.PI * 2)
    ctx.stroke()

    // 装甲条纹装饰（更精致的细节）
    ctx.strokeStyle = '#FF4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-size*0.2, -size*0.2)
    ctx.lineTo(size*0.2, -size*0.2)
    ctx.moveTo(-size*0.2, 0)
    ctx.lineTo(size*0.2, 0)
    ctx.moveTo(-size*0.15, size*0.2)
    ctx.lineTo(size*0.15, size*0.2)
    ctx.stroke()

    // === 头部：流线型头盔 ===
    const headGradient = ctx.createLinearGradient(0, -size*0.6, 0, -size*0.4)
    headGradient.addColorStop(0, '#5A5A5A')
    headGradient.addColorStop(1, '#3A3A3A')
    ctx.fillStyle = headGradient
    ctx.beginPath()
    ctx.ellipse(0, -size*0.5, size*0.22, size*0.12, 0, 0, Math.PI * 2)
    ctx.fill()

    // 头盔护目镜（更精致的单眼设计）
    ctx.fillStyle = '#1A1A1A'
    ctx.beginPath()
    ctx.ellipse(0, -size*0.48, size*0.18, size*0.08, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 单眼扫描镜（红光闪烁，更柔和）
    const eyePulse = (Math.sin(this.animationTime / 250) * 0.5 + 0.5)
    ctx.fillStyle = `rgba(255, 68, 68, ${0.6 + 0.4*eyePulse})`
    ctx.shadowColor = '#FF4444'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.ellipse(0, -size*0.48, size*0.12, size*0.06, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // === 右肩炮台（更精致的旋转炮台）===
    ctx.save()
    ctx.translate(size*0.28, -size*0.35)
    ctx.rotate(turretRot)
    
    // 炮台基座
    ctx.fillStyle = this.createGradient(ctx, '#555555', '#333333', 0, 0, 10, 0)
    ctx.beginPath()
    ctx.arc(0, 0, 12, 0, Math.PI * 2)
    ctx.fill()
    
    // 炮管
    ctx.fillStyle = '#3A3A3A'
    ctx.fillRect(0, -6, 16, 12)
    
    // 炮口发光
    ctx.fillStyle = '#FF4444'
    ctx.shadowColor = '#FF4444'
    ctx.shadowBlur = 6
    ctx.beginPath()
    ctx.arc(16, 0, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.restore()

    // === 左肩通讯阵列（更精致的天线）===
    ctx.strokeStyle = '#888888'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(-size*0.28, -size*0.35)
    ctx.lineTo(-size*0.28, -size*0.55)
    ctx.stroke()
    
    // 天线顶部
    ctx.fillStyle = '#AAAAAA'
    ctx.beginPath()
    ctx.arc(-size*0.28, -size*0.57, 5, 0, Math.PI * 2)
    ctx.fill()
    
    // 信号指示器
    ctx.fillStyle = '#00B7FF'
    ctx.shadowColor = '#00B7FF'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(-size*0.28, -size*0.57, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // === 右手重型武器（更精致的转轮枪）===
    ctx.save()
    ctx.translate(size*0.15, -size*0.05)
    
    // 枪身
    ctx.fillStyle = this.createGradient(ctx, '#3A3A3A', '#1A1A1A', 0, 0, size*0.3, 0)
    ctx.fillRect(0, -size*0.06, size*0.3, size*0.12)
    
    // 转轮弹仓（更精致的圆形弹仓）
    ctx.fillStyle = '#222222'
    ctx.beginPath()
    ctx.arc(size*0.35, 0, 8, 0, Math.PI * 2)
    ctx.fill()
    
    // 子弹孔
    ctx.fillStyle = '#444444'
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + this.animationTime / 200
      const bulletX = size*0.35 + Math.cos(angle) * 5
      const bulletY = Math.sin(angle) * 5
      ctx.beginPath()
      ctx.arc(bulletX, bulletY, 2, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.restore()

    // === 左手重型塔盾（更精致的盾牌设计）===
    ctx.save()
    ctx.translate(-size*0.35, -size*0.1)
    
    // 盾牌主体（圆角矩形）
    ctx.fillStyle = this.createGradient(ctx, '#C0C0C0', '#888888', 0, 0, 0, size*0.4)
    this.drawRoundedRect(ctx, 0, 0, size*0.15, size*0.4, size*0.03)
    
    // 盾牌边框
    ctx.strokeStyle = '#FF4444'
    ctx.lineWidth = 3
    ctx.strokeRect(-2, -2, size*0.15 + 4, size*0.4 + 4)
    
    // 护盾能量徽记（更精致的圆形徽记）
    ctx.strokeStyle = '#00B7FF'
    ctx.lineWidth = 2
    ctx.shadowColor = '#00B7FF'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(size*0.075, size*0.1, size*0.06, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 内部能量核心
    ctx.fillStyle = '#00B7FF'
    ctx.shadowColor = '#00B7FF'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(size*0.075, size*0.1, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    ctx.restore()

    // === 背部推进器（更精致的推进器）===
    ctx.fillStyle = '#333333'
    ctx.fillRect(-size*0.15, size*0.3, size*0.3, size*0.15)
    
    // 推进器喷口
    const thrustPulse = Math.sin(this.animationTime / 200) * 0.3 + 0.7
    for (let x of [-size*0.08, size*0.08]) {
      ctx.fillStyle = this.createGradient(ctx, '#00AAFF', '#0066AA', x, size*0.45, x, size*0.55)
      ctx.beginPath()
      ctx.ellipse(x, size*0.5, 6, 8 * thrustPulse, 0, 0, Math.PI * 2)
      ctx.fill()
      
      // 推进器核心
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = '#00AAFF'
      ctx.shadowBlur = 4
      ctx.beginPath()
      ctx.arc(x, size*0.5, 3, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // 装甲细节（更精致的铆钉）
    ctx.fillStyle = '#666666'
    for (let x of [-size*0.2, size*0.2]) {
      for (let y of [-size*0.3, 0, size*0.25]) {
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    ctx.restore()
  }

  private drawHiveMotherBoss(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size * 2.0 // 虫巢母体：巨大但紧凑
    const pulse = Math.sin(this.animationTime / 500) * 2
    ctx.save()
    ctx.translate(0, pulse)

    // === 主体：巨大虫巢（椭圆形，类似蜂巢）===
    // 外层深紫几丁质壳
    ctx.fillStyle = '#4B0082'
    ctx.beginPath(); ctx.ellipse(0, 0, size*0.45, size*0.55, 0, 0, Math.PI*2); ctx.fill()
    
    // 内层高光（顶部）
    ctx.fillStyle = '#6B00A8'
    ctx.beginPath(); ctx.ellipse(0, -size*0.15, size*0.42, size*0.25, 0, 0, Math.PI*2); ctx.fill()
    
    // 虫巢纹理（六边形蜂窝结构暗示）
    ctx.strokeStyle = '#2E0055'
    ctx.lineWidth = 2
    for (let i=0;i<3;i++) {
      for (let j=0;j<4;j++) {
        const hexX = -size*0.3 + i*size*0.3
        const hexY = -size*0.3 + j*size*0.2
        ctx.beginPath()
        ctx.arc(hexX, hexY, 8, 0, Math.PI*2)
        ctx.stroke()
      }
    }

    // === 半透明腹部（可见虫卵流动）===
    ctx.globalAlpha = 0.35
    const flow = Math.sin(this.animationTime / 400)
    ctx.fillStyle = '#39FF14'
    ctx.beginPath(); ctx.ellipse(0, size*0.1, size*0.38, size*0.35 + flow*3, 0, 0, Math.PI*2); ctx.fill()
    ctx.globalAlpha = 1
    
    // 虫卵（发光绿色，在腹部流动）
    ctx.fillStyle = '#39FF14'
    ctx.shadowColor = '#39FF14'
    ctx.shadowBlur = 8
    for (let i=0;i<9;i++) { 
      const phase = (i/9)*Math.PI*2 + this.animationTime/600
      const eggX = Math.cos(phase)*size*0.25
      const eggY = size*0.1 + Math.sin(phase)*size*0.15 + flow*5
      ctx.beginPath(); ctx.arc(eggX, eggY, 5, 0, Math.PI*2); ctx.fill() 
    }
    ctx.shadowBlur = 0

    // === 头部：简化口器（小开口）===
    ctx.fillStyle = '#2E0033'
    ctx.beginPath(); ctx.arc(0, -size*0.5, size*0.12, 0, Math.PI*2); ctx.fill()
    // 黏液滴
    ctx.fillStyle = 'rgba(57,255,20,0.7)'
    for (let i=0;i<2;i++) {
      const dropY = -size*0.35 + i*12 + flow*8
      ctx.beginPath(); ctx.arc(0, dropY, 3, 0, Math.PI*2); ctx.fill()
    }

    // === 复眼（6只，紧凑排列在头部）===
    ctx.fillStyle = '#39FF14'
    ctx.shadowColor = '#39FF14'
    ctx.shadowBlur = 6
    for (let i=0;i<6;i++){ 
      const ex = -size*0.15 + i*(size*0.06)
      const ey = -size*0.52
      ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill() 
    }
    ctx.shadowBlur = 0

    // === 3个虫巢出口管道（腹部下方，明显可见）===
    ctx.fillStyle = '#3A0059'
    ctx.strokeStyle = '#2E0055'
    ctx.lineWidth = 2
    for (let i=0;i<3;i++){ 
      const px = -size*0.28 + i*size*0.28
      const py = size*0.35
      // 管道（向下延伸）
      ctx.fillRect(px-10, py, 20, size*0.18)
      ctx.strokeRect(px-10, py, 20, size*0.18)
      // 管道口（发光，间歇性产出）
      const spawnActive = Math.sin(this.animationTime/500 + i*2) > 0.5
      if (spawnActive) {
        ctx.fillStyle = 'rgba(57,255,20,0.8)'
        ctx.shadowColor = '#39FF14'
        ctx.shadowBlur = 10
        ctx.beginPath(); ctx.arc(px, py+size*0.2, 6, 0, Math.PI*2); ctx.fill()
        ctx.shadowBlur = 0
      }
      ctx.fillStyle = '#3A0059'
    }

    // === 节肢足（6只，从身体两侧伸出，支撑虫巢）===
    ctx.strokeStyle = '#4B0082'
    ctx.lineWidth = 4
    for (let i=0;i<6;i++) {
      const legAngle = (i/6)*Math.PI*2
      const legStartX = Math.cos(legAngle)*size*0.4
      const legStartY = Math.sin(legAngle)*size*0.45
      const legEndX = legStartX + Math.cos(legAngle + Math.PI/6)*size*0.2
      const legEndY = legStartY + Math.sin(legAngle + Math.PI/6)*size*0.2
      ctx.beginPath()
      ctx.moveTo(legStartX, legStartY)
      ctx.lineTo(legEndX, legEndY)
      ctx.stroke()
    }

    ctx.restore()
  }

  private drawShadowAssassinBoss(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size * 1.8 // 修长人形，高度3倍
    const stealth = 0.55 + Math.sin(this.animationTime / 220) * 0.25 // 隐身半透明
    const lean = Math.sin(this.animationTime / 500) * 0.15 // 弯腰突袭姿态
    ctx.save()
    ctx.globalAlpha = stealth
    ctx.rotate(lean) // 侧身减少被攻击面积

    // === 修长人形身体（纯黑）===
    ctx.fillStyle = '#000000'
    // 躯干
    ctx.fillRect(-size*0.08, -size*0.4, size*0.16, size*0.6)
    // 头部
    ctx.fillRect(-size*0.1, -size*0.48, size*0.2, size*0.15)
    // 左臂（前伸持刀）
    ctx.fillRect(-size*0.18, -size*0.15, size*0.12, size*0.35)
    // 右臂（后收持刀）
    ctx.fillRect(size*0.06, -size*0.1, size*0.12, size*0.3)
    // 左腿
    ctx.fillRect(-size*0.1, size*0.2, size*0.08, size*0.35)
    // 右腿
    ctx.fillRect(size*0.02, size*0.25, size*0.08, size*0.3)

    // === 白色面具（无表情）===
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(-size*0.08, -size*0.46, size*0.16, size*0.12)
    // 只露红眼（发光）
    ctx.fillStyle = '#8B0000'
    ctx.shadowColor = '#8B0000'
    ctx.shadowBlur = 6
    ctx.beginPath(); ctx.arc(-size*0.03, -size*0.4, 3, 0, Math.PI*2); ctx.fill()
    ctx.beginPath(); ctx.arc(size*0.03, -size*0.4, 3, 0, Math.PI*2); ctx.fill()
    ctx.shadowBlur = 0

    // === 动态披风（边缘粒子化消散）===
    ctx.fillStyle = 'rgba(0,0,0,0.8)'
    ctx.beginPath()
    ctx.moveTo(-size*0.12, -size*0.25)
    ctx.lineTo(-size*0.3, size*0.05)
    ctx.lineTo(-size*0.2, size*0.4)
    ctx.lineTo(size*0.2, size*0.4)
    ctx.lineTo(size*0.3, size*0.05)
    ctx.lineTo(size*0.12, -size*0.25)
    ctx.closePath()
    ctx.fill()
    // 披风边缘粒子（暗紫色，逐渐消散）
    ctx.fillStyle = 'rgba(75,0,130,0.5)'
    for (let i=0;i<10;i++) {
      const px = -size*0.25 + (i/10)*size*0.5
      const py = size*0.35 + Math.sin(this.animationTime/200 + i)*3
      ctx.fillRect(px-1, py, 2, 2)
    }

    // === 双匕首（暗影匕首，红色刀刃高光）===
    // 左匕首（前伸）
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-size*0.22, size*0.05)
    ctx.lineTo(-size*0.38, size*0.2)
    ctx.stroke()
    // 红色刀刃
    ctx.strokeStyle = '#8B0000'
    ctx.lineWidth = 3
    ctx.shadowColor = '#8B0000'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.moveTo(-size*0.24, size*0.08)
    ctx.lineTo(-size*0.4, size*0.22)
    ctx.stroke()
    // 右匕首（后收）
    ctx.beginPath()
    ctx.moveTo(size*0.16, size*0.08)
    ctx.lineTo(size*0.32, size*0.18)
    ctx.stroke()
    ctx.shadowBlur = 0

    // === 残影效果（2-3帧）===
    ctx.globalAlpha = 0.2
    for (let i=1;i<=3;i++) {
      const offset = -i*6
      ctx.fillStyle = '#000000'
      ctx.fillRect(offset-size*0.08, -size*0.4, size*0.16, size*0.6)
      ctx.fillRect(offset-size*0.1, -size*0.48, size*0.2, size*0.15)
    }
    ctx.globalAlpha = stealth

    // === 暗影粒子围绕身体飘散 ===
    ctx.fillStyle = 'rgba(75,0,130,0.6)'
    for (let i=0;i<8;i++) {
      const angle = (i/8)*Math.PI*2 + this.animationTime/300
      const dist = size*0.25 + Math.sin(this.animationTime/200 + i)*5
      const px = Math.cos(angle)*dist
      const py = Math.sin(angle)*dist*0.5
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill()
    }

    ctx.restore()
  }

  private drawChaosConstructBoss(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size * 2.3
    ctx.save()

    // 基于 phase 的三阶段外形（根据血量：100-70%阶段1，70-30%阶段2，30-0%阶段3）
    const healthPercent = options.health / options.maxHealth
    let phase = 1
    if (healthPercent <= 0.3) phase = 3
    else if (healthPercent <= 0.7) phase = 2

    if (phase === 1) {
      // === 阶段一：混沌巨兽（四足石像鬼）===
      const breathe = Math.sin(this.animationTime / 400) * 3
      ctx.translate(0, breathe)
      
      // 花岗岩灰主体（类似石像鬼）
      ctx.fillStyle = '#696969'
      // 身体（粗壮）
      ctx.fillRect(-size*0.3, -size*0.2, size*0.6, size*0.5)
      // 前肢
      ctx.fillRect(-size*0.4, size*0.1, size*0.2, size*0.4)
      ctx.fillRect(size*0.2, size*0.1, size*0.2, size*0.4)
      // 后肢
      ctx.fillRect(-size*0.35, size*0.25, size*0.18, size*0.35)
      ctx.fillRect(size*0.17, size*0.25, size*0.18, size*0.35)
      
      // 头部（尖角）
      ctx.fillRect(-size*0.2, -size*0.4, size*0.4, size*0.25)
      // 尖角
      ctx.beginPath()
      ctx.moveTo(0, -size*0.5)
      ctx.lineTo(-size*0.15, -size*0.4)
      ctx.lineTo(size*0.15, -size*0.4)
      ctx.closePath()
      ctx.fill()
      
      // 熔岩裂纹（橙红色，随攻击闪烁）
      const crackBright = Math.sin(this.animationTime / 300) * 0.3 + 0.7
      ctx.strokeStyle = `rgba(255, 69, 0, ${crackBright})`
      ctx.lineWidth = 3
      ctx.shadowColor = '#FF4500'
      ctx.shadowBlur = 6
      // 裂纹路径
      ctx.beginPath()
      ctx.moveTo(-size*0.25, -size*0.15)
      ctx.lineTo(-size*0.15, size*0.1)
      ctx.lineTo(size*0.1, size*0.15)
      ctx.lineTo(size*0.2, -size*0.1)
      ctx.stroke()
      ctx.shadowBlur = 0
      
      // 眼睛（红色）
      ctx.fillStyle = '#FF0000'
      ctx.beginPath(); ctx.arc(-size*0.08, -size*0.3, 4, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc(size*0.08, -size*0.3, 4, 0, Math.PI*2); ctx.fill()

    } else if (phase === 2) {
      // === 阶段二：混沌织法者（漂浮法球）===
      const float = Math.sin(this.animationTime / 500) * 5
      ctx.translate(0, float)
      
      // 法球主体（深蓝色能量核心）
      const coreR = size*0.25
      const grad = ctx.createRadialGradient(0, 0, coreR*0.2, 0, 0, coreR)
      grad.addColorStop(0, '#FFFFFF')
      grad.addColorStop(0.4, '#00A8FF')
      grad.addColorStop(1, '#00008B')
      ctx.fillStyle = grad
      ctx.shadowColor = '#00A8FF'
      ctx.shadowBlur = 12
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0
      
      // 旋转的符文环（2层）
      const rotAngle = this.animationTime / 600
      ctx.strokeStyle = '#00A8FF'
      ctx.lineWidth = 3
      ctx.shadowColor = '#00A8FF'
      ctx.shadowBlur = 4
      for (let i=1;i<=2;i++) {
        ctx.save()
        ctx.rotate(rotAngle * i)
        const r = coreR + i*15
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.stroke()
        // 符文标记（4个）
        for (let j=0;j<4;j++) {
          const ang = (j/4)*Math.PI*2
          ctx.fillStyle = '#FFFFFF'
          ctx.beginPath(); ctx.arc(Math.cos(ang)*r, Math.sin(ang)*r, 4, 0, Math.PI*2); ctx.fill()
        }
        ctx.restore()
      }
      ctx.shadowBlur = 0
      
      // 电弧效果（随机闪烁）
      if (Math.sin(this.animationTime / 200) > 0.7) {
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        for (let i=0;i<3;i++) {
          const ang = Math.random()*Math.PI*2
          ctx.beginPath()
          ctx.moveTo(Math.cos(ang)*coreR, Math.sin(ang)*coreR)
          ctx.lineTo(Math.cos(ang)*(coreR+30), Math.sin(ang)*(coreR+30))
          ctx.stroke()
        }
      }

    } else {
      // === 阶段三：混沌本源（几何能量体）===
      // 彩虹色渐变（每秒循环变化）
      const t = (this.animationTime/1000) % 1
      const hue = Math.floor(t * 360)
      const colors = ['#FF0000','#FF8800','#FFFF00','#00FF00','#00FFFF','#0088FF','#8800FF','#FF00FF']
      const colorIdx = Math.floor(t * colors.length) % colors.length
      
      ctx.globalAlpha = 0.95
      // 多层同心圆（不断变形）
      for (let i=0;i<8;i++){
        const baseR = size*0.08 + i*5
        const morph = Math.sin(this.animationTime/300 + i)*3
        const r = baseR + morph
        const color = colors[(colorIdx + i) % colors.length]
        ctx.fillStyle = color
        ctx.shadowColor = color
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill()
      }
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1
      
      // 中心星形核心
      ctx.fillStyle = '#FFFFFF'
      ctx.shadowColor = '#FFFFFF'
      ctx.shadowBlur = 12
      ctx.beginPath()
      for (let i=0;i<8;i++) {
        const ang = (i/8)*Math.PI*2
        const r = size*0.06 + Math.sin(this.animationTime/200 + i)*2
        const x = Math.cos(ang)*r
        const y = Math.sin(ang)*r
        if (i===0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.shadowBlur = 0
    }

    ctx.restore()
  }

  private drawDefaultEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    // 基础敌人渲染
    ctx.fillStyle = this.createGradient(ctx, options.color, this.darkenColor(options.color), 0, -options.size/2, 0, options.size/2)
    ctx.beginPath()
    ctx.arc(0, 0, options.size * 0.4, 0, Math.PI * 2)
    ctx.fill()
  }

  // 辅助绘制方法
  private drawSimpleLimbs(ctx: CanvasRenderingContext2D, size: number, animFrame: number, isMoving: boolean) {
    const limbOffset = isMoving ? Math.sin(this.animationTime / 200) * 3 : 0
    
    ctx.fillStyle = this.darkenColor('#444444')
    // 手臂
    ctx.fillRect(-size * 0.6, -size * 0.2, size * 0.25, size * 0.1)
    ctx.fillRect(size * 0.35, -size * 0.2, size * 0.25, size * 0.1)
    
    // 腿部
    ctx.fillRect(-size * 0.15, size * 0.3, size * 0.1, size * 0.4 + limbOffset)
    ctx.fillRect(size * 0.05, size * 0.3, size * 0.1, size * 0.4 - limbOffset)
  }

  private drawBasicWeapon(ctx: CanvasRenderingContext2D, size: number) {
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(size * 0.6, 0)
    ctx.lineTo(size * 0.9, 0)
    ctx.stroke()
    
    ctx.fillStyle = '#C0C0C0'
    ctx.beginPath()
    ctx.arc(size * 0.9, 0, 2, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawBugLegs(ctx: CanvasRenderingContext2D, size: number) {
    ctx.strokeStyle = this.darkenColor('#44ff44')
    ctx.lineWidth = 2
    
    for (let i = 0; i < 6; i++) {
      const side = i < 3 ? -1 : 1
      const legIndex = i % 3
      const angle = (legIndex / 2) * Math.PI * 0.5 - Math.PI * 0.25
      const legX = side * size * 0.3
      const legY = (legIndex - 1) * size * 0.2
      
      ctx.beginPath()
      ctx.moveTo(legX, legY)
      ctx.lineTo(legX + side * Math.cos(angle) * size * 0.4, legY + Math.sin(angle) * size * 0.3)
      ctx.stroke()
    }
  }

  private drawSpeedLines(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save()
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1
    
    for (let i = 0; i < 5; i++) {
      const y = -size * 0.3 + i * size * 0.15
      ctx.beginPath()
      ctx.moveTo(size * 0.6, y)
      ctx.lineTo(size * 0.9, y)
      ctx.stroke()
    }
    
    ctx.restore()
  }

  private drawRunnerLimbs(ctx: CanvasRenderingContext2D, size: number) {
    const runCycle = Math.sin(this.animationTime / 100) * 0.3
    
    ctx.strokeStyle = this.darkenColor('#ff4444')
    ctx.lineWidth = 3
    
    // 强化腿部
    ctx.beginPath()
    ctx.moveTo(-size * 0.15, size * 0.2)
    ctx.lineTo(-size * 0.2 + runCycle, size * 0.6)
    ctx.moveTo(size * 0.15, size * 0.2)
    ctx.lineTo(size * 0.2 - runCycle, size * 0.6)
    ctx.stroke()
  }

  private drawBow(ctx: CanvasRenderingContext2D, size: number, isAttacking: boolean) {
    const bowTension = isAttacking ? 15 : 20
    
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(size * 0.4, 0, bowTension, -Math.PI/3, Math.PI/3, false)
    ctx.stroke()
    
    // 弓弦
    ctx.strokeStyle = '#f4f4f4'
    ctx.lineWidth = 1
    const stringCurve = isAttacking ? size * 0.1 : size * 0.05
    ctx.beginPath()
    ctx.moveTo(size * 0.3, -size * 0.35)
    ctx.quadraticCurveTo(size * 0.2 - stringCurve, 0, size * 0.3, size * 0.35)
    ctx.stroke()
    
    // 箭（攻击时）
    if (isAttacking) {
      ctx.strokeStyle = '#8B4513'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(size * 0.15 - stringCurve, 0)
      ctx.lineTo(size * 0.6, 0)
      ctx.stroke()
    }
  }

  private drawQuiver(ctx: CanvasRenderingContext2D, size: number) {
    ctx.fillStyle = '#654321'
    ctx.fillRect(-size * 0.4, size * 0.1, size * 0.15, size * 0.4)
    
    // 箭羽
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = ['#ff0000', '#00ff00', '#0000ff'][i]
      ctx.beginPath()
      ctx.arc(-size * 0.32, size * 0.15 + i * 0.1 * size, 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawShield(ctx: CanvasRenderingContext2D, size: number) {
    // 大盾牌
    ctx.fillStyle = this.createGradient(ctx, '#C0C0C0', '#808080', -size * 0.3, 0, -size * 0.6, 0)
    ctx.beginPath()
    ctx.ellipse(-size * 0.45, 0, size * 0.25, size * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 盾牌装饰
    ctx.strokeStyle = '#FFD700'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(-size * 0.45, 0, size * 0.15, 0, Math.PI * 2)
    ctx.stroke()
    
    // 盾牌边缘
    ctx.strokeStyle = '#654321'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.ellipse(-size * 0.45, 0, size * 0.25, size * 0.6, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  private drawMelee(ctx: CanvasRenderingContext2D, size: number) {
    // 近战武器
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(size * 0.2, 0)
    ctx.lineTo(size * 0.7, 0)
    ctx.stroke()
    
    ctx.fillStyle = '#C0C0C0'
    ctx.beginPath()
    ctx.arc(size * 0.7, 0, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  private drawArmor(ctx: CanvasRenderingContext2D, size: number) {
    ctx.strokeStyle = '#C0C0C0'
    ctx.lineWidth = 2
    
    // 胸甲线条
    for (let i = 0; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(-size * 0.2, -size * 0.3 + i * size * 0.15)
      ctx.lineTo(size * 0.2, -size * 0.3 + i * size * 0.15)
      ctx.stroke()
    }
  }

  private drawBruteLimbs(ctx: CanvasRenderingContext2D, size: number) {
    ctx.fillStyle = this.darkenColor('#ff4444')
    
    // 巨大手臂
    ctx.fillRect(-size * 0.8, -size * 0.3, size * 0.3, size * 0.2)
    ctx.fillRect(size * 0.5, -size * 0.3, size * 0.3, size * 0.2)
    
    // 巨大拳头
    ctx.beginPath()
    ctx.arc(-size * 0.9, -size * 0.2, size * 0.1, 0, Math.PI * 2)
    ctx.arc(size * 0.9, -size * 0.2, size * 0.1, 0, Math.PI * 2)
    ctx.fill()
    
    // 粗壮腿部
    ctx.fillRect(-size * 0.2, size * 0.5, size * 0.15, size * 0.4)
    ctx.fillRect(size * 0.05, size * 0.5, size * 0.15, size * 0.4)
  }

  private drawSniperRifle(ctx: CanvasRenderingContext2D, size: number) {
    // 超长狙击枪
    ctx.strokeStyle = '#2c3e50'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(size * 0.3, 0)
    ctx.lineTo(size * 1.2, 0)
    ctx.stroke()
    
    // 瞄准镜
    ctx.strokeStyle = '#7f8c8d'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(size * 0.6, -size * 0.1, 6, 0, Math.PI * 2)
    ctx.stroke()
    
    // 消音器
    ctx.fillStyle = '#34495e'
    ctx.fillRect(size * 1.1, -size * 0.05, size * 0.15, size * 0.1)
  }

  private drawHealingAura(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save()
    ctx.globalAlpha = 0.4
    
    const auraSize = size + Math.sin(this.animationTime / 300) * 10
    const gradient = ctx.createRadialGradient(0, 0, size * 0.3, 0, 0, auraSize)
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.8)')
    gradient.addColorStop(0.5, 'rgba(0, 255, 0, 0.4)')
    gradient.addColorStop(1, 'rgba(0, 255, 0, 0)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, auraSize, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
  }

  private drawStaff(ctx: CanvasRenderingContext2D, size: number) {
    // 法杖杆
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(size * 0.4, size * 0.2)
    ctx.lineTo(size * 0.4, -size * 0.6)
    ctx.stroke()
    
    // 法杖头部宝石
    ctx.fillStyle = '#00ff00'
    ctx.shadowColor = '#00ff00'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(size * 0.4, -size * 0.7, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private drawTail(ctx: CanvasRenderingContext2D, size: number) {
    const tailWag = Math.sin(this.animationTime / 150) * 0.3
    
    ctx.strokeStyle = this.darkenColor('#654321')
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(size * 0.5, 0)
    ctx.quadraticCurveTo(size * 0.8 + tailWag, size * 0.3, size * 0.9, size * 0.6 + tailWag)
    ctx.stroke()
  }

  private drawHunterLimbs(ctx: CanvasRenderingContext2D, size: number) {
    const prowlCycle = Math.sin(this.animationTime / 200) * 0.2
    
    ctx.strokeStyle = this.darkenColor('#654321')
    ctx.lineWidth = 3
    
    // 四足动物的腿
    ctx.beginPath()
    // 前腿
    ctx.moveTo(-size * 0.1, size * 0.2)
    ctx.lineTo(-size * 0.15 + prowlCycle, size * 0.5)
    ctx.moveTo(size * 0.1, size * 0.2)
    ctx.lineTo(size * 0.15 - prowlCycle, size * 0.5)
    // 后腿
    ctx.moveTo(size * 0.3, size * 0.2)
    ctx.lineTo(size * 0.35 + prowlCycle, size * 0.5)
    ctx.moveTo(size * 0.5, size * 0.2)
    ctx.lineTo(size * 0.55 - prowlCycle, size * 0.5)
    ctx.stroke()
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
  
  private drawZombieLimbs(ctx: CanvasRenderingContext2D, size: number, animFrame: number, isMoving: boolean) {
    const limbOffset = isMoving ? Math.sin(this.animationTime / 200) * 2 : 0
    
    // 僵硬的僵尸手臂 - 更匀称
    ctx.fillStyle = '#8FBC8F'
    ctx.fillRect(-size * 0.5, -size * 0.1, size * 0.15, size * 0.06)
    ctx.fillRect(size * 0.35, -size * 0.1, size * 0.15, size * 0.06)
    
    // 手臂上的腐败斑点
    ctx.fillStyle = '#556B2F'
    ctx.beginPath()
    ctx.arc(-size * 0.42, -size * 0.07, 1, 0, Math.PI * 2)
    ctx.arc(size * 0.42, -size * 0.07, 1, 0, Math.PI * 2)
    ctx.fill()
    
    // 僵硬的腿部 - 更细长匀称
    ctx.fillStyle = '#2F4F4F'
    ctx.fillRect(-size * 0.08, size * 0.5, size * 0.06, size * 0.3 + limbOffset * 0.5)
    ctx.fillRect(size * 0.02, size * 0.5, size * 0.06, size * 0.3 - limbOffset * 0.5)
    
    // 破烂的鞋子 - 合理尺寸
    ctx.fillStyle = '#1C1C1C'
    ctx.fillRect(-size * 0.1, size * 0.75 + limbOffset * 0.5, size * 0.12, size * 0.04)
    ctx.fillRect(-size * 0.02, size * 0.75 - limbOffset * 0.5, size * 0.12, size * 0.04)
  }
  
  private drawSoldierLimbs(ctx: CanvasRenderingContext2D, size: number, animFrame: number, isMoving: boolean) {
    const limbSwing = isMoving ? Math.sin(this.animationTime / 100) * 3 : 0
    
    // 装甲手臂 - 现代化护甲
    ctx.fillStyle = this.createGradient(ctx, '#4A5568', '#2D3748', 0, 0, size * 0.2, 0)
    this.drawRoundedRect(ctx, -size * 0.48, -size * 0.12 + limbSwing * 0.3, size * 0.16, size * 0.08, 2)
    this.drawRoundedRect(ctx, size * 0.32, -size * 0.12 - limbSwing * 0.3, size * 0.16, size * 0.08, 2)
    
    // 护甲装饰条
    ctx.strokeStyle = '#68D391'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(-size * 0.46, -size * 0.08 + limbSwing * 0.3)
    ctx.lineTo(-size * 0.34, -size * 0.08 + limbSwing * 0.3)
    ctx.moveTo(size * 0.34, -size * 0.08 - limbSwing * 0.3)
    ctx.lineTo(size * 0.46, -size * 0.08 - limbSwing * 0.3)
    ctx.stroke()
    
    // 战术手套
    ctx.fillStyle = '#2D3748'
    ctx.beginPath()
    ctx.arc(-size * 0.5, -size * 0.08 + limbSwing * 0.3, size * 0.03, 0, Math.PI * 2)
    ctx.arc(size * 0.5, -size * 0.08 - limbSwing * 0.3, size * 0.03, 0, Math.PI * 2)
    ctx.fill()
    
    // 装甲腿部 - 保护性装备
    ctx.fillStyle = this.createGradient(ctx, '#4A5568', '#2D3748', 0, size * 0.5, 0, size * 0.8)
    this.drawRoundedRect(ctx, -size * 0.09, size * 0.5, size * 0.08, size * 0.3 + limbSwing * 0.5, 2)
    this.drawRoundedRect(ctx, size * 0.01, size * 0.5, size * 0.08, size * 0.3 - limbSwing * 0.5, 2)
    
    // 战术靴 - 现代军靴
    ctx.fillStyle = '#1A202C'
    this.drawRoundedRect(ctx, -size * 0.11, size * 0.77 + limbSwing * 0.5, size * 0.14, size * 0.06, 2)
    this.drawRoundedRect(ctx, -size * 0.03, size * 0.77 - limbSwing * 0.5, size * 0.14, size * 0.06, 2)
    
    // 靴子装饰
    ctx.strokeStyle = '#68D391'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(-size * 0.04, size * 0.8 + limbSwing * 0.5)
    ctx.lineTo(size * 0.04, size * 0.8 + limbSwing * 0.5)
    ctx.moveTo(-size * 0.04, size * 0.8 - limbSwing * 0.5)
    ctx.lineTo(size * 0.04, size * 0.8 - limbSwing * 0.5)
    ctx.stroke()
  }

  private drawModernWeapon(ctx: CanvasRenderingContext2D, size: number) {
    // 现代步枪 - 战术步枪
    ctx.strokeStyle = '#2D3748'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(size * 0.5, -size * 0.05)
    ctx.lineTo(size * 0.8, -size * 0.05)
    ctx.stroke()
    
    // 枪身主体
    ctx.fillStyle = this.createGradient(ctx, '#4A5568', '#2D3748', size * 0.5, 0, size * 0.8, 0)
    this.drawRoundedRect(ctx, size * 0.5, -size * 0.08, size * 0.3, size * 0.06, 1)
    
    // 瞄准镜
    ctx.fillStyle = '#1A202C'
    ctx.beginPath()
    ctx.arc(size * 0.65, -size * 0.12, size * 0.02, 0, Math.PI * 2)
    ctx.fill()
    
    // 瞄准镜发光
    ctx.fillStyle = '#68D391'
    ctx.shadowColor = '#68D391'
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.arc(size * 0.65, -size * 0.12, size * 0.01, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 枪口抑制器
    ctx.fillStyle = '#2D3748'
    this.drawRoundedRect(ctx, size * 0.78, -size * 0.06, size * 0.08, size * 0.02, 1)
    
    // 战术装饰条纹
    ctx.strokeStyle = '#68D391'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const x = size * (0.52 + i * 0.06)
      ctx.moveTo(x, -size * 0.07)
      ctx.lineTo(x, -size * 0.03)
    }
    ctx.stroke()
  }

  private drawAncientWeapon(ctx: CanvasRenderingContext2D, size: number) {
    // 古代生锈的刀剑
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(size * 0.5, 0)
    ctx.lineTo(size * 0.75, 0)
    ctx.stroke()
    
    // 锈迹斑斑的刀身
    ctx.fillStyle = '#A0522D'
    ctx.beginPath()
    ctx.moveTo(size * 0.75, 0)
    ctx.lineTo(size * 0.8, -2)
    ctx.lineTo(size * 0.8, 2)
    ctx.closePath()
    ctx.fill()
    
    // 刀身上的血迹
    ctx.fillStyle = '#8B0000'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(size * (0.77 + i * 0.01), Math.sin(i) * 0.5, 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // 剑柄符文装饰
    ctx.font = `${size * 0.06}px serif`
    ctx.fillStyle = '#DC143C'
    ctx.textAlign = 'center'
    ctx.fillText('煞', size * 0.55, 2)
  }
  
  private drawGhostTail(ctx: CanvasRenderingContext2D, size: number, speedEffect: number) {
    ctx.globalAlpha = 0.6
    
    // 绘制飘逸的鬼魅下身
    for (let i = 0; i < 5; i++) {
      const waveOffset = this.animationTime / 300 + i * 0.3
      const x = Math.sin(waveOffset) * (i + 1) * 0.5
      const y = size * 0.3 + i * size * 0.08
      const tailSize = size * (0.15 - i * 0.02)
      
      ctx.fillStyle = `rgba(47, 47, 47, ${0.6 - i * 0.1})`
      ctx.beginPath()
      ctx.ellipse(x, y, tailSize, tailSize * 0.6, 0, 0, Math.PI * 2)
      ctx.fill()
    }
    
    ctx.globalAlpha = 1
  }
  
  private drawMysticStaff(ctx: CanvasRenderingContext2D, size: number, isAttacking: boolean) {
    // 法杖杖身
    ctx.strokeStyle = '#8B4513'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(size * 0.4, -size * 0.2)
    ctx.lineTo(size * 0.4, size * 0.5)
    ctx.stroke()
    
    // 法杖顶端的邪恶宝珠
    ctx.fillStyle = '#8B0000'
    ctx.shadowColor = '#8B0000'
    ctx.shadowBlur = isAttacking ? 8 : 4
    ctx.beginPath()
    ctx.arc(size * 0.4, -size * 0.25, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 宝珠内的邪恶印记
    ctx.fillStyle = '#000000'
    ctx.font = `${size * 0.03}px serif`
    ctx.textAlign = 'center'
    ctx.fillText('煞', size * 0.4, -size * 0.22)
    
    // 施法时的能量光环
    if (isAttacking) {
      ctx.strokeStyle = '#FF4500'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(size * 0.4, -size * 0.25, 6 + Math.sin(this.animationTime / 100) * 2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  
  private drawTalismanPouch(ctx: CanvasRenderingContext2D, size: number) {
    // 符袋
    ctx.fillStyle = '#654321'
    ctx.beginPath()
    ctx.ellipse(-size * 0.3, size * 0.2, size * 0.08, size * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // 符袋装饰
    ctx.strokeStyle = '#DAA520'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.ellipse(-size * 0.3, size * 0.2, size * 0.08, size * 0.12, 0, 0, Math.PI * 2)
    ctx.stroke()
    
    // 符袋上的符文
    ctx.font = `${size * 0.04}px serif`
    ctx.fillStyle = '#DAA520'
    ctx.textAlign = 'center'
    ctx.fillText('符', -size * 0.3, size * 0.23)
  }
  
  private drawFloatingTalismans(ctx: CanvasRenderingContext2D, size: number) {
    // 施法时飘散的符纸
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + this.animationTime / 200
      const distance = size * 0.6 + Math.sin(this.animationTime / 150 + i) * size * 0.2
      const x = Math.cos(angle) * distance
      const y = Math.sin(angle) * distance
      
      ctx.save()
      ctx.globalAlpha = 0.7
      ctx.translate(x, y)
      ctx.rotate(this.animationTime / 300 + i)
      
      ctx.fillStyle = '#FFFACD'
      ctx.fillRect(-3, -4, 6, 8)
      ctx.strokeStyle = '#8B0000'
      ctx.lineWidth = 1
      ctx.strokeRect(-3, -4, 6, 8)
      
      ctx.font = `${size * 0.03}px serif`
      ctx.fillStyle = '#8B0000'
      ctx.textAlign = 'center'
      const talismanText = ['咒', '法', '诛'][i]
      ctx.fillText(talismanText, 0, 1)
      
      ctx.restore()
    }
  }
  
  private drawMysticShield(ctx: CanvasRenderingContext2D, size: number, pulse: number) {
    // 护法法盾 - 八卦镜盾
    ctx.save()
    ctx.translate(-size * 0.4, 0)
    
    // 盾面
    ctx.fillStyle = '#B8860B'
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.3 * pulse, 0, Math.PI * 2)
    ctx.fill()
    
    // 八卦图案
    ctx.strokeStyle = '#8B0000'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2)
    ctx.stroke()
    
    // 阴阳太极
    ctx.fillStyle = '#000000'
    ctx.beginPath()
    ctx.arc(-size * 0.05, 0, size * 0.1, Math.PI/2, Math.PI*1.5)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(size * 0.05, 0, size * 0.1, -Math.PI/2, Math.PI/2)
    ctx.fill()
    
    // 盾边符文
    ctx.font = `${size * 0.04}px serif`
    ctx.fillStyle = '#8B0000'
    ctx.textAlign = 'center'
    const directions = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤']
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const x = Math.cos(angle) * size * 0.25
      const y = Math.sin(angle) * size * 0.25
      ctx.fillText(directions[i], x, y + 2)
    }
    
    ctx.restore()
  }
  
  private drawDemonSubduingStaff(ctx: CanvasRenderingContext2D, size: number) {
    // 降魔杵
    ctx.save()
    ctx.translate(size * 0.35, size * 0.1)
    
    // 杵身
    ctx.strokeStyle = '#B8860B'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.3)
    ctx.lineTo(0, size * 0.4)
    ctx.stroke()
    
    // 杵头 - 金刚铃
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    ctx.arc(0, -size * 0.32, size * 0.08, 0, Math.PI * 2)
    ctx.fill()
    
    // 杵尾
    ctx.fillStyle = '#B8860B'
    ctx.beginPath()
    ctx.arc(0, size * 0.42, size * 0.06, 0, Math.PI * 2)
    ctx.fill()
    
    // 降魔咒文
    ctx.font = `${size * 0.03}px serif`
    ctx.fillStyle = '#8B0000'
    ctx.textAlign = 'center'
    ctx.fillText('降', 0, size * 0.15)
    
    ctx.restore()
  }
  
  private drawGlowingRunes(ctx: CanvasRenderingContext2D, size: number, pulse: number) {
    // 爆破符文发光效果
    ctx.shadowColor = '#FF0000'
    ctx.shadowBlur = 8 + pulse * 2
    ctx.fillStyle = '#FF4500'
    ctx.font = `${size * 0.08}px serif`
    ctx.textAlign = 'center'
    
    const glowRunes = ['爆', '炸', '轰']
    for (let i = 0; i < 3; i++) {
      const y = -size * 0.2 + i * size * 0.25
      ctx.fillText(glowRunes[i], 0, y)
    }
    
    ctx.shadowBlur = 0
  }
  
  private drawMechLegs(ctx: CanvasRenderingContext2D, size: number) {
    const legMovement = Math.sin(this.animationTime / 100) * 2
    
    // 绘制6条机械腿 - 对称布局
    for (let i = 0; i < 6; i++) {
      const baseAngle = (i / 6) * Math.PI * 2
      const legOffset = (i % 2) * legMovement  // 交替移动创造爬行效果
      
      ctx.strokeStyle = this.createGradient(ctx, '#4A5568', '#2D3748', 0, 0, size * 0.4, 0)
      ctx.lineWidth = 2
      
      // 腿部分段
      ctx.beginPath()
      const segment1X = Math.cos(baseAngle) * size * 0.25
      const segment1Y = Math.sin(baseAngle) * size * 0.15
      const segment2X = Math.cos(baseAngle) * size * 0.4
      const segment2Y = Math.sin(baseAngle) * size * 0.25 + legOffset
      
      ctx.moveTo(segment1X * 0.6, segment1Y * 0.6)
      ctx.lineTo(segment1X, segment1Y)
      ctx.lineTo(segment2X, segment2Y)
      ctx.stroke()
      
      // 腿部关节
      ctx.fillStyle = '#2D3748'
      ctx.beginPath()
      ctx.arc(segment1X, segment1Y, 1.5, 0, Math.PI * 2)
      ctx.fill()
      
      // 腿部末端 - 尖爪
      ctx.fillStyle = '#68D391'
      ctx.shadowColor = '#68D391'
      ctx.shadowBlur = 2
      ctx.beginPath()
      ctx.arc(segment2X, segment2Y, 1, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      
      // 机械装饰线
      ctx.strokeStyle = '#68D391'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(segment1X * 0.8, segment1Y * 0.8)
      ctx.lineTo(segment1X * 1.2, segment1Y * 1.2)
      ctx.stroke()
    }
  }

  private drawUnifiedLimbs(ctx: CanvasRenderingContext2D, size: number, animFrame: number, isMoving: boolean, primaryColor: string, accentColor: string) {
    const limbSwing = isMoving ? Math.sin(this.animationTime / 100) * 3 : 0
    
    // 机甲手臂装甲 - 厚重外骨骼
    // 上臂装甲
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', primaryColor, 0, 0, size * 0.25, 0)
    this.drawRoundedRect(ctx, -size * 0.52, -size * 0.15 + limbSwing * 0.3, size * 0.18, size * 0.1, 2)
    this.drawRoundedRect(ctx, size * 0.34, -size * 0.15 - limbSwing * 0.3, size * 0.18, size * 0.1, 2)
    
    // 前臂装甲
    ctx.fillStyle = this.createGradient(ctx, primaryColor, this.darkenColor(primaryColor), 0, 0, size * 0.2, 0)
    this.drawRoundedRect(ctx, -size * 0.5, -size * 0.08 + limbSwing * 0.3, size * 0.14, size * 0.06, 2)
    this.drawRoundedRect(ctx, size * 0.36, -size * 0.08 - limbSwing * 0.3, size * 0.14, size * 0.06, 2)
    
    // 手臂能源线路
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.moveTo(-size * 0.48, -size * 0.1 + limbSwing * 0.3)
    ctx.lineTo(-size * 0.38, -size * 0.1 + limbSwing * 0.3)
    ctx.moveTo(size * 0.38, -size * 0.1 - limbSwing * 0.3)
    ctx.lineTo(size * 0.48, -size * 0.1 - limbSwing * 0.3)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 机甲手部 - 机械爪
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 0, 0, size * 0.15, 0)
    this.drawRoundedRect(ctx, -size * 0.55, -size * 0.05 + limbSwing * 0.3, size * 0.08, size * 0.05, 1)
    this.drawRoundedRect(ctx, size * 0.47, -size * 0.05 - limbSwing * 0.3, size * 0.08, size * 0.05, 1)
    
    // 手部发光能源
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.arc(-size * 0.51, -size * 0.025 + limbSwing * 0.3, size * 0.02, 0, Math.PI * 2)
    ctx.arc(size * 0.51, -size * 0.025 - limbSwing * 0.3, size * 0.02, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    
    // 机甲腿部装甲 - 厚重装甲
    // 大腿装甲
    ctx.fillStyle = this.createGradient(ctx, '#9CA3AF', primaryColor, 0, size * 0.5, 0, size * 0.8)
    this.drawRoundedRect(ctx, -size * 0.12, size * 0.5, size * 0.1, size * 0.35 + limbSwing * 0.5, 2)
    this.drawRoundedRect(ctx, size * 0.02, size * 0.5, size * 0.1, size * 0.35 - limbSwing * 0.5, 2)
    
    // 小腿装甲
    ctx.fillStyle = this.createGradient(ctx, primaryColor, this.darkenColor(primaryColor), 0, size * 0.75, 0, size * 0.9)
    this.drawRoundedRect(ctx, -size * 0.1, size * 0.75 + limbSwing * 0.5, size * 0.08, size * 0.15, 2)
    this.drawRoundedRect(ctx, size * 0.02, size * 0.75 - limbSwing * 0.5, size * 0.08, size * 0.15, 2)
    
    // 腿部能源线路
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 1
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 2
    ctx.beginPath()
    ctx.moveTo(-size * 0.07, size * 0.55)
    ctx.lineTo(-size * 0.07, size * 0.8)
    ctx.moveTo(size * 0.07, size * 0.55)
    ctx.lineTo(size * 0.07, size * 0.8)
    ctx.stroke()
    ctx.shadowBlur = 0
    
    // 机甲靴 - 厚重推进靴
    ctx.fillStyle = this.createGradient(ctx, '#6B7280', '#374151', 0, size * 0.85, 0, size * 0.95)
    this.drawRoundedRect(ctx, -size * 0.14, size * 0.85 + limbSwing * 0.5, size * 0.12, size * 0.08, 2)
    this.drawRoundedRect(ctx, size * 0.02, size * 0.85 - limbSwing * 0.5, size * 0.12, size * 0.08, 2)
    
    // 靴底推进器
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.ellipse(-size * 0.08, size * 0.93 + limbSwing * 0.5, size * 0.04, size * 0.02, 0, 0, Math.PI * 2)
    ctx.ellipse(size * 0.08, size * 0.93 - limbSwing * 0.5, size * 0.04, size * 0.02, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
  }

  private drawUnifiedWeapon(ctx: CanvasRenderingContext2D, size: number, weaponType: string, primaryColor: string, accentColor: string) {
    ctx.save()
    
    switch (weaponType) {
      case 'heavy':
        // 重型武器
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.moveTo(size * 0.5, -size * 0.1)
        ctx.lineTo(size * 0.85, -size * 0.1)
        ctx.stroke()
        
        ctx.fillStyle = primaryColor
        this.drawRoundedRect(ctx, size * 0.5, -size * 0.12, size * 0.35, size * 0.04, 1)
        break
        
      case 'smg':
        // 冲锋枪
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(size * 0.5, -size * 0.05)
        ctx.lineTo(size * 0.75, -size * 0.05)
        ctx.stroke()
        
        ctx.fillStyle = primaryColor
        this.drawRoundedRect(ctx, size * 0.5, -size * 0.08, size * 0.25, size * 0.06, 1)
        break
        
      case 'sniper':
        // 狙击步枪
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(size * 0.5, -size * 0.03)
        ctx.lineTo(size * 0.9, -size * 0.03)
        ctx.stroke()
        
        // 瞄准镜
        ctx.fillStyle = accentColor
        ctx.beginPath()
        ctx.arc(size * 0.7, -size * 0.08, size * 0.02, 0, Math.PI * 2)
        ctx.fill()
        break
        
      case 'shield':
        // 盾牌
        ctx.fillStyle = primaryColor
        ctx.beginPath()
        ctx.ellipse(size * 0.6, 0, size * 0.15, size * 0.25, 0, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(size * 0.6, 0, size * 0.1, 0, Math.PI * 2)
        ctx.stroke()
        break
        
      case 'grenade':
        // 手雷
        ctx.fillStyle = primaryColor
        ctx.beginPath()
        ctx.arc(size * 0.55, -size * 0.05, size * 0.04, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.strokeStyle = accentColor
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(size * 0.55, -size * 0.05, size * 0.03, 0, Math.PI * 2)
        ctx.stroke()
        break
        
      default:
        // 标准步枪
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(size * 0.5, -size * 0.05)
        ctx.lineTo(size * 0.8, -size * 0.05)
        ctx.stroke()
        
        ctx.fillStyle = primaryColor
        this.drawRoundedRect(ctx, size * 0.5, -size * 0.08, size * 0.3, size * 0.06, 1)
    }
    
    ctx.restore()
  }

  private drawCrown(ctx: CanvasRenderingContext2D, size: number) {
    ctx.fillStyle = '#FFD700'
    ctx.beginPath()
    // 皇冠底座
    ctx.rect(-size * 0.4, -size * 0.9, size * 0.8, size * 0.1)
    ctx.fill()
    
    // 皇冠尖角
    for (let i = 0; i < 5; i++) {
      const x = -size * 0.3 + i * size * 0.15
      const height = (i === 2) ? size * 0.2 : size * 0.15 // 中间最高
      ctx.beginPath()
      ctx.moveTo(x, -size * 0.9)
      ctx.lineTo(x + size * 0.05, -size * 0.9 - height)
      ctx.lineTo(x + size * 0.1, -size * 0.9)
      ctx.closePath()
      ctx.fill()
    }
  }

  private drawRunes(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save()
    ctx.globalAlpha = 0.7 + Math.sin(this.animationTime / 400) * 0.3
    ctx.strokeStyle = '#8A2BE2'
    ctx.lineWidth = 2
    
    // 神秘符文
    const runes = ['◊', '※', '⚡', '◈', '✦']
    for (let i = 0; i < runes.length; i++) {
      const angle = (i / runes.length) * Math.PI * 2
      const x = Math.cos(angle) * size * 0.4
      const y = Math.sin(angle) * size * 0.6
      
      ctx.save()
      ctx.translate(x, y)
      ctx.font = '16px serif'
      ctx.fillStyle = '#8A2BE2'
      ctx.textAlign = 'center'
      ctx.fillText(runes[i], 0, 0)
      ctx.restore()
    }
    
    ctx.restore()
  }

  private drawBossWeapon(ctx: CanvasRenderingContext2D, size: number) {
    // 巨大的双手武器
    ctx.strokeStyle = '#2c3e50'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(size * 0.5, -size * 0.3)
    ctx.lineTo(size * 1.3, -size * 0.3)
    ctx.stroke()
    
    // 武器装饰
    ctx.fillStyle = '#FFD700'
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(size * 0.7 + i * size * 0.15, -size * 0.3, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // 巨大刀刃
    ctx.fillStyle = '#C0C0C0'
    ctx.beginPath()
    ctx.moveTo(size * 1.3, -size * 0.3)
    ctx.lineTo(size * 1.5, -size * 0.4)
    ctx.lineTo(size * 1.5, -size * 0.2)
    ctx.closePath()
    ctx.fill()
  }

  private drawMajesticAura(ctx: CanvasRenderingContext2D, size: number) {
    ctx.save()
    ctx.globalAlpha = 0.3
    
    const auraSize = size * 2 + Math.sin(this.animationTime / 500) * 20
    const gradient = ctx.createRadialGradient(0, 0, size, 0, 0, auraSize)
    gradient.addColorStop(0, 'rgba(138, 43, 226, 0)')
    gradient.addColorStop(0.5, 'rgba(138, 43, 226, 0.5)')
    gradient.addColorStop(1, 'rgba(75, 0, 130, 0.8)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(0, 0, auraSize, 0, Math.PI * 2)
    ctx.fill()
    
    ctx.restore()
  }

  private drawHealthBar(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const barWidth = options.size * 1.2
    const barHeight = 4
    const healthPercent = options.health / options.maxHealth
    const yOffset = -options.size * 0.7

    // 背景
    ctx.fillStyle = '#330000'
    ctx.fillRect(-barWidth/2, yOffset, barWidth, barHeight)
    
    // 生命值
    let healthColor = '#00ff00'
    if (healthPercent <= 0.5) healthColor = '#ffff00'
    if (healthPercent <= 0.25) healthColor = '#ff0000'
    
    // Boss主题色加成
    if (options.type === 'infantry_captain') healthColor = '#FF4444'
    if (options.type === 'fortress_guard') healthColor = '#39FF14'
    if (options.type === 'void_shaman') healthColor = '#8B0000'
    if (options.type === 'legion_commander') healthColor = '#7F00FF'

    ctx.fillStyle = healthColor
    ctx.fillRect(-barWidth/2, yOffset, barWidth * healthPercent, barHeight)
    
    // 护盾值
    if (options.shield && options.maxShield && options.shield > 0) {
      const shieldPercent = options.shield / options.maxShield
      ctx.fillStyle = '#00ffff'
      ctx.fillRect(-barWidth/2, yOffset - 6, barWidth * shieldPercent, barHeight)
    }
    
    // 精英标记（第5关Boss不显示五角星）
    if (options.isElite && options.type !== 'infantry_captain') {
      ctx.font = 'bold 12px Arial'
      ctx.fillStyle = '#FFD700'
      ctx.textAlign = 'center'
      ctx.fillText('★', 0, yOffset - 10)
    }
  }

  private drawStatusEffects(ctx: CanvasRenderingContext2D, effects: any[], size: number) {
    effects.forEach((effect, index) => {
      const angle = (index / effects.length) * Math.PI * 2 + this.animationTime / 1000
      const radius = size + 15
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      
      ctx.save()
      ctx.translate(x, y)
      ctx.globalAlpha = 0.8
      
      // 根据效果类型绘制不同的图标
      ctx.font = '12px Arial'
      ctx.textAlign = 'center'
      ctx.fillStyle = effect.color || '#ffffff'
      ctx.fillText(effect.icon || '?', 0, 4)
      
      ctx.restore()
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
    // 简单的颜色变暗函数
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgb(${Math.floor(r * 0.7)}, ${Math.floor(g * 0.7)}, ${Math.floor(b * 0.7)})`
    }
    return color
  }

  private lightenColor(color: string): string {
    // 简单的颜色变亮函数
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgb(${Math.min(255, Math.floor(r * 1.3))}, ${Math.min(255, Math.floor(g * 1.3))}, ${Math.min(255, Math.floor(b * 1.3))})`
    }
    return color
  }

  private drawBossEnemy(ctx: CanvasRenderingContext2D, options: EnemyRenderOptions) {
    const size = options.size * 1.5 // Boss更大
    const powerPulse = Math.sin(this.animationTime / 200) * 0.2 + 1
    const ominousFloat = Math.sin(this.animationTime / 400) * 5

    ctx.save()
    ctx.translate(0, ominousFloat)
    ctx.scale(powerPulse, powerPulse)

    // 绘制九尾狐妖主体 - 威严巨大
    ctx.fillStyle = this.createGradient(ctx, '#8B0000', '#000000', 0, -size*0.8, 0, size*0.8)
    this.drawRoundedRect(ctx, -size*0.3, -size*0.7, size*0.6, size*1.4, 8)

    // 妖狐身上的邪恶符印
    ctx.fillStyle = '#FF4500'
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + this.animationTime / 800
      const x = Math.cos(angle) * size * 0.2
      const y = Math.sin(angle) * size * 0.35
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
    }

    // 绘制狐妖头颅 - 威严狐首
    ctx.fillStyle = this.createGradient(ctx, '#B8860B', '#8B0000', 0, -size*0.9, 0, -size*0.6)
    ctx.beginPath()
    ctx.ellipse(0, -size * 0.75, size * 0.25, size * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()

    // 狐妖尖耳
    ctx.fillStyle = '#8B0000'
    ctx.beginPath()
    ctx.moveTo(-size * 0.18, -size * 0.85)
    ctx.lineTo(-size * 0.12, -size * 0.95)
    ctx.lineTo(-size * 0.06, -size * 0.88)
    ctx.closePath()
    ctx.moveTo(size * 0.18, -size * 0.85)
    ctx.lineTo(size * 0.12, -size * 0.95)
    ctx.lineTo(size * 0.06, -size * 0.88)
    ctx.closePath()
    ctx.fill()

    // 邪恶狐眼 - 妖异红光
    ctx.fillStyle = '#FF0000'
    ctx.shadowColor = '#FF0000'
    ctx.shadowBlur = 10 * powerPulse
    ctx.beginPath()
    ctx.arc(-size * 0.08, -size * 0.78, 4 * powerPulse, 0, Math.PI * 2)
    ctx.arc(size * 0.08, -size * 0.78, 4 * powerPulse, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // 狐瞳 - 竖直邪瞳
    ctx.fillStyle = '#000000'
    ctx.fillRect(-size * 0.09, -size * 0.82, 0.4, 8)
    ctx.fillRect(size * 0.07, -size * 0.82, 0.4, 8)

    // 绘制九尾
    this.drawNineTails(ctx, size, powerPulse)

    // Boss威压光环
    ctx.strokeStyle = '#8B0000'
    ctx.lineWidth = 4
    ctx.shadowColor = '#8B0000'
    ctx.shadowBlur = 15
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.8 + powerPulse * 10, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0

    // 额头Boss印记
    ctx.fillStyle = '#FFD700'
    ctx.font = `${size * 0.1}px serif`
    ctx.textAlign = 'center'
    ctx.shadowColor = '#FFD700'
    ctx.shadowBlur = 8
    ctx.fillText('妖', 0, -size * 0.68)
    ctx.shadowBlur = 0

    // 狐妖利爪
    ctx.strokeStyle = '#C0C0C0'
    ctx.lineWidth = 3
    ctx.beginPath()
    // 左爪
    ctx.moveTo(-size * 0.35, size * 0.1)
    ctx.lineTo(-size * 0.45, size * 0.2)
    ctx.moveTo(-size * 0.33, size * 0.15)
    ctx.lineTo(-size * 0.43, size * 0.25)
    // 右爪
    ctx.moveTo(size * 0.35, size * 0.1)
    ctx.lineTo(size * 0.45, size * 0.2)
    ctx.moveTo(size * 0.33, size * 0.15)
    ctx.lineTo(size * 0.43, size * 0.25)
    ctx.stroke()

    ctx.restore()
  }

  private drawNineTails(ctx: CanvasRenderingContext2D, size: number, pulse: number) {
    // 绘制九条狐尾
    for (let i = 0; i < 9; i++) {
      const tailAngle = (i - 4) * 0.3 + Math.sin(this.animationTime / 300 + i) * 0.2
      const tailLength = size * (0.6 + i * 0.05)
      
      ctx.save()
      ctx.rotate(tailAngle)
      ctx.translate(0, size * 0.4)
      
      // 尾巴主体
      ctx.fillStyle = `hsl(${10 + i * 5}, 80%, ${30 + i * 3}%)`
      for (let segment = 0; segment < 5; segment++) {
        const segmentY = segment * size * 0.15
        const segmentWidth = size * (0.08 - segment * 0.01) * pulse
        const segmentHeight = size * 0.12
        
        ctx.beginPath()
        ctx.ellipse(0, segmentY, segmentWidth, segmentHeight, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      
      // 尾尖的妖火
      ctx.fillStyle = '#FF4500'
      ctx.shadowColor = '#FF4500'
      ctx.shadowBlur = 5
      ctx.beginPath()
      ctx.arc(0, tailLength, 3 * pulse, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      
      ctx.restore()
    }
  }

  // 添加击中效果
  addHitEffect(enemyId: string) {
    this.hitEffects.set(enemyId, { time: 500, intensity: 1.0 })
  }
}
