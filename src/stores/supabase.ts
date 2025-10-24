import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

// 检查配置是否有效
const isSupabaseConfigured = supabaseUrl !== 'https://your-project.supabase.co' && 
                            supabaseKey !== 'your-anon-key' &&
                            supabaseUrl.includes('supabase.co')

export const supabase = isSupabaseConfigured 
  ? createClient<Database>(supabaseUrl, supabaseKey)
  : null

// 添加配置检查日志
if (!isSupabaseConfigured) {
  console.warn('Supabase未正确配置，将使用离线模式')
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

