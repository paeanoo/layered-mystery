import { LEGENDARY_REWARDS, BOSS_REWARD_SELECTION, ATTRIBUTE_REWARDS, SPECIAL_REWARDS, EPIC_REWARDS, getTierMultiplier, type RewardOption } from '../types/reward'

export interface RewardContext {
  layer: number
  // 玩家当前构筑倾向（可选，影响权重）
  playerStats?: {
    damage?: number
    attackSpeed?: number
    critChance?: number
    projectiles?: number
    pierce?: number
    moveSpeed?: number
  }
  // 历史以防重复（本局已给出的候选ID）
  recentOfferedIds?: string[]
}

export interface GeneratedReward {
  option: RewardOption
  // 选中的具体数值（按层倍率换算后的最终值），留给应用层解释
  scaledValue?: number
}

function weightedSample<T extends RewardOption>(pool: T[], count: number, exclude: Set<string>, adjustWeight?: (opt: T) => number): T[] {
  const result: T[] = []
  const used = new Set<string>()
  for (let i = 0; i < count; i++) {
    const candidates = pool.filter(p => !exclude.has(p.id) && !used.has(p.id))
    if (candidates.length === 0) break
    const weights = candidates.map(c => Math.max(1, Math.floor((adjustWeight ? adjustWeight(c) : (c.weight || 1)))))
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    let pickIndex = 0
    for (let k = 0; k < candidates.length; k++) {
      r -= weights[k]
      if (r <= 0) { pickIndex = k; break }
    }
    const picked = candidates[pickIndex]
    if (picked) {
      result.push(picked)
      used.add(picked.id)
    }
  }
  return result
}

function pickTierValue(opt: RewardOption, layer: number): number | undefined {
  const mult = getTierMultiplier(layer)
  if (opt.tiers && opt.tiers.length > 0) {
    // 选择档位：5层用tiers[0]，10层取近似中间，15层靠高，20层最高
    let idx = 0
    if (layer >= 20) idx = opt.tiers.length - 1
    else if (layer >= 15) idx = Math.min(opt.tiers.length - 1, Math.ceil(opt.tiers.length * 0.67) - 1)
    else if (layer >= 10) idx = Math.min(opt.tiers.length - 1, Math.ceil(opt.tiers.length * 0.34) - 1)
    else idx = 0
    const base = opt.tiers[idx]
    // 百分比与定值都乘，以便在高层更有力；应用层可再裁剪/取整
    return typeof base === 'number' ? base * mult : undefined
  }
  if (typeof opt.baseValue === 'number') return opt.baseValue * mult
  return undefined
}

// 协同加权示例：根据玩家当前倾向微调
function synergyAdjust(opt: RewardOption, ctx?: RewardContext): number {
  if (!ctx?.playerStats) return opt.weight || 1
  const p = ctx.playerStats
  let w = opt.weight || 1
  // 攻速高 → 偏向投射物相关
  if ((p.attackSpeed || 1) > 1.4) {
    if (opt.effectKey.includes('projectiles') || opt.effectKey.includes('attack_speed')) w += 2
  }
  // 暴击高 → 偏向暴伤/穿透
  if ((p.critChance || 0) > 0.25) {
    if (opt.effectKey.includes('crit') || opt.effectKey.includes('pierce')) w += 2
  }
  return Math.max(1, w)
}

export function generateBossRewards(layer: number, ctx?: RewardContext): GeneratedReward[] {
  // Boss层只生成传说品质（最高品质）奖励
  // **修复**：确保所有Boss层（包括第20层之后）都生成传说品质奖励
  const sel = BOSS_REWARD_SELECTION[layer] || {
    candidates: layer >= 20 ? 6 : layer >= 15 ? 5 : layer >= 10 ? 4 : 3
  }
  const exclude = new Set<string>(ctx?.recentOfferedIds || [])
  
  // **关键修复**：确保只从传说奖励池（LEGENDARY_REWARDS）中选择，不包含其他品质
  // 所有Boss层都应该生成传说品质（金色）奖励，无论层数多少
  const legendaryPicked = weightedSample(LEGENDARY_REWARDS, sel.candidates, exclude, (opt) => {
    // 使用协同加权，让奖励更符合玩家当前构筑
    return synergyAdjust(opt, ctx)
  })
  
  // **验证**：确保所有生成的奖励都是传说品质（金色）
  const results: GeneratedReward[] = legendaryPicked.map(opt => {
    // 确保奖励是传说品质
    if (opt.color !== 'gold') {
      console.warn(`[generateBossRewards] 警告：Boss奖励应该是金色传说品质，但发现 ${opt.color} 品质的奖励: ${opt.id}`)
    }
    return {
      option: opt,
      scaledValue: pickTierValue(opt, layer)
    }
  })

  // **验证**：确保至少生成了1个奖励
  if (results.length === 0) {
    console.error(`[generateBossRewards] 错误：第${layer}层Boss奖励生成失败，未生成任何奖励！`)
  } else {
    console.log(`[generateBossRewards] ✅ 第${layer}层Boss奖励生成成功：${results.length}个传说品质奖励`)
  }

  return results
}

// 商店价格计算
export function calculateShopPrice(quality: 'green' | 'blue' | 'purple' | 'gold', layer: number): number {
  let basePrice = 0
  let layerIncrement = 0
  switch (quality) {
    case 'green': basePrice = 80; layerIncrement = 5; break
    case 'blue': basePrice = 150; layerIncrement = 8; break
    case 'purple': basePrice = 300; layerIncrement = 15; break
    case 'gold': basePrice = 600; layerIncrement = 30; break
  }
  const price = basePrice + layerIncrement * (layer - 1)
  return Math.max(basePrice, price)
}

// 生成商店道具
export function generateShopRewards(layer: number, ctx?: RewardContext): GeneratedReward[] {
  // 根据层数确定概率和数量
  // 更高层出现高阶道具的概率更大，但所有品质都有几率出现
  let greenProb = 0.70
  let blueProb = 0.25
  let purpleProb = 0.04
  let goldProb = 0.01
  let shopCount = 4

  if (layer >= 51) {
    greenProb = 0.10
    blueProb = 0.20
    purpleProb = 0.50
    goldProb = 0.20
    shopCount = 4
  } else if (layer >= 41) {
    greenProb = 0.15
    blueProb = 0.25
    purpleProb = 0.45
    goldProb = 0.15
    shopCount = 4
  } else if (layer >= 31) {
    greenProb = 0.20
    blueProb = 0.30
    purpleProb = 0.40
    goldProb = 0.10
    shopCount = 4
  } else if (layer >= 21) {
    greenProb = 0.30
    blueProb = 0.35
    purpleProb = 0.30
    goldProb = 0.05
    shopCount = 4
  } else if (layer >= 16) {
    greenProb = 0.40
    blueProb = 0.40
    purpleProb = 0.18
    goldProb = 0.02
    shopCount = 4
  } else if (layer >= 11) {
    greenProb = 0.50
    blueProb = 0.40
    purpleProb = 0.09
    goldProb = 0.01
    shopCount = 4
  } else if (layer >= 6) {
    greenProb = 0.65
    blueProb = 0.30
    purpleProb = 0.04
    goldProb = 0.01
    shopCount = 4
  } else {
    // 1-5层：所有品质都有概率，但绿色概率最高
    greenProb = 0.75
    blueProb = 0.20
    purpleProb = 0.04
    goldProb = 0.01
    shopCount = 4
  }

  const results: (GeneratedReward | null)[] = []
  const exclude = new Set<string>(ctx?.recentOfferedIds || [])

  // **关键修复**：确保生成足够数量的道具，如果某个品质池为空或被排除，尝试其他品质
  // 即使生成失败也要返回null，确保总数始终是shopCount
  for (let i = 0; i < shopCount; i++) {
    let attempts = 0
    const maxAttempts = 50 // 增加尝试次数
    let success = false
    let generatedItem: GeneratedReward | null = null
    
    while (attempts < maxAttempts && !success) {
      const rand = Math.random()
      let pool: RewardOption[] = []
      
      if (rand < greenProb) {
        pool = ATTRIBUTE_REWARDS.filter(r => r.color === 'green')
      } else if (rand < greenProb + blueProb) {
        pool = SPECIAL_REWARDS.filter(r => r.color === 'blue')
      } else if (rand < greenProb + blueProb + purpleProb) {
        pool = EPIC_REWARDS.filter(r => r.color === 'purple')
      } else {
        pool = LEGENDARY_REWARDS
      }

      if (pool.length > 0) {
        const picked = weightedSample(pool, 1, exclude, (opt) => synergyAdjust(opt, ctx))
        if (picked.length > 0) {
          const opt = picked[0]
          generatedItem = {
            option: opt,
            scaledValue: pickTierValue(opt, layer)
          }
          exclude.add(opt.id)
          success = true
        }
      }
      
      // 如果当前品质池失败，尝试其他品质池（按优先级：绿色 -> 蓝色 -> 紫色 -> 金色）
      if (!success) {
        const fallbackPools = [
          ATTRIBUTE_REWARDS.filter(r => r.color === 'green'),
          SPECIAL_REWARDS.filter(r => r.color === 'blue'),
          EPIC_REWARDS.filter(r => r.color === 'purple'),
          LEGENDARY_REWARDS
        ]
        
        for (const fallbackPool of fallbackPools) {
          if (fallbackPool.length > 0) {
            const picked = weightedSample(fallbackPool, 1, exclude, (opt) => synergyAdjust(opt, ctx))
            if (picked.length > 0) {
              const opt = picked[0]
              generatedItem = {
                option: opt,
                scaledValue: pickTierValue(opt, layer)
              }
              exclude.add(opt.id)
              success = true
              break
            }
          }
        }
      }
      
      attempts++
    }
    
    // **关键修复**：如果生成失败，继续尝试直到成功（最多尝试100次）
    if (success && generatedItem) {
      results.push(generatedItem)
    } else {
      // 如果所有尝试都失败，强制从绿色品质池中生成一个（确保总是有道具）
      console.warn(`[generateShopRewards] 警告：第${layer}层商店第${i+1}个道具生成失败（尝试${attempts}次），强制从绿色池生成`)
      const greenPool = ATTRIBUTE_REWARDS.filter(r => r.color === 'green')
      if (greenPool.length > 0) {
        // 不排除任何ID，强制生成
        const forcedPicked = weightedSample(greenPool, 1, new Set(), (opt) => synergyAdjust(opt, ctx))
        if (forcedPicked.length > 0) {
          const opt = forcedPicked[0]
          generatedItem = {
            option: opt,
            scaledValue: pickTierValue(opt, layer)
          }
          exclude.add(opt.id)
          results.push(generatedItem)
        } else {
          // 如果还是失败，随机选择一个绿色道具
          const randomGreen = greenPool[Math.floor(Math.random() * greenPool.length)]
          if (randomGreen) {
            generatedItem = {
              option: randomGreen,
              scaledValue: pickTierValue(randomGreen, layer)
            }
            exclude.add(randomGreen.id)
            results.push(generatedItem)
          }
        }
      }
    }
  }

  // **关键修复**：确保返回的数组长度始终是shopCount（不应该发生，但安全起见）
  if (results.length < shopCount) {
    console.error(`[generateShopRewards] 严重错误：返回的道具数量不足，需要${shopCount}个，实际${results.length}个`)
    // 补充绿色道具
    const greenPool = ATTRIBUTE_REWARDS.filter(r => r.color === 'green')
    while (results.length < shopCount && greenPool.length > 0) {
      const randomGreen = greenPool[Math.floor(Math.random() * greenPool.length)]
      if (randomGreen) {
        results.push({
          option: randomGreen,
          scaledValue: pickTierValue(randomGreen, layer)
        })
      } else {
        break
      }
    }
  }
  if (results.length > shopCount) {
    results.splice(shopCount)
  }

  return results
}

const QUALITY_POOLS: Record<'green' | 'blue' | 'purple' | 'gold', RewardOption[]> = {
  green: ATTRIBUTE_REWARDS.filter(r => r.color === 'green'),
  blue: SPECIAL_REWARDS.filter(r => r.color === 'blue'),
  purple: EPIC_REWARDS.filter(r => r.color === 'purple'),
  gold: LEGENDARY_REWARDS
}

export function generateShopItemByQuality(quality: 'green' | 'blue' | 'purple' | 'gold', layer: number, ctx?: RewardContext): GeneratedReward | undefined {
  const pool = QUALITY_POOLS[quality]
  if (!pool || pool.length === 0) return undefined
  const exclude = new Set<string>(ctx?.recentOfferedIds || [])
  const picked = weightedSample(pool, 1, exclude, (opt) => synergyAdjust(opt, ctx))
  if (picked.length === 0) return undefined
  const option = picked[0]
  return {
    option,
    scaledValue: pickTierValue(option, layer)
  }
}


