<template>
  <div v-if="visible" class="character-attributes-overlay" @click="closeModal">
    <div class="character-attributes-modal" @click.stop>
      <!-- 标题 -->
      <div class="modal-header">
        <h2 class="modal-title">测试功能 - 角色属性设置</h2>
        <button class="close-btn" @click="closeModal">×</button>
      </div>

      <!-- 主要内容区域 -->
      <div class="modal-content">
        <!-- 关卡跳转区域 -->
        <div class="section">
          <h3 class="section-title">关卡跳转</h3>
          <div class="level-input-group">
            <label for="target-level">目标关卡:</label>
            <input 
              id="target-level"
              v-model.number="targetLevel" 
              type="number" 
              min="1" 
              max="20" 
              class="level-input"
            />
            <button class="btn btn-primary" @click="jumpToLevel">跳转</button>
          </div>
        </div>

        <!-- 角色属性设置区域 -->
        <div class="section">
          <h3 class="section-title">角色属性设置</h3>
          
          <!-- 基础属性 -->
          <div class="attributes-grid">
            <div class="attribute-group">
              <label>生命值:</label>
              <div class="input-group">
                <input v-model.number="attributes.health" type="number" min="1" class="attr-input" />
                <span class="separator">/</span>
                <input v-model.number="attributes.maxHealth" type="number" min="1" class="attr-input" />
              </div>
            </div>

            <div class="attribute-group">
              <label>伤害:</label>
              <input v-model.number="attributes.damage" type="number" min="1" class="attr-input" />
              <span class="attr-hint">(数值)</span>
            </div>

            <div class="attribute-group">
              <label>攻击速度:</label>
              <input v-model.number="attributes.attackSpeed" type="number" min="0.1" step="0.1" class="attr-input" />
              <span class="attr-hint">(倍率，1.0=100%)</span>
            </div>

            <div class="attribute-group">
              <label>暴击率:</label>
              <input v-model.number="critChancePercent" type="number" min="0" max="100" step="0.1" class="attr-input" @input="updateCritChance" />
              <span class="attr-hint">(%)</span>
            </div>

            <div class="attribute-group">
              <label>投射物数量:</label>
              <input v-model.number="attributes.projectiles" type="number" min="1" class="attr-input" />
            </div>

            <div class="attribute-group">
              <label>穿透次数:</label>
              <input v-model.number="attributes.pierce" type="number" min="0" class="attr-input" />
            </div>

            <div class="attribute-group">
              <label>移动速度:</label>
              <input v-model.number="attributes.moveSpeed" type="number" min="0.1" step="0.1" class="attr-input" />
              <span class="attr-hint">(倍率，1.0=100%)</span>
            </div>

            <div class="attribute-group">
              <label>生命回复:</label>
              <input v-model.number="attributes.regeneration" type="number" min="0" step="0.1" class="attr-input" />
              <span class="attr-hint">(数值/秒)</span>
            </div>

            <div class="attribute-group">
              <label>生命偷取:</label>
              <input v-model.number="lifestealPercent" type="number" min="0" max="100" step="0.1" class="attr-input" @input="updateLifesteal" />
              <span class="attr-hint">(%)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="modal-actions">
        <button class="btn btn-secondary" @click="resetAttributes">重置</button>
        <button class="btn btn-primary" @click="applyAttributes">应用</button>
        <button class="btn btn-danger" @click="closeModal">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PlayerState } from '../../types/game'

interface Props {
  visible: boolean
  playerStats: PlayerState
}

interface Emits {
  (e: 'close'): void
  (e: 'jumpToLevel', level: number): void
  (e: 'applyAttributes', attributes: PlayerState): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 目标关卡
const targetLevel = ref(1)

// 角色属性
const attributes = ref<PlayerState>({
  health: 20,
  maxHealth: 20,
  experience: 0,
  level: 1,
  position: { x: 400, y: 300 },
  velocity: { x: 0, y: 0 },
  attackSpeed: 1,
  damage: 10,
  critChance: 0.05,
  projectiles: 1,
  pierce: 0,
  regeneration: 0,
  moveSpeed: 1,
  lifesteal: 0,
  armor: 0,
  magicResistance: 0,
  dodgeChance: 0,
  blockChance: 0,
  energy: 100,
  maxEnergy: 100,
  energyRegen: 1,
  statusEffects: [],
  skillCooldowns: new Map(),
  comboCount: 0,
  maxCombo: 10,
  comboMultiplier: 1,
  skin: 'default',
  size: 1,
  color: '#00ff88',
  glowColor: '#00cc66',
  animationState: 'idle',
  animationFrame: 0,
  animationTimer: 0,
  gold: 0,
  mana: 0,
  cooldownReduction: 0,
  range: 1,
  spellPower: 0,
  thorns: 0,
  reflect: 0,
  slow: 0,
  stun: 0,
  passiveAttributes: []
})

// 百分比属性的显示值（用于输入框）
const critChancePercent = ref(5) // 暴击率百分比（0-100）
const lifestealPercent = ref(0) // 生命偷取百分比（0-100）

// 更新暴击率（从百分比转换为小数）
const updateCritChance = () => {
  attributes.value.critChance = critChancePercent.value / 100
}

// 更新生命偷取（从百分比转换为小数）
const updateLifesteal = () => {
  attributes.value.lifesteal = lifestealPercent.value / 100
}

// 监听props变化，同步属性
watch(() => props.playerStats, (newStats) => {
  if (newStats) {
    attributes.value = { ...newStats }
    // 同步百分比显示值
    critChancePercent.value = (newStats.critChance || 0) * 100
    lifestealPercent.value = (newStats.lifesteal || 0) * 100
  }
}, { immediate: true })

// 关闭弹窗
const closeModal = () => {
  emit('close')
}

// 跳转关卡
const jumpToLevel = () => {
  if (targetLevel.value >= 1 && targetLevel.value <= 20) {
    emit('jumpToLevel', targetLevel.value)
  }
}

// 重置属性
const resetAttributes = () => {
  attributes.value = { ...props.playerStats }
}

// 应用属性
const applyAttributes = () => {
  emit('applyAttributes', attributes.value)
}
</script>

<style scoped>
.character-attributes-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.character-attributes-modal {
  background: var(--primary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 12px;
  padding: 2rem;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--accent-color);
}

.modal-title {
  margin: 0;
  color: var(--accent-color);
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 2rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: var(--accent-color);
}

.modal-content {
  margin-bottom: 1.5rem;
}

.section {
  margin-bottom: 2rem;
}

.section-title {
  color: var(--text-primary);
  margin-bottom: 1rem;
  font-size: 1.2rem;
  border-bottom: 1px solid var(--secondary-bg);
  padding-bottom: 0.5rem;
}

.level-input-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.level-input-group label {
  color: var(--text-primary);
  font-weight: bold;
}

.level-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid var(--accent-color);
  border-radius: 6px;
  background: var(--secondary-bg);
  color: var(--text-primary);
  font-size: 1rem;
}

.attributes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.attribute-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.attribute-group label {
  color: var(--text-primary);
  font-weight: bold;
  font-size: 0.9rem;
}

.attr-hint {
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-style: italic;
  margin-top: -0.3rem;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.attr-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--accent-color);
  border-radius: 4px;
  background: var(--secondary-bg);
  color: var(--text-primary);
  font-size: 0.9rem;
}

.separator {
  color: var(--text-secondary);
  font-weight: bold;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--secondary-bg);
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--accent-color);
  color: var(--primary-bg);
}

.btn-primary:hover {
  background: #00cc66;
}

.btn-secondary {
  background: var(--secondary-bg);
  color: var(--text-primary);
  border: 1px solid var(--accent-color);
}

.btn-secondary:hover {
  background: rgba(0, 255, 136, 0.1);
}

.btn-danger {
  background: #ff4444;
  color: white;
}

.btn-danger:hover {
  background: #cc3333;
}
</style>
