<template>
  <div class="home-container">
        <div class="user-info" v-if="authStore.isAuthenticated">
          <div class="user-details">
            <span class="user-name">👤 {{ authStore.playerName }}</span>
            <span v-if="!authStore.user?.email_confirmed_at" class="email-warning" title="邮箱未验证">
              ⚠️
            </span>
            <button class="btn btn-small" @click="goToSettings">设置</button>
            <button class="btn btn-small" @click="handleLogout">登出</button>
          </div>
        </div>
    <div class="user-info" v-else>
      <button class="btn btn-small" @click="goToLogin">登录/注册</button>
    </div>

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
      <button 
        v-if="!authStore.isAuthenticated" 
        class="btn btn-secondary login-btn-main" 
        @click="goToLogin"
      >
        🔐 登录/注册
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
          <p>统一随机种子，消除运气差异，纯策略比拼</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔄</div>
          <h3>可持续复玩</h3>
          <p>多样化的被动组合，每次游戏都有新体验</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const startGame = () => {
  router.push('/game')
}

const viewLeaderboard = () => {
  router.push('/leaderboard')
}

const handleLogout = async () => {
  try {
    await authStore.signOut()
    router.push('/login')
  } catch (error) {
    console.error('登出失败:', error)
  }
}

    const goToLogin = () => {
      router.push('/login')
    }

    const goToSettings = () => {
      router.push('/settings')
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

.user-info {
  position: fixed;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 100;
  background: rgba(45, 45, 45, 0.9);
  backdrop-filter: blur(10px);
  border: 2px solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.user-details {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-name {
  color: var(--text-primary);
  font-size: 1rem;
  font-weight: bold;
}

.email-warning {
  color: #ffaa00;
  font-size: 1rem;
  margin-left: 0.5rem;
  cursor: help;
}

.btn-small {
  padding: 0.6rem 1.2rem;
  font-size: 0.95rem;
  font-weight: bold;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.btn-small:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
}

@media (max-width: 768px) {
  .user-info {
    top: 1rem;
    right: 1rem;
  }

  .user-details {
    flex-direction: column;
    gap: 0.5rem;
  }
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
  flex-wrap: wrap;
  justify-content: center;
}

.login-btn-main {
  border-color: var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
}

.login-btn-main:hover {
  background: var(--accent-color);
  color: var(--primary-bg);
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(0, 255, 136, 0.5);
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

