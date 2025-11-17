import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/supabase'

// Supabase 配置
// 注意：线上部署时请在环境变量中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY
// 这里的默认值只用于本地快速调试，正式环境不要依赖这些默认值
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jrumbdycdgenmjtjdkis.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpydW1iZHljZGdlbm1qdGpka2lzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExMDI1NjIsImV4cCI6MjA3NjY3ODU2Mn0.1wGEVzLdG656KL5X_AulzWVMNCuuLSXf_2svDDg9jBY'

// 检查配置是否有效：只要 URL 和 Key 都有值就认为已配置
// 不再强绑定到特定项目 ID，避免线上环境使用自己项目时被误判为“未配置”
const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey

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

  // 邮箱注册
  async signUp(email: string, password: string, username: string) {
    if (!supabase) throw new Error('Supabase未配置')
    
    // 注册用户，确保需要邮箱确认
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          username
        }
      }
    })
    
    if (authError) throw authError
    if (!authData.user) throw new Error('注册失败')

    // 创建玩家记录（即使邮箱未确认也要创建，因为用户ID已生成）
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .insert({
        id: authData.user.id,
        name: username
      } as any)
      .select()
      .single()

    if (playerError) {
      console.error('创建玩家记录失败:', playerError)
    }

    // 返回用户信息和确认状态
    return { 
      user: authData.user, 
      player: playerData,
      needsConfirmation: !authData.user.email_confirmed_at // 如果email_confirmed_at为null，则需要确认
    }
  },

  // 邮箱登录
  async signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase未配置')
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) {
      // 如果是邮箱未确认的错误，提供更友好的提示
      if (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed')) {
        throw new Error('请先在邮箱中确认您的账户，然后才能登录')
      }
      throw error
    }
    
    // 检查用户邮箱是否已确认
    if (data.user && !data.user.email_confirmed_at) {
      // 如果用户存在但邮箱未确认，登出并提示
      await supabase.auth.signOut()
      throw new Error('请先在邮箱中确认您的账户，然后才能登录')
    }
    
    return data
  },

  // 登出
  async signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // 重置密码
  async resetPassword(email: string) {
    if (!supabase) throw new Error('Supabase未配置')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  },

  // 监听认证状态变化
  onAuthStateChange(callback: (event: string, session: any) => void) {
    if (!supabase) return { data: { subscription: null }, unsubscribe: () => {} }
    return supabase.auth.onAuthStateChange(callback)
  }
}

// 游戏数据相关方法
export const gameData = {
  // 获取当前活跃赛季
  async getCurrentSeason(): Promise<{ id: string; name: string; theme: string; seed: string; start_date: string; end_date: string; is_active: boolean; created_at: string } | null> {
    if (!supabase) return null
    
    const { data, error } = await supabase
      .from('seasons')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      console.error('获取当前赛季失败:', error)
      return null
    }
    
    return data as { id: string; name: string; theme: string; seed: string; start_date: string; end_date: string; is_active: boolean; created_at: string }
  },

  // 获取排行榜
  async getLeaderboard(limit = 100) {
    if (!supabase) {
      console.warn('Supabase未配置')
      return []
    }
    
    // 获取当前活跃赛季
    const currentSeason = await gameData.getCurrentSeason()
    if (!currentSeason) {
      console.warn('没有找到活跃赛季，返回空排行榜')
      return []
    }
    
    console.log('获取排行榜，赛季ID:', currentSeason.id)
    
    // 尝试使用数据库函数获取排行榜（如果可用）
    try {
      const { data: functionData, error: functionError } = await (supabase as any)
        .rpc('get_leaderboard', {
          season_id_param: currentSeason.id,
          limit_param: limit
        })
      
      if (!functionError && functionData && Array.isArray(functionData)) {
        console.log('使用数据库函数获取排行榜成功:', functionData.length, '条记录')
        console.log('数据库函数返回的数据:', JSON.stringify(functionData, null, 2))
        
        // 按照分数降序排序，然后重新计算排名
        const sorted = functionData.sort((a: any, b: any) => {
          // 首先按分数降序
          if (b.score !== a.score) return b.score - a.score
          // 分数相同按层数降序
          if (b.level !== a.level) return b.level - a.level
          // 层数相同按时间升序
          return (a.time || 0) - (b.time || 0)
        })
        
        const result = sorted.map((entry: any, index: number) => {
          const playerName = entry.player_name || '未知玩家'
          if (!entry.player_name || entry.player_name === '未知玩家') {
            console.warn('数据库函数返回的玩家名称为空:', {
              entry_id: entry.id,
              player_name: entry.player_name,
              full_entry: entry
            })
          }
          return {
            id: entry.id,
            player_name: playerName,
            score: entry.score || 0,
            level: entry.level || 1,
            time: entry.time || 0,
            build: entry.build || [],
            rank: index + 1 // 重新计算排名：按照分数降序排列
          }
        })
        
        console.log('处理后的排行榜数据:', result)
        return result
      } else {
        console.warn('数据库函数调用失败，尝试直接查询:', functionError)
      }
    } catch (err) {
      console.warn('数据库函数不可用，使用直接查询:', err)
    }
    
    // 备用方案：使用直接查询，通过JOIN获取玩家名称
    // 先获取排行榜数据，按照分数降序排序（分数相同按层数降序，再按时间升序）
    const { data: leaderboardData, error: leaderboardError } = await supabase
      .from('leaderboard')
      .select('id, score, level, "time", build, rank, player_id')
      .eq('season_id', currentSeason.id)
      .order('score', { ascending: false })
      .order('level', { ascending: false })
      .order('time', { ascending: true })
      .limit(limit)
    
    if (leaderboardError) {
      console.error('获取排行榜失败:', leaderboardError)
      return []
    }
    
    if (!leaderboardData || leaderboardData.length === 0) {
      console.log('排行榜数据为空')
      return []
    }
    
    console.log('获取到排行榜数据:', leaderboardData.length, '条记录')
    console.log('排行榜数据详情:', JSON.stringify(leaderboardData, null, 2))
    
    // 获取所有玩家ID（确保类型正确）
    const playerIds = [...new Set(leaderboardData.map((entry: any) => entry.player_id).filter((id: any) => id != null && id !== ''))]
    
    console.log('提取的玩家ID列表:', playerIds)
    console.log('玩家ID数量:', playerIds.length)
    
    if (playerIds.length === 0) {
      console.warn('没有找到任何玩家ID')
      return []
    }
    
    // 批量查询玩家名称 - 使用更明确的查询方式
    const { data: playersData, error: playersError } = await supabase
      .from('players')
      .select('id, name')
      .in('id', playerIds)
    
    console.log('查询玩家信息的请求ID:', playerIds)
    console.log('查询玩家信息的响应:', playersData)
    console.log('查询玩家信息的错误:', playersError)
    
    if (playersError) {
      console.error('获取玩家信息失败:', playersError)
      console.error('玩家ID列表:', playerIds)
      console.error('玩家ID类型:', playerIds.map(id => typeof id))
    }
    
    // 创建玩家ID到名称的映射（确保ID格式匹配）
    const playerNameMap = new Map<string, string>()
    if (playersData && Array.isArray(playersData)) {
      playersData.forEach((player: any) => {
        if (player.id && player.name) {
          // 确保ID格式一致（都转为字符串）
          const playerId = String(player.id)
          playerNameMap.set(playerId, player.name)
          console.log(`映射玩家: ${playerId} -> ${player.name}`)
        }
      })
      console.log('成功获取', playerNameMap.size, '个玩家名称')
      console.log('玩家名称映射表:', Array.from(playerNameMap.entries()))
    } else {
      console.warn('玩家数据为空或格式不正确:', playersData)
    }
    
    // 转换数据格式，并重新计算排名（按照分数降序）
    const result = leaderboardData.map((entry: any, index: number) => {
      // 确保 player_id 格式一致
      const entryPlayerId = entry.player_id ? String(entry.player_id) : null
      const playerName = entryPlayerId ? (playerNameMap.get(entryPlayerId) || null) : null
      
      // 如果仍然没有获取到名称，记录详细警告
      if (!playerName && entryPlayerId) {
        console.warn('玩家名称获取失败:')
        console.warn('  - player_id:', entryPlayerId, '(类型:', typeof entryPlayerId, ')')
        console.warn('  - 映射表中的所有ID:', Array.from(playerNameMap.keys()))
        console.warn('  - 映射表中的所有ID类型:', Array.from(playerNameMap.keys()).map(id => typeof id))
        console.warn('  - 查询到的玩家数据:', playersData)
        console.warn('  - 原始entry数据:', entry)
      }
      
      return {
        id: entry.id,
        player_name: playerName || '未知玩家',
        score: entry.score || 0,
        level: entry.level || 1,
        time: entry.time || 0,
        build: entry.build || [],
        rank: index + 1 // 重新计算排名：按照分数降序排列，排名从1开始
      }
    })
    
    console.log('转换后的排行榜数据:', result)
    return result
  },

  // 提交游戏结果
  async submitGameResult(result: {
    playerId: string
    level: number
    score: number
    time: number
    build: string[]
  }) {
    if (!supabase) {
      console.error('[Supabase] ❌ Supabase客户端未初始化')
      throw new Error('Supabase未配置，无法保存游戏结果')
    }
    
    // 获取当前活跃赛季
    let currentSeason
    try {
      currentSeason = await gameData.getCurrentSeason()
    } catch (error: any) {
      // 检查是否是网络错误
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        console.error('[Supabase] ❌ 网络连接失败，无法连接到 Supabase')
        console.error('[Supabase] 请检查：')
        console.error('  1. 网络连接是否正常')
        console.error('  2. Supabase 服务是否可用')
        console.error('  3. 防火墙或代理设置是否阻止了连接')
        throw new Error('网络连接失败，无法保存游戏结果。请检查网络连接后重试。')
      }
      throw error
    }
    
    if (!currentSeason) {
      throw new Error('没有找到活跃赛季，无法保存游戏结果')
    }
    
    // 先插入游戏会话（记录所有游戏会话，包括中途退出）
    console.log('[Supabase] 插入游戏会话，数据:', {
      player_id: result.playerId,
      season_id: currentSeason.id,
      level: result.level,
      score: result.score,
      time: result.time,
      build: result.build
    })
    
    let session, sessionError
    try {
      const result_data = await supabase
        .from('game_sessions')
        .insert({
          player_id: result.playerId,
          season_id: currentSeason.id,
          level: result.level,
          score: result.score,
          time: result.time,
          build: result.build
        } as any)
        .select()
        .single()
      
      session = result_data.data
      sessionError = result_data.error
    } catch (error: any) {
      // 捕获网络错误
      if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
        console.error('[Supabase] ❌ 网络连接失败，无法保存游戏会话')
        throw new Error('网络连接失败，无法保存游戏结果。分数已保存在本地，请稍后重试。')
      }
      throw error
    }

    if (sessionError) {
      console.error('[Supabase] ❌ 保存游戏会话失败:', sessionError)
      console.error('[Supabase] 错误详情:', {
        message: sessionError.message,
        code: sessionError.code,
        details: sessionError.details,
        hint: sessionError.hint
      })
      throw sessionError
    }
    
    console.log('[Supabase] ✅ 游戏会话保存成功:', session)

    // 更新排行榜 - 只有当新分数更高时才更新
    try {
      // 先查询当前玩家的最高分数
      const { data: existingEntry, error: queryError } = await supabase
        .from('leaderboard')
        .select('score')
        .eq('player_id', result.playerId)
        .eq('season_id', currentSeason.id)
        .maybeSingle()

      // 如果查询出错或没有记录，或者新分数更高，则更新
      const existingScore = existingEntry ? (existingEntry as any).score : 0
      const shouldUpdate = !existingEntry || result.score > existingScore
      
      if (shouldUpdate) {
        // 尝试使用 RPC 函数，如果失败则使用直接更新方式
        let rank, rankError
        let useDirectUpdate = false
        
        try {
          const result_data = await supabase
            .rpc('update_player_rank', {
              player_id: result.playerId,
              season_id: currentSeason.id,
              score: result.score,
              level: result.level,
              time: result.time,
              build: result.build
            } as any)
          
          rank = result_data.data
          rankError = result_data.error
          
          // 如果 RPC 失败且是函数不存在的错误，使用直接更新
          if (rankError && (rankError.code === 'PGRST202' || rankError.code === 'P0004' || rankError.message?.includes('does not exist'))) {
            console.warn('[Supabase] ⚠️ RPC 函数不可用，使用直接更新方式')
            useDirectUpdate = true
          }
        } catch (error: any) {
          // 捕获网络错误
          if (error?.message?.includes('Failed to fetch') || error?.message?.includes('NetworkError')) {
            console.error('[Supabase] ❌ 网络连接失败，无法更新排行榜')
            console.warn('[Supabase] ⚠️ 游戏会话已保存，但排行榜更新失败。请稍后重试。')
            rankError = error
          } else {
            // 如果是函数不存在的错误，使用直接更新
            if (error?.code === 'PGRST202' || error?.code === 'P0004' || error?.message?.includes('does not exist')) {
              console.warn('[Supabase] ⚠️ RPC 函数不可用，使用直接更新方式')
              useDirectUpdate = true
            } else {
              throw error
            }
          }
        }

        // 如果 RPC 失败，使用直接更新方式
        if (useDirectUpdate || (rankError && (rankError.code === 'PGRST202' || rankError.code === 'P0004'))) {
          console.log('[Supabase] 使用直接更新方式更新排行榜...')
          try {
            // 先检查记录是否存在
            const { data: existingLeaderboardEntry } = await supabase
              .from('leaderboard')
              .select('id')
              .eq('player_id', result.playerId)
              .eq('season_id', currentSeason.id)
              .maybeSingle()

            let upsertData: any = null, upsertError: any = null
            if (existingLeaderboardEntry && (existingLeaderboardEntry as any).id) {
              // 更新现有记录
              const updatePayload: any = {
                score: result.score,
                level: result.level,
                time: result.time,
                build: result.build,
                updated_at: new Date().toISOString()
              }
              const { data, error } = await (supabase
                .from('leaderboard') as any)
                .update(updatePayload)
                .eq('id', (existingLeaderboardEntry as any).id)
                .select()
              upsertData = data
              upsertError = error
            } else {
              // 插入新记录（需要先分配一个临时排名）
              const insertPayload: any = {
                player_id: result.playerId,
                season_id: currentSeason.id,
                score: result.score,
                level: result.level,
                time: result.time,
                build: result.build,
                rank: 999999 // 临时排名，稍后会重新计算
              }
              const { data, error } = await supabase
                .from('leaderboard')
                .insert(insertPayload)
                .select()
              upsertData = data
              upsertError = error
            }

            if (upsertError) {
              console.error('[Supabase] ❌ 直接更新排行榜失败:', upsertError)
              rankError = upsertError
            } else {
              // 手动计算排名（需要获取所有记录并排序）
              const { data: allEntries, error: rankCalcError } = await supabase
                .from('leaderboard')
                .select('id, score, level, time')
                .eq('season_id', currentSeason.id)
                .order('score', { ascending: false })
                .order('level', { ascending: false })
                .order('time', { ascending: true })

              if (!rankCalcError && allEntries) {
                // 找到当前玩家的排名
                const entryId = upsertData?.[0]?.id || (upsertData as any)?.id
                const playerIndex = allEntries.findIndex((e: any) => e.id === entryId)
                const calculatedRank = playerIndex >= 0 ? playerIndex + 1 : null

                if (calculatedRank && entryId) {
                  // 更新排名（批量更新所有记录的排名）
                  const updates = allEntries.map((entry: any, index: number) => ({
                    id: entry.id,
                    rank: index + 1
                  }))

                  // 逐个更新排名（Supabase 不支持批量更新，所以需要循环）
                  for (const update of updates) {
                    const updatePayload: any = { rank: update.rank }
                    await (supabase
                      .from('leaderboard') as any)
                      .update(updatePayload)
                      .eq('id', update.id)
                  }

                  rank = calculatedRank
                  console.log('[Supabase] ✅ 排行榜直接更新成功，新排名:', rank)
                }
              }
            }
          } catch (directError: any) {
            console.error('[Supabase] ❌ 直接更新排行榜时出错:', directError)
            rankError = directError
          }
        } else if (rankError) {
          console.error('[Supabase] ❌ 更新排行榜失败:', rankError)
          console.error('[Supabase] 错误详情:', {
            message: rankError.message,
            code: rankError.code,
            details: rankError.details,
            hint: rankError.hint
          })
        } else {
          console.log('[Supabase] ✅ 排行榜更新成功（通过 RPC），新排名:', rank)
        }
      } else {
        console.log('[Supabase] ℹ️ 当前分数未超过最高分，不更新排行榜')
      }

      return { session, rank: existingEntry ? null : 'new' }
    } catch (error) {
      console.error('提交游戏结果失败:', error)
      return { session }
    }
  },

  // 获取玩家个人最高分数
  async getPlayerBestScore(playerId: string) {
    if (!supabase) return null
    
    // 获取当前活跃赛季
    const currentSeason = await gameData.getCurrentSeason()
    if (!currentSeason) {
      return null
    }
    
    // 查询玩家在当前赛季的最高分数
    const { data, error } = await supabase
      .from('leaderboard')
      .select('score, level, rank, "time", build')
      .eq('player_id', playerId)
      .eq('season_id', currentSeason.id)
      .maybeSingle()
    
    if (error) {
      // 如果没有记录，返回null（而不是抛出错误）
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('获取玩家最高分数失败:', error)
      return null
    }
    
    return data
  }
}

