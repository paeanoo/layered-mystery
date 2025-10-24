<template>
  <div class="passive-selection-modal" v-if="visible">
    <div class="modal-overlay" @click="onClose"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h2>选择被动属性</h2>
        <p class="level-info">第{{ level }}层 - 选择你的强化</p>
      </div>
      
      <div class="passive-options">
        <div 
          v-for="passive in availablePassives" 
          :key="passive.id"
          class="passive-card"
          :class="{ 
            selected: selectedPassive === passive.id,
            disabled: isPassiveDisabled(passive.id)
          }"
          @click="selectPassive(passive.id)"
        >
          <div class="passive-icon">{{ passive.icon }}</div>
          <h3 class="passive-name">{{ passive.name }}</h3>
          <p class="passive-description">{{ passive.description }}</p>
          <div class="passive-stats" v-if="getPassiveStats(passive.id)">
            <span class="stat-item" v-for="stat in getPassiveStats(passive.id)" :key="stat.label">
              {{ stat.label }}: {{ stat.value }}
            </span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PassiveAttribute } from '../../types/game'
import { PASSIVE_ATTRIBUTES } from '../../types/game'

interface Props {
  visible: boolean
  level: number
  availablePassives: PassiveAttribute[]
  selectedPassive: string | null
  playerPassives: string[]
}

interface Emits {
  (e: 'close'): void
  (e: 'select', passiveId: string): void
  (e: 'confirm'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectPassive = (passiveId: string) => {
  if (!isPassiveDisabled(passiveId)) {
    emit('select', passiveId)
    // 选择后立即确认
    emit('confirm')
  }
}

const onClose = () => {
  emit('close')
}

const isPassiveDisabled = (passiveId: string): boolean => {
  // 检查是否已经拥有该被动
  return props.playerPassives.includes(passiveId)
}

const getPassiveStats = (passiveId: string) => {
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  if (!passive) return null

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
  }

  return stats
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

.passive-icon {
  font-size: 3rem;
  text-align: center;
  margin-bottom: 1rem;
  display: block;
}

.passive-name {
  color: var(--text-primary);
  font-size: 1.3rem;
  margin-bottom: 0.8rem;
  text-align: center;
  font-weight: bold;
}

.passive-description {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.4;
  margin-bottom: 1rem;
  text-align: center;
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
}
</style>
