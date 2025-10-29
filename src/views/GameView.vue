<template>
  <div class="game-container">
    <!-- 游戏画布 -->
    <canvas 
      ref="gameCanvas" 
      class="game-canvas"
      @click="handleCanvasClick"
    ></canvas>

    <!-- 被动属性选择界面（用于30秒选择属性和死亡后） -->
    <PassiveSelectionModal
      :visible="showPassiveSelection || gameStore.gameState.isGameOver"
      :level="gameStore.gameState.level"
      :score="gameStore.gameState.score"
      :available-passives="gameStore.availablePassives"
      :selected-passive="gameStore.selectedPassive"
      :player-passives="gameStore.gameState.player.passiveAttributes"
      :show-actions="gameStore.gameState.isGameOver"
      @close="onPassiveModalClose"
      @select="selectPassive"
      @confirm="confirmSelection"
      @restart="restartGame"
      @exit="exitGame"
    />

    <!-- 暂停时的角色属性详情界面 -->
    <CharacterDetailsModal
      :visible="gameStore.gameState.isPaused && !showPassiveSelection && !gameStore.gameState.isGameOver && !showCharacterAttributesModal"
      :player-stats="gameStore.playerStats"
      @close="togglePause"
    />

    <!-- 测试功能：角色属性设置弹窗 -->
    <CharacterAttributesModal
      :visible="showCharacterAttributesModal"
      :player-stats="gameStore.gameState.player"
      @close="closeCharacterAttributesModal"
      @jump-to-level="handleJumpToLevel"
      @apply-attributes="handleApplyAttributes"
    />

    <!-- 游戏控制按钮 -->
    <div class="game-controls">
      <button class="btn btn-small" @click="togglePause">
        {{ gameStore.gameState.isPaused ? '继续' : '暂停' }}
      </button>
      <button class="btn btn-small btn-test" @click="openTestModal" style="display: none;">
        测试功能
      </button>
      <button class="btn btn-small" @click="exitGame">退出</button>
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
import CharacterDetailsModal from '../game/ui/CharacterDetailsModal.vue'
import CharacterAttributesModal from '../game/ui/CharacterAttributesModal.vue'
import type { PlayerState } from '../types/game'

const router = useRouter()
const gameStore = useGameStore()

const gameCanvas = ref<HTMLCanvasElement>()
let gameEngine: TestGameEngine | null = null
let gameLoopId: number | null = null
const showCharacterAttributesModal = ref(false)

const showPassiveSelection = computed(() => {
  // 如果死亡，直接显示界面
  if (gameStore.gameState.isGameOver) {
    return true
  }
  // 否则检查是否有可用的被动属性
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
  // 时间更新由TestGameEngine处理，这里不再重复处理
  // 只同步游戏状态到store
  if (gameEngine) {
    gameStore.gameState.timeRemaining = gameEngine.gameTime
    gameStore.gameState.level = gameEngine.currentLevel
    gameStore.gameState.score = gameEngine.score
    gameStore.gameState.enemiesDefeated = Math.floor(gameEngine.score / 10)
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
  // 处理暂停键
  if (event.key === 'p' || event.key === 'P' || event.key === ' ') {
    event.preventDefault()
    event.stopPropagation()
    togglePause()
    return
  }
  
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
      // 继续游戏（不是死亡的情况）
      if (!gameStore.gameState.isGameOver) {
        gameEngine.isPaused = false
      }
    }
  }
}

const onPassiveModalClose = () => {
  // 处理模态框关闭，这里可以添加一些逻辑
  console.log('被动属性选择模态框关闭')
}

// 处理关卡完成事件
const handleLevelComplete = () => {
  if (gameStore.gameState.isGameOver) {
    console.log('游戏结束，触发死亡界面')
    // 游戏结束，不需要额外处理，死亡界面会自动显示
  } else {
    console.log('时间到，进入下一层')
    // 进入下一层，血量回满，分数累积
    gameStore.nextLevel()
    // 暂停游戏等待被动属性选择
    gameStore.gameState.isPaused = true
    if (gameEngine) {
      gameEngine.isPaused = true
    }
  }
}

const openTestModal = () => {
  // 打开测试功能时自动暂停游戏
  if (!gameStore.gameState.isPaused) {
    togglePause()
  }
  showCharacterAttributesModal.value = true
}

const togglePause = () => {
  // 切换游戏状态
  gameStore.gameState.isPaused = !gameStore.gameState.isPaused
  
  // 同步到游戏引擎
  if (gameEngine) {
    gameEngine.setPaused(gameStore.gameState.isPaused)
  }
  
  console.log('暂停状态切换:', gameStore.gameState.isPaused)
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
  
  // 重置游戏状态
  gameStore.gameState.isGameOver = false
  gameStore.gameState.isPaused = false
  
  await gameStore.startGame()
  if (gameCanvas.value) {
    gameEngine = new TestGameEngine(gameCanvas.value, handleLevelComplete, gameStore.gameState)
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

// 关闭角色属性设置弹窗
const closeCharacterAttributesModal = () => {
  showCharacterAttributesModal.value = false
}

// 处理关卡跳转
const handleJumpToLevel = (level: number) => {
  if (level >= 1 && level <= 20 && gameEngine) {
    // 跳转到指定关卡
    gameEngine.currentLevel = level
    gameStore.gameState.level = level
    
    // 清空当前敌人
    gameEngine.enemies = []
    gameEngine.projectiles = []
    
    // 重新生成敌人
    for (let i = 0; i < Math.min(35, 8 + level * 3); i++) {
      gameEngine.spawnEnemy()
    }
    
    console.log(`跳转到关卡 ${level}`)
  }
}

// 处理角色属性应用
const handleApplyAttributes = (attributes: PlayerState) => {
  console.log('收到属性应用请求:', attributes)
  
  // 更新游戏状态中的玩家属性
  Object.assign(gameStore.gameState.player, attributes)
  
  console.log('游戏状态已更新:', gameStore.gameState.player)
  
  // 同步到游戏引擎
  if (gameEngine) {
    gameEngine.updateGameState(gameStore.gameState)
    console.log('已同步到游戏引擎')
  }
  
  console.log('角色属性已应用:', attributes)
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
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
  background: var(--accent-color);
  color: var(--primary-bg);
}

.btn-small:hover {
  background: #00cc6a;
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

