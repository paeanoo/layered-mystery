<template>
  <div class="game-hud">
    <!-- 顶部信息栏 -->
    <div class="top-bar">
      <div class="game-info">
        <div class="info-item">
          <span class="label">层数</span>
          <span class="value">{{ level }}</span>
        </div>
        <div class="info-item">
          <span class="label">分数</span>
          <span class="value">{{ score.toLocaleString() }}</span>
        </div>
        <div class="info-item">
          <span class="label">时间</span>
          <span class="value time" :class="{ warning: timeRemaining < 10 }">
            {{ formatTime(timeRemaining) }}
          </span>
        </div>
      </div>
      
      <div class="game-controls">
        <button class="btn btn-small" @click="togglePause">
          {{ isPaused ? '继续' : '暂停' }}
        </button>
        <button class="btn btn-small btn-test" @click="showLevelSelect" style="display: none;">
          跳转关卡
        </button>
        <button class="btn btn-small btn-danger" @click="exitGame">
          退出
        </button>
      </div>
      
      <!-- 关卡选择弹窗 -->
      <div v-if="showLevelModal" class="level-select-overlay" @click="showLevelModal = false">
        <div class="level-select-modal" @click.stop>
          <h3>跳转到关卡（测试功能）</h3>
          <div class="level-input-group">
            <label>关卡:</label>
            <input 
              type="number" 
              v-model.number="targetLevel" 
              min="1" 
              max="20"
              class="level-input"
            />
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" @click="jumpToLevel">跳转</button>
            <button class="btn btn-secondary" @click="showLevelModal = false">取消</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 玩家状态栏 -->
    <div class="player-status">
      <!-- 生命值条 -->
      <div class="health-container">
        <div class="health-bar">
          <div 
            class="health-fill" 
            :style="{ width: healthPercent + '%' }"
            :class="{ 
              critical: healthPercent < 30,
              warning: healthPercent < 60 
            }"
          ></div>
          <span class="health-text">
            {{ Math.ceil(currentHealth) }}/{{ maxHealth }}
          </span>
        </div>
        <div class="health-stats">
          <span class="regen" v-if="regeneration > 0">
            +{{ regeneration.toFixed(1) }}/s
          </span>
        </div>
      </div>

      <!-- 被动属性显示 -->
      <div class="passive-attributes">
        <div 
          v-for="passiveId in passiveAttributes" 
          :key="passiveId"
          class="passive-badge"
          :title="getPassiveName(passiveId)"
          @click="showPassiveDetails(passiveId)"
        >
          <span class="passive-icon">{{ getPassiveIcon(passiveId) }}</span>
          <span class="passive-count" v-if="getPassiveCount(passiveId) > 1">
            {{ getPassiveCount(passiveId) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 游戏统计 -->
    <div class="game-stats">
      <div class="stat-item">
        <span class="stat-label">敌人</span>
        <span class="stat-value">{{ enemyCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">投射物</span>
        <span class="stat-value">{{ projectileCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">攻击力</span>
        <span class="stat-value">{{ Math.round(damage) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">攻速</span>
        <span class="stat-value">{{ attackSpeed.toFixed(1) }}/s</span>
      </div>
    </div>

    <!-- 被动属性详情弹窗 -->
    <div v-if="showPassiveDetailsModal" class="passive-details-overlay" @click="hidePassiveDetails">
      <div class="passive-details-modal" @click.stop>
        <h3>{{ getPassiveName(selectedPassiveId) }}</h3>
        <p>{{ getPassiveDescription(selectedPassiveId) }}</p>
        <div class="passive-effects">
          <div class="effect-item" v-for="effect in getPassiveEffects(selectedPassiveId)" :key="effect.label">
            <span class="effect-label">{{ effect.label }}:</span>
            <span class="effect-value">{{ effect.value }}</span>
          </div>
        </div>
        <button class="btn btn-primary" @click="hidePassiveDetails">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { PASSIVE_ATTRIBUTES } from '../../types/game'

interface Props {
  level: number
  score: number
  timeRemaining: number
  currentHealth: number
  maxHealth: number
  regeneration: number
  passiveAttributes: string[]
  enemyCount: number
  projectileCount: number
  damage: number
  attackSpeed: number
  isPaused: boolean
}

interface Emits {
  (e: 'toggle-pause'): void
  (e: 'exit-game'): void
  (e: 'jump-to-level', level: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const showPassiveDetailsModal = ref(false)
const selectedPassiveId = ref('')
const showLevelModal = ref(false)
const targetLevel = ref(1)

const healthPercent = computed(() => 
  (props.currentHealth / props.maxHealth) * 100
)

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const getPassiveName = (passiveId: string) => {
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  return passive?.name || passiveId
}

const getPassiveIcon = (passiveId: string) => {
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  return passive?.icon || '?'
}

const getPassiveDescription = (passiveId: string) => {
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  return passive?.description || ''
}

const getPassiveCount = (passiveId: string) => {
  return props.passiveAttributes.filter(id => id === passiveId).length
}

const getPassiveEffects = (passiveId: string) => {
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  if (!passive) return []

  const effects = []
  
  switch (passiveId) {
    case 'attack_speed':
      effects.push({ label: '攻击速度', value: `+${(passive.value * 100).toFixed(0)}%` })
      break
    case 'damage':
      effects.push({ label: '攻击伤害', value: `+${(passive.value * 100).toFixed(0)}%` })
      break
    case 'crit_chance':
      effects.push({ label: '暴击率', value: `+${(passive.value * 100).toFixed(0)}%` })
      break
    case 'projectiles':
      effects.push({ label: '投射物数量', value: `+${passive.value}` })
      break
    case 'pierce':
      effects.push({ label: '穿透次数', value: `+${passive.value}` })
      break
    case 'regeneration':
      effects.push({ label: '生命回复', value: `+${passive.value}/秒` })
      break
    case 'max_health':
      effects.push({ label: '最大生命值', value: `+${passive.value}` })
      break
    case 'move_speed':
      effects.push({ label: '移动速度', value: `+${(passive.value * 100).toFixed(0)}%` })
      break
    case 'lifesteal':
      effects.push({ label: '生命偷取', value: `+${(passive.value * 100).toFixed(0)}%` })
      break
  }

  return effects
}

const showPassiveDetails = (passiveId: string) => {
  selectedPassiveId.value = passiveId
  showPassiveDetailsModal.value = true
}

const hidePassiveDetails = () => {
  showPassiveDetailsModal.value = false
  selectedPassiveId.value = ''
}

const togglePause = () => {
  emit('toggle-pause')
}

const exitGame = () => {
  emit('exit-game')
}

const showLevelSelect = () => {
  targetLevel.value = props.level
  showLevelModal.value = true
}

const jumpToLevel = () => {
  if (targetLevel.value >= 1 && targetLevel.value <= 20) {
    emit('jump-to-level', targetLevel.value)
    showLevelModal.value = false
  }
}
</script>

<style scoped>
.game-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
}

.top-bar {
  position: absolute;
  top: 20px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: auto;
}

.game-info {
  display: flex;
  gap: 2rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.info-item .label {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: bold;
}

.info-item .value {
  color: var(--text-primary);
  font-size: 1.2rem;
  font-weight: bold;
}

.info-item .value.time.warning {
  color: var(--danger-color);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.game-controls {
  display: flex;
  gap: 1rem;
}

.btn-small {
  padding: 8px 16px;
  font-size: 0.9rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-small:not(.btn-danger) {
  background: var(--accent-color);
  color: var(--primary-bg);
}

.btn-small:not(.btn-danger):hover {
  background: #00cc6a;
  transform: translateY(-1px);
}

.btn-danger {
  background: var(--danger-color);
  color: var(--text-primary);
}

.btn-danger:hover {
  background: #cc3333;
  transform: translateY(-1px);
}

.btn-test {
  background: #8844aa;
  color: var(--text-primary);
}

.btn-test:hover {
  background: #663388;
  transform: translateY(-1px);
}

.player-status {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  pointer-events: auto;
}

.health-container {
  margin-bottom: 1rem;
}

.health-bar {
  position: relative;
  width: 100%;
  height: 20px;
  background: rgba(255, 68, 68, 0.3);
  border: 2px solid var(--danger-color);
  border-radius: 10px;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--danger-color), var(--accent-color));
  transition: width 0.3s ease;
}

.health-fill.warning {
  background: linear-gradient(90deg, var(--warning-color), var(--accent-color));
}

.health-fill.critical {
  background: linear-gradient(90deg, var(--danger-color), var(--warning-color));
  animation: pulse 0.5s infinite;
}

.health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-primary);
  font-weight: bold;
  font-size: 0.9rem;
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
}

.health-stats {
  display: flex;
  justify-content: center;
  margin-top: 0.5rem;
}

.regen {
  color: var(--accent-color);
  font-size: 0.8rem;
  font-weight: bold;
}

.passive-attributes {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.passive-badge {
  background: var(--secondary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.passive-badge:hover {
  background: var(--accent-color);
  color: var(--primary-bg);
  transform: scale(1.1);
}

.passive-count {
  position: absolute;
  top: -5px;
  right: -5px;
  background: var(--danger-color);
  color: var(--text-primary);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: bold;
}

.game-stats {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  pointer-events: auto;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  min-width: 120px;
}

.stat-label {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.stat-value {
  color: var(--text-primary);
  font-size: 0.9rem;
  font-weight: bold;
}

.level-select-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.level-select-modal {
  background: var(--primary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
}

.level-select-modal h3 {
  margin: 0 0 1.5rem 0;
  color: var(--text-primary);
  text-align: center;
}

.level-input-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.level-input-group label {
  color: var(--text-primary);
  font-size: 1.1rem;
}

.level-input {
  flex: 1;
  padding: 10px;
  border: 2px solid var(--accent-color);
  border-radius: 6px;
  background: var(--secondary-bg);
  color: var(--text-primary);
  font-size: 1.1rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.btn-primary {
  background: var(--accent-color);
  color: var(--primary-bg);
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-primary:hover {
  background: #00cc6a;
}

.btn-secondary {
  background: var(--secondary-bg);
  color: var(--text-primary);
  padding: 10px 20px;
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
}

.btn-secondary:hover {
  background: #333;
}

.passive-details-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  pointer-events: auto;
}

.passive-details-modal {
  background: var(--secondary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  text-align: center;
}

.passive-details-modal h3 {
  color: var(--accent-color);
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.passive-details-modal p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
  line-height: 1.4;
}

.passive-effects {
  margin-bottom: 1.5rem;
}

.effect-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: var(--primary-bg);
  border-radius: 6px;
  margin-bottom: 0.5rem;
}

.effect-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.effect-value {
  color: var(--accent-color);
  font-weight: bold;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .top-bar {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .game-info {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .game-stats {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  
  .stat-item {
    min-width: 100px;
  }
}
</style>
