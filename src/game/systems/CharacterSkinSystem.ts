import type { PlayerState, Enemy } from '../../types/game'

// 角色皮肤配置
export interface CharacterSkin {
  id: string
  name: string
  description: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  unlockLevel: number
  baseColor: string
  glowColor: string
  particleEffects: string[]
  animations: {
    idle: string
    moving: string
    attacking: string
    hit: string
    dying: string
  }
  specialEffects: {
    trail: boolean
    aura: boolean
    particles: boolean
  }
  stats: {
    damageBonus?: number
    speedBonus?: number
    healthBonus?: number
    critBonus?: number
  }
}

// 敌人皮肤配置
export interface EnemySkin {
  id: string
  name: string
  type: string
  baseColor: string
  glowColor: string
  particleEffects: string[]
  size: number
  specialEffects: {
    trail: boolean
    aura: boolean
    particles: boolean
  }
}

// 特效配置
export interface EffectConfig {
  id: string
  name: string
  type: 'trail' | 'aura' | 'particle' | 'glow'
  color: string
  intensity: number
  duration: number
  size: number
  animation: string
}

// 角色外观系统
export class CharacterSkinSystem {
  private playerSkins: Map<string, CharacterSkin> = new Map()
  private enemySkins: Map<string, EnemySkin> = new Map()
  private effects: Map<string, EffectConfig> = new Map()
  private activeTrails: Map<string, TrailEffect> = new Map()

  constructor() {
    this.initializeSkins()
    this.initializeEffects()
  }

  // 初始化皮肤
  private initializeSkins() {
    // 默认玩家皮肤
    this.addPlayerSkin({
      id: 'default',
      name: '默认战士',
      description: '经典的战士外观',
      rarity: 'common',
      unlockLevel: 1,
      baseColor: '#4a90e2',
      glowColor: '#6bb6ff',
      particleEffects: [],
      animations: {
        idle: 'player_idle',
        moving: 'player_moving',
        attacking: 'player_attacking',
        hit: 'player_hit',
        dying: 'player_dying'
      },
      specialEffects: {
        trail: false,
        aura: false,
        particles: false
      },
      stats: {}
    })

    // 火焰战士皮肤
    this.addPlayerSkin({
      id: 'fire_warrior',
      name: '火焰战士',
      description: '燃烧着火焰的战士',
      rarity: 'rare',
      unlockLevel: 5,
      baseColor: '#ff4444',
      glowColor: '#ff6666',
      particleEffects: ['fire_particles', 'flame_trail'],
      animations: {
        idle: 'fire_warrior_idle',
        moving: 'fire_warrior_moving',
        attacking: 'fire_warrior_attacking',
        hit: 'fire_warrior_hit',
        dying: 'fire_warrior_dying'
      },
      specialEffects: {
        trail: true,
        aura: true,
        particles: true
      },
      stats: {
        damageBonus: 0.1,
        critBonus: 0.05
      }
    })

    // 冰霜法师皮肤
    this.addPlayerSkin({
      id: 'ice_mage',
      name: '冰霜法师',
      description: '掌控冰霜力量的法师',
      rarity: 'epic',
      unlockLevel: 10,
      baseColor: '#44aaff',
      glowColor: '#66ccff',
      particleEffects: ['ice_particles', 'frost_aura'],
      animations: {
        idle: 'ice_mage_idle',
        moving: 'ice_mage_moving',
        attacking: 'ice_mage_attacking',
        hit: 'ice_mage_hit',
        dying: 'ice_mage_dying'
      },
      specialEffects: {
        trail: true,
        aura: true,
        particles: true
      },
      stats: {
        speedBonus: 0.15,
        healthBonus: 0.1
      }
    })

    // 暗影刺客皮肤
    this.addPlayerSkin({
      id: 'shadow_assassin',
      name: '暗影刺客',
      description: '隐藏在阴影中的刺客',
      rarity: 'legendary',
      unlockLevel: 20,
      baseColor: '#4400aa',
      glowColor: '#6600cc',
      particleEffects: ['shadow_particles', 'stealth_trail'],
      animations: {
        idle: 'shadow_assassin_idle',
        moving: 'shadow_assassin_moving',
        attacking: 'shadow_assassin_attacking',
        hit: 'shadow_assassin_hit',
        dying: 'shadow_assassin_dying'
      },
      specialEffects: {
        trail: true,
        aura: true,
        particles: true
      },
      stats: {
        damageBonus: 0.2,
        speedBonus: 0.25,
        critBonus: 0.15
      }
    })

    // 敌人皮肤
    this.addEnemySkin({
      id: 'normal_enemy',
      name: '普通敌人',
      type: 'normal',
      baseColor: '#ff4444',
      glowColor: '#ff6666',
      particleEffects: [],
      size: 1.0,
      specialEffects: {
        trail: false,
        aura: false,
        particles: false
      }
    })

    this.addEnemySkin({
      id: 'elite_enemy',
      name: '精英敌人',
      type: 'elite',
      baseColor: '#ff8800',
      glowColor: '#ffaa00',
      particleEffects: ['spark'],
      size: 1.2,
      specialEffects: {
        trail: false,
        aura: true,
        particles: true
      }
    })

    this.addEnemySkin({
      id: 'boss_enemy',
      name: 'Boss敌人',
      type: 'boss',
      baseColor: '#8800ff',
      glowColor: '#aa00ff',
      particleEffects: ['aura', 'spark'],
      size: 1.5,
      specialEffects: {
        trail: false,
        aura: true,
        particles: true
      }
    })
  }

  // 初始化特效
  private initializeEffects() {
    // 火焰特效
    this.addEffect({
      id: 'fire_particles',
      name: '火焰粒子',
      type: 'particle',
      color: '#ff4400',
      intensity: 0.8,
      duration: 1000,
      size: 4,
      animation: 'fire_particle'
    })

    this.addEffect({
      id: 'flame_trail',
      name: '火焰轨迹',
      type: 'trail',
      color: '#ff6600',
      intensity: 0.6,
      duration: 500,
      size: 8,
      animation: 'flame_trail'
    })

    // 冰霜特效
    this.addEffect({
      id: 'ice_particles',
      name: '冰霜粒子',
      type: 'particle',
      color: '#44aaff',
      intensity: 0.7,
      duration: 1200,
      size: 3,
      animation: 'ice_particle'
    })

    this.addEffect({
      id: 'frost_aura',
      name: '冰霜光环',
      type: 'aura',
      color: '#66ccff',
      intensity: 0.5,
      duration: 2000,
      size: 20,
      animation: 'frost_aura'
    })

    // 暗影特效
    this.addEffect({
      id: 'shadow_particles',
      name: '暗影粒子',
      type: 'particle',
      color: '#4400aa',
      intensity: 0.9,
      duration: 800,
      size: 2,
      animation: 'shadow_particle'
    })

    this.addEffect({
      id: 'stealth_trail',
      name: '潜行轨迹',
      type: 'trail',
      color: '#6600cc',
      intensity: 0.4,
      duration: 300,
      size: 6,
      animation: 'stealth_trail'
    })
  }

  // 添加玩家皮肤
  addPlayerSkin(skin: CharacterSkin) {
    this.playerSkins.set(skin.id, skin)
  }

  // 添加敌人皮肤
  addEnemySkin(skin: EnemySkin) {
    this.enemySkins.set(skin.id, skin)
  }

  // 添加特效
  addEffect(effect: EffectConfig) {
    this.effects.set(effect.id, effect)
  }

  // 获取玩家皮肤
  getPlayerSkin(id: string): CharacterSkin | undefined {
    return this.playerSkins.get(id)
  }

  // 获取敌人皮肤
  getEnemySkin(id: string): EnemySkin | undefined {
    return this.enemySkins.get(id)
  }

  // 获取特效
  getEffect(id: string): EffectConfig | undefined {
    return this.effects.get(id)
  }

  // 应用玩家皮肤
  applyPlayerSkin(player: PlayerState, skinId: string) {
    const skin = this.getPlayerSkin(skinId)
    if (!skin) return

    player.skin = skinId
    player.color = skin.baseColor
    player.glowColor = skin.glowColor

    // 应用属性加成
    if (skin.stats.damageBonus) {
      player.damage *= (1 + skin.stats.damageBonus)
    }
    if (skin.stats.speedBonus) {
      player.moveSpeed *= (1 + skin.stats.speedBonus)
    }
    if (skin.stats.healthBonus) {
      player.maxHealth *= (1 + skin.stats.healthBonus)
      player.health = player.maxHealth
    }
    if (skin.stats.critBonus) {
      player.critChance += skin.stats.critBonus
    }
  }

  // 应用敌人皮肤
  applyEnemySkin(enemy: Enemy, skinId: string) {
    const skin = this.getEnemySkin(skinId)
    if (!skin) return

    enemy.color = skin.baseColor
    enemy.glowColor = skin.glowColor
    enemy.size *= skin.size
  }

  // 创建轨迹效果
  createTrailEffect(
    entityId: string,
    position: { x: number; y: number },
    effectId: string
  ) {
    const effect = this.getEffect(effectId)
    if (!effect) return

    const trail: TrailEffect = {
      id: entityId,
      positions: [{ ...position, timestamp: Date.now() }],
      effect,
      maxPositions: 20,
      lastUpdate: Date.now()
    }

    this.activeTrails.set(entityId, trail)
  }

  // 更新轨迹
  updateTrail(entityId: string, position: { x: number; y: number }) {
    const trail = this.activeTrails.get(entityId)
    if (!trail) return

    const now = Date.now()
    if (now - trail.lastUpdate < 50) return // 限制更新频率

    trail.positions.push({ ...position, timestamp: now })
    trail.lastUpdate = now

    // 限制轨迹长度
    if (trail.positions.length > trail.maxPositions) {
      trail.positions.shift()
    }

    // 移除过期的轨迹点
    const maxAge = trail.effect.duration
    trail.positions = trail.positions.filter(
      pos => now - pos.timestamp < maxAge
    )
  }

  // 移除轨迹
  removeTrail(entityId: string) {
    this.activeTrails.delete(entityId)
  }

  // 更新所有轨迹
  update(deltaTime: number) {
    const now = Date.now()
    
    this.activeTrails.forEach((trail, entityId) => {
      // 移除过期的轨迹点
      trail.positions = trail.positions.filter(
        pos => now - pos.timestamp < trail.effect.duration
      )

      // 如果轨迹为空，移除
      if (trail.positions.length === 0) {
        this.activeTrails.delete(entityId)
      }
    })
  }

  // 渲染轨迹
  renderTrails(ctx: CanvasRenderingContext2D) {
    this.activeTrails.forEach(trail => {
      this.renderTrail(ctx, trail)
    })
  }

  // 渲染单个轨迹
  private renderTrail(ctx: CanvasRenderingContext2D, trail: TrailEffect) {
    if (trail.positions.length < 2) return

    ctx.save()

    for (let i = 0; i < trail.positions.length - 1; i++) {
      const pos1 = trail.positions[i]
      const pos2 = trail.positions[i + 1]
      const age = Date.now() - pos1.timestamp
      const alpha = 1 - (age / trail.effect.duration)

      if (alpha <= 0) continue

      ctx.globalAlpha = alpha * trail.effect.intensity
      ctx.strokeStyle = trail.effect.color
      ctx.lineWidth = trail.effect.size * alpha
      ctx.lineCap = 'round'

      ctx.beginPath()
      ctx.moveTo(pos1.x, pos1.y)
      ctx.lineTo(pos2.x, pos2.y)
      ctx.stroke()
    }

    ctx.restore()
  }

  // 获取所有可用皮肤
  getAvailablePlayerSkins(level: number): CharacterSkin[] {
    return Array.from(this.playerSkins.values())
      .filter(skin => skin.unlockLevel <= level)
  }

  // 获取皮肤稀有度颜色
  getRarityColor(rarity: string): string {
    switch (rarity) {
      case 'common': return '#ffffff'
      case 'rare': return '#00ff00'
      case 'epic': return '#0088ff'
      case 'legendary': return '#ff8800'
      default: return '#ffffff'
    }
  }
}

// 轨迹效果
export interface TrailEffect {
  id: string
  positions: Array<{ x: number; y: number; timestamp: number }>
  effect: EffectConfig
  maxPositions: number
  lastUpdate: number
}

// 外观管理器
export class AppearanceManager {
  private skinSystem: CharacterSkinSystem
  private activeSkins: Map<string, string> = new Map()

  constructor() {
    this.skinSystem = new CharacterSkinSystem()
  }

  // 设置玩家皮肤
  setPlayerSkin(playerId: string, skinId: string) {
    this.activeSkins.set(playerId, skinId)
  }

  // 获取玩家皮肤
  getPlayerSkin(playerId: string): string | undefined {
    return this.activeSkins.get(playerId)
  }

  // 更新
  update(deltaTime: number) {
    this.skinSystem.update(deltaTime)
  }

  // 渲染
  render(ctx: CanvasRenderingContext2D) {
    this.skinSystem.renderTrails(ctx)
  }

  // 获取皮肤系统
  getSkinSystem(): CharacterSkinSystem {
    return this.skinSystem
  }
}
