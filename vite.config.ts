import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './', // 使用相对路径，解决部署路径问题
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    host: true,
    // 确保正确的 MIME 类型处理
    middlewareMode: false,
    fs: {
      strict: false
    },
    // 添加明确的 MIME 类型配置
    headers: {
      'Content-Type': 'application/javascript'
    }
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // 生产环境关闭 sourcemap
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  }
})

