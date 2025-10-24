<template>
  <div class="home-container">
    <div class="hero-section">
      <h1 class="game-title">层叠秘境</h1>
      <p class="game-subtitle">轻量级爬塔冒险游戏</p>
      <div class="game-description">
        <p>在20层秘境中挑战时间与策略的极限</p>
        <p>通过"三选一"的被动属性叠加，构筑独一无二的战斗风格</p>
        <p>在30秒内存活并击败不断涌来的敌人</p>
      </div>
    </div>

    <div class="action-buttons">
      <button class="btn btn-primary" @click="startGame">
        🎮 开始游戏
      </button>
      <button class="btn btn-secondary" @click="viewLeaderboard">
        🏆 排行榜
      </button>
    </div>

    <div class="features-section">
      <h2>游戏特色</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3>极简操作</h3>
          <p>WASD移动，自动攻击，专注策略构筑</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <h3>深度构建</h3>
          <p>9种被动属性，乘法加法组合，策略深度极高</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🏆</div>
          <h3>公平竞技</h3>
          <p>统一赛季种子，消除运气差异，纯策略比拼</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3>可持续复玩</h3>
          <p>每周主题变化，保持内容新鲜感</p>
        </div>
      </div>
    </div>

    <div class="current-season" v-if="currentSeason">
      <h3>当前赛季</h3>
      <div class="season-info">
        <p><strong>{{ currentSeason.name }}</strong></p>
        <p>主题: {{ currentSeason.theme }}</p>
        <p>结束时间: {{ formatDate(currentSeason.endDate) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import type { SeasonConfig } from '../types/game'

const router = useRouter()
const gameStore = useGameStore()

const currentSeason = ref<SeasonConfig | null>(null)

onMounted(async () => {
  try {
    // 获取当前赛季信息
    currentSeason.value = gameStore.currentSeason
  } catch (error) {
    console.error('获取赛季信息失败:', error)
  }
})

const startGame = () => {
  router.push('/game')
}

const viewLeaderboard = () => {
  router.push('/leaderboard')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.game-title {
  font-size: 4rem;
  font-weight: bold;
  color: var(--accent-color);
  margin-bottom: 1rem;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.game-subtitle {
  font-size: 1.5rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.game-description {
  max-width: 600px;
  margin: 0 auto;
}

.game-description p {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  line-height: 1.6;
}

.action-buttons {
  display: flex;
  gap: 2rem;
  margin-bottom: 4rem;
}

.btn-primary {
  background: var(--accent-color);
  color: var(--primary-bg);
  font-size: 1.2rem;
  padding: 1rem 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 255, 136, 0.3);
}

.btn-secondary {
  background: var(--secondary-bg);
  color: var(--text-primary);
  border: 2px solid var(--accent-color);
  font-size: 1.2rem;
  padding: 1rem 2rem;
  border-radius: 8px;
}

.features-section {
  width: 100%;
  max-width: 1200px;
  margin-bottom: 3rem;
}

.features-section h2 {
  text-align: center;
  font-size: 2.5rem;
  color: var(--text-primary);
  margin-bottom: 2rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: var(--accent-color);
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 255, 136, 0.2);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.5rem;
  color: var(--accent-color);
  margin-bottom: 1rem;
}

.feature-card p {
  color: var(--text-secondary);
  line-height: 1.6;
}

.current-season {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  text-align: center;
  max-width: 400px;
}

.current-season h3 {
  color: var(--accent-color);
  margin-bottom: 1rem;
}

.season-info p {
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

@media (max-width: 768px) {
  .game-title {
    font-size: 2.5rem;
  }
  
  .action-buttons {
    flex-direction: column;
    gap: 1rem;
  }
  
  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>

