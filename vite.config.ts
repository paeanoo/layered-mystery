import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'fix-mime-types',
      configureServer(server) {
        server.middlewares.use('/src', (req, res, next) => {
          if (req.url?.endsWith('.ts') || req.url?.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
          }
          next();
        });
      }
    }
  ],
  base: '/', // Netlify 部署使用根路径
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
    }
  },
  build: {
    target: 'es2015',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // 生产环境关闭 sourcemap
    assetsInlineLimit: 4096, // 小于 4kb 的资源内联
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          supabase: ['@supabase/supabase-js']
        },
        // 确保使用正确的路径格式
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js'
      }
    }
  }
})

