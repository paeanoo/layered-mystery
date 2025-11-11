<template>
  <div class="passive-selection-modal" v-if="visible">
    <div class="modal-overlay" @click="onClose"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>{{ showActions ? '游戏结束' : (title || '选择被动属性') }}</h2>
        <p class="level-info">{{ showActions ? '你已经死亡' : (subtitle || `第${level}层 - 选择你的强化`) }}</p>
        <div v-if="showActions" class="game-over-stats">
          <div class="stat-box">
            <div class="stat-label">到达层数</div>
            <div class="stat-value">{{ level }}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">最终分数</div>
            <div class="stat-value">{{ score || 0 }}</div>
          </div>
        </div>
      </div>
      
      <div class="passive-options" v-if="!showActions">
        <div 
          v-for="passive in availablePassives" 
          :key="passive.id"
          class="passive-card"
          :class="{ 
            selected: selectedPassive === passive.id,
            disabled: isPassiveDisabled(passive.id),
            'reward-green': getRewardColor(passive) === 'green',
            'reward-blue': getRewardColor(passive) === 'blue',
            'reward-gold': getRewardColor(passive) === 'gold'
          }"
          @click="selectPassive(passive.id)"
        >
          <div class="passive-icon" v-if="hasIcon(passive)">{{ getRewardIcon(passive) }}</div>
          <h3 class="passive-name">{{ passive.name }}</h3>
          <p class="passive-description">{{ passive.description }}</p>
          <!-- Debuff显示 -->
          <div v-if="'debuff' in passive && passive.debuff" class="debuff-info">
            <span class="debuff-label">⚠️ 负面效果:</span>
            <span class="debuff-description">{{ passive.debuff.description }}</span>
          </div>
          <!-- 形态大师特殊提示 -->
          <div v-if="'effectKey' in passive && passive.effectKey === 'dual_weapon_modes'" class="form-master-hint">
            <span class="hint-text">💡 获得后按 <kbd>Q</kbd> 或 <kbd>Tab</kbd> 键切换模式</span>
          </div>
          <!-- 统一显示统计信息：所有奖励都使用getPassiveStats，格式统一为"标签: 数值" -->
          <div class="passive-stats" v-if="getPassiveStats(passive.id)">
            <span class="stat-item" v-for="stat in getPassiveStats(passive.id)" :key="stat.label">
              {{ stat.label }}: {{ stat.value }}
            </span>
          </div>
        </div>
      </div>

      <div class="modal-actions" v-if="showActions">
        <button class="btn btn-primary" @click="onRestart">重新开始</button>
        <button class="btn btn-secondary" @click="onExit">退出</button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PassiveAttribute } from '../../types/game'
import type { RewardOption } from '../../types/reward'
import { PASSIVE_ATTRIBUTES } from '../../types/game'

interface Props {
  visible: boolean
  level: number
  score?: number
  availablePassives: (PassiveAttribute | RewardOption)[]
  selectedPassive: string | null
  playerPassives: string[]
  showActions?: boolean // 是否显示重新开始和退出按钮
  title?: string // 自定义标题（默认："选择被动属性"）
  subtitle?: string // 自定义副标题（默认："第X层 - 选择你的强化"）
}

interface Emits {
  (e: 'close'): void
  (e: 'select', passiveId: string): void
  (e: 'confirm'): void
  (e: 'restart'): void
  (e: 'exit'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectPassive = (passiveId: string) => {
  if (!isPassiveDisabled(passiveId)) {
    emit('select', passiveId)
    // 选择后立即确认
    setTimeout(() => {
      emit('confirm')
    }, 100)
  }
}

const onClose = () => {
  emit('close')
}

const onRestart = () => {
  emit('restart')
}

const onExit = () => {
  emit('exit')
}

const isPassiveDisabled = (passiveId: string): boolean => {
  // 允许重复选择，永远不禁用
  return false
}

const getPassiveStats = (passiveId: string) => {
  // 先查找基础被动属性
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  if (passive) {
    const stats = []
    
    switch (passiveId) {
      case 'attack_speed':
        stats.push({ label: '攻速', value: `+${(passive.value * 100).toFixed(0)}%` })
        break
      case 'damage':
        stats.push({ label: '伤害', value: `+${(passive.value * 100).toFixed(0)}%` })
        break
      case 'crit_chance':
        stats.push({ label: '暴击率', value: `+${(passive.value * 100).toFixed(0)}%` })
        break
      case 'projectiles':
        stats.push({ label: '投射物', value: `+${passive.value}` })
        break
      case 'pierce':
        stats.push({ label: '穿透', value: `+${passive.value}` })
        break
      case 'regeneration':
        stats.push({ label: '回复', value: `+${passive.value}/秒` })
        break
      case 'max_health':
        stats.push({ label: '生命值', value: `+${passive.value}` })
        break
      case 'move_speed':
        stats.push({ label: '移速', value: `+${(passive.value * 100).toFixed(0)}%` })
        break
      case 'lifesteal':
        stats.push({ label: '偷取', value: `+${(passive.value * 100).toFixed(0)}%` })
        break
      default:
        // 对于未知的被动属性，显示默认信息
        if (passive.type === 'multiplicative') {
          stats.push({ label: '提升', value: `+${(passive.value * 100).toFixed(0)}%` })
        } else if (passive.type === 'additive') {
          stats.push({ label: '增加', value: `+${passive.value}` })
        }
        break
    }
    return stats.length > 0 ? stats : null
  }
  
  // 如果不是基础被动属性，尝试从availablePassives中查找（可能是RewardOption）
  const rewardOption = props.availablePassives.find((p: any) => p.id === passiveId)
  if (rewardOption && 'category' in rewardOption) {
    const stats = []
    const reward = rewardOption as RewardOption
    
    // 根据category和effectKey提取数值显示
    // 1. 属性奖励（attribute）
    if (reward.category === 'attribute') {
      if (reward.effectKey.startsWith('damage_pct') || reward.effectKey === 'all_damage_pct') {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '伤害', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey.startsWith('attack_speed_pct')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '攻速', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey.startsWith('move_speed_pct')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '移速', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey.startsWith('crit_chance_add')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '暴击率', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey.startsWith('crit_damage_add')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '暴伤', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey.startsWith('projectiles_add')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '投射物', value: `+${Math.floor(value)}` })
      } else if (reward.effectKey.startsWith('pierce_add')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '穿透', value: `+${Math.floor(value)}` })
      } else if (reward.effectKey.startsWith('lifesteal_add')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '偷取', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey.startsWith('regeneration_add')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '回复', value: `+${Math.floor(value)}/秒` })
      } else if (reward.effectKey.startsWith('max_health_add')) {
        const value = reward.baseValue || (reward.tiers && reward.tiers[0] ? reward.tiers[0] : 0)
        stats.push({ label: '生命值', value: `+${Math.floor(value)}` })
      } else if (reward.effectKey === 'elite_damage_pct') {
        const value = reward.baseValue || 0.25
        stats.push({ label: '对精英', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'boss_damage_pct') {
        const value = reward.baseValue || 0.20
        stats.push({ label: '对Boss', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'aoe_radius_pct') {
        const value = reward.baseValue || 0.30
        stats.push({ label: '范围', value: `+${(value * 100).toFixed(0)}%` })
      }
    }
    // 2. 特殊效果奖励（special）
    else if (reward.category === 'special') {
      // 从description提取几率或效果信息
      if (reward.effectKey === 'on_hit_chain_lightning') {
        stats.push({ label: '几率', value: '15%' })
        stats.push({ label: '连锁', value: '3目标' })
      } else if (reward.effectKey === 'on_hit_freeze') {
        stats.push({ label: '几率', value: '10%' })
        stats.push({ label: '冻结', value: '1.5秒' })
      } else if (reward.effectKey === 'on_hit_poison') {
        stats.push({ label: '中毒', value: '3秒' })
        stats.push({ label: '伤害', value: '50%' })
      } else if (reward.effectKey === 'on_crit_explode') {
        stats.push({ label: '暴击', value: '爆炸' })
      } else if (reward.effectKey === 'low_hp_damage_reduction') {
        stats.push({ label: '触发', value: '<30%HP' })
        stats.push({ label: '效果', value: '减伤' })
      } else if (reward.effectKey === 'on_hit_temp_shield') {
        stats.push({ label: '触发', value: '受伤时' })
        stats.push({ label: '效果', value: '获得护盾' })
        stats.push({ label: '护盾值', value: '10+层数×2' })
      } else {
        // 通用特殊效果显示
        stats.push({ label: '特效', value: '✓' })
      }
    }
    // 3. 传说奖励（legendary，Boss层专属，最高品质）
    else if (reward.category === 'legendary') {
      if (reward.effectKey === 'vs_shield_bonus') {
        const value = reward.baseValue || 0.5
        stats.push({ label: '对护盾', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'fortress_master') {
        stats.push({ label: '站立伤害', value: '+20%' })
        stats.push({ label: '减伤', value: '+15%' })
      } else if (reward.effectKey === 'on_kill_ramp_up') {
        const value = reward.baseValue || 0.1
        stats.push({ label: '击杀伤害', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'pierce_plus_damage') {
        stats.push({ label: '穿透', value: '+1' })
        stats.push({ label: '伤害', value: '+10%' })
      } else if (reward.effectKey === 'vs_fast_bonus') {
        const value = reward.baseValue || 0.4
        stats.push({ label: '对快速', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'move_speed_phasing') {
        const value = reward.baseValue || 0.25
        stats.push({ label: '移速', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'crit_and_elite_critdmg') {
        stats.push({ label: '暴击率', value: '+15%' })
        stats.push({ label: '精英暴伤', value: '+50%' })
      } else if (reward.effectKey === 'execute_bonus') {
        const value = reward.baseValue || 0.6
        stats.push({ label: '低血量', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'boss_reveal_burst') {
        const value = reward.baseValue || 1.0
        stats.push({ label: 'Boss现身', value: `+${(value * 100).toFixed(0)}%` })
      } else if (reward.effectKey === 'all_stats_and_cc_immunity') {
        const value = reward.baseValue || 0.10
        stats.push({ label: '全属性', value: `+${(value * 100).toFixed(0)}%` })
        stats.push({ label: '免疫控制', value: '✓' })
      } else if (reward.effectKey === 'dual_weapon_modes') {
        stats.push({ label: '操作', value: '按Q/Tab切换' })
        stats.push({ label: '模式1', value: '高伤害' })
        stats.push({ label: '模式2', value: '高攻速' })
      } else {
        // 尝试从description提取
        const extracted = extractValueFromDescription(reward.description)
        if (extracted) {
          let label = '效果'
          if (reward.description.includes('伤害')) label = '伤害'
          else if (reward.description.includes('移速')) label = '移速'
          else if (reward.description.includes('暴击')) label = '暴击率'
          stats.push({ label, value: extracted })
        }
      }
    }
    // 4. 传说奖励（legendary）
    else if (reward.category === 'legendary') {
      if (reward.effectKey === 'dual_special_proc') {
        stats.push({ label: '效果', value: '双重触发' })
      } else {
        stats.push({ label: '传说', value: '✓' })
      }
    }
    
    return stats.length > 0 ? stats : null
  }
  
  return null
}

// 获取奖励颜色（如果是RewardOption则返回color，否则返回'green'作为默认值）
const getRewardColor = (passive: PassiveAttribute | RewardOption): string => {
  if ('color' in passive && passive.color) {
    return passive.color
  }
  // 基础属性（PassiveAttribute）没有color字段，默认显示为绿色
  return 'green'
}

// 检查是否有图标（基础属性或有特殊意义的奖励显示图标）
const hasIcon = (passive: PassiveAttribute | RewardOption): boolean => {
  // 基础属性有icon则显示
  if ('icon' in passive && passive.icon) {
    return true
  }
  // RewardOption：根据category和name判断是否显示图标
  if ('category' in passive && 'name' in passive) {
    const reward = passive as RewardOption
    const name = reward.name
    const effectKey = reward.effectKey
    
    // 传说奖励总是显示图标
    if (reward.category === 'legendary') {
      return true
    }
    
    // Boss奖励中的属性奖励（如伤害+15%、攻速+20%、暴击率+8%等）：应该显示对应的基础被动属性图标
    if (reward.category === 'attribute' && effectKey) {
      // 检查是否能找到对应的基础被动属性图标
      let basePassiveId = ''
      if (effectKey.startsWith('damage_pct') || effectKey === 'all_damage_pct') {
        basePassiveId = 'damage'
      } else if (effectKey.startsWith('attack_speed_pct')) {
        basePassiveId = 'attack_speed'
      } else if (effectKey.startsWith('crit_chance_add')) {
        basePassiveId = 'crit_chance'
      } else if (effectKey.startsWith('projectiles_add')) {
        basePassiveId = 'projectiles'
      } else if (effectKey.startsWith('pierce_add')) {
        basePassiveId = 'pierce'
      } else if (effectKey.startsWith('move_speed_pct')) {
        basePassiveId = 'move_speed'
      } else if (effectKey.startsWith('lifesteal_add')) {
        basePassiveId = 'lifesteal'
      } else if (effectKey.startsWith('regeneration_add')) {
        basePassiveId = 'regeneration'
      } else if (effectKey.startsWith('max_health_add')) {
        basePassiveId = 'max_health'
      } else if (effectKey.startsWith('crit_damage_add')) {
        // 暴击伤害：使用特殊图标
        return true
      } else if (effectKey === 'aoe_radius_pct') {
        // 范围效果：有特殊图标
        return true
      } else if (effectKey === 'elite_damage_pct') {
        // 对精英伤害：有特殊图标
        return true
      } else if (effectKey === 'boss_damage_pct') {
        // 对Boss伤害：有特殊图标
        return true
      } else if (effectKey === 'all_damage_pct') {
        // 所有伤害：有特殊图标
        return true
      }
      
      if (basePassiveId) {
        const basePassive = PASSIVE_ATTRIBUTES.find(p => p.id === basePassiveId)
        if (basePassive?.icon) {
          return true
        }
      }
    }
    
    // 特殊效果中的关键效果显示图标（所有特殊效果都应该有图标）
    if (reward.category === 'special') {
      // 所有特殊效果都显示图标
      return true
    }
  }
  return false
}

// 获取奖励图标（只有hasIcon返回true时才调用）
const getRewardIcon = (passive: PassiveAttribute | RewardOption): string => {
  if ('icon' in passive && passive.icon) {
    return passive.icon
  }
  // RewardOption：根据category和name返回对应图标
  if ('category' in passive && 'name' in passive && 'effectKey' in passive) {
    const reward = passive as RewardOption
    const name = reward.name
    const effectKey = reward.effectKey
    
    // 传说奖励（先检查，优先级最高）
    if (reward.category === 'legendary') {
      return '✨'
    }
    
    // Boss奖励中的属性奖励（如伤害+15%、攻速+20%、最大生命+3等）：使用基础被动属性的图标
    if (reward.category === 'attribute' && effectKey) {
      // 范围效果：特殊图标
      if (effectKey === 'aoe_radius_pct') {
        return '🌀' // 漩涡/范围效果图标
      }
      
      // 对精英伤害：特殊图标
      if (effectKey === 'elite_damage_pct') {
        return '⭐' // 星星图标表示对精英伤害
      }
      
      // 对Boss伤害：特殊图标
      if (effectKey === 'boss_damage_pct') {
        return '👑' // 皇冠图标表示对Boss伤害
      }
      
      // 所有伤害：特殊图标
      if (effectKey === 'all_damage_pct') {
        return '💥' // 爆炸图标表示所有伤害
      }
      
      // 暴击伤害：特殊图标
      if (effectKey.startsWith('crit_damage_add')) {
        return '💥' // 爆炸图标表示暴击伤害
      }
      
      // 根据effectKey查找对应的基础被动属性
      let basePassiveId = ''
      if (effectKey.startsWith('damage_pct') || effectKey === 'all_damage_pct') {
        basePassiveId = 'damage'
      } else if (effectKey.startsWith('attack_speed_pct')) {
        basePassiveId = 'attack_speed'
      } else if (effectKey.startsWith('crit_chance_add')) {
        basePassiveId = 'crit_chance'
      } else if (effectKey.startsWith('projectiles_add')) {
        basePassiveId = 'projectiles'
      } else if (effectKey.startsWith('pierce_add')) {
        basePassiveId = 'pierce'
      } else if (effectKey.startsWith('move_speed_pct')) {
        basePassiveId = 'move_speed'
      } else if (effectKey.startsWith('lifesteal_add')) {
        basePassiveId = 'lifesteal'
      } else if (effectKey.startsWith('regeneration_add')) {
        basePassiveId = 'regeneration'
      } else if (effectKey.startsWith('max_health_add')) {
        basePassiveId = 'max_health'
      }
      
      if (basePassiveId) {
        const basePassive = PASSIVE_ATTRIBUTES.find(p => p.id === basePassiveId)
        if (basePassive?.icon) {
          return basePassive.icon
        }
      }
    }
    
    // 特殊效果奖励
    if (reward.category === 'special') {
      if (effectKey === 'on_hit_chain_lightning') return '⚡' // 连锁闪电
      if (effectKey === 'on_hit_freeze') return '❄️' // 寒霜冻结
      if (effectKey === 'on_hit_poison') return '☠️' // 剧毒
      if (effectKey === 'on_crit_explode') return '💥' // 爆裂暴击
      if (effectKey === 'low_hp_damage_reduction') return '🛡️' // 背水减伤：盾牌图标
      if (effectKey === 'on_hit_temp_shield') return '🛡️' // 临时护盾：盾牌图标
      if (effectKey === 'move_heal_trail') return '💚' // 治疗轨迹：绿色心形图标
      if (effectKey === 'on_elite_kill_bonus') return '⭐' // 精英克星：星星图标
      if (effectKey === 'on_kill_heal_orb') return '💚' // 治疗球：绿色心形图标
      return '✨' // 默认图标
    }
  }
  return '?'
}

// 从description中提取数值显示（用于Boss奖励等没有getPassiveStats的情况）
const extractValueFromDescription = (description: string): string | null => {
  // 尝试提取百分比或数值（修复：正确处理已经包含+号的情况，避免重复显示++）
  // 优先匹配带+号的百分比
  const percentMatchWithPlus = description.match(/\+\s*(\d+(?:\.\d+)?)%/)
  if (percentMatchWithPlus) {
    return `+${percentMatchWithPlus[1]}%`
  }
  
  // 匹配带+号的数值
  const numberMatchWithPlus = description.match(/\+\s*(\d+(?:\.\d+)?)/)
  if (numberMatchWithPlus) {
    return `+${numberMatchWithPlus[1]}`
  }
  
  // 匹配普通百分比（不带+号）
  const percentMatch = description.match(/(\d+(?:\.\d+)?)%/)
  if (percentMatch) {
    return `+${percentMatch[1]}%`
  }
  
  // 匹配普通数值（不带+号）
  const numberMatch = description.match(/(\d+(?:\.\d+)?)/)
  if (numberMatch) {
    return `+${numberMatch[1]}`
  }
  
  return null
}
</script>

<style scoped>
.passive-selection-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
}

.modal-content {
  position: relative;
  background: var(--secondary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 16px;
  padding: 2rem;
  max-width: 900px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 255, 136, 0.3);
}

.modal-header {
  text-align: center;
  margin-bottom: 2rem;
}

.modal-header h2 {
  color: var(--accent-color);
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.level-info {
  color: var(--text-secondary);
  font-size: 1.2rem;
}

.game-over-stats {
  display: flex;
  justify-content: space-around;
  margin-top: 1.5rem;
  padding: 1rem;
  background: var(--primary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 12px;
}

.game-over-stats .stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.game-over-stats .stat-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
}

.game-over-stats .stat-value {
  color: var(--accent-color);
  font-size: 1.8rem;
  font-weight: bold;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.passive-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.passive-card {
  background: var(--primary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.passive-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.passive-card:hover::before {
  opacity: 1;
}

.passive-card:hover {
  border-color: var(--accent-color);
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 255, 136, 0.2);
}

.passive-card.selected {
  border-color: var(--accent-color);
  background: rgba(0, 255, 136, 0.1);
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
}

.passive-card.selected::before {
  opacity: 1;
}

.passive-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 68, 68, 0.1);
  border-color: var(--danger-color);
}

.passive-card.disabled:hover {
  transform: none;
  box-shadow: none;
}

/* 奖励颜色标识 */
.passive-card.reward-green {
  border-color: #4ade80;
}
.passive-card.reward-green:hover {
  border-color: #22c55e;
  box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
}

.passive-card.reward-blue {
  border-color: #60a5fa;
}
.passive-card.reward-blue:hover {
  border-color: #3b82f6;
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
}

.passive-card.reward-gold {
  border-color: #fbbf24;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
}
.passive-card.reward-gold:hover {
  border-color: #f59e0b;
  box-shadow: 0 10px 40px rgba(245, 158, 11, 0.5);
}
.passive-card.reward-gold.selected {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.25), rgba(245, 158, 11, 0.2));
  box-shadow: 0 0 30px rgba(245, 158, 11, 0.6);
  animation: goldPulse 2s infinite;
}

@keyframes goldPulse {
  0%, 100% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.6); }
  50% { box-shadow: 0 0 40px rgba(245, 158, 11, 0.9); }
}

.passive-icon {
  font-size: 3rem;
  text-align: center;
  margin-bottom: 1rem;
  display: block;
}

.passive-name {
  color: #ffffff; /* 白色加粗，与基础属性选择UI保持一致 */
  font-size: 1.3rem;
  margin-bottom: 0.8rem;
  text-align: center;
  font-weight: bold;
  /* 确保名称显示统一，不强调第一个字 */
  line-height: 1.4;
}

.passive-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
  text-align: center;
}

.debuff-info {
  background: rgba(255, 68, 68, 0.15);
  border: 1px solid rgba(255, 68, 68, 0.5);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.debuff-label {
  color: #ff6b6b;
  font-weight: bold;
  white-space: nowrap;
}

.debuff-description {
  color: #ff9999;
  flex: 1;
}

.passive-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.stat-item {
  background: var(--accent-color);
  color: var(--primary-bg);
  padding: 0.3rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}

.form-master-hint {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.5);
  border-radius: 8px;
  text-align: center;
}

.hint-text {
  color: #a78bfa;
  font-size: 0.85rem;
  font-weight: 500;
}

.hint-text kbd {
  background: rgba(139, 92, 246, 0.3);
  border: 1px solid rgba(139, 92, 246, 0.6);
  border-radius: 4px;
  padding: 0.2rem 0.4rem;
  font-family: monospace;
  font-size: 0.9em;
  color: #c4b5fd;
  margin: 0 0.2rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 0.8rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: var(--accent-color);
  color: var(--primary-bg);
}

.btn-primary:hover {
  background: #00cc66;
  transform: translateY(-2px);
}

.btn-secondary {
  background: var(--border-color);
  color: var(--text-primary);
}

.btn-secondary:hover {
  background: var(--text-secondary);
  transform: translateY(-2px);
}


@media (max-width: 768px) {
  .modal-content {
    padding: 1.5rem;
    width: 95%;
  }
  
  .passive-options {
    grid-template-columns: 1fr;
  }
  
  .modal-header h2 {
    font-size: 2rem;
  }
  
  .passive-card {
    padding: 1rem;
  }
  
  .passive-icon {
    font-size: 2.5rem;
  }
  
  .game-over-stats {
    flex-direction: column;
    gap: 1rem;
  }
  
  .game-over-stats .stat-value {
    font-size: 1.5rem;
  }
}
</style>
