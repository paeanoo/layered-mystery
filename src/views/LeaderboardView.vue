<template>
  <div class="leaderboard-container">
    <div class="leaderboard-header">
      <h1>排行榜</h1>
      <button class="btn btn-secondary" @click="goHome">返回主页</button>
    </div>

    <div class="season-selector" v-if="seasons.length > 0">
      <h3>选择赛季</h3>
      <div class="season-tabs">
        <button 
          v-for="season in seasons" 
          :key="season.id"
          class="btn season-tab"
          :class="{ active: selectedSeason?.id === season.id }"
          @click="selectSeason(season)"
        >
          {{ season.name }}
        </button>
      </div>
    </div>

    <div class="current-season-info" v-if="selectedSeason">
      <h3>{{ selectedSeason.name }}</h3>
      <p>主题: {{ selectedSeason.theme }}</p>
      <p>结束时间: {{ formatDate(selectedSeason.endDate) }}</p>
    </div>

    <div class="leaderboard-content" v-if="leaderboard.length > 0">
      <div class="leaderboard-header-row">
        <div class="rank-col">排名</div>
        <div class="player-col">玩家</div>
        <div class="score-col">分数</div>
        <div class="level-col">层数</div>
        <div class="time-col">时间</div>
        <div class="build-col">构筑</div>
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
          <div class="rank-col">
            <span class="rank-number" :class="`rank-${index + 1}`">
              {{ index + 1 }}
            </span>
          </div>
          <div class="player-col">
            <span class="player-name">{{ entry.playerName }}</span>
          </div>
          <div class="score-col">
            <span class="score">{{ entry.score.toLocaleString() }}</span>
          </div>
          <div class="level-col">
            <span class="level">{{ entry.level }}</span>
          </div>
          <div class="time-col">
            <span class="time">{{ formatTime(entry.time) }}</span>
          </div>
          <div class="build-col">
            <div class="build-icons">
              <span 
                v-for="passiveId in entry.build" 
                :key="passiveId"
                class="build-icon"
                :title="getPassiveName(passiveId)"
              >
                {{ getPassiveIcon(passiveId) }}
              </span>
            </div>
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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { gameData } from '../stores/supabase'
import { PASSIVE_ATTRIBUTES } from '../types/game'
import type { SeasonConfig, LeaderboardEntry } from '../types/game'

const router = useRouter()

const seasons = ref<SeasonConfig[]>([])
const selectedSeason = ref<SeasonConfig | null>(null)
const leaderboard = ref<LeaderboardEntry[]>([])
const loading = ref(false)
const currentPlayerName = ref('玩家') // 这里应该从用户状态获取

const selectSeason = async (season: SeasonConfig) => {
  selectedSeason.value = season
  await loadLeaderboard(season.id)
}

const loadLeaderboard = async (seasonId: string) => {
  loading.value = true
  try {
    const data = await gameData.getLeaderboard(seasonId)
    leaderboard.value = data.map((entry, index) => ({
      id: entry.id,
      playerName: entry.player_name,
      score: entry.score,
      level: entry.level,
      time: entry.time,
      build: entry.build,
      seasonId: seasonId,
      rank: index + 1
    }))
  } catch (error) {
    console.error('加载排行榜失败:', error)
  } finally {
    loading.value = false
  }
}

const loadSeasons = async () => {
  try {
    // 这里应该从API获取赛季列表
    // 暂时使用模拟数据
    seasons.value = [
      {
        id: '1',
        name: '第一赛季',
        theme: '极简风格',
        seed: 'season1',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        isActive: true
      }
    ]
    
    if (seasons.value.length > 0) {
      selectedSeason.value = seasons.value[0]
      await loadLeaderboard(seasons.value[0].id)
    }
  } catch (error) {
    console.error('加载赛季信息失败:', error)
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
  loadSeasons()
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

.season-selector {
  margin-bottom: 2rem;
}

.season-selector h3 {
  color: var(--text-primary);
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.season-tabs {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.season-tab {
  background: var(--secondary-bg);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  padding: 0.8rem 1.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.season-tab:hover {
  border-color: var(--accent-color);
  transform: translateY(-2px);
}

.season-tab.active {
  background: var(--accent-color);
  color: var(--primary-bg);
  border-color: var(--accent-color);
}

.current-season-info {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.current-season-info h3 {
  color: var(--accent-color);
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.current-season-info p {
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.leaderboard-content {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.leaderboard-header-row {
  display: grid;
  grid-template-columns: 80px 1fr 120px 80px 100px 200px;
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
  grid-template-columns: 80px 1fr 120px 80px 100px 200px;
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

@media (max-width: 768px) {
  .leaderboard-header-row,
  .leaderboard-entry {
    grid-template-columns: 60px 1fr 80px 60px 80px 120px;
    font-size: 0.9rem;
  }
  
  .build-icons {
    gap: 0.3rem;
  }
  
  .build-icon {
    width: 20px;
    height: 20px;
    font-size: 0.7rem;
  }
}
</style>

