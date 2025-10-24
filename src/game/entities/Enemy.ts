import type { Enemy as EnemyType, StatusEffect, EnemyAbility } from '../../types/game'

export class Enemy {
  private state: EnemyType
  private targetPosition: { x: number; y: number } | null = null
  private lastAttackTime = 0
  private attackCooldown = 1000 // 毫秒

  constructor(state: EnemyType) {
    this.state = { ...state }
  }

  get id() {
    return this.state.id
  }

  get type() {
    return this.state.type
  }

  get health() {
    return this.state.health
  }

  get maxHealth() {
    return this.state.maxHealth
  }

  get position() {
    return this.state.position
  }

  get velocity() {
    return this.state.velocity
  }

  get damage() {
    return this.state.damage
  }

  get moveSpeed() {
    return this.state.moveSpeed
  }

  get size() {
    return this.state.size
  }

  get color() {
    return this.state.color
  }

  // 新增属性getter
  get armor() {
    return this.state.armor
  }

  get magicResistance() {
    return this.state.magicResistance
  }

  get dodgeChance() {
    return this.state.dodgeChance
  }

  get attackRange() {
    return this.state.attackRange
  }

  get attackSpeed() {
    return this.state.attackSpeed
  }

  get aiType() {
    return this.state.aiType
  }

  get targetId() {
    return this.state.targetId
  }

  get aggroRange() {
    return this.state.aggroRange
  }

  get deaggroRange() {
    return this.state.deaggroRange
  }

  get statusEffects() {
    return this.state.statusEffects
  }

  get abilities() {
    return this.state.abilities
  }

  get animationState() {
    return this.state.animationState
  }

  get glowColor() {
    return this.state.glowColor
  }

  get particleEffects() {
    return this.state.particleEffects
  }

  get dropTable() {
    return this.state.dropTable
  }

  get experienceValue() {
    return this.state.experienceValue
  }

  // 更新位置
  updatePosition(x: number, y: number) {
    this.state.position.x = x
    this.state.position.y = y
  }

  // 更新目标位置
  setTarget(target: { x: number; y: number }) {
    this.targetPosition = target
  }

  // 造成伤害
  takeDamage(damage: number) {
    this.state.health = Math.max(0, this.state.health - damage)
  }

  // 治疗
  heal(amount: number) {
    this.state.health = Math.min(this.state.maxHealth, this.state.health + amount)
  }

  // 检查是否死亡
  isDead() {
    return this.state.health <= 0
  }

  // 获取完整状态
  getState(): EnemyType {
    return { ...this.state }
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
      case 'slow':
        this.state.moveSpeed *= (1 - effect.intensity)
        break
      case 'stun':
        this.state.moveSpeed = 0
        break
      case 'burn':
        this.takeDamage(effect.intensity * deltaTime / 1000)
        break
    }
  }

  // 设置目标
  setTargetId(targetId: string) {
    this.state.targetId = targetId
  }

  // 更新AI行为
  updateAI(deltaTime: number, playerPosition: { x: number; y: number }, allEnemies: EnemyType[]) {
    const distanceToPlayer = Math.sqrt(
      Math.pow(playerPosition.x - this.state.position.x, 2) + 
      Math.pow(playerPosition.y - this.state.position.y, 2)
    )

    switch (this.state.aiType) {
      case 'aggressive':
        this.updateAggressiveAI(deltaTime, playerPosition, distanceToPlayer)
        break
      case 'defensive':
        this.updateDefensiveAI(deltaTime, playerPosition, distanceToPlayer)
        break
      case 'support':
        this.updateSupportAI(deltaTime, playerPosition, allEnemies)
        break
      case 'swarm':
        this.updateSwarmAI(deltaTime, playerPosition, allEnemies)
        break
      case 'ranged':
        this.updateRangedAI(deltaTime, playerPosition, distanceToPlayer)
        break
    }

    // 更新能力冷却
    this.updateAbilities(deltaTime)
  }

  // 攻击型AI
  private updateAggressiveAI(deltaTime: number, playerPosition: { x: number; y: number }, distance: number) {
    if (distance <= this.state.aggroRange) {
      this.setTarget(playerPosition)
      this.state.animationState = 'moving'
    } else if (distance > this.state.deaggroRange) {
      this.targetPosition = null
      this.state.animationState = 'idle'
    }
  }

  // 防御型AI
  private updateDefensiveAI(deltaTime: number, playerPosition: { x: number; y: number }, distance: number) {
    if (distance <= this.state.aggroRange) {
      // 保持距离，不直接冲向玩家
      const angle = Math.atan2(playerPosition.y - this.state.position.y, playerPosition.x - this.state.position.x)
      const retreatX = this.state.position.x - Math.cos(angle) * 50
      const retreatY = this.state.position.y - Math.sin(angle) * 50
      this.setTarget({ x: retreatX, y: retreatY })
      this.state.animationState = 'moving'
    }
  }

  // 支援型AI
  private updateSupportAI(deltaTime: number, playerPosition: { x: number; y: number }, allEnemies: EnemyType[]) {
    // 寻找受伤的友军
    const injuredAlly = allEnemies.find(enemy => 
      enemy.id !== this.state.id && 
      enemy.health < enemy.maxHealth * 0.5
    )

    if (injuredAlly) {
      this.setTarget({ x: injuredAlly.position.x, y: injuredAlly.position.y })
      this.state.animationState = 'moving'
    } else {
      this.setTarget(playerPosition)
    }
  }

  // 群体型AI
  private updateSwarmAI(deltaTime: number, playerPosition: { x: number; y: number }, allEnemies: EnemyType[]) {
    // 寻找附近的友军
    const nearbyAllies = allEnemies.filter(enemy => {
      if (enemy.id === this.state.id) return false
      const distance = Math.sqrt(
        Math.pow(enemy.position.x - this.state.position.x, 2) + 
        Math.pow(enemy.position.y - this.state.position.y, 2)
      )
      return distance < 100
    })

    if (nearbyAllies.length > 0) {
      // 群体移动
      const avgX = nearbyAllies.reduce((sum, ally) => sum + ally.position.x, 0) / nearbyAllies.length
      const avgY = nearbyAllies.reduce((sum, ally) => sum + ally.position.y, 0) / nearbyAllies.length
      this.setTarget({ x: avgX, y: avgY })
    } else {
      this.setTarget(playerPosition)
    }
  }

  // 远程型AI
  private updateRangedAI(deltaTime: number, playerPosition: { x: number; y: number }, distance: number) {
    if (distance <= this.state.aggroRange && distance > this.state.attackRange) {
      this.setTarget(playerPosition)
      this.state.animationState = 'moving'
    } else if (distance <= this.state.attackRange) {
      this.targetPosition = null
      this.state.animationState = 'attacking'
    } else {
      this.state.animationState = 'idle'
    }
  }

  // 更新能力
  updateAbilities(deltaTime: number) {
    this.state.abilities.forEach(ability => {
      if (ability.lastUsed > 0) {
        ability.lastUsed -= deltaTime
      }
    })
  }

  // 使用能力
  useAbility(abilityId: string): boolean {
    const ability = this.state.abilities.find(a => a.id === abilityId)
    if (!ability || ability.lastUsed > 0) return false

    ability.lastUsed = ability.cooldown
    this.state.animationState = 'special'
    return true
  }

  // 更新动画
  updateAnimation(deltaTime: number) {
    this.state.animationTimer += deltaTime
    
    // 动画帧率控制
    const frameRate = 100 // 毫秒每帧
    if (this.state.animationTimer >= frameRate) {
      this.state.animationFrame = (this.state.animationFrame + 1) % 4
      this.state.animationTimer = 0
    }
  }

  // 设置动画状态
  setAnimationState(state: 'idle' | 'moving' | 'attacking' | 'hit' | 'dying' | 'special') {
    this.state.animationState = state
    this.state.animationFrame = 0
    this.state.animationTimer = 0
  }

  // 更新（每帧调用）
  update(deltaTime: number, playerPosition: { x: number; y: number }, allEnemies: EnemyType[] = []) {
    if (this.isDead()) return

    // 更新AI行为
    this.updateAI(deltaTime, playerPosition, allEnemies)

    // 移动逻辑
    if (this.targetPosition) {
      const dx = this.targetPosition.x - this.state.position.x
      const dy = this.targetPosition.y - this.state.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        const moveX = (dx / distance) * this.state.moveSpeed * deltaTime / 1000
        const moveY = (dy / distance) * this.state.moveSpeed * deltaTime / 1000
        
        this.state.position.x += moveX
        this.state.position.y += moveY
      }
    }

    // 更新状态效果
    this.updateStatusEffects(deltaTime)

    // 更新动画
    this.updateAnimation(deltaTime)

    // 特殊敌人行为
    this.updateSpecialBehavior(deltaTime)
  }

  // 特殊敌人行为
  private updateSpecialBehavior(deltaTime: number) {
    switch (this.state.type) {
      case 'elite':
        this.updateEliteBehavior(deltaTime)
        break
      case 'boss':
        this.updateBossBehavior(deltaTime)
        break
    }
  }

  // 精英敌人行为
  private updateEliteBehavior(deltaTime: number) {
    // 精英敌人有更高的移动速度和攻击力
    this.state.moveSpeed *= 1.2
    this.state.damage *= 1.5
  }

  // Boss敌人行为
  private updateBossBehavior(deltaTime: number) {
    // Boss有特殊技能
    this.state.moveSpeed *= 0.8 // 移动较慢
    this.state.damage *= 2 // 攻击力更高
    this.state.size *= 1.5 // 体型更大
  }

  // 检查是否可以攻击
  canAttack(): boolean {
    const now = Date.now()
    return now - this.lastAttackTime >= this.attackCooldown
  }

  // 执行攻击
  attack(): number {
    this.lastAttackTime = Date.now()
    return this.state.damage
  }

  // 获取攻击范围
  getAttackRange(): number {
    return this.state.size + 20 // 攻击范围比体型稍大
  }

  // 检查是否在攻击范围内
  isInAttackRange(targetPosition: { x: number; y: number }): boolean {
    const dx = targetPosition.x - this.state.position.x
    const dy = targetPosition.y - this.state.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance <= this.getAttackRange()
  }

  // 创建不同类型的敌人
  static createNormalEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'normal',
      health: 20 + level * 5,
      maxHealth: 20 + level * 5,
      position,
      velocity: { x: 0, y: 0 },
      damage: 10 + level * 2,
      moveSpeed: 50 + level * 10,
      size: 15 + level,
      color: '#ff4444',
      // 新增属性
      armor: 0,
      magicResistance: 0,
      dodgeChance: 0.05,
      attackRange: 30,
      attackSpeed: 1.0,
      lastAttackTime: 0,
      aiType: 'aggressive',
      aggroRange: 150,
      deaggroRange: 200,
      statusEffects: [],
      abilities: [],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#ff6666',
      particleEffects: [],
      dropTable: [
        { id: 'exp', type: 'experience', value: 10 + level * 2, chance: 1.0, icon: '⭐' }
      ],
      experienceValue: 10 + level * 2
    }
    return new Enemy(enemy)
  }

  static createEliteEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'elite',
      health: 50 + level * 10,
      maxHealth: 50 + level * 10,
      position,
      velocity: { x: 0, y: 0 },
      damage: 20 + level * 5,
      moveSpeed: 80 + level * 15,
      size: 20 + level * 2,
      color: '#ff8800',
      // 新增属性
      armor: 5 + level,
      magicResistance: 3 + level,
      dodgeChance: 0.1,
      attackRange: 40,
      attackSpeed: 1.2,
      lastAttackTime: 0,
      aiType: 'aggressive',
      aggroRange: 200,
      deaggroRange: 250,
      statusEffects: [],
      abilities: [
        {
          id: 'charge',
          name: '冲锋',
          cooldown: 3000,
          range: 100,
          damage: 15 + level * 3,
          effects: [],
          animation: 'charge',
          lastUsed: 0
        }
      ],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#ffaa00',
      particleEffects: ['spark'],
      dropTable: [
        { id: 'exp', type: 'experience', value: 25 + level * 5, chance: 1.0, icon: '⭐' },
        { id: 'health', type: 'health', value: 20, chance: 0.3, icon: '❤️' }
      ],
      experienceValue: 25 + level * 5
    }
    return new Enemy(enemy)
  }

  static createBossEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'boss',
      health: 200 + level * 50,
      maxHealth: 200 + level * 50,
      position,
      velocity: { x: 0, y: 0 },
      damage: 50 + level * 10,
      moveSpeed: 30 + level * 5,
      size: 40 + level * 3,
      color: '#8800ff',
      // 新增属性
      armor: 15 + level * 2,
      magicResistance: 10 + level * 2,
      dodgeChance: 0.15,
      attackRange: 60,
      attackSpeed: 0.8,
      lastAttackTime: 0,
      aiType: 'defensive',
      aggroRange: 300,
      deaggroRange: 400,
      statusEffects: [],
      abilities: [
        {
          id: 'slam',
          name: '重击',
          cooldown: 5000,
          range: 80,
          damage: 30 + level * 8,
          effects: [],
          animation: 'slam',
          lastUsed: 0
        },
        {
          id: 'roar',
          name: '咆哮',
          cooldown: 8000,
          range: 200,
          damage: 0,
          effects: [],
          animation: 'roar',
          lastUsed: 0
        }
      ],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#aa00ff',
      particleEffects: ['aura', 'spark'],
      dropTable: [
        { id: 'exp', type: 'experience', value: 100 + level * 20, chance: 1.0, icon: '⭐' },
        { id: 'health', type: 'health', value: 50, chance: 0.8, icon: '❤️' },
        { id: 'energy', type: 'energy', value: 30, chance: 0.6, icon: '⚡' }
      ],
      experienceValue: 100 + level * 20
    }
    return new Enemy(enemy)
  }

  // 创建群体型敌人
  static createSwarmEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'swarm',
      health: 10 + level * 2,
      maxHealth: 10 + level * 2,
      position,
      velocity: { x: 0, y: 0 },
      damage: 5 + level,
      moveSpeed: 80 + level * 20,
      size: 8 + level,
      color: '#44ff44',
      // 新增属性
      armor: 0,
      magicResistance: 0,
      dodgeChance: 0.2,
      attackRange: 20,
      attackSpeed: 2.0,
      lastAttackTime: 0,
      aiType: 'swarm',
      aggroRange: 100,
      deaggroRange: 150,
      statusEffects: [],
      abilities: [],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#66ff66',
      particleEffects: [],
      dropTable: [
        { id: 'exp', type: 'experience', value: 5 + level, chance: 0.8, icon: '⭐' }
      ],
      experienceValue: 5 + level
    }
    return new Enemy(enemy)
  }

  // 创建远程型敌人
  static createRangedEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'ranged',
      health: 30 + level * 8,
      maxHealth: 30 + level * 8,
      position,
      velocity: { x: 0, y: 0 },
      damage: 15 + level * 3,
      moveSpeed: 40 + level * 8,
      size: 12 + level,
      color: '#4444ff',
      // 新增属性
      armor: 2 + level,
      magicResistance: 5 + level,
      dodgeChance: 0.1,
      attackRange: 120,
      attackSpeed: 0.8,
      lastAttackTime: 0,
      aiType: 'ranged',
      aggroRange: 200,
      deaggroRange: 300,
      statusEffects: [],
      abilities: [
        {
          id: 'shoot',
          name: '射击',
          cooldown: 2000,
          range: 120,
          damage: 15 + level * 3,
          effects: [],
          animation: 'shoot',
          lastUsed: 0
        }
      ],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#6666ff',
      particleEffects: ['muzzle_flash'],
      dropTable: [
        { id: 'exp', type: 'experience', value: 15 + level * 3, chance: 1.0, icon: '⭐' }
      ],
      experienceValue: 15 + level * 3
    }
    return new Enemy(enemy)
  }

  // 创建坦克型敌人
  static createTankEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'tank',
      health: 100 + level * 20,
      maxHealth: 100 + level * 20,
      position,
      velocity: { x: 0, y: 0 },
      damage: 25 + level * 5,
      moveSpeed: 20 + level * 3,
      size: 25 + level * 2,
      color: '#888888',
      // 新增属性
      armor: 20 + level * 3,
      magicResistance: 15 + level * 2,
      dodgeChance: 0.02,
      attackRange: 50,
      attackSpeed: 0.5,
      lastAttackTime: 0,
      aiType: 'defensive',
      aggroRange: 150,
      deaggroRange: 200,
      statusEffects: [],
      abilities: [
        {
          id: 'shield',
          name: '护盾',
          cooldown: 10000,
          range: 0,
          damage: 0,
          effects: [],
          animation: 'shield',
          lastUsed: 0
        }
      ],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#aaaaaa',
      particleEffects: ['shield_aura'],
      dropTable: [
        { id: 'exp', type: 'experience', value: 40 + level * 8, chance: 1.0, icon: '⭐' },
        { id: 'health', type: 'health', value: 30, chance: 0.5, icon: '❤️' }
      ],
      experienceValue: 40 + level * 8
    }
    return new Enemy(enemy)
  }

  // 创建刺客型敌人
  static createAssassinEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'assassin',
      health: 25 + level * 5,
      maxHealth: 25 + level * 5,
      position,
      velocity: { x: 0, y: 0 },
      damage: 30 + level * 6,
      moveSpeed: 100 + level * 25,
      size: 10 + level,
      color: '#ff44ff',
      // 新增属性
      armor: 1 + level,
      magicResistance: 2 + level,
      dodgeChance: 0.3,
      attackRange: 25,
      attackSpeed: 1.5,
      lastAttackTime: 0,
      aiType: 'aggressive',
      aggroRange: 120,
      deaggroRange: 180,
      statusEffects: [],
      abilities: [
        {
          id: 'stealth',
          name: '潜行',
          cooldown: 8000,
          range: 0,
          damage: 0,
          effects: [],
          animation: 'stealth',
          lastUsed: 0
        },
        {
          id: 'backstab',
          name: '背刺',
          cooldown: 5000,
          range: 30,
          damage: 40 + level * 8,
          effects: [],
          animation: 'backstab',
          lastUsed: 0
        }
      ],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#ff66ff',
      particleEffects: ['stealth_trail'],
      dropTable: [
        { id: 'exp', type: 'experience', value: 20 + level * 4, chance: 1.0, icon: '⭐' }
      ],
      experienceValue: 20 + level * 4
    }
    return new Enemy(enemy)
  }

  // 创建支援型敌人
  static createSupportEnemy(level: number, position: { x: number; y: number }): Enemy {
    const enemy: EnemyType = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'support',
      health: 40 + level * 8,
      maxHealth: 40 + level * 8,
      position,
      velocity: { x: 0, y: 0 },
      damage: 8 + level * 2,
      moveSpeed: 60 + level * 12,
      size: 15 + level,
      color: '#ffff44',
      // 新增属性
      armor: 3 + level,
      magicResistance: 8 + level,
      dodgeChance: 0.15,
      attackRange: 80,
      attackSpeed: 1.0,
      lastAttackTime: 0,
      aiType: 'support',
      aggroRange: 180,
      deaggroRange: 250,
      statusEffects: [],
      abilities: [
        {
          id: 'heal',
          name: '治疗',
          cooldown: 6000,
          range: 100,
          damage: -20, // 负伤害表示治疗
          effects: [],
          animation: 'heal',
          lastUsed: 0
        },
        {
          id: 'buff',
          name: '强化',
          cooldown: 10000,
          range: 120,
          damage: 0,
          effects: [],
          animation: 'buff',
          lastUsed: 0
        }
      ],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#ffff66',
      particleEffects: ['heal_aura'],
      dropTable: [
        { id: 'exp', type: 'experience', value: 30 + level * 6, chance: 1.0, icon: '⭐' },
        { id: 'energy', type: 'energy', value: 20, chance: 0.4, icon: '⚡' }
      ],
      experienceValue: 30 + level * 6
    }
    return new Enemy(enemy)
  }
}
