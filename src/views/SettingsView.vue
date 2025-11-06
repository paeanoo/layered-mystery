<template>
  <div class="settings-container">
    <div class="settings-header">
      <h1>账户设置</h1>
      <button class="btn btn-secondary" @click="goHome">返回主页</button>
    </div>

    <div v-if="!authStore.isAuthenticated" class="not-authenticated">
      <p>请先登录</p>
      <button class="btn btn-primary" @click="goToLogin">去登录</button>
    </div>

    <div v-else class="settings-content">
      <!-- 修改用户名 -->
      <div class="settings-section">
        <h2>修改用户名</h2>
        <div class="form-group">
          <label for="username">当前用户名</label>
          <input
            id="username"
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            maxlength="50"
            :disabled="loading"
          />
        </div>
        <button 
          class="btn btn-primary" 
          @click="updateUsername"
          :disabled="loading || !username.trim() || username === authStore.playerName"
        >
          <span v-if="loading">保存中...</span>
          <span v-else>保存用户名</span>
        </button>
        <p v-if="usernameError" class="error-message">{{ usernameError }}</p>
        <p v-if="usernameSuccess" class="success-message">{{ usernameSuccess }}</p>
      </div>

      <!-- 修改密码 -->
      <div class="settings-section">
        <h2>修改密码</h2>
        <div class="form-group">
          <label for="current-password">当前密码</label>
          <input
            id="current-password"
            v-model="currentPassword"
            type="password"
            placeholder="请输入当前密码"
            :disabled="loading"
            :class="{ 'input-error': passwordError && passwordError.includes('原密码') }"
          />
          <p v-if="passwordError && passwordError.includes('原密码')" class="field-error-text">
            原密码错误
          </p>
        </div>
        <div class="form-group">
          <label for="new-password">新密码</label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            placeholder="请输入新密码（至少6位）"
            minlength="6"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label for="confirm-password">确认新密码</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            minlength="6"
            :disabled="loading"
          />
        </div>
        <button 
          class="btn btn-primary" 
          @click="updatePassword"
          :disabled="loading || !currentPassword || !newPassword || newPassword !== confirmPassword || currentPassword === newPassword"
        >
          <span v-if="loading">修改中...</span>
          <span v-else>修改密码</span>
        </button>
        <p v-if="currentPassword && newPassword && currentPassword === newPassword" class="warning-message">
          ⚠️ 新密码不能与当前密码相同
        </p>
        <!-- 错误提示 - 确保始终显示，特别是原密码错误时 -->
        <div 
          v-if="passwordError && !passwordSuccess" 
          class="error-message password-error-message"
          :class="{ 'password-error-highlight': passwordError.includes('原密码') }"
        >
          <strong>❌ {{ passwordError }}</strong>
        </div>
        <!-- 成功提示 -->
        <div 
          v-if="passwordSuccess" 
          class="success-message password-success-message"
          style="display: block !important; visibility: visible !important; opacity: 1 !important;"
        >
          <strong>✅ {{ passwordSuccess }}</strong>
        </div>
      </div>

      <!-- 账户信息 -->
      <div class="settings-section">
        <h2>账户信息</h2>
        <div class="info-item">
          <span class="info-label">邮箱：</span>
          <span class="info-value">{{ authStore.user?.email || '未知' }}</span>
          <span v-if="authStore.user?.email_confirmed_at" class="verified-badge">✓ 已验证</span>
          <span v-else class="unverified-badge">⚠ 未验证</span>
        </div>
        <div class="info-item">
          <span class="info-label">用户名：</span>
          <span class="info-value">{{ authStore.playerName || '未设置' }}</span>
        </div>
        <div v-if="!authStore.user?.email_confirmed_at" class="email-verification-prompt">
          <p class="warning-text">您的邮箱尚未验证，请验证邮箱以确保账户安全。</p>
          <button 
            class="btn btn-secondary" 
            @click="resendVerificationEmail"
            :disabled="resendingEmail"
          >
            <span v-if="resendingEmail">发送中...</span>
            <span v-else>重新发送验证邮件</span>
          </button>
          <p v-if="emailVerificationMessage" class="info-message">{{ emailVerificationMessage }}</p>
        </div>
      </div>
    </div>

    <!-- 密码修改成功弹窗 -->
    <div v-if="showPasswordSuccessModal" class="success-modal-overlay">
      <div class="success-modal-content">
        <div class="success-icon">✅</div>
        <h2 class="success-title">密码修改成功！</h2>
        <p class="success-message-text">您的密码已成功修改</p>
        <div class="countdown-container">
          <div class="countdown-number">{{ countdown }}</div>
          <div class="countdown-text">秒后自动退出登录</div>
        </div>
        <p class="success-hint">请使用新密码重新登录</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../stores/supabase'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const usernameError = ref('')
const usernameSuccess = ref('')
const passwordError = ref('')
const passwordSuccess = ref('')
const showPasswordSuccessModal = ref(false)
const countdown = ref(2)
const resendingEmail = ref(false)
const emailVerificationMessage = ref('')

onMounted(() => {
  if (authStore.playerName) {
    username.value = authStore.playerName
  }
})

const goHome = () => {
  router.push('/')
}

const goToLogin = () => {
  router.push('/login')
}

const updateUsername = async () => {
  if (!authStore.isAuthenticated || !authStore.user) {
    usernameError.value = '请先登录'
    return
  }

  if (!username.value.trim()) {
    usernameError.value = '用户名不能为空'
    return
  }

  if (username.value.trim().length > 50) {
    usernameError.value = '用户名不能超过50个字符'
    return
  }

  loading.value = true
  usernameError.value = ''
  usernameSuccess.value = ''

  try {
    if (!supabase) {
      throw new Error('Supabase未配置')
    }

    // 更新 players 表中的用户名
    const { error } = await supabase
      .from('players')
      .update({ name: username.value.trim() } as any)
      .eq('id', authStore.user.id)

    if (error) {
      throw error
    }

    // 刷新 auth store 中的玩家信息
    await authStore.init()
    
    usernameSuccess.value = '用户名修改成功！'
    username.value = authStore.playerName || ''
    
    // 3秒后清除成功消息
    setTimeout(() => {
      usernameSuccess.value = ''
    }, 3000)
  } catch (err: any) {
    console.error('修改用户名失败:', err)
    usernameError.value = err.message || '修改用户名失败，请重试'
  } finally {
    loading.value = false
  }
}

const updatePassword = async () => {
  if (!authStore.isAuthenticated || !authStore.user) {
    passwordError.value = '请先登录'
    return
  }

  if (!currentPassword.value) {
    passwordError.value = '请输入当前密码'
    return
  }

  if (!newPassword.value) {
    passwordError.value = '请输入新密码'
    return
  }

  if (newPassword.value.length < 6) {
    passwordError.value = '新密码至少需要6个字符'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的密码不一致'
    return
  }

  // 检查新密码是否与当前密码相同（在前端验证）
  if (currentPassword.value === newPassword.value) {
    passwordError.value = '新密码不能与当前密码相同'
    return
  }

  // 先清空之前的错误和成功消息
  passwordError.value = ''
  passwordSuccess.value = ''
  loading.value = true

  try {
    if (!supabase || !authStore.user?.email) {
      loading.value = false
      passwordError.value = 'Supabase未配置或用户信息不完整'
      return
    }

    // 保存当前会话，以便验证失败后恢复
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    // 第一步：验证当前密码是否正确
    const { data: verifyData, error: verifyError } = await supabase.auth.signInWithPassword({
      email: authStore.user.email,
      password: currentPassword.value
    })

    if (verifyError) {
      // 如果验证失败，说明原密码错误
      // 恢复原来的会话（如果存在）
      if (currentSession) {
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        })
      }
      
      // 检查是否是密码错误
      const errorMessage = verifyError.message || ''
      const isPasswordError = 
        errorMessage.toLowerCase().includes('invalid login credentials') ||
        errorMessage.toLowerCase().includes('invalid') ||
        verifyError.status === 400 ||
        verifyError.status === 401
      
      if (isPasswordError) {
        passwordError.value = '原密码不正确，请重新输入'
        currentPassword.value = ''
        // 让原密码输入框获得焦点，方便用户重新输入
        setTimeout(() => {
          const currentPasswordInput = document.getElementById('current-password') as HTMLInputElement
          if (currentPasswordInput) {
            currentPasswordInput.focus()
          }
        }, 100)
      } else {
        passwordError.value = '验证密码失败：' + (errorMessage || '请重试')
        currentPassword.value = ''
      }
      
      loading.value = false
      return
    }

    if (!verifyData || !verifyData.user) {
      // 恢复原来的会话（如果存在）
      if (currentSession) {
        await supabase.auth.setSession({
          access_token: currentSession.access_token,
          refresh_token: currentSession.refresh_token
        })
      }
      passwordError.value = '验证密码失败，请重试'
      currentPassword.value = ''
      loading.value = false
      return
    }

    // 第二步：密码验证成功，更新为新密码
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value
    })

    if (updateError) {
      passwordError.value = updateError.message || '修改密码失败，请重试'
      loading.value = false
      return
    }

    // 取消loading状态
    loading.value = false
    
    // 清除错误消息
    passwordError.value = ''
    passwordSuccess.value = ''
    
    // 清空密码字段
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    
    // 显示成功弹窗
    countdown.value = 2
    showPasswordSuccessModal.value = true
    
    // 开始倒计时
    const countdownInterval = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        clearInterval(countdownInterval)
        // 倒计时结束，退出登录并跳转到登录页面
        authStore.signOut().then(() => {
          router.push('/login')
        }).catch((logoutError) => {
          console.error('登出失败:', logoutError)
          // 即使登出失败，也跳转到登录页面
          router.push('/login')
        })
      }
    }, 1000)
  } catch (err: any) {
    console.error('修改密码失败:', err)
    const errorMessage = err.message || ''
    
    // 如果错误信息还没有设置，则设置错误信息
    if (!passwordError.value) {
      if (errorMessage.toLowerCase().includes('invalid login credentials') || 
          errorMessage.toLowerCase().includes('invalid')) {
        passwordError.value = '原密码不正确，请重新输入'
        currentPassword.value = ''
        // 让原密码输入框获得焦点，方便用户重新输入
        setTimeout(() => {
          const currentPasswordInput = document.getElementById('current-password') as HTMLInputElement
          if (currentPasswordInput) {
            currentPasswordInput.focus()
          }
        }, 100)
      } else {
        passwordError.value = errorMessage || '修改密码失败，请重试'
      }
    }
    
    loading.value = false
  }
}

const resendVerificationEmail = async () => {
  if (!authStore.user?.email) {
    emailVerificationMessage.value = '邮箱地址不存在'
    return
  }

  resendingEmail.value = true
  emailVerificationMessage.value = ''

  try {
    if (!supabase) {
      throw new Error('Supabase未配置')
    }

    // 发送验证邮件
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: authStore.user.email
    })

    if (error) {
      throw error
    }

    emailVerificationMessage.value = '✅ 验证邮件已发送，请检查您的邮箱（包括垃圾邮件文件夹）'
    
    // 5秒后清除消息
    setTimeout(() => {
      emailVerificationMessage.value = ''
    }, 5000)
  } catch (err: any) {
    console.error('发送验证邮件失败:', err)
    emailVerificationMessage.value = '发送失败：' + (err.message || '请稍后重试')
  } finally {
    resendingEmail.value = false
  }
}
</script>

<style scoped>
.settings-container {
  min-height: 100vh;
  background: var(--primary-bg);
  color: var(--text-primary);
  padding: 2rem;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 3rem;
}

.settings-header h1 {
  font-size: 3rem;
  color: var(--accent-color);
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.not-authenticated {
  text-align: center;
  padding: 3rem;
}

.not-authenticated p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  color: var(--text-secondary);
}

.settings-content {
  max-width: 600px;
  margin: 0 auto;
}

.settings-section {
  background: var(--secondary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.settings-section h2 {
  color: var(--accent-color);
  font-size: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--accent-color);
  padding-bottom: 0.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  font-weight: 500;
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
  opacity: 0.5;
  cursor: not-allowed;
}

.form-group input.input-error {
  border-color: #ff4444 !important;
  background: rgba(255, 68, 68, 0.1) !important;
  box-shadow: 0 0 10px rgba(255, 68, 68, 0.3) !important;
}

.field-error-text {
  color: #ff4444;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.field-error-text::before {
  content: "⚠️";
  font-size: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-primary {
  background: var(--accent-color);
  color: var(--primary-bg);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--secondary-bg);
  color: var(--text-primary);
  border: 2px solid var(--accent-color);
}

.btn-secondary:hover {
  background: var(--accent-color);
  color: var(--primary-bg);
}

.error-message {
  color: #ff4444;
  margin-top: 0.5rem;
  font-size: 0.9rem;
  display: block;
  visibility: visible;
  opacity: 1;
  padding: 0.75rem;
  background: rgba(255, 68, 68, 0.15);
  border: 2px solid rgba(255, 68, 68, 0.5);
  border-radius: 6px;
  font-weight: bold;
  min-height: 20px;
  animation: shake 0.5s ease-in-out;
}

.password-error-message {
  margin-top: 1rem;
  padding: 1rem;
  font-size: 1rem;
}

.password-error-highlight {
  background: rgba(255, 68, 68, 0.25) !important;
  border: 2px solid #ff4444 !important;
  box-shadow: 0 0 15px rgba(255, 68, 68, 0.5);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

@keyframes pulse {
  0%, 100% { 
    box-shadow: 0 0 15px rgba(255, 68, 68, 0.5);
  }
  50% { 
    box-shadow: 0 0 25px rgba(255, 68, 68, 0.8);
  }
}

.success-message {
  color: var(--accent-color);
  margin-top: 1rem;
  padding: 1rem;
  font-size: 1rem;
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  background: rgba(0, 255, 136, 0.15);
  border: 2px solid var(--accent-color);
  border-radius: 6px;
  font-weight: bold;
  animation: successPulse 2s ease-in-out infinite;
}

.password-success-message {
  margin-top: 1rem;
  padding: 1.25rem;
  font-size: 1.1rem;
  background: rgba(0, 255, 136, 0.2) !important;
  border: 2px solid var(--accent-color) !important;
  box-shadow: 0 0 20px rgba(0, 255, 136, 0.4);
}

@keyframes successPulse {
  0%, 100% { 
    box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
  }
  50% { 
    box-shadow: 0 0 25px rgba(0, 255, 136, 0.6);
  }
}

.warning-message {
  color: #ffaa00;
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.info-message {
  color: var(--text-secondary);
  margin-top: 0.5rem;
  font-size: 0.9rem;
}

.info-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: rgba(0, 255, 136, 0.05);
  border-radius: 8px;
  margin-bottom: 1rem;
  border: 1px solid rgba(0, 255, 136, 0.2);
}

.info-label {
  font-weight: bold;
  color: var(--text-secondary);
  margin-right: 1rem;
  min-width: 100px;
}

.info-value {
  color: var(--text-primary);
  flex: 1;
}

.verified-badge {
  background: var(--accent-color);
  color: var(--primary-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

.unverified-badge {
  background: #ffaa00;
  color: var(--primary-bg);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  margin-left: 0.5rem;
}

.email-verification-prompt {
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(255, 170, 0, 0.1);
  border: 1px solid rgba(255, 170, 0, 0.3);
  border-radius: 8px;
}

.warning-text {
  color: #ffaa00;
  margin-bottom: 1rem;
  font-size: 0.9rem;
}

/* 密码修改成功弹窗样式 */
.success-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.success-modal-content {
  background: var(--secondary-bg);
  border: 3px solid var(--accent-color);
  border-radius: 16px;
  padding: 3rem;
  max-width: 400px;
  width: 90%;
  text-align: center;
  box-shadow: 0 0 40px rgba(0, 255, 136, 0.5);
  animation: slideUp 0.4s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(50px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.success-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  animation: scaleIn 0.5s ease-out;
}

@keyframes scaleIn {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

.success-title {
  color: var(--accent-color);
  font-size: 1.8rem;
  margin-bottom: 1rem;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.success-message-text {
  color: var(--text-primary);
  font-size: 1.1rem;
  margin-bottom: 2rem;
}

.countdown-container {
  margin: 2rem 0;
  padding: 1.5rem;
  background: rgba(0, 255, 136, 0.1);
  border: 2px solid var(--accent-color);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.countdown-number {
  font-size: 3rem;
  font-weight: bold;
  color: var(--accent-color);
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.8);
  animation: countdownPulse 1s ease-in-out infinite;
}

.countdown-text {
  font-size: 1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.success-hint {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 1.5rem;
  font-style: italic;
}

@keyframes countdownPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.9;
  }
}
</style>

