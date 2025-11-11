import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { GameState, PlayerState, PassiveAttribute } from '../types/game'
import type { RewardOption } from '../types/reward'
import { generateBossRewards, generateShopRewards, calculateShopPrice, generateShopItemByQuality, type GeneratedReward, type RewardContext } from '../utils/RewardGenerator'
import { getTierMultiplier, ATTRIBUTE_REWARDS } from '../types/reward'
import { PASSIVE_ATTRIBUTES } from '../types/game'
import { gameData } from './supabase'
import { getSeededRandom, initSeededRandom, SeededRandom } from '../utils/SeededRandom'

export const useGameStore = defineStore('game', () => {
  // 游戏开始时间戳（用于计算总游戏时间）
  const gameStartTime = ref<number>(0)

  // 游戏状态
  const gameState = ref<GameState>({
    level: 1,
    timeRemaining: 30,
    enemies: [],
    projectiles: [],
    player: {
      health: 20,
      maxHealth: 20,
      experience: 0,
      level: 1,
      position: { x: 400, y: 300 },
      velocity: { x: 0, y: 0 },
      attackSpeed: 1.0, // 攻击速度：初始100%（1.0 = 100%）
      damage: 10,
      critChance: 0.05,
      projectiles: 1,
      pierce: 0,
      regeneration: 0,
      moveSpeed: 1.0, // 移动速度：初始100%（1.0 = 100%）
      lifesteal: 0,
      armor: 0,
      magicResistance: 0,
      dodgeChance: 0,
      blockChance: 0,
      energy: 100,
      maxEnergy: 100,
      energyRegen: 1,
      statusEffects: [],
      skillCooldowns: new Map(),
      comboCount: 0,
      maxCombo: 10,
      comboMultiplier: 1,
      skin: 'default',
      size: 1,
      color: '#00ff88',
      glowColor: '#00cc66',
      animationState: 'idle' as const,
      animationFrame: 0,
      animationTimer: 0,
      gold: 0,
      mana: 0,
      cooldownReduction: 0,
      range: 1,
      spellPower: 0,
      thorns: 0,
      reflect: 0,
      slow: 0,
      stun: 0,
      passiveAttributes: []
    },
    isPaused: false,
    isGameOver: false,
    score: 0,
    seasonSeed: ''
  })

  // 被动属性选择
  const availablePassives = ref<PassiveAttribute[]>([])
  const selectedPassive = ref<string | null>(null)
  // Boss奖励选择（新）
  const availableBossRewards = ref<RewardOption[]>([])
  const selectedBossReward = ref<string | null>(null)
  
  // 商店系统
  const availableShopItems = ref<Array<(GeneratedReward & { locked: boolean }) | null>>([])

  const sanitizeShopItems = () => {
    const original = availableShopItems.value
    // **关键修复**：确保商店总是有4个槽位
    const targetCount = 4
    const unique: Array<(GeneratedReward & { locked: boolean }) | null> = new Array(Math.max(original.length, targetCount)).fill(null)
    const seen = new Map<string, number>()

    original.forEach((item, index) => {
      if (!item || !item.option) {
        if (index < unique.length) {
          unique[index] = null
        }
        return
      }

      const id = item.option.id
      
      // **关键修复**：锁定的道具永远不会被清除，即使有重复
      if (item.locked) {
        if (index < unique.length) {
          unique[index] = { ...item }
          // 如果之前已经有相同ID的道具，清除之前的（但保留锁定的）
          if (seen.has(id)) {
            const existingIndex = seen.get(id)!
            const existingItem = unique[existingIndex]
            // 如果之前的道具也锁定了，保留两个（虽然不应该发生，但安全起见）
            if (!existingItem || !existingItem.locked) {
              unique[existingIndex] = null
            }
          }
          seen.set(id, index)
        }
        return
      }

      // 非锁定的道具：检查重复
      if (seen.has(id)) {
        const existingIndex = seen.get(id)!
        const existingItem = unique[existingIndex]
        // 如果已存在的道具被锁定，保留锁定的，清除当前的
        if (existingItem && existingItem.locked) {
          if (index < unique.length) {
            unique[index] = null
          }
          return
        }
        // 如果新的道具被锁定而旧的未锁定，则用新的替换，保持锁定优先
        if (item.locked && existingItem && !existingItem.locked) {
          unique[existingIndex] = { ...item }
        }
        // 重复项所在的槽位清空
        if (index < unique.length) {
          unique[index] = null
        }
        return
      }

      seen.set(id, index)
      if (index < unique.length) {
        unique[index] = { ...item }
      }
    })

    // **关键修复**：确保最终数组长度始终是4
    while (unique.length < targetCount) {
      unique.push(null)
    }
    if (unique.length > targetCount) {
      unique.splice(targetCount)
    }

    availableShopItems.value = unique
  }
  const shopRefreshCost = ref<number>(20)
  const showShop = ref(false)

  // 最高记录
  const highestScore = ref<number>(0)
  const highestLevel = ref<number>(1)
  const longestSurvival = ref<number>(0)

  // UI 设置
  const uiSettings = ref({
    autoOpenAttributesAfterSelection: false
  })

  const setUiAutoOpenAttributes = (enabled: boolean) => {
    uiSettings.value.autoOpenAttributesAfterSelection = enabled
    try {
      localStorage.setItem('uiSettings', JSON.stringify(uiSettings.value))
    } catch {}
  }

  // 加载UI设置
  try {
    const savedUi = localStorage.getItem('uiSettings')
    if (savedUi) {
      const parsed = JSON.parse(savedUi)
      uiSettings.value.autoOpenAttributesAfterSelection = !!parsed.autoOpenAttributesAfterSelection
    }
  } catch {}

  // 计算属性
  const isGameActive = computed(() => !gameState.value.isPaused && !gameState.value.isGameOver)
  const playerHealthPercent = computed(() => 
    (gameState.value.player.health / gameState.value.player.maxHealth) * 100
  )
  
  // 角色统计数据（用于显示） - 完全使用 player 数据，保持变量名一致
  const playerStats = computed(() => {
    const player = gameState.value.player
    // 计算动态伤害加成（如"指挥艺术"的叠加伤害）
    const dynamicDamageBonus = (player as any).dynamicDamageBonus || 0
    const baseDamage = player.damage
    const totalDamage = baseDamage * (1 + dynamicDamageBonus)
    
    return {
      // 游戏状态数据
      level: gameState.value.level,
      score: gameState.value.score,
      timeRemaining: gameState.value.timeRemaining,
      enemiesDefeated: gameState.value.enemiesDefeated || 0,
      currentEnemies: gameState.value.enemies?.length || 0,
      // 玩家属性数据（全部来自 player）
      // 确保攻速和移速有默认值 1.0（100%），如果未定义或无效则使用默认值
      projectiles: player.projectiles,
      damage: totalDamage, // 显示总伤害（基础伤害 + 动态加成）
      baseDamage: baseDamage, // 基础伤害
      dynamicDamageBonus: dynamicDamageBonus, // 动态伤害加成百分比（如0.1表示+10%）
      attackSpeed: player.attackSpeed ?? 1.0, // 默认 1.0 = 100%
      critChance: player.critChance,
      moveSpeed: player.moveSpeed ?? 1.0, // 默认 1.0 = 100%
      critDamage: player.critChance * 2, // 暴击伤害倍率
      enemyMoveSpeed: 1, // 敌人移动速度（固定值）
      lifesteal: player.lifesteal,
      regeneration: player.regeneration,
      pierce: player.pierce || 0,
      health: player.health,
      maxHealth: player.maxHealth,
      // 被动属性列表（用于显示已获得的奖励）
      passiveAttributes: player.passiveAttributes || []
    }
  })

  // 游戏控制方法
  const startGame = async () => {
    try {
      // 记录游戏开始时间
      gameStartTime.value = Date.now()
      
      // 加载历史记录
      loadRecordsFromLocalStorage()
      
      // 使用固定种子，确保所有玩家面对相同的随机序列
      const gameSeed = 'game_seed_2024'
      gameState.value.seasonSeed = gameSeed

      // 初始化种子随机数生成器
      initSeededRandom(gameSeed)

      // 重置游戏状态
      gameState.value = {
        level: 1,
        timeRemaining: 30,
        enemies: [],
        projectiles: [],
        player: {
          health: 20,
          maxHealth: 20,
          experience: 0,
          level: 1,
          position: { x: 400, y: 300 },
          velocity: { x: 0, y: 0 },
          attackSpeed: 1.0, // 攻击速度：初始100%（1.0 = 100%）
          damage: 10,
          critChance: 0.05,
          projectiles: 1,
          pierce: 0,
          regeneration: 0,
          moveSpeed: 1.0, // 移动速度：初始100%（1.0 = 100%）
          lifesteal: 0,
          armor: 0,
          magicResistance: 0,
          dodgeChance: 0,
          blockChance: 0,
          energy: 100,
          maxEnergy: 100,
          energyRegen: 1,
          statusEffects: [],
          skillCooldowns: new Map(),
          comboCount: 0,
          maxCombo: 10,
          comboMultiplier: 1,
          skin: 'default',
          size: 1,
          color: '#00ff88',
          glowColor: '#00cc66',
          animationState: 'idle' as const,
          animationFrame: 0,
          animationTimer: 0,
          gold: 0,
          mana: 0,
          cooldownReduction: 0,
          range: 1,
          spellPower: 0,
          thorns: 0,
          reflect: 0,
          slow: 0,
          stun: 0,
          passiveAttributes: []
        },
        isPaused: false,
        isGameOver: false,
        score: 0,
        seasonSeed: gameSeed
      }

      // 生成被动属性选择
      generatePassiveOptions()
    } catch (error) {
      console.error('启动游戏失败:', error)
    }
  }

  const pauseGame = () => {
    gameState.value.isPaused = !gameState.value.isPaused
  }

  const endGame = () => {
    gameState.value.isGameOver = true
    gameState.value.isPaused = true
    
    // 更新最高记录
    updateHighestRecords()
    
    console.log('游戏结束，当前分数:', gameState.value.score, '当前层数:', gameState.value.level)
  }

  // 保存当前游戏进度（用于退出游戏时保存）
  const saveCurrentProgress = async () => {
    const currentScore = gameState.value.score
    const currentLevel = gameState.value.level

    // 更新本地最高分数（如果当前分数更高）
    if (currentScore > highestScore.value) {
      highestScore.value = currentScore
    }

    // 更新本地最高层数（如果当前层数更高）
    if (currentLevel > highestLevel.value) {
      highestLevel.value = currentLevel
    }

    // 保存到本地存储
    saveRecordsToLocalStorage()
    
    // 保存到数据库（保存游戏会话，但只更新最高分到排行榜）
    try {
      await saveGameSessionToDatabase()
      console.log('✅ 退出游戏，已保存当前分数:', currentScore)
    } catch (error) {
      console.error('❌ 退出游戏时保存失败:', error)
    }
  }

  // 更新最高记录（用于游戏结束时）
  const updateHighestRecords = async () => {
    const currentScore = gameState.value.score
    const currentLevel = gameState.value.level
    const currentTime = gameState.value.timeRemaining

    // 更新最高分数
    if (currentScore > highestScore.value) {
      highestScore.value = currentScore
    }

    // 更新最高层数
    if (currentLevel > highestLevel.value) {
      highestLevel.value = currentLevel
    }

    // 更新最长存活时间
    if (currentTime > longestSurvival.value) {
      longestSurvival.value = currentTime
    }

    // 保存到本地存储
    saveRecordsToLocalStorage()
    
    // 保存到数据库（死亡时也保存，但只更新最高分到排行榜）
    try {
      await saveGameSessionToDatabase()
      console.log('✅ 游戏结束，已保存最高分数:', highestScore.value)
    } catch (error) {
      console.error('❌ 游戏结束时保存失败:', error)
    }
  }

  // 保存记录到本地存储
  const saveRecordsToLocalStorage = () => {
    const records = {
      highestScore: highestScore.value,
      highestLevel: highestLevel.value,
      longestSurvival: longestSurvival.value
    }
    localStorage.setItem('gameRecords', JSON.stringify(records))
  }

  // 从本地存储加载记录
  const loadRecordsFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('gameRecords')
      if (saved) {
        const records = JSON.parse(saved)
        highestScore.value = records.highestScore || 0
        highestLevel.value = records.highestLevel || 1
        longestSurvival.value = records.longestSurvival || 0
      }
    } catch (error) {
      console.error('加载游戏记录失败:', error)
    }
  }

  // 保存游戏会话到数据库
  const saveGameSessionToDatabase = async () => {
    try {
      // 获取当前用户ID（从认证系统获取）
      const { useAuthStore } = await import('./auth')
      const authStore = useAuthStore()
      
      if (!authStore.isAuthenticated || !authStore.user) {
        console.warn('用户未登录，无法保存游戏会话')
        return
      }
      
      const playerId = authStore.user.id
      
      // 计算总游戏时间（从开始到现在的秒数）
      const totalPlayTimeSeconds = gameStartTime.value > 0 
        ? (Date.now() - gameStartTime.value) / 1000 
        : 0
      
      // 构建游戏会话数据
      const sessionData = {
        playerId: playerId,
        level: gameState.value.level,
        score: gameState.value.score,
        time: totalPlayTimeSeconds,
        build: gameState.value.player.passiveAttributes
      }

      console.log('保存游戏会话到数据库:', sessionData)
      
      // 调用实际的数据库API
      const result = await gameData.submitGameResult(sessionData)
      
      if (result) {
        console.log('游戏会话保存成功，结果:', result)
        
        // 如果返回了排名，说明更新了排行榜
        if (result.rank !== null) {
          console.log('排行榜已更新')
        }
      } else {
        console.warn('游戏会话保存返回空结果')
      }
      
    } catch (error) {
      console.error('保存游戏会话失败:', error)
    }
  }

  // 被动属性选择
  const generatePassiveOptions = () => {
    // 使用当前层数和时间戳生成每层不同的随机选项
    // 这样每层的选项都会不同，每次重新开始游戏也会不同
    const levelSeed = `${gameState.value.seasonSeed}_level_${gameState.value.level}_${Date.now()}`
    const tempRng = new SeededRandom(levelSeed)
    const shuffled = tempRng.shuffle([...PASSIVE_ATTRIBUTES])
    availablePassives.value = shuffled.slice(0, 3)
  }

  const selectPassive = (passiveId: string) => {
    selectedPassive.value = passiveId
    console.log('选择被动属性:', passiveId)
  }

  // 选择Boss奖励（占位：UI集成后调用）
  const selectBossReward = (rewardId: string) => {
    selectedBossReward.value = rewardId
    console.log('选择Boss奖励:', rewardId)
  }

  const applyPassiveAttribute = (passiveId: string) => {
    const passive = PASSIVE_ATTRIBUTES.find(p => p.id === passiveId)
    if (!passive) return

    const player = gameState.value.player
    player.passiveAttributes.push(passiveId)

    // 应用被动效果
    switch (passiveId) {
      case 'attack_speed':
        player.attackSpeed *= (1 + passive.value)
        break
      case 'damage':
        player.damage *= (1 + passive.value)
        break
      case 'crit_chance':
        player.critChance += passive.value
        break
      case 'projectiles':
        player.projectiles += passive.value
        break
      case 'pierce':
        player.pierce += passive.value
        break
      case 'regeneration':
        player.regeneration += passive.value
        break
      case 'max_health':
        player.maxHealth += passive.value
        player.health += passive.value
        break
      case 'move_speed':
        player.moveSpeed *= (1 + passive.value)
        break
      case 'lifesteal':
        player.lifesteal += passive.value
        break
    }
  }

  // 进入下一层
  const nextLevel = () => {
    // **关键修复**：进入下一层（保留上一层用于Boss判断）
    // 从 gameState.level 读取 previousLevel（此时应该是旧关卡值，由引擎在回调前同步）
    const previousLevel = gameState.value.level
    
    // **修复**：不要直接递增 level！
    // 因为引擎已经将 currentLevel 递增了，并且会在回调后同步 gameState.level
    // 如果我们这里也递增，会导致关卡号被错误地增加两次
    // gameState.value.level 会在引擎回调后被正确同步为 newLevel
    // 所以这里不需要修改 level，只记录 previousLevel 用于Boss判断
    
    // 血量回满
    gameState.value.player.health = gameState.value.player.maxHealth
    
    // 重置时间
    gameState.value.timeRemaining = 30
    
    // 清空敌人和投射物
    gameState.value.enemies = []
    gameState.value.projectiles = []
    
    // 检查是否完成了商店层（3, 6, 9, 12, 15, 18, 21, 24, 27, 30...）
    // 设计要求是在通关这些层数后进入商店
    const clearedLevel = previousLevel
    const isShopLevel = clearedLevel > 0 && clearedLevel % 3 === 0
    if (isShopLevel) {
      const nextLayer = clearedLevel + 1
      
      // 确定下一层商店应该有多少个槽位
      // 所有层都是4个
      const targetShopCount = 4
      
      // 保留锁定的道具（除非已被购买，即槽位为null）
      // **关键修复**：必须检查所有槽位，不能只检查前 targetShopCount 个，否则会丢失超出范围的锁定道具
      const lockedItems: Array<(GeneratedReward & { locked: boolean }) | null> = []
      const lockedItemIds: string[] = []
      const lockedItemPositions: number[] = [] // 记录锁定道具的原始位置
      
      // **关键修复**：检查所有槽位，收集所有锁定的道具（无论位置）
      for (let i = 0; i < availableShopItems.value.length; i++) {
        const item = availableShopItems.value[i]
        if (item && item.option && item.locked) {
          // 记录锁定道具及其位置
          lockedItems.push({ ...item })
          lockedItemPositions.push(i)
          lockedItemIds.push(item.option.id)
        }
      }
      
      // 计算需要生成的新道具数量
      const lockedCount = lockedItemIds.length
      const newItemCount = targetShopCount - lockedCount
      
      // 生成新道具，排除锁定的道具ID
      const ctxBase: RewardContext = {
        layer: nextLayer,
        playerStats: {
          damage: gameState.value.player.damage,
          attackSpeed: gameState.value.player.attackSpeed,
          critChance: gameState.value.player.critChance,
          projectiles: gameState.value.player.projectiles,
          pierce: gameState.value.player.pierce,
          moveSpeed: gameState.value.player.moveSpeed
        },
        recentOfferedIds: lockedItemIds
      }
      
      // 生成新道具
      let newShopRewards = generateShopRewards(nextLayer, ctxBase)
        .filter((item): item is GeneratedReward => !!item && !!item.option)
        .map(item => ({
          ...item,
          locked: false
        }))
      
      // 如果生成的道具数量不足，补充生成
      const refreshedIds = new Set<string>(lockedItemIds)
      newShopRewards.forEach(item => refreshedIds.add(item.option.id))
      
      // **关键修复**：如果生成的道具数量不足，补充生成（带重试机制）
      let supplementAttempts = 0
      const maxSupplementAttempts = 50 // 最多尝试50次
      while (newShopRewards.length < newItemCount && supplementAttempts < maxSupplementAttempts) {
        supplementAttempts++
        // 根据层数随机生成品质
        const rand = Math.random()
        let quality: 'green' | 'blue' | 'purple' | 'gold' = 'green'
        if (nextLayer >= 51) {
          if (rand < 0.15) quality = 'blue'
          else if (rand < 0.75) quality = 'purple'
          else quality = 'gold'
        } else if (nextLayer >= 41) {
          if (rand < 0.05) quality = 'green'
          else if (rand < 0.25) quality = 'blue'
          else if (rand < 0.80) quality = 'purple'
          else quality = 'gold'
        } else if (nextLayer >= 31) {
          if (rand < 0.10) quality = 'green'
          else if (rand < 0.35) quality = 'blue'
          else if (rand < 0.85) quality = 'purple'
          else quality = 'gold'
        } else if (nextLayer >= 21) {
          if (rand < 0.15) quality = 'green'
          else if (rand < 0.50) quality = 'blue'
          else if (rand < 0.90) quality = 'purple'
          else quality = 'gold'
        } else if (nextLayer >= 16) {
          if (rand < 0.25) quality = 'green'
          else if (rand < 0.65) quality = 'blue'
          else if (rand < 0.95) quality = 'purple'
          else quality = 'gold'
        } else if (nextLayer >= 11) {
          if (rand < 0.40) quality = 'green'
          else if (rand < 0.85) quality = 'blue'
          else if (rand < 0.98) quality = 'purple'
          else quality = 'gold'
        } else if (nextLayer >= 6) {
          if (rand < 0.65) quality = 'green'
          else if (rand < 0.95) quality = 'blue'
          else if (rand < 0.99) quality = 'purple'
          else quality = 'gold'
        } else {
          // 1-5层：所有品质都有概率，但绿色概率最高
          if (rand < 0.75) quality = 'green'
          else if (rand < 0.95) quality = 'blue'
          else if (rand < 0.99) quality = 'purple'
          else quality = 'gold'
        }
        
        // 尝试生成道具，如果失败则尝试其他品质
        let newItem = generateShopItemByQuality(quality, nextLayer, {
          ...ctxBase,
          recentOfferedIds: Array.from(refreshedIds)
        })
        
        // 如果生成失败，尝试其他品质（按优先级：绿色 -> 蓝色 -> 紫色 -> 金色）
        if (!newItem || !newItem.option) {
          const fallbackQualities: Array<'green' | 'blue' | 'purple' | 'gold'> = ['green', 'blue', 'purple', 'gold']
          for (const fallbackQuality of fallbackQualities) {
            if (fallbackQuality === quality) continue // 跳过已经尝试过的品质
            newItem = generateShopItemByQuality(fallbackQuality, nextLayer, {
              ...ctxBase,
              recentOfferedIds: Array.from(refreshedIds)
            })
            if (newItem && newItem.option) {
              break
            }
          }
        }
        
        if (newItem && newItem.option) {
          newShopRewards.push({ ...newItem, locked: false })
          refreshedIds.add(newItem.option.id)
        }
        // 如果所有品质都失败，继续循环尝试（最多50次）
      }
      
      // **关键修复**：如果补充生成后仍不足，强制生成到4个（确保总是有4个槽位）
      if (newShopRewards.length < newItemCount) {
        console.warn(`[nextLevel] 警告：补充生成后仍不足，需要${newItemCount}个，实际${newShopRewards.length}个，强制生成到${newItemCount}个`)
        // 强制从绿色池生成剩余的道具
        const greenPool = ATTRIBUTE_REWARDS.filter(r => r.color === 'green')
        const mult = getTierMultiplier(nextLayer)
        while (newShopRewards.length < newItemCount && greenPool.length > 0) {
          // 随机选择一个绿色道具，不排除任何ID（确保能生成）
          const randomGreen = greenPool[Math.floor(Math.random() * greenPool.length)]
          if (randomGreen) {
            // 计算scaledValue（类似pickTierValue的逻辑）
            let scaledValue: number | undefined = undefined
            if (randomGreen.tiers && randomGreen.tiers.length > 0) {
              let idx = 0
              if (nextLayer >= 20) idx = randomGreen.tiers.length - 1
              else if (nextLayer >= 15) idx = Math.min(randomGreen.tiers.length - 1, Math.ceil(randomGreen.tiers.length * 0.67) - 1)
              else if (nextLayer >= 10) idx = Math.min(randomGreen.tiers.length - 1, Math.ceil(randomGreen.tiers.length * 0.34) - 1)
              else idx = 0
              const base = randomGreen.tiers[idx]
              scaledValue = typeof base === 'number' ? base * mult : undefined
            } else if (typeof randomGreen.baseValue === 'number') {
              scaledValue = randomGreen.baseValue * mult
            }
            
            const forcedItem: GeneratedReward = {
              option: randomGreen,
              scaledValue
            }
            newShopRewards.push({ ...forcedItem, locked: false })
            refreshedIds.add(randomGreen.id)
          } else {
            break // 如果绿色池为空，退出循环
          }
        }
      }
      
      // 只取需要的数量（确保不超过目标数量）
      newShopRewards = newShopRewards.slice(0, newItemCount)
      
      // **关键修复**：合并锁定的道具和新生成的道具
      // 确保锁定的道具始终保持在原位置（如果原位置在范围内），否则移到前面
      const newShopItems: Array<(GeneratedReward & { locked: boolean }) | null> = []
      
      // 初始化数组
      for (let i = 0; i < targetShopCount; i++) {
        newShopItems.push(null)
      }
      
      // **关键修复**：首先放置所有锁定道具
      // 1. 如果锁定道具的原位置在 targetShopCount 范围内，尽量保持在原位置
      // 2. 如果原位置超出范围，或者原位置已被占用，则放到前面的空位置
      const usedPositions = new Set<number>()
      const lockedItemsToPlace: Array<{ item: GeneratedReward & { locked: boolean }, originalPos: number }> = []
      
      // 收集所有需要放置的锁定道具
      lockedItemPositions.forEach((originalPos, idx) => {
        lockedItemsToPlace.push({
          item: lockedItems[idx]!,
          originalPos
        })
      })
      
      // 按原位置排序，优先保持原位置
      lockedItemsToPlace.sort((a, b) => a.originalPos - b.originalPos)
      
      // 先尝试将锁定道具放在原位置（如果原位置在范围内且未被占用）
      const placedLockedItems = new Set<number>() // 跟踪已放置的锁定道具的索引
      for (let idx = 0; idx < lockedItemsToPlace.length; idx++) {
        const { item, originalPos } = lockedItemsToPlace[idx]
        if (originalPos < targetShopCount && !usedPositions.has(originalPos)) {
          newShopItems[originalPos] = { ...item, locked: true }
          usedPositions.add(originalPos)
          placedLockedItems.add(idx)
        }
      }
      
      // 将剩余未放置的锁定道具放到前面的空位置
      for (let idx = 0; idx < lockedItemsToPlace.length; idx++) {
        if (placedLockedItems.has(idx)) continue // 已经放置过了
        
        const { item } = lockedItemsToPlace[idx]
        // 找到第一个空位置
        for (let i = 0; i < targetShopCount; i++) {
          if (!usedPositions.has(i)) {
            newShopItems[i] = { ...item, locked: true }
            usedPositions.add(i)
            placedLockedItems.add(idx)
            break
          }
        }
      }
      
      // 填充剩余空槽位（用新生成的道具）
      let newItemIndex = 0
      for (let i = 0; i < targetShopCount; i++) {
        if (!usedPositions.has(i) && newItemIndex < newShopRewards.length) {
          newShopItems[i] = newShopRewards[newItemIndex]
          newItemIndex++
        }
      }
      
      // **关键修复**：确保 newShopItems 数组长度始终是 targetShopCount
      if (newShopItems.length !== targetShopCount) {
        console.warn(`[nextLevel] 警告：newShopItems.length=${newShopItems.length}，应该是${targetShopCount}，正在修复`)
        while (newShopItems.length < targetShopCount) {
          newShopItems.push(null)
        }
        if (newShopItems.length > targetShopCount) {
          // 截断数组（从末尾删除多余元素）
          newShopItems.splice(targetShopCount)
        }
      }
      
      availableShopItems.value = newShopItems
      console.log(`[nextLevel] 填充前：newShopItems.length=${newShopItems.length}, newShopRewards.length=${newShopRewards.length}, lockedCount=${lockedCount}, targetShopCount=${targetShopCount}, newItemCount=${newItemCount}`)
      
      sanitizeShopItems()
      console.log(`[nextLevel] sanitize后：availableShopItems.value.length=${availableShopItems.value.length}`)
      
      // **关键修复**：确保商店总是有足够的槽位（固定4个）
      const finalTargetCount = 4
      // 如果长度不足，补充null槽位
      if (availableShopItems.value.length < finalTargetCount) {
        const currentLength = availableShopItems.value.length
        for (let i = currentLength; i < finalTargetCount; i++) {
          availableShopItems.value.push(null)
        }
        console.log(`[nextLevel] 补充槽位：从${currentLength}个补充到${finalTargetCount}个`)
      }
      // 如果超出目标数量，截断（不应该发生，但安全起见）
      if (availableShopItems.value.length > finalTargetCount) {
        availableShopItems.value = availableShopItems.value.slice(0, finalTargetCount)
        console.log(`[nextLevel] 截断槽位：从${availableShopItems.value.length}个截断到${finalTargetCount}个`)
      }
      console.log(`[nextLevel] 最终：availableShopItems.value.length=${availableShopItems.value.length}`)
      
      // 进入商店时重置刷新费用（可按层数递增基础费用）
      shopRefreshCost.value = 20 + Math.floor((nextLayer - 1) / 3) * 5
      showShop.value = true
      gameState.value.isPaused = true
      console.log(`[nextLevel] 商店层（通关第${clearedLevel}层后），保留 ${lockedCount} 个锁定道具，生成 ${newShopRewards.length} 个新道具，下一层：${nextLayer}，商店槽位：${availableShopItems.value.length}`)
    } else {
      showShop.value = false
    }
    
    // **关键修复**：检查是否有Boss被击败（不再限制为特定层，只要击败Boss就有奖励）
    // 通过检查bossDefeated标志来判断是否有Boss被击败
    const bossDefeatedValue = gameState.value.bossDefeated
    const bossWasDefeated = bossDefeatedValue === previousLevel && bossDefeatedValue !== undefined
    
    // **关键修复**：所有Boss层都应该有奖励（每5层一个Boss层：5、10、15、20、25、30...）
    const isBossLevel = (previousLevel % 5 === 0) || bossWasDefeated
    
    console.log(`[nextLevel] Boss奖励检查：isBossLevel=${isBossLevel}, previousLevel=${previousLevel}, bossDefeated=${bossDefeatedValue}, bossWasDefeated=${bossWasDefeated}`)
    console.log(`[nextLevel] 当前availableBossRewards.length = ${availableBossRewards.value.length}`)
    
    if (bossWasDefeated) {
      // **关键修复**：所有Boss被击败后都应该生成奖励
      // 只有真正击杀了Boss，才生成Boss奖励
      // **修复**：生成完整的奖励池，然后随机选择3个
      console.log(`[nextLevel] ✅ 开始生成Boss奖励，层数：${previousLevel}, bossDefeated=${bossDefeatedValue}`)
      
      // **关键修复**：确保在生成奖励前，bossDefeated标志仍然存在
      if (!gameState.value.bossDefeated || gameState.value.bossDefeated !== previousLevel) {
        console.error(`[nextLevel] ❌ 警告：bossDefeated标志丢失！期望=${previousLevel}, 实际=${gameState.value.bossDefeated}`)
        // 尝试恢复标志
        gameState.value.bossDefeated = previousLevel
        if ((gameState.value as any).hasDefeatedBoss !== undefined) {
          (gameState.value as any).hasDefeatedBoss = true
        }
      }
      
      const rewards = generateBossRewards(previousLevel, {
        layer: previousLevel,
        playerStats: {
          damage: gameState.value.player.damage,
          attackSpeed: gameState.value.player.attackSpeed,
          critChance: gameState.value.player.critChance,
          projectiles: gameState.value.player.projectiles,
          pierce: gameState.value.player.pierce,
          moveSpeed: gameState.value.player.moveSpeed,
        },
        recentOfferedIds: [],
      })
      
      console.log(`[nextLevel] 生成了 ${rewards.length} 个奖励选项`)
      
      // **验证**：确保所有奖励都是传说品质（金色）
      const nonGoldRewards = rewards.filter(r => r.option.color !== 'gold')
      if (nonGoldRewards.length > 0) {
        console.error(`[nextLevel] ❌ 错误：发现非传说品质的Boss奖励！`, nonGoldRewards.map(r => ({ id: r.option.id, name: r.option.name, color: r.option.color })))
      } else {
        console.log(`[nextLevel] ✅ 所有Boss奖励都是传说品质（金色）`)
      }
      
      // 从生成的奖励池中随机选择3个（使用种子随机数确保可复现性）
      const allOptions = rewards.map(r => r.option)
      
      // 使用SeededRandom进行Fisher-Yates洗牌，确保可复现
      const rng = getSeededRandom()
      const shuffled = [...allOptions]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      
      // 从打乱后的池子中选择前3个（确保至少有3个选项）
      const selectCount = Math.min(3, shuffled.length)
      availableBossRewards.value = shuffled.slice(0, selectCount)
      selectedBossReward.value = null
      console.log(`[nextLevel] ✅ 第${previousLevel}层Boss被击败，生成奖励池：${rewards.length}个选项，随机选择${selectCount}个供玩家选择：`, availableBossRewards.value.map(r => `${r.name}(${r.color})`))
      console.log(`[nextLevel] availableBossRewards.value.length = ${availableBossRewards.value.length}`)
      
      // **验证**：确保最终选择的奖励都是传说品质
      const finalNonGold = availableBossRewards.value.filter(r => r.color !== 'gold')
      if (finalNonGold.length > 0) {
        console.error(`[nextLevel] ❌ 错误：最终选择的Boss奖励中包含非传说品质！`, finalNonGold.map(r => ({ id: r.id, name: r.name, color: r.color })))
      }
      // 暂停游戏以等待选择（在本层结束后显示）
      gameState.value.isPaused = true
    } else {
      // 未击杀Boss或非Boss层，清空Boss奖励
      if (isBossLevel && !bossWasDefeated) {
        console.log(`[nextLevel] ⚠️ Boss层(${previousLevel})未击杀Boss（时间到或bossDefeated=${bossDefeatedValue} !== ${previousLevel}），不生成Boss奖励`)
      } else {
        console.log(`[nextLevel] 第${previousLevel}层未击败Boss，清空Boss奖励`)
      }
      availableBossRewards.value = []
      selectedBossReward.value = null
    }
    
    // **关键修复**：只有在Boss奖励已处理完毕（已选择或非Boss层）时才生成被动属性
    // 如果Boss层成功击杀Boss，应该先显示Boss奖励，等玩家选择后再生成被动属性
    const shouldGeneratePassives = !isShopLevel && (!isBossLevel || !bossWasDefeated)

    if (shouldGeneratePassives) {
      // 非Boss层或未击杀Boss，正常生成被动属性选择
      generatePassiveOptions()
      selectedPassive.value = null
    } else {
      if (isBossLevel && bossWasDefeated) {
        // Boss层且成功击杀Boss，暂不生成被动属性，等待玩家选择Boss奖励
        // Boss奖励选择后，会在confirmBossRewardSelection中生成被动属性
        console.log(`[nextLevel] Boss层成功击杀Boss，暂不生成被动属性，等待Boss奖励选择`)
        availablePassives.value = [] // 清空被动属性，避免显示冲突
        selectedPassive.value = null
      } else if (isShopLevel) {
        console.log('[nextLevel] 商店层，暂停被动属性选择')
        availablePassives.value = []
        selectedPassive.value = null
      }
    }
    
    console.log('进入第', gameState.value.level, '层，血量回满，分数累积')
    console.log(`[nextLevel] 最终状态：availableBossRewards.length=${availableBossRewards.value.length}, availablePassives.length=${availablePassives.value.length}`)
    
    // **关键修复**：只有在确认不需要Boss奖励时才重置bossDefeated标记
    // 如果Boss被击败且有奖励，不要立即重置，让玩家选择后再重置（在confirmBossRewardSelection中重置）
    if (!bossWasDefeated) {
      // 未击杀Boss，立即重置
      console.log(`[nextLevel] 未击杀Boss，重置bossDefeated标记`)
      gameState.value.bossDefeated = undefined
    } else if (bossWasDefeated && availableBossRewards.value.length > 0) {
      // Boss奖励已生成，暂不重置，等待玩家选择
      console.log(`[nextLevel] ✅ Boss奖励已生成(${availableBossRewards.value.length}个选项)，保留bossDefeated=${gameState.value.bossDefeated}，等待玩家选择`)
    } else if (bossWasDefeated && availableBossRewards.value.length === 0) {
      // **关键修复**：Boss被击败但奖励生成失败，记录错误但不重置标志（保留以便调试）
      console.error(`[nextLevel] ❌ Boss被击败但奖励生成失败！bossDefeated=${gameState.value.bossDefeated}, rewards.length=0，保留标志以便调试`)
      // 不重置标志，让玩家知道有问题，或者尝试重新生成
    }
  }

  // 确认被动选择
  const confirmPassiveSelection = () => {
    if (selectedPassive.value) {
      console.log('确认选择被动属性:', selectedPassive.value)
      console.log('选择前的玩家属性:', {
        attackSpeed: gameState.value.player.attackSpeed,
        damage: gameState.value.player.damage,
        critChance: gameState.value.player.critChance,
        projectiles: gameState.value.player.projectiles,
        pierce: gameState.value.player.pierce,
        maxHealth: gameState.value.player.maxHealth,
        lifesteal: gameState.value.player.lifesteal
      })
      applyPassiveAttribute(selectedPassive.value)
      console.log('选择后的玩家属性:', {
        attackSpeed: gameState.value.player.attackSpeed,
        damage: gameState.value.player.damage,
        critChance: gameState.value.player.critChance,
        projectiles: gameState.value.player.projectiles,
        pierce: gameState.value.player.pierce,
        maxHealth: gameState.value.player.maxHealth,
        lifesteal: gameState.value.player.lifesteal
      })
      selectedPassive.value = null
      availablePassives.value = []
      
      // 第九层特殊处理：自动选择第十和十一层的属性
      if (gameState.value.level === 9) {
        // 生成第十层的被动选择
        generatePassiveOptions()
        const passive10 = availablePassives.value[0] // 自动选择第一个
        if (passive10) {
          applyPassiveAttribute(passive10.id)
        }
        
        // 生成第十一层的被动选择
        generatePassiveOptions()
        const passive11 = availablePassives.value[0] // 自动选择第一个
        if (passive11) {
          applyPassiveAttribute(passive11.id)
        }
        
        availablePassives.value = []
      }
      
      // 继续游戏（如果不是死亡）
      if (!gameState.value.isGameOver) {
        gameState.value.isPaused = false
      }
      console.log('被动属性应用完成')
    }
  }

  // 确认Boss奖励选择并应用效果
  const confirmBossRewardSelection = () => {
    if (selectedBossReward.value) {
      const rewardId = selectedBossReward.value
      console.log('确认选择Boss奖励:', rewardId)
      console.log(`[confirmBossRewardSelection] 当前availableBossRewards.length = ${availableBossRewards.value.length}`)
      
      // 找到选中的奖励选项
      const reward = availableBossRewards.value.find(r => r.id === rewardId)
      if (reward) {
        // 根据effectKey应用效果
        const effectKey = reward.effectKey
        const tierMultiplier = getTierMultiplier(gameState.value.level)
        const finalValue = reward.tiers 
          ? reward.tiers[Math.min(Math.floor(gameState.value.level / 5) - 1, reward.tiers.length - 1)] * tierMultiplier
          : (reward.baseValue || 0) * tierMultiplier

        // 1. 属性奖励（attribute）
        if (reward.category === 'attribute') {
          if (effectKey.startsWith('damage_pct') || effectKey === 'all_damage_pct') {
            gameState.value.player.damage *= (1 + finalValue)
          } else if (effectKey.startsWith('attack_speed_pct')) {
            gameState.value.player.attackSpeed *= (1 + finalValue)
          } else if (effectKey.startsWith('crit_chance_add')) {
            gameState.value.player.critChance += finalValue
          } else if (effectKey.startsWith('crit_damage_add')) {
            (gameState.value.player as any).critDamage = ((gameState.value.player as any).critDamage || 2) + finalValue
          } else if (effectKey.startsWith('projectiles_add')) {
            gameState.value.player.projectiles += Math.floor(finalValue)
          } else if (effectKey.startsWith('pierce_add')) {
            gameState.value.player.pierce = (gameState.value.player.pierce || 0) + Math.floor(finalValue)
          } else if (effectKey.startsWith('move_speed_pct')) {
            gameState.value.player.moveSpeed *= (1 + finalValue)
          } else if (effectKey.startsWith('lifesteal_add')) {
            gameState.value.player.lifesteal = (gameState.value.player.lifesteal || 0) + finalValue
          } else if (effectKey.startsWith('regeneration_add')) {
            gameState.value.player.regeneration = (gameState.value.player.regeneration || 0) + Math.floor(finalValue)
          } else if (effectKey.startsWith('max_health_add')) {
            const added = Math.floor(finalValue)
            gameState.value.player.maxHealth += added
            gameState.value.player.health += added
          } else if (effectKey === 'elite_damage_pct') {
            (gameState.value.player as any).eliteDamageBonus = ((gameState.value.player as any).eliteDamageBonus || 0) + finalValue
          } else if (effectKey === 'boss_damage_pct') {
            (gameState.value.player as any).bossDamageBonus = ((gameState.value.player as any).bossDamageBonus || 0) + finalValue
          } else if (effectKey === 'aoe_radius_pct') {
            (gameState.value.player as any).aoeRadiusBonus = ((gameState.value.player as any).aoeRadiusBonus || 0) + finalValue
          }
        }
        // 2. 特殊效果奖励（special）- 记录到玩家状态，由引擎处理
        else if (reward.category === 'special') {
          // 初始化特殊效果列表（如果不存在）
          if (!(gameState.value.player as any).specialEffects) {
            ;(gameState.value.player as any).specialEffects = []
          }
          ;(gameState.value.player as any).specialEffects.push(effectKey)
          
          // 一些特殊效果可以直接应用属性
          if (effectKey === 'on_kill_heal_orb') {
            ;(gameState.value.player as any).healOrbOnKill = true
          } else if (effectKey === 'low_hp_damage_reduction') {
            ;(gameState.value.player as any).lowHpDamageReduction = true
          }
          // 已删除的特殊效果：
          // - auto_collect（自动拾取）：当前掉落物只有治疗球，用处不大
          // - periodic_purge（净化）：敌人不会附加负面效果，没有作用
        }
        // 3. 传说奖励（legendary，Boss层专属，最高品质）
        else if (reward.category === 'legendary') {
          // 所有传说奖励的特殊效果处理
          if (effectKey === 'dual_special_proc') {
            ;(gameState.value.player as any).dualSpecialProc = true
          } else if (effectKey === 'pierce_plus_damage') {
            // 重装弹药：穿透+1，伤害+10%
            gameState.value.player.pierce = (gameState.value.player.pierce || 0) + 1
            gameState.value.player.damage *= 1.1
          } else if (effectKey === 'move_speed_phasing') {
            // 敏捷身法：移速+25%，无视单位碰撞
            gameState.value.player.moveSpeed *= (1 + finalValue)
            ;(gameState.value.player as any).phasing = true
          } else if (effectKey === 'crit_and_elite_critdmg') {
            // 暗影洞察：暴击率+15%，对精英暴伤+50%
            gameState.value.player.critChance += 0.15
            ;(gameState.value.player as any).eliteCritDamage = ((gameState.value.player as any).eliteCritDamage || 1.0) + 0.5
          } else if (effectKey === 'all_stats_and_cc_immunity') {
            // 混沌适应：免疫控制，所有属性+10%
            gameState.value.player.damage *= 1.1
            gameState.value.player.attackSpeed *= 1.1
            gameState.value.player.critChance += 0.1
            gameState.value.player.moveSpeed *= 1.1
            ;(gameState.value.player as any).ccImmunity = true
          } else if (effectKey === 'dual_weapon_modes') {
            // 形态大师：初始化武器模式（默认模式0：高伤害）
            if (!(gameState.value.player as any).bossExclusiveEffects) {
              ;(gameState.value.player as any).bossExclusiveEffects = []
            }
            ;(gameState.value.player as any).bossExclusiveEffects.push(effectKey)
            // 保存原始属性值
            const player = gameState.value.player as any
            player.baseDamage = player.damage || 10
            player.baseAttackSpeed = player.attackSpeed || 1.0
            player.weaponMode = 0 // 默认高伤害模式
            // 应用默认模式（高伤害）
            player.damage = player.baseDamage * 1.5
            player.attackSpeed = player.baseAttackSpeed * 0.7
            console.log('✅ 形态大师已激活，按Q或Tab键切换武器模式（当前：高伤害模式）')
          } else {
            // 初始化Boss专属效果列表（如果不存在）
            if (!(gameState.value.player as any).bossExclusiveEffects) {
              ;(gameState.value.player as any).bossExclusiveEffects = []
            }
            ;(gameState.value.player as any).bossExclusiveEffects.push(effectKey)
            
            // 记录数值（如果需要）
            if (finalValue > 0) {
              ;(gameState.value.player as any)[`boss_effect_${effectKey}`] = finalValue
            }
          }
        }
        
        // 5. 应用Debuff（负面效果）
        if (reward.debuff) {
          const debuff = reward.debuff
          switch (debuff.type) {
            case 'damage_reduction':
              // 伤害减免降低（当前未实现伤害减免系统，可留作扩展）
              console.log(`[Debuff] 伤害减免降低: ${debuff.description}`)
              break
            case 'move_speed_reduction':
              // 移动速度降低
              gameState.value.player.moveSpeed *= (1 - debuff.value)
              console.log(`[Debuff] 移动速度降低: ${debuff.description}`)
              break
            case 'health_reduction':
              // 最大生命降低（固定值）
              const healthReduction = Math.floor(debuff.value) // value是固定值，直接使用
              gameState.value.player.maxHealth -= healthReduction
              gameState.value.player.maxHealth = Math.max(1, gameState.value.player.maxHealth) // 确保最小生命值为1
              gameState.value.player.health = Math.min(gameState.value.player.health, gameState.value.player.maxHealth)
              console.log(`[Debuff] 最大生命降低: ${debuff.description} (减少${healthReduction}点生命)`)
              break
            case 'attack_speed_reduction':
              // 攻击速度降低
              gameState.value.player.attackSpeed *= (1 - debuff.value)
              console.log(`[Debuff] 攻击速度降低: ${debuff.description}`)
              break
            case 'crit_chance_reduction':
              // 暴击率降低
              gameState.value.player.critChance = Math.max(0, gameState.value.player.critChance - debuff.value)
              console.log(`[Debuff] 暴击率降低: ${debuff.description}`)
              break
            case 'increased_damage_taken':
              // 受到伤害增加（记录到玩家状态，由游戏引擎在计算伤害时应用）
              if (!(gameState.value.player as any).damageTakenMultiplier) {
                ;(gameState.value.player as any).damageTakenMultiplier = 1.0
              }
              ;(gameState.value.player as any).damageTakenMultiplier += debuff.value
              console.log(`[Debuff] 受到伤害增加: ${debuff.description} (当前倍率: ${(gameState.value.player as any).damageTakenMultiplier})`)
              break
          }
        }
        
        // 所有奖励都记录到被动属性列表（用于UI显示）
        gameState.value.player.passiveAttributes.push(rewardId)
        
        // **新增**：触发获得道具的特效反馈（通过游戏引擎）
        const engine = (gameState.value as any).gameEngine
        if (engine && typeof engine.onItemAcquired === 'function') {
          engine.onItemAcquired(reward)
        }
        
        console.log('✅ Boss奖励应用完成，准备生成被动属性选择')
        
        // **关键修复**：Boss奖励选择后，生成被动属性选择（因为Boss层后应该还有被动属性选择）
        generatePassiveOptions()
        selectedPassive.value = null
        console.log(`[confirmBossRewardSelection] 已生成被动属性选择，availablePassives.length=${availablePassives.value.length}`)
      } else {
        console.error('未找到选中的Boss奖励:', rewardId)
      }
      
      // **关键修复**：清空Boss奖励选择（在生成被动属性后）
      selectedBossReward.value = null
      availableBossRewards.value = []
      
      // **关键修复**：Boss奖励选择后，重置bossDefeated标记
      gameState.value.bossDefeated = undefined
      console.log(`[confirmBossRewardSelection] 已重置bossDefeated标记`)
      
      // 继续游戏（如果不是死亡）
      if (!gameState.value.isGameOver) {
        gameState.value.isPaused = false
      }
      console.log('Boss奖励应用完成，当前属性:', {
        damage: gameState.value.player.damage,
        attackSpeed: gameState.value.player.attackSpeed,
        weaponMode: (gameState.value.player as any).weaponMode,
        specialEffects: (gameState.value.player as any).specialEffects,
        bossExclusiveEffects: (gameState.value.player as any).bossExclusiveEffects
      })
    } else {
      console.error('confirmBossRewardSelection: selectedBossReward.value 为空')
    }
  }

  // 更新玩家位置
  const updatePlayerPosition = (x: number, y: number) => {
    gameState.value.player.position.x = x
    gameState.value.player.position.y = y
  }

  // 更新玩家生命值
  const updatePlayerHealth = (health: number) => {
    gameState.value.player.health = Math.max(0, Math.min(health, gameState.value.player.maxHealth))
    if (gameState.value.player.health <= 0) {
      endGame()
    }
  }

  // 添加敌人
  const addEnemy = (enemy: any) => {
    gameState.value.enemies.push(enemy)
  }

  // 移除敌人
  const removeEnemy = (enemyId: string) => {
    const index = gameState.value.enemies.findIndex(e => e.id === enemyId)
    if (index > -1) {
      gameState.value.enemies.splice(index, 1)
    }
  }

  // 添加投射物
  const addProjectile = (projectile: any) => {
    gameState.value.projectiles.push(projectile)
  }

  // 移除投射物
  const removeProjectile = (projectileId: string) => {
    const index = gameState.value.projectiles.findIndex(p => p.id === projectileId)
    if (index > -1) {
      gameState.value.projectiles.splice(index, 1)
    }
  }

  // 更新分数
  const updateScore = (points: number) => {
    gameState.value.score += points
    // 击败敌人获得的金币与分数一致
    gameState.value.player.gold = (gameState.value.player.gold || 0) + points
  }

  // 更新剩余时间
  const updateTimeRemaining = (time: number) => {
    gameState.value.timeRemaining = time
    // 时间到0时的处理由TestGameEngine负责，这里不再重复处理
  }

  // **关键修复**：添加保存时间戳，用于延迟保存
  const _lastSaveTime = ref<number>(0)

  // **修复**：移除watch监听，改为在nextLevel()时生成Boss奖励
  // 这样Boss奖励会在本层结束后显示，而不是Boss死亡时立即显示

  // 商店相关方法
  const buyShopItem = (item: (GeneratedReward & { locked?: boolean }) | null | undefined, index: number) => {
    console.log(`buyShopItem 被调用，索引: ${index}`, item)
    if (!item || !item.option) {
      console.warn('购买道具失败：道具或选项为空')
      return
    }
    // 验证索引有效性
    if (index < 0 || index >= availableShopItems.value.length) {
      console.error(`无效的商店索引: ${index}`)
      return
    }
    // 验证该索引位置的道具是否匹配
    const slotItem = availableShopItems.value[index]
    if (!slotItem || !slotItem.option || slotItem.option.id !== item.option.id) {
      console.error(`索引 ${index} 处的道具不匹配`, { slotItem, item })
      return
    }
    const price = calculateShopPrice(item.option.color, gameState.value.level)
    console.log(`道具价格: ${price}，当前金币: ${gameState.value.player.gold}`)
    if (gameState.value.player.gold >= price) {
      gameState.value.player.gold -= price
      // 应用道具效果（类似Boss奖励）
      applyRewardEffect(item.option, item.scaledValue)
      // 记录为已获得的道具，用于"已获得的道具加成"显示
      gameState.value.player.passiveAttributes.push(item.option.id)
      // 从商店中移除（使用索引直接更新）
      const newItems = [...availableShopItems.value]
      newItems[index] = null
      
      // **关键修复**：确保购买后商店始终有4个槽位
      const targetCount = 4
      while (newItems.length < targetCount) {
        newItems.push(null)
      }
      if (newItems.length > targetCount) {
        newItems.splice(targetCount)
      }
      
      availableShopItems.value = newItems
      
      // **新增**：触发获得道具的特效反馈（通过游戏引擎）
      const engine = (gameState.value as any).gameEngine
      if (engine && typeof engine.onItemAcquired === 'function') {
        engine.onItemAcquired(item.option)
      }
      
      console.log(`购买道具: ${item.option.name}，花费 ${price} 金币，槽位 ${index} 已清空，当前槽位数量: ${availableShopItems.value.length}`)
    } else {
      console.warn(`金币不足：需要 ${price}，当前只有 ${gameState.value.player.gold}`)
    }
  }

  const closeShop = () => {
    showShop.value = false
    gameState.value.isPaused = false
  }

  const toggleShopItemLock = (index: number) => {
    console.log(`toggleShopItemLock 被调用，索引: ${index}`)
    if (index < 0 || index >= availableShopItems.value.length) {
      console.error(`无效的商店索引: ${index}`)
      return
    }
    const item = availableShopItems.value[index]
    if (!item || !item.option) {
      console.warn(`索引 ${index} 处没有道具`)
      return
    }
    // 使用数组拷贝方式更新，确保触发响应式更新
    const newItems = [...availableShopItems.value]
    newItems[index] = { ...item, locked: !item.locked }
    availableShopItems.value = newItems
    console.log(`道具 ${item.option.name} 锁定状态已切换为: ${!item.locked}`)
  }

  const refreshAllShopItems = () => {
    const cost = shopRefreshCost.value
    if ((gameState.value.player.gold || 0) < cost) return
    // 扣费
    gameState.value.player.gold = (gameState.value.player.gold || 0) - cost

    const layer = gameState.value.level
    const ctxBase: RewardContext = {
      layer,
      playerStats: {
        damage: gameState.value.player.damage,
        attackSpeed: gameState.value.player.attackSpeed,
        critChance: gameState.value.player.critChance,
        projectiles: gameState.value.player.projectiles,
        pierce: gameState.value.player.pierce,
        moveSpeed: gameState.value.player.moveSpeed
      },
      recentOfferedIds: availableShopItems.value
        .filter((i): i is GeneratedReward & { locked: boolean } => !!i && !!i.option && i.locked)
        .map(i => i.option.id)
    }

    // 刷新逻辑：除了锁定道具，其他不管该位置有没有商品都刷新
    const baseRecentIds = ctxBase.recentOfferedIds ?? []
    const refreshedIds = new Set<string>()
    
    // 确保商店有4个槽位
    const targetCount = 4
    while (availableShopItems.value.length < targetCount) {
      availableShopItems.value.push(null)
    }
    
    // **关键修复**：确保锁定的道具保持在原位置，即使刷新也不改变
    availableShopItems.value = availableShopItems.value.map((item, index) => {
      // **关键修复**：锁定的道具保持不变，且保持在原位置
      if (item && item.option && item.locked) {
        return { ...item, locked: true } // 确保locked属性被保留
      }
      
      // 未锁定的槽位（包括空槽位）都刷新
      // 如果原槽位有商品，使用原商品的品质；如果为空，随机生成品质
      let quality: 'green' | 'blue' | 'purple' | 'gold' = 'green'
      if (item && item.option) {
        quality = item.option.color as 'green' | 'blue' | 'purple' | 'gold'
      } else {
        // 空槽位：根据层数随机生成品质
        const rand = Math.random()
        if (layer >= 51) {
          if (rand < 0.15) quality = 'blue'
          else if (rand < 0.75) quality = 'purple'
          else quality = 'gold'
        } else if (layer >= 41) {
          if (rand < 0.05) quality = 'green'
          else if (rand < 0.25) quality = 'blue'
          else if (rand < 0.80) quality = 'purple'
          else quality = 'gold'
        } else if (layer >= 31) {
          if (rand < 0.10) quality = 'green'
          else if (rand < 0.35) quality = 'blue'
          else if (rand < 0.85) quality = 'purple'
          else quality = 'gold'
        } else if (layer >= 21) {
          if (rand < 0.15) quality = 'green'
          else if (rand < 0.50) quality = 'blue'
          else if (rand < 0.90) quality = 'purple'
          else quality = 'gold'
        } else if (layer >= 16) {
          if (rand < 0.25) quality = 'green'
          else if (rand < 0.65) quality = 'blue'
          else if (rand < 0.95) quality = 'purple'
          else quality = 'gold'
        } else if (layer >= 11) {
          if (rand < 0.40) quality = 'green'
          else if (rand < 0.85) quality = 'blue'
          else if (rand < 0.98) quality = 'purple'
          else quality = 'gold'
        } else if (layer >= 6) {
          if (rand < 0.65) quality = 'green'
          else if (rand < 0.95) quality = 'blue'
          else if (rand < 0.99) quality = 'purple'
          else quality = 'gold'
        } else {
          // 1-5层：所有品质都有概率，但绿色概率最高
          if (rand < 0.75) quality = 'green'
          else if (rand < 0.95) quality = 'blue'
          else if (rand < 0.99) quality = 'purple'
          else quality = 'gold'
        }
      }
      
      const recentPool = [...baseRecentIds, ...Array.from(refreshedIds)]
      const newItem = generateShopItemByQuality(quality, layer, {
        ...ctxBase,
        recentOfferedIds: recentPool
      })
      if (!newItem) return null
      refreshedIds.add(newItem.option.id)
      return { ...newItem, locked: false }
    })
    sanitizeShopItems()
    availableShopItems.value = [...availableShopItems.value]
    
    // **关键修复**：确保刷新后商店总是有4个槽位
    const finalTargetCount = 4
    while (availableShopItems.value.length < finalTargetCount) {
      availableShopItems.value.push(null)
    }
    if (availableShopItems.value.length > finalTargetCount) {
      availableShopItems.value = availableShopItems.value.slice(0, finalTargetCount)
    }

    // 刷新费用递增
    shopRefreshCost.value = Math.min(9999, shopRefreshCost.value + 10)
  }

  // 应用奖励效果
  const applyRewardEffect = (reward: RewardOption, scaledValue?: number) => {
    const effectKey = reward.effectKey
    const finalValue = scaledValue !== undefined ? scaledValue : (reward.baseValue || 0)
    
    if (reward.category === 'attribute') {
      if (effectKey.startsWith('damage_pct') || effectKey === 'all_damage_pct') {
        gameState.value.player.damage *= (1 + finalValue)
      } else if (effectKey.startsWith('attack_speed_pct')) {
        gameState.value.player.attackSpeed *= (1 + finalValue)
      } else if (effectKey.startsWith('crit_chance_add')) {
        gameState.value.player.critChance += finalValue
      } else if (effectKey.startsWith('crit_damage_add')) {
        (gameState.value.player as any).critDamage = ((gameState.value.player as any).critDamage || 2) + finalValue
      } else if (effectKey.startsWith('projectiles_add')) {
        gameState.value.player.projectiles += Math.floor(finalValue)
      } else if (effectKey.startsWith('pierce_add')) {
        gameState.value.player.pierce = (gameState.value.player.pierce || 0) + Math.floor(finalValue)
      } else if (effectKey.startsWith('move_speed_pct')) {
        gameState.value.player.moveSpeed *= (1 + finalValue)
      } else if (effectKey.startsWith('lifesteal_add')) {
        gameState.value.player.lifesteal = (gameState.value.player.lifesteal || 0) + finalValue
      } else if (effectKey.startsWith('regeneration_add')) {
        gameState.value.player.regeneration = (gameState.value.player.regeneration || 0) + Math.floor(finalValue)
      } else if (effectKey.startsWith('max_health_add')) {
        const added = Math.floor(finalValue)
        gameState.value.player.maxHealth += added
        gameState.value.player.health += added
      }
    }
    // 2. 特殊效果奖励（special）- 记录到玩家状态，由引擎处理
    else if (reward.category === 'special') {
      // 初始化特殊效果列表（如果不存在）
      if (!(gameState.value.player as any).specialEffects) {
        ;(gameState.value.player as any).specialEffects = []
      }
      // 避免重复添加相同的效果
      if (!(gameState.value.player as any).specialEffects.includes(effectKey)) {
        ;(gameState.value.player as any).specialEffects.push(effectKey)
      }
      
      // 一些特殊效果可以直接应用属性
      if (effectKey === 'on_kill_heal_orb') {
        ;(gameState.value.player as any).healOrbOnKill = true
      } else if (effectKey === 'low_hp_damage_reduction') {
        ;(gameState.value.player as any).lowHpDamageReduction = true
      }
    }
    // 3. 史诗和传说奖励（epic/legendary）- 同样需要添加到specialEffects
    else if (reward.category === 'epic' || reward.category === 'legendary') {
      // 初始化特殊效果列表（如果不存在）
      if (!(gameState.value.player as any).specialEffects) {
        ;(gameState.value.player as any).specialEffects = []
      }
      // 避免重复添加相同的效果
      if (effectKey && !(gameState.value.player as any).specialEffects.includes(effectKey)) {
        ;(gameState.value.player as any).specialEffects.push(effectKey)
      }
      
      // 处理Boss专属效果
      if (effectKey === 'random_special_proc') {
        if (!(gameState.value.player as any).bossExclusiveEffects) {
          ;(gameState.value.player as any).bossExclusiveEffects = []
        }
        if (!(gameState.value.player as any).bossExclusiveEffects.includes('random_special_proc')) {
          ;(gameState.value.player as any).bossExclusiveEffects.push('random_special_proc')
        }
      }
    }
    
    // 应用Debuff
    if (reward.debuff) {
      const debuff = reward.debuff
      switch (debuff.type) {
        case 'health_reduction':
          gameState.value.player.maxHealth = Math.max(1, gameState.value.player.maxHealth - debuff.value)
          gameState.value.player.health = Math.min(gameState.value.player.health, gameState.value.player.maxHealth)
          break
        case 'move_speed_reduction':
          gameState.value.player.moveSpeed *= (1 - debuff.value)
          break
        case 'attack_speed_reduction':
          gameState.value.player.attackSpeed *= (1 - debuff.value)
          break
        case 'crit_chance_reduction':
          gameState.value.player.critChance = Math.max(0, gameState.value.player.critChance - debuff.value)
          break
        case 'increased_damage_taken':
          if (!(gameState.value.player as any).damageTakenMultiplier) {
            (gameState.value.player as any).damageTakenMultiplier = 1.0
          }
          (gameState.value.player as any).damageTakenMultiplier += debuff.value
          break
      }
    }
  }

  return {
    // 状态
    gameState,
    uiSettings,
    availablePassives,
    selectedPassive,
    availableBossRewards,
    selectedBossReward,
    availableShopItems,
    shopRefreshCost,
    showShop,
    highestScore,
    highestLevel,
    longestSurvival,
    _lastSaveTime,
    
    // 计算属性
    isGameActive,
    playerHealthPercent,
    playerStats,
    
    // 方法
    startGame,
    pauseGame,
    endGame,
    generatePassiveOptions,
    selectPassive,
    confirmPassiveSelection,
    selectBossReward,
    confirmBossRewardSelection,
    nextLevel,
    updatePlayerPosition,
    updatePlayerHealth,
    addEnemy,
    removeEnemy,
    addProjectile,
    removeProjectile,
    updateScore,
    updateTimeRemaining,
    buyShopItem,
    toggleShopItemLock,
    refreshAllShopItems,
    closeShop,
    updateHighestRecords,
    saveCurrentProgress,
    saveRecordsToLocalStorage,
    loadRecordsFromLocalStorage,
    saveGameSessionToDatabase,
    setUiAutoOpenAttributes
  }
})

