<template>
  <div v-if="visible" class="character-details-overlay" @click="handleOverlayClick">
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
            <span class="stat-value projectiles">{{ playerStats.projectileCount }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">穿透次数</span>
            <span class="stat-value pierce">{{ playerStats.pierce }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">生命偷取</span>
            <span class="stat-value lifesteal">{{ playerStats.lifesteal }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">生命回复</span>
            <span class="stat-value regen">{{ playerStats.healthRegen }}/秒</span>
          </div>
          
          
        </div>

        <!-- 右列属性 -->
        <div class="stats-column right-column">
          <div class="stat-item">
            <span class="stat-label">伤害</span>
            <span class="stat-value damage">{{ playerStats.damage }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">攻击速度</span>
            <span class="stat-value attack-speed">{{ playerStats.attackSpeed.toFixed(1) }}/秒</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">暴击率</span>
            <span class="stat-value crit-rate">{{ playerStats.critRate }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">移动速度</span>
            <span class="stat-value move-speed">{{ playerStats.moveSpeed }}像素/帧</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">暴击伤害</span>
            <span class="stat-value crit-damage">{{ playerStats.critDamage }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">敌人移动速度</span>
            <span class="stat-value enemy-speed">{{ playerStats.enemyMoveSpeed }}像素/帧</span>
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

      <!-- 底部提示 -->
      <div class="modal-footer">
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'

interface PlayerStats {
  level: number
  score: number
  timeRemaining: number
  enemiesDefeated: number
  currentEnemies: number
  projectileCount: number
  damage: number
  attackSpeed: number
  critRate: number
  moveSpeed: number
  critDamage: number
  enemyMoveSpeed: number
  lifesteal: number
  healthRegen: number
  pierce: number
  currentHealth: number
  maxHealth: number
}

interface Props {
  visible: boolean
  playerStats: PlayerStats
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

// 计算生命值百分比
const healthPercentage = computed(() => {
  return Math.round((props.playerStats.currentHealth / props.playerStats.maxHealth) * 100)
})

// 格式化时间显示
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 处理点击事件
const handleOverlayClick = () => {
  emit('close')
}

// 键盘事件现在由父组件GameView统一处理
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

.stat-value.current-health {
  background: linear-gradient(135deg, #32cd32, #228b22);
  color: #000;
}

/* 生命值进度条 */
.health-section {
  margin-bottom: 2rem;
  display: flex;
  justify-content: center;
}

.health-bar {
  position: relative;
  width: 500px;
  height: 30px;
  background: rgba(255, 68, 68, 0.3);
  border: 2px solid #ff4444;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 
    inset 0 2px 4px rgba(0, 0, 0, 0.3),
    0 0 15px rgba(255, 68, 68, 0.2);
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff4444 0%, #ff6b6b 50%, #00ff88 100%);
  transition: width 0.8s ease;
  border-radius: 15px;
  position: relative;
}

.health-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-weight: bold;
  font-size: 1rem;
  text-shadow: 
    1px 1px 3px rgba(0, 0, 0, 0.9),
    0 0 10px rgba(255, 255, 255, 0.3);
  z-index: 2;
}

/* 底部提示 */
.modal-footer {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.continue-text {
  color: #ffaa00;
  font-size: 1rem;
  margin: 0;
  opacity: 0.9;
  text-shadow: 0 0 10px rgba(255, 170, 0, 0.5);
  font-weight: 500;
  letter-spacing: 1px;
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
</style>
