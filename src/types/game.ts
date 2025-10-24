// 游戏核心类型定义

// 状态效果类型
export interface StatusEffect {
  id: string
  name: string
  type: 'buff' | 'debuff' | 'neutral'
  duration: number
  maxDuration: number
  intensity: number
  stackable: boolean
  stacks: number
  icon: string
  description: string
}

// 技能类型
export interface Skill {
  id: string
  name: string
  description: string
  cooldown: number
  energyCost: number
  damage: number
  range: number
  type: 'active' | 'passive' | 'ultimate'
  icon: string
  animation: string
  effects: SkillEffect[]
}

// 技能效果
export interface SkillEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'teleport' | 'summon'
  value: number
  duration?: number
  target: 'self' | 'enemy' | 'area' | 'all'
  range?: number
}

// 被动属性类型
export interface PassiveAttribute {
  id: string
  name: string
  description: string
  type: 'additive' | 'multiplicative' | 'special'
  value: number
  icon: string
}

// 9种基础被动属性
export const PASSIVE_ATTRIBUTES: PassiveAttribute[] = [
  {
    id: 'attack_speed',
    name: '攻速提升',
    description: '攻击速度 +20%',
    type: 'multiplicative',
    value: 0.2,
    icon: '⚡'
  },
  {
    id: 'damage',
    name: '伤害增强',
    description: '攻击伤害 +25%',
    type: 'multiplicative',
    value: 0.25,
    icon: '💥'
  },
  {
    id: 'crit_chance',
    name: '暴击几率',
    description: '暴击率 +15%',
    type: 'additive',
    value: 0.15,
    icon: '🎯'
  },
  {
    id: 'projectiles',
    name: '投射物+1',
    description: '同时发射投射物数量 +1',
    type: 'additive',
    value: 1,
    icon: '🏹'
  },
  {
    id: 'pierce',
    name: '穿透+1',
    description: '投射物穿透次数 +1',
    type: 'additive',
    value: 1,
    icon: '🔪'
  },
  {
    id: 'regeneration',
    name: '生命回复',
    description: '每秒回复 5 点生命值',
    type: 'additive',
    value: 5,
    icon: '💚'
  },
  {
    id: 'max_health',
    name: '最大生命',
    description: '最大生命值 +50',
    type: 'additive',
    value: 50,
    icon: '❤️'
  },
  {
    id: 'move_speed',
    name: '移动速度',
    description: '移动速度 +30%',
    type: 'multiplicative',
    value: 0.3,
    icon: '🏃'
  },
  {
    id: 'lifesteal',
    name: '生命偷取',
    description: '攻击命中后回复伤害的 5%',
    type: 'special',
    value: 0.05,
    icon: '🩸'
  }
]

// 玩家状态
export interface PlayerState {
  health: number
  maxHealth: number
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  attackSpeed: number
  damage: number
  critChance: number
  projectiles: number
  pierce: number
  regeneration: number
  moveSpeed: number
  lifesteal: number
  passiveAttributes: string[]
  // 新增属性
  experience: number
  level: number
  armor: number
  magicResistance: number
  dodgeChance: number
  blockChance: number
  energy: number
  maxEnergy: number
  energyRegen: number
  // 状态效果
  statusEffects: StatusEffect[]
  // 技能冷却
  skillCooldowns: Map<string, number>
  // 连击系统
  comboCount: number
  maxCombo: number
  comboMultiplier: number
  // 角色外观
  skin: string
  size: number
  color: string
  glowColor: string
  // 动画状态
  animationState: 'idle' | 'moving' | 'attacking' | 'hit' | 'dying'
  animationFrame: number
  animationTimer: number
  // 额外属性
  gold: number
  mana: number
  cooldownReduction: number
  range: number
  spellPower: number
  thorns: number
  reflect: number
  slow: number
  stun: number
}

// 敌人类型
export interface Enemy {
  id: string
  type: 'normal' | 'elite' | 'boss' | 'swarm' | 'ranged' | 'tank' | 'assassin' | 'support'
  health: number
  maxHealth: number
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  damage: number
  moveSpeed: number
  size: number
  color: string
  // 新增属性
  armor: number
  magicResistance: number
  dodgeChance: number
  attackRange: number
  attackSpeed: number
  lastAttackTime: number
  // AI行为
  aiType: 'aggressive' | 'defensive' | 'support' | 'swarm' | 'ranged'
  targetId?: string
  aggroRange: number
  deaggroRange: number
  // 状态效果
  statusEffects: StatusEffect[]
  // 特殊能力
  abilities: EnemyAbility[]
  // 动画状态
  animationState: 'idle' | 'moving' | 'attacking' | 'hit' | 'dying' | 'special'
  animationFrame: number
  animationTimer: number
  // 外观
  glowColor: string
  particleEffects: string[]
  // 掉落物
  dropTable: DropItem[]
  experienceValue: number
}

// 敌人能力
export interface EnemyAbility {
  id: string
  name: string
  cooldown: number
  range: number
  damage: number
  effects: SkillEffect[]
  animation: string
  lastUsed: number
}

// 掉落物品
export interface DropItem {
  id: string
  type: 'experience' | 'health' | 'energy' | 'item'
  value: number
  chance: number
  icon: string
}

// 投射物
export interface Projectile {
  id: string
  position: { x: number; y: number }
  velocity: { x: number; y: number }
  damage: number
  pierce: number
  maxPierce: number
  size: number
  color: string
}

// 游戏状态
export interface GameState {
  level: number
  timeRemaining: number
  enemies: Enemy[]
  projectiles: Projectile[]
  player: PlayerState
  isPaused: boolean
  isGameOver: boolean
  score: number
  seasonSeed: string
}

// 关卡配置
export interface LevelConfig {
  level: number
  duration: number
  enemySpawnRate: number
  enemyTypes: string[]
  bossType?: string
  isBossLevel: boolean
}

// 赛季配置
export interface SeasonConfig {
  id: string
  name: string
  startDate: string
  endDate: string
  theme: string
  seed: string
  isActive: boolean
}

// 排行榜条目
export interface LeaderboardEntry {
  id: string
  playerName: string
  score: number
  level: number
  time: number
  build: string[]
  seasonId: string
  rank: number
}

