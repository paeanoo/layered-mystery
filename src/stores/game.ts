import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GameState, PlayerState, PassiveAttribute, SeasonConfig } from '../types/game'
import { PASSIVE_ATTRIBUTES } from '../types/game'
import { gameData } from './supabase'

export const useGameStore = defineStore('game', () => {
  // 游戏状态
  const gameState = ref<GameState>({
    level: 1,
    timeRemaining: 30,
    enemies: [],
    projectiles: [],
    player: {
      health: 100,
      maxHealth: 100,
      experience: 0,
      level: 1,
      position: { x: 400, y: 300 },
      velocity: { x: 0, y: 0 },
      attackSpeed: 1,
      damage: 10,
      critChance: 0.05,
      projectiles: 1,
      pierce: 0,
      regeneration: 0,
      moveSpeed: 1,
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

  // 当前赛季
  const currentSeason = ref<SeasonConfig | null>(null)

  // 被动属性选择
  const availablePassives = ref<PassiveAttribute[]>([])
  const selectedPassive = ref<string | null>(null)

  // 最高记录
  const highestScore = ref<number>(0)
  const highestLevel = ref<number>(1)
  const longestSurvival = ref<number>(0)

  // 计算属性
  const isGameActive = computed(() => !gameState.value.isPaused && !gameState.value.isGameOver)
  const playerHealthPercent = computed(() => 
    (gameState.value.player.health / gameState.value.player.maxHealth) * 100
  )

  // 游戏控制方法
  const startGame = async () => {
    try {
      // 加载历史记录
      loadRecordsFromLocalStorage()
      
      // 模拟赛季数据（如果Supabase未配置）
      const mockSeason = {
        id: '1',
        name: '第一赛季',
        theme: '极简风格',
        seed: 'season1_seed_2024',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      }
      
      currentSeason.value = mockSeason
      gameState.value.seasonSeed = mockSeason.seed

      // 重置游戏状态
      gameState.value = {
        level: 1,
        timeRemaining: 30,
        enemies: [],
        projectiles: [],
        player: {
          health: 100,
          maxHealth: 100,
          experience: 0,
          level: 1,
          position: { x: 400, y: 300 },
          velocity: { x: 0, y: 0 },
          attackSpeed: 1,
          damage: 10,
          critChance: 0.05,
          projectiles: 1,
          pierce: 0,
          regeneration: 0,
          moveSpeed: 1,
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
        seasonSeed: mockSeason.seed
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

  // 更新最高记录
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
    
    // 保存到数据库
    await saveGameSessionToDatabase()
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
      if (!currentSeason.value) {
        console.warn('没有当前赛季，跳过数据库保存')
        return
      }

      // 模拟玩家ID（实际应用中应该从认证系统获取）
      const playerId = 'player_' + Date.now()
      
      // 构建游戏会话数据
      const sessionData = {
        player_id: playerId,
        season_id: currentSeason.value.id,
        level: gameState.value.level,
        score: gameState.value.score,
        time: gameState.value.timeRemaining,
        build: gameState.value.player.passiveAttributes
      }

      console.log('保存游戏会话到数据库:', sessionData)
      
      // 这里应该调用实际的数据库API
      // 例如：await supabase.from('game_sessions').insert(sessionData)
      
      // 模拟数据库保存成功
      console.log('游戏会话保存成功')
      
    } catch (error) {
      console.error('保存游戏会话失败:', error)
    }
  }

  // 被动属性选择
  const generatePassiveOptions = () => {
    // 随机选择3个被动属性
    const shuffled = [...PASSIVE_ATTRIBUTES].sort(() => Math.random() - 0.5)
    availablePassives.value = shuffled.slice(0, 3)
  }

  const selectPassive = (passiveId: string) => {
    selectedPassive.value = passiveId
    console.log('选择被动属性:', passiveId)
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
    // 进入下一层
    gameState.value.level++
    
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
      // 继续游戏（如果不是死亡）
      if (!gameState.value.isGameOver) {
        gameState.value.isPaused = false
      }
      console.log('被动属性应用完成')
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

  return {
    // 状态
    gameState,
    currentSeason,
    availablePassives,
    selectedPassive,
    highestScore,
    highestLevel,
    longestSurvival,
    
    // 计算属性
    isGameActive,
    playerHealthPercent,
    
    // 方法
    startGame,
    pauseGame,
    endGame,
    generatePassiveOptions,
    selectPassive,
    confirmPassiveSelection,
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
    saveRecordsToLocalStorage,
    loadRecordsFromLocalStorage,
    saveGameSessionToDatabase
  }
})

