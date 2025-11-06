<template>
  <div class="leaderboard-container">
    <div class="leaderboard-header">
      <h1>排行榜</h1>
      <button class="btn btn-secondary" @click="goHome">返回主页</button>
    </div>

    <!-- 当前用户信息卡片 -->
    <div v-if="authStore.isAuthenticated && currentPlayerScore" class="current-player-card">
      <div class="current-player-header">
        <h3>我的排名</h3>
      </div>
      <div class="current-player-stats">
        <div class="current-stat-item">
          <span class="current-stat-label">排名</span>
          <span class="current-stat-value rank-value">#{{ currentPlayerScore.rank }}</span>
        </div>
        <div class="current-stat-item">
          <span class="current-stat-label">最高分数</span>
          <span class="current-stat-value score-value">{{ currentPlayerScore.score.toLocaleString() }}</span>
        </div>
        <div class="current-stat-item">
          <span class="current-stat-label">最高层数</span>
          <span class="current-stat-value">{{ currentPlayerScore.level }}</span>
        </div>
      </div>
    </div>
    <div v-else-if="authStore.isAuthenticated && !loading" class="current-player-card no-record">
      <div class="current-player-header">
        <h3>我的排名</h3>
      </div>
      <div class="no-record-message">
        <p>还没有游戏记录，快来开始你的第一局吧！</p>
      </div>
    </div>

    <div class="leaderboard-content" v-if="leaderboard.length > 0">
      <div class="leaderboard-header-row">
        <div class="player-col">玩家</div>
        <div class="level-col">层数</div>
        <div class="score-col">分数</div>
      </div>

      <div class="leaderboard-entries">
        <div 
          v-for="(entry, index) in leaderboard" 
          :key="entry.id"
          class="leaderboard-entry"
          :class="{ 
            'top-three': index < 3,
            'current-player': entry.playerName === currentPlayerName
          }"
        >
          <div class="player-col">
            <span class="player-name">{{ entry.playerName }}</span>
          </div>
          <div class="level-col">
            <span class="level">{{ entry.level }}</span>
          </div>
          <div class="score-col">
            <span class="score">{{ entry.score.toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="!loading" class="no-data">
      <p>暂无排行榜数据</p>
    </div>

    <div v-if="loading" class="loading">
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onActivated } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { gameData } from '../stores/supabase'
import { useAuthStore } from '../stores/auth'
import { PASSIVE_ATTRIBUTES } from '../types/game'
import type { LeaderboardEntry } from '../types/game'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const leaderboard = ref<LeaderboardEntry[]>([])
const loading = ref(false)
const currentPlayerName = computed(() => authStore.playerName)
const currentPlayerScore = ref<{
  score: number
  level: number
  rank: number
  time: number
  build: string[]
} | null>(null)

const loadLeaderboard = async () => {
  loading.value = true
  try {
    const data = await gameData.getLeaderboard() as Array<{
      id: string
      player_name: string
      score: number
      level: number
      time: number
      build: string[]
      rank: number
    }>
    leaderboard.value = data.map((entry) => ({
      id: entry.id,
      playerName: entry.player_name || '未知玩家',
      score: entry.score,
      level: entry.level,
      time: entry.time,
      build: entry.build || [],
      rank: entry.rank
    }))
    
    // 加载当前用户的分数和排名
    if (authStore.isAuthenticated && authStore.user) {
      const playerScore = await gameData.getPlayerBestScore(authStore.user.id)
      currentPlayerScore.value = playerScore
    }
  } catch (error) {
    console.error('加载排行榜失败:', error)
  } finally {
    loading.value = false
  }
}

const goHome = () => {
  router.push('/')
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('zh-CN')
}

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

onMounted(() => {
  loadLeaderboard()
})

// 当页面可见时刷新排行榜（从游戏页面返回时）
onActivated(() => {
  // 当从其他页面返回时刷新排行榜
  loadLeaderboard()
})

// 监听路由变化，当进入排行榜页面时刷新
watch(() => route.path, (newPath) => {
  if (newPath === '/leaderboard') {
    loadLeaderboard()
  }
})
</script>

<style scoped>
.leaderboard-container {
  min-height: 100vh;
  background: var(--primary-bg);
  color: var(--text-primary);
  padding: 2rem;
}

.leaderboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.leaderboard-header h1 {
  font-size: 3rem;
  color: var(--accent-color);
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.leaderboard-content {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

    .leaderboard-header-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      background: var(--primary-bg);
      padding: 1rem;
      font-weight: bold;
      color: var(--text-primary);
      border-bottom: 2px solid var(--border-color);
    }

.leaderboard-entries {
  max-height: 60vh;
  overflow-y: auto;
}

    .leaderboard-entry {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color);
      transition: all 0.3s ease;
    }

.leaderboard-entry:hover {
  background: rgba(0, 255, 136, 0.1);
}

.leaderboard-entry.top-three {
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.1), transparent);
}

.leaderboard-entry.current-player {
  background: rgba(0, 255, 136, 0.2);
  border: 2px solid var(--accent-color);
}

.rank-number {
  font-weight: bold;
  font-size: 1.2rem;
}

.rank-1 {
  color: #ffd700;
}

.rank-2 {
  color: #c0c0c0;
}

.rank-3 {
  color: #cd7f32;
}

.player-name {
  font-weight: bold;
  color: var(--text-primary);
}

.score {
  color: var(--accent-color);
  font-weight: bold;
}

.level {
  color: var(--text-primary);
  font-weight: bold;
}

.time {
  color: var(--text-secondary);
}

.build-icons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.build-icon {
  background: var(--primary-bg);
  border: 1px solid var(--border-color);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  cursor: help;
  transition: all 0.2s ease;
}

.build-icon:hover {
  background: var(--accent-color);
  color: var(--primary-bg);
  transform: scale(1.2);
}

.no-data, .loading {
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
  font-size: 1.2rem;
}

.current-player-card {
  background: var(--secondary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 20px rgba(0, 255, 136, 0.2);
}

.current-player-card.no-record {
  border-color: var(--border-color);
}

.current-player-header {
  margin-bottom: 1rem;
  border-bottom: 2px solid var(--accent-color);
  padding-bottom: 0.5rem;
}

.current-player-header h3 {
  color: var(--accent-color);
  font-size: 1.5rem;
  margin: 0;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.current-player-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.current-stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  background: rgba(0, 255, 136, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(0, 255, 136, 0.2);
}

.current-stat-label {
  color: var(--text-secondary);
  font-size: 0.9rem;
  font-weight: 500;
}

.current-stat-value {
  color: var(--text-primary);
  font-size: 1.5rem;
  font-weight: bold;
}

.current-stat-value.rank-value {
  color: #ffd700;
}

.current-stat-value.score-value {
  color: var(--accent-color);
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.no-record-message {
  text-align: center;
  padding: 1rem;
  color: var(--text-secondary);
}

.no-record-message p {
  margin: 0;
  font-size: 1rem;
}

@media (max-width: 768px) {
  .current-player-stats {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

    @media (max-width: 768px) {
      .leaderboard-header-row,
      .leaderboard-entry {
        grid-template-columns: 2fr 1fr 1fr;
        font-size: 0.9rem;
      }
    }
</style>

