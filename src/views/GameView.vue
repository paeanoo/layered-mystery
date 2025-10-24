<template>
  <div class="game-container">
    <!-- 游戏画布 -->
    <canvas 
      ref="gameCanvas" 
      class="game-canvas"
      @click="handleCanvasClick"
    ></canvas>

    <!-- 被动属性选择界面 -->
    <PassiveSelectionModal
      :visible="showPassiveSelection"
      :level="gameStore.gameState.level"
      :available-passives="gameStore.availablePassives"
      :selected-passive="gameStore.selectedPassive"
      :player-passives="gameStore.gameState.player.passiveAttributes"
      @close="onPassiveModalClose"
      @select="selectPassive"
      @confirm="confirmSelection"
    />

    <!-- 游戏控制按钮 -->
    <div class="game-controls">
      <button class="btn btn-small" @click="togglePause">
        {{ gameStore.gameState.isPaused ? '继续' : '暂停' }}
      </button>
      <button class="btn btn-small" @click="exitGame">退出</button>
    </div>

    <!-- 游戏结束界面 -->
    <div v-if="gameStore.gameState.isGameOver" class="game-over-overlay">
      <div class="game-over-modal">
        <div class="game-over-header">
          <h2>游戏结束</h2>
          <div class="death-icon">💀</div>
        </div>
        
        <div class="final-stats">
          <div class="current-stats">
            <h3>本次游戏</h3>
            <div class="stat-row">
              <span class="stat-label">层数</span>
              <span class="stat-value current">{{ gameStore.gameState.level }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">分数</span>
              <span class="stat-value current">{{ gameStore.gameState.score.toLocaleString() }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">存活时间</span>
              <span class="stat-value current">{{ formatTime(gameStore.gameState.timeRemaining) }}</span>
            </div>
          </div>
          
          <div class="best-stats">
            <h3>历史最佳</h3>
            <div class="stat-row">
              <span class="stat-label">最高层数</span>
              <span class="stat-value best">{{ gameStore.highestLevel.toLocaleString() }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">最高分数</span>
              <span class="stat-value best">{{ gameStore.highestScore.toLocaleString() }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">最长存活</span>
              <span class="stat-value best">{{ formatTime(gameStore.longestSurvival) }}</span>
            </div>
          </div>
        </div>
        
        <div class="achievement-section" v-if="hasNewRecord">
          <div class="new-record-banner">
            <span class="trophy">🏆</span>
            <span class="record-text">新记录！</span>
          </div>
        </div>
        
        <div class="game-over-actions">
          <button class="btn btn-primary" @click="restartGame">重新开始</button>
          <button class="btn btn-secondary" @click="exitGame">返回主页</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import { TestGameEngine } from '../game/core/TestGameEngine'
import { PASSIVE_ATTRIBUTES } from '../types/game'
import PassiveSelectionModal from '../game/ui/PassiveSelectionModal.vue'

const router = useRouter()
const gameStore = useGameStore()

const gameCanvas = ref<HTMLCanvasElement>()
let gameEngine: TestGameEngine | null = null
let gameLoopId: number | null = null

const showPassiveSelection = computed(() => {
  return gameStore.availablePassives.length > 0 && !gameStore.selectedPassive
})

// 检查是否有新记录
const hasNewRecord = computed(() => {
  return gameStore.gameState.level > gameStore.highestLevel || 
         gameStore.gameState.score > gameStore.highestScore
})

// 游戏循环
const startGameLoop = () => {
  const gameLoop = () => {
    if (!gameStore.gameState.isPaused && !gameStore.gameState.isGameOver) {
      // 更新游戏状态
      updateGameState()
    }
    gameLoopId = requestAnimationFrame(gameLoop)
  }
  gameLoop()
}

// 更新游戏状态
const updateGameState = () => {
  // 更新剩余时间
  if (gameStore.gameState.timeRemaining > 0) {
    const newTime = gameStore.gameState.timeRemaining - 0.016
    gameStore.updateTimeRemaining(Math.max(0, newTime))
  } else {
    // 时间结束，触发被动属性选择
    if (gameStore.availablePassives.length === 0) {
      gameStore.generatePassiveOptions()
    }
  }
}

onMounted(async () => {
  if (!gameCanvas.value) return

  try {
    // 启动游戏
    await gameStore.startGame()
    console.log('游戏状态初始化完成:', gameStore.gameState)
    
    // 初始化游戏引擎
    gameEngine = new TestGameEngine(gameCanvas.value, handleLevelComplete, gameStore.gameState)
    gameEngine.start()
    console.log('游戏引擎启动完成')
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleKeyDown)
  } catch (error) {
    console.error('游戏启动失败:', error)
  }
})

const handleKeyDown = (event: KeyboardEvent) => {
  if (gameEngine) {
    gameEngine.handleKeyDown(event.key)
  }
}

onUnmounted(() => {
  if (gameEngine) {
    gameEngine.stop()
  }
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId)
  }
  // 清理键盘事件监听器
  document.removeEventListener('keydown', handleKeyDown)
})

const selectPassive = (passiveId: string) => {
  gameStore.selectPassive(passiveId)
}

const confirmSelection = () => {
  if (gameStore.selectedPassive) {
    gameStore.confirmPassiveSelection()
    // 更新游戏引擎中的游戏状态
    if (gameEngine) {
      gameEngine.updateGameState(gameStore.gameState)
    }
  }
}

const onPassiveModalClose = () => {
  // 处理模态框关闭，这里可以添加一些逻辑
  console.log('被动属性选择模态框关闭')
}

// 处理关卡完成事件
const handleLevelComplete = () => {
  console.log('关卡完成，触发被动属性选择')
  gameStore.nextLevel()
}

const togglePause = () => {
  if (gameEngine) {
    gameEngine.pauseToggle()
  }
}

const exitGame = () => {
  if (gameEngine) {
    gameEngine.stop()
  }
  router.push('/')
}

const restartGame = async () => {
  if (gameEngine) {
    gameEngine.stop()
  }
  await gameStore.startGame()
  if (gameCanvas.value) {
    gameEngine = new GameEngine(gameCanvas.value, gameStore.gameState)
    gameEngine.start()
  }
}

const handleCanvasClick = (event: MouseEvent) => {
  // 处理画布点击事件
  console.log('Canvas clicked:', event)
}

const getPassiveName = (passiveId: string) => {
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  return passive?.name || passiveId
}

const getPassiveIcon = (passiveId: string) => {
  const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
  return passive?.icon || '?'
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.game-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  background: #1a1a1a;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.game-canvas {
  width: 100vw;
  height: 100vh;
  display: block;
  cursor: crosshair;
  position: absolute;
  top: 0;
  left: 0;
}

.game-controls {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  gap: 10px;
  z-index: 10;
  pointer-events: auto;
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
  color: var(--text-primary);
  font-size: 1.1rem;
  font-weight: bold;
}

.game-controls {
  display: flex;
  gap: 1rem;
}

.btn-small {
  padding: 8px 16px;
  font-size: 0.9rem;
}

.player-status {
  position: absolute;
  bottom: 20px;
  left: 20px;
  right: 20px;
  pointer-events: auto;
}

.health-bar {
  position: relative;
  width: 100%;
  height: 20px;
  background: rgba(255, 68, 68, 0.3);
  border: 2px solid var(--danger-color);
  border-radius: 10px;
  margin-bottom: 1rem;
  overflow: hidden;
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--danger-color), var(--accent-color));
  transition: width 0.3s ease;
}

.health-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--text-primary);
  font-weight: bold;
  font-size: 0.9rem;
}

.passive-attributes {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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
  cursor: help;
  transition: all 0.2s ease;
}

.passive-badge:hover {
  background: var(--accent-color);
  color: var(--primary-bg);
  transform: scale(1.1);
}


.confirm-btn {
  font-size: 1.2rem;
  padding: 1rem 2rem;
}

.game-over-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  pointer-events: auto;
}

.game-over-modal {
  background: var(--secondary-bg);
  border: 2px solid var(--danger-color);
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
  max-width: 500px;
  width: 90%;
}

.game-over-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.game-over-header h2 {
  color: var(--danger-color);
  font-size: 2.5rem;
  margin: 0;
}

.death-icon {
  font-size: 3rem;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.final-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.current-stats, .best-stats {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.current-stats h3, .best-stats h3 {
  color: var(--text-primary);
  font-size: 1.3rem;
  margin-bottom: 1rem;
  text-align: center;
  border-bottom: 2px solid var(--primary-color);
  padding-bottom: 0.5rem;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-label {
  color: var(--text-secondary);
  font-size: 1rem;
  font-weight: 500;
}

.stat-value {
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0.3rem 0.8rem;
  border-radius: 6px;
}

.stat-value.current {
  background: linear-gradient(135deg, #ff6b6b, #ff8e8e);
  color: white;
}

.stat-value.best {
  background: linear-gradient(135deg, #4ecdc4, #44a08d);
  color: white;
}

.achievement-section {
  margin-bottom: 2rem;
}

.new-record-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #333;
  padding: 1rem 2rem;
  border-radius: 12px;
  font-size: 1.2rem;
  font-weight: bold;
  animation: glow 2s infinite;
}

@keyframes glow {
  0%, 100% { box-shadow: 0 0 20px rgba(255, 215, 0, 0.5); }
  50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.8); }
}

.trophy {
  font-size: 1.5rem;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.game-over-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
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
  
  .passive-options {
    grid-template-columns: 1fr;
  }
  
  .final-stats {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .game-over-actions {
    flex-direction: column;
  }
  
  .game-over-header {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .new-record-banner {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }
}
</style>

