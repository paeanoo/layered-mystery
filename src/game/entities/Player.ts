import type { PlayerState, PassiveAttribute, StatusEffect, Skill } from '../../types/game'
import { PASSIVE_ATTRIBUTES } from '../../types/game'

export class Player {
  private state: PlayerState
  private passiveAttributes: Map<string, PassiveAttribute> = new Map()

  constructor(initialState: PlayerState) {
    this.state = { ...initialState }
  }

  get position() {
    return this.state.position
  }

  get health() {
    return this.state.health
  }

  get maxHealth() {
    return this.state.maxHealth
  }

  get attackSpeed() {
    return this.state.attackSpeed
  }

  get damage() {
    return this.state.damage
  }

  get critChance() {
    return this.state.critChance
  }

  get projectiles() {
    return this.state.projectiles
  }

  get pierce() {
    return this.state.pierce
  }

  get regeneration() {
    return this.state.regeneration
  }

  get moveSpeed() {
    return this.state.moveSpeed
  }

  get lifesteal() {
    return this.state.lifesteal
  }

  get passiveAttributesList() {
    return this.state.passiveAttributes
  }

  // 新增属性getter
  get experience() {
    return this.state.experience
  }

  get level() {
    return this.state.level
  }

  get armor() {
    return this.state.armor
  }

  get magicResistance() {
    return this.state.magicResistance
  }

  get dodgeChance() {
    return this.state.dodgeChance
  }

  get blockChance() {
    return this.state.blockChance
  }

  get energy() {
    return this.state.energy
  }

  get maxEnergy() {
    return this.state.maxEnergy
  }

  get energyRegen() {
    return this.state.energyRegen
  }

  get statusEffects() {
    return this.state.statusEffects
  }

  get comboCount() {
    return this.state.comboCount
  }

  get maxCombo() {
    return this.state.maxCombo
  }

  get comboMultiplier() {
    return this.state.comboMultiplier
  }

  get skin() {
    return this.state.skin
  }

  get size() {
    return this.state.size
  }

  get color() {
    return this.state.color
  }

  get glowColor() {
    return this.state.glowColor
  }

  get animationState() {
    return this.state.animationState
  }

  // 更新位置
  updatePosition(x: number, y: number) {
    this.state.position.x = x
    this.state.position.y = y
  }

  // 更新生命值
  updateHealth(health: number) {
    this.state.health = Math.max(0, Math.min(health, this.state.maxHealth))
  }

  // 造成伤害
  takeDamage(damage: number) {
    this.state.health = Math.max(0, this.state.health - damage)
  }

  // 治疗
  heal(amount: number) {
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount)
  }

  // 添加被动属性
  addPassiveAttribute(passiveId: string) {
    const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
    if (!passive) return false

    // 检查是否已经拥有该被动
    if (this.state.passiveAttributes.includes(passiveId)) {
      return false
    }

    this.state.passiveAttributes.push(passiveId)
    this.passiveAttributes.set(passiveId, passive)
    this.applyPassiveEffect(passive)
    return true
  }

  // 应用被动效果
  private applyPassiveEffect(passive: PassiveAttribute) {
    switch (passive.id) {
      case 'attack_speed':
        this.state.attackSpeed *= (1 + passive.value)
        break
      case 'damage':
        this.state.damage *= (1 + passive.value)
        break
      case 'crit_chance':
        this.state.critChance += passive.value
        break
      case 'projectiles':
        this.state.projectiles += passive.value
        break
      case 'pierce':
        this.state.pierce += passive.value
        break
      case 'regeneration':
        this.state.regeneration += passive.value
        break
      case 'max_health':
        this.state.maxHealth += passive.value
        this.state.health += passive.value
        break
      case 'move_speed':
        this.state.moveSpeed *= (1 + passive.value)
        break
      case 'lifesteal':
        this.state.lifesteal += passive.value
        break
    }
  }

  // 检查是否死亡
  isDead() {
    return this.state.health <= 0
  }

  // 获取完整状态
  getState(): PlayerState {
    return { ...this.state }
  }

  // 重置状态
  reset(newState: PlayerState) {
    this.state = { ...newState }
    this.passiveAttributes.clear()
  }

  // 计算协同效果
  calculateSynergies() {
    const synergies: string[] = []

    // 投射物 + 穿透协同
    if (this.state.projectiles > 1 && this.state.pierce > 0) {
      synergies.push('projectile_pierce_synergy')
    }

    // 暴击 + 攻速协同
    if (this.state.critChance > 0.1 && this.state.attackSpeed > 1.5) {
      synergies.push('crit_speed_synergy')
    }

    // 回复 + 偷取协同
    if (this.state.regeneration > 0 && this.state.lifesteal > 0) {
      synergies.push('regen_lifesteal_synergy')
    }

    return synergies
  }

  // 应用协同效果
  applySynergies() {
    const synergies = this.calculateSynergies()

    synergies.forEach(synergy => {
      switch (synergy) {
        case 'projectile_pierce_synergy':
          // 投射物+穿透：降低攻击间隔惩罚
          this.state.attackSpeed *= 1.1
          break
        case 'crit_speed_synergy':
          // 暴击+攻速：暴击时重置攻击间隔
          this.state.critChance *= 1.2
          break
        case 'regen_lifesteal_synergy':
          // 回复+偷取：低血量时偷取效率提升
          if (this.state.health / this.state.maxHealth < 0.3) {
            this.state.lifesteal *= 1.5
          }
          break
      }
    })
  }

  // 添加状态效果
  addStatusEffect(effect: StatusEffect) {
    const existingIndex = this.state.statusEffects.findIndex(e => e.id === effect.id)
    
    if (existingIndex >= 0) {
      if (effect.stackable) {
        this.state.statusEffects[existingIndex].stacks += 1
        this.state.statusEffects[existingIndex].duration = effect.maxDuration
      } else {
        this.state.statusEffects[existingIndex] = { ...effect }
      }
    } else {
      this.state.statusEffects.push({ ...effect })
    }
  }

  // 移除状态效果
  removeStatusEffect(effectId: string) {
    this.state.statusEffects = this.state.statusEffects.filter(e => e.id !== effectId)
  }

  // 更新状态效果
  updateStatusEffects(deltaTime: number) {
    this.state.statusEffects.forEach(effect => {
      effect.duration -= deltaTime
      
      // 应用效果
      this.applyStatusEffect(effect, deltaTime)
    })

    // 移除过期的效果
    this.state.statusEffects = this.state.statusEffects.filter(effect => effect.duration > 0)
  }

  // 应用状态效果
  private applyStatusEffect(effect: StatusEffect, deltaTime: number) {
    switch (effect.id) {
      case 'poison':
        this.takeDamage(effect.intensity * deltaTime / 1000)
        break
      case 'regeneration':
        this.heal(effect.intensity * deltaTime / 1000)
        break
      case 'speed_boost':
        this.state.moveSpeed *= (1 + effect.intensity)
        break
      case 'damage_boost':
        this.state.damage *= (1 + effect.intensity)
        break
    }
  }

  // 增加经验值
  addExperience(amount: number) {
    this.state.experience += amount
    const requiredExp = this.state.level * 100 + 50
    
    if (this.state.experience >= requiredExp) {
      this.levelUp()
    }
  }

  // 升级（不自动增加属性，只能通过被动属性选择增加）
  levelUp() {
    this.state.level += 1
    this.state.experience = 0
    // 不再自动增加属性
    // 属性只能通过选择被动属性来增加
    // maxHealth、damage、attackSpeed 等属性不变
  }

  // 增加连击
  addCombo() {
    this.state.comboCount += 1
    this.state.comboMultiplier = Math.min(2.0, 1 + this.state.comboCount * 0.1)
    
    if (this.state.comboCount > this.state.maxCombo) {
      this.state.maxCombo = this.state.comboCount
    }
  }

  // 重置连击
  resetCombo() {
    this.state.comboCount = 0
    this.state.comboMultiplier = 1
  }

  // 使用技能
  useSkill(skill: Skill): boolean {
    if (this.state.energy < skill.energyCost) return false
    if (this.state.skillCooldowns.get(skill.id) && this.state.skillCooldowns.get(skill.id)! > 0) return false

    this.state.energy -= skill.energyCost
    this.state.skillCooldowns.set(skill.id, skill.cooldown)
    
    // 应用技能效果
    skill.effects.forEach(effect => {
      this.applySkillEffect(effect)
    })

    return true
  }

  // 应用技能效果
  private applySkillEffect(effect: any) {
    switch (effect.type) {
      case 'damage':
        // 技能伤害逻辑
        break
      case 'heal':
        this.heal(effect.value)
        break
      case 'buff':
        this.addStatusEffect({
          id: effect.id,
          name: effect.name,
          type: 'buff',
          duration: effect.duration || 5000,
          maxDuration: effect.duration || 5000,
          intensity: effect.value,
          stackable: false,
          stacks: 1,
          icon: '✨',
          description: effect.description || ''
        })
        break
    }
  }

  // 更新动画
  updateAnimation(deltaTime: number) {
    this.state.animationTimer += deltaTime
    
    // 动画帧率控制
    const frameRate = 100 // 毫秒每帧
    if (this.state.animationTimer >= frameRate) {
      this.state.animationFrame = (this.state.animationFrame + 1) % 4 // 假设每动画4帧
      this.state.animationTimer = 0
    }
  }

  // 设置动画状态
  setAnimationState(state: 'idle' | 'moving' | 'attacking' | 'hit' | 'dying') {
    this.state.animationState = state
    this.state.animationFrame = 0
    this.state.animationTimer = 0
  }

  // 更新（每帧调用）
  update(deltaTime: number) {
    // 生命回复
    if (this.state.regeneration > 0) {
      this.heal(this.state.regeneration * deltaTime / 1000)
    }

    // 能量回复
    if (this.state.energyRegen > 0) {
      this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + this.state.energyRegen * deltaTime / 1000)
    }

    // 更新状态效果
    this.updateStatusEffects(deltaTime)

    // 更新技能冷却
    this.state.skillCooldowns.forEach((cooldown, skillId) => {
      if (cooldown > 0) {
        this.state.skillCooldowns.set(skillId, cooldown - deltaTime)
      }
    })

    // 更新动画
    this.updateAnimation(deltaTime)

    // 应用协同效果
    this.applySynergies()
  }
}
