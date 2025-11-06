import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { useAuthStore } from './stores/auth'
import { auth } from './stores/supabase'

// 检查 DOM 是否准备就绪
const checkDOM = () => {
  const appElement = document.getElementById('app')
  if (!appElement) {
    console.error('❌ 找不到 #app 元素')
    document.body.innerHTML = '<div style="padding: 20px; color: white; background: #1a1a1a; font-family: sans-serif;"><h1>初始化错误</h1><p>找不到应用根元素 #app</p></div>'
    return false
  }
  return true
}

// 检查必要的环境变量
const checkEnv = () => {
  if (import.meta.env.MODE === 'production') {
    console.log('🔍 生产环境检查:')
    console.log('  - Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? '已配置' : '未配置')
    console.log('  - Base URL:', import.meta.env.BASE_URL)
    console.log('  - Mode:', import.meta.env.MODE)
  }
}

try {
  // 初始化检查
  if (!checkDOM()) {
    throw new Error('DOM 未准备好')
  }

  checkEnv()

  const app = createApp(App)

  const pinia = createPinia()
  app.use(pinia)
  app.use(router)

  // 初始化认证状态
  const authStore = useAuthStore()
  authStore.init()

  // 监听认证状态变化
  if (auth.onAuthStateChange) {
    auth.onAuthStateChange((event, session) => {
      console.log('认证状态变化:', event, session?.user?.id)
      authStore.init()
    })
  }

  // 错误处理
  app.config.errorHandler = (err, instance, info) => {
    console.error('❌ Vue Error:', err, 'Error Information:', info)
    console.error('错误堆栈:', err instanceof Error ? err.stack : '未知错误')
    
    // 在开发环境显示详细错误
    if (import.meta.env.DEV) {
      const errorDiv = document.createElement('div')
      errorDiv.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; background: #ff4444; color: white; padding: 10px; z-index: 9999; font-family: monospace;'
      errorDiv.textContent = `Vue Error: ${err instanceof Error ? err.message : String(err)}`
      document.body.appendChild(errorDiv)
    }
  }

  // 全局错误处理
  window.addEventListener('error', (event) => {
    console.error('❌ Global Error:', event.error)
    console.error('  文件:', event.filename)
    console.error('  行号:', event.lineno)
    console.error('  列号:', event.colno)
    
    // 检查是否是资源加载错误
    if (event.target instanceof HTMLElement) {
      console.error('  资源加载错误:', event.target.tagName, event.target.getAttribute('src') || event.target.getAttribute('href'))
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled Promise Rejection:', event.reason)
  })

  // 挂载应用
  app.mount('#app')
  console.log('✅ 应用初始化成功')
  
} catch (error) {
  console.error('❌ 应用初始化失败:', error)
  
  // 显示友好的错误信息
  const appElement = document.getElementById('app')
  if (appElement) {
    appElement.innerHTML = `
      <div style="padding: 40px; color: white; background: #1a1a1a; font-family: 'Microsoft YaHei', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
        <h1 style="color: #ff4444; margin-bottom: 20px;">⚠️ 应用加载失败</h1>
        <p style="margin-bottom: 10px;">错误信息: ${error instanceof Error ? error.message : String(error)}</p>
        <p style="margin-top: 20px; color: #888;">请检查浏览器控制台获取更多详细信息</p>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
          刷新页面
        </button>
      </div>
    `
  }
}

