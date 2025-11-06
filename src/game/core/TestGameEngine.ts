import { VisualRenderingSystem } from '../systems/VisualRenderingSystem'
import { EnemyVisualSystem } from '../systems/EnemyVisualSystem'
import { ProjectileVisualSystem } from '../systems/ProjectileVisualSystem'
import { AdvancedEffectsSystem } from '../systems/AdvancedEffectsSystem'
import { AudioSystem } from '../systems/AudioSystem'

export class TestGameEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private onLevelComplete?: () => void // 关卡完成回调
  private gameState: any = null // 游戏状态引用
  
  // 新的视觉系统
  private visualRenderer: VisualRenderingSystem
  private enemyVisualSystem: EnemyVisualSystem
  private projectileVisualSystem: ProjectileVisualSystem
  private effectsSystem: AdvancedEffectsSystem
  private audioSystem: AudioSystem
  private playerX = 100
  private playerY = 100
  private playerAngle = 0
  private playerLastX = 100
  private playerLastY = 100
  private enemies: Array<{
    x: number
    y: number
    size: number
    color: string
    health: number
    maxHealth: number
    type?: string
    icdUntil?: number
    // 新增属性
    speed?: number
    targetX?: number
    targetY?: number
    attackCooldown?: number
    lastAttack?: number
    warningLine?: { startX: number; startY: number; endX: number; endY: number; time: number }
    isElite?: boolean
    shield?: number
    maxShield?: number
    skillCooldown?: number
    lastSkill?: number
  }> = []
  private projectiles: Array<{ x: number; y: number; vx: number; vy: number; damage: number; isCrit: boolean; life: number; pierce: number; maxPierce: number; isGrenade?: boolean; owner: 'player' | 'enemy'; hitEnemies?: Set<any> }> = []
  private readonly MAX_PROJECTILES = 500 // 限制最大投射物数量，防止性能问题
  private readonly MAX_ENEMIES = 150 // 限制最大敌人数量，防止性能问题
  private effects: Array<{ x: number; y: number; type: string; life: number; size: number }> = []
  private droppedItems: Array<{ id: string; x: number; y: number; vx: number; vy: number; type: 'heal_orb' | 'experience' | 'energy' | 'item'; value: number; size: number; life: number; maxLife: number; magnetRange?: number; attractedToPlayer?: boolean }> = [] // 掉落物数组
  private readonly MAX_DROPPED_ITEMS = 100 // 限制最大掉落物数量
  private enemySpawnTimer = 0
  private attackTimer = 0 // 毫秒计时器
  private lastAttackTime = Date.now()
  private levelStartTime = 0 // 当前层开始时间
  private enemyUpdateIndex = 0 // 敌人更新索引，用于分批更新
  private attackCooldown = 100 // 攻击间隔（毫秒）- 进一步提高攻击速度
  private pendingEnemies: Array<any> = [] // 待添加的敌人队列（避免在updateEnemyAI中直接修改enemies数组）
  // 快速虫分拨生成控制
  private bugWaveCount = 0 // 当前波次已生成的快速虫数量
  private bugWaveSize = 3 // 每波快速虫数量
  private bugWaveCooldown = 0 // 快速虫生成冷却时间（毫秒）
  private bugWaveCooldownDuration = 8000 // 快速虫波次间隔（8秒）
  private score = 0
  private playerHealth = 20
  private playerMaxHealth = 20
  private playerIFrameUntil = 0 // 玩家无敌帧结束时间戳（毫秒）
  private playerDamageHistory: Array<{ time: number; damage: number }> = [] // 伤害堆叠窗口历史
  private playerProjectileIFrameUntil = 0 // 远程伤害无敌帧（独立于接触伤害）
  private playerExplosionIFrameUntil = 0 // 爆炸伤害无敌帧（独立于接触伤害）
  private isPaused = false
  private gameTime = 30 // 游戏时间（秒）
  
  // 根据层数获取该层的坚持时间（秒）
  // 前4层：30秒，第5-9层逐渐增加到60秒，第10层及以后：60秒
  private getLevelTime(level: number): number {
    if (level <= 4) {
      return 30 // 前4层保持30秒
    }
    if (level >= 10) {
      return 60 // 第10层及以后固定60秒
    }
    // 第5层到第9层：从30秒逐渐增加到60秒
    // 线性增长：30 + (level - 5) * (60 - 30) / (9 - 5)
    const minLevel = 5
    const maxLevel = 9
    const minTime = 30
    const maxTime = 60
    const progress = (level - minLevel) / (maxLevel - minLevel)
    return Math.floor(minTime + (maxTime - minTime) * progress)
  }
  private gameStartTime = 0 // 游戏开始时间
  private pausedTime = 0 // 暂停时累计的时间
  private lastPauseTime = 0 // 最后一次暂停的时间戳
  private keys: { [key: string]: boolean } = {} // 键盘状态跟踪
  public currentLevel = 1 // 当前层数（公开用于测试功能）
  private bossSpawnedInLevel = false // 本层是否已生成Boss
  private showPassiveSelection = false // 是否显示被动属性选择
  private passiveOptions: Array<{id: string, name: string, description: string}> = [] // 被动属性选项
  private lifestealPercent = 0 // 生命偷取百分比
  private autoRegenAmount = 0 // 自动回复生命值
  private lastRegenTime = 0 // 上次回复生命的时间戳（毫秒）
  private hasTriggeredLevelComplete = false // 是否已经触发关卡完成
  private isInNextLevel = false // 是否正在执行 nextLevel，防止重复调用
  
  // 被动属性数据
  private passiveAttributes = [
    { id: 'damage_boost', name: '攻击强化', description: '攻击力+10' },
    { id: 'speed_boost', name: '速度强化', description: '移动速度+2' },
    { id: 'health_boost', name: '生命强化', description: '最大生命值+20' },
    { id: 'crit_boost', name: '暴击强化', description: '暴击率+10%' },
    { id: 'attack_speed', name: '攻速强化', description: '攻击速度+2/秒' },
    { id: 'regen', name: '生命回复', description: '每秒回复5点生命' },
    { id: 'lifesteal', name: '生命偷取', description: '攻击回复10%伤害的生命' },
    { id: 'auto_regen', name: '自动回复', description: '每秒自动回复3点生命' },
    { id: 'pierce', name: '穿透攻击', description: '投射物可穿透敌人' },
    { id: 'explosive', name: '爆炸攻击', description: '投射物爆炸造成范围伤害' },
    { id: 'multi_shot', name: '多重射击', description: '每次攻击发射2个投射物' }
  ]

  // 接触伤害配置
  // ICD (Internal Cooldown) - 单体冷却时间（毫秒）
  private readonly ENEMY_ICD: Record<string, number> = {
    'grunt': 750,    // 步兵
    'bug': 500,      // 快速虫，降低冷却时间
    'runner': 600,   // 疾跑
    'shooter': 800,  // 投射
    'shield': 800,   // 护盾
    'shielded': 800, // 护盾（别名）
    'brute': 900,    // 肉盾
    'exploder': 0,   // 爆裂（只有爆炸伤害，不吃接触循环）
  }

  // 敌人技能范围常量（统一管理）
  private readonly ENEMY_SKILL_RANGES = {
    HEALER_HEAL_RANGE: 150,        // 治疗师治疗范围
    GRENADIER_ATTACK_RANGE: 400,   // 投弹手攻击范围
    GRENADIER_EXPLOSION_RADIUS: 80, // 投弹手爆炸半径
    SUMMONER_SPAWN_DISTANCE: 60,   // 召唤师最小召唤距离
    SUMMONER_SPAWN_MAX_DISTANCE: 100, // 召唤师最大召唤距离
    PHANTOM_BACKSTAB_RANGE: 30,    // 幻影刺客背刺范围
    ARCHER_KEEP_DISTANCE: 250,     // 弓箭手保持距离
    SNIPER_ATTACK_RANGE: 500,      // 狙击手攻击范围
    SHIELDGUARD_SHIELD_REGEN_TIME: 5000, // 护盾兵护盾重生时间（毫秒）
  }

  // 接触伤害倍数
  private readonly ENEMY_DMG_MULTIPLIER: Record<string, number> = {
    'grunt': 1.0,     // 默认
    'infantry': 1.0,  // 步兵
    'bug': 0.2,       // 快速虫伤害大幅削减（因为它血量低且数量多）
    'runner': 1.05,   // ×1.05
    'archer': 0.7,    // 弓箭手接触伤害降低（主要靠远程攻击）
    'shooter': 0.9,   // ×0.9（顶身）
    'shieldguard': 1.1, // 护盾兵
    'bomb_bat': 0.8,  // 爆破蝙蝠（主要靠爆炸伤害）
    'brute': 1.25,    // ×1.25
    'boss': 1.6,      // ×1.6
  }

  constructor(canvas: HTMLCanvasElement, onLevelComplete?: () => void, gameState?: any) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onLevelComplete = onLevelComplete
    this.gameState = gameState
    
    // 初始化视觉系统
    this.visualRenderer = new VisualRenderingSystem()
    this.enemyVisualSystem = new EnemyVisualSystem()
    this.projectileVisualSystem = new ProjectileVisualSystem()
    this.effectsSystem = new AdvancedEffectsSystem()
    
    // 初始化音频系统
    this.audioSystem = new AudioSystem()
    
    this.setupCanvas()
    this.setupEventListeners()
    // 不在这里生成敌人，初始应该什么都没有，敌人会从边缘逐渐出现
  }

  // 计算无敌帧时长（根据层数）
  private calculateIFrameDuration(layer: number): number {
    // 11层起线性降到0.28s（20层）
    // 第11层: 0.40s, 第20层: 0.28s
    if (layer < 11) {
      return 400 // 0.40s
    } else if (layer >= 20) {
      return 280 // 0.28s
    } else {
      // 线性插值: 11层 -> 400ms, 20层 -> 280ms
      const t = (layer - 11) / (20 - 11)
      return 400 - (400 - 280) * t
    }
  }

  // 计算接触伤害
  private calculateContactDamage(layer: number, enemyType?: string): number {
    // **修复**：前6层保持极低难度，从第7层开始增加难度
    let baseDamage: number
    if (layer <= 6) {
      // 前6层：极低伤害（保持稳定，几乎不变）
      baseDamage = 1.2 + (layer - 1) * 0.1 // 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
    } else if (layer <= 10) {
      // 第7-10层：开始缓慢增长
      baseDamage = 1.7 + (layer - 6) * 0.3 // 2.0, 2.3, 2.6, 2.9
    } else if (layer <= 15) {
      // 第11-15层：中等增长
      baseDamage = 2.9 + (layer - 10) * 0.5 // 3.4, 3.9, 4.4, 4.9, 5.4
    } else {
      // 第16层之后：正常增长
      baseDamage = 5.4 + (layer - 15) * 0.7
    }
    
    // 敌人类型伤害倍数
    const multiplier = enemyType ? (this.ENEMY_DMG_MULTIPLIER[enemyType] || 1.0) : 1.0
    
    return baseDamage * multiplier
  }

  // 检查是否超过堆叠上限
  private exceedsStackCap(damage: number): boolean {
    const now = Date.now()
    const windowEnd = now
    const windowStart = windowEnd - 1200 // 1.2s窗口
    
    // 计算窗口内的伤害次数和总伤害
    let hitCount = 0
    let totalDamage = 0
    
    this.playerDamageHistory.forEach(({ time, damage: dmg }) => {
      if (time >= windowStart && time <= windowEnd) {
        hitCount++
        totalDamage += dmg
      }
    })
    
    // 移除过期记录
    this.playerDamageHistory = this.playerDamageHistory.filter(d => d.time >= windowStart)
    
    // 堆叠上限：最多3次或≤最大生命55%，取更小者
    const maxHits = 3
    const maxDamage = this.playerMaxHealth * 0.55
    
    // 检查是否会超过次数上限
    if (hitCount >= maxHits) return true
    
    // 检查是否会超过伤害上限
    if (totalDamage + damage > maxDamage) return true
    
    return false
  }

  // 处理接触伤害
  private handleContactDamage(enemy: { x: number; y: number; size?: number; type?: string; icdUntil?: number }, layer: number) {
    const now = Date.now()
    const enemyType = enemy.type || 'grunt'
    const enemyICD = this.ENEMY_ICD[enemyType] || 750
    
    // 跳过 exploder（只有爆炸伤害，不吃接触循环）
    if (enemyType === 'exploder') return
    
    // **性能优化**：使用平方距离避免Math.sqrt
    const dx = enemy.x - this.playerX
    const dy = enemy.y - this.playerY
    const playerDistanceSq = dx * dx + dy * dy
    
    // 接触伤害范围：玩家半径15 + 敌人尺寸
    const contactDistance = 15 + (enemy.size || 20)
    const contactDistanceSq = contactDistance * contactDistance
    
    // 只有距离足够近才造成伤害
    if (playerDistanceSq >= contactDistanceSq) {
      return
    }
    
    // 检查玩家无敌帧
    if (now < this.playerIFrameUntil) {
      return
    }
    
    // 检查敌人ICD
    if (enemy.icdUntil && now < enemy.icdUntil) {
      return
    }
    
    // 计算伤害
    let damage = this.calculateContactDamage(layer, enemyType)
    
    // Boss接触伤害适度增加（降低伤害）
    const isBoss = enemyType === 'infantry_captain' || enemyType === 'fortress_guard' || 
                   enemyType === 'void_shaman' || enemyType === 'legion_commander'
    if (isBoss) {
      damage = damage * 1.5 // Boss接触伤害1.5倍（从3倍降低）
    }
    
    // 检查堆叠上限
    if (this.exceedsStackCap(damage)) {
      return
    }
    
    // 结算伤害
    this.playerHealth -= damage
    if (this.playerHealth <= 0) {
      this.playerHealth = 0
      this.triggerGameOver()
      return
    }
    
    // 应用无敌帧
    const iFrameDuration = this.calculateIFrameDuration(layer)
    this.playerIFrameUntil = now + iFrameDuration
    
    // 应用敌人ICD
    enemy.icdUntil = now + enemyICD
    
    // 记录伤害历史
    this.playerDamageHistory.push({ time: now, damage })
    
    // 添加受击特效
    this.addHitEffect(this.playerX, this.playerY, false)
    
    // 播放玩家受击音效（接触伤害）
    this.audioSystem.playSoundEffect('player_hit', { volume: 0.6 })
  }

  // 更新游戏状态引用
  updateGameState(gameState: any) {
    this.gameState = gameState
    
    // 同步玩家属性到引擎内部变量
    if (gameState.player) {
      console.log('更新游戏状态 - 玩家属性:', gameState.player)
      
      this.playerX = gameState.player.position.x
      this.playerY = gameState.player.position.y
      this.playerHealth = gameState.player.health
      this.playerMaxHealth = gameState.player.maxHealth
      
      console.log('引擎内部属性已更新:', {
        playerX: this.playerX,
        playerY: this.playerY,
        playerHealth: this.playerHealth,
        playerMaxHealth: this.playerMaxHealth
      })
      
      // 更新玩家属性到渲染系统
      if (this.visualRenderer) {
        this.visualRenderer.updatePlayerStats({
          health: this.playerHealth,
          maxHealth: this.playerMaxHealth,
          damage: gameState.player.damage,
          attackSpeed: gameState.player.attackSpeed,
          critChance: gameState.player.critChance,
          projectiles: gameState.player.projectiles,
          pierce: gameState.player.pierce,
          regeneration: gameState.player.regeneration,
          moveSpeed: gameState.player.moveSpeed,
          lifesteal: gameState.player.lifesteal,
          passiveAttributes: gameState.player.passiveAttributes
        })
      }
      
      // **调试日志**：当攻击速度变化时输出
      if (Math.abs(gameState.player.attackSpeed - (this.lastKnownAttackSpeed || 1.0)) > 0.01) {
        console.log(`⚡ 攻击速度已更新: ${gameState.player.attackSpeed.toFixed(2)}/秒, 攻击间隔: ${(1000 / gameState.player.attackSpeed).toFixed(1)}ms`)
        this.lastKnownAttackSpeed = gameState.player.attackSpeed
      }
    }
  }
  
  // 缓存上次已知的攻击速度，用于检测变化
  private lastKnownAttackSpeed: number = 1.0

  private setupEventListeners() {
    // 窗口大小变化时重新调整Canvas
    window.addEventListener('resize', () => {
      this.setupCanvas()
    })
    
    // 键盘事件监听
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true
      this.handleKeyDown(e.key)
    })
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false
    })
  }

  private setupCanvas() {
    // 设置Canvas为全屏
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.canvas.style.width = '100vw'
    this.canvas.style.height = '100vh'
    this.canvas.style.position = 'absolute'
    this.canvas.style.top = '0'
    this.canvas.style.left = '0'
    this.canvas.style.border = 'none'
    
    console.log('Canvas设置完成:', {
      width: this.canvas.width,
      height: this.canvas.height,
      ctx: this.ctx
    })
  }

  start() {
    console.log('开始游戏循环')
    // 重置玩家生命值
    this.playerHealth = this.playerMaxHealth
    this.playerIFrameUntil = 0 // 重置接触伤害无敌帧
    this.playerProjectileIFrameUntil = 0 // 重置远程伤害无敌帧
    this.playerExplosionIFrameUntil = 0 // 重置爆炸伤害无敌帧
    this.playerDamageHistory = [] // 重置伤害历史
    
    // **调试**：确认初始化
    console.log('✅ 玩家状态初始化:', {
      health: this.playerHealth,
      maxHealth: this.playerMaxHealth,
      contactIFrame: this.playerIFrameUntil,
      projectileIFrame: this.playerProjectileIFrameUntil,
      explosionIFrame: this.playerExplosionIFrameUntil
    })
    this.lastRegenTime = Date.now() // 初始化生命回复计时器
    this.score = 0
    this.currentLevel = 1 // 重置层数
    this.gameTime = this.getLevelTime(this.currentLevel)
    this.gameStartTime = Date.now()
    this.levelStartTime = Date.now() // 初始化层级开始时间
    this.pausedTime = 0
    this.lastPauseTime = 0
    this.hasTriggeredLevelComplete = false // 重置关卡完成标志
    this.isInNextLevel = false // 重置 nextLevel 执行标志
    // 清空所有敌人、投射物和特效（初始应该什么都没有）
    this.enemies = []
    this.pendingEnemies = [] // 清空待添加队列
    this.projectiles = []
    this.effects = []
    this.droppedItems = []
    this.enemySpawnTimer = 0 // 重置敌人生成计时器
    // 重置快速虫波次控制
    this.bugWaveCount = 0
    this.bugWaveCooldown = 0
    
    // 播放背景音乐
    // 注意：如果没有通过 loadBackgroundMusic 加载音频文件，会使用程序化生成简单的背景音乐
    // 如果有实际的背景音乐文件，可以在外部调用 audioSystem.loadBackgroundMusic() 加载
    // 尝试播放已加载的背景音乐（如果有），否则使用程序化生成
    this.audioSystem.playBackgroundMusic(true)
    
    this.gameLoop()
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    
    // 停止背景音乐
    this.audioSystem.stopBackgroundMusic(true)
  }

  private lastUpdateTime = Date.now()
  
  private gameLoop = () => {
    if (!this.isPaused) {
      this.update()
    }
    this.render()
    this.animationId = requestAnimationFrame(this.gameLoop)
  }

  private update() {
    const now = Date.now()
    const deltaTime = Math.min(now - this.lastUpdateTime, 100) // 限制最大deltaTime为100ms，防止卡死恢复后异常大的时间差
    this.lastUpdateTime = now
    
    // 更新视觉系统
    this.visualRenderer.update(deltaTime)
    this.enemyVisualSystem.update(deltaTime)
    this.projectileVisualSystem.update(deltaTime)
    this.effectsSystem.update(deltaTime)
    
    // 更新时间（可能会触发关卡切换）
    // 注意：在 updateGameTime() 中如果触发 nextLevel()，会调用回调，
    // 回调中 gameStore.nextLevel() 需要读取旧的 gameState.level 作为 previousLevel
    // 所以我们需要在 updateGameTime() 之前保存旧的 level，并在回调后再同步
    const oldLevelBeforeUpdate = this.currentLevel
    this.updateGameTime()
    
    // 同步分数到gameState
    if (this.gameState) {
      this.gameState.score = this.score
      // 注意：如果关卡没有变化（没有触发 nextLevel），则正常同步
      // 如果关卡变化了（触发了 nextLevel），nextLevel() 会在回调后同步 level
      // 这里我们只在关卡没有变化时同步，避免覆盖回调中的 previousLevel
      // **修复**：确保关卡同步逻辑正确，避免跳过关卡
      if (this.currentLevel === oldLevelBeforeUpdate) {
        // 关卡没有变化，正常同步
        if (this.gameState) {
          this.gameState.level = this.currentLevel
        }
      } else {
        // 关卡已变化，但 nextLevel() 会在回调后同步
        // 这里不同步，避免覆盖回调中的 previousLevel
        console.log(`[update] 关卡已从 ${oldLevelBeforeUpdate} 变为 ${this.currentLevel}，等待 nextLevel() 回调后同步`)
      }
      this.gameState.timeRemaining = this.gameTime
      
      // 同步最大生命值（如果gameState中的值更新了）
      if (this.gameState.player && this.gameState.player.maxHealth !== this.playerMaxHealth) {
        // 计算生命值增量
        const healthIncrease = this.gameState.player.maxHealth - this.playerMaxHealth
        this.playerMaxHealth = this.gameState.player.maxHealth
        this.playerHealth += healthIncrease
      }
      
      // 同步生命值到gameState
      if (this.gameState.player) {
        this.gameState.player.health = this.playerHealth
        this.gameState.player.maxHealth = this.playerMaxHealth
      }
    }
    
    // 处理玩家移动（先更新移动，确保位置是最新的）
    this.updatePlayerMovement()
    
    // **关键修复**：在碰撞检测前，同步最新的玩家位置
    // 如果gameState中有更新的位置（比如从Vue组件传来的），使用那个位置
    // 否则使用通过键盘更新的位置
    if (this.gameState?.player?.position) {
      // 只有当gameState中的位置确实是新的时才更新（避免覆盖键盘输入）
      // 这里我们优先使用键盘更新的位置，因为键盘输入是实时的
      // gameState中的position可能是旧的
      // this.playerX = this.gameState.player.position.x
      // this.playerY = this.gameState.player.position.y
      
      // 但我们要确保gameState中的position也被更新，以便渲染系统使用
      this.gameState.player.position.x = this.playerX
      this.gameState.player.position.y = this.playerY
    }
    
    // **性能监控**：定期输出性能指标（降低频率）
    if (Math.random() < 0.005) { // 0.5%的概率输出，避免日志过多
      const perfInfo = {
        level: this.currentLevel,
        enemies: this.enemies.length,
        projectiles: this.projectiles.length,
        pendingEnemies: this.pendingEnemies.length,
        effects: this.effects.length
      }
      // 如果数量异常，输出警告
      if (perfInfo.enemies > 120 || perfInfo.projectiles > 400) {
        console.warn(`[性能警告] 关卡${perfInfo.level}:`, perfInfo)
      } else {
        console.log(`[性能] 关卡${perfInfo.level}:`, perfInfo)
      }
    }
    
    // 处理生命回复
    this.updateHealthRegen()
    
    // 更新敌人（性能优化：分批更新，减少单帧负载）
    // 先清空待添加队列（上一帧添加的敌人）
    if (this.pendingEnemies.length > 0) {
      this.enemies.push(...this.pendingEnemies)
      this.pendingEnemies = []
    }
    
    // 更新敌人（确保在添加新敌人后才更新）
    // 性能优化：根据敌人数量动态调整每帧更新数量，敌人多时减少更新数量
    if (this.enemies.length > 0) {
      // 敌人少时更新更多，敌人多时更新更少，确保流畅度
      const enemyCount = this.enemies.length
      let enemyUpdateBatch: number
      if (enemyCount <= 50) {
        enemyUpdateBatch = Math.min(enemyCount, 30) // 敌人少时每帧更新30个
      } else if (enemyCount <= 100) {
        enemyUpdateBatch = Math.min(enemyCount, 20) // 中等数量时更新20个
      } else {
        enemyUpdateBatch = Math.min(enemyCount, 15) // 敌人多时只更新15个
      }
      
      for (let i = 0; i < enemyUpdateBatch && this.enemies.length > 0; i++) {
        const currentLength = this.enemies.length
        if (currentLength === 0) break // 防止长度变为0时出错
        const index = (this.enemyUpdateIndex + i) % currentLength
        if (index >= 0 && index < this.enemies.length && this.enemies[index]) {
          this.updateEnemyAI(this.enemies[index], index)
        }
      }
      if (this.enemies.length > 0) {
        this.enemyUpdateIndex = (this.enemyUpdateIndex + enemyUpdateBatch) % this.enemies.length
      } else {
        this.enemyUpdateIndex = 0
      }
    }

    // 更新投射物（在玩家位置更新后）
    this.updateProjectiles()

    // 更新掉落物
    this.updateDroppedItems()
    
    // 检查掉落物拾取
    this.checkItemPickup()

    // 更新特效
    this.updateEffects()

    // 自动攻击
    this.handleAutoAttack()

    // 更新快速虫波次冷却
    if (this.bugWaveCooldown > 0) {
      this.bugWaveCooldown -= deltaTime
      if (this.bugWaveCooldown < 0) {
        this.bugWaveCooldown = 0
      }
    }

    // 生成新敌人（持续生成，生成频率随层数和时间逐渐递增，无数量上限）
    this.enemySpawnTimer++
    
    // 计算当前层已进行的时间（秒）- 用于每一层内逐渐加快生成
    const currentTime = Date.now()
    const levelElapsedTime = this.levelStartTime > 0 ? (currentTime - this.levelStartTime - this.pausedTime) / 1000 : 0
    
    // **优化**：一层开始时生成很慢，在一层内逐渐递增生成速度
    // 基础间隔随层数设定（这决定了该层的最大速度）
    let maxSpeedInterval: number // 该层能达到的最快间隔（30秒时的间隔）
    if (this.currentLevel <= 5) {
      maxSpeedInterval = 50 // 前5层最快约0.83秒
    } else if (this.currentLevel <= 10) {
      maxSpeedInterval = 40 // 第6-10层最快约0.67秒
    } else if (this.currentLevel <= 15) {
      maxSpeedInterval = 35 // 第11-15层最快约0.58秒
    } else {
      maxSpeedInterval = 30 // 第16层之后最快约0.5秒
    }
    
    // 一层开始时的初始间隔（很慢，让玩家适应）
    const initialSpawnInterval = 150 // 约2.5秒开始
    
    // 一层内逐渐加速：从150帧逐渐降到maxSpeedInterval
    // 使用平滑曲线，在30秒内完成加速
    const accelerationTime = 30 // 加速时间（秒）
    const speedProgress = Math.min(1.0, levelElapsedTime / accelerationTime)
    
    // 使用平方曲线让加速更平滑
    const smoothProgress = speedProgress * speedProgress
    
    // 计算当前间隔：从慢到快
    const baseSpawnInterval = initialSpawnInterval - (initialSpawnInterval - maxSpeedInterval) * smoothProgress
    
    // 根据敌人数量微调：敌人很多时才稍微减慢，但影响很小，确保持续生成
    // 只在敌人数量非常多时（>100）才开始明显减慢，但永远不会停止
    let enemyCountFactor = 1.0
    if (this.enemies.length > 100) {
      // 超过100个敌人才开始轻微影响（每100个敌人增加5%间隔）
      const excessEnemies = this.enemies.length - 100
      enemyCountFactor = 1.0 + (excessEnemies / 100) * 0.05 // 最多增加约20%
    }
    const spawnInterval = Math.floor(baseSpawnInterval * enemyCountFactor)
    
    // 限制敌人总数，防止性能问题
    // 如果敌人数量超过限制，停止生成新敌人
    if (this.enemies.length >= this.MAX_ENEMIES) {
      // 敌人数量已达上限，不生成新敌人
      return
    }
    
    // 持续生成，但受数量上限限制
    if (this.enemySpawnTimer >= spawnInterval) {
      this.spawnEnemy()
      this.enemySpawnTimer = 0
    }
  }

  private spawnEnemy() {
    const side = Math.floor(Math.random() * 4)
    let x, y

    switch (side) {
      case 0: x = Math.random() * this.canvas.width; y = -20; break
      case 1: x = this.canvas.width + 20; y = Math.random() * this.canvas.height; break
      case 2: x = Math.random() * this.canvas.width; y = this.canvas.height + 20; break
      case 3: x = -20; y = Math.random() * this.canvas.height; break
    }

    const layer = this.currentLevel
    // Boss层：第5/10/15/20层在本层首次生成事件时强制生成Boss（居中）
    if ((layer === 5 || layer === 10 || layer === 15 || layer === 20) && !this.bossSpawnedInLevel) {
      // 检查敌人数量，如果已经很多，等待清理一些再生成Boss
      if (this.enemies.length >= this.MAX_ENEMIES * 0.9) {
        console.log(`[Boss生成] 关卡${layer}: 敌人数量过多(${this.enemies.length})，延迟生成Boss`)
        return // 延迟生成，等待敌人数量减少
      }
      
      const centerX = this.canvas.width / 2
      const centerY = this.canvas.height / 2
      const baseHealth = 20 * (layer <= 3 ? 1.0 + (layer - 1) * 0.05 : (layer <= 10 ? 1.1 + (layer - 3) * 0.1 : 1.8 + Math.sqrt((layer - 10) * 2) * 0.2))
      const baseSize = 18 + layer * 0.5
      const boss = this.createBoss(layer, centerX, centerY, baseHealth, baseSize)
      if (boss) {
        // 确保Boss不会导致超出敌人上限
        if (this.enemies.length < this.MAX_ENEMIES) {
          this.enemies.push(boss)
          this.bossSpawnedInLevel = true
          console.log(`[Boss生成] 在第${layer}层生成Boss: ${boss.type}, 当前敌人数: ${this.enemies.length}`)
          return
        } else {
          console.warn(`[Boss生成] 关卡${layer}: 敌人数量已达上限，无法生成Boss`)
        }
      }
    }
    
    // 根据层数生成不同类型和难度的敌人
    const enemy = this.createEnemyByLevel(layer, x!, y!)
    console.log(`在第${layer}层生成敌人: ${enemy.type}`)
    this.enemies.push(enemy)
  }

  // 根据层数创建不同难度的敌人
  private createEnemyByLevel(layer: number, x: number, y: number) {
    // **修复**：前几层降低难度，逐渐增加
    // 使用曲线函数：前3层几乎不增长，第4-10层缓慢增长，之后正常增长
    // 公式：1-3层使用更小的倍数，之后使用平方根曲线加速
    let healthMultiplier: number
    if (layer <= 3) {
      // 前3层：几乎不增长（+0.05/层）
      healthMultiplier = 1.0 + (layer - 1) * 0.05
    } else if (layer <= 10) {
      // 第4-10层：缓慢增长（从1.1开始，每层+0.1）
      healthMultiplier = 1.1 + (layer - 3) * 0.1
    } else {
      // 第10层之后：正常增长（使用平方根曲线，更平滑）
      healthMultiplier = 1.8 + Math.sqrt((layer - 10) * 2) * 0.2
    }
    const baseHealth = 20 * healthMultiplier // 基础血量从25降到20，进一步降低前期难度
    const baseSize = 18 + layer * 0.5
    
    // 根据阶段选择敌人类型
    // 重要：Boss层仍然生成普通敌人，只在特殊时间生成Boss
    // if (layer === 5 || layer === 10 || layer === 16 || layer === 20) {
    //   // Boss层
    //   return this.createBoss(layer, x, y, baseHealth, baseSize)
    // }
    
    // 检查精英怪生成（第8、14、18层）
    if ((layer === 8 || layer === 14 || layer === 18) && Math.random() < 0.3) {
      return this.createEliteEnemy(layer, x, y, baseHealth, baseSize)
    }
    
    // 使用累积型敌人系统：每一层都会保留之前的敌人类型，只增加新类型
    return this.createRandomEnemy(layer, x, y, baseHealth, baseSize)
  }
  
  // 根据层数获取可生成的敌人类型列表
  private getAvailableEnemyTypes(layer: number): Array<{type: string; weight: number; layerStart: number}> {
    const types = [
      // 基础敌人（保持高权重，确保始终出现）
      { type: 'infantry', weight: 100, layerStart: 1 },
      // 快速虫：只在冷却时间为0且波次未满时可用
      ...(this.bugWaveCooldown <= 0 && this.bugWaveCount < this.bugWaveSize 
        ? [{ type: 'bug', weight: 80, layerStart: 3 }] 
        : []),
      
      // 阶段2（新敌人权重较低，逐步增加）
      { type: 'archer', weight: 30, layerStart: 7 }, // 降低权重从60到30，延迟出现从第5层到第7层
      { type: 'sniper', weight: 35, layerStart: 8 }, // 降低权重从70到35，延迟出现从第4层到第8层
      { type: 'shieldguard', weight: 50, layerStart: 7 },
      { type: 'bomb_bat', weight: 40, layerStart: 9 },
      
      // 阶段3
      { type: 'healer', weight: 45, layerStart: 11 },
      { type: 'grenadier', weight: 40, layerStart: 13 },
      { type: 'summoner', weight: 35, layerStart: 15 },
      
      // 阶段4
      { type: 'phantom', weight: 30, layerStart: 17 }
    ]
    
    // 只返回当前层可以生成的类型
    return types.filter(t => layer >= t.layerStart)
  }
  
  // 生成随机敌人（基于累积型敌人系统）
  private createRandomEnemy(layer: number, x: number, y: number, baseHealth: number, baseSize: number) {
    const availableTypes = this.getAvailableEnemyTypes(layer)
    if (availableTypes.length === 0) {
      // 默认近战步兵
      return this.createEnemyByType('infantry', layer, x, y, baseHealth, baseSize)
    }
    
    // 计算总权重
    const totalWeight = availableTypes.reduce((sum, t) => sum + t.weight, 0)
    const random = Math.random() * totalWeight
    
    // 选择敌人类型
    let currentWeight = 0
    let selectedType = availableTypes[0].type
    for (const t of availableTypes) {
      currentWeight += t.weight
      if (random <= currentWeight) {
        selectedType = t.type
        break
      }
    }
    
    // 如果选择了快速虫，更新计数
    if (selectedType === 'bug') {
      this.bugWaveCount++
      // 如果达到波次数量，开始冷却
      if (this.bugWaveCount >= this.bugWaveSize) {
        this.bugWaveCooldown = this.bugWaveCooldownDuration
        this.bugWaveCount = 0
      }
    }
    
    return this.createEnemyByType(selectedType, layer, x, y, baseHealth, baseSize)
  }
  
  // 根据类型创建敌人
  private createEnemyByType(enemyType: string, layer: number, x: number, y: number, baseHealth: number, baseSize: number) {
    // 层数对移速的影响：第1层为基准，第20层移速增加35%（线性增长）
    const speedMultiplier = 1.0 + (layer - 1) * 0.35 / 19
    
    // 层数对攻击冷却的影响：第1层为基准，第20层冷却减少25%（攻击更快）
    const attackCooldownMultiplier = Math.max(0.75, 1.0 - (layer - 1) * 0.25 / 19)
    
    let baseSpeed = 0.7
    let size = baseSize
    let health = baseHealth
    let color = '#ff4444'
    
    switch (enemyType) {
      case 'infantry':
        baseSpeed = 0.7
        size = baseSize
        health = baseHealth * 1.0
        color = '#ff4444'
        break
        
      case 'bug':
        baseSpeed = 2.0
        size = baseSize * 0.7
        health = Math.max(1, baseHealth * 0.1) // 大幅降低血量，保证一击必杀
        color = '#44ff44'
        break
        
      case 'archer':
        baseSpeed = 0.8
        size = baseSize * 0.9
        health = baseHealth * 0.8
        color = '#4444ff'
        break
        
      case 'sniper':
        baseSpeed = 0.6 // 狙击兵移动较慢
        size = baseSize * 1.0
        health = baseHealth * 1.0 // 中等血量
        color = '#ff4444' // 红色，表示高威胁
        break
        
      case 'shieldguard':
        baseSpeed = 0.4
        size = baseSize * 1.6
        health = baseHealth * 2.5
        color = '#888888'
        break
        
      case 'bomb_bat':
        baseSpeed = 1.2
        size = baseSize * 0.8
        health = baseHealth * 0.6
        color = '#884488'
        break
        
      case 'healer':
        baseSpeed = 0.6
        size = baseSize * 1.0
        health = baseHealth * 1.2
        color = '#00ff88'
        break
        
      case 'grenadier':
        baseSpeed = 0.5
        size = baseSize * 1.1
        health = baseHealth * 1.8
        color = '#ff8800'
        break
        
      case 'summoner':
        baseSpeed = 0.5
        size = baseSize * 1.2
        health = baseHealth * 2.0
        color = '#ff00ff'
        break
        
      case 'phantom':
        baseSpeed = 1.8
        size = baseSize * 0.7
        health = baseHealth * 0.9
        color = '#9900ff'
        break
        
      case 'boss':
        baseSpeed = 0.6
        size = baseSize * 2.0 // Boss体型更大
        health = baseHealth * 5.0 // Boss血量更厚
        color = '#ff6600'
        break
    }
    
    // 应用层数增长：移速随层数增长
    const finalSpeed = baseSpeed * speedMultiplier
    
    const hasRangedAttack = ['archer', 'sniper', 'healer', 'grenadier', 'boss'].includes(enemyType)
    const hasSkills = ['healer', 'grenadier', 'summoner', 'phantom', 'boss'].includes(enemyType)
    
    // 基础攻击冷却和技能冷却，然后应用层数增长（冷却减少 = 攻击更快）
    const baseAttackCooldown = hasRangedAttack ? this.getAttackCooldown(enemyType) : undefined
    const baseSkillCooldown = hasSkills ? this.getSkillCooldown(enemyType) : undefined
    
    const enemy = {
      x, y,
      size: Math.floor(size),
      color,
      health: Math.floor(health),
      maxHealth: Math.floor(health),
      type: enemyType,
      speed: finalSpeed,
      lastAttack: hasRangedAttack ? Date.now() : undefined,
      lastSkill: hasSkills ? Date.now() : undefined,
      attackCooldown: baseAttackCooldown ? Math.max(baseAttackCooldown * 0.5, baseAttackCooldown * attackCooldownMultiplier) : undefined,
      skillCooldown: baseSkillCooldown ? Math.max(baseSkillCooldown * 0.5, baseSkillCooldown * attackCooldownMultiplier) : undefined,
      icdUntil: 0
    }
    
    // 根据敌人类型添加特殊属性
    if (enemyType === 'shieldguard') {
      ;(enemy as any).shield = 50 + layer * 10
      ;(enemy as any).maxShield = 50 + layer * 10
      ;(enemy as any).shieldRegenTimer = 0
      ;(enemy as any).shieldBroken = false
    } else if (enemyType === 'boss') {
      ;(enemy as any).shield = 100 + layer * 20
      ;(enemy as any).maxShield = 100 + layer * 20
      ;(enemy as any).shieldRegenTimer = 0
      ;(enemy as any).shieldBroken = false
      ;(enemy as any).specialAttackTimer = 0
      ;(enemy as any).phase = 1
    }
    
    return enemy
  }
  
  // 创建Boss
  private createBoss(layer: number, x: number, y: number, baseHealth: number, baseSize: number): any {
    const now = Date.now()
    if (layer === 5) {
      // 步兵队长（重装指挥官）
      return {
        x, y,
        size: Math.floor(baseSize * 1.8),
        color: '#ff0000',
        health: Math.floor(baseHealth * 25), // 大幅增加血量：25倍
        maxHealth: Math.floor(baseHealth * 25),
        type: 'infantry_captain',
        isElite: true,
        speed: 0.8,
        lastAttack: now - 3000, // 初始化时允许立即攻击
        attackCooldown: 2000,
        lastSkill: now,
        skillCooldown: 12000,
        icdUntil: 0
      }
    } else if (layer === 10) {
      // 堡垒守卫（虫巢母体）
      return {
        x, y,
        size: Math.floor(baseSize * 2.5),
        color: '#884400',
        health: Math.floor(baseHealth * 40), // 大幅增加血量：40倍
        maxHealth: Math.floor(baseHealth * 40),
        type: 'fortress_guard',
        isElite: true,
        speed: 0.3,
        shield: 50,
        maxShield: 50,
        shieldUp: false,
        lastSkill: now,
        skillCooldown: 5000,
        lastBoomHatch: now - 8000, // 允许第一次孵化更快
        icdUntil: 0,
        pendingEggs: [] // 待孵化的虫卵列表
      }
    } else if (layer === 15) {
      // 虚空巫医（暗影刺客）
      return {
        x, y,
        size: Math.floor(baseSize * 2.0),
        color: '#ff00ff',
        health: Math.floor(baseHealth * 50), // 大幅增加血量：50倍
        maxHealth: Math.floor(baseHealth * 50),
        type: 'void_shaman',
        isElite: true,
        speed: 0.5,
        lastAttack: now - 5000,
        attackCooldown: 2000,
        lastSkill: now,
        skillCooldown: 18000,
        invisibleTimer: now,
        isInvisible: true, // 初始状态隐身
        lastSlowingField: now,
        icdUntil: 0
      }
    } else if (layer === 20) {
      // 军团统帅（混沌造物）
      return {
        x, y,
        size: Math.floor(baseSize * 2.8),
        color: '#000000',
        health: Math.floor(baseHealth * 80), // 大幅增加血量：80倍
        maxHealth: Math.floor(baseHealth * 80),
        type: 'legion_commander',
        isElite: true,
        speed: 0.6,
        lastAttack: now - 3000,
        attackCooldown: 2000,
        lastSkill: now,
        skillCooldown: 9000,
        phase: 1,
        icdUntil: 0
      }
    }
    
    return null
  }
  
  // 创建精英敌人
  private createEliteEnemy(layer: number, x: number, y: number, baseHealth: number, baseSize: number): any {
    const now = Date.now()
    if (layer === 8) {
      // 重装队长
      return {
        x, y,
        size: Math.floor(baseSize * 1.8),
        color: '#555555',
        health: Math.floor(baseHealth * 4),
        maxHealth: Math.floor(baseHealth * 4),
        type: 'shield_captain',
        isElite: true,
        speed: 0.5,
        shield: 50, // **修复**：添加护盾属性
        maxShield: 50,
        shieldBroken: false,
        shieldRegenTimer: 0,
        lastSkill: now,
        skillCooldown: 8000,
        icdUntil: 0
      }
    } else if (layer === 14) {
      // 精英治疗师
      return {
        x, y,
        size: Math.floor(baseSize * 1.5),
        color: '#00ff88',
        health: Math.floor(baseHealth * 3),
        maxHealth: Math.floor(baseHealth * 3),
        type: 'elite_healer',
        isElite: true,
        speed: 0.6,
        lastSkill: now,
        skillCooldown: 4000,
        icdUntil: 0
      }
    } else if (layer === 18) {
      // 幻影大师
      return {
        x, y,
        size: Math.floor(baseSize * 1.3),
        color: '#bb00ff',
        health: Math.floor(baseHealth * 2.5),
        maxHealth: Math.floor(baseHealth * 2.5),
        type: 'phantom_master',
        isElite: true,
        speed: 1.5,
        lastSkill: now,
        skillCooldown: 6000,
        invisibleTimer: now, // **修复**：添加隐身计时器
        isInvisible: false,
        clone: null,
        icdUntil: 0
      }
    }
    
    return null
  }
  
  // 获取敌人的攻击冷却时间
  private getAttackCooldown(enemyType: string): number {
      switch (enemyType) {
      case 'infantry': return 0
      case 'bug': return 0
      case 'archer': return 4500 // 增加攻击冷却从3000ms到4500ms
      case 'sniper': return 3000 // 增加攻击冷却从1500ms到3000ms
      case 'shieldguard': return 0
      case 'bomb_bat': return 0
      case 'healer': return 3000
      case 'grenadier': return 4000
      case 'summoner': return 6000
      case 'phantom': return 0
      case 'boss': return 3000 // Boss远程攻击冷却从2000ms增加到3000ms
      default: return 2000
    }
  }
  
  // 获取技能冷却时间
  private getSkillCooldown(enemyType: string): number {
    switch (enemyType) {
      case 'healer': return 5000
      case 'summoner': return 8000
      case 'grenadier': return 4000
      case 'phantom': return 3000
      case 'boss': return 6000 // Boss特殊技能冷却
      default: return 5000
    }
  }

  // 更新敌人的AI和行为
  private updateEnemyAI(enemy: any, index: number) {
    // 更新敌人的状态效果（如冻结、中毒等）
    if (enemy.statusEffects && Array.isArray(enemy.statusEffects)) {
      const now = Date.now()
      if (!enemy.lastStatusUpdate) {
        enemy.lastStatusUpdate = now
      }
      const deltaTime = now - enemy.lastStatusUpdate
      enemy.lastStatusUpdate = now
      
      // 更新每个状态效果的持续时间，并应用效果
      enemy.statusEffects.forEach((effect: any) => {
        effect.duration -= deltaTime
        
        // 处理冻结效果
        if (effect.id === 'freeze' && effect.duration > 0) {
          enemy.speed = 0 // 冻结时速度为0
        } else if (effect.id === 'freeze' && effect.duration <= 0) {
          // 冻结效果结束，恢复原始速度（如果有保存的话）
          if (enemy.originalSpeed !== undefined) {
            enemy.speed = enemy.originalSpeed
          }
        }
        
        // 处理中毒效果
        if (effect.id === 'poison' && effect.duration > 0) {
          const poisonDamage = (effect.intensity || 0) * deltaTime / 1000 // 每秒伤害
          enemy.health -= poisonDamage
        }
      })
      
      // 移除已过期的状态效果
      enemy.statusEffects = enemy.statusEffects.filter((effect: any) => effect.duration > 0)
      
      // 如果敌人被冻结，直接返回，不执行移动逻辑
      const isFrozen = enemy.statusEffects.some((e: any) => e.id === 'freeze' && e.duration > 0)
      if (isFrozen) {
        return // 冻结时敌人不移动
      }
    }
    // **性能优化**：使用平方距离，只在需要时才计算真实距离
    const dx = this.playerX - enemy.x
    const dy = this.playerY - enemy.y
    const distanceSq = dx * dx + dy * dy
    
    // **性能优化**：延迟计算真实距离，只在需要移动时计算
    let distance = 0
    let needDistance = false
    const now = Date.now()
    
    // 内部函数：懒加载距离计算
    const getDistance = () => {
      if (!needDistance) {
        distance = Math.sqrt(distanceSq)
        needDistance = true
      }
      return distance
    }

    // 根据敌人类型执行不同行为
    switch (enemy.type) {
      case 'infantry':
        // 近战步兵：基础移动和接触伤害
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = enemy.speed || 0.7
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break
          
      case 'bug':
        // 快速虫：高速冲向玩家
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 2.0) * 2.0
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break
        
      case 'archer':
        // 弓箭手：远程攻击，保持距离
        const archerRange = 300
        const archerRangeSq = archerRange * archerRange
        if (distanceSq > archerRangeSq) {
          const dist = getDistance()
          if (dist > 0) {
            enemy.x += (dx / dist) * (enemy.speed || 0.8)
            enemy.y += (dy / dist) * (enemy.speed || 0.8)
          }
        } else {
          const keepDistance = this.ENEMY_SKILL_RANGES.ARCHER_KEEP_DISTANCE
          const keepDistanceSq = keepDistance * keepDistance
          if (distanceSq < keepDistanceSq) {
            const dist = getDistance()
            if (dist > 0) {
              enemy.x -= (dx / dist) * 0.3
              enemy.y -= (dy / dist) * 0.3
            }
          }
        }
        // 确保攻击冷却属性存在
        if (!enemy.lastAttack) enemy.lastAttack = now
        if (!enemy.attackCooldown) enemy.attackCooldown = this.getAttackCooldown('archer')
        
        if (now - enemy.lastAttack >= enemy.attackCooldown) {
          this.enemyRangedAttack(enemy)
          enemy.lastAttack = now
        }
        // 弓箭手没有接触伤害
        break
        
      case 'shieldguard':
        // 重装盾兵：缓慢移动，有护盾保护
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.4) * 0.4
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        
        // 护盾重生逻辑
        const shieldEnemy = enemy as any
        if (shieldEnemy.shield <= 0 && !shieldEnemy.shieldBroken) {
          shieldEnemy.shieldBroken = true
          shieldEnemy.shieldRegenTimer = now + this.ENEMY_SKILL_RANGES.SHIELDGUARD_SHIELD_REGEN_TIME
        } else if (shieldEnemy.shieldBroken && now >= shieldEnemy.shieldRegenTimer) {
          shieldEnemy.shield = shieldEnemy.maxShield
          shieldEnemy.shieldBroken = false
          // 添加护盾重生特效
          this.addHitEffect(enemy.x, enemy.y, false)
        }
        
        // 接触伤害带击退（护盾存在时击退更强）
        const shieldContactDist = 15 + (enemy.size || 20)
        const shieldContactDistSq = shieldContactDist * shieldContactDist
        if (distanceSq < shieldContactDistSq) {
          const dist = getDistance()
          if (dist > 0) {
            const knockback = shieldEnemy.shield > 0 ? 8 : 5
            const knockbackDx = (this.playerX - enemy.x) / dist * knockback
            const knockbackDy = (this.playerY - enemy.y) / dist * knockback
            this.playerX += knockbackDx
            this.playerY += knockbackDy
          }
        }
        this.handleContactDamage(enemy, this.currentLevel)
        break
        
      case 'bomb_bat':
        // 自爆蝠：快速移动，接近时主动自爆
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 1.2) * 1.2
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
          
          // 当距离足够近时主动自爆（使用平方距离优化）
          const explodeDistSq = 50 * 50
          if (distanceSq < explodeDistSq) {
            const explosionRadius = 100
            const explosionDamage = 20 + this.currentLevel * 2
            this.handleExplosion(enemy, explosionRadius, explosionDamage)
            
            // 添加爆炸特效
            this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
            this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
            
            // 移除敌人
            const enemyIndex = this.enemies.indexOf(enemy)
            if (enemyIndex !== -1) {
              this.enemies.splice(enemyIndex, 1)
              this.score += 15 // 主动自爆给予额外分数
            }
            return // 不执行接触伤害，因为已经自爆了
          }
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break
        
      case 'healer':
        // 治疗师：治疗附近的敌人
        const healerEnemy = enemy as any
        if (!healerEnemy.lastSkill) healerEnemy.lastSkill = now - 5000 // 让治疗师立即可以治疗
        if (!healerEnemy.skillCooldown) healerEnemy.skillCooldown = this.getSkillCooldown('healer')
        
        const healRange = this.ENEMY_SKILL_RANGES.HEALER_HEAL_RANGE
        const healRangeSq = healRange * healRange
        if (now - healerEnemy.lastSkill >= healerEnemy.skillCooldown) {
          // **性能优化**：使用传统for循环，限制检查数量
          const enemyCount = this.enemies.length
          const maxHealChecks = Math.min(enemyCount, 20) // 最多检查20个敌人
          for (let i = 0; i < maxHealChecks; i++) {
            const other = this.enemies[i]
            if (other !== enemy && other.health < other.maxHealth) {
              const dxx = other.x - enemy.x
              const dyy = other.y - enemy.y
              const distSq = dxx * dxx + dyy * dyy
              if (distSq < healRangeSq) {
                other.health = Math.min(other.maxHealth, other.health + 5 + this.currentLevel)
                // 添加治疗效果
                this.addHitEffect(other.x, other.y, false, '#00ff88')
              }
            }
          }
          healerEnemy.lastSkill = now
        }
        
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.6) * 0.6
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        // 治疗师没有接触伤害，专心治疗
        break
        
      case 'grenadier':
        // 投弹手：抛射抛物线攻击（使用技能冷却而非攻击冷却）
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.5) * 0.5
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        // 确保技能冷却属性存在
        if (!enemy.lastSkill) enemy.lastSkill = now
        if (!enemy.skillCooldown) enemy.skillCooldown = this.getSkillCooldown('grenadier')
        
        const grenadeAttackRange = this.ENEMY_SKILL_RANGES.GRENADIER_ATTACK_RANGE
        const grenadeAttackRangeSq = grenadeAttackRange * grenadeAttackRange
        if (now - enemy.lastSkill >= enemy.skillCooldown && distanceSq < grenadeAttackRangeSq) {
          const dist = getDistance()
          this.grenadierAttack(enemy, dist)
          enemy.lastSkill = now
        }
        break
        
      case 'summoner':
        // 召唤师：定期召唤小怪
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.5) * 0.5
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        if (now - enemy.lastSkill >= enemy.skillCooldown) {
          this.summonMinions(enemy)
          enemy.lastSkill = now
        }
        break
        
      case 'phantom':
        // 幻影刺客：隐身接近，背刺
        const phantomEnemy = enemy as any
        if (!phantomEnemy.invisibleTimer) phantomEnemy.invisibleTimer = 0
        
        // 隐身周期：每5秒隐身3秒
        const phantomInvisibleCycle = 5000 // 5秒一个周期
        const phantomInvisibleDuration = 3000 // 隐身3秒
        const phantomCycleTime = now % phantomInvisibleCycle
        phantomEnemy.isInvisible = phantomCycleTime < phantomInvisibleDuration
        
        // 隐身时移动更快，非隐身时正常
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speedMultiplier = phantomEnemy.isInvisible ? 1.5 : 1.0
            const speed = (enemy.speed || 1.8) * speedMultiplier
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        
        // 背刺检测：从玩家背后攻击时造成更高伤害
        // 判断是否在玩家背后：敌人的方向与玩家朝向相反
        const playerDirection = Math.atan2(this.playerY - this.playerLastY, this.playerX - this.playerLastX)
        const enemyToPlayer = Math.atan2(dy, dx)
        let angleDiff = Math.abs(enemyToPlayer - playerDirection)
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
        const isBackstab = angleDiff > Math.PI * 0.7 // 从背后约70%的角度
        
        const backstabRange = this.ENEMY_SKILL_RANGES.PHANTOM_BACKSTAB_RANGE
        const backstabRangeSq = backstabRange * backstabRange
        if (isBackstab && phantomEnemy.isInvisible && distanceSq < backstabRangeSq) {
          // 背刺：造成3倍伤害
          const backstabDamage = this.calculateContactDamage(this.currentLevel, 'phantom') * 3
          const nowTime = Date.now()
          if (nowTime >= this.playerIFrameUntil) {
            this.playerHealth -= backstabDamage
            this.playerIFrameUntil = nowTime + 500 // 短无敌帧
            this.addHitEffect(this.playerX, this.playerY, false, '#ff00ff')
            phantomEnemy.isInvisible = false // 背刺后显形
            phantomEnemy.invisibleTimer = now + 5000 // 5秒后才能再次隐身
          }
        } else {
          this.handleContactDamage(enemy, this.currentLevel)
        }
        break

      case 'charger':
        // 冲锋者：快速冲向玩家，接近时主动自爆
        // **关键修复**：标记自爆，不在此处删除，避免在遍历过程中修改数组
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 1.5) * (enemy.speed || 1.5)
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
          
          // 当距离足够近时标记自爆（不立即删除，避免在遍历中修改数组）
          const explodeDistSq = 40 * 40
          if (distanceSq < explodeDistSq && !(enemy as any).isExploding) {
            (enemy as any).isExploding = true // 标记正在爆炸，防止重复触发
            enemy.health = 0 // 设置为0，让死亡处理逻辑统一处理
            // 不在这里删除enemy，避免在updateEnemyAI遍历中修改数组导致索引问题
          }
        }
        // 检查接触伤害（如果还没爆炸）
        if (!(enemy as any).isExploding) {
          this.handleContactDamage(enemy, this.currentLevel)
        }
          break

      case 'heavy':
        // 重装者：缓慢移动，攻击带击退
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.5) * 0.5
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        // 接触伤害带击退
        const heavyContactDist = 15 + (enemy.size || 20)
        const heavyContactDistSq = heavyContactDist * heavyContactDist
        if (distanceSq < heavyContactDistSq) {
          // 击退玩家
          const dist = getDistance()
          if (dist > 0) {
            const knockback = 3
            const knockbackDx = (this.playerX - enemy.x) / dist * knockback
            const knockbackDy = (this.playerY - enemy.y) / dist * knockback
            this.playerX += knockbackDx
            this.playerY += knockbackDy
            this.handleContactDamage(enemy, this.currentLevel)
          }
        }
          break

      case 'sniper':
        // 狙击手：远程攻击，有预警线
        // 确保攻击冷却属性存在
        if (!enemy.lastAttack) enemy.lastAttack = now - 5000 // 让狙击兵立即可以攻击
        if (!enemy.attackCooldown) enemy.attackCooldown = this.getAttackCooldown('sniper')
        
        const sniperRange = this.ENEMY_SKILL_RANGES.SNIPER_ATTACK_RANGE
        const sniperRangeSq = sniperRange * sniperRange
        if (distanceSq > sniperRangeSq) {
          // 在攻击范围外，朝玩家移动
          const dist = getDistance()
          if (dist > 0) {
            enemy.x += (dx / dist) * (enemy.speed || 0.6)
            enemy.y += (dy / dist) * (enemy.speed || 0.6)
          }
        } else {
          // 在攻击范围内，保持距离并攻击
          const keepDistance = this.ENEMY_SKILL_RANGES.ARCHER_KEEP_DISTANCE
          const keepDistanceSq = keepDistance * keepDistance
          if (distanceSq < keepDistanceSq) {
            const dist = getDistance()
            if (dist > 0) {
              enemy.x -= (dx / dist) * 0.3
              enemy.y -= (dy / dist) * 0.3
            }
          }
          
          // 远程攻击
          if (now - enemy.lastAttack >= enemy.attackCooldown) {
            const dist = getDistance()
            console.log(`🎯 狙击兵开火！距离: ${dist.toFixed(1)}`)
            this.enemyRangedAttack(enemy)
            enemy.lastAttack = now
          }
        }
        break

        case 'support':
        // 支援者：为附近友军加buff
        // **性能优化**：限制检查数量，使用传统for循环
        const supportRange = 200
        const supportRangeSq = supportRange * supportRange
        const supportEnemyCount = this.enemies.length
        const maxSupportChecks = Math.min(supportEnemyCount, 15) // 最多检查15个敌人
        for (let i = 0; i < maxSupportChecks; i++) {
          const other = this.enemies[i]
          if (other !== enemy) {
            const dxx = other.x - enemy.x
            const dyy = other.y - enemy.y
            const friendDistSq = dxx * dxx + dyy * dyy
            if (friendDistSq < supportRangeSq) {
              // 给友军加速
              other.speed = (other.speed || 1.0) * 1.2
            }
          }
        }
        // 接触伤害
        this.handleContactDamage(enemy, this.currentLevel)
          break

      case 'fortress':
        // 堡垒：护盾减伤，召唤墙壁
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.8) * 0.8
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        // 技能：召唤护盾
        if (now - enemy.lastSkill >= enemy.skillCooldown) {
          this.createBarrier(enemy)
          enemy.lastSkill = now
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break

        case 'hunter':
        // 猎犬：闪现攻击
        if (distance > 0) {
          const speed = (enemy.speed || 1.5) * 1.5
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        // 技能：闪现到玩家身后
        if (now - enemy.lastSkill >= enemy.skillCooldown && distance < 150) {
          enemy.x = this.playerX - dx * 2
          enemy.y = this.playerY - dy * 2
          enemy.lastSkill = now
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break

      case 'shaman':
        // 巫医：召唤敌人和治疗
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.8) * 0.8
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        // 技能：召唤和治疗
        if (now - enemy.lastSkill >= enemy.skillCooldown) {
          this.shamanSummon(enemy)
          enemy.lastSkill = now
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break

      case 'boss':
        // Boss：多阶段战斗，拥有远程攻击和特殊技能
        const bossEnemy = enemy as any
        
        // Boss护盾重生逻辑（比护盾兵更快）
        if (bossEnemy.shield <= 0 && !bossEnemy.shieldBroken) {
          bossEnemy.shieldBroken = true
          bossEnemy.shieldRegenTimer = now + 3000 // 3秒后重生护盾
        } else if (bossEnemy.shieldBroken && now >= bossEnemy.shieldRegenTimer) {
          bossEnemy.shield = bossEnemy.maxShield
          bossEnemy.shieldBroken = false
          // 添加护盾重生特效
          this.addHitEffect(enemy.x, enemy.y, true, '#ffff00')
        }
        
        // Boss根据血量进入不同阶段
        const bossHealthPercent = enemy.health / enemy.maxHealth
        if (bossHealthPercent < 0.3 && bossEnemy.phase < 3) {
          bossEnemy.phase = 3 // 狂暴阶段
          bossEnemy.speed *= 1.5
        } else if (bossHealthPercent < 0.6 && bossEnemy.phase < 2) {
          bossEnemy.phase = 2 // 激活阶段
          bossEnemy.speed *= 1.2
        }
        
        // Boss移动逻辑
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.6) * (1 + (bossEnemy.phase - 1) * 0.3)
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        
        // Boss远程攻击（多发投射物）
        if (!enemy.lastAttack) enemy.lastAttack = now - 3000
        if (!enemy.attackCooldown) enemy.attackCooldown = this.getAttackCooldown('boss') // 使用统一的攻击冷却时间（3000ms）
        
        if (now - enemy.lastAttack >= enemy.attackCooldown && distanceSq > 0) {
          // 技能特效：远程攻击充能
          this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
            count: 10 * bossEnemy.phase,
            spread: 360,
            speed: { min: 2, max: 5 },
            size: { min: 2, max: 4 },
            life: { min: 200, max: 400 },
            colors: ['#FF6600', '#FF8800', '#FFFF00'],
            fadeOut: true
          })
          
          // 发射多发投射物（不使用setTimeout，直接发射但有微小角度差异）
          for (let i = 0; i < bossEnemy.phase; i++) {
            const baseAngle = Math.atan2(dy, dx)
            const angle = baseAngle + (i - bossEnemy.phase/2 + 0.5) * 0.3
            const bulletSpeed = 10
            const vx = Math.cos(angle) * bulletSpeed
            const vy = Math.sin(angle) * bulletSpeed
            
            // Boss远程伤害计算（与普通远程敌人相同的方式）
            let baseDamage: number
            if (this.currentLevel <= 6) {
              baseDamage = 0.6 + (this.currentLevel - 1) * 0.05
            } else if (this.currentLevel <= 10) {
              baseDamage = 0.85 + (this.currentLevel - 6) * 0.25
            } else if (this.currentLevel <= 15) {
              baseDamage = 1.85 + (this.currentLevel - 10) * 0.35
            } else {
              baseDamage = 3.6 + (this.currentLevel - 15) * 0.5
            }
            // Boss远程伤害是普通远程的1.5倍
            const bossDamage = baseDamage * 1.5
            
            this.projectiles.push({
              x: enemy.x,
              y: enemy.y,
              vx,
              vy,
              damage: bossDamage,
              isCrit: Math.random() < 0.2,
              life: 300,
              pierce: 0,
              maxPierce: 2,
              owner: 'enemy',
              isGrenade: false
            })
          }
          enemy.lastAttack = now
        }
        
        // Boss特殊技能
        if (now - enemy.lastSkill >= enemy.skillCooldown) {
          if (bossEnemy.phase >= 2) {
            // 召唤小怪 - 添加召唤特效
            this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
              count: 30,
              spread: 360,
              speed: { min: 1, max: 3 },
              size: { min: 3, max: 6 },
              life: { min: 400, max: 800 },
              colors: ['#FF6600', '#FF8800', '#FFFFFF'],
              fadeOut: true
            })
            this.summonMinions(enemy)
          }
          if (bossEnemy.phase >= 3) {
            // 狂暴阶段：范围攻击 - 添加充能特效
            this.effectsSystem.createParticleEffect('fire_burst', enemy.x, enemy.y, {
              count: 40,
              spread: 360,
              speed: { min: 3, max: 8 },
              size: { min: 4, max: 10 },
              life: { min: 300, max: 600 },
              colors: ['#FF0000', '#FF4400', '#FF8800'],
              fadeOut: true
            })
            
            const explosionRadius = 120
            // **修复**：Boss爆炸伤害减半
            const explosionDamage = (this.currentLevel <= 3 ? 15 + this.currentLevel * 3 :
                                    this.currentLevel <= 10 ? 24 + (this.currentLevel - 3) * 3.5 :
                                    45 + (this.currentLevel - 10) * 4) * 0.5
            this.handleExplosion(enemy, explosionRadius, explosionDamage)
            this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
            this.effectsSystem.addScreenEffect('shake', 0.5, 300, '#FF0000')
          }
          enemy.lastSkill = now
        }
        
        // Boss接触伤害更高
        this.handleContactDamage(enemy, this.currentLevel)
          break

      case 'infantry_captain':
        // 第5层Boss：重装指挥官
        const commander = enemy as any
        if (!commander.lastAttack) commander.lastAttack = now - 3000
        if (!commander.attackCooldown) commander.attackCooldown = 2000
        if (!commander.lastSkill) commander.lastSkill = now
        if (!commander.skillCooldown) commander.skillCooldown = 12000
        
        // 移动：缓慢接近（确保distance > 0）
        const commanderMoveRangeSq = 150 * 150
        if (distanceSq > commanderMoveRangeSq) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.8) * 0.8
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        
        // 远程攻击：重炮轰击（3发炮弹，扇形）
        const attackRangeSq = 400 * 400
        if (now - commander.lastAttack >= commander.attackCooldown && distanceSq > 0 && distanceSq < attackRangeSq) {
          // 技能特效：重炮充能
          this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
            count: 30,
            spread: 360,
            speed: { min: 2, max: 5 },
            size: { min: 4, max: 8 },
            life: { min: 300, max: 600 },
            colors: ['#FF4444', '#FF8800', '#FFFF00'],
            fadeOut: true
          })
          this.addHitEffect(enemy.x, enemy.y, true, '#FF4444')
          
          for (let i = 0; i < 3; i++) {
            const angle = Math.atan2(dy, dx) + (i - 1) * 0.4
            const bulletSpeed = 8
            // **修复**：降低Boss远程伤害，使用与普通远程敌人相同的计算方式
            let baseDamage: number
            if (this.currentLevel <= 6) {
              baseDamage = 0.6 + (this.currentLevel - 1) * 0.05 // 前6层极低伤害
            } else if (this.currentLevel <= 10) {
              baseDamage = 0.85 + (this.currentLevel - 6) * 0.25 // 第7-10层开始增长
            } else if (this.currentLevel <= 15) {
              baseDamage = 1.85 + (this.currentLevel - 10) * 0.35 // 第11-15层中等增长
            } else {
              baseDamage = 3.6 + (this.currentLevel - 15) * 0.5 // 第16层之后正常增长
            }
            // Boss远程伤害是普通远程的1.5倍
            const bossDamage = baseDamage * 1.5
            this.projectiles.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle) * bulletSpeed,
              vy: Math.sin(angle) * bulletSpeed,
              damage: bossDamage,
              isCrit: false,
              life: 400,
              pierce: 0,
              maxPierce: 1,
              owner: 'enemy',
              isGrenade: false
            })
          }
          commander.lastAttack = now
        }
        
        // 技能：步兵方阵（召唤）
        if (now - commander.lastSkill >= (commander.skillCooldown || 12000)) {
          // 技能特效：召唤阵
          this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
            count: 50,
            spread: 360,
            speed: { min: 1, max: 3 },
            size: { min: 3, max: 6 },
            life: { min: 500, max: 1000 },
            colors: ['#00B7FF', '#0088FF', '#FFFFFF'],
            fadeOut: true
          })
          this.summonMinions(enemy, 4)
          commander.lastSkill = now
        }
        
        this.handleContactDamage(enemy, this.currentLevel)
        break

      case 'fortress_guard':
        // 第10层Boss：虫巢母体
        const hiveMother = enemy as any
        // 安全检查：确保enemy有效且未死亡
        if (!enemy || enemy.health <= 0) {
          // 如果Boss已死亡，清理所有待孵化的虫卵，避免继续处理
          if (hiveMother && hiveMother.pendingEggs && Array.isArray(hiveMother.pendingEggs)) {
            hiveMother.pendingEggs = []
          }
          break
        }
        
        // 初始化属性（只初始化一次）
        if (!hiveMother.lastSkill) hiveMother.lastSkill = now
        if (!hiveMother.skillCooldown) hiveMother.skillCooldown = 5000
        if (!hiveMother.lastBoomHatch) hiveMother.lastBoomHatch = now - 8000
        if (!hiveMother.pendingEggs) hiveMother.pendingEggs = []
        
        // **关键修复**：严格限制 pendingEggs 数组大小，防止无限增长导致卡死
        if (hiveMother.pendingEggs.length > 30) {
          console.warn(`[fortress_guard] pendingEggs 数组过大 (${hiveMother.pendingEggs.length})，清理旧数据`)
          // 只保留最近的15个
          hiveMother.pendingEggs = hiveMother.pendingEggs.slice(-15)
        }
        
        // **额外安全检查**：如果数组仍然异常大，强制清理
        if (hiveMother.pendingEggs.length > 50) {
          console.error(`[fortress_guard] 严重错误：pendingEggs 数组异常大 (${hiveMother.pendingEggs.length})，强制清空`)
          hiveMother.pendingEggs = []
        }
        
        // 移动：缓慢蠕动（确保distance > 0且有效）
        const hiveMoveRangeSq = 200 * 200
        if (distanceSq > hiveMoveRangeSq && isFinite(dx) && isFinite(dy)) {
          const dist = getDistance()
          if (dist > 0 && isFinite(dist)) {
            const speed = (enemy.speed || 0.3) * 0.3
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        
        // 技能1：虫巢繁殖（每5秒生成快速虫）
        // 确保时间差计算正确，避免立即触发
        const skillTimeDiff = now - hiveMother.lastSkill
        if (skillTimeDiff >= 5000 && skillTimeDiff < 100000) { // 添加上限防止异常大的时间差
          // 技能特效：虫巢脉动（绿色能量爆发）
          this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
            count: 60,
            spread: 360,
            speed: { min: 1, max: 4 },
            size: { min: 4, max: 10 },
            life: { min: 400, max: 800 },
            colors: ['#39FF14', '#00FF88', '#88FF44'],
            fadeOut: true
          })
          
          // 在Boss周围3个位置生成快速虫
          for (let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2
            const spawnX = enemy.x + Math.cos(angle) * 60
            const spawnY = enemy.y + Math.sin(angle) * 60
            const baseHealth = (20 * (1.0 + (this.currentLevel - 1) * 0.1)) * 0.15
            const baseSize = 18 + this.currentLevel * 0.5
            const bug = this.createEnemyByType('bug', this.currentLevel, spawnX, spawnY, baseHealth, baseSize * 0.8)
            if (bug) {
              bug.speed = 2.5 // 更快的快速虫
              // 限制pendingEnemies数量，防止无限增长
              // 同时检查总敌人数量，防止超过上限
              if (this.pendingEnemies.length < 50 && this.enemies.length + this.pendingEnemies.length < this.MAX_ENEMIES) {
                this.pendingEnemies.push(bug) // 使用待添加队列，避免在循环中修改数组
              }
            }
            // 每个生成点都有特效
            this.addHitEffect(spawnX, spawnY, false, '#39FF14')
          }
          hiveMother.lastSkill = now
        }
        
        // 技能2：爆虫孵化（每10秒）
        // 先检查并孵化待孵化的虫卵
        if (hiveMother.pendingEggs && hiveMother.pendingEggs.length > 0) {
          // 限制每次处理的虫卵数量，防止单帧处理过多导致卡顿
          const maxEggsToProcess = 10
          let processedCount = 0
          
          // 从后往前遍历并删除，避免索引变化问题
          for (let i = hiveMother.pendingEggs.length - 1; i >= 0 && processedCount < maxEggsToProcess; i--) {
            const egg = hiveMother.pendingEggs[i]
            if (!egg) {
              // 如果egg无效，直接删除
              hiveMother.pendingEggs.splice(i, 1)
              continue
            }
            
            // 检查是否应该孵化（如果超过孵化时间太久，直接删除）
            if (now >= egg.hatchTime) {
              // 如果孵化时间超过5秒还没处理，可能是异常情况，直接删除
              if (now - egg.hatchTime > 5000) {
                hiveMother.pendingEggs.splice(i, 1)
                continue
              }
              
              // 孵化自爆虫
              const exploder = this.createEnemyByType('charger', this.currentLevel, egg.x, egg.y, 1, 12)
              if (exploder) {
                exploder.speed = 2.0 // 降低速度，避免立即冲向玩家
                exploder.health = 1
                // 限制pendingEnemies数量，防止无限增长
                // 同时检查总敌人数量，防止超过上限
                if (this.pendingEnemies.length < 30 && this.enemies.length + this.pendingEnemies.length < this.MAX_ENEMIES) {
                  this.pendingEnemies.push(exploder) // 使用待添加队列
                }
              }
              // 直接从后往前删除，避免索引变化
              hiveMother.pendingEggs.splice(i, 1)
              processedCount++
            }
          }
        }
        
        // 生成新的虫卵（每10秒）
        // **性能优化**：如果敌人数量已经很多，减少虫卵生成频率
        const boomTimeDiff = now - hiveMother.lastBoomHatch
        const hiveEnemyCount = this.enemies.length + this.pendingEnemies.length
        const shouldSpawnEggs = hiveEnemyCount < this.MAX_ENEMIES * 0.8 // 敌人数量少于80%上限时才生成虫卵
        
        if (boomTimeDiff >= 10000 && boomTimeDiff < 100000 && shouldSpawnEggs) {
          // 技能特效：爆虫预警（红色危险警告）- 减少粒子数量提升性能
          this.effectsSystem.createParticleEffect('fire_burst', this.playerX, this.playerY, {
            count: 15, // 进一步减少粒子数量
            spread: 360,
            speed: { min: 0.5, max: 2 },
            size: { min: 6, max: 12 },
            life: { min: 500, max: 1500 },
            colors: ['#FF0000', '#FF4400', '#FF8800'],
            fadeOut: true
          })
          
          // 在玩家位置生成虫卵（2秒后孵化）
          // 根据敌人数量动态调整虫卵数量
          const eggCount = hiveEnemyCount < 50 ? 3 : 2 // 敌人少时生成3个，敌人多时只生成2个
          for (let i = 0; i < eggCount && hiveMother.pendingEggs.length < 20; i++) {
            const offsetAngle = (i - eggCount/2 + 0.5) * 0.3
            const eggX = this.playerX + Math.cos(offsetAngle) * 30
            const eggY = this.playerY + Math.sin(offsetAngle) * 30
            hiveMother.pendingEggs.push({
              x: eggX,
              y: eggY,
              hatchTime: now + 2000
            })
          }
          hiveMother.lastBoomHatch = now
        }
        
        this.handleContactDamage(enemy, this.currentLevel)
        break

      case 'void_shaman':
        // 第15层Boss：暗影刺客
        const assassin = enemy as any
        if (!assassin.lastAttack) assassin.lastAttack = now - 5000
        if (!assassin.attackCooldown) assassin.attackCooldown = 2000
        if (!assassin.lastSkill) assassin.lastSkill = now
        if (!assassin.skillCooldown) assassin.skillCooldown = 18000
        if (!assassin.invisibleTimer) assassin.invisibleTimer = now
        if (assassin.isInvisible === undefined) assassin.isInvisible = true
        
        // 隐身周期：8-12秒隐身，然后现身攻击
        const assassinInvisibleCycle = 10000 // 10秒周期
        const assassinCycleTime = (now - assassin.invisibleTimer) % assassinInvisibleCycle
        assassin.isInvisible = assassinCycleTime < 8000 // 前8秒隐身，后2秒现身
        
        // 隐身时移动更快（确保distance > 0）
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speedMultiplier = assassin.isInvisible ? 1.5 : 1.0
            const speed = (enemy.speed || 0.5) * speedMultiplier
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        
        // 现身时进行攻击
        if (!assassin.isInvisible && now - assassin.lastAttack >= 2000) {
          // 致命背刺：闪现到玩家身后攻击
          const backAngle = Math.atan2(-dy, -dx)
          enemy.x = this.playerX + Math.cos(backAngle) * 50
          enemy.y = this.playerY + Math.sin(backAngle) * 50
          
          // 技能特效：暗影闪现（紫色粒子爆发）
          this.effectsSystem.createParticleEffect('shadow_particles', enemy.x, enemy.y, {
            count: 40,
            spread: 360,
            speed: { min: 3, max: 6 },
            size: { min: 3, max: 8 },
            life: { min: 300, max: 600 },
            colors: ['#FF00FF', '#8800FF', '#4400AA'],
            fadeOut: true
          })
          this.effectsSystem.addScreenEffect('flash', 0.5, 200, '#FF00FF')
          
          // 造成高额伤害（最大生命值的40%，增加伤害）
          const backstabDamage = this.playerMaxHealth * 0.4
          if (now >= this.playerIFrameUntil) {
            this.playerHealth -= backstabDamage
            this.playerIFrameUntil = now + 500
            this.addHitEffect(this.playerX, this.playerY, false, '#ff00ff')
          }
          
          assassin.lastAttack = now
        }
        
        // 技能：飞镖阵列
        if (now - assassin.lastSkill >= (assassin.skillCooldown || 18000)) {
          // 技能特效：飞镖充能（红色旋转粒子）
          this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
            count: 80,
            spread: 360,
            speed: { min: 2, max: 5 },
            size: { min: 2, max: 5 },
            life: { min: 400, max: 800 },
            colors: ['#FF0000', '#FF4400', '#FF8800'],
            fadeOut: true
          })
          
          // 发射6枚追踪飞镖
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2
            const bulletSpeed = 7
            this.projectiles.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle) * bulletSpeed,
              vy: Math.sin(angle) * bulletSpeed,
              damage: 25 + this.currentLevel * 4, // 增加伤害：25 + 层数×4
              isCrit: false,
              life: 600,
              pierce: 0,
              maxPierce: 0,
              owner: 'enemy',
              isGrenade: false
            })
          }
          assassin.lastSkill = now
        }
        
        if (!assassin.isInvisible) {
          this.handleContactDamage(enemy, this.currentLevel)
        }
        break

      case 'legion_commander':
        // 第20层Boss：混沌造物（三阶段）
        const chaos = enemy as any
        if (!chaos.phase) chaos.phase = 1
        if (!chaos.lastAttack) chaos.lastAttack = now - 3000
        if (!chaos.attackCooldown) chaos.attackCooldown = 2000
        if (!chaos.lastSkill) chaos.lastSkill = now
        if (!chaos.skillCooldown) chaos.skillCooldown = 9000
        
        const chaosHealthPercent = enemy.health / enemy.maxHealth
        
        // 阶段判断
        if (chaosHealthPercent <= 0.3 && chaos.phase < 3) {
          chaos.phase = 3
        } else if (chaosHealthPercent <= 0.7 && chaos.phase < 2) {
          chaos.phase = 2
        }
        
        // 阶段1：混沌巨兽（近战）
        if (chaos.phase === 1) {
          if (distanceSq > 0) {
            const dist = getDistance()
            if (dist > 0) {
              const speed = (enemy.speed || 0.6) * 0.6
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
            }
          }
          // 技能：混沌重击（扇形范围）
          if (now - chaos.lastSkill >= 9000) {
            // 技能特效：混沌能量聚集（橙红色能量波动）
            this.effectsSystem.createParticleEffect('fire_burst', enemy.x, enemy.y, {
              count: 50, // **性能优化**：减少粒子数量
              spread: 60, // 扇形60度（使用度数）
              speed: { min: 3, max: 8 },
              size: { min: 5, max: 12 },
              life: { min: 500, max: 1000 },
              colors: ['#FF4500', '#FF8800', '#FFAA00'],
              fadeOut: true
            })
            const hitAngle = Math.atan2(dy, dx)
            // 扇形范围攻击（使用平方距离优化）
            const hitRangeSq = 150 * 150
            if (distanceSq < hitRangeSq) {
              const damage = 40 + this.currentLevel * 8 // 增加伤害
              if (now >= this.playerIFrameUntil) {
                this.playerHealth -= damage
                this.playerIFrameUntil = now + 500
                this.effectsSystem.addScreenEffect('shake', 0.5, 400, '#FF4500')
              }
            }
            chaos.lastSkill = now
          }
        }
        // 阶段2：混沌织法者（远程）
        else if (chaos.phase === 2) {
          // 保持距离（使用平方距离优化）
          const keepRangeSq = 200 * 200
          if (distanceSq < keepRangeSq) {
            const dist = getDistance()
            if (dist > 0) {
              enemy.x -= (dx / dist) * 0.5
              enemy.y -= (dy / dist) * 0.5
            }
          }
          // 元素洪流：交替发射冰火雷
          if (now - chaos.lastSkill >= 12000) {
            // 技能特效：元素能量爆发（彩虹色粒子）
            const elementColors = [
              ['#00AAFF', '#88CCFF', '#FFFFFF'], // 冰
              ['#FF4400', '#FF8800', '#FFAA00'], // 火
              ['#AA00FF', '#FF00FF', '#FFFFFF']  // 雷
            ]
            const elementIndex = Math.floor((now / 4000) % 3)
            this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
              count: 80,
              spread: 40, // 扇形40度（使用度数）
              speed: { min: 4, max: 8 },
              size: { min: 4, max: 10 },
              life: { min: 500, max: 1000 },
              colors: elementColors[elementIndex],
              fadeOut: true
            })
            
            const angle = Math.atan2(dy, dx)
            const bulletSpeed = 9
            this.projectiles.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle) * bulletSpeed,
              vy: Math.sin(angle) * bulletSpeed,
              damage: 35 + this.currentLevel * 6, // 增加伤害
              isCrit: false,
              life: 500,
              pierce: 0,
              maxPierce: 2,
              owner: 'enemy',
              isGrenade: false
            })
            chaos.lastSkill = now
          }
        }
        // 阶段3：混沌本源（高速移动）
        else {
          if (distanceSq > 0) {
            const dist = getDistance()
            if (dist > 0) {
              const speed = (enemy.speed || 0.6) * 1.5 * (1 + (1 - chaosHealthPercent)) // 血量越低越快
              enemy.x += (dx / dist) * speed
              enemy.y += (dy / dist) * speed
            }
          }
          // 混沌突袭：高速冲刺留下伤害轨迹
          if (now - chaos.lastSkill >= 8000) {
            // 技能特效：混沌冲刺轨迹（彩虹尾迹）
            const startX = enemy.x
            const startY = enemy.y
            this.effectsSystem.createParticleEffect('magic_burst', startX, startY, {
              count: 120,
              spread: 360,
              speed: { min: 5, max: 12 },
              size: { min: 3, max: 8 },
              life: { min: 300, max: 800 },
              colors: ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#00AAFF', '#8800FF', '#FF00FF'],
              fadeOut: true
            })
            
            // 冲刺到玩家位置
            enemy.x = this.playerX
            enemy.y = this.playerY
            
            // 终点特效
            this.effectsSystem.createParticleEffect('explosion_debris', this.playerX, this.playerY, {
              count: 60,
              spread: 360,
              speed: { min: 2, max: 6 },
              size: { min: 4, max: 10 },
              life: { min: 400, max: 900 },
              colors: ['#FFFFFF', '#FF00FF', '#AA00FF'],
              fadeOut: true
            })
            this.effectsSystem.addScreenEffect('shake', 0.6, 500, '#FF00FF')
            
            const dashDamage = 35 + this.currentLevel * 6 // 增加伤害
            if (now >= this.playerIFrameUntil) {
              this.playerHealth -= dashDamage
              this.playerIFrameUntil = now + 300
            }
            chaos.lastSkill = now
          }
        }
        
        this.handleContactDamage(enemy, this.currentLevel)
        break

      case 'shield_captain':
        // 重装队长（精英）：类似重装盾兵，但更强
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.5) * 0.5
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        // 技能：护盾重生（如果需要）
        const shieldCaptain = enemy as any
        if (shieldCaptain.shield !== undefined && shieldCaptain.shield <= 0 && !shieldCaptain.shieldBroken) {
          shieldCaptain.shieldBroken = true
          shieldCaptain.shieldRegenTimer = now + 5000
        } else if (shieldCaptain.shieldBroken && now >= shieldCaptain.shieldRegenTimer) {
          shieldCaptain.shield = shieldCaptain.maxShield || 50
          shieldCaptain.shieldBroken = false
          this.addHitEffect(enemy.x, enemy.y, false)
        }
        this.handleContactDamage(enemy, this.currentLevel)
        break
        
      case 'elite_healer':
        // 精英治疗师：类似治疗师，但治疗范围更大
        const eliteHealer = enemy as any
        if (!eliteHealer.lastSkill) eliteHealer.lastSkill = now - 4000
        if (!eliteHealer.skillCooldown) eliteHealer.skillCooldown = 4000
        
        const eliteHealRange = 200 // 更大的治疗范围
        const eliteHealRangeSq = eliteHealRange * eliteHealRange
        if (now - eliteHealer.lastSkill >= eliteHealer.skillCooldown) {
          const enemyCount = this.enemies.length
          const maxHealChecks = Math.min(enemyCount, 20)
          for (let i = 0; i < maxHealChecks; i++) {
            const other = this.enemies[i]
            if (other !== enemy && other.health < other.maxHealth) {
              const dxx = other.x - enemy.x
              const dyy = other.y - enemy.y
              const distSq = dxx * dxx + dyy * dyy
              if (distSq < eliteHealRangeSq) {
                other.health = Math.min(other.maxHealth, other.health + 8 + this.currentLevel)
                this.addHitEffect(other.x, other.y, false, '#00ff88')
              }
            }
          }
          eliteHealer.lastSkill = now
        }
        
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = (enemy.speed || 0.6) * 0.6
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        break
        
      case 'phantom_master':
        // 幻影大师：类似幻影刺客，但更强
        const phantomMaster = enemy as any
        if (!phantomMaster.invisibleTimer) phantomMaster.invisibleTimer = 0
        
        const phantomMasterInvisibleCycle = 5000
        const phantomMasterInvisibleDuration = 3000
        const phantomMasterCycleTime = now % phantomMasterInvisibleCycle
        phantomMaster.isInvisible = phantomMasterCycleTime < phantomMasterInvisibleDuration
        
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speedMultiplier = phantomMaster.isInvisible ? 1.5 : 1.0
            const speed = (enemy.speed || 1.5) * speedMultiplier
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        
        // 技能：召唤幻影分身（如果需要）
        if (now - enemy.lastSkill >= (enemy.skillCooldown || 6000)) {
          // 可以在这里添加召唤分身的逻辑
          enemy.lastSkill = now
        }
        
        this.handleContactDamage(enemy, this.currentLevel)
        break
        
      default:
        // 默认行为：朝玩家移动（修复：使用getDistance()确保距离被计算）
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            const speed = enemy.speed || 0.7
            enemy.x += (dx / dist) * speed
            enemy.y += (dy / dist) * speed
          }
        }
        this.handleContactDamage(enemy, this.currentLevel)
        break
    }
    
    // **修复**：添加边界检查，确保敌人不会移出屏幕（特别是边缘生成的精英怪）
    // 但允许敌人稍微超出边界，以便从边缘进入屏幕
    const margin = 50 // 允许超出50像素
    enemy.x = Math.max(-margin, Math.min(this.canvas.width + margin, enemy.x))
    enemy.y = Math.max(-margin, Math.min(this.canvas.height + margin, enemy.y))
  }

  // 敌人的远程攻击
  private enemyRangedAttack(enemy: any) {
    // 创建预警线 - 使用当前玩家位置
    const now = Date.now()
    enemy.warningLine = {
      startX: enemy.x,
      startY: enemy.y,
      endX: this.playerX,
      endY: this.playerY,
      time: now
    }

    // 1秒后发射子弹 - 使用发射时的最新玩家位置
    setTimeout(() => {
      // 检查敌人是否还存在
      if (enemy && this.enemies.includes(enemy)) {
        // **修复**：使用当前最新的玩家位置，而不是1秒前的位置
        const dx = this.playerX - enemy.x
        const dy = this.playerY - enemy.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance > 0) {
          // 投射物速度：每帧10像素（与玩家投射物速度类似，玩家是12每帧）
          const bulletSpeed = 10
          const vx = (dx / distance) * bulletSpeed
          const vy = (dy / distance) * bulletSpeed

          // **修复**：前6层保持极低伤害，从第7层开始增加
          let baseDamage: number
          if (this.currentLevel <= 6) {
            // 前6层：极低伤害（保持稳定）
            baseDamage = 0.6 + (this.currentLevel - 1) * 0.05 // 0.6, 0.65, 0.7, 0.75, 0.8, 0.85
          } else if (this.currentLevel <= 10) {
            // 第7-10层：开始缓慢增长
            baseDamage = 0.85 + (this.currentLevel - 6) * 0.25 // 1.1, 1.35, 1.6, 1.85
          } else if (this.currentLevel <= 15) {
            // 第11-15层：中等增长
            baseDamage = 1.85 + (this.currentLevel - 10) * 0.35 // 2.2, 2.55, 2.9, 3.25, 3.6
          } else {
            // 第16层之后：正常增长
            baseDamage = 3.6 + (this.currentLevel - 15) * 0.5
          }
          
          let damage = baseDamage
          if (enemy.type === 'archer') {
            // 弓箭手：伤害与基础相同（不再额外增加）
            damage = baseDamage * 1.0
          } else if (enemy.type === 'sniper') {
            // 狙击手：只比基础高3%（大幅降低）
            damage = baseDamage * 1.03
          }

          const newProjectile = {
            x: enemy.x,
            y: enemy.y,
            vx,
            vy,
            damage,
            isCrit: Math.random() < 0.15, // 15% 暴击率
            life: 360, // 增加生命周期到6秒（360帧，60fps）
            pierce: 0,
            maxPierce: 0, // 敌人投射物不能穿透，击中即消失
            owner: 'enemy' as const,
            isGrenade: false // 明确标记不是炸弹
          }
          
          this.projectiles.push(newProjectile)
          
          console.log(`💥 ${enemy.type}发射投射物! 伤害: ${damage}, 速度: (${vx.toFixed(2)}, ${vy.toFixed(2)}), 起始位置: (${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}), 目标位置: (${this.playerX.toFixed(1)}, ${this.playerY.toFixed(1)}), 目标距离: ${distance.toFixed(1)}, 投射物数组大小: ${this.projectiles.length}`)
          
          // 添加射击特效
          this.addHitEffect(enemy.x, enemy.y, false)
          
          // 播放敌人远程攻击音效
          this.audioSystem.playSoundEffect('enemy_attack', {
            volume: enemy.type === 'sniper' ? 1.2 : 1.0,
            pitch: enemy.type === 'sniper' ? 0.8 : 1.0 // 狙击手音调更低
          })
        }
      }
      
      // 清除预警线
      if (enemy) {
        enemy.warningLine = undefined
      }
    }, 1000)
  }

  // 创建护盾墙
  private createBarrier(enemy: any) {
    // 创建阻挡投射物的墙壁特效
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8
      const offsetX = Math.cos(angle) * 100
      const offsetY = Math.sin(angle) * 100

      this.effects.push({
        x: enemy.x + offsetX,
        y: enemy.y + offsetY,
        type: 'barrier',
        life: 300, // 5秒
        size: 15
      })
    }
  }

  // 巫医召唤
  private shamanSummon(enemy: any) {
    // 召唤2个基础敌人
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2
      const offset = 50 + Math.random() * 50
      const spawnX = enemy.x + Math.cos(angle) * offset
      const spawnY = enemy.y + Math.sin(angle) * offset

      const basicEnemy = this.createEnemyByLevel(this.currentLevel, spawnX, spawnY)
      this.enemies.push(basicEnemy)
    }

    // 治疗光环：治疗附近敌人
    this.enemies.forEach(other => {
      const dxx = other.x - enemy.x
      const dyy = other.y - enemy.y
      const distSq = dxx * dxx + dyy * dyy
      const healRange = this.ENEMY_SKILL_RANGES.HEALER_HEAL_RANGE
      const healRangeSq = healRange * healRange
      if (distSq < healRangeSq && other !== enemy && other.health < other.maxHealth) {
        other.health = Math.min(other.maxHealth, other.health + 5)
      }
    })
  }
  
  // 投弹手攻击
  private grenadierAttack(enemy: any, distance: number) {
    // 预测玩家位置
    const dx = this.playerX - enemy.x
    const dy = this.playerY - enemy.y
    
    // 计算抛射角度和速度（简化的抛物线计算）
    const gravity = 0.2
    const angle = Math.atan2(dy, dx)
    // 使用固定的初始速度，更简单的抛物线
    const initialSpeed = Math.min(8, Math.max(4, distance / 30))
    
    // 创建抛物线弹道
    const vx = Math.cos(angle) * initialSpeed
    const vy = Math.sin(angle) * initialSpeed - 2 // 初始向上速度
    
    const grenadeDamage = 15 + this.currentLevel * 2
    
    this.projectiles.push({
      x: enemy.x,
      y: enemy.y,
      vx,
      vy,
      damage: grenadeDamage,
      isCrit: false,
      life: 300, // 增加生命周期，确保有时间落地
      pierce: 0,
      maxPierce: 0,
      isGrenade: true,
      owner: 'enemy'
    })
    
    console.log(`💣 投弹手发射！目标距离: ${distance.toFixed(1)}, 预计伤害: ${grenadeDamage}`)
  }
  
  // 召唤师召唤
  private summonMinions(enemy: any, count: number = 2, minionType: string = 'bug') {
    // 召唤小怪，使用createEnemyByType确保完整初始化
    const spawnMinDist = this.ENEMY_SKILL_RANGES.SUMMONER_SPAWN_DISTANCE
    const spawnMaxDist = this.ENEMY_SKILL_RANGES.SUMMONER_SPAWN_MAX_DISTANCE
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const offset = spawnMinDist + Math.random() * (spawnMaxDist - spawnMinDist)
      const spawnX = enemy.x + Math.cos(angle) * offset
      const spawnY = enemy.y + Math.sin(angle) * offset
      
      // 使用正确的创建方法，确保所有属性都被初始化
      const baseHealth = (20 * (1.0 + (this.currentLevel - 1) * 0.1)) * 0.1
      const baseSize = 18 + this.currentLevel * 0.5
      const minion = this.createEnemyByType(minionType, this.currentLevel, spawnX, spawnY, baseHealth, baseSize * 0.7)
      if (minion) {
        this.pendingEnemies.push(minion) // 使用待添加队列，避免在updateEnemyAI中修改数组
      }
    }
  }

  // 应用特殊效果（命中时）
  private applySpecialEffectsOnHit(enemy: any, projectile: any, damage: number, specialEffects: string[]) {
    if (!enemy || enemy.health <= 0) return // 敌人已死亡，不应用效果
    
    for (const effectKey of specialEffects) {
      switch (effectKey) {
        case 'on_hit_freeze': {
          // 寒霜冻结：10%几率冻结1.5秒
          if (Math.random() < 0.10) {
            // 给敌人添加冻结状态
            if (!enemy.statusEffects) {
              enemy.statusEffects = []
            }
            // 保存原始速度（如果还没有保存）
            if (enemy.originalSpeed === undefined) {
              enemy.originalSpeed = enemy.speed || 0.7
            }
            // 检查是否已有冻结效果
            const existingFreeze = enemy.statusEffects.find((e: any) => e.id === 'freeze')
            if (existingFreeze) {
              existingFreeze.duration = 1500 // 重置持续时间
            } else {
              enemy.statusEffects.push({
                id: 'freeze',
                name: '冻结',
                type: 'debuff',
                duration: 1500,
                maxDuration: 1500,
                intensity: 1.0,
                stackable: false,
                stacks: 1,
                icon: '❄️',
                description: '无法移动'
              })
            }
            // 冻结时速度设为0
            enemy.speed = 0
            // 初始化状态更新时间
            if (!enemy.lastStatusUpdate) {
              enemy.lastStatusUpdate = Date.now()
            }
            // 添加冻结特效 - 蓝色冰霜粒子
            this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
              count: 20,
              colors: ['#44aaff', '#88ddff', '#ffffff', '#aaffff'],
              size: { min: 2, max: 6 },
              speed: { min: 30, max: 80 },
              life: { min: 800, max: 1500 },
              spread: 360
            })
            // 添加蓝色击中特效
            this.addHitEffect(enemy.x, enemy.y, false, '#44aaff')
          }
          break
        }
        case 'on_hit_chain_lightning': {
          // 连锁闪电：15%几率连锁闪电（3目标）
          if (Math.random() < 0.15) {
            // 找到最近的3个敌人（不包括当前目标）
            const nearbyEnemies = this.enemies
              .filter(e => e !== enemy && e.health > 0)
              .map(e => ({
                enemy: e,
                distSq: (e.x - enemy.x) ** 2 + (e.y - enemy.y) ** 2
              }))
              .sort((a, b) => a.distSq - b.distSq)
              .slice(0, 3)
            
            // 对每个目标造成连锁伤害
            nearbyEnemies.forEach(({ enemy: target }, index) => {
              const chainDamage = damage * 0.5 * (1 - index * 0.2) // 伤害递减
              target.health -= chainDamage
              
              // 添加连锁闪电特效 - 黄色闪电粒子
              this.effectsSystem.createParticleEffect('energy_discharge', target.x, target.y, {
                count: 15,
                colors: ['#ffff00', '#ffaa00', '#ffffff'],
                size: { min: 2, max: 5 },
                speed: { min: 60, max: 150 },
                life: { min: 300, max: 600 },
                spread: 360
              })
              // 添加黄色击中特效
              this.addHitEffect(target.x, target.y, false, '#ffff00')
              
              // 绘制闪电链效果
              this.effects.push({
                x: enemy.x,
                y: enemy.y,
                type: 'chain_lightning',
                life: 15,
                size: Math.sqrt((target.x - enemy.x) ** 2 + (target.y - enemy.y) ** 2),
                targetX: target.x,
                targetY: target.y,
                color: '#ffff00'
              } as any)
            })
            
            // 在起始敌人位置也添加闪电特效
            this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
              count: 10,
              colors: ['#ffff00', '#ffaa00', '#ffffff'],
              size: { min: 3, max: 6 },
              speed: { min: 80, max: 180 },
              life: { min: 400, max: 700 },
              spread: 360
            })
          }
          break
        }
        case 'on_hit_poison': {
          // 剧毒：攻击使敌人中毒（3s 50%伤害）
          if (!enemy.statusEffects) {
            enemy.statusEffects = []
          }
          const poisonDamage = damage * 0.5
          const existingPoison = enemy.statusEffects.find((e: any) => e.id === 'poison')
          if (existingPoison) {
            // 刷新持续时间，叠加伤害
            existingPoison.duration = 3000
            existingPoison.intensity = (existingPoison.intensity || poisonDamage) + poisonDamage * 0.5
          } else {
            enemy.statusEffects.push({
              id: 'poison',
              name: '中毒',
              type: 'debuff',
              duration: 3000,
              maxDuration: 3000,
              intensity: poisonDamage,
              stackable: true,
              stacks: 1,
              icon: '☠️',
              description: '持续伤害'
            })
          }
          // 添加剧毒特效 - 绿色毒云粒子
          this.effectsSystem.createParticleEffect('dust_cloud', enemy.x, enemy.y, {
            count: 12,
            colors: ['#00ff00', '#88ff88', '#44ff44'],
            size: { min: 3, max: 8 },
            speed: { min: 20, max: 60 },
            life: { min: 1000, max: 2000 },
            spread: 180,
            gravity: -30
          })
          // 添加绿色击中特效
          this.addHitEffect(enemy.x, enemy.y, false, '#00ff00')
          break
        }
        case 'on_crit_explode': {
          // 爆裂暴击：暴击时小范围爆炸
          if (projectile.isCrit) {
            const explosionRadius = 60
            const explosionDamage = damage * 0.5
            // 对范围内敌人造成伤害
            this.enemies.forEach(target => {
              if (target === enemy || target.health <= 0) return
              const dx = target.x - enemy.x
              const dy = target.y - enemy.y
              const distSq = dx * dx + dy * dy
              if (distSq < explosionRadius * explosionRadius) {
                const dist = Math.sqrt(distSq)
                const damageRatio = 1 - dist / explosionRadius
                target.health -= explosionDamage * damageRatio
                
                // 添加爆炸特效
                this.addHitEffect(target.x, target.y, false, '#ff6600')
              }
            })
            
            // 添加爆炸特效
            this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
            this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
          }
          break
        }
      }
    }
  }

  // 应用特殊效果（击败敌人时）
  private applySpecialEffectsOnKill(enemy: any, specialEffects: string[]) {
    for (const effectKey of specialEffects) {
      switch (effectKey) {
        case 'on_kill_heal_orb': {
          // 治疗球：击败敌人时有30%概率掉落治疗球（在敌人死亡位置生成，静止不动）
          if (Math.random() < 0.3) { // 30%概率
            const healAmount = 3
            // 检查是否超过最大掉落物数量
            if (this.droppedItems.length >= this.MAX_DROPPED_ITEMS) {
              // 移除最旧的掉落物
              this.droppedItems.shift()
            }
            
            // 创建治疗球掉落物（在敌人死亡位置，静止不动）
            const healOrb = {
              id: `heal_orb_${Date.now()}_${Math.random()}`,
              x: enemy.x,
              y: enemy.y,
              vx: 0, // 无速度，静止不动
              vy: 0,
              type: 'heal_orb' as const,
              value: healAmount,
              size: 12,
              life: Infinity, // 永不消失，直到被拾取
              maxLife: Infinity,
              magnetRange: 80, // 磁吸范围（如果有自动拾取）
              attractedToPlayer: false
            }
            
            this.droppedItems.push(healOrb)
            
            // 添加掉落特效 - 绿色上升粒子
            this.effectsSystem.createParticleEffect('heal_sparkles', enemy.x, enemy.y, {
              count: 15,
              colors: ['#00ff00', '#88ff88', '#ffffff', '#44ff44'],
              size: { min: 2, max: 5 },
              speed: { min: 30, max: 80 },
              life: { min: 500, max: 1000 },
              spread: 120,
              gravity: -100
            })
          }
          break
        }
        case 'on_crit_explode': {
          // 击败敌人时有几率爆炸（如果有爆裂暴击效果）
          // 这里可以选择是否在击败时也触发爆炸，或者只在暴击时触发
          // 暂时只在暴击时触发，击败时不额外触发
          break
        }
      }
    }
  }

  // 自爆伤害（修复全图伤害bug）
  private handleExplosion(enemy: any, explosionRadius: number, explosionDamage: number) {
    // **性能优化**：使用平方距离避免Math.sqrt
    const dx = enemy.x - this.playerX
    const dy = enemy.y - this.playerY
    const distToPlayerSq = dx * dx + dy * dy
    const explosionRadiusSq = explosionRadius * explosionRadius
    
    // 只对范围内的玩家造成伤害
    if (distToPlayerSq < explosionRadiusSq) {
      const distToPlayer = Math.sqrt(distToPlayerSq) // 需要真实距离计算衰减
      const now = Date.now()
      
      // **修复**：爆炸伤害使用独立的无敌帧系统，不受接触伤害影响
      // 只检查爆炸伤害专用无敌帧（更短，比如100ms）
      const explosionIFrameDuration = 100 // 爆炸伤害无敌帧：100ms（很短，主要用于防止同一爆炸连续命中）
      
      if (now < this.playerExplosionIFrameUntil) {
        return
      }

      // 伤害随距离衰减
      const distanceRatio = distToPlayer / explosionRadius
      const actualDamage = Math.floor(explosionDamage * (1 - distanceRatio * 0.5))
      
      // **修复**：爆炸伤害不检查堆叠上限，因为堆叠上限是为接触伤害设计的
      // 直接造成伤害
      const damageToApply = actualDamage
      this.playerHealth -= damageToApply
      
      if (this.playerHealth <= 0) {
        this.playerHealth = 0
        this.triggerGameOver()
        return
      }

      // 应用爆炸伤害专用无敌帧（很短暂）
      this.playerExplosionIFrameUntil = now + explosionIFrameDuration
      // 注意：爆炸伤害不添加到playerDamageHistory，因为堆叠上限只针对接触伤害
      // 减少特效调用，避免性能问题
      // this.addHitEffect(this.playerX, this.playerY, false)
      
      // 播放玩家受击音效（爆炸伤害）
      this.audioSystem.playSoundEffect('player_hit', { 
        volume: Math.max(0.5, 1.0 - distanceRatio * 0.5) // 距离越远音量越小
      })
    }

      // 添加爆炸特效
      this.effects.push({
        x: enemy.x,
        y: enemy.y,
        type: 'explosion',
        life: 20,
        size: explosionRadius
      })
      
      // 播放爆炸音效（在范围内时才播放，避免过远的声音）
      if (distToPlayerSq < explosionRadiusSq * 4) { // 2倍爆炸半径内都能听到
        const audioDistance = Math.sqrt(distToPlayerSq)
        const audioDistanceRatio = audioDistance / explosionRadius
        this.audioSystem.playSoundEffect('explosion', { 
          volume: Math.max(0.3, 1.0 - audioDistanceRatio * 0.5) // 距离越远音量越小
        })
      }
  }

  private updateProjectiles() {
    // **性能优化**：限制投射物总数，自动清理旧投射物
    if (this.projectiles.length > this.MAX_PROJECTILES) {
      // 保留最新的投射物，删除最旧的
      const excess = this.projectiles.length - this.MAX_PROJECTILES
      this.projectiles.splice(0, excess)
      console.warn(`[性能] 投射物数量超限，清理 ${excess} 个旧投射物`)
    }
    
    // **调试日志**：检查投射物数量（降低频率）
    const enemyProjectiles = this.projectiles.filter(p => p.owner === 'enemy')
    if (enemyProjectiles.length > 0 && Math.random() < 0.01) { // 降低到1%概率
      console.log(`📊 投射物状态: 总数=${this.projectiles.length}, 敌人投射物=${enemyProjectiles.length}, 玩家投射物=${this.projectiles.length - enemyProjectiles.length}`)
    }
    
    this.projectiles.forEach((projectile, index) => {
      // 处理重力效果（投弹手的抛物线投射物）
      if (projectile.isGrenade) {
        // 添加重力
        const gravity = 0.2
        const previousVy = projectile.vy
        projectile.vy += gravity
        
        // 更新位置
        projectile.x += projectile.vx
        projectile.y += projectile.vy
        
        // 检查是否落地（当vy变为正数时，说明正在下落；落地时y超过画布底部）
        const groundLevel = this.canvas.height - 10 // 地面高度
        
        // 检查是否应该在当前位置爆炸（落地或击中玩家）
        let shouldExplode = false
        let explosionX = projectile.x
        let explosionY = projectile.y
        
        if (projectile.y >= groundLevel && previousVy >= 0) {
          // 已经落地或即将落地
          explosionY = groundLevel
          shouldExplode = true
        } else {
          // 检查是否在空中接近玩家（允许空中提前爆炸）
          // **性能优化**：使用平方距离避免Math.sqrt
          const dx = projectile.x - this.playerX
          const dy = projectile.y - this.playerY
          const distToPlayerSq = dx * dx + dy * dy
          const triggerDistSq = 30 * 30
          // 如果炸弹非常接近玩家（在空中），也可以爆炸
          if (distToPlayerSq < triggerDistSq && projectile.vy > 0) {
            shouldExplode = true
          }
        }
        
        if (shouldExplode) {
          // 落地/击中爆炸
          const explosionRadius = this.ENEMY_SKILL_RANGES.GRENADIER_EXPLOSION_RADIUS
          const explosionDamage = projectile.damage || 15 + this.currentLevel * 2
          this.handleExplosion({ x: explosionX, y: explosionY }, explosionRadius, explosionDamage)
          
          // 添加爆炸特效
          this.effectsSystem.createExplosionEffect(explosionX, explosionY, explosionRadius)
          this.projectileVisualSystem.createExplosion(explosionX, explosionY, explosionRadius, 'fire')
          
      console.log(`💣 炸弹爆炸！位置: (${explosionX.toFixed(1)}, ${explosionY.toFixed(1)}), 伤害: ${explosionDamage}`)
      
      // 播放爆炸音效
      this.audioSystem.playSoundEffect('explosion', { volume: 1.0 })
      
      // 移除投射物
      projectile.life = 0
          return
        }
        
        projectile.life--
        return // 炸弹不需要继续处理普通投射物逻辑
      }
      
      // 普通投射物的移动（炸弹已经在上面处理）
      projectile.x += projectile.vx
      projectile.y += projectile.vy
      projectile.life--

      // 区分玩家投射物和敌人投射物
      if (projectile.owner === 'player') {
        // 玩家的投射物 - 检查与敌人的碰撞
        // **性能优化**：使用空间分区优化，只检查附近的敌人
        // 如果敌人很多，先进行粗略筛选
        const checkRadius = 100 // 只检查投射物周围100像素内的敌人
        const checkRadiusSq = checkRadius * checkRadius
        
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex++) {
          const enemy = this.enemies[enemyIndex]
          
          // 快速筛选：只检查距离投射物较近的敌人
          const dx = projectile.x - enemy.x
          const dy = projectile.y - enemy.y
          const roughDistanceSq = dx * dx + dy * dy
          
          // 如果距离太远，跳过（性能优化）
          if (roughDistanceSq > checkRadiusSq) {
            continue
          }
          
          // 检查是否已经击中过这个敌人
          if (!projectile.hitEnemies) {
            projectile.hitEnemies = new Set()
          }
          if (projectile.hitEnemies.has(enemy)) {
            continue // 跳过已经击中过的敌人
          }
          
          // 精确碰撞检测：使用平方距离避免Math.sqrt
          const collisionRadiusSq = (15 + enemy.size) * (15 + enemy.size)
          if (roughDistanceSq < collisionRadiusSq) {
            let actualDamage = projectile.damage
            const shieldEnemy = enemy as any
            
            // 护盾系统：优先攻击护盾
            if (shieldEnemy.shield > 0) {
              const shieldDamage = Math.min(shieldEnemy.shield, actualDamage)
              shieldEnemy.shield -= shieldDamage
              actualDamage -= shieldDamage
              
              // 护盾被攻击的特效（蓝色）
              this.addHitEffect(enemy.x, enemy.y, false, '#00ffff')
              
              // 如果护盾被完全破坏
              if (shieldEnemy.shield <= 0) {
                // 护盾破坏特效
                this.addHitEffect(enemy.x, enemy.y, true, '#ffff00')
              }
            }
            
            // 剩余伤害攻击本体
            if (actualDamage > 0) {
              enemy.health -= actualDamage
              
              // 生命偷取（从gameState获取）
              const lifestealPercent = this.gameState?.player?.lifesteal || 0
              if (lifestealPercent > 0) {
                const healAmount = Math.floor(actualDamage * lifestealPercent)
                this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
              }
              
              // 应用特殊效果（从player.specialEffects检查）
              const specialEffects = (this.gameState?.player as any)?.specialEffects || []
              if (specialEffects.length > 0) {
                this.applySpecialEffectsOnHit(enemy, projectile, actualDamage, specialEffects)
              }
              
              // 添加击中特效
              this.addHitEffect(enemy.x, enemy.y, projectile.isCrit)
              
              // 播放投射物命中音效
              this.audioSystem.playSoundEffect('projectile_hit', {
                volume: projectile.isCrit ? 1.2 : 0.8,
                pitch: projectile.isCrit ? 1.5 : 1.0
              })
            }
            
            // 将敌人添加到已击中列表
            projectile.hitEnemies!.add(enemy)
            
            // 穿透机制：增加已穿透次数
            projectile.pierce++
            
            // 无论敌人是否死亡，都要检查穿透次数
            // maxPierce表示可以穿透的敌人数量，总共可以击中maxPierce+1个敌人
            // 例如：maxPierce=1时，可以穿透1个敌人，击中2个敌人
            // pierce表示已穿透的敌人数量，所以当pierce > maxPierce时移除
            if (projectile.pierce > projectile.maxPierce) {
              projectile.life = 0
            }
            
            if (enemy.health <= 0) {
              // 应用击败敌人时的特殊效果
              const specialEffects = (this.gameState?.player as any)?.specialEffects || []
              if (specialEffects.length > 0) {
                this.applySpecialEffectsOnKill(enemy, specialEffects)
              }
              
              // 播放敌人死亡音效
              this.audioSystem.playSoundEffect('enemy_death')
              // 检查是否是Boss（通过type判断）
              const isBoss = enemy.type && ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander'].includes(enemy.type)
              
              // 如果是第10关Boss（虫巢母体），清理所有待孵化的虫卵
              if (enemy.type === 'fortress_guard') {
                const hiveMother = enemy as any
                if (hiveMother && hiveMother.pendingEggs && Array.isArray(hiveMother.pendingEggs)) {
                  console.log(`[Boss死亡] 清理虫巢母体的 ${hiveMother.pendingEggs.length} 个待孵化虫卵`)
                  hiveMother.pendingEggs = []
                }
              }
              
              if (isBoss) {
                // Boss死亡：标记已击杀Boss（不立即暂停，等待本层结束后再选择奖励）
                if (this.gameState) {
                  this.gameState.bossDefeated = this.currentLevel
                  this.gameState.hasDefeatedBoss = true // 标记已击杀boss，解锁额外属性选择
                  // **修复**：不立即暂停，让游戏继续，在本层结束后（nextLevel时）再显示奖励选择
                  console.log(`[Boss死亡] 第${this.currentLevel}层Boss被击杀，标记bossDefeated=${this.currentLevel}，将在本层结束后显示奖励选择`)
                }
              }
              // 检查是否精英怪
              const isElite = enemy.isElite
              if (isElite) {
                // 触发额外属性选择（只有击杀过boss才能选择）
                if (this.gameState && !this.gameState.showPassiveSelection) {
                  // 只有击杀过boss才能触发额外属性选择
                  if (this.gameState.hasDefeatedBoss) {
                    this.gameState.extraAttributeSelect = true
                  } else {
                    console.log('⚠️ 未击杀boss，无法选择额外属性')
                  }
                }
              }
              
              // 自爆型敌人死后自爆（统一在这里处理，避免重复爆炸）
              if (enemy.type === 'charger' || enemy.type === 'bomb_bat') {
                // 检查是否已经爆炸过（防止重复触发）
                if (!(enemy as any).hasExploded) {
                  (enemy as any).hasExploded = true // 标记已爆炸
                  const explosionRadius = enemy.type === 'charger' ? 80 : 100
                  const explosionDamage = enemy.type === 'charger' ? 15 + this.currentLevel : 20 + this.currentLevel
                  this.handleExplosion(enemy, explosionRadius, explosionDamage)
                  
                  // 添加高级爆炸特效
                  this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
                  this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
                }
              }
              
              this.enemies.splice(enemyIndex, 1)
              // 增加分数
              this.score += isElite ? 50 : 10
              // 添加死亡特效
              this.addDeathEffect(enemy.x, enemy.y)
              enemyIndex-- // 调整索引，因为删除了一个敌人
            }
            
            // 不跳出循环，继续检测其他敌人（穿透多个敌人）
            // 但是只会在不同帧检测到不同敌人，因为hitEnemies会阻止重复检测
          }
        }
      } else if (projectile.owner === 'enemy') {
        // 敌人的投射物 - 检查与玩家的碰撞
        // 投弹手的炸弹不直接碰撞玩家，而是落地爆炸
        if (!projectile.isGrenade) {
          // **性能优化**：使用平方距离避免Math.sqrt
          const dx = projectile.x - this.playerX
          const dy = projectile.y - this.playerY
          const distToPlayerSq = dx * dx + dy * dy
          // **修复**：增加碰撞半径，确保能正确击中（玩家半径15 + 投射物大小约10）
          const collisionRadius = 25
          const collisionRadiusSq = collisionRadius * collisionRadius
          
          // **调试日志**：每帧检查碰撞（但只在接近时输出）
          if (distToPlayerSq < collisionRadiusSq * 4) { // 只在2倍碰撞半径内输出日志
            const distance = Math.sqrt(distToPlayerSq)
            console.log(`🎯 投射物接近玩家: 距离=${distance.toFixed(1)}, 碰撞半径=${collisionRadius}, 投射物位置=(${projectile.x.toFixed(1)}, ${projectile.y.toFixed(1)}), 玩家位置=(${this.playerX.toFixed(1)}, ${this.playerY.toFixed(1)})`)
          }
          
          if (distToPlayerSq < collisionRadiusSq) {
            // 对玩家造成伤害
            const now = Date.now()
            console.log(`🔥 投射物碰撞检测触发! 距离=${Math.sqrt(distToPlayerSq).toFixed(1)}, 伤害=${projectile.damage}, 接触无敌帧=${this.playerIFrameUntil}, 远程无敌帧=${this.playerProjectileIFrameUntil}, 当前时间=${now}`)
            
            // **修复**：远程伤害使用独立的无敌帧系统，不受接触伤害影响
            // 只检查远程伤害专用无敌帧（更短，比如100ms），这样远程伤害不会被接触伤害的无敌帧阻止
            const projectileIFrameDuration = 100 // 远程伤害无敌帧：100ms（很短，主要用于防止同一投射物连续命中）
            
            if (now >= this.playerProjectileIFrameUntil) {
              // **修复**：远程伤害不检查堆叠上限，因为堆叠上限是为接触伤害设计的
              // 直接造成伤害
              const oldHealth = this.playerHealth
              const damageToApply = projectile.damage
              this.playerHealth -= damageToApply
              console.log(`✅ 远程伤害应用成功！伤害: ${damageToApply}, 血量: ${oldHealth} -> ${this.playerHealth}`)
              
              if (this.playerHealth <= 0) {
                this.playerHealth = 0
                this.triggerGameOver()
              }
              
              // 应用远程伤害专用无敌帧（很短暂）
              this.playerProjectileIFrameUntil = now + projectileIFrameDuration
              // 注意：远程伤害不添加到playerDamageHistory，因为堆叠上限只针对接触伤害
              this.addHitEffect(this.playerX, this.playerY, false)
              
              // 播放玩家受击音效
              this.audioSystem.playSoundEffect('player_hit', { volume: 0.7 })
              
              // 击中玩家后移除
              projectile.life = 0
              return // 提前返回，避免继续处理
            } else {
              console.log(`⚠️ 玩家处于远程伤害无敌帧，剩余无敌时间: ${this.playerProjectileIFrameUntil - now}ms`)
            }
          }
        }
      }
    })

    // **性能优化**：批量移除投射物，使用反向遍历避免索引问题
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i]
      if (projectile.life <= 0 || 
          projectile.x < 0 || projectile.x > this.canvas.width ||
          projectile.y < 0 || projectile.y > this.canvas.height) {
        this.projectiles.splice(i, 1)
      }
    }
    
    // **性能优化**：限制最大投射物数量，防止卡顿
    if (this.projectiles.length > this.MAX_PROJECTILES) {
      // 移除最旧的投射物（前面的）
      this.projectiles.splice(0, this.projectiles.length - this.MAX_PROJECTILES)
    }
  }

  private handleAutoAttack() {
    // 获取玩家攻击速度属性
    const player = this.gameState?.player || { attackSpeed: 1.0, range: 400 }
    const now = Date.now()
      
    // **修复**：根据玩家的攻击速度计算攻击间隔
    // attackSpeed 表示每秒攻击次数，所以攻击间隔 = 1000 / attackSpeed（毫秒）
    // 例如：attackSpeed = 1.0 时，间隔 = 1000/1.0 = 1000ms（100%）
    //      attackSpeed = 1.2 时，间隔 = 1000/1.2 ≈ 833ms（+20%攻速后）
    //      attackSpeed = 2.0 时，间隔 = 1000/2.0 = 500ms（+100%攻速后）
    const attackSpeed = player.attackSpeed || 1.0
    const attackInterval = 1000 / attackSpeed // 根据攻击速度动态计算攻击间隔
    
    // **调试日志**：定期输出攻击速度信息（降低频率）
    if (Math.random() < 0.001) { // 0.1%概率，避免日志过多
      console.log(`⚡ 攻击速度: ${attackSpeed.toFixed(2)}/秒, 攻击间隔: ${attackInterval.toFixed(1)}ms`)
    }
    
    // 如果没有敌人，重置计时器但不攻击
    if (this.enemies.length === 0) {
      this.lastAttackTime = now
      return
    }
    
    // **新增：检查是否有敌人在攻击射程内**
    // **性能优化**：使用平方距离避免Math.sqrt
    const attackRange = (player.range || 1) * 300 // range属性放大：1 = 300像素，2 = 600像素，以此类推
    const attackRangeSq = attackRange * attackRange
    const enemiesInRange = this.enemies.filter(enemy => {
      const dx = enemy.x - this.playerX
      const dy = enemy.y - this.playerY
      const distanceSq = dx * dx + dy * dy
      return distanceSq <= attackRangeSq
    })
    
    // 如果没有任何敌人在射程内，不攻击
    if (enemiesInRange.length === 0) {
      return // 不重置计时器，保持攻击节奏
    }
    
    // 检查是否到了攻击时间
    if (now - this.lastAttackTime >= attackInterval) {
      this.shootProjectile()
      this.lastAttackTime = now // 更新攻击时间用于冷却计算
      
      // 调试日志（仅在调试时启用）
      // console.log(`🎯 发射子弹！攻击速度: ${attacksPerSecond}/s, 间隔: ${attackInterval.toFixed(1)}ms, 射程内敌人: ${enemiesInRange.length}/${this.enemies.length}, 射程: ${attackRange}`)
    }
  }

  private shootProjectile() {
    // 获取玩家属性
    const player = this.gameState?.player || {
      damage: 10,
      critChance: 0.2,
      projectiles: 1,
      pierce: 0,
      range: 1
    }

    // 如果没有敌人，不发射投射物（但这个检查已在handleAutoAttack中做过了）
    if (this.enemies.length === 0) {
      console.warn('⚠️ shootProjectile被调用但没有敌人')
      return
    }

    // **新增：只考虑射程内的敌人**
    // **性能优化**：使用平方距离避免Math.sqrt，并在计算时就过滤
    const attackRange = (player.range || 1) * 300 // 射程：range属性 * 300像素
    const attackRangeSq = attackRange * attackRange
    const enemyDistances = this.enemies
      .map((enemy, index) => {
        const dx = enemy.x - this.playerX
        const dy = enemy.y - this.playerY
        const distanceSq = dx * dx + dy * dy
        return { enemy, distanceSq, index }
      })
      .filter(({ distanceSq }) => distanceSq <= attackRangeSq) // 只保留射程内的敌人
      .sort((a, b) => a.distanceSq - b.distanceSq) // 按距离平方排序，最近的在前
    
    // 如果射程内没有敌人，不攻击
    if (enemyDistances.length === 0) {
      return
    }
    
    // **关键修复**：先更新玩家朝向（朝向最近的敌人），确保枪口方向正确
    if (this.enemies.length > 0 && enemyDistances.length > 0) {
      const nearestEnemy = enemyDistances[0].enemy
      const dx = nearestEnemy.x - this.playerX
      const dy = nearestEnemy.y - this.playerY
      this.playerAngle = Math.atan2(dy, dx) // 先更新枪口朝向
    }
    
    // **修复**：根据 player.projectiles 属性发射多个投射物
    // 注意：playerAngle已经更新为朝向最近敌人的方向
    // **性能优化**：如果投射物数量过多，不创建新投射物
    const projectileCount = player.projectiles || 1
    const remainingSlots = this.MAX_PROJECTILES - this.projectiles.length
    const actualProjectileCount = Math.min(projectileCount, remainingSlots)
    
    if (actualProjectileCount <= 0) {
      return // 如果投射物太多，跳过这次攻击
    }
    
    // **修复**：始终基于playerAngle（枪口朝向）计算子弹速度
    const speed = 12
    const baseAngle = this.playerAngle
    
    // **修复**：根据投射物数量调整分散角度，2个投射物时减少分散避免错过敌人
    // 投射物数量越少，分散角度越小；数量多时才增加分散角度
    let spreadAngle: number
    if (actualProjectileCount === 1) {
      spreadAngle = 0 // 单个投射物不分散
    } else if (actualProjectileCount === 2) {
      spreadAngle = 0.15 // 2个投射物：小角度分散（约8.6度），避免完美错过
    } else if (actualProjectileCount <= 3) {
      spreadAngle = 0.25 // 3个投射物：中等分散（约14.3度）
    } else if (actualProjectileCount <= 5) {
      spreadAngle = 0.35 // 4-5个投射物：较大分散（约20度）
    } else {
      spreadAngle = 0.4 + (actualProjectileCount - 5) * 0.1 // 6个以上：逐渐增加分散
      spreadAngle = Math.min(spreadAngle, 1.2) // 最大分散角度限制在约69度
    }
    
    const angleStep = actualProjectileCount > 1 ? spreadAngle / (actualProjectileCount - 1) : 0
    // **关键修复**：确保中心对准最近敌人，而不是分散在两侧
    const startAngle = baseAngle - spreadAngle / 2
    
    // 计算暴击和伤害（所有投射物使用相同的暴击结果，保持一致性）
    const isCrit = Math.random() < player.critChance
    const damage = isCrit ? player.damage * 2 : player.damage
    
    // 播放玩家攻击音效（只播放一次，不管有多少投射物）
    this.audioSystem.playSoundEffect('player_attack', { 
      volume: isCrit ? 1.2 : 1.0, // 暴击时音量更大
      pitch: isCrit ? 1.3 : 1.0 // 暴击时音调更高
    })
    
    // **修复**：根据投射物数量发射多个投射物，扇形分布
    for (let i = 0; i < actualProjectileCount; i++) {
      // 计算当前投射物的角度（如果只有一个投射物，角度就是baseAngle）
      const currentAngle = actualProjectileCount === 1 
        ? baseAngle 
        : startAngle + (angleStep * i)
      
      const vx = Math.cos(currentAngle) * speed
      const vy = Math.sin(currentAngle) * speed
      
      this.projectiles.push({
        x: this.playerX,
        y: this.playerY,
        vx,
        vy,
        damage,
        isCrit,
        life: 60,
        pierce: 0,
        maxPierce: player.pierce || 0,
        owner: 'player',
        hitEnemies: new Set() // 初始化已击中敌人列表
      })
    }
    
    // 调试日志（仅在投射物数量>1时输出）
    if (actualProjectileCount > 1) {
      console.log(`🎯 发射${actualProjectileCount}个投射物！扇形角度: ${(spreadAngle * 180 / Math.PI).toFixed(1)}度`)
    }
    
    // lastAttackTime用于视觉系统的枪口闪烁效果
    // 为了确保视觉效果同步，在发射子弹时也需要更新
    // 但攻击冷却由handleAutoAttack中的lastAttackTime控制
    const visualAttackTime = Date.now()
    
    // 为了视觉系统，我们需要确保发射子弹时有准确的时间戳
    // 但这里不需要更新this.lastAttackTime，因为它已在handleAutoAttack中更新
  }

  // 更新掉落物（治疗球完全静止，不模拟任何物理效果）
  private updateDroppedItems() {
    // 治疗球在生成位置完全静止，不进行任何移动
    // 平面游戏，不需要物理效果
    this.droppedItems.forEach((item) => {
      // 确保治疗球完全静止
      if (item.type === 'heal_orb') {
        item.vx = 0
        item.vy = 0
        item.attractedToPlayer = false
        // 不更新位置，保持在生成时的位置不变
      }
    })
  }

  // 检查掉落物拾取
  private checkItemPickup() {
    this.droppedItems.forEach((item, index) => {
      // 计算与玩家的距离
      const dx = this.playerX - item.x
      const dy = this.playerY - item.y
      const distSq = dx * dx + dy * dy
      const pickupRadius = 20 + item.size // 拾取半径：玩家半径 + 掉落物大小
      
      // 如果玩家接触到掉落物
      if (distSq < pickupRadius * pickupRadius) {
        // 根据掉落物类型处理
        switch (item.type) {
          case 'heal_orb': {
            // 治疗球：回复生命值
            const healAmount = item.value
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
            
            // 添加拾取特效
            this.effectsSystem.createParticleEffect('heal_sparkles', item.x, item.y, {
              count: 20,
              colors: ['#00ff00', '#88ff88', '#ffffff', '#44ff44'],
              size: { min: 3, max: 6 },
              speed: { min: 50, max: 120 },
              life: { min: 500, max: 1000 },
              spread: 360,
              gravity: -150
            })
            
            // 播放拾取音效（如果有）
            this.audioSystem.playSoundEffect('item_pickup', { volume: 0.5 })
            break
          }
          case 'experience': {
            // 经验值：增加经验（如果将来实现经验系统）
            // 暂时不处理
            break
          }
          case 'energy': {
            // 能量：恢复能量（如果将来实现能量系统）
            // 暂时不处理
            break
          }
        }
        
        // 移除已拾取的掉落物
        this.droppedItems.splice(index, 1)
      }
    })
  }

  private updateEffects() {
    this.effects.forEach((effect, index) => {
      effect.life--
      effect.size += 0.5 // 特效逐渐变大
    })

    // 移除生命结束的特效
    this.effects = this.effects.filter(effect => effect.life > 0)
  }

  private addHitEffect(x: number, y: number, isCrit: boolean, color?: string) {
    // 旧的简单特效（保持兼容性）
    this.effects.push({
      x,
      y,
      type: isCrit ? 'crit_hit' : 'hit',
      life: 10,
      size: 5
    })
    
    // 新的高级特效系统
    this.effectsSystem.createHitEffect(x, y, isCrit)
  }

  private addDeathEffect(x: number, y: number) {
    // 旧的简单特效（保持兼容性）
    this.effects.push({
      x,
      y,
      type: 'death',
      life: 20,
      size: 10
    })
    
    // 新的高级特效系统
    this.effectsSystem.createDeathEffect(x, y, 'normal')
  }

  // 绘制掉落物
  private drawDroppedItems() {
    this.droppedItems.forEach(item => {
      this.ctx.save()
      
      // 根据掉落物类型绘制不同的外观
      switch (item.type) {
        case 'heal_orb': {
          // 治疗球：绿色发光的球体（平面游戏，静止不动）
          const lifePercent = item.life === Infinity ? 1 : item.life / item.maxLife // 永不消失，生命周期始终为1
          const pulse = Math.sin(Date.now() / 200) * 0.2 + 1 // 脉冲效果
          const size = item.size * pulse
          
          // 外圈光晕
          const gradient = this.ctx.createRadialGradient(item.x, item.y, 0, item.x, item.y, size * 1.5)
          gradient.addColorStop(0, `rgba(0, 255, 0, ${0.6 * lifePercent})`)
          gradient.addColorStop(0.5, `rgba(136, 255, 136, ${0.4 * lifePercent})`)
          gradient.addColorStop(1, 'rgba(0, 255, 0, 0)')
          this.ctx.fillStyle = gradient
          this.ctx.beginPath()
          this.ctx.arc(item.x, item.y, size * 1.5, 0, Math.PI * 2)
          this.ctx.fill()
          
          // 主球体
          const mainGradient = this.ctx.createRadialGradient(
            item.x - size * 0.3, item.y - size * 0.3, 0,
            item.x, item.y, size
          )
          mainGradient.addColorStop(0, '#ffffff')
          mainGradient.addColorStop(0.3, '#88ff88')
          mainGradient.addColorStop(1, '#00ff00')
          this.ctx.fillStyle = mainGradient
          this.ctx.beginPath()
          this.ctx.arc(item.x, item.y, size, 0, Math.PI * 2)
          this.ctx.fill()
          
          // 高光
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
          this.ctx.beginPath()
          this.ctx.arc(item.x - size * 0.3, item.y - size * 0.3, size * 0.4, 0, Math.PI * 2)
          this.ctx.fill()
          
          // 如果被吸引，显示吸引特效
          if (item.attractedToPlayer) {
            this.ctx.strokeStyle = `rgba(0, 255, 0, ${0.3 * lifePercent})`
            this.ctx.lineWidth = 2
            this.ctx.setLineDash([5, 5])
            this.ctx.beginPath()
            this.ctx.arc(item.x, item.y, size * 2, 0, Math.PI * 2)
            this.ctx.stroke()
            this.ctx.setLineDash([])
          }
          break
        }
        case 'experience': {
          // 经验球：黄色
          this.ctx.fillStyle = '#ffaa00'
          this.ctx.beginPath()
          this.ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2)
          this.ctx.fill()
          break
        }
        case 'energy': {
          // 能量球：蓝色
          this.ctx.fillStyle = '#0088ff'
          this.ctx.beginPath()
          this.ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2)
          this.ctx.fill()
          break
        }
      }
      
      this.ctx.restore()
    })
  }

  private drawEffects() {
    this.effects.forEach(effect => {
      this.ctx.save()
      this.ctx.translate(effect.x, effect.y)

      switch (effect.type) {
        case 'hit':
          // 普通击中特效
          this.ctx.fillStyle = '#ff8800'
          this.ctx.beginPath()
          this.ctx.arc(0, 0, effect.size, 0, Math.PI * 2)
          this.ctx.fill()
          break
        case 'crit_hit':
          // 暴击特效
          this.ctx.fillStyle = '#ffff00'
          this.ctx.beginPath()
          this.ctx.arc(0, 0, effect.size, 0, Math.PI * 2)
          this.ctx.fill()
          // 暴击光环
          this.ctx.strokeStyle = '#ffff00'
          this.ctx.lineWidth = 2
          this.ctx.beginPath()
          this.ctx.arc(0, 0, effect.size + 5, 0, Math.PI * 2)
          this.ctx.stroke()
          break
        case 'death':
          // 死亡特效
          this.ctx.fillStyle = '#ff4444'
          this.ctx.beginPath()
          this.ctx.arc(0, 0, effect.size, 0, Math.PI * 2)
          this.ctx.fill()
          break
        case 'explosion':
          // 爆炸特效
          this.ctx.fillStyle = '#ff8800'
          this.ctx.beginPath()
          this.ctx.arc(0, 0, effect.size, 0, Math.PI * 2)
          this.ctx.fill()
          this.ctx.fillStyle = '#ffff00'
          this.ctx.beginPath()
          this.ctx.arc(0, 0, effect.size * 0.7, 0, Math.PI * 2)
          this.ctx.fill()
          break
        case 'barrier':
          // 护盾特效
          this.ctx.strokeStyle = '#00ffff'
          this.ctx.lineWidth = 3
          this.ctx.beginPath()
          this.ctx.arc(0, 0, effect.size, 0, Math.PI * 2)
          this.ctx.stroke()
          break
        case 'chain_lightning':
          // 连锁闪电效果 - 绘制从起点到目标的闪电链
          if ((effect as any).targetX !== undefined && (effect as any).targetY !== undefined) {
            const targetX = (effect as any).targetX
            const targetY = (effect as any).targetY
            const color = (effect as any).color || '#ffff00'
            
            this.ctx.restore() // 恢复之前的变换，因为需要从effect.x, effect.y绘制到targetX, targetY
            this.ctx.save()
            
            // 绘制闪电链（锯齿状闪电效果）
            this.ctx.strokeStyle = color
            this.ctx.lineWidth = 3
            this.ctx.shadowColor = color
            this.ctx.shadowBlur = 10
            this.ctx.globalAlpha = Math.min(1.0, effect.life / 15) // 随着生命周期逐渐消失
            
            // 创建锯齿状闪电路径
            const segments = 8 // 闪电分段数
            this.ctx.beginPath()
            this.ctx.moveTo(effect.x, effect.y)
            
            for (let i = 1; i <= segments; i++) {
              const t = i / segments
              const baseX = effect.x + (targetX - effect.x) * t
              const baseY = effect.y + (targetY - effect.y) * t
              
              // 添加随机偏移，形成锯齿效果
              const offsetX = (Math.random() - 0.5) * 20
              const offsetY = (Math.random() - 0.5) * 20
              
              this.ctx.lineTo(baseX + offsetX, baseY + offsetY)
            }
            
            this.ctx.lineTo(targetX, targetY)
            this.ctx.stroke()
            
            this.ctx.shadowBlur = 0
            this.ctx.globalAlpha = 1.0
          }
          break
      }

      this.ctx.restore()
    })
  }

  private render() {
    // 清空画布
    this.ctx.fillStyle = '#1a1a1a'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
    // 应用屏幕效果（如摇晃、闪光等）
    this.ctx.save()
    this.effectsSystem.applyScreenEffects(this.ctx, this.canvas)

    // 绘制敌人（使用新的视觉系统）
    // **性能优化**：只渲染屏幕内的敌人，添加边距以支持拖尾效果
    const margin = 100 // 渲染边距，确保拖尾效果可见
    const minX = -margin
    const maxX = this.canvas.width + margin
    const minY = -margin
    const maxY = this.canvas.height + margin
    
    // 使用传统for循环代替forEach，性能更好
    const enemyCount = this.enemies.length
    for (let i = 0; i < enemyCount; i++) {
      const enemy = this.enemies[i]
      
      // **性能优化**：跳过屏幕外的敌人
      if (enemy.x < minX || enemy.x > maxX || enemy.y < minY || enemy.y > maxY) {
        continue
      }
      
      const enemyAny = enemy as any
      const enemyOptions = {
        type: enemy.type || 'grunt',
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        shield: enemyAny.shield,
        maxShield: enemyAny.maxShield,
        isElite: enemyAny.isElite || false,
        animationState: this.getEnemyAnimationState(enemy),
        size: enemy.size,
        color: enemy.color,
        glowColor: this.getEnemyGlowColor(enemy),
        statusEffects: (enemyAny.statusEffects || []).map((e: any) => ({
          id: e.id,
          icon: e.icon || '?',
          color: e.id === 'freeze' ? '#44aaff' : e.id === 'poison' ? '#00ff00' : '#ffffff',
          duration: e.duration,
          maxDuration: e.maxDuration
        }))
      }
      
      // 添加冻结状态的视觉效果（蓝色冰霜光晕）
      const isFrozen = enemyAny.statusEffects?.some((e: any) => e.id === 'freeze' && e.duration > 0)
      if (isFrozen) {
        this.ctx.save()
        this.ctx.translate(enemy.x, enemy.y)
        this.ctx.strokeStyle = '#44aaff'
        this.ctx.lineWidth = 3
        this.ctx.shadowColor = '#44aaff'
        this.ctx.shadowBlur = 15
        this.ctx.globalAlpha = 0.8
        this.ctx.beginPath()
        this.ctx.arc(0, 0, enemy.size / 2 + 5, 0, Math.PI * 2)
        this.ctx.stroke()
        this.ctx.restore()
      }
      
      // 添加中毒状态的视觉效果（绿色毒云）
      const isPoisoned = enemyAny.statusEffects?.some((e: any) => e.id === 'poison' && e.duration > 0)
      if (isPoisoned) {
        // 在敌人周围创建持续的中毒粒子效果
        if (!enemyAny.lastPoisonEffect || Date.now() - enemyAny.lastPoisonEffect > 200) {
          this.effectsSystem.createParticleEffect('dust_cloud', enemy.x, enemy.y + enemy.size / 2, {
            count: 3,
            colors: ['#00ff00', '#44ff44', '#88ff88'],
            size: { min: 2, max: 5 },
            speed: { min: 10, max: 30 },
            life: { min: 500, max: 1000 },
            spread: 180,
            gravity: -50
          })
          enemyAny.lastPoisonEffect = Date.now()
        }
      }
      // **性能优化**：使用简单的ID，避免Date.now()调用
      this.enemyVisualSystem.drawEnemy(this.ctx, enemy.x, enemy.y, enemyOptions, `enemy_${i}`)
    }

    // 绘制掉落物（在敌人之后，投射物之前）
    this.drawDroppedItems()

    // 绘制非激光投射物的拖尾
    this.projectileVisualSystem.drawTrails(this.ctx)

    // 绘制投射物（使用新的视觉系统）
    // **性能优化**：只渲染屏幕内的投射物，使用传统for循环
    const projectileCount = this.projectiles.length
    for (let i = 0; i < projectileCount; i++) {
      const projectile = this.projectiles[i]
      
      // **性能优化**：跳过屏幕外的投射物
      if (projectile.x < minX || projectile.x > maxX || projectile.y < minY || projectile.y > maxY) {
        continue
      }
      
      const projectileType = this.getProjectileType(projectile)
      let projectileColor = '#0088ff'
      
      // 根据投射物类型设置颜色
      if (projectileType === 'laser') {
        // 暴击使用黄色激光，普通使用青色激光
        projectileColor = projectile.isCrit ? '#ffff00' : '#00ffff'
      } else if (projectile.isCrit) {
        projectileColor = '#ffff00'
      }
      
      const projectileOptions = {
        type: projectileType,
        size: projectileType === 'laser' ? 8 : 4,  // 激光束尺寸，增加激光基础尺寸
        color: projectileColor,
        isCrit: projectile.isCrit,
        damage: projectile.damage,
        velocity: { x: projectile.vx, y: projectile.vy },
        life: projectile.life,
        maxLife: 1000
      }
      
      // **性能优化**：使用索引作为ID，避免字符串拼接
      this.projectileVisualSystem.drawProjectile(
        this.ctx, 
        projectile.x, 
        projectile.y, 
        projectileOptions,
        projectileType === 'laser' ? undefined : `projectile_${i}`  // 激光不产生拖尾ID
      )
    }

    // 绘制玩家（使用新的视觉系统）
    const playerOptions = {
      health: this.playerHealth,
      maxHealth: this.playerMaxHealth,
      weapon: this.getCurrentWeaponType(),
      skin: 'default',
      animationState: this.getPlayerAnimationState(),
      effects: this.getPlayerEffects(),
      lastAttackTime: this.lastAttackTime  // 传递最后攻击时间
    }
    this.visualRenderer.drawPlayer(this.ctx, this.playerX, this.playerY, this.playerAngle, playerOptions)

    // 取消技能预警机制：不再绘制预警图形

    // 绘制预警线（弓箭手和狙击手）
    // **性能优化**：使用传统for循环，只检查屏幕内的敌人
    for (let i = 0; i < enemyCount; i++) {
      const enemy = this.enemies[i]
      // 只绘制屏幕内的预警线
      if (enemy.x >= minX && enemy.x <= maxX && enemy.y >= minY && enemy.y <= maxY) {
        if (enemy.warningLine && (enemy.type === 'archer' || enemy.type === 'sniper')) {
          this.drawWarningLine(enemy)
        }
      }
    }

    // 绘制粒子效果
    this.effectsSystem.drawParticleEffects(this.ctx)
    
    // 绘制爆炸效果
    this.projectileVisualSystem.drawExplosions(this.ctx)
    
    // 绘制基础粒子
    this.visualRenderer.drawParticles(this.ctx)

    this.ctx.restore()

    // 绘制UI（不受屏幕效果影响）
    this.drawUI()
  }

  // 绘制预警线
  private drawWarningLine(enemy: any) {
    if (!enemy.warningLine) return
    
    const line = enemy.warningLine
    const elapsed = Date.now() - line.time
    const alpha = Math.max(0, 1 - elapsed / 1000) // 1秒内淡出
    
    this.ctx.save()
    this.ctx.strokeStyle = `rgba(255, 0, 0, ${alpha})`
    this.ctx.lineWidth = 3
    this.ctx.beginPath()
    this.ctx.moveTo(line.startX, line.startY)
    this.ctx.lineTo(line.endX, line.endY)
    this.ctx.stroke()
    this.ctx.restore()
  }

  private drawPlayer() {
    // 保存上下文
    this.ctx.save()
    
    // 移动到玩家位置
    this.ctx.translate(this.playerX, this.playerY)
    this.ctx.rotate(this.playerAngle)

    // 绘制玩家身体（圆形）
    this.ctx.fillStyle = '#00ff88'
    this.ctx.beginPath()
    this.ctx.arc(0, 0, 15, 0, Math.PI * 2)
    this.ctx.fill()

    // 绘制玩家武器（弓箭/枪）
    this.ctx.strokeStyle = '#8B4513'
    this.ctx.lineWidth = 4
    this.ctx.beginPath()
    this.ctx.moveTo(0, 0)
    this.ctx.lineTo(25, 0)
    this.ctx.stroke()

    // 绘制武器尖端
    this.ctx.fillStyle = '#C0C0C0'
    this.ctx.beginPath()
    this.ctx.arc(25, 0, 3, 0, Math.PI * 2)
    this.ctx.fill()

    // 恢复上下文
    this.ctx.restore()
  }

  private drawEnemy(enemy: { x: number; y: number; size: number; color: string; health: number; maxHealth: number; type?: string }) {
    // 保存上下文
    this.ctx.save()
    this.ctx.translate(enemy.x, enemy.y)

    const isElite = (enemy as any).isElite || false
    const phantomEnemy = enemy as any
    const isInvisible = enemy.type === 'phantom' && phantomEnemy.isInvisible
    
    // 精英敌人：绘制光环效果
    if (isElite) {
      this.ctx.strokeStyle = enemy.color
      this.ctx.lineWidth = 2
      for (let i = 0; i < 3; i++) {
        const radius = enemy.size / 2 + 2 + i * 2
        this.ctx.beginPath()
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2)
        this.ctx.stroke()
      }
    }

    // 绘制敌人身体
    if (enemy.type === 'heavy' || isElite) {
      // 重装者和精英：圆形，更大更坚固
      this.ctx.fillStyle = enemy.color
      this.ctx.beginPath()
      this.ctx.arc(0, 0, enemy.size / 2, 0, Math.PI * 2)
      this.ctx.fill()
      
      // 绘制外圈
      this.ctx.strokeStyle = this.ctx.fillStyle
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(0, 0, enemy.size / 2, 0, Math.PI * 2)
      this.ctx.stroke()
    } else if (enemy.type === 'sniper') {
      // 狙击手：六边形
        this.ctx.fillStyle = enemy.color
        this.ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 2
        const x = Math.cos(angle) * enemy.size / 2
        const y = Math.sin(angle) * enemy.size / 2
        if (i === 0) this.ctx.moveTo(x, y)
        else this.ctx.lineTo(x, y)
      }
        this.ctx.closePath()
        this.ctx.fill()
    } else if (enemy.type === 'support') {
      // 支援者：圆形带装饰
      this.ctx.fillStyle = enemy.color
      this.ctx.beginPath()
      this.ctx.arc(0, 0, enemy.size / 2, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.strokeStyle = '#ffff00'
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(0, 0, enemy.size / 2 + 2, 0, Math.PI * 2)
      this.ctx.stroke()
    } else if (enemy.type === 'hunter') {
      // 猎犬：快速型，三角形
        this.ctx.fillStyle = enemy.color
        this.ctx.beginPath()
        this.ctx.moveTo(0, -enemy.size/2)
        this.ctx.lineTo(enemy.size/2, enemy.size/2)
        this.ctx.lineTo(-enemy.size/2, enemy.size/2)
        this.ctx.closePath()
        this.ctx.fill()
    } else {
      // 默认：方形或圆形
      // 幻影隐身时半透明
      if (isInvisible) {
        this.ctx.globalAlpha = 0.3
      }
        this.ctx.fillStyle = enemy.color
      if (enemy.type === 'charger') {
        // 冲锋者：圆形
        this.ctx.beginPath()
        this.ctx.arc(0, 0, enemy.size / 2, 0, Math.PI * 2)
        this.ctx.fill()
      } else if (enemy.type === 'phantom') {
        // 幻影：菱形
        this.ctx.beginPath()
        this.ctx.moveTo(0, -enemy.size/2)
        this.ctx.lineTo(enemy.size/2, 0)
        this.ctx.lineTo(0, enemy.size/2)
        this.ctx.lineTo(-enemy.size/2, 0)
        this.ctx.closePath()
        this.ctx.fill()
      } else {
        this.ctx.fillRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size)
      }
      if (isInvisible) {
        this.ctx.globalAlpha = 1.0
      }
    }

    // 绘制敌人眼睛（隐身时不绘制眼睛）
    if (enemy.type !== 'swarm' && !isInvisible) { // 群体型太小时不画眼睛，隐身时不画眼睛
      this.ctx.fillStyle = '#ff0000'
      this.ctx.beginPath()
      this.ctx.arc(-enemy.size/4, -enemy.size/4, 2, 0, Math.PI * 2)
      this.ctx.fill()
      this.ctx.beginPath()
      this.ctx.arc(enemy.size/4, -enemy.size/4, 2, 0, Math.PI * 2)
      this.ctx.fill()
    }

    // 绘制生命值条（增强版）
    const barWidth = enemy.size * 1.2
    const barHeight = 4
    const healthPercent = enemy.health / enemy.maxHealth

    // 背景
    this.ctx.fillStyle = '#330000'
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 10, barWidth, barHeight)
    
    // 血量
    if (healthPercent > 0.5) {
      this.ctx.fillStyle = '#00ff00'
    } else if (healthPercent > 0.25) {
      this.ctx.fillStyle = '#ffff00'
    } else {
      this.ctx.fillStyle = '#ff0000'
    }
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 10, barWidth * healthPercent, barHeight)

    // 精英标记（第5关Boss不显示五角星）
    const isEliteEnemy = (enemy as any).isElite
    if (isEliteEnemy && enemy.type !== 'infantry_captain') {
      this.ctx.font = 'bold 12px Arial'
      this.ctx.fillStyle = '#ffff00'
      this.ctx.textAlign = 'center'
      this.ctx.fillText('★', 0, -enemy.size/2 - 15)
      
      // 绘制护盾值
      if ((enemy as any).shield !== undefined && (enemy as any).shield > 0) {
        const shieldPercent = (enemy as any).shield / ((enemy as any).maxShield || 50)
        this.ctx.fillStyle = '#00ffff'
        this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 16, barWidth * shieldPercent, barHeight)
      }
    }

    // 绘制敌人类型标识
    if (enemy.type) {
      let icon = ''
      switch (enemy.type) {
        case 'charger': icon = '⚡'; break
        case 'heavy': icon = '🛡️'; break
        case 'sniper': icon = '🎯'; break
        case 'support': icon = '✨'; break
        case 'fortress': icon = '🏰'; break
        case 'hunter': icon = '🐺'; break
        case 'shaman': icon = '🔮'; break
      }
      if (icon) {
        this.ctx.font = 'bold 14px Arial'
        this.ctx.fillStyle = '#ffffff'
        this.ctx.textAlign = 'center'
        this.ctx.fillText(icon, 0, -enemy.size/2 - 25)
      }
    }

    this.ctx.restore()
  }

  private drawProjectile(projectile: { x: number; y: number; vx: number; vy: number; damage: number; isCrit: boolean; life: number }) {
    // 保存上下文
    this.ctx.save()
    this.ctx.translate(projectile.x, projectile.y)

    // 计算投射物角度
    const angle = Math.atan2(projectile.vy, projectile.vx)

    // 绘制长条形状的子弹
    this.ctx.rotate(angle)
    
    if (projectile.isCrit) {
      // 暴击特效：黄色，更大
      this.ctx.fillStyle = '#ffff00'
      this.ctx.fillRect(-15, -3, 30, 6)
      
      // 暴击光效
      this.ctx.strokeStyle = '#ffff00'
      this.ctx.lineWidth = 2
      this.ctx.strokeRect(-15, -3, 30, 6)
    } else {
      // 普通子弹：蓝色
      this.ctx.fillStyle = '#0088ff'
      this.ctx.fillRect(-12, -2, 24, 4)
    }

    this.ctx.restore()
  }

  private drawUI() {
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = 'bold 18px Arial'
    
    // 显示层数
    this.ctx.fillText('层数: ' + this.currentLevel, 20, 25)
    
    // 显示分数
    this.ctx.fillText('分数: ' + this.getScore(), 120, 25)
    
    // 显示时间
    this.ctx.fillText('时间: ' + Math.ceil(this.gameTime), 220, 25)
    
    // 显示暂停状态
    if (this.isPaused) {
      this.ctx.fillStyle = '#ff4444'
      this.ctx.font = 'bold 24px Arial'
      this.ctx.fillText('游戏暂停 - 按P或空格键继续', this.canvas.width/2 - 150, this.canvas.height/2)
    }
    
    // 绘制生命值条
    this.drawHealthBar()
    
    // 被动属性选择界面现在由Vue组件系统处理，不再在Canvas中绘制
  }

  private drawHealthBar() {
    const barWidth = 200
    const barHeight = 20
    const barX = 20
    const barY = 50
    const healthPercent = Math.max(0, this.playerHealth / this.playerMaxHealth)

    // 获取玩家护盾值（从gameState或直接使用）
    const playerShield = (this.gameState?.player as any)?.shield || 0
    const playerMaxShield = (this.gameState?.player as any)?.maxShield || 0

    // 生命值文字
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '16px Arial'
    this.ctx.fillText(`生命: ${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`, barX, barY - 5)

    // 护盾值文字（如果有护盾）
    if (playerMaxShield > 0 && playerShield > 0) {
      this.ctx.fillStyle = '#00ffff'
      this.ctx.font = '14px Arial'
      this.ctx.fillText(`护盾: ${Math.ceil(playerShield)}/${playerMaxShield}`, barX, barY + barHeight + 15)
    }

    // 生命值条背景
    this.ctx.fillStyle = '#333333'
    this.ctx.fillRect(barX, barY, barWidth, barHeight)

    // 生命值条
    if (healthPercent > 0) {
      this.ctx.fillStyle = healthPercent > 0.3 ? '#00ff88' : '#ff4444'
      this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight)
    }

    // **修复**：护盾值条（在生命值条下方，类似敌人护盾显示）
    if (playerMaxShield > 0 && playerShield > 0) {
      const shieldPercent = playerShield / playerMaxShield
      const shieldBarY = barY + barHeight + 4
      
      // 护盾条背景
      this.ctx.fillStyle = '#333333'
      this.ctx.fillRect(barX, shieldBarY, barWidth, barHeight)
      
      // 护盾条（青色，类似敌人护盾）
      this.ctx.fillStyle = '#00ffff'
      this.ctx.fillRect(barX, shieldBarY, barWidth * shieldPercent, barHeight)
    }
  }


  // 新增的辅助方法，支持新的视觉系统
  private getEnemyAnimationState(enemy: any): 'idle' | 'moving' | 'attacking' | 'hit' | 'dying' | 'special' {
    if (enemy.health <= 0) return 'dying'
    if (Date.now() - (enemy.lastAttack || 0) < 200) return 'attacking'
    if (enemy.targetX !== undefined || enemy.targetY !== undefined) return 'moving'
    return 'idle'
  }
  
  private getEnemyGlowColor(enemy: any): string {
    if ((enemy as any).isElite) return '#FFD700'
    if (enemy.type === 'archer') return '#ff8800'
    if (enemy.type === 'sniper') return '#ff0000'
    if (enemy.type === 'healer') return '#00ff00'
    return enemy.color
  }
  
  private getProjectileType(projectile: any): 'basic' | 'piercing' | 'explosive' | 'energy' | 'arrow' | 'grenade' | 'laser' | 'magic' {
    if (projectile.isGrenade) return 'grenade'
    if (projectile.owner === 'enemy') return 'arrow'
    
    // 根据玩家武器类型返回对应投射物
    const weaponType = this.getCurrentWeaponType()
    if (weaponType === 'laser_gun') {
      // 暴击也使用激光类型，只是颜色不同
      // 穿透也使用激光类型，而不是虚线
      return 'laser'
    }
    
    if (projectile.isCrit) return 'energy'
    if (projectile.pierce > 0) return 'piercing'
    return 'basic'
  }
  
  private getCurrentWeaponType(): string {
    // 根据游戏状态返回当前武器类型
    if (this.gameState?.player?.weapon) {
      return this.gameState.player.weapon
    }
    return 'laser_gun' // 默认武器改为激光枪
  }
  
  private getPlayerAnimationState(): 'idle' | 'moving' | 'attacking' | 'hit' | 'dying' {
    if (this.playerHealth <= 0) return 'dying'
    if (Date.now() - this.playerIFrameUntil < 200 && this.playerIFrameUntil > Date.now()) return 'hit'
    if (Date.now() - (this.lastAttackTime || 0) < 150) return 'attacking'
    if (this.keys['w'] || this.keys['s'] || this.keys['a'] || this.keys['d'] || 
        this.keys['ArrowUp'] || this.keys['ArrowDown'] || this.keys['ArrowLeft'] || this.keys['ArrowRight']) {
      return 'moving'
    }
    return 'idle'
  }
  
  private getPlayerEffects(): any[] {
    const effects = []
    
    // 根据玩家状态添加视觉效果
    if (this.lifestealPercent > 0) {
      effects.push({ type: 'damage_boost', color: '#ff4444' })
    }
    
    if (this.autoRegenAmount > 0) {
      effects.push({ type: 'speed_boost', color: '#00ff00' })
    }
    
    // 无敌帧效果
    if (Date.now() < this.playerIFrameUntil) {
      effects.push({ type: 'shield', color: '#88ffff' })
    }
    
    return effects
  }


  private resetGame() {
    // 重置玩家状态
    this.playerHealth = this.playerMaxHealth
    this.playerX = this.canvas.width / 2
    this.playerY = this.canvas.height / 2
    this.score = 0
    
    // 清空敌人和投射物
    this.enemies = []
    this.pendingEnemies = [] // 清空待添加队列
    this.projectiles = []
    this.effects = []
    this.droppedItems = []
    
    // 重新生成一个敌人
    this.spawnEnemy()
  }

  private triggerGameOver() {
    // 暂停游戏
    this.isPaused = true
    
    // 设置游戏状态为结束
    if (this.gameState) {
      this.gameState.isGameOver = true
      this.gameState.isPaused = true
    }
    
    // 通知Vue组件游戏结束
    if (this.onLevelComplete) {
      this.onLevelComplete()
    }
    
    console.log('游戏结束，触发死亡界面')
  }

  // 处理键盘输入（特殊按键）
  handleKeyDown(key: string) {
    switch (key.toLowerCase()) {
      case 'p': case ' ': this.togglePause(); break
      // 被动属性选择现在由Vue组件系统处理，不再使用键盘数字键
    }
  }

  // 暂停/继续游戏
  togglePause() {
    this.isPaused = !this.isPaused
    console.log('游戏', this.isPaused ? '暂停' : '继续')
  }
  
  // 设置暂停状态
  setPaused(paused: boolean) {
    if (paused && !this.isPaused) {
      // 开始暂停，记录暂停时间
      this.lastPauseTime = Date.now()
    } else if (!paused && this.isPaused) {
      // 结束暂停，累计暂停时间
      if (this.lastPauseTime > 0) {
        this.pausedTime += Date.now() - this.lastPauseTime
        this.lastPauseTime = 0
      }
    }
    this.isPaused = paused
    
    // 暂停/恢复背景音乐
    if (paused) {
      this.audioSystem.pauseBackgroundMusic()
    } else {
      this.audioSystem.resumeBackgroundMusic()
    }
    
    console.log('游戏状态设置为:', paused ? '暂停' : '继续')
  }


  // 更新游戏时间
  private updateGameTime() {
    // 如果游戏暂停，不更新时间（避免在暂停期间触发关卡切换）
    if (this.isPaused) {
      return
    }
    
    // 如果正在执行 nextLevel，不更新时间，防止重复调用
    if (this.isInNextLevel) {
      return
    }
    
    const currentTime = Date.now()
    // 如果正在暂停，需要扣除当前暂停的时间
    let currentPauseTime = this.pausedTime
    if (this.lastPauseTime > 0) {
      // 正在暂停中，加上当前暂停的时间
      currentPauseTime += currentTime - this.lastPauseTime
    }
    // 扣除暂停时间
    const actualElapsedSeconds = (currentTime - this.gameStartTime - currentPauseTime) / 1000
    const levelTime = this.getLevelTime(this.currentLevel)
    this.gameTime = Math.max(0, levelTime - actualElapsedSeconds)
    
    // 时间到0时进入下一层，但只触发一次
    if (this.gameTime <= 0 && !this.hasTriggeredLevelComplete && !this.isInNextLevel) {
      console.log(`[updateGameTime] 时间到0，触发关卡切换，当前关卡: ${this.currentLevel}`)
      this.hasTriggeredLevelComplete = true
      this.nextLevel()
    }
  }

  // 更新玩家移动
  private updatePlayerMovement() {
    // 保存上一帧位置（用于计算移动方向，供phantom背刺检测使用）
    this.playerLastX = this.playerX
    this.playerLastY = this.playerY
    
    // 从gameState获取移动速度
    // **修复**：确保moveSpeed不会因为undefined或0而被重置
    const baseMoveSpeed = 2.0 // 基础移动速度
    const moveSpeedMultiplier = this.gameState?.player?.moveSpeed ?? 1.0 // 默认1.0（100%），如果未定义或无效则使用1.0
    const moveSpeed = baseMoveSpeed * moveSpeedMultiplier
    
    // **调试**：如果moveSpeed异常，输出日志
    if (moveSpeedMultiplier < 0.5 || moveSpeedMultiplier > 2.0) {
      console.warn(`⚠️ 异常移动速度倍数: ${moveSpeedMultiplier}, 当前关卡: ${this.currentLevel}`)
    }
    
    if (this.keys['w'] || this.keys['arrowup']) {
      this.playerY -= moveSpeed
    }
    if (this.keys['s'] || this.keys['arrowdown']) {
      this.playerY += moveSpeed
    }
    if (this.keys['a'] || this.keys['arrowleft']) {
      this.playerX -= moveSpeed
    }
    if (this.keys['d'] || this.keys['arrowright']) {
      this.playerX += moveSpeed
    }
    
    // 边界检查
    this.playerX = Math.max(20, Math.min(this.canvas.width - 20, this.playerX))
    this.playerY = Math.max(20, Math.min(this.canvas.height - 20, this.playerY))
  }

  // 更新生命回复
  private updateHealthRegen() {
    const now = Date.now()
    
    // 每秒回复一次（1000毫秒 = 1秒）
    if (now - this.lastRegenTime >= 1000) {
      // 从gameState获取生命回复量
      const regenAmount = this.gameState?.player?.regeneration || 0
      if (regenAmount > 0) {
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + regenAmount)
      }
      this.lastRegenTime = now
    }
  }

  // 进入下一层
  private nextLevel() {
    // 防止重复调用
    if (this.isInNextLevel) {
      console.warn(`[nextLevel] 警告：已经在执行 nextLevel，跳过重复调用。当前关卡: ${this.currentLevel}`)
      return
    }
    
    // 如果游戏已结束，不执行
    if (this.gameState?.isGameOver) {
      console.warn(`[nextLevel] 警告：游戏已结束，不执行关卡切换`)
      return
    }
    
    // 设置标志，防止重复调用
    this.isInNextLevel = true
    
    try {
      // 重要：在增加关卡之前保存 previousLevel，供回调使用
      const previousLevel = this.currentLevel
      const newLevel = this.currentLevel + 1
      
      // **关键修复**：检查是否在Boss层，如果本层没有击杀Boss，则重置hasDefeatedBoss
      // 只有成功击杀Boss的层，hasDefeatedBoss才会保持为true，用于下一层的精英怪额外属性选择
      const isBossLevel = [5, 10, 15, 20].includes(previousLevel)
      if (isBossLevel && this.gameState) {
        // 检查本层是否真的击杀了Boss（通过bossDefeated标志）
        const bossWasDefeated = this.gameState.bossDefeated === previousLevel
        if (!bossWasDefeated) {
          // 如果本层是Boss层但没有击杀Boss（时间到了），重置hasDefeatedBoss和额外属性选择标志
          console.log(`[nextLevel] Boss层(${previousLevel})未击杀Boss（时间到），重置hasDefeatedBoss标志`)
          this.gameState.hasDefeatedBoss = false
          this.gameState.extraAttributeSelect = false // **关键修复**：同时重置额外属性选择标志
        } else {
          console.log(`[nextLevel] Boss层(${previousLevel})成功击杀Boss，保留hasDefeatedBoss标志`)
        }
      } else if (this.gameState) {
        // **关键修复**：非Boss层进入下一层时，如果之前有未使用的额外属性选择标志，也要清除
        // 避免在非Boss层显示额外属性选择
        if (this.gameState.extraAttributeSelect && !this.gameState.hasDefeatedBoss) {
          console.log(`[nextLevel] 非Boss层，清除无效的额外属性选择标志`)
          this.gameState.extraAttributeSelect = false
        }
      }
      
      console.log(`[nextLevel] 开始执行，从关卡 ${previousLevel} 切换到关卡 ${newLevel}`)
      
      this.currentLevel = newLevel
      
      // 血量回满
      this.playerHealth = this.playerMaxHealth
      // 角色回到初始位置
      this.playerX = this.canvas.width / 2
      this.playerY = this.canvas.height / 2
      // 清空所有敌人、投射物和特效（每一层开始时都没有敌人）
      this.enemies = []
      this.pendingEnemies = [] // 清空待添加队列
      this.projectiles = []
      this.effects = []
      // 重置本层Boss生成标记
      this.bossSpawnedInLevel = false
      // 重置层级开始时间和生成计时器
      this.levelStartTime = Date.now()
      this.enemySpawnTimer = 0
      // 重置快速虫波次控制
      this.bugWaveCount = 0
      this.bugWaveCooldown = 0
      
      // **重要**：在调用回调之前立即暂停游戏，避免在回调执行期间继续运行游戏循环
      // 回调会设置暂停状态，但这里先暂停确保安全
      const wasPaused = this.isPaused
      this.isPaused = true
      if (this.gameState) {
        this.gameState.isPaused = true
      }
      
      // 重置时间但保持游戏状态（在暂停后重置，避免时间计算错误）
      // **关键修复**：先重置 hasTriggeredLevelComplete，确保不会有重复触发
      this.hasTriggeredLevelComplete = false // 重置关卡完成标志
      this.gameTime = this.getLevelTime(this.currentLevel)
      this.gameStartTime = Date.now()
      this.pausedTime = 0
      this.lastPauseTime = 0
      
      // **关键修复**：确保在暂停状态下，时间不会立即触发下一次关卡切换
      // 因为 isPaused = true，updateGameTime() 会直接返回，不会检查时间
      
      // 播放升级/进入下一层音效
      this.audioSystem.playSoundEffect('level_up')
      
      // **关键修复**：在调用回调之前，先同步 gameState.level 为 previousLevel
      // 这样 gameStore.nextLevel() 可以正确读取 previousLevel
      // 但我们需要确保 gameStore.nextLevel() 不会基于错误的 level 值递增
      if (this.gameState) {
        // 先同步为 previousLevel，供回调读取
        this.gameState.level = previousLevel
        console.log(`[nextLevel] 同步 gameState.level = ${previousLevel} (供回调读取 previousLevel)`)
      }
      
      // 通知Vue组件系统处理被动属性选择
      // 注意：在回调中，gameStore.nextLevel() 会读取 gameState.level 作为 previousLevel
      if (this.onLevelComplete) {
        console.log(`[nextLevel] 调用 onLevelComplete 回调，previousLevel: ${previousLevel}, newLevel: ${newLevel}`)
        try {
          this.onLevelComplete()
          console.log(`[nextLevel] onLevelComplete 回调执行完成`)
        } catch (error) {
          console.error(`[nextLevel] onLevelComplete 回调执行出错:`, error)
          // 如果回调出错，恢复暂停状态
          if (!wasPaused && this.gameState) {
            this.isPaused = false
            this.gameState.isPaused = false
          }
        }
      }
      
      // **关键修复**：回调完成后，同步 gameState.level 为正确的 newLevel
      // 确保 gameState.level 和 currentLevel 保持一致
      if (this.gameState) {
        this.gameState.level = this.currentLevel
        console.log(`[nextLevel] 回调完成后，同步 gameState.level = ${this.currentLevel}`)
      }
      
      console.log(`[nextLevel] 完成执行，进入第 ${this.currentLevel} 层，血量回满，位置重置，敌人清空`)
    } finally {
      // 确保标志被重置
      this.isInNextLevel = false
    }
  }

  // 生成被动属性选项
  private generatePassiveOptions() {
    const shuffled = [...this.passiveAttributes].sort(() => 0.5 - Math.random())
    this.passiveOptions = shuffled.slice(0, 3)
  }

  // 选择被动属性
  public selectPassive(index: number) {
    if (index >= 0 && index < this.passiveOptions.length) {
      const selected = this.passiveOptions[index]
      this.applyPassiveAttribute(selected.id)
      this.showPassiveSelection = false
      
      // 播放UI点击音效
      this.audioSystem.playSoundEffect('ui_click')
      
      // 不调用startNewLevel，保持当前游戏状态
      console.log('获得被动属性:', selected.name, '，继续当前层')
    }
  }

  // 应用被动属性
  private applyPassiveAttribute(passiveId: string) {
    switch (passiveId) {
      case 'damage_boost':
        // 攻击力提升在投射物创建时处理
        break
      case 'speed_boost':
        // 移动速度提升在移动时处理
        break
      case 'health_boost':
        this.playerMaxHealth += 20
        this.playerHealth += 20
        break
      case 'crit_boost':
        // 暴击率提升在投射物创建时处理
        break
      case 'attack_speed':
        this.attackCooldown = Math.max(50, this.attackCooldown - 50)
        break
      case 'regen':
        // 生命回复在update中处理
        break
      case 'lifesteal':
        this.lifestealPercent += 10
        break
      case 'auto_regen':
        this.autoRegenAmount += 3
        break
    }
    console.log('获得被动属性:', passiveId)
  }

  // 开始新层
  private startNewLevel() {
    this.gameTime = this.getLevelTime(this.currentLevel)
    this.gameStartTime = Date.now()
    // 不清空敌人和投射物，保持当前状态
    // this.enemies = []
    // this.projectiles = []
    // this.effects = []
    // 只在没有敌人时生成新敌人
    if (this.enemies.length === 0) {
      this.spawnEnemy()
    }
  }

  // 绘制被动属性选择界面（第一层样式）
  private drawPassiveSelection() {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2
    const cardWidth = 200
    const cardHeight = 150
    const cardSpacing = 20
    
    // 绘制半透明背景覆盖层
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
    // 绘制标题
    this.ctx.fillStyle = '#00ff88'
    this.ctx.font = 'bold 36px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.fillText('选择被动属性', centerX, centerY - 200)
    
    // 绘制副标题
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = 'bold 20px Arial'
    this.ctx.fillText(`第${this.currentLevel}层 - 选择你的强化`, centerX, centerY - 160)
    
    // 绘制三个选项卡片（横向排列）
    this.passiveOptions.forEach((option, index) => {
      const cardX = centerX - (cardWidth * 1.5 + cardSpacing) + index * (cardWidth + cardSpacing)
      const cardY = centerY - cardHeight/2
      
      // 绘制卡片背景（深灰色）
      this.ctx.fillStyle = 'rgba(40, 40, 40, 0.9)'
      this.ctx.fillRect(cardX, cardY, cardWidth, cardHeight)
      
      // 绘制卡片边框（绿色）
      this.ctx.strokeStyle = '#00ff88'
      this.ctx.lineWidth = 2
      this.ctx.strokeRect(cardX, cardY, cardWidth, cardHeight)
      
      // 绘制图标（简单的几何图形）
      this.drawPassiveIcon(cardX + cardWidth/2, cardY + 30, option.id)
      
      // 绘制选项文字
      this.ctx.fillStyle = '#ffffff'
      this.ctx.font = 'bold 16px Arial'
      this.ctx.textAlign = 'center'
      this.ctx.fillText(option.name, cardX + cardWidth/2, cardY + 60)
      
      this.ctx.font = '14px Arial'
      this.ctx.fillText(option.description, cardX + cardWidth/2, cardY + 85)
      
      // 绘制数字键提示
      this.ctx.fillStyle = '#ffff00'
      this.ctx.font = 'bold 18px Arial'
      this.ctx.fillText(`${index + 1}`, cardX + cardWidth/2, cardY + 110)
    })
    
    // 绘制底部提示
    this.ctx.fillStyle = '#ffff00'
    this.ctx.font = '18px Arial'
    this.ctx.fillText('按数字键 1、2、3 选择属性', centerX, centerY + 120)
    
    this.ctx.textAlign = 'left'
  }
  
  // 绘制被动属性图标
  private drawPassiveIcon(x: number, y: number, passiveId: string) {
    this.ctx.save()
    this.ctx.translate(x, y)
    
    switch (passiveId) {
      case 'damage_boost':
        // 攻击强化图标 - 红色星形
        this.ctx.fillStyle = '#ff4444'
        this.ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5
          const radius = i % 2 === 0 ? 15 : 8
          const px = Math.cos(angle) * radius
          const py = Math.sin(angle) * radius
          if (i === 0) this.ctx.moveTo(px, py)
          else this.ctx.lineTo(px, py)
        }
        this.ctx.closePath()
        this.ctx.fill()
        break
        
      case 'speed_boost':
        // 速度强化图标 - 橙色闪电
        this.ctx.fillStyle = '#ff8800'
        this.ctx.beginPath()
        this.ctx.moveTo(-12, -18)
        this.ctx.lineTo(6, -6)
        this.ctx.lineTo(-6, 6)
        this.ctx.lineTo(12, 18)
        this.ctx.lineTo(0, 12)
        this.ctx.lineTo(10, 0)
        this.ctx.closePath()
        this.ctx.fill()
        break
        
      case 'health_boost':
        // 生命强化图标 - 绿色心形
        this.ctx.fillStyle = '#00ff88'
        this.ctx.beginPath()
        this.ctx.moveTo(0, 6)
        this.ctx.bezierCurveTo(-12, -12, -24, -6, -18, 6)
        this.ctx.bezierCurveTo(-18, 12, 0, 24, 0, 24)
        this.ctx.bezierCurveTo(0, 24, 18, 12, 18, 6)
        this.ctx.bezierCurveTo(24, -6, 12, -12, 0, 6)
        this.ctx.fill()
        break
        
      case 'crit_boost':
        // 暴击强化图标 - 黄色爆炸
        this.ctx.fillStyle = '#ffff00'
        this.ctx.beginPath()
        this.ctx.arc(0, 0, 12, 0, Math.PI * 2)
        this.ctx.fill()
        this.ctx.fillStyle = '#ff8800'
        this.ctx.beginPath()
        this.ctx.arc(0, 0, 8, 0, Math.PI * 2)
        this.ctx.fill()
        break
        
      case 'attack_speed':
        // 攻速强化图标 - 蓝色箭头
        this.ctx.fillStyle = '#4488ff'
        this.ctx.beginPath()
        this.ctx.moveTo(-15, 0)
        this.ctx.lineTo(15, 0)
        this.ctx.lineTo(10, -8)
        this.ctx.moveTo(15, 0)
        this.ctx.lineTo(10, 8)
        this.ctx.stroke()
        this.ctx.lineWidth = 3
        break
        
      case 'regen':
        // 生命回复图标 - 绿色加号
        this.ctx.fillStyle = '#00ff88'
        this.ctx.fillRect(-8, -3, 16, 6)
        this.ctx.fillRect(-3, -8, 6, 16)
        break
        
      case 'lifesteal':
        // 生命偷取图标 - 红色心形带箭头
        this.ctx.fillStyle = '#ff4444'
        this.ctx.beginPath()
        this.ctx.moveTo(0, 6)
        this.ctx.bezierCurveTo(-8, -8, -16, -4, -12, 6)
        this.ctx.bezierCurveTo(-12, 10, 0, 16, 0, 16)
        this.ctx.bezierCurveTo(0, 16, 12, 10, 12, 6)
        this.ctx.bezierCurveTo(16, -4, 8, -8, 0, 6)
        this.ctx.fill()
        // 箭头
        this.ctx.fillStyle = '#ff8800'
        this.ctx.beginPath()
        this.ctx.moveTo(8, 0)
        this.ctx.lineTo(16, 0)
        this.ctx.lineTo(14, -4)
        this.ctx.moveTo(16, 0)
        this.ctx.lineTo(14, 4)
        this.ctx.stroke()
        this.ctx.lineWidth = 2
        break
        
      case 'auto_regen':
        // 自动回复图标 - 蓝色循环箭头
        this.ctx.fillStyle = '#4488ff'
        this.ctx.beginPath()
        this.ctx.arc(0, 0, 12, 0, Math.PI * 1.5)
        this.ctx.stroke()
        this.ctx.lineWidth = 3
        // 箭头
        this.ctx.beginPath()
        this.ctx.moveTo(8, -8)
        this.ctx.lineTo(12, -4)
        this.ctx.moveTo(8, -8)
        this.ctx.lineTo(4, -4)
        this.ctx.stroke()
        break
        
      case 'pierce':
        // 穿透攻击图标 - 紫色箭头
        this.ctx.fillStyle = '#8844ff'
        this.ctx.beginPath()
        this.ctx.moveTo(-15, 0)
        this.ctx.lineTo(15, 0)
        this.ctx.lineTo(10, -8)
        this.ctx.moveTo(15, 0)
        this.ctx.lineTo(10, 8)
        this.ctx.stroke()
        this.ctx.lineWidth = 3
        break
        
      case 'explosive':
        // 爆炸攻击图标 - 红色圆形带橙色中心
        this.ctx.fillStyle = '#ff4444'
        this.ctx.beginPath()
        this.ctx.arc(0, 0, 15, 0, Math.PI * 2)
        this.ctx.fill()
        this.ctx.fillStyle = '#ff8800'
        this.ctx.beginPath()
        this.ctx.arc(0, 0, 8, 0, Math.PI * 2)
        this.ctx.fill()
        break
        
      case 'multi_shot':
        // 多重射击图标 - 蓝色多重箭头
        this.ctx.fillStyle = '#4488ff'
        this.ctx.beginPath()
        this.ctx.moveTo(-10, -5)
        this.ctx.lineTo(10, -5)
        this.ctx.lineTo(8, -8)
        this.ctx.moveTo(10, -5)
        this.ctx.lineTo(8, -2)
        this.ctx.moveTo(-10, 0)
        this.ctx.lineTo(10, 0)
        this.ctx.lineTo(8, -3)
        this.ctx.moveTo(10, 0)
        this.ctx.lineTo(8, 3)
        this.ctx.moveTo(-10, 5)
        this.ctx.lineTo(10, 5)
        this.ctx.lineTo(8, 2)
        this.ctx.moveTo(10, 5)
        this.ctx.lineTo(8, 8)
        this.ctx.stroke()
        this.ctx.lineWidth = 2
        break
    }
    
    this.ctx.restore()
  }


  // 公共方法：暂停/继续游戏
  public pauseToggle() {
    this.togglePause()
  }

  // 公共getter：获取游戏时间
  public getGameTime(): number {
    return this.gameTime
  }

  // 公共getter：获取分数
  public getScore(): number {
    return this.score
  }

  // 公共方法：清空敌人和投射物
  public clearEntities() {
    this.enemies = []
    this.projectiles = []
  }

  // 公共方法：生成敌人
  public spawnEnemyPublic() {
    this.spawnEnemy()
  }

  // 跳转到指定层（用于测试功能）
  public jumpToLevel(level: number) {
    if (level < 1 || level > 20) {
      console.warn('无效的层数:', level)
      return
    }
    
    // 设置层数
    this.currentLevel = level
    
    // 血量回满
    this.playerHealth = this.playerMaxHealth
    if (this.gameState?.player) {
      this.gameState.player.health = this.gameState.player.maxHealth
    }
    
    // 角色回到初始位置
    this.playerX = this.canvas.width / 2
    this.playerY = this.canvas.height / 2
    if (this.gameState?.player?.position) {
      this.gameState.player.position.x = this.playerX
      this.gameState.player.position.y = this.playerY
    }
    
    // 清空所有敌人、投射物和特效（每一层开始时都没有敌人）
    this.enemies = []
    this.projectiles = []
    this.effects = []
    this.droppedItems = []
    // 重置本层Boss生成标记
    this.bossSpawnedInLevel = false
    
    // 重置层级开始时间和生成计时器
    this.levelStartTime = Date.now()
    this.enemySpawnTimer = 0
    
    // 重置快速虫波次控制
    this.bugWaveCount = 0
    this.bugWaveCooldown = 0
    
    // 重置时间但保持游戏状态
    this.gameTime = this.getLevelTime(level)
    this.gameStartTime = Date.now()
    this.pausedTime = 0
    this.lastPauseTime = 0
    this.hasTriggeredLevelComplete = false // 重置关卡完成标志
    // 重置本层Boss生成标记（用于某些流程进入新层）
    this.bossSpawnedInLevel = false
    
    // 更新游戏状态中的层数
    if (this.gameState) {
      this.gameState.level = level
      this.gameState.timeRemaining = this.getLevelTime(level)
    }
    
    console.log('跳转到第', this.currentLevel, '层，血量回满，位置重置，敌人清空（敌人将自然生成）')
  }
}
