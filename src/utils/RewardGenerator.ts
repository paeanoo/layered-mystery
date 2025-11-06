import { ATTRIBUTE_REWARDS, SPECIAL_REWARDS, BOSS_EXCLUSIVE_REWARDS, LEGENDARY_REWARDS, BOSS_REWARD_SELECTION, getTierMultiplier, type RewardOption, type RewardCategory } from '../types/reward'

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

function categoryPool(category: RewardCategory): RewardOption[] {
  if (category === 'attribute') return ATTRIBUTE_REWARDS
  if (category === 'special') return SPECIAL_REWARDS
  return []
}

// 协同加权示例：根据玩家当前倾向微调
function synergyAdjust(opt: RewardOption, ctx?: RewardContext): number {
  if (!ctx?.playerStats) return opt.weight || 1
  const p = ctx.playerStats
  let w = opt.weight || 1
  // 攻速高 → 偏向投射物
  if ((p.attackSpeed || 1) > 1.4) {
    if (opt.effectKey.includes('projectiles')) w += 2
  }
  // 暴击高 → 偏向暴伤/穿透
  if ((p.critChance || 0) > 0.25) {
    if (opt.effectKey.includes('crit') || opt.effectKey.includes('pierce')) w += 2
  }
  return Math.max(1, w)
}

export function generateBossRewards(layer: number, ctx?: RewardContext): GeneratedReward[] {
  const sel = BOSS_REWARD_SELECTION[layer]
  const exclude = new Set<string>(ctx?.recentOfferedIds || [])
  const results: GeneratedReward[] = []

  const bossExclusive = BOSS_EXCLUSIVE_REWARDS[layer] || []
  const bossPicked = weightedSample(bossExclusive, sel?.bossExclusiveCount || 0, exclude)
  bossPicked.forEach(opt => {
    results.push({ option: opt, scaledValue: pickTierValue(opt, layer) })
    exclude.add(opt.id)
  })

  // 通用池：包含属性、特效两类
  const needCommon = Math.max(0, (sel?.candidates || 0) - results.length)
  const perType = Math.max(1, Math.floor(needCommon / 2))
  const leftovers = needCommon - perType * 2

  const attrPicked = weightedSample(categoryPool('attribute'), perType, exclude, (o) => synergyAdjust(o, ctx))
  const specialPicked = weightedSample(categoryPool('special'), perType + leftovers, exclude, (o) => synergyAdjust(o, ctx))

  ;[...attrPicked, ...specialPicked].forEach(opt => {
    results.push({ option: opt, scaledValue: pickTierValue(opt, layer) })
    exclude.add(opt.id)
  })

  // 第20层可插入1个传说候选（不保证被选中，只作为候选之一）
  if (layer >= 20 && results.length > 0) {
    const lgd = weightedSample(LEGENDARY_REWARDS, 1, exclude)
    if (lgd[0]) {
      results.push({ option: lgd[0], scaledValue: pickTierValue(lgd[0], layer) })
    }
  }

  return results.slice(0, sel?.candidates || results.length)
}


