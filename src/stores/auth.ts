import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { auth, supabase } from './supabase'
import type { User } from '@supabase/supabase-js'

interface Player {
  id: string
  name: string
  created_at?: string
  updated_at?: string
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const player = ref<Player | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 计算属性
  const isAuthenticated = computed(() => user.value !== null)
  const playerName = computed(() => player.value?.name || user.value?.email || '玩家')

  // 初始化：获取当前用户
  const init = async () => {
    try {
      loading.value = true
      error.value = null
      
      const currentUser = await auth.getCurrentUser()
      
      // 只有邮箱已确认的用户才设置为已登录状态
      if (currentUser && currentUser.email_confirmed_at) {
        user.value = currentUser

        if (supabase) {
          // 获取玩家信息
          const { data, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('id', currentUser.id)
            .single()

          if (playerError) {
            console.error('获取玩家信息失败:', playerError)
            // 如果玩家不存在（PGRST116），尝试创建
            if (playerError.code === 'PGRST116') {
              console.log('玩家记录不存在，尝试创建...')
              const playerName = currentUser.email?.split('@')[0] || '玩家'
              const { data: newPlayer, error: createError } = await supabase
                .from('players')
                .insert({
                  id: currentUser.id,
                  name: playerName
                } as any)
                .select()
                .single()
              
              if (createError) {
                console.error('创建玩家记录失败:', createError)
                console.error('错误详情:', {
                  message: createError.message,
                  code: createError.code,
                  details: createError.details,
                  hint: createError.hint
                })
              } else {
                player.value = newPlayer as Player
                console.log('✅ 玩家记录创建成功:', newPlayer)
              }
            }
          } else {
            player.value = data as Player
            console.log('✅ 玩家信息加载成功')
          }
        }
      } else if (currentUser && !currentUser.email_confirmed_at) {
        // 如果用户存在但邮箱未确认，登出并清除状态
        user.value = null
        player.value = null
        if (supabase) {
          await supabase.auth.signOut()
        }
      } else {
        // 没有用户
        user.value = null
        player.value = null
      }
    } catch (err: any) {
      console.error('初始化认证状态失败:', err)
      error.value = err.message || '初始化失败'
    } finally {
      loading.value = false
    }
  }

  // 注册
  const signUp = async (email: string, password: string, username: string) => {
    try {
      loading.value = true
      error.value = null

      const result = await auth.signUp(email, password, username)
      
      // 注册成功但不自动登录，需要用户确认邮箱
      // 不设置 user.value，因为邮箱未确认
      
      return result
    } catch (err: any) {
      error.value = err.message || '注册失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 登录
  const signIn = async (email: string, password: string) => {
    try {
      loading.value = true
      error.value = null

      const result = await auth.signIn(email, password)
      
      // 只有在邮箱已确认的情况下才设置用户信息
      if (result.user && result.user.email_confirmed_at) {
        user.value = result.user

        // 获取玩家信息
        if (supabase) {
          const { data, error: playerError } = await supabase
            .from('players')
            .select('*')
            .eq('id', result.user.id)
            .single()

          if (playerError) {
            console.error('获取玩家信息失败:', playerError)
            // 如果玩家不存在（PGRST116），尝试创建
            if (playerError.code === 'PGRST116') {
              console.log('玩家记录不存在，尝试创建...')
              const playerName = result.user.email?.split('@')[0] || '玩家'
              const { data: newPlayer, error: createError } = await supabase
                .from('players')
                .insert({
                  id: result.user.id,
                  name: playerName
                } as any)
                .select()
                .single()
              
              if (createError) {
                console.error('创建玩家记录失败:', createError)
                console.error('错误详情:', {
                  message: createError.message,
                  code: createError.code,
                  details: createError.details,
                  hint: createError.hint
                })
              } else {
                player.value = newPlayer as Player
                console.log('✅ 玩家记录创建成功')
              }
            }
          } else {
            player.value = data as Player
          }
        }
      } else {
        // 如果邮箱未确认，抛出错误
        throw new Error('请先在邮箱中确认您的账户，然后才能登录')
      }

      return result
    } catch (err: any) {
      error.value = err.message || '登录失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 登出
  const signOut = async () => {
    try {
      loading.value = true
      error.value = null

      await auth.signOut()
      user.value = null
      player.value = null
    } catch (err: any) {
      error.value = err.message || '登出失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 重置密码
  const resetPassword = async (email: string) => {
    try {
      loading.value = true
      error.value = null

      await auth.resetPassword(email)
    } catch (err: any) {
      error.value = err.message || '重置密码失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  // 清除错误
  const clearError = () => {
    error.value = null
  }

  // 设置玩家名称
  const updatePlayerName = async (newName: string) => {
    if (!user.value || !supabase) return

    try {
      const { data, error: updateError } = await supabase
        .from('players')
        .update({ name: newName } as any)
        .eq('id', user.value.id)
        .select()
        .single()

      if (updateError) throw updateError
      if (data) {
        player.value = data as Player
      }
    } catch (err: any) {
      error.value = err.message || '更新玩家名称失败'
      throw err
    }
  }

  return {
    user,
    player,
    loading,
    error,
    isAuthenticated,
    playerName,
    init,
    signUp,
    signIn,
    signOut,
    resetPassword,
    clearError,
    updatePlayerName
  }
})

