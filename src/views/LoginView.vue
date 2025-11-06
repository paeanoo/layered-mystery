<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>层叠秘境</h1>
        <p class="subtitle">登录或注册账号</p>
      </div>

      <div class="auth-tabs">
        <button 
          class="tab-btn" 
          :class="{ active: isLoginMode }"
          @click="isLoginMode = true"
        >
          登录
        </button>
        <button 
          class="tab-btn" 
          :class="{ active: !isLoginMode }"
          @click="isLoginMode = false"
        >
          注册
        </button>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <form @submit.prevent="handleSubmit" class="auth-form">
        <div v-if="!isLoginMode" class="form-group">
          <label for="username">用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            required
            :disabled="loading"
            maxlength="50"
          />
        </div>

        <div class="form-group">
          <label for="email">邮箱</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="请输入邮箱地址"
            required
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label for="password">密码</label>
          <input
            id="password"
            v-model="password"
            type="password"
            placeholder="请输入密码（至少6位）"
            required
            :disabled="loading"
            minlength="6"
          />
        </div>

        <button 
          type="submit" 
          class="btn btn-primary submit-btn"
          :disabled="loading"
        >
          <span v-if="loading">处理中...</span>
          <span v-else>{{ isLoginMode ? '登录' : '注册' }}</span>
        </button>
      </form>

      <div class="auth-footer">
        <button 
          v-if="isLoginMode"
          class="link-btn"
          @click="showForgotPassword = true"
        >
          忘记密码？
        </button>
        <button 
          class="link-btn" 
          @click="goHome"
        >
          返回主页
        </button>
      </div>

      <!-- 忘记密码对话框 -->
      <div v-if="showForgotPassword" class="modal-overlay" @click="showForgotPassword = false">
        <div class="modal-content" @click.stop>
          <h3>重置密码</h3>
          <p>请输入您的邮箱地址，我们将发送密码重置链接</p>
          <div class="form-group">
            <input
              v-model="resetEmail"
              type="email"
              placeholder="请输入邮箱地址"
              :disabled="loading"
            />
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="showForgotPassword = false">
              取消
            </button>
            <button class="btn btn-primary" @click="handleResetPassword" :disabled="loading">
              {{ loading ? '发送中...' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const isLoginMode = ref(true)
const email = ref('')
const password = ref('')
const username = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const showForgotPassword = ref(false)
const resetEmail = ref('')

onMounted(async () => {
  // 检查URL中是否有邮箱确认token（从邮箱确认链接返回）
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const accessToken = hashParams.get('access_token')
  const type = hashParams.get('type')
  
  // 如果是从邮箱确认链接返回
  if (accessToken && type === 'email') {
    try {
      // Supabase 会自动处理 token，我们只需要刷新认证状态
      await authStore.init()
      if (authStore.isAuthenticated) {
        alert('邮箱确认成功！您已成功登录。')
        router.push('/')
        return
      }
    } catch (err: any) {
      error.value = err.message || '邮箱确认失败'
    }
  }
  
  // 如果已登录，跳转到主页
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})

const handleSubmit = async () => {
  try {
    loading.value = true
    error.value = null
    authStore.clearError()

    if (isLoginMode.value) {
      // 登录
      await authStore.signIn(email.value, password.value)
      router.push('/')
    } else {
      // 注册
      if (!username.value.trim()) {
        error.value = '请输入用户名'
        return
      }

      if (username.value.trim().length > 50) {
        error.value = '用户名不能超过50个字符'
        return
      }

      if (password.value.length < 6) {
        error.value = '密码至少需要6个字符'
        return
      }

      const result = await authStore.signUp(email.value, password.value, username.value.trim())
      
      // 注册成功后，提示用户确认邮箱
      if (result && result.needsConfirmation) {
        alert('注册成功！\n\n我们已向您的邮箱发送了验证链接。\n\n请检查您的邮箱（包括垃圾邮件文件夹）并点击确认链接以激活账户。\n\n验证后即可登录游戏。')
        // 注册后不自动登录，切换到登录模式
        isLoginMode.value = true
        email.value = '' // 保留邮箱以便用户直接登录
        password.value = ''
        username.value = ''
      } else {
        // 如果邮箱已确认（理论上不应该发生），直接登录
        router.push('/')
      }
    }
  } catch (err: any) {
    error.value = err.message || (isLoginMode.value ? '登录失败' : '注册失败')
  } finally {
    loading.value = false
  }
}

const handleResetPassword = async () => {
  if (!resetEmail.value) {
    error.value = '请输入邮箱地址'
    return
  }

  try {
    loading.value = true
    error.value = null
    authStore.clearError()

    await authStore.resetPassword(resetEmail.value)
    alert('密码重置链接已发送到您的邮箱，请查收。')
    showForgotPassword.value = false
    resetEmail.value = ''
  } catch (err: any) {
    error.value = err.message || '发送重置密码邮件失败'
  } finally {
    loading.value = false
  }
}

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
  padding: 2rem;
}

.login-card {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 3rem;
  width: 100%;
  max-width: 450px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.login-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-header h1 {
  font-size: 2.5rem;
  color: var(--accent-color);
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.subtitle {
  color: var(--text-secondary);
  font-size: 1rem;
}

.auth-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--border-color);
}

.tab-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 1rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: all 0.3s ease;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tab-btn:hover {
  color: var(--text-primary);
}

.tab-btn.active {
  color: var(--accent-color);
  border-bottom-color: var(--accent-color);
}

.auth-form {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  background: var(--primary-bg);
  border: 2px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: rgba(255, 68, 68, 0.1);
  border: 2px solid var(--danger-color);
  border-radius: 6px;
  padding: 1rem;
  color: var(--danger-color);
  margin-bottom: 1.5rem;
  text-align: center;
}

.submit-btn {
  width: 100%;
  padding: 1rem;
  font-size: 1.1rem;
  margin-top: 0.5rem;
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-footer {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.link-btn {
  background: transparent;
  border: none;
  color: var(--accent-color);
  cursor: pointer;
  font-size: 0.9rem;
  text-decoration: underline;
  transition: all 0.3s ease;
}

.link-btn:hover {
  color: #00cc6a;
}

.link-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}

.modal-content h3 {
  color: var(--accent-color);
  margin-bottom: 1rem;
}

.modal-content p {
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .login-card {
    padding: 2rem 1.5rem;
  }

  .login-header h1 {
    font-size: 2rem;
  }
}
</style>
