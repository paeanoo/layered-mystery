import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jrumbdycdgenmjtjdkis.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydW1iZHljZGdlbm1qdGpka2lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMDI1NjIsImV4cCI6MjA3NjY3ODU2Mn0.1wGEVzLdG656KL5X_AulzWVMNCuuLSXf_2svDDg9jBY'

// 检查配置是否有效
const isSupabaseConfigured = supabaseUrl.includes('jrumbdycdgenmjtjdkis.supabase.co') && 
                            supabaseKey.length > 100

export const supabase = isSupabaseConfigured 
  ? createClient<Database>(supabaseUrl, supabaseKey)
  : null

// 配置检查日志
if (isSupabaseConfigured) {
  console.log('✅ Supabase已正确配置')
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Key:', '已设置 (' + supabaseKey.length + ' 字符)')
  
  // 测试连接
  if (supabase) {
    supabase.from('seasons').select('count').then(({ data, error }) => {
      if (error) {
        console.log('⚠️ Supabase连接测试失败:', error.message)
      } else {
        console.log('✅ Supabase连接测试成功')
      }
    }).catch(err => {
      console.log('⚠️ Supabase连接测试异常:', err.message)
    })
  }
} else {
  console.warn('❌ Supabase未正确配置，将使用离线模式')
  console.log('Supabase URL:', supabaseUrl)
  console.log('Supabase Key:', supabaseKey ? '已设置' : '未设置')
}

// 认证相关方法
export const auth = {
  // 获取当前用户
  async getCurrentUser() {
    if (!supabase) return null
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // 匿名登录
  async signInAnonymously() {
    if (!supabase) return null
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    return data
  },

  // 登出
  async signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }
}

// 游戏数据相关方法
export const gameData = {
  // 获取当前赛季
  async getCurrentSeason() {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .single()
    
    if (error) throw error
    return data
  },

  // 获取排行榜
  async getLeaderboard(seasonId: string, limit = 100) {
    if (!supabase) return []
    const { data, error } = await supabase
      .rpc('get_leaderboard', { season_id: seasonId, limit })
    
    if (error) throw error
    return data
  },

  // 提交游戏结果
  async submitGameResult(result: {
    playerId: string
    seasonId: string
    level: number
    score: number
    time: number
    build: string[]
  }) {
    if (!supabase) return null
    
    // 先插入游戏会话
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        player_id: result.playerId,
        season_id: result.seasonId,
        level: result.level,
        score: result.score,
        time: result.time,
        build: result.build
      })
      .select()
      .single()

    if (sessionError) throw sessionError

    // 更新排行榜
    const { data: rank, error: rankError } = await supabase
      .rpc('update_player_rank', {
        player_id: result.playerId,
        season_id: result.seasonId,
        score: result.score,
        level: result.level,
        time: result.time,
        build: result.build
      })

    if (rankError) throw rankError

    return { session, rank }
  }
}

