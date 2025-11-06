// 奖励系统类型与配置

export type RewardCategory = 'attribute' | 'special' | 'boss_exclusive' | 'legendary'

export interface RewardOption {
  id: string
  name: string
  description: string
  category: RewardCategory
  // baseValue: 对于百分比类用小数，如 0.2 代表 +20%；定值用整数
  baseValue?: number
  // 多档位，如 [+15%, +25%, +35%] 或 [+1, +2]
  tiers?: Array<number>
  // 对应 UI 颜色：white/green/blue/purple/gold
  color: 'white' | 'green' | 'blue' | 'purple' | 'gold'
  // 选择时应用的效果键（由外部系统解释执行）
  effectKey: string
  // 可选：用于生成器的权重（基础）
  weight?: number
}

export interface RewardSelectionConfig {
  // 每个Boss层的候选数量与分类占比
  candidates: number
  bossExclusiveCount: number
}

export const BOSS_REWARD_SELECTION: Record<number, RewardSelectionConfig> = {
  5: { candidates: 6, bossExclusiveCount: 2 },
  10: { candidates: 7, bossExclusiveCount: 2 },
  15: { candidates: 8, bossExclusiveCount: 3 },
  20: { candidates: 10, bossExclusiveCount: 4 }
}

// 层级倍率（品质梯度）
export function getTierMultiplier(layer: number): number {
  if (layer >= 20) return 2.0
  if (layer >= 15) return 1.6
  if (layer >= 10) return 1.3
  return 1.0
}

// 属性增强（部分示例，完整表可逐步扩展）
export const ATTRIBUTE_REWARDS: RewardOption[] = [
  { id: 'attr_damage_t1', name: '伤害提升', description: '攻击伤害 +15%', category: 'attribute', tiers: [0.15, 0.25, 0.35], color: 'white', effectKey: 'damage_pct', weight: 10 },
  { id: 'attr_attack_speed_t1', name: '攻速提升', description: '攻击速度 +20%', category: 'attribute', tiers: [0.2, 0.3, 0.4], color: 'white', effectKey: 'attack_speed_pct', weight: 10 },
  { id: 'attr_crit_chance_t1', name: '暴击率', description: '暴击率 +8%', category: 'attribute', tiers: [0.08, 0.12, 0.16], color: 'white', effectKey: 'crit_chance_add', weight: 8 },
  { id: 'attr_crit_damage_t1', name: '暴击伤害', description: '暴击伤害 +0.2x', category: 'attribute', tiers: [0.2, 0.4, 0.6], color: 'white', effectKey: 'crit_damage_add', weight: 7 },
  { id: 'attr_projectiles_t1', name: '投射物数量', description: '投射物 +1', category: 'attribute', tiers: [1, 2], color: 'white', effectKey: 'projectiles_add', weight: 6 },
  { id: 'attr_pierce_t1', name: '穿透次数', description: '穿透 +1', category: 'attribute', tiers: [1, 2], color: 'white', effectKey: 'pierce_add', weight: 6 },
  { id: 'attr_move_speed_t1', name: '移动速度', description: '移动速度 +10%', category: 'attribute', tiers: [0.10, 0.20, 0.30], color: 'white', effectKey: 'move_speed_pct', weight: 8 },
  { id: 'attr_lifesteal_t1', name: '生命偷取', description: '生命偷取 +5%', category: 'attribute', tiers: [0.05, 0.10, 0.15], color: 'white', effectKey: 'lifesteal_add', weight: 6 },
  { id: 'attr_regen_t1', name: '生命回复', description: '每秒 +1', category: 'attribute', tiers: [1, 2, 3], color: 'white', effectKey: 'regeneration_add', weight: 6 },
  { id: 'attr_max_hp_t1', name: '最大生命', description: '最大生命 +3', category: 'attribute', tiers: [3, 6, 10], color: 'white', effectKey: 'max_health_add', weight: 8 },
  { id: 'attr_all_damage_t1', name: '所有伤害', description: '所有伤害 +10%', category: 'attribute', baseValue: 0.10, color: 'white', effectKey: 'all_damage_pct', weight: 5 },
  { id: 'attr_elite_damage_t1', name: '对精英伤害', description: '对精英伤害 +25%', category: 'attribute', baseValue: 0.25, color: 'white', effectKey: 'elite_damage_pct', weight: 5 },
  { id: 'attr_boss_damage_t1', name: '对Boss伤害', description: '对Boss伤害 +20%', category: 'attribute', baseValue: 0.20, color: 'white', effectKey: 'boss_damage_pct', weight: 5 },
  { id: 'attr_aoe_t1', name: '范围效果', description: '范围效果 +30%', category: 'attribute', baseValue: 0.30, color: 'white', effectKey: 'aoe_radius_pct', weight: 5 },
]

// 武器转型奖励已删除 - 与现有功能重复（投射物数量=散弹枪，攻速=加特林等）

// 特殊效果（示例）
export const SPECIAL_REWARDS: RewardOption[] = [
  { id: 'sp_chain_lightning', name: '连锁闪电', description: '15%几率连锁闪电（3目标）', category: 'special', color: 'green', effectKey: 'on_hit_chain_lightning', weight: 6 },
  { id: 'sp_freeze', name: '寒霜冻结', description: '10%几率冻结1.5秒', category: 'special', color: 'green', effectKey: 'on_hit_freeze', weight: 5 },
  { id: 'sp_poison', name: '剧毒', description: '攻击使敌人中毒（3s 50%伤害）', category: 'special', color: 'green', effectKey: 'on_hit_poison', weight: 6 },
  { id: 'sp_crit_explosion', name: '爆裂暴击', description: '暴击时小范围爆炸', category: 'special', color: 'green', effectKey: 'on_crit_explode', weight: 4 },
  { id: 'sp_heal_orb', name: '治疗球', description: '击败敌人时掉落治疗球', category: 'special', color: 'green', effectKey: 'on_kill_heal_orb', weight: 5 },
  { id: 'sp_extra_projectile', name: '额外弹幕', description: '有几率发射额外投射物', category: 'special', color: 'green', effectKey: 'on_attack_extra_projectile', weight: 5 },
  { id: 'sp_temp_shield', name: '临时护盾', description: '受伤时获得临时护盾', category: 'special', color: 'green', effectKey: 'on_hit_temp_shield', weight: 4 },
  { id: 'sp_low_hp_dr', name: '背水减伤', description: '生命<30%获得伤害减免', category: 'special', color: 'green', effectKey: 'low_hp_damage_reduction', weight: 4 },
  { id: 'sp_heal_trail', name: '治疗轨迹', description: '移动时留下治疗区域', category: 'special', color: 'green', effectKey: 'move_heal_trail', weight: 3 },
  { id: 'sp_elite_bonus', name: '精英克星', description: '击败精英获得额外属性', category: 'special', color: 'green', effectKey: 'on_elite_kill_bonus', weight: 3 },
  // 已删除的奖励：
  // - 净化（sp_purge）：敌人不会附加负面效果，没有作用
  // - 黄金雨（sp_coin_drop）：当前没有金币系统，与分数系统冲突，无实际用途
  // - 自动拾取（sp_auto_collect）：当前掉落物只有治疗球，用处不大
  // - 宠物小队（sp_pet）：功能未实现，设计冗余，提升自身属性即可应对敌人
]

// Boss专属（四个Boss）
export const BOSS_EXCLUSIVE_REWARDS: Record<number, RewardOption[]> = {
  5: [
    { id: 'boss5_shield_breaker', name: '护盾破坏者', description: '对护盾单位伤害+50%', category: 'boss_exclusive', baseValue: 0.5, color: 'purple', effectKey: 'vs_shield_bonus', weight: 8 },
    { id: 'boss5_fortress_master', name: '阵地大师', description: '站立不动时伤害+20%，减伤+15%', category: 'boss_exclusive', color: 'purple', effectKey: 'fortress_master', weight: 6 },
    { id: 'boss5_command_art', name: '指挥艺术', description: '击杀后3秒内伤害+10%（可叠）', category: 'boss_exclusive', baseValue: 0.10, color: 'purple', effectKey: 'on_kill_ramp_up', weight: 5 },
    { id: 'boss5_heavy_ammo', name: '重装弹药', description: '穿透+1，伤害+10%', category: 'boss_exclusive', color: 'purple', effectKey: 'pierce_plus_damage', weight: 6 },
  ],
  10: [
    { id: 'boss10_swarm_bane', name: '虫群克星', description: '对快速敌人伤害+40%', category: 'boss_exclusive', baseValue: 0.4, color: 'purple', effectKey: 'vs_fast_bonus', weight: 8 },
    { id: 'boss10_breed_block', name: '繁殖抑制', description: '攻击几率阻止敌人召唤', category: 'boss_exclusive', color: 'purple', effectKey: 'anti_summon_proc', weight: 6 },
    { id: 'boss10_agility', name: '敏捷身法', description: '移速+25%，无视单位碰撞', category: 'boss_exclusive', baseValue: 0.25, color: 'purple', effectKey: 'move_speed_phasing', weight: 6 },
    { id: 'boss10_hive_knowledge', name: '虫巢知识', description: '击败召唤类敌人回复生命', category: 'boss_exclusive', color: 'purple', effectKey: 'heal_on_summoned_kill', weight: 5 },
  ],
  15: [
    { id: 'boss15_shadow_insight', name: '暗影洞察', description: '暴击率+15%，对精英暴伤+50%', category: 'boss_exclusive', color: 'purple', effectKey: 'crit_and_elite_critdmg', weight: 8 },
    { id: 'boss15_finisher', name: '致命精准', description: '对血量<40%敌人伤害+60%', category: 'boss_exclusive', baseValue: 0.60, color: 'purple', effectKey: 'execute_bonus', weight: 6 },
    // 暗影步（隐身功能）已删除 - 隐身功能没有实际用途
    { id: 'boss15_assassin_instinct', name: '刺客直觉', description: 'Boss现身时伤害+100%', category: 'boss_exclusive', baseValue: 1.0, color: 'purple', effectKey: 'boss_reveal_burst', weight: 4 },
  ],
  20: [
    { id: 'boss20_chaos_adapt', name: '混沌适应', description: '免疫控制，所有属性+10%', category: 'boss_exclusive', baseValue: 0.10, color: 'purple', effectKey: 'all_stats_and_cc_immunity', weight: 6 },
    { id: 'boss20_form_master', name: '形态大师', description: '可在两种武器模式间切换', category: 'boss_exclusive', color: 'purple', effectKey: 'dual_weapon_modes', weight: 5 },
    { id: 'boss20_source_leech', name: '本源汲取', description: '击败精英永久提升属性（本局）', category: 'boss_exclusive', color: 'purple', effectKey: 'elite_kill_perma_stack', weight: 5 },
    { id: 'boss20_chaos_resonance', name: '混沌共鸣', description: '攻击几率随机触发特殊效果', category: 'boss_exclusive', color: 'purple', effectKey: 'random_special_proc', weight: 5 },
  ],
}

// 传说（金色）— 第20层候选中可插入
export const LEGENDARY_REWARDS: RewardOption[] = [
  { id: 'lgd_ultimate_synergy', name: '终极共鸣', description: '攻击有概率同时触发两种特效', category: 'legendary', color: 'gold', effectKey: 'dual_special_proc', weight: 1 },
]


