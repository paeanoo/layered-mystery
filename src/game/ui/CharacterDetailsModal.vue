<template>
  <div v-if="visible" class="character-details-overlay">
    <div class="character-details-modal" @click.stop>
      <!-- 标题 -->
      <div class="modal-header">
        <h2 class="modal-title">角色属性详情</h2>
      </div>

      <!-- 主要内容区域 -->
      <div class="modal-content">
        <!-- 左列属性 -->
        <div class="stats-column left-column">
          <div class="stat-item">
            <span class="stat-label">当前层数</span>
            <span class="stat-value level">{{ playerStats.level }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">当前分数</span>
            <span class="stat-value score">{{ playerStats.score.toLocaleString() }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">剩余时间</span>
            <span class="stat-value time">{{ formatTime(playerStats.timeRemaining) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">投射物数量</span>
            <span class="stat-value projectiles">{{ playerStats.projectiles }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">穿透次数</span>
            <span class="stat-value pierce">{{ playerStats.pierce }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">生命偷取</span>
            <span class="stat-value lifesteal">{{ Math.round(playerStats.lifesteal * 100) }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">生命回复</span>
            <span class="stat-value regen">{{ playerStats.regeneration }}/秒</span>
          </div>
          
          
        </div>

        <!-- 右列属性 -->
        <div class="stats-column right-column">
          <div class="stat-item">
            <span class="stat-label">伤害</span>
            <span class="stat-value damage" :title="(playerStats.dynamicDamageBonus || 0) > 0 ? `基础: ${Math.round(playerStats.baseDamage || (playerStats.damage / (1 + (playerStats.dynamicDamageBonus || 0))))} (+${((playerStats.dynamicDamageBonus || 0) * 100).toFixed(0)}%)` : ''">
              {{ Math.round(playerStats.damage) }}
              <span v-if="(playerStats.dynamicDamageBonus || 0) > 0" class="bonus-indicator">(+{{ Math.round(((playerStats.dynamicDamageBonus || 0) * 100)) }}%)</span>
            </span>
          </div>
          <div class="stat-item">
            <span class="stat-label">攻击速度</span>
            <span class="stat-value attack-speed">{{ formatPercentage(playerStats.attackSpeed) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">暴击率</span>
            <span class="stat-value crit-rate">{{ Math.round(playerStats.critChance * 100) }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">移动速度</span>
            <span class="stat-value move-speed">{{ formatPercentage(playerStats.moveSpeed) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">暴击伤害</span>
            <span class="stat-value crit-damage">{{ playerStats.critDamage.toFixed(1) }}x</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">敌人移动速度</span>
            <span class="stat-value enemy-speed">{{ formatPercentage(playerStats.enemyMoveSpeed) }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">最大生命值</span>
            <span class="stat-value max-health">{{ playerStats.maxHealth }}</span>
          </div>
          <div class="stat-item empty-item">
            <!-- 空项用于对齐 -->
          </div>
          <div class="stat-item empty-item">
            <!-- 空项用于对齐 -->
          </div>
        </div>
      </div>

      <!-- 已获得的奖励加成区域 -->
      <div class="rewards-section" v-if="acquiredRewards.length > 0">
        <h3 class="rewards-title">已获得的奖励加成</h3>
        <div class="rewards-list">
          <div 
            v-for="(reward, index) in acquiredRewards" 
            :key="`${reward.id}-${index}`"
            class="reward-card"
            :class="{
              'reward-white': reward.color === 'white',
              'reward-green': reward.color === 'green',
              'reward-blue': reward.color === 'blue',
              'reward-purple': reward.color === 'purple',
              'reward-gold': reward.color === 'gold'
            }"
          >
            <div class="reward-header">
              <span class="reward-icon" v-if="getRewardIcon(reward)">{{ getRewardIcon(reward) }}</span>
              <span class="reward-name">{{ reward.name }}</span>
              <span class="reward-count" v-if="reward.count > 1">×{{ reward.count }}</span>
            </div>
            <p class="reward-description">{{ reward.description }}</p>
            <div class="reward-stats" v-if="reward.stats && reward.stats.length > 0">
              <span class="reward-stat-item" v-for="stat in reward.stats" :key="stat.label">
                {{ stat.label }}: {{ stat.value }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部提示 -->
      <div class="modal-footer">
        <p class="continue-hint">点击空格或P键继续游戏</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PASSIVE_ATTRIBUTES } from '../../types/game'
import { ATTRIBUTE_REWARDS, SPECIAL_REWARDS, BOSS_EXCLUSIVE_REWARDS, LEGENDARY_REWARDS } from '../../types/reward'
import type { RewardOption } from '../../types/reward'

interface PlayerStats {
  level: number
  score: number
  timeRemaining: number
  enemiesDefeated: number
  currentEnemies: number
  projectiles: number
  damage: number
  baseDamage?: number
  dynamicDamageBonus?: number
  attackSpeed: number
  critChance: number
  moveSpeed: number
  critDamage: number
  enemyMoveSpeed: number
  lifesteal: number
  regeneration: number
  pierce: number
  health: number
  maxHealth: number
  passiveAttributes?: string[] // 添加被动属性列表
}

interface Props {
  visible: boolean
  playerStats: PlayerStats
}

const props = defineProps<Props>()

// 获取已获得的奖励列表（只显示Boss奖励，不显示基础属性）
const acquiredRewards = computed(() => {
  const passiveIds = props.playerStats.passiveAttributes || []
  const rewardMap = new Map<string, { id: string; name: string; description: string; color: string; category: string; effectKey?: string; count: number; stats: Array<{ label: string; value: string }> | null }>()
  
  // 基础被动属性的ID列表，用于过滤
  const basePassiveIds = new Set(PASSIVE_ATTRIBUTES.map(p => p.id))
  
  passiveIds.forEach(passiveId => {
    // 跳过基础被动属性（这些在属性界面已经显示了）
    if (basePassiveIds.has(passiveId)) {
      return
    }
    
    // 查找Boss奖励池（包括属性奖励、特殊效果、Boss专属、传说）
    const allRewards = [
      ...ATTRIBUTE_REWARDS,  // Boss层的属性奖励
      ...SPECIAL_REWARDS,
      ...Object.values(BOSS_EXCLUSIVE_REWARDS).flat(),
      ...LEGENDARY_REWARDS
    ]
    
    const reward = allRewards.find(r => r.id === passiveId)
    if (reward) {
      const existing = rewardMap.get(passiveId)
      if (existing) {
        existing.count++
      } else {
        rewardMap.set(passiveId, {
          id: passiveId,
          name: reward.name,
          description: reward.description,
          color: reward.color,
          category: reward.category,
          effectKey: reward.effectKey,
          count: 1,
          stats: getRewardStats(reward)
        })
      }
    }
  })
  
  return Array.from(rewardMap.values())
})

// 获取基础被动属性的统计信息
const getPassiveStats = (passiveId: string, passive: any): Array<{ label: string; value: string }> | null => {
  const stats: Array<{ label: string; value: string }> = []
  
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
  }
  
  return stats.length > 0 ? stats : null
}

// 获取奖励的统计信息（复用PassiveSelectionModal中的逻辑）
const getRewardStats = (reward: RewardOption): Array<{ label: string; value: string }> | null => {
  const stats: Array<{ label: string; value: string }> = []
  
  // 1. 属性奖励
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
    } else if (reward.effectKey === 'aoe_radius_pct') {
      const value = reward.baseValue || 0.30
      stats.push({ label: '范围', value: `+${(value * 100).toFixed(0)}%` })
    }
  }
  // 2. 特殊效果奖励
  else if (reward.category === 'special') {
    if (reward.effectKey === 'on_hit_chain_lightning') {
      stats.push({ label: '几率', value: '15%' })
      stats.push({ label: '连锁', value: '3目标' })
    } else if (reward.effectKey === 'on_hit_freeze') {
      stats.push({ label: '几率', value: '10%' })
      stats.push({ label: '冻结', value: '1.5秒' })
    } else if (reward.effectKey === 'on_hit_poison') {
      stats.push({ label: '中毒', value: '3秒' })
      stats.push({ label: '伤害', value: '50%' })
    } else if (reward.effectKey === 'low_hp_damage_reduction') {
      stats.push({ label: '触发', value: '<30%HP' })
      stats.push({ label: '效果', value: '减伤' })
    }
  }
  // 3. Boss专属奖励
  else if (reward.category === 'boss_exclusive') {
    if (reward.effectKey === 'vs_shield_bonus') {
      const value = reward.baseValue || 0.5
      stats.push({ label: '对护盾', value: `+${(value * 100).toFixed(0)}%` })
    } else if (reward.effectKey === 'pierce_plus_damage') {
      stats.push({ label: '穿透', value: '+1' })
      stats.push({ label: '伤害', value: '+10%' })
    } else if (reward.effectKey === 'move_speed_phasing') {
      const value = reward.baseValue || 0.25
      stats.push({ label: '移速', value: `+${(value * 100).toFixed(0)}%` })
    } else if (reward.effectKey === 'crit_and_elite_critdmg') {
      stats.push({ label: '暴击率', value: '+15%' })
      stats.push({ label: '精英暴伤', value: '+50%' })
    }
  }
  
  return stats.length > 0 ? stats : null
}

// 获取奖励图标
const getRewardIcon = (reward: { id: string; category: string; name: string; effectKey?: string }): string => {
  // Boss奖励中的属性奖励（如伤害+15%、攻速+20%等）：使用基础被动属性的图标
  if (reward.category === 'attribute' && reward.effectKey) {
    // 范围效果：特殊图标
    if (reward.effectKey === 'aoe_radius_pct') {
      return '🌀' // 漩涡/范围效果图标
    }
    
    // 根据effectKey查找对应的基础被动属性
    let basePassiveId = ''
    if (reward.effectKey.startsWith('damage_pct')) {
      basePassiveId = 'damage'
    } else if (reward.effectKey.startsWith('attack_speed_pct')) {
      basePassiveId = 'attack_speed'
    } else if (reward.effectKey.startsWith('crit_chance_add')) {
      basePassiveId = 'crit_chance'
    } else if (reward.effectKey.startsWith('projectiles_add')) {
      basePassiveId = 'projectiles'
    } else if (reward.effectKey.startsWith('pierce_add')) {
      basePassiveId = 'pierce'
    } else if (reward.effectKey.startsWith('move_speed_pct')) {
      basePassiveId = 'move_speed'
    } else if (reward.effectKey.startsWith('lifesteal_add')) {
      basePassiveId = 'lifesteal'
    } else if (reward.effectKey.startsWith('regeneration_add')) {
      basePassiveId = 'regeneration'
    } else if (reward.effectKey.startsWith('max_health_add')) {
      basePassiveId = 'max_health'
    }
    
    if (basePassiveId) {
      const basePassive = PASSIVE_ATTRIBUTES.find(p => p.id === basePassiveId)
      if (basePassive?.icon) {
        return basePassive.icon
      }
    }
  }
  
  // 基础属性有icon的情况（直接匹配ID）
  if (reward.category === 'attribute' && reward.id) {
    const basePassive = PASSIVE_ATTRIBUTES.find(p => p.id === reward.id)
    if (basePassive?.icon) {
      return basePassive.icon
    }
  }
  
  // 传说奖励
  if (reward.category === 'legendary') {
    return '✨'
  }
  
  // Boss专属奖励
  if (reward.category === 'boss_exclusive') {
    return '👑'
  }
  
  // 特殊效果奖励
  if (reward.category === 'special' && reward.effectKey) {
    if (reward.effectKey === 'on_hit_chain_lightning') return '⚡' // 连锁闪电
    if (reward.effectKey === 'on_hit_freeze') return '❄️' // 寒霜冻结
    if (reward.effectKey === 'on_hit_poison') return '☠️' // 剧毒
    if (reward.effectKey === 'on_crit_explode') return '💥' // 爆裂暴击
    if (reward.effectKey === 'low_hp_damage_reduction') return '🛡️' // 背水减伤：盾牌图标
    if (reward.effectKey === 'move_heal_trail') return '💚' // 治疗轨迹：绿色心形图标
    if (reward.effectKey === 'on_elite_kill_bonus') return '⭐' // 精英克星：星星图标
    if (reward.effectKey === 'on_kill_heal_orb') return '💚' // 治疗球：绿色心形图标
  }
  
  return ''
}

// 格式化时间显示
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 格式化百分比显示
const formatPercentage = (value: number | undefined | null): string => {
  let numValue: number
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    numValue = value
  } else {
    numValue = 1.0
  }
  const percentage = Math.round(numValue * 100)
  return `${percentage}%`
}
</script>

<style scoped>
.character-details-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.character-details-modal {
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  border: 2px solid #00ff88;
  border-radius: 16px;
  padding: 1.5rem;
  max-width: 700px;
  width: 85%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 255, 136, 0.2);
}

.modal-header {
  text-align: center;
  margin-bottom: 2rem;
}

.modal-title {
  color: #00ff88;
  font-size: 1.8rem;
  font-weight: bold;
  margin: 0;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.modal-content {
  display: flex;
  gap: 3rem;
  margin-bottom: 2rem;
  justify-content: center;
  align-items: flex-start;
}

.stats-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 250px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
  min-height: 40px;
}

.stat-item:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateX(3px);
  border-color: rgba(0, 255, 136, 0.3);
}

.stat-item.empty-item {
  opacity: 0;
  pointer-events: none;
  min-height: 0;
  padding: 0;
  margin: 0;
}

.stat-label {
  color: #ffffff;
  font-size: 1rem;
  font-weight: 500;
  flex: 1;
  text-align: left;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0.3rem 0.8rem;
  border-radius: 6px;
  min-width: 70px;
  text-align: center;
  flex-shrink: 0;
}

/* 不同属性值的颜色 */
.stat-value.level {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
}

.stat-value.score {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
}

.stat-value.time {
  background: linear-gradient(135deg, #ffaa00, #ff8800);
  color: #000;
}

.stat-value.defeated {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
}

.stat-value.enemies {
  background: linear-gradient(135deg, #ff4444, #cc3333);
  color: #fff;
}

.stat-value.projectiles {
  background: linear-gradient(135deg, #4488ff, #3366cc);
  color: #fff;
}

.stat-value.damage {
  background: linear-gradient(135deg, #ff4444, #cc3333);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
}

.bonus-indicator {
  font-size: 0.85rem;
  color: #ffaa00;
  font-weight: bold;
  text-shadow: 0 0 5px rgba(255, 170, 0, 0.5);
}

.stat-value.attack-speed {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
}

.stat-value.crit-rate {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
}

.stat-value.move-speed {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
}

.stat-value.crit-damage {
  background: linear-gradient(135deg, #ff4444, #cc3333);
  color: #fff;
}

.stat-value.enemy-speed {
  background: linear-gradient(135deg, #00ff88, #00cc6a);
  color: #000;
}

.stat-value.lifesteal {
  background: linear-gradient(135deg, #ff4444, #cc3333);
  color: #fff;
}

.stat-value.regen {
  background: linear-gradient(135deg, #4488ff, #3366cc);
  color: #fff;
}

.stat-value.pierce {
  background: linear-gradient(135deg, #ffaa00, #ff8800);
  color: #000;
}

.stat-value.max-health {
  background: linear-gradient(135deg, #ff69b4, #ff1493);
  color: #fff;
}

/* 底部提示 */
.modal-footer {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.continue-hint {
  color: #00ff88;
  font-size: 1rem;
  margin: 0;
  opacity: 0.8;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.8;
  }
  50% {
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .modal-content {
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .character-details-modal {
    padding: 1.5rem;
    width: 95%;
  }
  
  .modal-title {
    font-size: 1.5rem;
  }
  
  .stat-item {
    padding: 0.6rem 0.8rem;
  }
  
  .stat-label {
    font-size: 0.9rem;
  }
  
  .stat-value {
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .character-details-modal {
    padding: 1rem;
  }
  
  .modal-title {
    font-size: 1.3rem;
  }
  
  .stat-item {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
  
  .stat-label {
    font-size: 0.8rem;
  }
  
  .stat-value {
    font-size: 0.9rem;
    min-width: auto;
  }
}

/* 奖励区域样式 */
.rewards-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid rgba(255, 255, 255, 0.1);
}

.rewards-title {
  color: #00ff88;
  font-size: 1.3rem;
  font-weight: bold;
  margin-bottom: 1.5rem;
  text-align: center;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.rewards-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  max-height: 300px;
  overflow-y: auto;
  padding: 0.5rem;
}

.reward-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.3s ease;
}

.reward-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.2);
}

/* 奖励颜色边框 */
.reward-card.reward-white {
  border-color: #cccccc;
}

.reward-card.reward-green {
  border-color: #4ade80;
}

.reward-card.reward-blue {
  border-color: #60a5fa;
}

.reward-card.reward-purple {
  border-color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
}

.reward-card.reward-gold {
  border-color: #fbbf24;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
}

.reward-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.reward-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.reward-name {
  color: #ffffff;
  font-size: 1rem;
  font-weight: bold;
  flex: 1;
}

.reward-count {
  color: #00ff88;
  font-size: 0.9rem;
  font-weight: bold;
  background: rgba(0, 255, 136, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.reward-description {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85rem;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.reward-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.reward-stat-item {
  background: rgba(0, 255, 136, 0.2);
  color: #00ff88;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: bold;
}

/* 响应式 */
@media (max-width: 768px) {
  .rewards-list {
    grid-template-columns: 1fr;
    max-height: 250px;
  }
}
</style>
