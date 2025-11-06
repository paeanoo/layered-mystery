import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { GameState, PlayerState, PassiveAttribute } from '../types/game'
import type { RewardOption } from '../types/reward'
import { generateBossRewards } from '../utils/RewardGenerator'
import { getTierMultiplier } from '../types/reward'
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

  // 最高记录
  const highestScore = ref<number>(0)
  const highestLevel = ref<number>(1)
  const longestSurvival = ref<number>(0)

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
    
    // 生成新的被动选择
    generatePassiveOptions()
    selectedPassive.value = null
    
    console.log('进入第', gameState.value.level, '层，血量回满，分数累积')

    // **关键修复**：只有成功击杀Boss的层才会生成Boss奖励候选
    // 检查bossDefeated是否等于previousLevel，确保是真正击杀了Boss
    const isBossLevel = [5, 10, 15, 20].includes(previousLevel)
    const bossWasDefeated = gameState.value.bossDefeated === previousLevel
    
    if (isBossLevel && bossWasDefeated) {
      // 只有真正击杀了Boss，才生成Boss奖励
      // **修复**：生成完整的奖励池，然后随机选择3个
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
      
      // 从生成的奖励池中随机选择3个（使用种子随机数确保可复现性）
      const allOptions = rewards.map(r => r.option)
      
      // 使用SeededRandom进行Fisher-Yates洗牌，确保可复现
      const rng = getSeededRandom()
      const shuffled = [...allOptions]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      
      // 从打乱后的池子中选择前3个
      availableBossRewards.value = shuffled.slice(0, 3)
      selectedBossReward.value = null
      console.log(`[nextLevel] Boss层(${previousLevel})成功击杀Boss，生成奖励池：${rewards.length}个选项，随机选择3个供玩家选择：`, availableBossRewards.value.map(r => r.name))
      // 暂停游戏以等待选择（在本层结束后显示）
      gameState.value.isPaused = true
    } else if (isBossLevel && !bossWasDefeated) {
      // Boss层但未击杀Boss（时间到了），不生成奖励
      console.log(`[nextLevel] Boss层(${previousLevel})未击杀Boss（时间到），不生成Boss奖励`)
      availableBossRewards.value = []
      selectedBossReward.value = null
    }
    
    // **修复**：重置bossDefeated标记，避免影响后续判断
    if (isBossLevel) {
      gameState.value.bossDefeated = undefined
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
        // 3. Boss专属奖励（boss_exclusive）
        else if (reward.category === 'boss_exclusive') {
          if (effectKey === 'pierce_plus_damage') {
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
        // 4. 传说奖励（legendary）
        else if (reward.category === 'legendary') {
          if (effectKey === 'dual_special_proc') {
            ;(gameState.value.player as any).dualSpecialProc = true
          }
        }
        
        // 所有奖励都记录到被动属性列表（用于UI显示）
        gameState.value.player.passiveAttributes.push(rewardId)
      }
      
      selectedBossReward.value = null
      availableBossRewards.value = []
      // 继续游戏
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
  }

  // 更新剩余时间
  const updateTimeRemaining = (time: number) => {
    gameState.value.timeRemaining = time
    // 时间到0时的处理由TestGameEngine负责，这里不再重复处理
  }

  // **修复**：移除watch监听，改为在nextLevel()时生成Boss奖励
  // 这样Boss奖励会在本层结束后显示，而不是Boss死亡时立即显示

  return {
    // 状态
    gameState,
    availablePassives,
    selectedPassive,
    availableBossRewards,
    selectedBossReward,
    highestScore,
    highestLevel,
    longestSurvival,
    
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
    updateHighestRecords,
    saveCurrentProgress,
    saveRecordsToLocalStorage,
    loadRecordsFromLocalStorage,
    saveGameSessionToDatabase
  }
})

