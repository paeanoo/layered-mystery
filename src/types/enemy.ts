// 敌人类型枚举
export enum EnemyType {
  GRUNT = 'grunt',      // 步兵：慢速近战，基础血包
  RUNNER = 'runner',    // 疾跑：高速脆皮，逼走位
  SHOOTER = 'shooter',  // 投射：远程直线弹
  SHIELDED = 'shielded', // 护盾：正面减伤/护盾角度
  BRUTE = 'brute',      // 肉盾：高血量，极慢
  EXPLODER = 'exploder', // 爆裂：死亡留炸圈（0.8s 延时）
  HEALER = 'healer',    // 治愈：对半径内敌人小 HoT
  ELITE = 'elite'       // 精英：任一上面加速/体型/分裂词缀
}

// 精英词缀
export enum EliteAffix {
  SWIFT = 'swift',      // 移速 ×1.25
  BULWARK = 'bulwark',  // 受伤 -25%
  SPLIT = 'split',      // 死亡分裂为 2×（HP×0.35）小怪
  VAMP = 'vamp'         // 每 3s 汲取周围友军 2% HP
}

// 敌人基础配置
export interface EnemyConfig {
  hp1: number           // 第1层基础血量
  hpMul: [number, number] // [前10层增长, 后10层增长]
  dmg1: number          // 第1层基础伤害
  dmgInc: [number, number] // [前10层增长, 后10层增长]
  mv: [number, number]  // [第1层移速, 第20层移速]
  dp: number           // 难度点数
  special?: {
    frontalDR?: number  // 正面减伤（护盾）
    boomDelay?: number  // 爆炸延时
    hot?: number        // 治疗量
    shootInterval?: number // 射击间隔
  }
}

// 敌人配置表
export const ENEMY_CONFIG: Record<EnemyType, EnemyConfig> = {
  [EnemyType.GRUNT]: {
    hp1: 80, hpMul: [1.12, 1.16], dmg1: 6, dmgInc: [0.7, 1.0], 
    mv: [1.1, 1.45], dp: 1.0
  },
  [EnemyType.RUNNER]: {
    hp1: 56, hpMul: [1.12, 1.16], dmg1: 6, dmgInc: [0.7, 1.0], 
    mv: [1.7, 2.2], dp: 1.2
  },
  [EnemyType.SHOOTER]: {
    hp1: 72, hpMul: [1.12, 1.16], dmg1: 7, dmgInc: [0.7, 1.0], 
    mv: [1.1, 1.5], dp: 1.4, special: { shootInterval: 1.2 }
  },
  [EnemyType.SHIELDED]: {
    hp1: 88, hpMul: [1.12, 1.16], dmg1: 6, dmgInc: [0.7, 1.0], 
    mv: [1.1, 1.5], dp: 1.6, special: { frontalDR: 0.35 }
  },
  [EnemyType.BRUTE]: {
    hp1: 144, hpMul: [1.12, 1.16], dmg1: 8, dmgInc: [0.9, 1.2], 
    mv: [0.75, 1.0], dp: 2.2
  },
  [EnemyType.EXPLODER]: {
    hp1: 64, hpMul: [1.12, 1.16], dmg1: 14, dmgInc: [1.0, 1.4], 
    mv: [1.3, 1.8], dp: 1.4, special: { boomDelay: 0.8 }
  },
  [EnemyType.HEALER]: {
    hp1: 72, hpMul: [1.12, 1.16], dmg1: 0, dmgInc: [0, 0], 
    mv: [1.1, 1.4], dp: 1.8, special: { hot: 0.8 }
  },
  [EnemyType.ELITE]: {
    hp1: 176, hpMul: [1.12, 1.16], dmg1: 8, dmgInc: [0.9, 1.3], 
    mv: [1.2, 1.6], dp: 3.5
  }
}

// 精英词缀配置
export const ELITE_AFFIX_CONFIG = {
  [EliteAffix.SWIFT]: { moveSpeedMultiplier: 1.25 },
  [EliteAffix.BULWARK]: { damageReduction: 0.25 },
  [EliteAffix.SPLIT]: { splitCount: 2, splitHpRatio: 0.35 },
  [EliteAffix.VAMP]: { vampInterval: 3000, vampRatio: 0.02 }
}

// Boss配置
export interface BossConfig {
  type: 'rotating_shield' | 'split_boss'
  hp: number
  damage: number
  moveSpeed: number
  special: any
}

export const BOSS_CONFIG: Record<number, BossConfig> = {
  10: {
    type: 'rotating_shield',
    hp: 800,
    damage: 15,
    moveSpeed: 0.8,
    special: {
      shieldSectors: 3,
      sectorAngle: 90,
      rotationPeriod: 2200,
      spawnInterval: 6000
    }
  },
  20: {
    type: 'split_boss',
    hp: 1500,
    damage: 20,
    moveSpeed: 0.9,
    special: {
      splitThresholds: [0.7, 0.4],
      splitHpRatio: 0.45,
      damageReduction: -0.2,
      spawnInterval: 8000
    }
  }
}

// 层数引入配置
export interface LayerIntroConfig {
  enemies: Array<{
    type: EnemyType
    count: number
    weight?: number
  }>
  waves: number
  waveInterval: number
  dpBudget: number
}

export const LAYER_INTRO_CONFIG: Record<number, LayerIntroConfig> = {
  1: { enemies: [{ type: EnemyType.GRUNT, count: 22 }], waves: 4, waveInterval: 2500, dpBudget: 22 },
  2: { enemies: [{ type: EnemyType.GRUNT, count: 26 }], waves: 4, waveInterval: 2400, dpBudget: 26 },
  3: { enemies: [{ type: EnemyType.GRUNT, count: 20 }, { type: EnemyType.RUNNER, count: 8 }], waves: 4, waveInterval: 2300, dpBudget: 30 },
  4: { enemies: [{ type: EnemyType.GRUNT, count: 16 }, { type: EnemyType.RUNNER, count: 6 }, { type: EnemyType.SHOOTER, count: 4 }], waves: 4, waveInterval: 2200, dpBudget: 35 },
  5: { enemies: [{ type: EnemyType.GRUNT, count: 16 }, { type: EnemyType.RUNNER, count: 8 }, { type: EnemyType.SHOOTER, count: 4 }, { type: EnemyType.SHIELDED, count: 2 }], waves: 5, waveInterval: 2200, dpBudget: 40 },
  6: { enemies: [{ type: EnemyType.GRUNT, count: 12 }, { type: EnemyType.RUNNER, count: 8 }, { type: EnemyType.SHOOTER, count: 6 }, { type: EnemyType.BRUTE, count: 2 }], waves: 5, waveInterval: 2100, dpBudget: 45 },
  7: { enemies: [{ type: EnemyType.GRUNT, count: 10 }, { type: EnemyType.RUNNER, count: 10 }, { type: EnemyType.SHOOTER, count: 6 }, { type: EnemyType.EXPLODER, count: 2 }], waves: 5, waveInterval: 2000, dpBudget: 50 },
  8: { enemies: [{ type: EnemyType.GRUNT, count: 8 }, { type: EnemyType.RUNNER, count: 8 }, { type: EnemyType.SHOOTER, count: 6 }, { type: EnemyType.HEALER, count: 2 }], waves: 5, waveInterval: 1900, dpBudget: 55 },
  9: { enemies: [{ type: EnemyType.GRUNT, count: 6 }, { type: EnemyType.RUNNER, count: 8 }, { type: EnemyType.SHOOTER, count: 6 }, { type: EnemyType.ELITE, count: 1 }], waves: 5, waveInterval: 1800, dpBudget: 60 }
}

// 计算敌人属性
export function calculateEnemyStats(type: EnemyType, level: number): {
  hp: number
  damage: number
  moveSpeed: number
} {
  const config = ENEMY_CONFIG[type]
  const isEarlyGame = level <= 10
  
  // 计算血量
  const hpMultiplier = isEarlyGame ? config.hpMul[0] : config.hpMul[1]
  const hp = config.hp1 * Math.pow(hpMultiplier, level - 1)
  
  // 计算伤害
  const dmgIncrement = isEarlyGame ? config.dmgInc[0] : config.dmgInc[1]
  const damage = config.dmg1 + (level - 1) * dmgIncrement
  
  // 计算移速（线性插值）
  const moveSpeed = config.mv[0] + (config.mv[1] - config.mv[0]) * (level - 1) / 19
  
  return { hp, damage, moveSpeed }
}
