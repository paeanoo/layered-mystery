// 奖励系统类型与配置

export type RewardCategory = 'attribute' | 'special' | 'epic' | 'legendary'

// Debuff效果定义
export interface DebuffEffect {
  // Debuff类型：damage_reduction(伤害减免降低), move_speed_reduction(移速降低), 
  // health_reduction(最大生命降低，固定值), attack_speed_reduction(攻速降低),
  // crit_chance_reduction(暴击率降低), increased_damage_taken(受到伤害增加)
  type: 'damage_reduction' | 'move_speed_reduction' | 'health_reduction' | 
        'attack_speed_reduction' | 'crit_chance_reduction' | 'increased_damage_taken'
  // 负面效果的数值
  // - 百分比类型用小数，如0.15表示-15%
  // - health_reduction使用固定值（整数），如-2表示最大生命-2
  value: number
  // Debuff描述（用于UI显示）
  description: string
}

export interface RewardOption {
  id: string
  name: string
  description: string
  category: RewardCategory
  // baseValue: 对于百分比类用小数，如 0.2 代表 +20%；定值用整数
  baseValue?: number
  // 多档位，如 [+15%, +25%, +35%] 或 [+1, +2]
  tiers?: Array<number>
  // 对应 UI 颜色：green(属性奖励)/blue(特殊效果)/purple(史诗)/gold(传说，Boss层专属)
  color: 'green' | 'blue' | 'purple' | 'gold'
  // 选择时应用的效果键（由外部系统解释执行）
  effectKey: string
  // 可选：用于生成器的权重（基础）
  weight?: number
  // 可选：负面效果（Debuff）- 获得强力效果的同时承受负面效果
  debuff?: DebuffEffect
}

export interface RewardSelectionConfig {
  // 每个Boss层的候选数量（全部为传说品质）
  candidates: number
}

export const BOSS_REWARD_SELECTION: Record<number, RewardSelectionConfig> = {
  5: { candidates: 3 },
  10: { candidates: 4 },
  15: { candidates: 5 },
  20: { candidates: 6 }
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
  { id: 'attr_damage_t1', name: '伤害提升', description: '攻击伤害 +15%', category: 'attribute', tiers: [0.15, 0.25, 0.35], color: 'green', effectKey: 'damage_pct', weight: 10 },
  { id: 'attr_attack_speed_t1', name: '攻速提升', description: '攻击速度 +20%', category: 'attribute', tiers: [0.2, 0.3, 0.4], color: 'green', effectKey: 'attack_speed_pct', weight: 10 },
  { id: 'attr_crit_chance_t1', name: '暴击率', description: '暴击率 +8%', category: 'attribute', tiers: [0.08, 0.12, 0.16], color: 'green', effectKey: 'crit_chance_add', weight: 8 },
  { id: 'attr_crit_damage_t1', name: '暴击伤害', description: '暴击伤害 +0.2x', category: 'attribute', tiers: [0.2, 0.4, 0.6], color: 'green', effectKey: 'crit_damage_add', weight: 7 },
  { id: 'attr_projectiles_t1', name: '投射物数量', description: '投射物 +1', category: 'attribute', tiers: [1, 2], color: 'green', effectKey: 'projectiles_add', weight: 6 },
  { id: 'attr_pierce_t1', name: '穿透次数', description: '穿透 +1', category: 'attribute', tiers: [1, 2], color: 'green', effectKey: 'pierce_add', weight: 6 },
  { id: 'attr_move_speed_t1', name: '移动速度', description: '移动速度 +10%', category: 'attribute', tiers: [0.10, 0.20, 0.30], color: 'green', effectKey: 'move_speed_pct', weight: 8 },
  { id: 'attr_lifesteal_t1', name: '生命偷取', description: '生命偷取 +5%', category: 'attribute', tiers: [0.05, 0.10, 0.15], color: 'green', effectKey: 'lifesteal_add', weight: 6 },
  { id: 'attr_regen_t1', name: '生命回复', description: '每秒 +1', category: 'attribute', tiers: [1, 2, 3], color: 'green', effectKey: 'regeneration_add', weight: 6 },
  { id: 'attr_max_hp_t1', name: '最大生命', description: '最大生命 +3', category: 'attribute', tiers: [3, 6, 10], color: 'green', effectKey: 'max_health_add', weight: 8 },
  { id: 'attr_all_damage_t1', name: '基础伤害', description: '攻击伤害 +10%（固定值）', category: 'attribute', baseValue: 0.10, color: 'green', effectKey: 'all_damage_pct', weight: 5 },
  { id: 'attr_elite_damage_t1', name: '对精英伤害', description: '对精英伤害 +25%', category: 'attribute', baseValue: 0.25, color: 'green', effectKey: 'elite_damage_pct', weight: 5 },
  { id: 'attr_boss_damage_t1', name: '对Boss伤害', description: '对Boss伤害 +20%', category: 'attribute', baseValue: 0.20, color: 'green', effectKey: 'boss_damage_pct', weight: 5 },
  { id: 'attr_aoe_t1', name: '范围效果', description: '范围效果 +30%', category: 'attribute', baseValue: 0.30, color: 'green', effectKey: 'aoe_radius_pct', weight: 5 },
]

// 武器转型奖励已删除 - 与现有功能重复（投射物数量=散弹枪，攻速=加特林等）

// 特殊效果（示例）
export const SPECIAL_REWARDS: RewardOption[] = [
  { id: 'sp_chain_lightning', name: '连锁闪电', description: '15%几率在命中时产生电弧，至多跳跃3个目标（距离较近时更容易连锁）', category: 'special', color: 'blue', effectKey: 'on_hit_chain_lightning', weight: 6, debuff: { type: 'move_speed_reduction', value: 0.10, description: '移动速度 -10%' } },
  { id: 'sp_freeze', name: '寒霜冻结', description: '10%几率冰封敌人1.5秒，被冰封的敌人会减速并承受额外碎裂伤害', category: 'special', color: 'blue', effectKey: 'on_hit_freeze', weight: 5 },
  { id: 'sp_poison', name: '剧毒', description: '攻击使敌人中毒（3s 50%伤害）', category: 'special', color: 'blue', effectKey: 'on_hit_poison', weight: 6, debuff: { type: 'health_reduction', value: 2, description: '最大生命 -2' } },
  { id: 'sp_crit_explosion', name: '爆裂暴击', description: '暴击时小范围爆炸', category: 'special', color: 'blue', effectKey: 'on_crit_explode', weight: 4, debuff: { type: 'crit_chance_reduction', value: 0.03, description: '暴击率 -3%' } },
  { id: 'sp_heal_orb', name: '治疗球', description: '击败敌人时掉落治疗球', category: 'special', color: 'blue', effectKey: 'on_kill_heal_orb', weight: 5 },
  { id: 'sp_extra_projectile', name: '额外弹幕', description: '有几率发射额外投射物', category: 'special', color: 'blue', effectKey: 'on_attack_extra_projectile', weight: 5, debuff: { type: 'attack_speed_reduction', value: 0.08, description: '攻击速度 -8%' } },
  { id: 'sp_temp_shield', name: '临时护盾', description: '受伤时获得临时护盾', category: 'special', color: 'blue', effectKey: 'on_hit_temp_shield', weight: 4 },
  { id: 'sp_low_hp_dr', name: '背水减伤', description: '生命<30%获得伤害减免', category: 'special', color: 'blue', effectKey: 'low_hp_damage_reduction', weight: 4 },
  { id: 'sp_heal_trail', name: '治疗轨迹', description: '移动时留下治疗区域', category: 'special', color: 'blue', effectKey: 'move_heal_trail', weight: 3 },
  { id: 'sp_elite_bonus', name: '精英克星', description: '击败精英获得额外属性', category: 'special', color: 'blue', effectKey: 'on_elite_kill_bonus', weight: 3, debuff: { type: 'increased_damage_taken', value: 0.10, description: '受到伤害 +10%' } },
  // 已删除的奖励：
  // - 净化（sp_purge）：敌人不会附加负面效果，没有作用
  // - 黄金雨（sp_coin_drop）：当前没有金币系统，与分数系统冲突，无实际用途
  // - 自动拾取（sp_auto_collect）：当前掉落物只有治疗球，用处不大
  // - 宠物小队（sp_pet）：功能未实现，设计冗余，提升自身属性即可应对敌人
]

// 传说（金色）— Boss层专属，最高品质奖励
export const LEGENDARY_REWARDS: RewardOption[] = [
  { id: 'lgd_ultimate_synergy', name: '终极共鸣', description: '攻击有20%概率同时触发两种已拥有的特殊效果（连锁闪电+冻结、剧毒+爆裂等）', category: 'legendary', color: 'gold', effectKey: 'dual_special_proc', weight: 1, debuff: { type: 'increased_damage_taken', value: 0.25, description: '受到伤害 +25%' } },
  // 原高级奖励，现提升为传说品质
  { id: 'lgd_shield_breaker', name: '护盾破坏者', description: '对护盾单位伤害+50%', category: 'legendary', baseValue: 0.5, color: 'gold', effectKey: 'vs_shield_bonus', weight: 8, debuff: { type: 'increased_damage_taken', value: 0.15, description: '受到伤害 +15%' } },
  { id: 'lgd_fortress_master', name: '阵地大师', description: '站立不动时伤害+20%，减伤+15%', category: 'legendary', color: 'gold', effectKey: 'fortress_master', weight: 6 },
  { id: 'lgd_command_art', name: '指挥艺术', description: '击杀后3秒内伤害+10%（可叠）', category: 'legendary', baseValue: 0.10, color: 'gold', effectKey: 'on_kill_ramp_up', weight: 5, debuff: { type: 'move_speed_reduction', value: 0.15, description: '移动速度 -15%' } },
  { id: 'lgd_heavy_ammo', name: '重装弹药', description: '穿透+1，伤害+10%', category: 'legendary', color: 'gold', effectKey: 'pierce_plus_damage', weight: 6, debuff: { type: 'attack_speed_reduction', value: 0.12, description: '攻击速度 -12%' } },
  { id: 'lgd_swarm_bane', name: '虫群克星', description: '对快速敌人伤害+40%', category: 'legendary', baseValue: 0.4, color: 'gold', effectKey: 'vs_fast_bonus', weight: 8, debuff: { type: 'health_reduction', value: 3, description: '最大生命 -3' } },
  { id: 'lgd_breed_block', name: '繁殖抑制', description: '攻击几率阻止敌人召唤', category: 'legendary', color: 'gold', effectKey: 'anti_summon_proc', weight: 6 },
  { id: 'lgd_agility', name: '敏捷身法', description: '移速+25%，无视单位碰撞', category: 'legendary', baseValue: 0.25, color: 'gold', effectKey: 'move_speed_phasing', weight: 6, debuff: { type: 'crit_chance_reduction', value: 0.05, description: '暴击率 -5%' } },
  { id: 'lgd_hive_knowledge', name: '虫巢知识', description: '击败召唤类敌人回复生命', category: 'legendary', color: 'gold', effectKey: 'heal_on_summoned_kill', weight: 5 },
  { id: 'lgd_shadow_insight', name: '暗影洞察', description: '暴击率+15%，对精英暴伤+50%', category: 'legendary', color: 'gold', effectKey: 'crit_and_elite_critdmg', weight: 8, debuff: { type: 'health_reduction', value: 4, description: '最大生命 -4' } },
  { id: 'lgd_finisher', name: '致命精准', description: '对血量<40%敌人伤害+60%', category: 'legendary', baseValue: 0.60, color: 'gold', effectKey: 'execute_bonus', weight: 6, debuff: { type: 'attack_speed_reduction', value: 0.15, description: '攻击速度 -15%' } },
  { id: 'lgd_assassin_instinct', name: '刺客直觉', description: 'Boss现身时伤害+100%', category: 'legendary', baseValue: 1.0, color: 'gold', effectKey: 'boss_reveal_burst', weight: 4, debuff: { type: 'increased_damage_taken', value: 0.20, description: '受到伤害 +20%' } },
  { id: 'lgd_chaos_adapt', name: '混沌适应', description: '免疫控制，所有属性+10%', category: 'legendary', baseValue: 0.10, color: 'gold', effectKey: 'all_stats_and_cc_immunity', weight: 6 },
  { id: 'lgd_source_leech', name: '本源汲取', description: '击败精英永久提升属性（本局）', category: 'legendary', color: 'gold', effectKey: 'elite_kill_perma_stack', weight: 5, debuff: { type: 'move_speed_reduction', value: 0.18, description: '移动速度 -18%' } },
  { id: 'lgd_chaos_resonance', name: '混沌共鸣', description: '攻击有15%几率随机触发一种特殊效果（连锁闪电、冻结、剧毒、爆裂暴击中的一种）', category: 'legendary', color: 'gold', effectKey: 'random_special_proc', weight: 5, debuff: { type: 'crit_chance_reduction', value: 0.08, description: '暴击率 -8%' } },
]

// 史诗（紫色）— 介于蓝色和金色之间的高品质奖励
export const EPIC_REWARDS: RewardOption[] = [
  { id: 'epic_chain_master', name: '连锁大师', description: '连锁闪电几率+10%，连锁目标+2，伤害+30%', category: 'epic', color: 'purple', effectKey: 'chain_lightning_enhanced', weight: 7, debuff: { type: 'move_speed_reduction', value: 0.12, description: '移动速度 -12%' } },
  { id: 'epic_frost_lord', name: '冰霜领主', description: '冻结几率+15%，冻结时间+1秒，冻结敌人受到额外50%伤害', category: 'epic', color: 'purple', effectKey: 'freeze_enhanced', weight: 6, debuff: { type: 'attack_speed_reduction', value: 0.10, description: '攻击速度 -10%' } },
  { id: 'epic_venom_weaver', name: '剧毒编织者', description: '中毒伤害+100%，持续时间+2秒，可叠加3层', category: 'epic', color: 'purple', effectKey: 'poison_enhanced', weight: 7, debuff: { type: 'health_reduction', value: 3, description: '最大生命 -3' } },
  { id: 'epic_explosive_crit', name: '爆裂专家', description: '暴击爆炸范围+50%，伤害+100%，爆炸可触发暴击', category: 'epic', color: 'purple', effectKey: 'crit_explode_enhanced', weight: 6, debuff: { type: 'crit_chance_reduction', value: 0.05, description: '暴击率 -5%' } },
  { id: 'epic_healing_master', name: '治疗大师', description: '治疗球掉落率+20%，治疗效果+50%，击败精英必定掉落', category: 'epic', color: 'purple', effectKey: 'heal_orb_enhanced', weight: 5 },
  { id: 'epic_projectile_storm', name: '弹幕风暴', description: '额外投射物触发率+30%，额外投射物数量+1', category: 'epic', color: 'purple', effectKey: 'extra_projectile_enhanced', weight: 6, debuff: { type: 'attack_speed_reduction', value: 0.12, description: '攻击速度 -12%' } },
  { id: 'epic_shield_guardian', name: '护盾守护者', description: '临时护盾值+50%，持续时间+2秒，护盾存在时伤害+15%', category: 'epic', color: 'purple', effectKey: 'temp_shield_enhanced', weight: 5, debuff: { type: 'health_reduction', value: 2, description: '最大生命 -2' } },
  { id: 'epic_last_stand', name: '背水一战', description: '生命<30%时伤害减免+25%，伤害+30%，移动速度+20%', category: 'epic', color: 'purple', effectKey: 'low_hp_enhanced', weight: 5, debuff: { type: 'health_reduction', value: 2, description: '最大生命 -2' } },
  { id: 'epic_healing_path', name: '治愈之路', description: '治疗轨迹持续时间+3秒，治疗范围+50%，每秒回复+2', category: 'epic', color: 'purple', effectKey: 'heal_trail_enhanced', weight: 4 },
  { id: 'epic_elite_hunter', name: '精英猎手', description: '击败精英获得属性提升+50%，击败精英时回复20%最大生命', category: 'epic', color: 'purple', effectKey: 'elite_bonus_enhanced', weight: 5, debuff: { type: 'increased_damage_taken', value: 0.12, description: '受到伤害 +12%' } },
  { id: 'epic_double_tap', name: '双重打击', description: '攻击有25%几率造成双倍伤害，暴击时必定触发', category: 'epic', color: 'purple', effectKey: 'double_damage_proc', weight: 7, debuff: { type: 'attack_speed_reduction', value: 0.10, description: '攻击速度 -10%' } },
  { id: 'epic_vampire_king', name: '吸血之王', description: '生命偷取+10%，击败敌人回复5%最大生命，生命值越低偷取效果越强', category: 'epic', color: 'purple', effectKey: 'vampire_enhanced', weight: 6, debuff: { type: 'health_reduction', value: 2, description: '最大生命 -2' } },
  { id: 'epic_berserker', name: '狂战士', description: '生命<50%时攻击速度+40%，伤害+25%，移动速度+15%', category: 'epic', color: 'purple', effectKey: 'berserker_rage', weight: 6, debuff: { type: 'increased_damage_taken', value: 0.15, description: '受到伤害 +15%' } },
  { id: 'epic_energy_flow', name: '能量流转', description: '暴击时回复能量，能量满时伤害+30%，技能冷却-20%', category: 'epic', color: 'purple', effectKey: 'energy_flow', weight: 5 },
  { id: 'epic_adaptive_armor', name: '自适应护甲', description: '受到伤害时获得对应类型抗性，最多叠加3层，每层减伤10%', category: 'epic', color: 'purple', effectKey: 'adaptive_armor', weight: 5, debuff: { type: 'move_speed_reduction', value: 0.08, description: '移动速度 -8%' } },
]


