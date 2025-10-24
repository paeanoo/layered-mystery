import type { PlayerState, Enemy } from '../../types/game'

// 伤害数字效果
export interface DamageNumber {
  id: string
  value: number
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  duration: number
  maxDuration: number
  color: string
  size: number
  alpha: number
  isCritical: boolean
  isHeal: boolean
}

// 连击效果
export interface ComboEffect {
  id: string
  count: number
  position: { x: number; y: number }
  duration: number
  maxDuration: number
  size: number
  alpha: number
  color: string
}

// 暴击特效
export interface CriticalEffect {
  id: string
  position: { x: number; y: number }
  duration: number
  maxDuration: number
  size: number
  alpha: number
  color: string
  particles: Particle[]
}

// 粒子
export interface Particle {
  id: string
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  size: number
  alpha: number
  color: string
  duration: number
}

// 战斗特效系统
export class CombatEffectsSystem {
  private damageNumbers: DamageNumber[] = []
  private comboEffects: ComboEffect[] = []
  private criticalEffects: CriticalEffect[] = []
  private particles: Particle[] = []

  // 添加伤害数字
  addDamageNumber(
    value: number,
    position: { x: number; y: number },
    isCritical: boolean = false,
    isHeal: boolean = false
  ) {
    const damageNumber: DamageNumber = {
      id: Math.random().toString(36).substr(2, 9),
      value,
      position: { ...position },
      velocity: {
        x: (Math.random() - 0.5) * 2,
        y: -2 - Math.random() * 2
      },
      duration: 1000,
      maxDuration: 1000,
      color: isHeal ? '#00ff00' : (isCritical ? '#ff0000' : '#ffffff'),
      size: isCritical ? 24 : 18,
      alpha: 1.0,
      isCritical,
      isHeal
    }

    this.damageNumbers.push(damageNumber)

    // 如果是暴击，添加暴击特效
    if (isCritical) {
      this.addCriticalEffect(position)
    }
  }

  // 添加连击效果
  addComboEffect(count: number, position: { x: number; y: number }) {
    const comboEffect: ComboEffect = {
      id: Math.random().toString(36).substr(2, 9),
      count,
      position: { ...position },
      duration: 1500,
      maxDuration: 1500,
      size: 20 + count * 2,
      alpha: 1.0,
      color: this.getComboColor(count)
    }

    this.comboEffects.push(comboEffect)
  }

  // 添加暴击特效
  addCriticalEffect(position: { x: number; y: number }) {
    const criticalEffect: CriticalEffect = {
      id: Math.random().toString(36).substr(2, 9),
      position: { ...position },
      duration: 800,
      maxDuration: 800,
      size: 30,
      alpha: 1.0,
      color: '#ff0000',
      particles: this.createCriticalParticles(position)
    }

    this.criticalEffects.push(criticalEffect)
  }

  // 创建暴击粒子
  private createCriticalParticles(position: { x: number; y: number }): Particle[] {
    const particles: Particle[] = []
    const particleCount = 8

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2
      const speed = 2 + Math.random() * 3

      particles.push({
        id: Math.random().toString(36).substr(2, 9),
        position: { ...position },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        size: 3 + Math.random() * 3,
        alpha: 1.0,
        color: '#ff4444',
        duration: 500 + Math.random() * 300
      })
    }

    return particles
  }

  // 获取连击颜色
  private getComboColor(count: number): string {
    if (count < 5) return '#ffffff'
    if (count < 10) return '#ffff00'
    if (count < 20) return '#ff8800'
    if (count < 30) return '#ff4400'
    return '#ff0000'
  }

  // 更新所有效果
  update(deltaTime: number) {
    // 更新伤害数字
    this.damageNumbers = this.damageNumbers.filter(damage => {
      damage.duration -= deltaTime
      damage.position.x += damage.velocity.x
      damage.position.y += damage.velocity.y
      damage.alpha = damage.duration / damage.maxDuration
      damage.velocity.y += 0.1 // 重力效果

      return damage.duration > 0
    })

    // 更新连击效果
    this.comboEffects = this.comboEffects.filter(combo => {
      combo.duration -= deltaTime
      combo.alpha = combo.duration / combo.maxDuration
      combo.size += 0.5 // 逐渐变大

      return combo.duration > 0
    })

    // 更新暴击特效
    this.criticalEffects = this.criticalEffects.filter(critical => {
      critical.duration -= deltaTime
      critical.alpha = critical.duration / critical.maxDuration
      critical.size += 1

      // 更新粒子
      critical.particles = critical.particles.filter(particle => {
        particle.duration -= deltaTime
        particle.position.x += particle.velocity.x
        particle.position.y += particle.velocity.y
        particle.alpha = particle.duration / 500
        particle.velocity.x *= 0.98 // 阻力
        particle.velocity.y *= 0.98

        return particle.duration > 0
      })

      return critical.duration > 0
    })

    // 更新独立粒子
    this.particles = this.particles.filter(particle => {
      particle.duration -= deltaTime
      particle.position.x += particle.velocity.x
      particle.position.y += particle.velocity.y
      particle.alpha = particle.duration / 500
      particle.velocity.x *= 0.98
      particle.velocity.y *= 0.98

      return particle.duration > 0
    })
  }

  // 渲染所有效果
  render(ctx: CanvasRenderingContext2D) {
    // 渲染伤害数字
    this.damageNumbers.forEach(damage => {
      this.renderDamageNumber(ctx, damage)
    })

    // 渲染连击效果
    this.comboEffects.forEach(combo => {
      this.renderComboEffect(ctx, combo)
    })

    // 渲染暴击特效
    this.criticalEffects.forEach(critical => {
      this.renderCriticalEffect(ctx, critical)
    })

    // 渲染粒子
    this.particles.forEach(particle => {
      this.renderParticle(ctx, particle)
    })
  }

  // 渲染伤害数字
  private renderDamageNumber(ctx: CanvasRenderingContext2D, damage: DamageNumber) {
    ctx.save()
    ctx.globalAlpha = damage.alpha
    ctx.fillStyle = damage.color
    ctx.font = `bold ${damage.size}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 添加描边效果
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.strokeText(damage.value.toString(), damage.position.x, damage.position.y)
    ctx.fillText(damage.value.toString(), damage.position.x, damage.position.y)

    ctx.restore()
  }

  // 渲染连击效果
  private renderComboEffect(ctx: CanvasRenderingContext2D, combo: ComboEffect) {
    ctx.save()
    ctx.globalAlpha = combo.alpha
    ctx.fillStyle = combo.color
    ctx.font = `bold ${combo.size}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const text = `${combo.count} COMBO!`
    
    // 添加描边效果
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.strokeText(text, combo.position.x, combo.position.y)
    ctx.fillText(text, combo.position.x, combo.position.y)

    ctx.restore()
  }

  // 渲染暴击特效
  private renderCriticalEffect(ctx: CanvasRenderingContext2D, critical: CriticalEffect) {
    ctx.save()
    ctx.globalAlpha = critical.alpha

    // 绘制暴击光环
    ctx.strokeStyle = critical.color
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(critical.position.x, critical.position.y, critical.size, 0, Math.PI * 2)
    ctx.stroke()

    // 绘制粒子
    critical.particles.forEach(particle => {
      this.renderParticle(ctx, particle)
    })

    ctx.restore()
  }

  // 渲染粒子
  private renderParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
    ctx.save()
    ctx.globalAlpha = particle.alpha
    ctx.fillStyle = particle.color
    ctx.beginPath()
    ctx.arc(particle.position.x, particle.position.y, particle.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // 清理所有效果
  clear() {
    this.damageNumbers = []
    this.comboEffects = []
    this.criticalEffects = []
    this.particles = []
  }

  // 获取效果数量
  getEffectCount(): number {
    return this.damageNumbers.length + this.comboEffects.length + this.criticalEffects.length + this.particles.length
  }
}

// 战斗反馈系统
export class CombatFeedbackSystem {
  private effectsSystem: CombatEffectsSystem
  private screenShake: { intensity: number; duration: number } = { intensity: 0, duration: 0 }
  private hitStop: { duration: number } = { duration: 0 }

  constructor() {
    this.effectsSystem = new CombatEffectsSystem()
  }

  // 处理玩家攻击命中
  onPlayerHit(
    damage: number,
    position: { x: number; y: number },
    isCritical: boolean,
    comboCount: number
  ) {
    // 添加伤害数字
    this.effectsSystem.addDamageNumber(damage, position, isCritical, false)

    // 添加连击效果
    if (comboCount > 1) {
      this.effectsSystem.addComboEffect(comboCount, position)
    }

    // 屏幕震动
    if (isCritical) {
      this.addScreenShake(5, 200)
      this.addHitStop(50)
    } else {
      this.addScreenShake(2, 100)
    }
  }

  // 处理玩家受击
  onPlayerHit(
    damage: number,
    position: { x: number; y: number }
  ) {
    this.effectsSystem.addDamageNumber(damage, position, false, false)
    this.addScreenShake(3, 150)
  }

  // 处理治疗
  onHeal(
    amount: number,
    position: { x: number; y: number }
  ) {
    this.effectsSystem.addDamageNumber(amount, position, false, true)
  }

  // 添加屏幕震动
  addScreenShake(intensity: number, duration: number) {
    this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity)
    this.screenShake.duration = Math.max(this.screenShake.duration, duration)
  }

  // 添加命中停顿
  addHitStop(duration: number) {
    this.hitStop.duration = Math.max(this.hitStop.duration, duration)
  }

  // 更新
  update(deltaTime: number) {
    this.effectsSystem.update(deltaTime)

    // 更新屏幕震动
    if (this.screenShake.duration > 0) {
      this.screenShake.duration -= deltaTime
      this.screenShake.intensity *= 0.9
    }

    // 更新命中停顿
    if (this.hitStop.duration > 0) {
      this.hitStop.duration -= deltaTime
    }
  }

  // 渲染
  render(ctx: CanvasRenderingContext2D) {
    this.effectsSystem.render(ctx)
  }

  // 获取屏幕震动偏移
  getScreenShakeOffset(): { x: number; y: number } {
    if (this.screenShake.duration <= 0) {
      return { x: 0, y: 0 }
    }

    return {
      x: (Math.random() - 0.5) * this.screenShake.intensity,
      y: (Math.random() - 0.5) * this.screenShake.intensity
    }
  }

  // 是否在命中停顿中
  isHitStopped(): boolean {
    return this.hitStop.duration > 0
  }

  // 清理
  clear() {
    this.effectsSystem.clear()
    this.screenShake = { intensity: 0, duration: 0 }
    this.hitStop = { duration: 0 }
  }
}
