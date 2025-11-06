/**
 * 基于种子的伪随机数生成器
 * 使用相同的种子会产生完全相同的随机数序列
 * 
 * 实现原理：Xorshift32 算法（快速、简单、统计特性好）
 */
export class SeededRandom {
  private seed: number

  constructor(seed: string | number) {
    // 将字符串种子转换为数字
    if (typeof seed === 'string') {
      this.seed = this.hashString(seed)
    } else {
      this.seed = seed
    }
    
    // 确保种子不为0
    if (this.seed === 0) {
      this.seed = 1
    }
  }

  /**
   * 将字符串转换为数字种子（简单哈希函数）
   */
  private hashString(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return Math.abs(hash) || 1
  }

  /**
   * 生成 0 到 1 之间的随机数
   */
  random(): number {
    // Xorshift32 算法
    this.seed ^= this.seed << 13
    this.seed ^= this.seed >>> 17
    this.seed ^= this.seed << 5
    // 转换为 0-1 之间的浮点数
    return (this.seed >>> 0) / 0xFFFFFFFF
  }

  /**
   * 生成 0 到 max（不包含）之间的随机整数
   */
  randomInt(max: number): number {
    return Math.floor(this.random() * max)
  }

  /**
   * 生成 min 到 max（包含）之间的随机整数
   */
  randomIntRange(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min + 1))
  }

  /**
   * 生成 min 到 max 之间的随机浮点数
   */
  randomFloat(min: number, max: number): number {
    return min + this.random() * (max - min)
  }

  /**
   * 从数组中随机选择一个元素
   */
  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('数组不能为空')
    }
    return array[this.randomInt(array.length)]
  }

  /**
   * 打乱数组（Fisher-Yates 洗牌算法）
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(i + 1)
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  /**
   * 根据权重随机选择索引
   */
  weightedChoice(weights: number[]): number {
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)
    let random = this.random() * totalWeight
    
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        return i
      }
    }
    return weights.length - 1
  }
}

/**
 * 全局种子随机数生成器实例
 * 使用固定种子，确保所有玩家面对相同的随机序列，保证公平竞技
 */
let globalSeededRandom: SeededRandom | null = null

/**
 * 初始化全局种子随机数生成器
 */
export function initSeededRandom(seed: string): void {
  globalSeededRandom = new SeededRandom(seed)
  console.log('✅ 已初始化种子随机数生成器，种子:', seed)
}

/**
 * 获取全局种子随机数生成器
 * 如果没有初始化，会创建一个默认的
 */
export function getSeededRandom(): SeededRandom {
  if (!globalSeededRandom) {
    // 如果没有设置种子，使用默认种子（不推荐用于生产环境）
    console.warn('⚠️ 种子随机数生成器未初始化，使用默认种子')
    globalSeededRandom = new SeededRandom('default_seed')
  }
  return globalSeededRandom
}

/**
 * 重置全局随机数生成器（用于新游戏）
 */
export function resetSeededRandom(seed: string): void {
  initSeededRandom(seed)
}

