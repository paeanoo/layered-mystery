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
  private effects: Array<{ x: number; y: number; type: string; life: number; size: number }> = []
  private enemySpawnTimer = 0
  private attackTimer = 0 // 毫秒计时器
  private lastAttackTime = Date.now()
  private levelStartTime = 0 // 当前层开始时间
  private enemyUpdateIndex = 0 // 敌人更新索引，用于分批更新
  private attackCooldown = 100 // 攻击间隔（毫秒）- 进一步提高攻击速度
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
  private gameStartTime = 0 // 游戏开始时间
  private pausedTime = 0 // 暂停时累计的时间
  private lastPauseTime = 0 // 最后一次暂停的时间戳
  private keys: { [key: string]: boolean } = {} // 键盘状态跟踪
  public currentLevel = 1 // 当前层数（公开用于测试功能）
  private showPassiveSelection = false // 是否显示被动属性选择
  private passiveOptions: Array<{id: string, name: string, description: string}> = [] // 被动属性选项
  private lifestealPercent = 0 // 生命偷取百分比
  private autoRegenAmount = 0 // 自动回复生命值
  private lastRegenTime = 0 // 上次回复生命的时间戳（毫秒）
  private hasTriggeredLevelComplete = false // 是否已经触发关卡完成
  
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
    // **修复**：所有伤害降低一半
    let baseDamage: number
    if (layer <= 3) {
      // 前3层：低伤害（减半）
      baseDamage = (3 + (layer - 1) * 0.5) * 0.5 // 1.5, 1.75, 2
    } else if (layer <= 10) {
      // 第4-10层：缓慢增长（减半）
      baseDamage = (4.5 + (layer - 3) * 0.6) * 0.5
    } else if (layer <= 15) {
      // 第11-15层：中等增长（减半）
      baseDamage = (8.7 + (layer - 10) * 0.8) * 0.5
    } else {
      // 第16层之后：正常增长（减半）
      baseDamage = (12.7 + (layer - 15) * 1.0) * 0.5
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
    const damage = this.calculateContactDamage(layer, enemyType)
    
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
      if (Math.abs(gameState.player.attackSpeed - (this.lastKnownAttackSpeed || 1.43)) > 0.01) {
        console.log(`⚡ 攻击速度已更新: ${gameState.player.attackSpeed.toFixed(2)}/秒, 攻击间隔: ${(1000 / gameState.player.attackSpeed).toFixed(1)}ms`)
        this.lastKnownAttackSpeed = gameState.player.attackSpeed
      }
    }
  }
  
  // 缓存上次已知的攻击速度，用于检测变化
  private lastKnownAttackSpeed: number = 1.43

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
    this.gameTime = 30
    this.gameStartTime = Date.now()
    this.levelStartTime = Date.now() // 初始化层级开始时间
    this.pausedTime = 0
    this.lastPauseTime = 0
    this.hasTriggeredLevelComplete = false // 重置关卡完成标志
    // 清空所有敌人、投射物和特效（初始应该什么都没有）
    this.enemies = []
    this.projectiles = []
    this.effects = []
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
    const deltaTime = now - this.lastUpdateTime
    this.lastUpdateTime = now
    
    // 更新视觉系统
    this.visualRenderer.update(deltaTime)
    this.enemyVisualSystem.update(deltaTime)
    this.projectileVisualSystem.update(deltaTime)
    this.effectsSystem.update(deltaTime)
    
    // 更新时间
    this.updateGameTime()
    
    // 同步分数到gameState
    if (this.gameState) {
      this.gameState.score = this.score
      this.gameState.level = this.currentLevel
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
    
    // **调试日志**：定期输出玩家位置（降低频率）
    if (Math.random() < 0.01) { // 1%的概率输出，避免日志过多
      console.log(`📍 玩家位置: (${this.playerX.toFixed(1)}, ${this.playerY.toFixed(1)})`)
    }
    
    // 处理生命回复
    this.updateHealthRegen()
    
    // 更新敌人（性能优化：分批更新，减少单帧负载）
    const enemyUpdateBatch = Math.min(this.enemies.length, 50) // 每帧最多更新50个敌人
    for (let i = 0; i < enemyUpdateBatch; i++) {
      const index = (this.enemyUpdateIndex + i) % this.enemies.length
      this.updateEnemyAI(this.enemies[index], index)
    }
    this.enemyUpdateIndex = (this.enemyUpdateIndex + enemyUpdateBatch) % Math.max(1, this.enemies.length)

    // 更新投射物（在玩家位置更新后）
    this.updateProjectiles()

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
    
    // 持续生成，无数量上限（只要间隔到了就生成，无论敌人有多少）
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
      { type: 'archer', weight: 60, layerStart: 5 },
      { type: 'sniper', weight: 70, layerStart: 4 }, // 狙击兵 - 高威胁远程单位，更早出现
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
    if (layer === 5) {
      // 步兵队长
      return {
        x, y,
        size: Math.floor(baseSize * 1.8),
        color: '#ff0000',
        health: Math.floor(baseHealth * 5),
        maxHealth: Math.floor(baseHealth * 5),
        type: 'infantry_captain',
        isElite: true,
        speed: 0.8,
        lastSkill: Date.now(),
        skillCooldown: 5000,
        icdUntil: 0
      }
    } else if (layer === 10) {
      // 堡垒守卫
      return {
        x, y,
        size: Math.floor(baseSize * 2.5),
        color: '#884400',
        health: Math.floor(baseHealth * 8),
        maxHealth: Math.floor(baseHealth * 8),
        type: 'fortress_guard',
        isElite: true,
        speed: 0.3,
        shield: 50,
        maxShield: 50,
        shieldUp: false,
        lastSkill: Date.now(),
        skillCooldown: 4000,
        icdUntil: 0
      }
    } else if (layer === 16) {
      // 虚空巫医
      return {
        x, y,
        size: Math.floor(baseSize * 2.0),
        color: '#ff00ff',
        health: Math.floor(baseHealth * 7),
        maxHealth: Math.floor(baseHealth * 7),
        type: 'void_shaman',
        isElite: true,
        speed: 0.5,
        lastSkill: Date.now(),
        skillCooldown: 6000,
        lastSlowingField: Date.now(),
        icdUntil: 0
      }
    } else if (layer === 20) {
      // 军团统帅
      return {
        x, y,
        size: Math.floor(baseSize * 2.8),
        color: '#000000',
        health: Math.floor(baseHealth * 12),
        maxHealth: Math.floor(baseHealth * 12),
        type: 'legion_commander',
        isElite: true,
        speed: 0.6,
        lastSkill: Date.now(),
        skillCooldown: 5000,
        phase: 1,
        icdUntil: 0
      }
    }
    
    return null
  }
  
  // 创建精英敌人
  private createEliteEnemy(layer: number, x: number, y: number, baseHealth: number, baseSize: number): any {
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
        lastSkill: Date.now(),
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
        lastSkill: Date.now(),
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
        lastSkill: Date.now(),
        skillCooldown: 6000,
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
      case 'archer': return 3000
      case 'sniper': return 1500 // 狙击兵攻击冷却，快速测试
      case 'shieldguard': return 0
      case 'bomb_bat': return 0
      case 'healer': return 3000
      case 'grenadier': return 4000
      case 'summoner': return 6000
      case 'phantom': return 0
      case 'boss': return 2000 // Boss远程攻击冷却
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
    const dx = this.playerX - enemy.x
    const dy = this.playerY - enemy.y
    const distanceSq = dx * dx + dy * dy
    const distance = Math.sqrt(distanceSq) // 仅在此处需要真实距离用于移动
    const now = Date.now()

    // 根据敌人类型执行不同行为
    switch (enemy.type) {
      case 'infantry':
        // 近战步兵：基础移动和接触伤害
        if (distance > 0) {
          const speed = enemy.speed || 0.7
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break
        
      case 'bug':
        // 快速虫：高速冲向玩家
        if (distance > 0) {
          const speed = (enemy.speed || 2.0) * 2.0
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        this.handleContactDamage(enemy, this.currentLevel)
          break
        
      case 'archer':
        // 弓箭手：远程攻击，保持距离
        const archerRange = 300
        if (distance > archerRange) {
          enemy.x += (dx / distance) * (enemy.speed || 0.8)
          enemy.y += (dy / distance) * (enemy.speed || 0.8)
        } else {
          const keepDistance = 250
          if (distance < keepDistance) {
            enemy.x -= (dx / distance) * 0.3
            enemy.y -= (dy / distance) * 0.3
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
        if (distance > 0) {
          const speed = (enemy.speed || 0.4) * 0.4
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        
        // 护盾重生逻辑
        const shieldEnemy = enemy as any
        if (shieldEnemy.shield <= 0 && !shieldEnemy.shieldBroken) {
          shieldEnemy.shieldBroken = true
          shieldEnemy.shieldRegenTimer = now + 5000 // 5秒后重生护盾
        } else if (shieldEnemy.shieldBroken && now >= shieldEnemy.shieldRegenTimer) {
          shieldEnemy.shield = shieldEnemy.maxShield
          shieldEnemy.shieldBroken = false
          // 添加护盾重生特效
          this.addHitEffect(enemy.x, enemy.y, false)
        }
        
        // 接触伤害带击退（护盾存在时击退更强）
        const shieldContactDist = 15 + (enemy.size || 20)
        if (distance < shieldContactDist) {
          const knockback = shieldEnemy.shield > 0 ? 8 : 5
          const knockbackDx = (this.playerX - enemy.x) / distance * knockback
          const knockbackDy = (this.playerY - enemy.y) / distance * knockback
          this.playerX += knockbackDx
          this.playerY += knockbackDy
        }
        this.handleContactDamage(enemy, this.currentLevel)
        break
        
      case 'bomb_bat':
        // 自爆蝠：快速移动，接近时主动自爆
        if (distance > 0) {
          const speed = (enemy.speed || 1.2) * 1.2
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
          
          // 当距离足够近时主动自爆
          if (distance < 50) {
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
        
        const healRange = 150
        if (now - healerEnemy.lastSkill >= healerEnemy.skillCooldown) {
          this.enemies.forEach(other => {
            if (other !== enemy && other.health < other.maxHealth) {
              const dxx = other.x - enemy.x
              const dyy = other.y - enemy.y
              const distSq = dxx * dxx + dyy * dyy
              const healRangeSq = healRange * healRange
              if (distSq < healRangeSq) {
                other.health = Math.min(other.maxHealth, other.health + 5 + this.currentLevel)
                // 添加治疗效果
                this.addHitEffect(other.x, other.y, false, '#00ff88')
              }
            }
          })
          healerEnemy.lastSkill = now
        }
        
        if (distance > 0) {
          const speed = (enemy.speed || 0.6) * 0.6
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        // 治疗师没有接触伤害，专心治疗
        break
        
      case 'grenadier':
        // 投弹手：抛射抛物线攻击
        if (distance > 0) {
          const speed = (enemy.speed || 0.5) * 0.5
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        if (now - enemy.lastAttack >= enemy.attackCooldown && distance < 400) {
          this.grenadierAttack(enemy, distance)
          enemy.lastAttack = now
        }
        break
        
      case 'summoner':
        // 召唤师：定期召唤小怪
        if (distance > 0) {
          const speed = (enemy.speed || 0.5) * 0.5
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
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
        const invisibleCycle = 5000 // 5秒一个周期
        const invisibleDuration = 3000 // 隐身3秒
        const cycleTime = now % invisibleCycle
        phantomEnemy.isInvisible = cycleTime < invisibleDuration
        
        // 隐身时移动更快，非隐身时正常
        if (distance > 0) {
          const speedMultiplier = phantomEnemy.isInvisible ? 1.5 : 1.0
          const speed = (enemy.speed || 1.8) * speedMultiplier
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        
        // 背刺检测：从玩家背后攻击时造成更高伤害
        // 判断是否在玩家背后：敌人的方向与玩家朝向相反
        const playerDirection = Math.atan2(this.playerY - this.playerLastY, this.playerX - this.playerLastX)
        const enemyToPlayer = Math.atan2(dy, dx)
        let angleDiff = Math.abs(enemyToPlayer - playerDirection)
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff
        const isBackstab = angleDiff > Math.PI * 0.7 // 从背后约70%的角度
        
        if (isBackstab && phantomEnemy.isInvisible && distance < 30) {
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
        if (distance > 0) {
          const speed = (enemy.speed || 1.5) * (enemy.speed || 1.5)
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
          
          // 当距离足够近时主动自爆
          if (distance < 40) {
            const explosionRadius = 80
            const explosionDamage = 25 + this.currentLevel * 3
            this.handleExplosion(enemy, explosionRadius, explosionDamage)
            
            // 添加爆炸特效
            this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
            this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
            
            // 移除敌人
            const enemyIndex = this.enemies.indexOf(enemy)
            if (enemyIndex !== -1) {
              this.enemies.splice(enemyIndex, 1)
              this.score += 20 // 主动自爆给予额外分数
            }
            return // 不执行接触伤害，因为已经自爆了
          }
        }
        // 检查接触伤害
        this.handleContactDamage(enemy, this.currentLevel)
          break

      case 'heavy':
        // 重装者：缓慢移动，攻击带击退
        if (distance > 0) {
          const speed = (enemy.speed || 0.5) * 0.5
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        // 接触伤害带击退
        const heavyContactDist = 15 + (enemy.size || 20)
        if (distance < heavyContactDist) {
          // 击退玩家
          const knockback = 3
          const knockbackDx = (this.playerX - enemy.x) / distance * knockback
          const knockbackDy = (this.playerY - enemy.y) / distance * knockback
          this.playerX += knockbackDx
          this.playerY += knockbackDy
          this.handleContactDamage(enemy, this.currentLevel)
        }
          break

      case 'sniper':
        // 狙击手：远程攻击，有预警线
        const sniperRange = 350 // 增加攻击范围
        
        // 确保攻击冷却属性存在
        if (!enemy.lastAttack) enemy.lastAttack = now - 5000 // 让狙击兵立即可以攻击
        if (!enemy.attackCooldown) enemy.attackCooldown = this.getAttackCooldown('sniper')
        
        if (distance > sniperRange) {
          // 在攻击范围外，朝玩家移动
          enemy.x += (dx / distance) * (enemy.speed || 0.6)
          enemy.y += (dy / distance) * (enemy.speed || 0.6)
        } else {
          // 在攻击范围内，保持距离并攻击
          const keepDistance = 250
          if (distance < keepDistance) {
            enemy.x -= (dx / distance) * 0.3
            enemy.y -= (dy / distance) * 0.3
          }
          
          // 远程攻击
          if (now - enemy.lastAttack >= enemy.attackCooldown) {
            console.log(`🎯 狙击兵开火！距离: ${distance.toFixed(1)}`)
            this.enemyRangedAttack(enemy)
            enemy.lastAttack = now
          }
        }
        break

        case 'support':
        // 支援者：为附近友军加buff
        const supportRange = 200
        this.enemies.forEach(other => {
          if (other !== enemy) {
            const dxx = other.x - enemy.x
            const dyy = other.y - enemy.y
            const friendDistSq = dxx * dxx + dyy * dyy
            const supportRangeSq = supportRange * supportRange
            if (friendDistSq < supportRangeSq) {
              // 给友军加速
              other.speed = (other.speed || 1.0) * 1.2
            }
          }
        })
        // 接触伤害
        this.handleContactDamage(enemy, this.currentLevel)
          break

      case 'fortress':
        // 堡垒：护盾减伤，召唤墙壁
        if (distance > 0) {
          const speed = (enemy.speed || 0.8) * 0.8
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
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
        if (distance > 0) {
          const speed = (enemy.speed || 0.8) * 0.8
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
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
        const healthPercent = enemy.health / enemy.maxHealth
        if (healthPercent < 0.3 && bossEnemy.phase < 3) {
          bossEnemy.phase = 3 // 狂暴阶段
          bossEnemy.speed *= 1.5
        } else if (healthPercent < 0.6 && bossEnemy.phase < 2) {
          bossEnemy.phase = 2 // 激活阶段
          bossEnemy.speed *= 1.2
        }
        
        // Boss移动逻辑
        if (distance > 0) {
          const speed = (enemy.speed || 0.6) * (1 + (bossEnemy.phase - 1) * 0.3)
          enemy.x += (dx / distance) * speed
          enemy.y += (dy / distance) * speed
        }
        
        // Boss远程攻击（多发投射物）
        if (now - enemy.lastAttack >= enemy.attackCooldown) {
          // 发射多发投射物
          for (let i = 0; i < bossEnemy.phase; i++) {
            setTimeout(() => {
              if (enemy && this.enemies.includes(enemy)) {
                // **修复**：使用当前最新的玩家位置
                const currentDx = this.playerX - enemy.x
                const currentDy = this.playerY - enemy.y
                const baseAngle = Math.atan2(currentDy, currentDx)
                const angle = baseAngle + (i - bossEnemy.phase/2 + 0.5) * 0.3
                const bulletSpeed = 10 // 每帧速度，与普通敌人投射物一致
                const vx = Math.cos(angle) * bulletSpeed
                const vy = Math.sin(angle) * bulletSpeed
                
                this.projectiles.push({
                  x: enemy.x,
                  y: enemy.y,
                  vx,
                  vy,
                  // **修复**：Boss远程伤害大幅降低（降低到原值的30%）
                damage: (this.currentLevel <= 3 ? 15 + this.currentLevel * 2 :
                        this.currentLevel <= 10 ? 21 + (this.currentLevel - 3) * 2.5 :
                        35 + (this.currentLevel - 10) * 3) * 0.3,
                  isCrit: Math.random() < 0.2,
                  life: 300,
                  pierce: 0,
                  maxPierce: 2,
                  owner: 'enemy',
                  isGrenade: false // Boss的投射物不是炸弹
                })
              }
            }, i * 100) // 间隔发射
          }
          enemy.lastAttack = now
        }
        
        // Boss特殊技能
        if (now - enemy.lastSkill >= enemy.skillCooldown) {
          if (bossEnemy.phase >= 2) {
            // 召唤小怪
            this.summonMinions(enemy)
          }
          if (bossEnemy.phase >= 3) {
            // 狂暴阶段：范围攻击
            const explosionRadius = 120
            // **修复**：Boss爆炸伤害减半
            const explosionDamage = (this.currentLevel <= 3 ? 15 + this.currentLevel * 3 :
                                    this.currentLevel <= 10 ? 24 + (this.currentLevel - 3) * 3.5 :
                                    45 + (this.currentLevel - 10) * 4) * 0.5
            this.handleExplosion(enemy, explosionRadius, explosionDamage)
            this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
          }
          enemy.lastSkill = now
        }
        
        // Boss接触伤害更高
        this.handleContactDamage(enemy, this.currentLevel)
          break

      default:
        // 默认行为：朝玩家移动
        if (distance > 0) {
          enemy.x += (dx / distance) * 1
          enemy.y += (dy / distance) * 1
        }
        this.handleContactDamage(enemy, this.currentLevel)
        break
    }
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

          // **修复**：大幅降低远程伤害，特别是前几层
          let baseDamage: number
          if (this.currentLevel <= 3) {
            // 前3层：极低伤害（再次大幅降低）
            baseDamage = (4 + this.currentLevel * 0.5) * 0.25 // 1.125, 1.25, 1.375（原值的1/4）
          } else if (this.currentLevel <= 10) {
            // 第4-10层：缓慢增长（降低到原值的30%）
            baseDamage = (6 + (this.currentLevel - 3) * 0.8) * 0.3
          } else if (this.currentLevel <= 15) {
            // 第11-15层：中等增长（降低到原值的40%）
            baseDamage = (11.6 + (this.currentLevel - 10) * 1.2) * 0.4
          } else {
            // 第16层之后：正常增长（降低到原值的50%）
            baseDamage = (17.6 + (this.currentLevel - 15) * 1.5) * 0.5
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
      const healRangeSq = 150 * 150
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
  private summonMinions(enemy: any) {
    // 召唤快速虫，使用createEnemyByType确保完整初始化
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2
      const offset = 60 + Math.random() * 40
      const spawnX = enemy.x + Math.cos(angle) * offset
      const spawnY = enemy.y + Math.sin(angle) * offset
      
      // 使用正确的创建方法，确保所有属性都被初始化
      const baseHealth = (20 * (1.0 + (this.currentLevel - 1) * 0.1)) * 0.1
      const baseSize = 18 + this.currentLevel * 0.5
      const bug = this.createEnemyByType('bug', this.currentLevel, spawnX, spawnY, baseHealth, baseSize * 0.7)
      this.enemies.push(bug)
    }
  }

  // 自爆伤害（修复全图伤害bug）
  private handleExplosion(enemy: any, explosionRadius: number, explosionDamage: number) {
    // **性能优化**：使用平方距离避免Math.sqrt
    const dx = enemy.x - this.playerX
    const dy = enemy.y - this.playerY
    const distToPlayerSq = dx * dx + dy * dy
    const explosionRadiusSq = explosionRadius * explosionRadius
    
    // **调试日志**：检查爆炸位置和玩家位置
    const distance = Math.sqrt(distToPlayerSq)
    console.log(`💣 爆炸检测: 爆炸位置=(${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}), 玩家位置=(${this.playerX.toFixed(1)}, ${this.playerY.toFixed(1)}), 距离=${distance.toFixed(1)}, 爆炸半径=${explosionRadius}`)
    
    // 只对范围内的玩家造成伤害
    if (distToPlayerSq < explosionRadiusSq) {
      const distToPlayer = Math.sqrt(distToPlayerSq) // 需要真实距离计算衰减
      const now = Date.now()
      
      console.log(`🔥 爆炸范围检测触发! 距离=${distToPlayer.toFixed(1)}, 基础伤害=${explosionDamage}, 接触无敌帧=${this.playerIFrameUntil}, 爆炸无敌帧=${this.playerExplosionIFrameUntil}, 当前时间=${now}`)
      
      // **修复**：爆炸伤害使用独立的无敌帧系统，不受接触伤害影响
      // 只检查爆炸伤害专用无敌帧（更短，比如100ms）
      const explosionIFrameDuration = 100 // 爆炸伤害无敌帧：100ms（很短，主要用于防止同一爆炸连续命中）
      
      if (now < this.playerExplosionIFrameUntil) {
        console.log(`⚠️ 爆炸伤害被无敌帧阻止，剩余无敌时间: ${this.playerExplosionIFrameUntil - now}ms`)
        return
      }

      // 伤害随距离衰减
      const distanceRatio = distToPlayer / explosionRadius
      const actualDamage = Math.floor(explosionDamage * (1 - distanceRatio * 0.5))
      
      console.log(`💥 计算爆炸伤害: 距离比例=${distanceRatio.toFixed(2)}, 实际伤害=${actualDamage}`)
      
      // **修复**：爆炸伤害不检查堆叠上限，因为堆叠上限是为接触伤害设计的
      // 直接造成伤害
      const oldHealth = this.playerHealth
      const damageToApply = actualDamage
      this.playerHealth -= damageToApply
      console.log(`✅ 爆炸伤害应用成功！伤害: ${damageToApply}, 血量: ${oldHealth} -> ${this.playerHealth}`)
      
      if (this.playerHealth <= 0) {
        this.playerHealth = 0
        this.triggerGameOver()
        return
      }

      // 应用爆炸伤害专用无敌帧（很短暂）
      this.playerExplosionIFrameUntil = now + explosionIFrameDuration
      // 注意：爆炸伤害不添加到playerDamageHistory，因为堆叠上限只针对接触伤害
      this.addHitEffect(this.playerX, this.playerY, false)
      
      // 播放玩家受击音效（爆炸伤害）
      this.audioSystem.playSoundEffect('player_hit', { 
        volume: Math.max(0.5, 1.0 - distanceRatio * 0.5) // 距离越远音量越小
      })
    } else {
      console.log(`⚠️ 爆炸范围外，距离=${distance.toFixed(1)}, 爆炸半径=${explosionRadius}`)
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
    // **调试日志**：检查投射物数量
    const enemyProjectiles = this.projectiles.filter(p => p.owner === 'enemy')
    if (enemyProjectiles.length > 0 && Math.random() < 0.1) { // 10%概率输出
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
          const explosionRadius = 80
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
        for (let enemyIndex = 0; enemyIndex < this.enemies.length; enemyIndex++) {
          const enemy = this.enemies[enemyIndex]
          
          // 检查是否已经击中过这个敌人
          if (!projectile.hitEnemies) {
            projectile.hitEnemies = new Set()
          }
          if (projectile.hitEnemies.has(enemy)) {
            continue // 跳过已经击中过的敌人
          }
          
          // **性能优化**：使用平方距离避免Math.sqrt
          const dx = projectile.x - enemy.x
          const dy = projectile.y - enemy.y
          const distanceSq = dx * dx + dy * dy
          const collisionRadiusSq = (15 + enemy.size) * (15 + enemy.size)
          if (distanceSq < collisionRadiusSq) {
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
              // 播放敌人死亡音效
              this.audioSystem.playSoundEffect('enemy_death')
              // 检查是否精英怪
              const isElite = enemy.isElite
              if (isElite) {
                // 触发额外属性选择
                if (this.gameState && !this.gameState.showPassiveSelection) {
                  this.gameState.extraAttributeSelect = true
                }
              }
              
              // 自爆型敌人死后自爆
              if (enemy.type === 'charger' || enemy.type === 'bomb_bat') {
                const explosionRadius = enemy.type === 'charger' ? 80 : 100
                const explosionDamage = enemy.type === 'charger' ? 15 + this.currentLevel : 20 + this.currentLevel
                this.handleExplosion(enemy, explosionRadius, explosionDamage)
                
                // 添加高级爆炸特效
                this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
                this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
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
    const player = this.gameState?.player || { attackSpeed: 1.43, range: 400 }
    const now = Date.now()
    
    // **修复**：根据玩家的攻击速度计算攻击间隔
    // attackSpeed 表示每秒攻击次数，所以攻击间隔 = 1000 / attackSpeed（毫秒）
    // 例如：attackSpeed = 1.43 时，间隔 = 1000/1.43 ≈ 700ms
    //      attackSpeed = 2.0 时，间隔 = 1000/2.0 = 500ms
    //      attackSpeed = 2.86 时，间隔 = 1000/2.86 ≈ 350ms（+20%攻速后）
    const attackSpeed = player.attackSpeed || 1.43
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
    this.enemies.forEach(enemy => {
      const enemyOptions = {
        type: enemy.type || 'grunt',
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        shield: (enemy as any).shield,
        maxShield: (enemy as any).maxShield,
        isElite: (enemy as any).isElite || false,
        animationState: this.getEnemyAnimationState(enemy),
        size: enemy.size,
        color: enemy.color,
        glowColor: this.getEnemyGlowColor(enemy),
        statusEffects: []
      }
      this.enemyVisualSystem.drawEnemy(this.ctx, enemy.x, enemy.y, enemyOptions, `enemy_${enemy.x}_${enemy.y}_${Date.now()}`)
    })

    // 绘制非激光投射物的拖尾
    this.projectileVisualSystem.drawTrails(this.ctx)

    // 绘制投射物（使用新的视觉系统）
    this.projectiles.forEach(projectile => {
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
        size: projectileType === 'laser' ? 4 : 4,  // 激光束尺寸
        color: projectileColor,
        isCrit: projectile.isCrit,
        damage: projectile.damage,
        velocity: { x: projectile.vx, y: projectile.vy },
        life: projectile.life,
        maxLife: 1000
      }
      
      this.projectileVisualSystem.drawProjectile(
        this.ctx, 
        projectile.x, 
        projectile.y, 
        projectileOptions,
        projectileType === 'laser' ? undefined : `projectile_${projectile.x}_${projectile.y}`  // 激光不产生拖尾ID
      )
    })

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

    // 绘制预警线（弓箭手和狙击手）
    this.enemies.forEach(enemy => {
      if (enemy.warningLine && (enemy.type === 'archer' || enemy.type === 'sniper')) {
        this.drawWarningLine(enemy)
      }
    })

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

    // 精英标记
    const isEliteEnemy = (enemy as any).isElite
    if (isEliteEnemy) {
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

    // 生命值文字
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '16px Arial'
    this.ctx.fillText(`生命: ${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`, barX, barY - 5)

    // 生命值条背景
    this.ctx.fillStyle = '#333333'
    this.ctx.fillRect(barX, barY, barWidth, barHeight)

    // 生命值条
    if (healthPercent > 0) {
      this.ctx.fillStyle = healthPercent > 0.3 ? '#00ff88' : '#ff4444'
      this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight)
    }
  }

  private getScore(): number {
    return this.score
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
    this.projectiles = []
    this.effects = []
    
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
    const currentTime = Date.now()
    // 扣除暂停时间
    const actualElapsedSeconds = (currentTime - this.gameStartTime - this.pausedTime) / 1000
    this.gameTime = Math.max(0, 30 - actualElapsedSeconds)
    
    // 时间到0时进入下一层，但只触发一次
    if (this.gameTime <= 0 && !this.hasTriggeredLevelComplete) {
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
    const baseMoveSpeed = 2.0 // 降低移动速度以增加策略性
    const moveSpeed = this.gameState?.player?.moveSpeed ? baseMoveSpeed * this.gameState.player.moveSpeed : baseMoveSpeed
    
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
    this.currentLevel++
    // 血量回满
    this.playerHealth = this.playerMaxHealth
    // 角色回到初始位置
    this.playerX = this.canvas.width / 2
    this.playerY = this.canvas.height / 2
    // 清空所有敌人、投射物和特效（每一层开始时都没有敌人）
    this.enemies = []
    this.projectiles = []
    this.effects = []
    // 重置层级开始时间和生成计时器
    this.levelStartTime = Date.now()
    this.enemySpawnTimer = 0
    // 重置快速虫波次控制
    this.bugWaveCount = 0
    this.bugWaveCooldown = 0
    
    // 播放升级/进入下一层音效
    this.audioSystem.playSoundEffect('level_up')
    // 通知Vue组件系统处理被动属性选择
    if (this.onLevelComplete) {
      this.onLevelComplete()
    }
    // 重置时间但保持游戏状态
    this.gameTime = 30
    this.gameStartTime = Date.now()
    this.pausedTime = 0
    this.lastPauseTime = 0
    this.hasTriggeredLevelComplete = false // 重置关卡完成标志
    console.log('进入第', this.currentLevel, '层，血量回满，位置重置，敌人清空')
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
    this.gameTime = 30
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
}
