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
  
  // 平滑移动相关（降低轻微卡顿感）
  private playerVelX: number = 0
  private playerVelY: number = 0
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
    warningLine?: { startX: number; startY: number; endX: number; endY: number; time: number; targetX?: number; targetY?: number; fireTime?: number }
    isElite?: boolean
    shield?: number
    maxShield?: number
    skillCooldown?: number
    lastSkill?: number
  }> = []
  private projectiles: Array<{ id: string; x: number; y: number; vx: number; vy: number; damage: number; isCrit: boolean; life: number; pierce: number; maxPierce: number; isGrenade?: boolean; owner: 'player' | 'enemy'; hitEnemies?: Set<any> }> = []
  private readonly MAX_PROJECTILES = 120 // **关键修复**：降低投射物上限，防止卡死（从150降到120）
  private readonly MAX_ENEMIES = 70 // **关键修复**：降低敌人上限，防止卡死（从80降到70）
  private projectileIdCounter = 0 // **修复**：投射物ID计数器，用于生成唯一ID
  private multiShotPhase = 0 // 控制偶数投射物时的左右偏移交替，让其中一发始终对准中心
  private effects: Array<{ x: number; y: number; type: string; life: number; size: number }> = []
  private droppedItems: Array<{ id: string; x: number; y: number; vx: number; vy: number; type: 'heal_orb' | 'experience' | 'energy' | 'item'; value: number; size: number; life: number; maxLife: number; magnetRange?: number; attractedToPlayer?: boolean }> = [] // 掉落物数组
  private readonly MAX_DROPPED_ITEMS = 100 // 限制最大掉落物数量
  private healTrailAreas: Array<{ x: number; y: number; radius: number; healPerSecond: number; life: number; maxLife: number; createdAt: number }> = [] // 治疗轨迹区域
  private lastHealTrailPosition: { x: number; y: number } | null = null // 上次创建治疗区域的位置
  private healTrailCooldown = 0 // 治疗轨迹创建冷却（毫秒）
  private enemySpawnTimer = 0
  private attackTimer = 0 // 毫秒计时器
  private lastAttackTime = Date.now()
  private levelStartTime = 0 // 当前层开始时间
  private enemyUpdateIndex = 0 // 敌人更新索引，用于分批更新（已废弃，改用normalEnemyUpdateIndex）
  private normalEnemyUpdateIndex = 0 // 普通敌人更新索引，用于分批更新（排除Boss）
  private bossUpdateFrameCounter = 0 // Boss更新帧计数器，用于限制Boss更新频率
  private attackCooldown = 100 // 攻击间隔（毫秒）- 进一步提高攻击速度
  private cleanupCounter = 0 // 清理计数器，用于定期强制清理
  private visualUpdateCounter = 0 // 视觉系统更新计数器，用于降低更新频率
  private lastScoreSaveTime = 0 // 上次保存分数的时间，用于避免频繁保存
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
  private currentAttackRangeSq: number = 300 * 300
  private isPaused = false
  private gameTime = 30 // 游戏时间（秒）
  
  // 根据层数获取该层的坚持时间（秒）
  // 前10层：30秒，第11层及以后：60秒
  private getLevelTime(level: number): number {
    // 第5层是Boss层，需要更多时间
    if (level === 5) {
      return 45 // Boss层45秒
    }
    if (level <= 10) {
      return 30 // 前10层（除第5层）保持30秒
    }
    return 60 // 第11层及以后固定60秒
  }
  private gameStartTime = 0 // 游戏开始时间
  private pausedTime = 0 // 暂停时累计的时间
  private lastPauseTime = 0 // 最后一次暂停的时间戳
  private keys: { [key: string]: boolean } = {} // 键盘状态跟踪
  public currentLevel = 1 // 当前层数（公开用于测试功能）
  private bossSpawnedInLevel = false // 本层是否已生成Boss
  private bossCountInLevel = 0 // 本层已生成的Boss数量
  private targetBossCount = 1 // 本层目标Boss数量
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
    SHIELDGUARD_SHIELD_REGEN_TIME: 5000, // 护盾兵护盾重生时间（毫秒）
  }

  // 接触伤害倍数
  private readonly ENEMY_DMG_MULTIPLIER: Record<string, number> = {
    'grunt': 1.0,     // 默认
    'infantry': 1.0,  // 步兵
    'bug': 0.5,       // 快速虫有一定伤害（降低速度但保持威胁）
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
                   enemyType === 'void_shaman' || enemyType === 'legion_commander' ||
                   enemyType === 'frost_lord' || enemyType === 'storm_king' || enemyType === 'necromancer'
    if (isBoss) {
      damage = damage * 1.5 // Boss接触伤害1.5倍（从3倍降低）
    }
    
    // **新增**：应用"受到伤害增加"的Debuff
    const player = this.gameState?.player as any
    if (player?.damageTakenMultiplier) {
      damage = damage * player.damageTakenMultiplier
    }
    
    // 检查堆叠上限
    if (this.exceedsStackCap(damage)) {
      return
    }
    
    // **新增**：检查是否有临时护盾效果，优先消耗护盾
    const specialEffects = (this.gameState?.player as any)?.specialEffects || []
    const hasTempShield = specialEffects.includes('on_hit_temp_shield')
    let actualDamage = damage
    
    if (hasTempShield && this.gameState?.player) {
      const player = this.gameState.player as any
      const currentShield = player.shield || 0
      
      if (currentShield > 0) {
        // 优先消耗护盾
        const shieldDamage = Math.min(currentShield, actualDamage)
        player.shield = Math.max(0, currentShield - shieldDamage)
        actualDamage -= shieldDamage
        
        // 护盾被攻击的特效（青色）
        this.addHitEffect(this.playerX, this.playerY, false, '#00ffff')
        
        // 如果护盾被完全破坏
        if (player.shield <= 0) {
          // 护盾破坏特效
          this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
            count: 30,
            colors: ['#00ffff', '#88ffff', '#ffffff'],
            size: { min: 4, max: 10 },
            speed: { min: 2, max: 6 },
            life: { min: 400, max: 800 },
            spread: 360,
            fadeOut: true
          })
        }
      }
      
      // 受伤时获得临时护盾（如果护盾已耗尽或不存在）
      if (player.shield <= 0) {
        const tempShieldAmount = 10 + this.currentLevel * 2 // 基础10点，每层+2点
        const maxTempShield = 50 + this.currentLevel * 5 // 最大护盾值
        
        if (!player.maxShield) {
          player.maxShield = maxTempShield
        }
        
        player.shield = Math.min(tempShieldAmount, maxTempShield)
        
        // **新增**：临时护盾获得特效（青色光环）
        this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
          count: 40,
          colors: ['#00ffff', '#88ffff', '#ffffff', '#aaffff'],
          size: { min: 6, max: 12 },
          speed: { min: 1, max: 3 },
          life: { min: 600, max: 1200 },
          spread: 360,
          fadeOut: true
        })
        
        // 添加屏幕消息提示
        this.addScreenMessage('临时护盾', `+${Math.ceil(player.shield)}`, '#00ffff', 2000)
      }
    }
    
    // 结算伤害（扣除护盾后的剩余伤害）
    this.playerHealth -= actualDamage
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
    
    // 添加受击特效（如果没有护盾特效）
    if (!hasTempShield || actualDamage > 0) {
      this.addHitEffect(this.playerX, this.playerY, false)
    }
    
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
      if (e.key) {
        this.keys[e.key.toLowerCase()] = true
        this.handleKeyDown(e.key)
      }
    })
    
    window.addEventListener('keyup', (e) => {
      if (e.key) {
        this.keys[e.key.toLowerCase()] = false
      }
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
    
    // **精细化渲染**：启用高质量图像平滑
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
    
    console.log('Canvas设置完成（精细化渲染）:', {
      width: this.canvas.width,
      height: this.canvas.height,
      ctx: this.ctx,
      imageSmoothingEnabled: this.ctx.imageSmoothingEnabled
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
    // **关键修复**：清理投射物视觉系统的所有拖尾效果，防止残留子弹显示
    this.projectileVisualSystem.clearAll()
    this.enemySpawnTimer = 0 // 重置敌人生成计时器
    // 重置快速虫波次控制
    this.bugWaveCount = 0
    this.bugWaveCooldown = 0
    // 重置更新索引
    this.normalEnemyUpdateIndex = 0
    this.bossUpdateFrameCounter = 0
    this.cleanupCounter = 0
    
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
    
    // **关键修复**：停止时清理所有投射物和视觉效果，防止残留
    this.projectiles = []
    this.projectileVisualSystem.clearAll()
    
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
    // 以60FPS为基准的运动缩放，用于让移动随帧时间平滑
    ;(this as any)._motionScale = Math.max(0.5, Math.min(2.0, deltaTime / 16.67))
    
    // **关键修复**：降低视觉系统更新频率，不是每帧都更新
    // **性能优化**：最后20秒时适度降低更新频率，但不要过度优化导致卡顿
    if (!this.visualUpdateCounter) this.visualUpdateCounter = 0
    this.visualUpdateCounter++
    const timeRemaining = this.gameTime
    const isNearEnd = timeRemaining < 20
    // **关键修复**：最后20秒时每2帧更新一次（从3帧改为2帧，减少卡顿感）
    const visualUpdateInterval = isNearEnd ? 2 : 2 // 最后20秒时也每2帧更新一次，保持流畅
    
    if (this.visualUpdateCounter % visualUpdateInterval === 0) {
      this.visualRenderer.update(deltaTime * visualUpdateInterval) // 补偿时间
      this.enemyVisualSystem.update(deltaTime * visualUpdateInterval)
      // 注意：投射物视觉系统更新在投射物更新之后，使用最新的活跃投射物ID
    }
    
    // **关键修复**：每帧都更新粒子效果，但限制更严格
    // **性能优化**：最后20秒时更频繁清理粒子
    this.effectsSystem.update(deltaTime)
    
    // **性能优化**：最后20秒时每5帧强制清理一次粒子（从3帧改为5帧，减少卡顿）
    if (isNearEnd) {
      this.cleanupCounter++
      if (this.cleanupCounter >= 5) {
        this.cleanupCounter = 0
        // 强制清理粒子效果
        if (this.effectsSystem && (this.effectsSystem as any).particles) {
          const particles = (this.effectsSystem as any).particles
          if (particles && particles.length > 200) {
            // 如果粒子超过200个，清理到150个（从150/100提高到200/150，减少卡顿）
            (this.effectsSystem as any).particles = particles.slice(-150)
          }
        }
      }
    }
    
    // 更新屏幕消息
    this.updateScreenMessages(deltaTime)
    
    // **关键修复**：每30帧（约0.5秒）强制清理一次，更频繁地清理防止累积
    this.cleanupCounter++
    if (this.cleanupCounter >= 30) {
      this.cleanupCounter = 0
      this.forceCleanup()
    }
    
    // 更新时间（可能会触发关卡切换）
    // 注意：在 updateGameTime() 中如果触发 nextLevel()，会调用回调，
    // 回调中 gameStore.nextLevel() 需要读取旧的 gameState.level 作为 previousLevel
    // 所以我们需要在 updateGameTime() 之前保存旧的 level，并在回调后再同步
    const oldLevelBeforeUpdate = this.currentLevel
    this.updateGameTime()
    
    // **关键修复**：实时同步分数，确保分数显示正确
    if (this.gameState) {
      this.gameState.score = this.score
      // **关键修复**：实时更新最高分数和层数
      if (!this.gameState.highestScore) this.gameState.highestScore = 0
      if (!this.gameState.highestLevel) this.gameState.highestLevel = 0
      
      // **关键修复**：实时更新最高分数和层数，并自动保存
      let shouldSave = false
      if (this.score > this.gameState.highestScore) {
        this.gameState.highestScore = this.score
        shouldSave = true
      }
      if (this.currentLevel > this.gameState.highestLevel) {
        this.gameState.highestLevel = this.currentLevel
        shouldSave = true
      }
      
      // **关键修复**：延迟保存，避免频繁调用（每5秒保存一次）
      if (shouldSave) {
        if (!this.lastScoreSaveTime) this.lastScoreSaveTime = 0
        const now = Date.now()
        if (now - this.lastScoreSaveTime > 5000) {
          this.lastScoreSaveTime = now
          this.saveHighestRecords()
        }
      }
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
    this.updatePlayerMovement(deltaTime)
    
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
    
    // **性能监控**：完全禁用，避免任何性能开销
    // （已移除性能监控代码以提升性能）
    
    // 处理生命回复
    this.updateHealthRegen()
    
    // 更新敌人（性能优化：分批更新，减少单帧负载）
    // 先清空待添加队列（上一帧添加的敌人）
    if (this.pendingEnemies.length > 0) {
      this.enemies.push(...this.pendingEnemies)
      this.pendingEnemies = []
    }
    
    // 更新敌人（确保在添加新敌人后才更新）
    // **关键修复**：将Boss从批处理中排除，单独处理Boss更新
    // 性能优化：根据敌人数量动态调整每帧更新数量，敌人多时减少更新数量
    // 进一步优化：敌人超过100时，每帧只更新更少的敌人
    
    // 先分离Boss和普通敌人
    const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander']
    const bosses: Array<{ enemy: any; index: number }> = []
    const normalEnemies: Array<{ enemy: any; index: number }> = []
    
    this.enemies.forEach((enemy, index) => {
      if (enemy && enemy.type && bossTypes.includes(enemy.type)) {
        bosses.push({ enemy, index })
      } else if (enemy) {
        normalEnemies.push({ enemy, index })
      }
    })
    
    // **关键修复**：单独处理Boss，每帧都更新Boss以确保流畅移动（修复卡顿问题）
    if (bosses.length > 0) {
      // **关键修复**：每帧都更新所有Boss，确保移动流畅不卡顿
      for (const bossData of bosses) {
        if (bossData && bossData.enemy) {
          try {
            this.updateEnemyAI(bossData.enemy, bossData.index)
          } catch (error) {
            console.error(`[updateEnemyAI] Boss更新错误:`, error, `Boss类型: ${bossData.enemy.type}`)
          }
        }
      }
    }
    
    // 批处理更新普通敌人（排除Boss）
    if (normalEnemies.length > 0) {
      // **关键修复**：平衡性能和流畅度，根据敌人数量和时间动态调整更新频率
      const enemyCount = normalEnemies.length
      const timeRemaining = this.gameTime
      const isNearEnd = timeRemaining < 20
      let enemyUpdateBatch: number
      if (isNearEnd) {
        // 最后20秒时，适度减少敌人更新数量（不要过度优化导致卡顿）
        if (enemyCount <= 30) {
          enemyUpdateBatch = Math.min(enemyCount, 25) // 最后20秒时减少到25个（从15个提高）
        } else if (enemyCount <= 50) {
          enemyUpdateBatch = Math.min(enemyCount, 20) // 最后20秒时减少到20个（从12个提高）
        } else if (enemyCount <= 70) {
          enemyUpdateBatch = Math.min(enemyCount, 18) // 最后20秒时减少到18个（从10个提高）
        } else {
          enemyUpdateBatch = Math.min(enemyCount, 15) // 最后20秒时减少到15个（从8个提高）
        }
      } else {
        // 正常时保持原有逻辑
        if (enemyCount <= 30) {
          enemyUpdateBatch = Math.min(enemyCount, 30) // 敌人少时每帧更新30个（全部更新）
        } else if (enemyCount <= 50) {
          enemyUpdateBatch = Math.min(enemyCount, 25) // 中等数量时更新25个
        } else if (enemyCount <= 70) {
          enemyUpdateBatch = Math.min(enemyCount, 20) // 敌人较多时更新20个
        } else {
          enemyUpdateBatch = Math.min(enemyCount, 18) // 敌人很多时更新18个
        }
      }
      
      // **性能优化**：添加安全检查，防止无限循环
      let updateCount = 0
      const maxUpdateAttempts = enemyUpdateBatch * 2 // 防止无限循环
      
      // 使用normalEnemies的索引
      if (!this.normalEnemyUpdateIndex) this.normalEnemyUpdateIndex = 0
      
      for (let i = 0; i < enemyUpdateBatch && normalEnemies.length > 0 && updateCount < maxUpdateAttempts; i++) {
        const currentLength = normalEnemies.length
        if (currentLength === 0) break // 防止长度变为0时出错
        
        const normalIndex = (this.normalEnemyUpdateIndex + i) % currentLength
        if (normalIndex >= 0 && normalIndex < normalEnemies.length && normalEnemies[normalIndex]) {
          const { enemy, index } = normalEnemies[normalIndex]
          try {
            this.updateEnemyAI(enemy, index)
            updateCount++
          } catch (error) {
            console.error(`[updateEnemyAI] 错误:`, error, `敌人索引: ${index}`)
            // 如果某个敌人更新出错，跳过它
            break
          }
        }
      }
      if (normalEnemies.length > 0) {
        this.normalEnemyUpdateIndex = (this.normalEnemyUpdateIndex + enemyUpdateBatch) % normalEnemies.length
      } else {
        this.normalEnemyUpdateIndex = 0
      }
    }

    // **关键修复**：统一清理死亡的敌人，防止内存泄漏和性能问题
    // 使用反向遍历，避免索引问题
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i]
      if (enemy && enemy.health <= 0) {
        // **关键修复**：在清理前检查是否是Boss并设置标志
        const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander', 'boss']
        const isBoss = enemy.type && bossTypes.includes(enemy.type)
        
        // **关键修复**：如果敌人是Boss且标志未设置，检查是否所有Boss都被击败
        if (isBoss && this.gameState) {
          // 检查当前层是否还有存活的Boss（注意：此时enemy还未从数组中移除）
          const remainingBosses = this.enemies.filter(e => 
            e !== enemy && e.type && bossTypes.includes(e.type) && e.health > 0
          )
          
          // 只有当所有Boss都被击败后，才设置标志
          if (remainingBosses.length === 0) {
          if (!this.gameState.bossDefeated || this.gameState.bossDefeated !== this.currentLevel) {
            this.gameState.bossDefeated = this.currentLevel
            this.gameState.hasDefeatedBoss = true
              console.log(`[Boss死亡-清理] ✅ 第${this.currentLevel}层所有Boss都被击败，设置bossDefeated=${this.currentLevel}`)
            }
          } else {
            console.log(`[Boss死亡-清理] 第${this.currentLevel}层Boss(${enemy.type})在清理时被发现，但还有${remainingBosses.length}个Boss存活，暂不设置标志`)
          }
        }
        
        // **关键修复**：确保所有死亡的敌人都添加分数（如果还未添加）
        // 检查是否已经添加过分数（通过检查敌人是否被标记）
        if (!(enemy as any).scoreAdded) {
          const isElite = enemy.isElite
          const scoreGain = isElite ? 50 : 10
          this.score += scoreGain
          // 实时同步分数到gameState
          if (this.gameState) {
            this.gameState.score = this.score
          }
          // 金币与分数一致
          if (this.gameState && this.gameState.player) {
            this.gameState.player.gold = (this.gameState.player.gold || 0) + scoreGain
          }
          // 标记已添加分数，避免重复添加
          (enemy as any).scoreAdded = true
          // 调试日志（降低频率，避免日志过多）
          if (Math.random() < 0.1) { // 10%概率输出日志
            console.log(`[分数] 敌人死亡，添加分数: ${scoreGain}，当前总分: ${this.score}`)
          }
        }
        
        // 清理Boss特殊数据
        if (enemy.type === 'fortress_guard') {
          const hiveMother = enemy as any
          if (hiveMother) {
            if (hiveMother.pendingEggs) hiveMother.pendingEggs = []
            if (hiveMother.stormZones) hiveMother.stormZones = []
          }
        }
        this.enemies.splice(i, 1)
      }
    }
    
    // **关键修复**：处理延迟发射的投射物（在投射物更新前）
    this.processDelayedRangedAttacks()
    
    // **重要修复**：先处理自动攻击（发射新子弹），然后再更新投射物（清理旧投射物）
    // 这样可以确保新发射的子弹不会被同一帧清理
    this.handleAutoAttack()
    
    // 更新投射物（在玩家位置更新后）
    this.updateProjectiles()
    
    // **关键修复**：在投射物更新后，立即更新投射物视觉系统，使用最新的活跃投射物ID集合
    // 这样可以立即清理对应投射物已经不存在的拖尾，避免残留显示
    if (this.visualUpdateCounter % visualUpdateInterval === 0) {
      // 收集更新后的活跃投射物ID
      const activeProjectileIds = new Set<string>()
      for (const projectile of this.projectiles) {
        if (projectile && projectile.id && projectile.life > 0) {
          activeProjectileIds.add(projectile.id)
        }
      }
      // **关键修复**：传入活跃投射物ID集合，立即清理对应投射物已经不存在的拖尾
      this.projectileVisualSystem.update(deltaTime * visualUpdateInterval, activeProjectileIds)
    }

    // 更新掉落物
    this.updateDroppedItems()
    
    // 检查掉落物拾取
    this.checkItemPickup()

    // 更新特效
    this.updateEffects()

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
    // **性能优化**：开局更慢，避免立即生成太多敌人
    const initialSpawnInterval = 200 // 约3.3秒开始（从150增加到200）
    
    // 一层内逐渐加速：从150帧逐渐降到maxSpeedInterval
    // 使用平滑曲线，在30秒内完成加速
    const accelerationTime = 30 // 加速时间（秒）
    const speedProgress = Math.min(1.0, levelElapsedTime / accelerationTime)
    
    // 使用平方曲线让加速更平滑
    const smoothProgress = speedProgress * speedProgress
    
    // 计算当前间隔：从慢到快
    const baseSpawnInterval = initialSpawnInterval - (initialSpawnInterval - maxSpeedInterval) * smoothProgress
    
    // **性能优化**：根据敌人数量和时间微调生成速度
    // 最后20秒时，更激进地减慢生成速度，防止卡顿
    const timeRemainingSpawn = this.gameTime
    const isNearEndSpawn = timeRemainingSpawn < 20
    
    let enemyCountFactor = 1.0
    if (isNearEndSpawn) {
      // **关键性能优化**：最后20秒时，根据敌人数量大幅减慢生成速度
      if (this.enemies.length > this.MAX_ENEMIES * 0.6) {
        // 敌人数量超过60%上限时，大幅减慢生成（增加50%间隔）
        enemyCountFactor = 1.5
      } else if (this.enemies.length > this.MAX_ENEMIES * 0.5) {
        // 敌人数量超过50%上限时，减慢生成（增加30%间隔）
        enemyCountFactor = 1.3
      }
    } else {
      // 正常时，只在敌人数量非常多时稍微减慢
      if (this.enemies.length > this.MAX_ENEMIES * 0.8) {
        // 超过80%上限时开始轻微影响（增加10%间隔）
        enemyCountFactor = 1.1
      }
    }
    
    const spawnInterval = Math.floor(baseSpawnInterval * enemyCountFactor)
    
    // **性能优化**：限制敌人总数，防止性能问题
    // 最后20秒时，更激进地限制敌人数量
    const maxEnemiesForSpawn = isNearEndSpawn 
      ? Math.floor(this.MAX_ENEMIES * 0.85) // 最后20秒时，最多85%上限
      : this.MAX_ENEMIES // 正常时使用完整上限
    
    if (this.enemies.length >= maxEnemiesForSpawn) {
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
    // Boss层判断：每5层一个Boss层（5, 10, 15, 20, 25, 30, 35, 40...）
    const isBossLevel = layer % 5 === 0
    
    if (isBossLevel) {
      // 计算本层目标Boss数量
      if (layer <= 20) {
        // 前20层：每5层1个Boss
        this.targetBossCount = 1
      } else {
        // 20层之后：交替出现2个和3个Boss
        // **修复**：第25层应该是2个，第30层是3个，第35层是2个，第40层是3个，以此类推
        const bossTier = Math.floor((layer - 20) / 5) // 第25层=1, 第30层=2, 第35层=3, 第40层=4...
        if (bossTier % 2 === 1) {
          // 奇数tier（25层, 35层, 45层...）：2个Boss
          this.targetBossCount = 2
        } else {
          // 偶数tier（30层, 40层, 50层...）：3个Boss
          this.targetBossCount = 3
        }
      }
      
      // 如果还没生成完所有Boss，继续生成
      if (this.bossCountInLevel < this.targetBossCount) {
      // 检查敌人数量，如果已经很多，等待清理一些再生成Boss
      if (this.enemies.length >= this.MAX_ENEMIES * 0.9) {
        console.log(`[Boss生成] 关卡${layer}: 敌人数量过多(${this.enemies.length})，延迟生成Boss`)
        return // 延迟生成，等待敌人数量减少
      }
      
      // **修复**：Boss从地图边缘生成，而不是中心
      // 随机选择边缘位置（上、下、左、右）
      const side = Math.floor(Math.random() * 4)
      let bossX = 0
      let bossY = 0
      
      switch (side) {
        case 0: // 上边缘
          bossX = Math.random() * this.canvas.width
          bossY = -30
          break
        case 1: // 右边缘
          bossX = this.canvas.width + 30
          bossY = Math.random() * this.canvas.height
          break
        case 2: // 下边缘
          bossX = Math.random() * this.canvas.width
          bossY = this.canvas.height + 30
          break
        case 3: // 左边缘
          bossX = -30
          bossY = Math.random() * this.canvas.height
          break
      }
      
      const baseHealth = 20 * (layer <= 3 ? 1.0 + (layer - 1) * 0.05 : (layer <= 10 ? 1.1 + (layer - 3) * 0.1 : 1.8 + Math.sqrt((layer - 10) * 2) * 0.2))
        const baseSize = 22 + layer * 0.6
      const boss = this.createBoss(layer, bossX, bossY, baseHealth, baseSize)
      if (boss) {
        // 确保Boss不会导致超出敌人上限
        if (this.enemies.length < this.MAX_ENEMIES) {
          this.enemies.push(boss)
            this.bossCountInLevel++
            this.bossSpawnedInLevel = this.bossCountInLevel >= this.targetBossCount
            console.log(`[Boss生成] 在第${layer}层从边缘生成Boss ${this.bossCountInLevel}/${this.targetBossCount}: ${boss.type}, 位置: (${bossX.toFixed(0)}, ${bossY.toFixed(0)}), 当前敌人数: ${this.enemies.length}`)
          return
        } else {
          console.warn(`[Boss生成] 关卡${layer}: 敌人数量已达上限，无法生成Boss`)
          }
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
      { type: 'archer', weight: 50, layerStart: 5 }, // 弓箭手，第5层出现
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
        size = baseSize * 1.2  // 增大体型
        health = baseHealth * 1.0
        color = '#ff4444'
        break
        
      case 'bug':
        baseSpeed = 2.0
        size = baseSize * 0.9  // 增大体型
        health = Math.max(1, baseHealth * 0.1) // 大幅降低血量，保证一击必杀
        color = '#44ff44'
        break
        
      case 'archer':
        baseSpeed = 0.8
        size = baseSize * 1.1  // 增大体型
        health = baseHealth * 0.8
        color = '#4444ff'
        break
        
        
      case 'shieldguard':
        baseSpeed = 0.4
        size = baseSize * 1.8  // 增大体型
        health = baseHealth * 2.5
        color = '#888888'
        break
        
      case 'bomb_bat':
        baseSpeed = 1.2
        size = baseSize * 1.0  // 增大体型
        health = baseHealth * 0.6
        color = '#884488'
        break
        
      case 'healer':
        baseSpeed = 0.6
        size = baseSize * 1.2  // 增大体型
        health = baseHealth * 1.2
        color = '#00ff88'
        break
        
      case 'grenadier':
        baseSpeed = 0.5
        size = baseSize * 1.3  // 增大体型
        health = baseHealth * 1.8
        color = '#ff8800'
        break
        
      case 'summoner':
        baseSpeed = 0.5
        size = baseSize * 1.4  // 增大体型
        health = baseHealth * 2.0
        color = '#ff00ff'
        break
        
      case 'phantom':
        baseSpeed = 1.8
        size = baseSize * 0.9  // 增大体型
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
    
    const hasRangedAttack = ['archer', 'healer', 'grenadier', 'boss'].includes(enemyType)
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
    
    // 计算难度倍数（20层之后逐渐递增）
    let difficultyMultiplier = 1.0
    if (layer > 20) {
      // 每5层增加20%难度
      const tier = Math.floor((layer - 20) / 5)
      difficultyMultiplier = 1.0 + tier * 0.2
    }
    
    // 特定层数的Boss（保持原有设计）
    if (layer === 5) {
      // 步兵队长（重装指挥官）- 大幅降低强度，确保可以击败
      return {
        x, y,
        size: Math.floor(baseSize * 1.3),
        color: '#ff0000',
        health: Math.floor(baseHealth * 15), // 降低血量：从25倍降到15倍
        maxHealth: Math.floor(baseHealth * 15),
        type: 'infantry_captain',
        isElite: true,
        speed: 3.5,
        lastAttack: now - 3000, // 初始化时允许立即攻击
        attackCooldown: 3000, // 增加攻击冷却：从2000ms增加到3000ms
        lastSkill: now,
        skillCooldown: 18000, // 增加技能冷却：从12000ms增加到18000ms
        icdUntil: 0
      }
    } else if (layer === 10) {
      // 堡垒守卫（虫巢母体）
      return {
        x, y,
        size: Math.floor(baseSize * 1.6),
        color: '#884400',
        health: Math.floor(baseHealth * 40), // 大幅增加血量：40倍
        maxHealth: Math.floor(baseHealth * 40),
        type: 'fortress_guard',
        isElite: true,
        speed: 3.0, // 进一步提高基础速度（从2.0提高到3.0）
        shield: 50,
        maxShield: 50,
        shieldUp: false,
        lastSkill: now,
        skillCooldown: 5000,
        lastBoomHatch: now - 8000, // 允许第一次孵化更快
        icdUntil: 0,
        pendingEggs: [], // 待孵化的虫卵列表
        stormZones: [] // 风暴区域列表
      }
    } else if (layer === 15) {
      // 虚空巫医（暗影刺客）
      return {
        x, y,
        size: Math.floor(baseSize * 1.4),
        color: '#ff00ff',
        health: Math.floor(baseHealth * 50), // 大幅增加血量：50倍
        maxHealth: Math.floor(baseHealth * 50),
        type: 'void_shaman',
        isElite: true,
        speed: 3.2, // 进一步提高基础速度（从2.2提高到3.2）
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
        size: Math.floor(baseSize * 1.8),
        color: '#000000',
        health: Math.floor(baseHealth * 50), // 降低血量：50倍（从80倍降低）
        maxHealth: Math.floor(baseHealth * 50),
        type: 'legion_commander',
        isElite: true,
        speed: 3.5, // 进一步提高基础速度（从2.4提高到3.5）
        lastAttack: now - 3000,
        attackCooldown: 2000,
        lastSkill: now,
        skillCooldown: 9000,
        phase: 1,
        icdUntil: 0
      }
    } else if (layer > 20 && layer % 5 === 0) {
      // 20层之后的Boss：随机选择Boss类型（包括新的boss类型），并应用难度递增
      const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander', 'frost_lord', 'storm_king', 'necromancer']
      const selectedType = bossTypes[Math.floor(Math.random() * bossTypes.length)]
      
      // 根据选择的类型创建Boss，并应用难度倍数
      if (selectedType === 'infantry_captain') {
        return {
          x, y,
          size: Math.floor(baseSize * 1.3 * difficultyMultiplier),
          color: '#ff0000',
          health: Math.floor(baseHealth * 25 * difficultyMultiplier),
          maxHealth: Math.floor(baseHealth * 25 * difficultyMultiplier),
          type: 'infantry_captain',
          isElite: true,
          speed: 3.5 * difficultyMultiplier,
          lastAttack: now - 3000,
          attackCooldown: Math.max(1500, 2000 / difficultyMultiplier), // 攻速提升
          lastSkill: now,
          skillCooldown: Math.max(8000, 12000 / difficultyMultiplier), // 技能冷却缩短
          icdUntil: 0
        }
      } else if (selectedType === 'fortress_guard') {
        return {
          x, y,
          size: Math.floor(baseSize * 1.6 * difficultyMultiplier),
          color: '#884400',
          health: Math.floor(baseHealth * 40 * difficultyMultiplier),
          maxHealth: Math.floor(baseHealth * 40 * difficultyMultiplier),
          type: 'fortress_guard',
          isElite: true,
          speed: 3.0 * difficultyMultiplier,
          shield: Math.floor(50 * difficultyMultiplier),
          maxShield: Math.floor(50 * difficultyMultiplier),
          shieldUp: false,
          lastSkill: now,
          skillCooldown: Math.max(3000, 5000 / difficultyMultiplier),
          lastBoomHatch: now - 8000,
          icdUntil: 0,
          pendingEggs: [],
          stormZones: []
        }
      } else if (selectedType === 'void_shaman') {
        return {
          x, y,
          size: Math.floor(baseSize * 1.4 * difficultyMultiplier),
          color: '#ff00ff',
          health: Math.floor(baseHealth * 50 * difficultyMultiplier),
          maxHealth: Math.floor(baseHealth * 50 * difficultyMultiplier),
          type: 'void_shaman',
          isElite: true,
          speed: 3.2 * difficultyMultiplier,
          lastAttack: now - 5000,
          attackCooldown: Math.max(1500, 2000 / difficultyMultiplier),
          lastSkill: now,
          skillCooldown: Math.max(12000, 18000 / difficultyMultiplier),
          invisibleTimer: now,
          isInvisible: true,
          lastSlowingField: now,
          icdUntil: 0
        }
      } else if (selectedType === 'legion_commander') {
        return {
          x, y,
          size: Math.floor(baseSize * 1.8 * difficultyMultiplier),
          color: '#000000',
          health: Math.floor(baseHealth * 50 * difficultyMultiplier),
          maxHealth: Math.floor(baseHealth * 50 * difficultyMultiplier),
          type: 'legion_commander',
          isElite: true,
          speed: 3.5 * difficultyMultiplier,
          lastAttack: now - 3000,
          attackCooldown: Math.max(1500, 2000 / difficultyMultiplier),
          lastSkill: now,
          skillCooldown: Math.max(6000, 9000 / difficultyMultiplier),
          phase: 1,
          icdUntil: 0
        }
      } else if (selectedType === 'frost_lord') {
        // 冰霜领主：使用冰霜攻击，可以冻结玩家
        return {
          x, y,
          size: Math.floor(baseSize * 1.5 * difficultyMultiplier),
          color: '#88ddff',
          health: Math.floor(baseHealth * 45 * difficultyMultiplier),
          maxHealth: Math.floor(baseHealth * 45 * difficultyMultiplier),
          type: 'frost_lord',
          isElite: true,
          speed: 2.8 * difficultyMultiplier,
          lastAttack: now - 3000,
          attackCooldown: Math.max(1500, 2000 / difficultyMultiplier),
          lastSkill: now,
          skillCooldown: Math.max(8000, 12000 / difficultyMultiplier),
          icdUntil: 0,
          frostZones: [] // 冰霜区域列表
        }
      } else if (selectedType === 'storm_king') {
        // 风暴之王：使用闪电攻击，可以召唤风暴
        return {
          x, y,
          size: Math.floor(baseSize * 1.6 * difficultyMultiplier),
          color: '#ffff00',
          health: Math.floor(baseHealth * 42 * difficultyMultiplier),
          maxHealth: Math.floor(baseHealth * 42 * difficultyMultiplier),
          type: 'storm_king',
          isElite: true,
          speed: 3.2 * difficultyMultiplier,
          lastAttack: now - 3000,
          attackCooldown: Math.max(1200, 1800 / difficultyMultiplier),
          lastSkill: now,
          skillCooldown: Math.max(7000, 10000 / difficultyMultiplier),
          icdUntil: 0,
          lightningChains: [] // 闪电链列表
        }
      } else if (selectedType === 'necromancer') {
        // 死灵法师：召唤骷髅，使用死亡魔法
        return {
          x, y,
          size: Math.floor(baseSize * 1.4 * difficultyMultiplier),
          color: '#660066',
          health: Math.floor(baseHealth * 38 * difficultyMultiplier),
          maxHealth: Math.floor(baseHealth * 38 * difficultyMultiplier),
          type: 'necromancer',
          isElite: true,
          speed: 2.5 * difficultyMultiplier,
          lastAttack: now - 3000,
          attackCooldown: Math.max(1500, 2200 / difficultyMultiplier),
          lastSkill: now,
          skillCooldown: Math.max(6000, 9000 / difficultyMultiplier),
          icdUntil: 0,
          summonedSkeletons: [] // 召唤的骷髅列表
        }
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
    // **新增**：虫卵不需要AI更新（不移动，不攻击）
    if (enemy.type === 'egg' || enemy.isEgg) {
      return
    }
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
            const speed = (enemy.speed || 0.7) * ((this as any)._motionScale || 1)
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
          const speed = ((enemy.speed || 2.0) * 1.2) * ((this as any)._motionScale || 1)  // 进一步降低冲锋速度
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
            const ms = ((this as any)._motionScale || 1)
            enemy.x += (dx / dist) * (enemy.speed || 0.8) * ms
            enemy.y += (dy / dist) * (enemy.speed || 0.8) * ms
          }
        } else {
          const keepDistance = this.ENEMY_SKILL_RANGES.ARCHER_KEEP_DISTANCE
          const keepDistanceSq = keepDistance * keepDistance
          if (distanceSq < keepDistanceSq) {
            const dist = getDistance()
            if (dist > 0) {
              const ms = ((this as any)._motionScale || 1)
              enemy.x -= (dx / dist) * 0.3 * ms
              enemy.y -= (dy / dist) * 0.3 * ms
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
              if (this.gameState && this.gameState.player) {
                this.gameState.player.gold = (this.gameState.player.gold || 0) + 15
              }
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
          let healedCount = 0
          for (let i = 0; i < maxHealChecks; i++) {
            const other = this.enemies[i]
            if (other !== enemy && other.health < other.maxHealth) {
              const dxx = other.x - enemy.x
              const dyy = other.y - enemy.y
              const distSq = dxx * dxx + dyy * dyy
              if (distSq < healRangeSq) {
                other.health = Math.min(other.maxHealth, other.health + 5 + this.currentLevel)
                healedCount++
                // 添加治疗效果
                this.addHitEffect(other.x, other.y, false, '#00ff88')
              }
            }
          }
          // 添加明显的范围回复特效
          if (healedCount > 0) {
            // 创建治疗光环特效
            this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
              count: 40,
              spread: 360,
              speed: { min: 1, max: 3 },
              size: { min: 4, max: 8 },
              life: { min: 600, max: 1200 },
              colors: ['#00ff88', '#00ffaa', '#88ffaa', '#ffffff'],
              fadeOut: true
            })
            // 添加治疗范围圆环特效
            this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
              count: 30,
              spread: 360,
              speed: { min: 0.5, max: 1.5 },
              size: { min: 6, max: 12 },
              life: { min: 800, max: 1500 },
              colors: ['#00ff88', '#00ffaa'],
              fadeOut: true
            })
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
        
        // Boss移动逻辑（保持距离+侧移，不贴脸）
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            // 大幅降低Boss基础速度，并降低阶段加成，避免过快
            const base = Math.min(enemy.speed || 0.45, 0.35) // 从0.6降低到0.35
            const phaseScale = 1 + Math.max(0, (bossEnemy.phase || 1) - 1) * 0.08 // 从0.15降低到0.08
            const speed = base * phaseScale * ((this as any)._motionScale || 1)
            
            // 目标维持距离（停靠距离），显著增大，让Boss在更远距离就停止接近
            const contactDist = 15 + (enemy.size || 24)
            const stopDist = Math.max(contactDist + 120, 180) // 从120增加到180
            const minDist = contactDist + 40 // 从24增加到40，最小分离距离更大
            
            const nx = dx / (dist || 1)
            const ny = dy / (dist || 1)
            
            if (dist > stopDist + 15) {
              // 距离过远：向玩家靠近，但速度较慢
              const approachSpeed = speed * 0.7 // 接近时速度降低30%
              enemy.x += nx * approachSpeed
              enemy.y += ny * approachSpeed
            } else if (dist < stopDist - 15) {
              // 距离过近：后退到安全距离
              const retreatSpeed = speed * 0.8 // 后退速度稍快
              enemy.x -= nx * retreatSpeed
              enemy.y -= ny * retreatSpeed
            } else {
              // 距离合适：大幅减速或停止，偶尔小幅侧移
              // 只在30%的时间内进行小幅侧移，大部分时间保持静止
              if (Math.random() < 0.3) {
                const strafe = speed * 0.3 // 侧移速度大幅降低到30%
              enemy.x += -ny * strafe
              enemy.y += nx * strafe
              }
              // 70%的时间保持静止，不移动
            }
            
            // 强制最小分离，避免进入接触伤害半径
            const actualDistX = enemy.x - this.playerX
            const actualDistY = enemy.y - this.playerY
            const actualDist = Math.hypot(actualDistX, actualDistY) || 1
            if (actualDist < minDist) {
              const nxx = actualDistX / actualDist
              const nyy = actualDistY / actualDist
              enemy.x = this.playerX + nxx * minDist
              enemy.y = this.playerY + nyy * minDist
              // 在边界上再给一点切向偏移，防止再次吸附
              const strafe2 = ((this as any)._motionScale || 1) * 0.3 // 从0.5降低到0.3
              enemy.x += -nyy * strafe2
              enemy.y += nxx * strafe2
            }
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
              id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
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
            // 召唤小怪 - 添加明显的召唤特效
            this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
              count: 70,
              spread: 360,
              speed: { min: 2, max: 6 },
              size: { min: 6, max: 12 },
              life: { min: 600, max: 1200 },
              colors: ['#FF6600', '#FF8800', '#FFAA00', '#FFFFFF'],
              fadeOut: true
            })
            // 添加召唤阵圆环特效
            this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
              count: 50,
              spread: 360,
              speed: { min: 1, max: 4 },
              size: { min: 10, max: 20 },
              life: { min: 800, max: 1500 },
              colors: ['#FF6600', '#FF8800', '#FFFFFF'],
              fadeOut: true
            })
            // 添加屏幕震动效果
            this.effectsSystem.addScreenEffect('shake', 0.3, 200, '#FF6600')
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
        // 第5层时使用更长的攻击冷却（3000ms），其他层保持2000ms
        if (!commander.attackCooldown) commander.attackCooldown = this.currentLevel === 5 ? 3000 : 2000
        if (!commander.lastSkill) commander.lastSkill = now
        // 第5层时使用更长的技能冷却（18000ms），其他层保持12000ms
        if (!commander.skillCooldown) commander.skillCooldown = this.currentLevel === 5 ? 18000 : 12000
        
        // **修复**：Boss移动逻辑（保持距离，不贴脸）
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            // 大幅降低Boss基础速度
            const base = Math.min(enemy.speed || 0.45, 0.35)
            const speed = base * ((this as any)._motionScale || 1)
            
            // 目标维持距离（停靠距离），显著增大
            const contactDist = 15 + (enemy.size || 24)
            const stopDist = Math.max(contactDist + 120, 180)
            const minDist = contactDist + 40
            
            const nx = dx / dist
            const ny = dy / dist
            
            if (dist > stopDist + 15) {
              // 距离过远：向玩家靠近，但速度较慢
              const approachSpeed = speed * 0.7
              enemy.x += nx * approachSpeed
              enemy.y += ny * approachSpeed
            } else if (dist < stopDist - 15) {
              // 距离过近：后退到安全距离
              const retreatSpeed = speed * 0.8
              enemy.x -= nx * retreatSpeed
              enemy.y -= ny * retreatSpeed
            } else {
              // 距离合适：大幅减速或停止，偶尔小幅侧移
              if (Math.random() < 0.3) {
                const strafe = speed * 0.3
                enemy.x += -ny * strafe
                enemy.y += nx * strafe
              }
              // 70%的时间保持静止
            }
            
            // 强制最小分离，避免进入接触伤害半径
            const actualDistX = enemy.x - this.playerX
            const actualDistY = enemy.y - this.playerY
            const actualDist = Math.hypot(actualDistX, actualDistY) || 1
            if (actualDist < minDist) {
              const nxx = actualDistX / actualDist
              const nyy = actualDistY / actualDist
              enemy.x = this.playerX + nxx * minDist
              enemy.y = this.playerY + nyy * minDist
              const strafe2 = ((this as any)._motionScale || 1) * 0.3
              enemy.x += -nyy * strafe2
              enemy.y += nxx * strafe2
            }
            
            // **修复**：添加边界检查，防止Boss跑出屏幕
            const margin = enemy.size || 24
            enemy.x = Math.max(margin, Math.min(this.canvas.width - margin, enemy.x))
            enemy.y = Math.max(margin, Math.min(this.canvas.height - margin, enemy.y))
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
            // Boss远程伤害：第5层时降低到1.0倍（从1.5倍降低），其他层保持1.5倍
            const bossDamageMultiplier = this.currentLevel === 5 ? 1.0 : 1.5
            const bossDamage = baseDamage * bossDamageMultiplier
            this.projectiles.push({
              id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
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
        
        // 技能2：步兵方阵（召唤）- 第5层时降低强度
        if (!commander.lastSummon) commander.lastSummon = now - (this.currentLevel === 5 ? 18000 : 12000)
        const summonCooldown = this.currentLevel === 5 ? 18000 : 12000 // 第5层时增加冷却到18秒
        const summonCount = this.currentLevel === 5 ? 2 : 4 // 第5层时只召唤2个（从4个降低）
        if (now - commander.lastSummon >= summonCooldown) {
          // 技能特效：明显的召唤阵特效
          this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
            count: 80,
            spread: 360,
            speed: { min: 2, max: 6 },
            size: { min: 6, max: 12 },
            life: { min: 600, max: 1200 },
            colors: ['#00B7FF', '#0088FF', '#44DDFF', '#FFFFFF'],
            fadeOut: true
          })
          // 添加召唤阵圆环特效
          this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
            count: 50,
            spread: 360,
            speed: { min: 1, max: 4 },
            size: { min: 10, max: 20 },
            life: { min: 800, max: 1500 },
            colors: ['#00B7FF', '#0088FF', '#FFFFFF'],
            fadeOut: true
          })
          // 添加屏幕震动效果
          this.effectsSystem.addScreenEffect('shake', 0.3, 200, '#00B7FF')
          this.summonMinions(enemy, summonCount)
          commander.lastSummon = now
        }
        
        // 技能3：重装冲锋（新技能）- 第5层时延迟激活条件（从50%降到30%）
        if (!commander.lastCharge) commander.lastCharge = now
        const healthPercent = enemy.health / enemy.maxHealth
        const chargeThreshold = this.currentLevel === 5 ? 0.3 : 0.5 // 第5层时30%才激活（从50%降低）
        if (healthPercent < chargeThreshold && now - commander.lastCharge >= 15000) {
          // 技能特效：冲锋准备
          this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
            count: 60,
            spread: 360,
            speed: { min: 3, max: 8 },
            size: { min: 8, max: 16 },
            life: { min: 500, max: 1000 },
            colors: ['#FF0000', '#FF6600', '#FF8800'],
            fadeOut: true
          })
          
          // 快速冲向玩家
          const dist = getDistance()
          if (dist > 0) {
            // 时间尺度的冲锋，避免一帧内多次位移造成“吸附”
            const chargeSpeedPxPerSec = 300
            const dtSec = Math.max(0.016, Math.min(0.1, ((this as any)._motionScale || 1) * 0.01667))
            enemy.x += (dx / dist) * chargeSpeedPxPerSec * dtSec
            enemy.y += (dy / dist) * chargeSpeedPxPerSec * dtSec
            
            // 如果距离足够近，造成额外伤害
            if (distanceSq < 100 * 100) {
              const chargeDamage = 20 + this.currentLevel * 3
              if (now >= this.playerIFrameUntil) {
                this.playerHealth -= chargeDamage
                this.playerIFrameUntil = now + 400
                // 添加击中特效
                this.effectsSystem.createParticleEffect('explosion_debris', this.playerX, this.playerY, {
                  count: 30,
                  spread: 360,
                  speed: { min: 3, max: 8 },
                  size: { min: 4, max: 10 },
                  life: { min: 400, max: 800 },
                  colors: ['#FF0000', '#FF6600'],
                  fadeOut: true
                })
                this.effectsSystem.addScreenEffect('shake', 0.4, 300, '#FF0000')
              }
            }
          }
          commander.lastCharge = now
        }
        
        this.handleContactDamage(enemy, this.currentLevel)
        break

      case 'fortress_guard':
        // 第10层Boss：虫巢母体
        // **性能优化**：只处理一次，避免重复计算
        const hiveMother = enemy as any
        
        // 快速退出检查：如果Boss已死亡，直接清理并退出
        if (!enemy || enemy.health <= 0) {
          if (hiveMother) {
            if (hiveMother.pendingEggs) hiveMother.pendingEggs = []
            if (hiveMother.stormZones) hiveMother.stormZones = []
          }
          break
        }
        
        // **关键修复**：Boss已经从批处理中排除，现在每5帧才会被调用一次
        // 所以不需要额外的帧数限制，但保留基本检查以确保性能
        
        // 初始化属性（只初始化一次，避免重复检查）
        if (!hiveMother._initialized) {
          hiveMother.lastSkill = now
          hiveMother.skillCooldown = 5000
          hiveMother.lastBoomHatch = now - 8000
          hiveMother.lastSwarmStorm = now - 20000
          hiveMother.pendingEggs = []
          hiveMother.stormZones = []
          hiveMother._initialized = true
        }
        
        // **关键修复**：每帧都检查并清理数组，防止累积导致卡死
        // 这是第10层卡死的根本原因：数组无限增长导致内存和性能问题
        // **更激进**：降低上限，更频繁地清理
        if (hiveMother.pendingEggs && hiveMother.pendingEggs.length > 8) {
          // **关键修复**：强制清理到8个（从10个降低到8个），更严格
          hiveMother.pendingEggs = hiveMother.pendingEggs.slice(-8)
          console.warn(`[fortress_guard] pendingEggs数组过大，强制清理到8个`)
        }
        if (hiveMother.stormZones && hiveMother.stormZones.length > 2) {
          // **关键修复**：强制清理到2个（从3个降低到2个），更严格
          hiveMother.stormZones = hiveMother.stormZones.slice(-2)
          console.warn(`[fortress_guard] stormZones数组过大，强制清理到2个`)
        }
        
        // **修复**：Boss移动逻辑（保持距离，不贴脸）
        if (distanceSq > 0 && isFinite(dx) && isFinite(dy)) {
          const dist = getDistance()
          if (dist > 0 && isFinite(dist)) {
            // 大幅降低Boss基础速度
            const base = Math.min(enemy.speed || 0.45, 0.35)
            const speed = base * ((this as any)._motionScale || 1)
            
            // 目标维持距离（停靠距离），显著增大
            const contactDist = 15 + (enemy.size || 24)
            const stopDist = Math.max(contactDist + 120, 180)
            const minDist = contactDist + 40
            
            const nx = dx / dist
            const ny = dy / dist
            
            if (dist > stopDist + 15) {
              // 距离过远：向玩家靠近，但速度较慢
              const approachSpeed = speed * 0.7
              enemy.x += nx * approachSpeed
              enemy.y += ny * approachSpeed
            } else if (dist < stopDist - 15) {
              // 距离过近：后退到安全距离
              const retreatSpeed = speed * 0.8
              enemy.x -= nx * retreatSpeed
              enemy.y -= ny * retreatSpeed
            } else {
              // 距离合适：大幅减速或停止，偶尔小幅侧移
              if (Math.random() < 0.3) {
                const strafe = speed * 0.3
                enemy.x += -ny * strafe
                enemy.y += nx * strafe
              }
              // 70%的时间保持静止
            }
            
            // 强制最小分离，避免进入接触伤害半径
            const actualDistX = enemy.x - this.playerX
            const actualDistY = enemy.y - this.playerY
            const actualDist = Math.hypot(actualDistX, actualDistY) || 1
            if (actualDist < minDist) {
              const nxx = actualDistX / actualDist
              const nyy = actualDistY / actualDist
              enemy.x = this.playerX + nxx * minDist
              enemy.y = this.playerY + nyy * minDist
              const strafe2 = ((this as any)._motionScale || 1) * 0.3
              enemy.x += -nyy * strafe2
              enemy.y += nxx * strafe2
            }
          }
        }
        
        // 技能1：虫巢繁殖（每5秒生成快速虫）
        // 确保时间差计算正确，避免立即触发
        const skillTimeDiff = now - hiveMother.lastSkill
        if (skillTimeDiff >= 5000 && skillTimeDiff < 100000) { // 添加上限防止异常大的时间差
          // **关键修复**：完全禁用粒子效果，防止卡死
          // 粒子效果是导致卡死的主要原因之一，完全禁用
          // const totalEnemies = this.enemies.length + this.pendingEnemies.length
          // if (totalEnemies < this.MAX_ENEMIES * 0.7) {
          //   // 技能特效已禁用
          // }
          
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
                // **关键修复**：更严格的限制，防止敌人数量过多导致卡死
                // 限制pendingEnemies数量，防止无限增长
                // 同时检查总敌人数量，防止超过上限
                if (this.pendingEnemies.length < 30 && this.enemies.length + this.pendingEnemies.length < this.MAX_ENEMIES * 0.8) {
                  this.pendingEnemies.push(bug) // 使用待添加队列，避免在循环中修改数组
                } else {
                  console.warn(`[fortress_guard] 敌人数量过多，跳过生成快速虫 (enemies: ${this.enemies.length}, pending: ${this.pendingEnemies.length})`)
                }
              }
            // 每个生成点都有特效
            this.addHitEffect(spawnX, spawnY, false, '#39FF14')
          }
          hiveMother.lastSkill = now
        }
        
        // 技能2：虫群风暴（新技能）- 每20秒释放范围DoT
        // **性能优化**：减少粒子效果数量
        const stormTimeDiff = now - hiveMother.lastSwarmStorm
        if (stormTimeDiff >= 20000 && stormTimeDiff < 100000) {
          // 在玩家位置创建持续伤害区域
          const stormRadius = 150
          const stormDuration = 6000 // 6秒
          
          // **关键修复**：完全禁用粒子效果，防止卡死
          // 粒子效果已完全禁用
          
          // 创建持续伤害区域（标记在玩家当前位置）
          if (!hiveMother.stormZones) hiveMother.stormZones = []
          hiveMother.stormZones.push({
            x: this.playerX,
            y: this.playerY,
            radius: stormRadius,
            startTime: now,
            duration: stormDuration,
            damagePerTick: 2 + this.currentLevel * 0.5,
            tickInterval: 500 // 每0.5秒造成一次伤害
          })
          
          // 限制风暴区域数量（加强清理逻辑）
          if (hiveMother.stormZones.length > 3) {
            // 移除最旧的风暴区域
            const oldestZone = hiveMother.stormZones.shift()
            if (oldestZone && now - oldestZone.startTime > oldestZone.duration) {
              // 如果最旧的风暴区域已经过期，直接删除
              // 否则继续保留
            }
          }
          
          // 额外安全检查：如果stormZones数组异常大，强制清理
          if (hiveMother.stormZones.length > 5) {
            console.warn(`[fortress_guard] stormZones数组异常大 (${hiveMother.stormZones.length})，强制清理`)
            // 只保留最近的3个
            hiveMother.stormZones = hiveMother.stormZones.slice(-3)
          }
          
          hiveMother.lastSwarmStorm = now
        }
        
        // **关键修复**：处理风暴区域的伤害 - 添加更严格的限制和清理
        // 这是潜在的卡死原因：stormZones数组可能累积或处理时间过长
        if (hiveMother.stormZones?.length > 0) {
          // **关键修复**：先清理所有过期区域，防止累积
          for (let i = hiveMother.stormZones.length - 1; i >= 0; i--) {
            const zone = hiveMother.stormZones[i]
            if (!zone || !zone.startTime || !isFinite(zone.startTime)) {
              hiveMother.stormZones.splice(i, 1)
              continue
            }
            const elapsed = now - zone.startTime
            if (elapsed >= zone.duration || elapsed < 0 || elapsed > 100000) {
              hiveMother.stormZones.splice(i, 1)
              continue
            }
          }
          
          // **关键修复**：强制限制数组大小，防止无限增长
          if (hiveMother.stormZones.length > 2) {
            // 只保留最近的2个（从3个降低到2个）
            hiveMother.stormZones = hiveMother.stormZones.slice(-2)
          }
          
          // **关键修复**：只处理最近的2个区域，限制处理数量
          const maxZones = Math.min(hiveMother.stormZones.length, 2)
          for (let i = hiveMother.stormZones.length - 1; i >= 0 && i >= hiveMother.stormZones.length - maxZones; i--) {
            const zone = hiveMother.stormZones[i]
            if (!zone) continue
            
            // 快速距离检查
            const dx2 = this.playerX - zone.x
            const dy2 = this.playerY - zone.y
            const distSq2 = dx2 * dx2 + dy2 * dy2
            if (distSq2 < zone.radius * zone.radius) {
              if (!zone.lastTick) zone.lastTick = zone.startTime
              if (now - zone.lastTick >= zone.tickInterval) {
                if (now >= this.playerIFrameUntil) {
                  this.playerHealth -= zone.damagePerTick
                  this.playerIFrameUntil = now + 200
                }
                zone.lastTick = now
              }
            }
          }
        }
        
        // **关键修复**：技能3：爆虫孵化 - 处理虫卵孵化和清理
        // **新增**：虫卵现在是可被攻击的敌人，需要检查是否被击杀或应该孵化
        if (hiveMother.pendingEggs && hiveMother.pendingEggs.length > 0) {
          // **关键修复**：先清理所有过期虫卵（超过孵化时间5秒的），防止无限累积
          for (let i = hiveMother.pendingEggs.length - 1; i >= 0; i--) {
            const egg = hiveMother.pendingEggs[i]
            if (!egg) {
              hiveMother.pendingEggs.splice(i, 1)
              continue
            }
            
            // **新增**：检查虫卵是否已被击杀（通过enemyIndex查找）
            if (egg.enemyIndex !== undefined) {
              // **修复**：由于数组可能变化，需要重新查找虫卵敌人
              let eggEnemy: any = null
              let eggEnemyIndex = -1
              
              // 在敌人列表中查找对应的虫卵（通过位置和类型匹配）
              for (let j = 0; j < this.enemies.length; j++) {
                const e = this.enemies[j]
                if (e && e.type === 'egg' && Math.abs(e.x - egg.x) < 5 && Math.abs(e.y - egg.y) < 5) {
                  eggEnemy = e
                  eggEnemyIndex = j
                  break
                }
              }
              
              // 如果虫卵敌人不存在或已死亡，从pendingEggs中移除
              if (!eggEnemy || eggEnemy.health <= 0 || eggEnemy.type !== 'egg') {
                hiveMother.pendingEggs.splice(i, 1)
                continue
              }
              
              // **新增**：检查是否应该孵化（时间到了且虫卵还活着）
              // **修复**：使用eggEnemy.hatchTime而不是egg.hatchTime（因为enemy对象中有hatchTime）
              const hatchTime = eggEnemy.hatchTime || egg.hatchTime
              if (hatchTime && now >= hatchTime && eggEnemy.health > 0) {
                // **关键修复**：检查敌人数量，防止生成过多敌人导致卡死
                const currentEnemyCount = this.enemies.length + this.pendingEnemies.length
                if (currentEnemyCount >= this.MAX_ENEMIES * 0.75) {
                  // 敌人数量过多，直接删除虫卵，不孵化
                  // 从敌人列表中移除虫卵
                  if (eggEnemy) {
                    const eggIndex = this.enemies.indexOf(eggEnemy)
                    if (eggIndex >= 0) {
                      this.enemies.splice(eggIndex, 1)
                    }
                  }
                  hiveMother.pendingEggs.splice(i, 1)
                  continue
                }
                
                // 孵化自爆虫
                const exploder = this.createEnemyByType('charger', this.currentLevel, egg.x, egg.y, 1, 12)
                if (exploder) {
                  exploder.speed = 2.0
                  exploder.health = 1
                  if (this.pendingEnemies.length < 15 && currentEnemyCount < this.MAX_ENEMIES * 0.75) {
                    this.pendingEnemies.push(exploder)
                    
                    // 孵化特效
                    this.effectsSystem.createParticleEffect('magic_burst', egg.x, egg.y, {
                      count: 30,
                      spread: 360,
                      speed: { min: 2, max: 6 },
                      size: { min: 4, max: 8 },
                      life: { min: 400, max: 800 },
                      colors: ['#8B4513', '#A0522D', '#CD853F'],
                      fadeOut: true
                    })
                  }
                }
                
                // 从敌人列表中移除已孵化的虫卵
                if (eggEnemyIndex >= 0) {
                  this.enemies.splice(eggEnemyIndex, 1)
                }
                // 从pendingEggs中移除
                hiveMother.pendingEggs.splice(i, 1)
              }
            } else if (egg.hatchTime && now - egg.hatchTime > 5000) {
              // 旧格式的虫卵（没有enemyIndex），直接删除过期太久的
              hiveMother.pendingEggs.splice(i, 1)
            }
          }
          
          // **关键修复**：如果数组还是太大，强制清理最旧的（更严格）
          if (hiveMother.pendingEggs.length > 8) {
            // 只保留最近的8个虫卵（从10个降低到8个）
            hiveMother.pendingEggs = hiveMother.pendingEggs.slice(-8)
            console.warn(`[fortress_guard] pendingEggs数组过大，强制清理到8个`)
          }
        }
        
        // 生成新的虫卵（每10秒）
        // **性能优化**：如果敌人数量已经很多，减少虫卵生成频率
        const boomTimeDiff = now - hiveMother.lastBoomHatch
        const hiveEnemyCount = this.enemies.length + this.pendingEnemies.length
        const shouldSpawnEggs = hiveEnemyCount < this.MAX_ENEMIES * 0.8 // 敌人数量少于80%上限时才生成虫卵
        
        if (boomTimeDiff >= 10000 && boomTimeDiff < 100000 && shouldSpawnEggs) {
          // **关键修复**：完全禁用粒子效果，防止卡死
          // 粒子效果已完全禁用
          
          // 在玩家位置生成虫卵（5秒后孵化，可被击杀）
          // **关键修复**：更严格的限制，防止pendingEggs数组累积导致卡死
          // 这是第10层卡死的核心问题：虫卵生成速度超过处理速度
          const maxEggs = 8 // 从10进一步减少到8，更严格防止累积
          // **关键修复**：如果数组已经很大，不再生成新虫卵
          if (hiveMother.pendingEggs.length >= maxEggs) {
            // 数组已满，不生成新虫卵
            hiveMother.lastBoomHatch = now // 更新冷却时间，但跳过生成
            break // 直接退出switch case
          }
          const eggCount = hiveEnemyCount < 30 ? 3 : 2 // 敌人少时生成3个，敌人多时生成2个
          const actualEggCount = Math.min(eggCount, maxEggs - hiveMother.pendingEggs.length)
          
          // **关键修复**：确保不会超过限制
          if (actualEggCount <= 0) {
            hiveMother.lastBoomHatch = now
            break // 不生成虫卵，直接退出
          }
          
          for (let i = 0; i < actualEggCount; i++) {
            // 增加分散度：使用更大的角度和距离，避免重叠
            const baseAngle = (i / Math.max(actualEggCount, 1)) * Math.PI * 2  // 均匀分布（修复：使用actualEggCount）
            const angleVariation = (Math.random() - 0.5) * 0.5  // 随机角度变化
            const offsetAngle = baseAngle + angleVariation
            const baseDistance = 50 + Math.random() * 30  // 距离50-80像素
            const eggX = this.playerX + Math.cos(offsetAngle) * baseDistance
            const eggY = this.playerY + Math.sin(offsetAngle) * baseDistance
            
            // **新增**：创建虫卵作为可被攻击的敌人对象
            const eggHealth = 5 + this.currentLevel * 0.5 // 虫卵血量：基础5点，每层+0.5
            const eggSize = 15 + this.currentLevel * 0.3
            const eggHatchTime = now + 5000 // 5秒后孵化
            
            const eggEnemy = {
              x: eggX,
              y: eggY,
              size: eggSize,
              color: '#8B4513', // 棕色虫卵
              health: eggHealth,
              maxHealth: eggHealth,
              type: 'egg', // 虫卵类型
              isElite: false,
              speed: 0, // 虫卵不移动
              hatchTime: eggHatchTime, // 孵化时间
              isEgg: true, // 标记为虫卵
              icdUntil: 0,
              lastAttack: 0,
              attackCooldown: 0
            }
            
            // 将虫卵添加到敌人列表（作为可被攻击的敌人）
            if (this.enemies.length < this.MAX_ENEMIES) {
              const eggIndex = this.enemies.length
              this.enemies.push(eggEnemy)
              // 同时添加到pendingEggs用于孵化逻辑
              if (!hiveMother.pendingEggs) hiveMother.pendingEggs = []
              hiveMother.pendingEggs.push({
                x: eggX,
                y: eggY,
                hatchTime: eggHatchTime,
                enemyIndex: eggIndex // 保存敌人索引（在push之前获取）
              })
            }
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
        
        // 隐身时移动逻辑（保持距离，不贴脸）
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            // 大幅降低Boss基础速度，隐身时稍快但也不太快
            const base = Math.min(enemy.speed || 0.45, 0.35)
            const speedMultiplier = assassin.isInvisible ? 1.2 : 1.0 // 隐身时只快20%
            const speed = base * speedMultiplier * ((this as any)._motionScale || 1)
            
            // 目标维持距离（停靠距离），显著增大
            const contactDist = 15 + (enemy.size || 24)
            const stopDist = Math.max(contactDist + 120, 180)
            const minDist = contactDist + 40
            
            const nx = dx / dist
            const ny = dy / dist
            
            if (dist > stopDist + 15) {
              // 距离过远：向玩家靠近，但速度较慢
              const approachSpeed = speed * 0.7
              enemy.x += nx * approachSpeed
              enemy.y += ny * approachSpeed
            } else if (dist < stopDist - 15) {
              // 距离过近：后退到安全距离
              const retreatSpeed = speed * 0.8
              enemy.x -= nx * retreatSpeed
              enemy.y -= ny * retreatSpeed
            } else {
              // 距离合适：大幅减速或停止，偶尔小幅侧移
              if (Math.random() < 0.3) {
                const strafe = speed * 0.3
                enemy.x += -ny * strafe
                enemy.y += nx * strafe
              }
              // 70%的时间保持静止
            }
            
            // 强制最小分离，避免进入接触伤害半径
            const actualDistX = enemy.x - this.playerX
            const actualDistY = enemy.y - this.playerY
            const actualDist = Math.hypot(actualDistX, actualDistY) || 1
            if (actualDist < minDist) {
              const nxx = actualDistX / actualDist
              const nyy = actualDistY / actualDist
              enemy.x = this.playerX + nxx * minDist
              enemy.y = this.playerY + nyy * minDist
              const strafe2 = ((this as any)._motionScale || 1) * 0.3
              enemy.x += -nyy * strafe2
              enemy.y += nxx * strafe2
            }
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
              id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
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
          // **修复**：Boss移动逻辑（保持距离，不贴脸）
          if (distanceSq > 0) {
            const dist = getDistance()
            if (dist > 0) {
              // 大幅降低Boss基础速度
              const base = Math.min(enemy.speed || 0.45, 0.35)
              const speed = base * ((this as any)._motionScale || 1)
              
              // 目标维持距离（停靠距离），显著增大
              const contactDist = 15 + (enemy.size || 24)
              const stopDist = Math.max(contactDist + 120, 180)
              const minDist = contactDist + 40
              
              const nx = dx / dist
              const ny = dy / dist
              
              if (dist > stopDist + 15) {
                // 距离过远：向玩家靠近，但速度较慢
                const approachSpeed = speed * 0.7
                enemy.x += nx * approachSpeed
                enemy.y += ny * approachSpeed
              } else if (dist < stopDist - 15) {
                // 距离过近：后退到安全距离
                const retreatSpeed = speed * 0.8
                enemy.x -= nx * retreatSpeed
                enemy.y -= ny * retreatSpeed
              } else {
                // 距离合适：大幅减速或停止，偶尔小幅侧移
                if (Math.random() < 0.3) {
                  const strafe = speed * 0.3
                  enemy.x += -ny * strafe
                  enemy.y += nx * strafe
                }
                // 70%的时间保持静止
              }
              
              // 强制最小分离，避免进入接触伤害半径
              const actualDistX = enemy.x - this.playerX
              const actualDistY = enemy.y - this.playerY
              const actualDist = Math.hypot(actualDistX, actualDistY) || 1
              if (actualDist < minDist) {
                const nxx = actualDistX / actualDist
                const nyy = actualDistY / actualDist
                enemy.x = this.playerX + nxx * minDist
                enemy.y = this.playerY + nyy * minDist
                const strafe2 = ((this as any)._motionScale || 1) * 0.3
                enemy.x += -nyy * strafe2
                enemy.y += nxx * strafe2
              }
            }
          }
          // 阶段1：更独特的攻击方式 - 混沌震荡波 + 追踪弹
          // 技能1：混沌震荡波（圆形冲击波）
          if (!chaos.lastShockwave) chaos.lastShockwave = now - 4000
          if (now - chaos.lastShockwave >= 4000) { // 4秒一次
            // 创建3个圆形冲击波，从Boss位置向外扩散
            if (!chaos.shockwaves) chaos.shockwaves = []
            chaos.shockwaves.push({
              x: enemy.x,
              y: enemy.y,
              radius: 20,
              maxRadius: 200,
              speed: 3,
              damage: 15 + this.currentLevel * 2, // 降低伤害：从30+level*5改为15+level*2
              startTime: now
            })
            
            // 震荡波特效
            this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
              count: 60,
              spread: 360,
              speed: { min: 1, max: 4 },
              size: { min: 8, max: 16 },
              life: { min: 600, max: 1200 },
              colors: ['#FF4500', '#FF8800', '#FFAA00'],
              fadeOut: true
            })
            this.effectsSystem.addScreenEffect('shake', 0.4, 300, '#FF4500')
            
            chaos.lastShockwave = now
          }
          
          // 处理震荡波
          if (chaos.shockwaves && chaos.shockwaves.length > 0) {
            for (let i = chaos.shockwaves.length - 1; i >= 0; i--) {
              const wave = chaos.shockwaves[i]
              if (!wave) {
                chaos.shockwaves.splice(i, 1)
                continue
              }
              
              wave.radius += wave.speed
              
              // 检查是否击中玩家
              const dx = this.playerX - wave.x
              const dy = this.playerY - wave.y
              const distSq = dx * dx + dy * dy
              const hitRadiusSq = (wave.radius + 15) * (wave.radius + 15)
              const missRadiusSq = (wave.radius - 15) * (wave.radius - 15)
              
              if (distSq < hitRadiusSq && distSq > missRadiusSq && !wave.hasHit) {
                // 玩家在冲击波边缘，造成伤害
                if (now >= this.playerIFrameUntil) {
                  this.playerHealth -= wave.damage
                  this.playerIFrameUntil = now + 400
                  wave.hasHit = true
                  
                  // 击中特效
                  this.effectsSystem.createParticleEffect('explosion_debris', this.playerX, this.playerY, {
                    count: 20,
                    spread: 360,
                    speed: { min: 3, max: 8 },
                    size: { min: 4, max: 10 },
                    life: { min: 400, max: 800 },
                    colors: ['#FF4500', '#FF8800'],
                    fadeOut: true
                  })
                }
              }
              
              // 移除过期的冲击波
              if (wave.radius >= wave.maxRadius) {
                chaos.shockwaves.splice(i, 1)
              }
            }
            // 限制冲击波数量
            if (chaos.shockwaves.length > 3) {
              chaos.shockwaves = chaos.shockwaves.slice(-3)
            }
          }
          
          // 技能2：追踪弹（每3秒发射）
          if (now - chaos.lastSkill >= 3000) { // 3秒一次
            // 技能特效：明显的混沌能量聚集（橙红色能量波动）
            this.effectsSystem.createParticleEffect('fire_burst', enemy.x, enemy.y, {
              count: 80,
              spread: 60, // 扇形60度（使用度数）
              speed: { min: 4, max: 10 },
              size: { min: 8, max: 16 },
              life: { min: 600, max: 1200 },
              colors: ['#FF4500', '#FF8800', '#FFAA00', '#FFFF00'],
              fadeOut: true
            })
            // 添加充能特效
            this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
              count: 40,
              spread: 60,
              speed: { min: 2, max: 6 },
              size: { min: 12, max: 24 },
              life: { min: 800, max: 1500 },
              colors: ['#FF4500', '#FF8800'],
              fadeOut: true
            })
            // 扇形范围攻击（60度扇形，150像素范围）
            const hitRangeSq = 150 * 150
            if (distanceSq < hitRangeSq) {
              // Boss面向玩家的角度
              const bossFacingAngle = Math.atan2(dy, dx)
              // 玩家相对于Boss的角度
              const playerAngle = Math.atan2(this.playerY - enemy.y, this.playerX - enemy.x)
              // 计算角度差（归一化到-π到π）
              let angleDiff = playerAngle - bossFacingAngle
              // 归一化角度差到-π到π范围
              while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
              while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
              const absAngleDiff = Math.abs(angleDiff)
              const halfSectorAngle = (60 * Math.PI / 180) / 2 // 30度
              
              // 如果玩家在Boss前方的60度扇形内，造成伤害
              if (absAngleDiff <= halfSectorAngle) {
                const damage = 20 + this.currentLevel * 3 // 降低伤害：从40+level*8改为20+level*3
                if (now >= this.playerIFrameUntil) {
                  this.playerHealth -= damage
                  this.playerIFrameUntil = now + 500
                  this.effectsSystem.addScreenEffect('shake', 0.6, 500, '#FF4500')
                  // 添加击中特效
                  this.effectsSystem.createParticleEffect('explosion_debris', this.playerX, this.playerY, {
                    count: 30,
                    spread: 360,
                    speed: { min: 3, max: 8 },
                    size: { min: 4, max: 10 },
                    life: { min: 400, max: 800 },
                    colors: ['#FF4500', '#FF8800'],
                    fadeOut: true
                  })
                }
              }
            }
            // 发射3发追踪弹
            for (let i = 0; i < 3; i++) {
              const angle = Math.atan2(dy, dx) + (i - 1) * 0.3
              const bulletSpeed = 6
              const homingProjectile: any = {
                id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * bulletSpeed,
                vy: Math.sin(angle) * bulletSpeed,
                damage: 10 + this.currentLevel * 1.5, // 降低伤害：从20+level*3改为10+level*1.5
                isCrit: false,
                life: 800,
                pierce: 0,
                maxPierce: 0,
                owner: 'enemy',
                isGrenade: false,
                isHoming: true, // 标记为追踪弹
                targetX: this.playerX,
                targetY: this.playerY
              }
              this.projectiles.push(homingProjectile)
            }
            
            chaos.lastSkill = now
          }
        }
        // 阶段2：混沌织法者（远程）
        else if (chaos.phase === 2) {
          // **修复**：Boss持续移动，保持适当距离但会接近玩家
          if (distanceSq > 0) {
            const dist = getDistance()
            if (dist > 0) {
              // 保持距离，但会持续移动（提高速度）
              const keepRange = 200
              const baseSpeed = enemy.speed || 3.5 // 进一步提高基础速度（从1.3提高到3.5）
              if (dist < keepRange) {
                // 距离太近，后退
                enemy.x -= (dx / dist) * baseSpeed * 1.3
                enemy.y -= (dy / dist) * baseSpeed * 1.3
              } else if (dist > keepRange * 1.5) {
                // 距离太远，接近
                enemy.x += (dx / dist) * baseSpeed * 1.2
                enemy.y += (dy / dist) * baseSpeed * 1.2
              }
            }
          }
          // 阶段2：更独特的攻击方式 - 混沌领域 + 元素弹幕
          // 技能1：混沌领域（持续伤害区域）
          if (!chaos.lastChaosZone) chaos.lastChaosZone = now - 8000
          if (now - chaos.lastChaosZone >= 8000) {
            // 在玩家周围创建4个持续伤害区域
            for (let i = 0; i < 4; i++) {
              const angle = (i / 4) * Math.PI * 2
              const radius = 120
              const zoneX = this.playerX + Math.cos(angle) * radius
              const zoneY = this.playerY + Math.sin(angle) * radius
              
              if (!chaos.chaosZones) chaos.chaosZones = []
              chaos.chaosZones.push({
                x: zoneX,
                y: zoneY,
                radius: 60,
                startTime: now,
                duration: 5000, // 持续5秒
                damagePerTick: 1 + this.currentLevel * 0.3, // 降低伤害：从2+level*0.5改为1+level*0.3
                tickInterval: 500,
                lastTick: now
              })
              
              // 领域生成特效
              this.effectsSystem.createParticleEffect('magic_burst', zoneX, zoneY, {
                count: 40,
                spread: 360,
                speed: { min: 2, max: 6 },
                size: { min: 6, max: 12 },
                life: { min: 500, max: 1000 },
                colors: ['#8800FF', '#FF00FF', '#FFFFFF'],
                fadeOut: true
              })
            }
            chaos.lastChaosZone = now
          }
          
          // 处理混沌领域的伤害
          if (chaos.chaosZones && chaos.chaosZones.length > 0) {
            for (let i = chaos.chaosZones.length - 1; i >= 0; i--) {
              const zone = chaos.chaosZones[i]
              if (!zone || now - zone.startTime > zone.duration) {
                chaos.chaosZones.splice(i, 1)
                continue
              }
              
              const dx = this.playerX - zone.x
              const dy = this.playerY - zone.y
              const distSq = dx * dx + dy * dy
              if (distSq < zone.radius * zone.radius) {
                if (now - zone.lastTick >= zone.tickInterval) {
                  if (now >= this.playerIFrameUntil) {
                    this.playerHealth -= zone.damagePerTick
                    this.playerIFrameUntil = now + 200
                  }
                  zone.lastTick = now
                }
              }
            }
            // 限制领域数量
            if (chaos.chaosZones.length > 4) {
              chaos.chaosZones = chaos.chaosZones.slice(-4)
            }
          }
          
          // 技能2：元素弹幕（快速连续发射）
          if (now - chaos.lastSkill >= 3000) { // 3秒一次，更频繁
            const elementColors = [
              ['#00AAFF', '#88CCFF', '#AAEEFF', '#FFFFFF'], // 冰
              ['#FF4400', '#FF8800', '#FFAA00', '#FFFF00'], // 火
              ['#AA00FF', '#FF00FF', '#FF88FF', '#FFFFFF']  // 雷
            ]
            const elementIndex = Math.floor((now / 2000) % 3) // 每2秒切换元素
            
            const angle = Math.atan2(dy, dx)
            const bulletSpeed = 8
            // 发射5发投射物，更密集
            for (let i = 0; i < 5; i++) {
              const spreadAngle = angle + (i - 2) * 0.15  // 更宽的扇形
              this.projectiles.push({
                id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(spreadAngle) * bulletSpeed,
                vy: Math.sin(spreadAngle) * bulletSpeed,
                damage: 12 + this.currentLevel * 2, // 降低伤害：从25+level*4改为12+level*2
                isCrit: false,
                life: 600,
                pierce: 0,
                maxPierce: 1,
                owner: 'enemy',
                isGrenade: false
              })
            }
            
            // 弹幕特效
            this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
              count: 30,
              spread: 40,
              speed: { min: 3, max: 8 },
              size: { min: 4, max: 10 },
              life: { min: 400, max: 800 },
              colors: elementColors[elementIndex],
              fadeOut: true
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
          // 阶段3：更独特的攻击方式 - 混沌风暴 + 多重冲刺
          // 技能1：混沌风暴（持续旋转的伤害区域）
          if (!chaos.lastStorm) chaos.lastStorm = now - 6000
          if (now - chaos.lastStorm >= 6000) { // 6秒一次
            // 在Boss周围创建旋转的伤害区域
            if (!chaos.stormZones) chaos.stormZones = []
            for (let i = 0; i < 3; i++) {
              const angle = (i / 3) * Math.PI * 2 + (now / 1000) * 0.5 // 旋转
              const radius = 100
              chaos.stormZones.push({
                x: enemy.x + Math.cos(angle) * radius,
                y: enemy.y + Math.sin(angle) * radius,
                radius: 50,
                startTime: now,
                duration: 4000,
                damagePerTick: 1.5 + this.currentLevel * 0.3, // 降低伤害：从3+level*0.5改为1.5+level*0.3
                tickInterval: 300,
                lastTick: now,
                rotationSpeed: 0.02,
                baseAngle: angle
              })
            }
            
            // 风暴特效
            this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
              count: 80,
              spread: 360,
              speed: { min: 2, max: 8 },
              size: { min: 5, max: 12 },
              life: { min: 500, max: 1000 },
              colors: ['#FF0000', '#FF00FF', '#8800FF', '#FFFFFF'],
              fadeOut: true
            })
            
            chaos.lastStorm = now
          }
          
          // 处理风暴区域（旋转移动）
          if (chaos.stormZones && chaos.stormZones.length > 0) {
            for (let i = chaos.stormZones.length - 1; i >= 0; i--) {
              const zone = chaos.stormZones[i]
              if (!zone || now - zone.startTime > zone.duration) {
                chaos.stormZones.splice(i, 1)
                continue
              }
              
              // 旋转移动
              const elapsed = (now - zone.startTime) / 1000
              const currentAngle = zone.baseAngle + elapsed * zone.rotationSpeed * 10
              const radius = 100
              zone.x = enemy.x + Math.cos(currentAngle) * radius
              zone.y = enemy.y + Math.sin(currentAngle) * radius
              
              // 检查玩家是否在区域内
              const dx = this.playerX - zone.x
              const dy = this.playerY - zone.y
              const distSq = dx * dx + dy * dy
              if (distSq < zone.radius * zone.radius) {
                if (now - zone.lastTick >= zone.tickInterval) {
                  if (now >= this.playerIFrameUntil) {
                    this.playerHealth -= zone.damagePerTick
                    this.playerIFrameUntil = now + 200
                  }
                  zone.lastTick = now
                }
              }
            }
            // 限制风暴数量
            if (chaos.stormZones.length > 3) {
              chaos.stormZones = chaos.stormZones.slice(-3)
            }
          }
          
          // 技能2：多重冲刺（连续3次冲刺，每次间隔0.5秒）
          if (!chaos.dashCount) chaos.dashCount = 0
          if (!chaos.dashStartTime) chaos.dashStartTime = 0
          
          // 开始新的冲刺序列
          if (chaos.dashCount === 0 && now - chaos.lastSkill >= 5000) {
            chaos.dashCount = 3
            chaos.dashStartTime = now
            chaos.lastSkill = now
          }
          
          // 执行冲刺序列（每0.5秒一次）
          if (chaos.dashCount > 0) {
            const dashIndex = 3 - chaos.dashCount // 当前是第几次冲刺（0, 1, 2）
            const timeSinceStart = now - chaos.dashStartTime
            const dashInterval = 500 // 每次冲刺间隔500ms
            
            // 检查是否到了执行这次冲刺的时间
            if (timeSinceStart >= dashIndex * dashInterval && timeSinceStart < dashIndex * dashInterval + 100) {
              const dashStartX = enemy.x
              const dashStartY = enemy.y
              
              // 预测玩家位置（基于移动方向）
              const predictX = this.playerX + (this.playerX - this.playerLastX) * 2
              const predictY = this.playerY + (this.playerY - this.playerLastY) * 2
              
              enemy.x = predictX
              enemy.y = predictY
              
              // 冲刺特效
              this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
                count: 50,
                spread: 360,
                speed: { min: 4, max: 10 },
                size: { min: 5, max: 12 },
                life: { min: 300, max: 600 },
                colors: ['#FF0000', '#FF00FF', '#FFFFFF'],
                fadeOut: true
              })
              
              // 检查玩家是否在冲刺路径上
              const dashRangeSq = 100 * 100
              const dashDistSq = (this.playerX - dashStartX) ** 2 + (this.playerY - dashStartY) ** 2
              if (dashDistSq < dashRangeSq || distanceSq < dashRangeSq) {
                const dashDamage = 25 + this.currentLevel * 4
                if (now >= this.playerIFrameUntil) {
                  this.playerHealth -= dashDamage
                  this.playerIFrameUntil = now + 200
                  
                  // 击中特效
                  this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
                    count: 30,
                    spread: 360,
                    speed: { min: 4, max: 10 },
                    size: { min: 5, max: 12 },
                    life: { min: 400, max: 800 },
                    colors: ['#FF00FF', '#FF88FF', '#FFFFFF'],
                    fadeOut: true
                  })
                }
              }
              
              // 标记这次冲刺已执行
              if (!chaos.dashExecuted) chaos.dashExecuted = []
              if (!chaos.dashExecuted[dashIndex]) {
                chaos.dashExecuted[dashIndex] = true
                chaos.dashCount--
                
                if (chaos.dashCount === 0) {
                  // 冲刺序列结束
                  this.effectsSystem.addScreenEffect('shake', 0.6, 500, '#FF00FF')
                  chaos.dashExecuted = []
                }
              }
            }
            
            // 如果时间超过1.5秒，重置冲刺序列
            if (timeSinceStart > 2000) {
              chaos.dashCount = 0
              chaos.dashExecuted = []
            }
          }
        }
        
        this.handleContactDamage(enemy, this.currentLevel)
        break

      case 'frost_lord':
      case 'storm_king':
      case 'necromancer':
        // 新Boss类型：使用通用Boss AI逻辑
        // 这些Boss会移动、攻击，并拥有特殊技能
        const newBoss = enemy as any
        if (!newBoss.lastAttack) newBoss.lastAttack = now - 3000
        if (!newBoss.attackCooldown) newBoss.attackCooldown = 2000
        if (!newBoss.lastSkill) newBoss.lastSkill = now
        if (!newBoss.skillCooldown) newBoss.skillCooldown = 10000
        
        // Boss移动逻辑（保持距离，不贴脸）
        if (distanceSq > 0) {
          const dist = getDistance()
          if (dist > 0) {
            // 大幅降低Boss基础速度
            const base = Math.min(enemy.speed || 0.45, 0.35)
            const speed = base * ((this as any)._motionScale || 1)
            
            // 目标维持距离（停靠距离），显著增大
            const contactDist = 15 + (enemy.size || 24)
            const stopDist = Math.max(contactDist + 120, 180)
            const minDist = contactDist + 40
            
            const nx = dx / (dist || 1)
            const ny = dy / (dist || 1)
            
            if (dist > stopDist + 15) {
              // 距离过远：向玩家靠近，但速度较慢
              const approachSpeed = speed * 0.7
              enemy.x += nx * approachSpeed
              enemy.y += ny * approachSpeed
            } else if (dist < stopDist - 15) {
              // 距离过近：后退到安全距离
              const retreatSpeed = speed * 0.8
              enemy.x -= nx * retreatSpeed
              enemy.y -= ny * retreatSpeed
            } else {
              // 距离合适：大幅减速或停止，偶尔小幅侧移
              if (Math.random() < 0.3) {
                const strafe = speed * 0.3
                enemy.x += -ny * strafe
                enemy.y += nx * strafe
              }
              // 70%的时间保持静止
            }
            
            // 强制最小分离，避免进入接触伤害半径
            const actualDistX = enemy.x - this.playerX
            const actualDistY = enemy.y - this.playerY
            const actualDist = Math.hypot(actualDistX, actualDistY) || 1
            if (actualDist < minDist) {
              const nxx = actualDistX / actualDist
              const nyy = actualDistY / actualDist
              enemy.x = this.playerX + nxx * minDist
              enemy.y = this.playerY + nyy * minDist
              const strafe2 = ((this as any)._motionScale || 1) * 0.3
              enemy.x += -nyy * strafe2
              enemy.y += nxx * strafe2
            }
          }
        }
        
        // 远程攻击
        const newBossAttackRangeSq = 400 * 400
        let bossDamage = 0
        if (now - newBoss.lastAttack >= newBoss.attackCooldown && distanceSq > 0 && distanceSq < newBossAttackRangeSq) {
          const angle = Math.atan2(dy, dx)
          const bulletSpeed = 7
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
          bossDamage = baseDamage * 1.3
          
          // 根据Boss类型发射不同数量的投射物
          let projectileCount = 1
          if (enemy.type === 'storm_king') {
            projectileCount = 2 // 风暴之王发射2发
          } else if (enemy.type === 'necromancer') {
            projectileCount = 1 // 死灵法师发射1发
          }
          
          for (let i = 0; i < projectileCount; i++) {
            const spreadAngle = projectileCount > 1 ? (i - 0.5) * 0.3 : 0
            this.projectiles.push({
              id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle + spreadAngle) * bulletSpeed,
              vy: Math.sin(angle + spreadAngle) * bulletSpeed,
              damage: bossDamage,
              isCrit: false,
              life: 400,
              pierce: 0,
              maxPierce: 0,
              owner: 'enemy',
              isGrenade: false
            })
          }
          newBoss.lastAttack = now
        }
        
        // 特殊技能
        if (now - newBoss.lastSkill >= newBoss.skillCooldown) {
          if (enemy.type === 'frost_lord') {
            // 冰霜领主：召唤冰霜区域
            if (!newBoss.frostZones) newBoss.frostZones = []
            newBoss.frostZones.push({
              x: this.playerX,
              y: this.playerY,
              radius: 80,
              startTime: now,
              duration: 5000,
              damagePerTick: 1 + this.currentLevel * 0.2,
              tickInterval: 500,
              lastTick: now
            })
            // 限制冰霜区域数量
            if (newBoss.frostZones.length > 3) {
              newBoss.frostZones = newBoss.frostZones.slice(-3)
            }
          } else if (enemy.type === 'storm_king') {
            // 风暴之王：召唤闪电链
            const lightningAngle = Math.atan2(dy, dx)
            // 计算伤害（如果bossDamage未定义，使用基础伤害）
            let skillDamage = bossDamage > 0 ? bossDamage * 1.2 : (10 + this.currentLevel * 1.5)
            for (let i = 0; i < 3; i++) {
              const angle = lightningAngle + (i - 1) * 0.4
              this.projectiles.push({
                id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
                x: enemy.x,
                y: enemy.y,
                vx: Math.cos(angle) * 10,
                vy: Math.sin(angle) * 10,
                damage: skillDamage,
                isCrit: false,
                life: 300,
                pierce: 1,
                maxPierce: 1,
                owner: 'enemy',
                isGrenade: false
              })
            }
          } else if (enemy.type === 'necromancer') {
            // 死灵法师：召唤骷髅
            this.summonMinions(enemy, 2, 'infantry')
          }
          newBoss.lastSkill = now
        }
        
        // 处理冰霜区域
        if (enemy.type === 'frost_lord' && newBoss.frostZones) {
          for (let i = newBoss.frostZones.length - 1; i >= 0; i--) {
            const zone = newBoss.frostZones[i]
            if (!zone || now - zone.startTime > zone.duration) {
              newBoss.frostZones.splice(i, 1)
              continue
            }
            const dx = this.playerX - zone.x
            const dy = this.playerY - zone.y
            const distSq = dx * dx + dy * dy
            if (distSq < zone.radius * zone.radius) {
              if (now - zone.lastTick >= zone.tickInterval) {
                if (now >= this.playerIFrameUntil) {
                  this.playerHealth -= zone.damagePerTick
                  this.playerIFrameUntil = now + 200
                }
                zone.lastTick = now
              }
            }
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
  // **关键修复**：移除setTimeout，改用时间戳延迟机制，防止定时器累积导致内存泄漏和卡死
  private enemyRangedAttack(enemy: any) {
    // 创建预警线 - 使用当前玩家位置
    const now = Date.now()
    enemy.warningLine = {
      startX: enemy.x,
      startY: enemy.y,
      endX: this.playerX,
      endY: this.playerY,
      time: now,
      targetX: this.playerX, // 保存目标位置
      targetY: this.playerY,
      fireTime: now + 1000 // 1秒后发射
    }
  }
  
  // **新增**：处理延迟发射的投射物（在主更新循环中调用）
  private processDelayedRangedAttacks() {
    const now = Date.now()
    const pendingProjectiles: Array<{enemy: any, targetX: number, targetY: number}> = []
    
    // 检查所有敌人的预警线，看是否应该发射
    for (const enemy of this.enemies) {
      if (enemy.warningLine && enemy.warningLine.fireTime && now >= enemy.warningLine.fireTime) {
        // 应该发射了
        const targetX = enemy.warningLine.targetX || this.playerX
        const targetY = enemy.warningLine.targetY || this.playerY
        
        const dx = targetX - enemy.x
        const dy = targetY - enemy.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance > 0) {
          pendingProjectiles.push({ enemy, targetX, targetY })
        }
        
        // 清除预警线
        enemy.warningLine = undefined
      }
    }
    
    // 处理所有待发射的投射物
    for (const { enemy, targetX, targetY } of pendingProjectiles) {
      const dx = targetX - enemy.x
      const dy = targetY - enemy.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      if (distance > 0) {
        // 投射物速度：每帧10像素
        const bulletSpeed = 10
        const vx = (dx / distance) * bulletSpeed
        const vy = (dy / distance) * bulletSpeed
        
        // 计算伤害
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
        
        let damage = baseDamage
        if (enemy.type === 'archer') {
          damage = baseDamage * 1.0
        }
        
        // 限制投射物数量
        if (this.projectiles.length < this.MAX_PROJECTILES) {
          const newProjectile = {
            id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
            x: enemy.x,
            y: enemy.y,
            vx,
            vy,
            damage,
            isCrit: Math.random() < 0.15,
            life: 360,
            pierce: 0,
            maxPierce: 0,
            owner: 'enemy' as const,
            isGrenade: false
          }
          
          this.projectiles.push(newProjectile)
          
          // 添加射击特效
          this.addHitEffect(enemy.x, enemy.y, false)
          
          // 播放敌人远程攻击音效
          this.audioSystem.playSoundEffect('enemy_attack', {
            volume: 1.0,
            pitch: 1.0
          })
        }
      }
    }
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

    // **关键修复**：治疗光环：治疗附近敌人，限制检查数量防止性能问题
    const maxHealCheck = Math.min(this.enemies.length, 30) // 最多检查30个敌人
    for (let i = 0; i < maxHealCheck; i++) {
      const other = this.enemies[i]
      if (!other || other === enemy) continue
      const dxx = other.x - enemy.x
      const dyy = other.y - enemy.y
      const distSq = dxx * dxx + dyy * dyy
      const healRange = this.ENEMY_SKILL_RANGES.HEALER_HEAL_RANGE
      const healRangeSq = healRange * healRange
      if (distSq < healRangeSq && other.health < other.maxHealth) {
        other.health = Math.min(other.maxHealth, other.health + 5)
      }
    }
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
      id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // **修复**：唯一ID
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
    
    // 添加明显的召唤特效（在召唤前）
    this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
      count: 60,
      spread: 360,
      speed: { min: 2, max: 5 },
      size: { min: 5, max: 10 },
      life: { min: 500, max: 1000 },
      colors: ['#ff00ff', '#ff44ff', '#ff88ff', '#ffffff'],
      fadeOut: true
    })
    // 添加召唤阵特效
    this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
      count: 40,
      spread: 360,
      speed: { min: 1, max: 3 },
      size: { min: 8, max: 15 },
      life: { min: 600, max: 1200 },
      colors: ['#ff00ff', '#ff88ff', '#ffffff'],
      fadeOut: true
    })
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i  // 均匀分布角度
      const offset = spawnMinDist + Math.random() * (spawnMaxDist - spawnMinDist)
      const spawnX = enemy.x + Math.cos(angle) * offset
      const spawnY = enemy.y + Math.sin(angle) * offset
      
      // 添加每个召唤位置的生成特效
      this.effectsSystem.createParticleEffect('magic_burst', spawnX, spawnY, {
        count: 30,
        spread: 360,
        speed: { min: 1, max: 4 },
        size: { min: 4, max: 8 },
        life: { min: 400, max: 800 },
        colors: ['#ff00ff', '#ff44ff', '#ffffff'],
        fadeOut: true
      })
      
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
          // **修复**：连锁闪电：15%几率连锁闪电（3目标）
          // 增加触发几率，并确保有足够敌人时才能触发
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
            
            // **修复**：只有当有可连锁的敌人时才触发效果
            if (nearbyEnemies.length > 0) {
              // 在起始敌人位置添加闪电特效（先添加，让玩家看到触发）
              this.effectsSystem.createParticleEffect('energy_discharge', enemy.x, enemy.y, {
                count: 10,
                colors: ['#ffff00', '#ffaa00', '#ffffff'],
                size: { min: 3, max: 6 },
                speed: { min: 80, max: 180 },
                life: { min: 400, max: 700 },
                spread: 360
              })
              
              // 对每个目标造成连锁伤害
              nearbyEnemies.forEach(({ enemy: target }, index) => {
                const chainDamage = damage * 0.5 * (1 - index * 0.2) // 伤害递减
                if (target.health > 0) {
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
                }
              })
            }
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
            // 对范围内敌人造成伤害（性能优化：限制检查数量）
            const maxExplosionTargets = Math.min(this.enemies.length, 30) // 最多检查30个敌人
            let checkedCount = 0
            for (const target of this.enemies) {
              if (checkedCount >= maxExplosionTargets) break
              if (target === enemy || target.health <= 0) continue
              
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
              checkedCount++
            }
            
            // 添加爆炸特效
            this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
            this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
          }
          break
        }
      }
    }
  }

  // 混沌共鸣：随机触发特殊效果（15%几率）
  private applyChaosResonance(enemy: any, projectile: any, damage: number, availableSpecialEffects: string[]) {
    if (!enemy || enemy.health <= 0) return
    
    // 15%几率触发
    if (Math.random() < 0.15) {
      // 可触发的特殊效果列表
      const possibleEffects = [
        'on_hit_chain_lightning',
        'on_hit_freeze',
        'on_hit_poison',
        'on_crit_explode'
      ]
      
      // 随机选择一个效果（如果玩家已经拥有该效果，则使用玩家已有的效果；否则使用随机效果）
      const randomEffect = possibleEffects[Math.floor(Math.random() * possibleEffects.length)]
      
      // 如果玩家已经拥有该效果，直接使用；否则临时触发一次
      if (availableSpecialEffects.includes(randomEffect)) {
        // 使用玩家已有的效果（但降低触发几率，避免重复触发）
        // 这里不重复触发，因为已经在applySpecialEffectsOnHit中处理了
      } else {
        // 临时触发一次随机效果
        const tempEffects = [randomEffect]
        this.applySpecialEffectsOnHit(enemy, projectile, damage, tempEffects)
        
        // 添加混沌共鸣特效 - 彩虹色粒子
        this.effectsSystem.createParticleEffect('magic_burst', enemy.x, enemy.y, {
          count: 25,
          colors: ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#00aaff', '#8800ff', '#ff00ff'],
          size: { min: 3, max: 7 },
          speed: { min: 50, max: 120 },
          life: { min: 600, max: 1200 },
          spread: 360
        })
        // 添加彩虹击中特效
        this.addHitEffect(enemy.x, enemy.y, false, '#ff00ff')
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
    // 应用"受到伤害增加"的Debuff
    const player = this.gameState?.player as any
    if (player?.damageTakenMultiplier) {
      explosionDamage = explosionDamage * player.damageTakenMultiplier
    }
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
    // **关键修复**：最后20秒时更激进的清理策略
    const timeRemainingProj = this.gameTime
    const isNearEndProj = timeRemainingProj < 20 // 最后20秒
    
    if (this.projectiles.length > this.MAX_PROJECTILES) {
      // 保留最新的投射物，删除最旧的
      const excess = this.projectiles.length - this.MAX_PROJECTILES
      // **修复**：清理被移除投射物的拖尾效果（使用投射物的唯一ID）
      for (let i = 0; i < excess; i++) {
        const projectile = this.projectiles[i]
        if (projectile && projectile.id) {
          this.projectileVisualSystem.clearProjectileTrails(projectile.id)
        }
      }
      this.projectiles.splice(0, excess)
      console.warn(`[性能] 投射物数量超限，清理 ${excess} 个旧投射物`)
    }
    
    // **关键性能修复**：最后20秒时更激进的清理策略，防止卡顿
    // **重要修复**：与shootProjectile()中的限制保持一致，使用60%而不是50%，避免过度清理导致新子弹无法发射
    if (isNearEndProj) {
      // **关键修复**：最后20秒时，限制投射物数量到60%（与shootProjectile和最终清理保持一致）
      // **修复**：保留一些空间给新发射的子弹，避免立即被清理
      const targetCount = Math.floor(this.MAX_PROJECTILES * 0.6)
      if (this.projectiles.length > targetCount) {
        const excess = this.projectiles.length - targetCount
        // **修复**：清理被移除投射物的拖尾效果（使用投射物的唯一ID）
        for (let i = 0; i < excess; i++) {
          const projectile = this.projectiles[i]
          if (projectile && projectile.id) {
            this.projectileVisualSystem.clearProjectileTrails(projectile.id)
          }
        }
        this.projectiles.splice(0, excess)
      }
    }
    
    // **性能优化**：移除filter操作，减少开销
    
    // **关键性能修复**：限制每帧处理的投射物数量，防止O(n*m)复杂度导致卡死
    // **关键修复**：根据敌人数量和时间动态调整处理数量
    // **重要修复**：优先处理玩家的投射物，确保伤害不会丢失
    const enemyCount = this.enemies.length
    
    // 分离玩家投射物和敌人投射物
    const playerProjectiles: typeof this.projectiles = []
    const enemyProjectiles: typeof this.projectiles = []
    
    for (const proj of this.projectiles) {
      if (proj.owner === 'player') {
        playerProjectiles.push(proj)
      } else {
        enemyProjectiles.push(proj)
      }
    }
    
    // **关键修复**：优先处理玩家投射物，确保伤害不丢失
    // **性能优化**：最后20秒时也限制玩家投射物处理数量，防止卡顿
    // **关键修复**：确保新发射的子弹总是被处理，避免子弹停留在发射位置
    let maxPlayerProjectiles: number
    let maxEnemyProjectiles: number
    
    if (isNearEndProj) {
      // 重要修复：最后20秒仍处理全部玩家投射物，避免子弹不结算伤害
      // 仍然对敌人投射物做强限制，保障性能
      maxPlayerProjectiles = playerProjectiles.length
      maxEnemyProjectiles = Math.min(enemyProjectiles.length, 40) // 大幅降低敌人投射物处理（从60降到40）
    } else if (enemyCount > 60) {
      maxPlayerProjectiles = playerProjectiles.length // 正常时处理所有玩家投射物
      maxEnemyProjectiles = Math.min(enemyProjectiles.length, 50) // 敌人很多时处理50个
    } else if (enemyCount > 40) {
      maxPlayerProjectiles = playerProjectiles.length
      maxEnemyProjectiles = Math.min(enemyProjectiles.length, 70) // 敌人中等时处理70个
    } else {
      maxPlayerProjectiles = playerProjectiles.length
      maxEnemyProjectiles = Math.min(enemyProjectiles.length, 90) // 敌人少时处理90个
    }
    
    // **关键修复**：始终优先处理最新的投射物（新发射的子弹），避免子弹停留在发射位置
    // **修复**：不仅最后20秒，任何时候如果限制了处理数量，都优先处理最新的
    if (maxPlayerProjectiles < playerProjectiles.length) {
      // 反转数组，优先处理最新的投射物（新发射的子弹在数组末尾）
      playerProjectiles.reverse()
    }
    
    // **关键修复**：先处理所有玩家投射物（确保伤害不丢失）
    for (let idx = 0; idx < maxPlayerProjectiles; idx++) {
      const projectile = playerProjectiles[idx]
      if (!projectile) continue
      
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
          
      // 播放爆炸音效
      this.audioSystem.playSoundEffect('explosion', { volume: 1.0 })
      
      // **修复**：炸弹爆炸时立即清理拖尾
      if (projectile.id) {
        this.projectileVisualSystem.clearProjectileTrails(projectile.id)
      }
      
      // 移除投射物
      projectile.life = 0
          continue
        }
        
        // **关键修复**：不再在这里递减life，因为已经在批量移除前统一递减了，避免重复递减
        continue // 炸弹处理完，继续下一个投射物
      }
      
      // 普通投射物的移动（炸弹已经在上面处理）
      // 追踪弹：朝向玩家移动
      if ((projectile as any).isHoming && projectile.owner === 'enemy') {
        const dx = this.playerX - projectile.x
        const dy = this.playerY - projectile.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          const homingSpeed = 6
          const turnRate = 0.1 // 转向速度
          const currentAngle = Math.atan2(projectile.vy, projectile.vx)
          const targetAngle = Math.atan2(dy, dx)
          let newAngle = currentAngle
          
          // 计算角度差
          let angleDiff = targetAngle - currentAngle
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
          
          // 转向
          if (Math.abs(angleDiff) > turnRate) {
            newAngle = currentAngle + (angleDiff > 0 ? turnRate : -turnRate)
          } else {
            newAngle = targetAngle
          }
          
          projectile.vx = Math.cos(newAngle) * homingSpeed
          projectile.vy = Math.sin(newAngle) * homingSpeed
        }
      }
      
      // **关键修复**：改进碰撞检测，使用更精确的方法防止投射物穿过敌人
      // 投射物速度可能很快，需要检查移动路径上的碰撞，而不仅仅是当前位置
      const prevX = projectile.x
      const prevY = projectile.y
      projectile.x += projectile.vx
      projectile.y += projectile.vy
      
      // **关键修复**：先进行碰撞检测，然后再递减life，确保投射物有机会造成伤害
      // 如果投射物已经失效，立即清理拖尾并跳过所有碰撞检测
      if (projectile.life <= 0) {
        // **修复**：投射物失效时立即清理拖尾
        if (projectile.id) {
          this.projectileVisualSystem.clearProjectileTrails(projectile.id)
        }
        continue
      }
      
      // **关键修复**：计算投射物移动距离，用于更精确的碰撞检测
      // **性能优化**：使用平方距离避免Math.sqrt，只在需要时计算
      const moveDistanceSq = projectile.vx * projectile.vx + projectile.vy * projectile.vy
      const moveDistance = Math.sqrt(moveDistanceSq) // 只在需要时计算
      
      // **关键兜底（单发子弹场景）**：当本帧只有一枚玩家投射物时，对全部敌人做一次全量线段-圆检测
      // 避免任何筛选导致的漏判，确保命中不丢失
      if (playerProjectiles.length <= 1 && this.enemies.length > 0) {
        let handledInSingleShotPass = false
        const segX1 = prevX
        const segY1 = prevY
        const segX2 = projectile.x
        const segY2 = projectile.y
        const segDx = segX2 - segX1
        const segDy = segY2 - segY1
        const segLenSq = segDx * segDx + segDy * segDy
        
        // 使用与主检测一致的保守半径策略：敌人半径 + 投射物半径(≈5) + 速度补偿
        const speedBonusSingle = Math.min(25, moveDistance * 1.2)
        
        // 逐个敌人精确检测
        for (let ei = 0; ei < this.enemies.length; ei++) {
          const e = this.enemies[ei]
          if (!e) continue
          if (!projectile.hitEnemies) projectile.hitEnemies = new Set()
          if (projectile.hitEnemies.has(e)) continue
          
          const collisionRadius = (e.size || 15) + 5 + speedBonusSingle
          const r2 = collisionRadius * collisionRadius
          
          let collided = false
          if (segLenSq > 0) {
            const toEx = e.x - segX1
            const toEy = e.y - segY1
            const t = Math.max(0, Math.min(1, (toEx * segDx + toEy * segDy) / segLenSq))
            const cx = segX1 + t * segDx
            const cy = segY1 + t * segDy
            const ddx = cx - e.x
            const ddy = cy - e.y
            collided = (ddx * ddx + ddy * ddy) <= r2
          } else {
            const ddx = segX1 - e.x
            const ddy = segY1 - e.y
            collided = (ddx * ddx + ddy * ddy) <= r2
          }
          
          if (!collided) continue
          
          handledInSingleShotPass = true
          
          // 命中处理：与主流程保持一致
          let actualDamage = projectile.damage
          const shieldEnemy = e as any
          if (shieldEnemy.shield > 0) {
            const shieldDamage = Math.min(shieldEnemy.shield, actualDamage)
            shieldEnemy.shield -= shieldDamage
            actualDamage -= shieldDamage
            this.addHitEffect(e.x, e.y, false, '#00ffff')
            if (shieldEnemy.shield <= 0) {
              this.addHitEffect(e.x, e.y, true, '#ffff00')
            }
          }
          
          if (actualDamage > 0) {
            e.health -= actualDamage
            const lifestealPercent = this.gameState?.player?.lifesteal || 0
            if (lifestealPercent > 0) {
              const healAmount = Math.floor(actualDamage * lifestealPercent)
              this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
            }
            const specialEffects = (this.gameState?.player as any)?.specialEffects || []
            if (specialEffects.length > 0) {
              this.applySpecialEffectsOnHit(e, projectile, actualDamage, specialEffects)
            }
            const bossExclusiveEffects = (this.gameState?.player as any)?.bossExclusiveEffects || []
            if (bossExclusiveEffects.includes('random_special_proc')) {
              const specialEffects2 = (this.gameState?.player as any)?.specialEffects || []
              this.applyChaosResonance(e, projectile, actualDamage, specialEffects2)
            }
            this.addHitEffect(e.x, e.y, projectile.isCrit)
            this.audioSystem.playSoundEffect('projectile_hit', {
              volume: projectile.isCrit ? 1.2 : 0.8,
              pitch: projectile.isCrit ? 1.5 : 1.0
            })
          }
          
          projectile.hitEnemies.add(e)
          projectile.pierce++
          
          // 检查穿透上限
          if (projectile.pierce > projectile.maxPierce) {
            // 无穿透时回退到碰撞点
            if (projectile.maxPierce === 0) {
              const dx = e.x - prevX
              const dy = e.y - prevY
              const dist = Math.sqrt(dx * dx + dy * dy)
              if (dist > 0) {
                const collisionDist = dist - (e.size || 15) - 5
                if (collisionDist > 0) {
                  const t = collisionDist / dist
                  projectile.x = prevX + dx * t
                  projectile.y = prevY + dy * t
                } else {
                  projectile.x = prevX
                  projectile.y = prevY
                }
              }
            }
            projectile.life = 0
          }
          
          // 击杀与分数处理
          if (e.health <= 0) {
            if (e.warningLine) {
              e.warningLine = undefined
            }
            const specialEffects = (this.gameState?.player as any)?.specialEffects || []
            if (specialEffects.length > 0) {
              this.applySpecialEffectsOnKill(e, specialEffects)
            }
            this.audioSystem.playSoundEffect('enemy_death')
            const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander', 'boss']
            const isBoss = e.type && bossTypes.includes(e.type)
            if (isBoss) {
              if (this.gameState) {
                const remainingBosses = this.enemies.filter(en => 
                  en !== e && en.type && bossTypes.includes(en.type) && en.health > 0
                )
                if (remainingBosses.length === 0) {
                  if (!this.gameState.bossDefeated || this.gameState.bossDefeated !== this.currentLevel) {
                    this.gameState.bossDefeated = this.currentLevel
                    this.gameState.hasDefeatedBoss = true
                  }
                }
              }
            }
            const isElite = e.isElite
            if (isElite) {
              if (this.gameState && !this.gameState.showPassiveSelection) {
                if (this.gameState.hasDefeatedBoss) {
                  this.gameState.extraAttributeSelect = true
                }
              }
            }
            e.health = 0
            if (!(e as any).scoreAdded) {
              const scoreGain = isElite ? 50 : 10
              this.score += scoreGain
              if (this.gameState) {
                this.gameState.score = this.score
                if (this.gameState.player) {
                  this.gameState.player.gold = (this.gameState.player.gold || 0) + scoreGain
                }
              }
              ;(e as any).scoreAdded = true
            }
            this.addDeathEffect(e.x, e.y)
          }
          
          // 如果已达终止条件，结束单发兜底循环
          if (projectile.life <= 0) {
            break
          }
        }
        
        // 单发兜底命中过，则跳过后续筛选流程，避免重复计算
        if (handledInSingleShotPass) {
          // 递减life放在统一位置，所以下面会继续执行递减逻辑
          // 这里直接进入下一个投射物
          // 使用标签或结构化控制较复杂，这里通过包装成条件来短路后续碰撞筛选
        } else {
          // 未命中则继续走下方标准流程
        }
      }
      
      // 玩家的投射物 - 检查与敌人的碰撞（已经在上面处理了移动）
      // **关键性能修复**：大幅限制碰撞检测，防止O(n*m)复杂度导致30秒卡死
      // **关键修复**：根据投射物速度动态调整检查半径，防止快速投射物穿过敌人
      const baseCheckRadius = 80 // **关键修复**：增加基础检查半径，确保能检测到敌人
      const speedMultiplier = Math.min(3.0, 1.0 + moveDistance / 8) // 速度越快，检查半径越大
      const checkRadius = baseCheckRadius * speedMultiplier
      const checkRadiusSq = checkRadius * checkRadius
      const maxEnemiesToCheck = Math.min(this.enemies.length, 20) // **关键修复**：增加检查数量，确保不遗漏敌人
      
      // **关键修复**：如果敌人数量太多，使用更激进的碰撞检测优化
      if (this.enemies.length > this.MAX_ENEMIES * 0.7) {
        // **关键修复**：敌人太多时，只检查最近的敌人（最后20秒时更少）
        const timeRemaining = this.gameTime
        const isNearEnd = timeRemaining < 20
        // **关键修复**：增加检查的敌人数量，防止快速投射物跳过敌人
        // 根据投射物速度动态调整检查数量，速度越快检查越多
        const speedFactor = Math.min(2.5, 1.0 + moveDistance / 15) // **关键修复**：增加速度因子，确保快速投射物检查更多敌人
        const baseMaxScan = isNearEnd ? 25 : 40 // 保留参数以便调整，但扫描将覆盖全部敌人
        const baseMaxCheck = isNearEnd ? 12 : 20 // **关键修复**：大幅增加检查数量，确保不遗漏敌人
        // **关键修复**：扫描全部敌人，但仅保留最近的若干个用于精确检测
        const maxEnemiesToScan = this.enemies.length
        const maxEnemiesToCheck = Math.min(maxEnemiesToScan, Math.floor(baseMaxCheck * speedFactor))
        
        // **性能优化**：使用简单的最近敌人查找，避免排序
        let closestEnemies: Array<{enemy: any, distSq: number}> = []
        let maxDistSq = checkRadiusSq
        
        // **关键修复**：使用移动前的起点和移动后的终点来计算检查范围
        // 检查范围需要覆盖整个移动路径，防止快速投射物跳过敌人
        const pathStartX = prevX
        const pathStartY = prevY
        const pathEndX = projectile.x
        const pathEndY = projectile.y
        const pathCenterX = (pathStartX + pathEndX) / 2
        const pathCenterY = (pathStartY + pathEndY) / 2
        const pathHalfLength = moveDistance / 2
        
        // **关键修复**：计算线段方向向量，用于精确的距离计算
        const lineDx = pathEndX - pathStartX
        const lineDy = pathEndY - pathStartY
        const lineLengthSq = lineDx * lineDx + lineDy * lineDy
        
        // **关键修复**：检查半径需要覆盖路径中心到路径两端的距离，加上敌人半径
        // 对于快速移动的投射物，需要更大的检查半径来确保不会跳过敌人
        const expandedCheckRadius = pathHalfLength + checkRadius + Math.min(40, moveDistance * 0.6)
        const expandedCheckRadiusSq = expandedCheckRadius * expandedCheckRadius
        
        // **性能优化**：只扫描部分敌人，找到最近的几个
        for (let enemyIndex = 0; enemyIndex < Math.min(this.enemies.length, maxEnemiesToScan); enemyIndex++) {
          const enemy = this.enemies[enemyIndex]
          if (!enemy || enemy.health <= 0) continue
          
          // **关键修复**：使用线段到圆形的距离来计算，而不是路径中心点
          // 这样可以更准确地判断敌人是否在碰撞范围内
          let roughDistanceSq: number
          if (lineLengthSq > 0) {
            // 计算线段上离敌人最近的点
            const toCircleDx = enemy.x - pathStartX
            const toCircleDy = enemy.y - pathStartY
            const t = Math.max(0, Math.min(1, (toCircleDx * lineDx + toCircleDy * lineDy) / lineLengthSq))
            const closestX = pathStartX + t * lineDx
            const closestY = pathStartY + t * lineDy
            const closestDx = closestX - enemy.x
            const closestDy = closestY - enemy.y
            roughDistanceSq = closestDx * closestDx + closestDy * closestDy
          } else {
            // 线段长度为0，使用点距离
            const dx = pathStartX - enemy.x
            const dy = pathStartY - enemy.y
            roughDistanceSq = dx * dx + dy * dy
          }
          
          // 使用更大的碰撞半径进行初步筛选
          const enemyRadius = enemy.size || 15
          const preliminaryRadius = expandedCheckRadius + enemyRadius
          const preliminaryRadiusSq = preliminaryRadius * preliminaryRadius
          
          if (roughDistanceSq <= preliminaryRadiusSq) {
            // 如果列表未满，直接添加
            if (closestEnemies.length < maxEnemiesToCheck) {
              closestEnemies.push({ enemy, distSq: roughDistanceSq })
              // 如果列表满了，更新最大距离
              if (closestEnemies.length === maxEnemiesToCheck) {
                // 找到当前列表中的最大距离
                maxDistSq = Math.max(...closestEnemies.map(e => e.distSq))
              }
            } else {
              // 列表已满，如果这个敌人更近，替换最远的
              const maxIndex = closestEnemies.findIndex(e => e.distSq === maxDistSq)
              if (maxIndex >= 0 && roughDistanceSq < maxDistSq) {
                closestEnemies[maxIndex] = { enemy, distSq: roughDistanceSq }
                // 更新最大距离
                maxDistSq = Math.max(...closestEnemies.map(e => e.distSq))
              }
            }
          }
        }
        
        // **关键修复**：只检查最近的敌人（已按距离排序，但不需要完整排序）
        if (closestEnemies.length > 0) {
          // 简单排序，只对少量元素排序
          closestEnemies.sort((a, b) => a.distSq - b.distSq)
          const enemiesToCheck = closestEnemies.slice(0, maxEnemiesToCheck)
          // 标记是否命中过，用于高密度分支的兜底检测
          let hitAnyEnemyThisProjectile = false
          
          for (const { enemy, distSq: roughDistanceSq } of enemiesToCheck) {
            // 检查是否已经击中过这个敌人
            if (!projectile.hitEnemies) {
              projectile.hitEnemies = new Set()
            }
            if (projectile.hitEnemies.has(enemy)) {
              continue // 跳过已经击中过的敌人
            }
            
            // **关键修复**：精确碰撞检测，使用更大的碰撞半径防止快速投射物穿过敌人
            // 投射物速度越快，需要的碰撞半径越大
            const baseCollisionRadius = 30 + (enemy.size || 15) // **关键修复**：增加基础碰撞半径，确保开局时也能检测到
            // **关键修复**：根据移动距离动态增加碰撞半径，确保快速投射物不会穿过
            // 对于快速移动的投射物，需要更大的碰撞半径来补偿
            const speedBonus = Math.min(30, moveDistance * 1.5) // **关键修复**：增加速度补偿，最多30像素，系数增加到1.5
            const collisionRadius = baseCollisionRadius + speedBonus
            const collisionRadiusSq = collisionRadius * collisionRadius
            
            // **关键修复**：使用线段-圆形碰撞检测，检查整个移动路径
            // 计算从prevX,prevY到projectile.x,projectile.y的线段是否与敌人圆形碰撞
            let hasCollision = false
            let finalDistanceSq = roughDistanceSq
            
            // 线段起点和终点
            const lineStartX = prevX
            const lineStartY = prevY
            const lineEndX = projectile.x
            const lineEndY = projectile.y
            
            // 线段方向向量
            const lineDx = lineEndX - lineStartX
            const lineDy = lineEndY - lineStartY
            const lineLengthSq = lineDx * lineDx + lineDy * lineDy
            
            if (lineLengthSq > 0) {
              // 从线段起点到圆心的向量
              const toCircleDx = enemy.x - lineStartX
              const toCircleDy = enemy.y - lineStartY
              
              // 计算投影（线段上离圆心最近的点）
              const t = Math.max(0, Math.min(1, (toCircleDx * lineDx + toCircleDy * lineDy) / lineLengthSq))
              
              // 线段上最近的点
              const closestX = lineStartX + t * lineDx
              const closestY = lineStartY + t * lineDy
              
              // 最近点到圆心的距离
              const closestDx = closestX - enemy.x
              const closestDy = closestY - enemy.y
              const closestDistSq = closestDx * closestDx + closestDy * closestDy
              
              // 如果最近点距离小于半径，则发生碰撞
              if (closestDistSq < collisionRadiusSq) {
                hasCollision = true
                finalDistanceSq = closestDistSq
              }
            } else {
              // 线段长度为0（起点和终点相同），使用点-圆形碰撞检测
              if (roughDistanceSq < collisionRadiusSq) {
                hasCollision = true
              }
            }
            
            if (hasCollision) {
              // **关键修复**：先应用伤害，再检查穿透
              // 无论是否穿透，都要对当前敌人造成伤害
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
              
              // 剩余伤害攻击本体（**关键**：无论是否穿透都要造成伤害）
              if (actualDamage > 0) {
                enemy.health -= actualDamage
                
                // 调试：记录一次命中与伤害
                if ((Math.random() < 0.1)) {
                  console.debug(`[Hit] 造成伤害=${actualDamage.toFixed(2)}，敌人剩余=${(enemy.health).toFixed(2)} at (${Math.round(enemy.x)},${Math.round(enemy.y)})`)
                }
                
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
              
              // 将敌人添加到已击中列表（防止重复击中）
              projectile.hitEnemies!.add(enemy)
              // 标记命中
              hitAnyEnemyThisProjectile = true
              
              // 穿透机制：增加已穿透次数
              projectile.pierce++
              
              // 检查穿透次数：如果已穿透次数超过最大穿透次数，则停止投射物
              // maxPierce = 0 表示不能穿透，只能击中第一个敌人（pierce=1时停止）
              // maxPierce = 1 表示可以穿透1个敌人（pierce=2时停止）
              // maxPierce = n 表示可以穿透n个敌人（pierce=n+1时停止）
              if (projectile.pierce > projectile.maxPierce) {
                // **关键修复**：当没有穿透能力时，立即将投射物位置回退到碰撞点，防止继续移动
                if (projectile.maxPierce === 0) {
                  // 计算碰撞点：将投射物位置回退到敌人边缘
                  const dx = enemy.x - prevX
                  const dy = enemy.y - prevY
                  const dist = Math.sqrt(dx * dx + dy * dy)
                  if (dist > 0) {
                    const enemyRadius = enemy.size || 15
                    const collisionDist = dist - enemyRadius - 5 // 5是投射物半径
                    if (collisionDist > 0) {
                      const t = collisionDist / dist
                      projectile.x = prevX + dx * t
                      projectile.y = prevY + dy * t
                    } else {
                      // 如果距离太近，直接回退到起点
                      projectile.x = prevX
                      projectile.y = prevY
                    }
                  }
                  // **关键修复**：立即停止投射物移动，防止继续移动
                  projectile.vx = 0
                  projectile.vy = 0
                }
                projectile.life = 0
                break // 达到最大穿透次数，停止投射物
              }
              // **关键**：如果没有达到最大穿透次数，继续穿透，不break
              
              if (enemy.health <= 0) {
                // **修复**：清除敌人的预警线（避免击败后仍显示红线）
                if (enemy.warningLine) {
                  enemy.warningLine = undefined
                }
                
                // 应用击败敌人时的特殊效果
                const specialEffects = (this.gameState?.player as any)?.specialEffects || []
                if (specialEffects.length > 0) {
                  this.applySpecialEffectsOnKill(enemy, specialEffects)
                }
                
                // 播放敌人死亡音效
                this.audioSystem.playSoundEffect('enemy_death')
                
                // **关键修复**：检查是否是Boss（包含所有可能的Boss类型）
                const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander']
                const isBoss = enemy.type && bossTypes.includes(enemy.type)
                
                // 如果是第10关Boss（虫巢母体），清理所有待孵化的虫卵
                if (enemy.type === 'fortress_guard') {
                  const hiveMother = enemy as any
                  if (hiveMother) {
                    if (hiveMother.pendingEggs && Array.isArray(hiveMother.pendingEggs)) {
                      hiveMother.pendingEggs = []
                    }
                    if (hiveMother.stormZones && Array.isArray(hiveMother.stormZones)) {
                      hiveMother.stormZones = []
                    }
                  }
                }
                
                // **关键修复**：确保所有Boss都被击败后才设置标志
                if (isBoss) {
                  if (this.gameState) {
                    // 检查当前层是否还有存活的Boss
                    const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander', 'boss']
                    const remainingBosses = this.enemies.filter(e => 
                      e.type && bossTypes.includes(e.type) && e.health > 0
                    )
                    
                    console.log(`[Boss死亡-碰撞1] 第${this.currentLevel}层Boss(${enemy.type})被击杀，剩余Boss数量: ${remainingBosses.length}`)
                    
                    // 只有当所有Boss都被击败后，才设置标志
                    if (remainingBosses.length === 0) {
                    if (!this.gameState.bossDefeated || this.gameState.bossDefeated !== this.currentLevel) {
                      this.gameState.bossDefeated = this.currentLevel
                      this.gameState.hasDefeatedBoss = true
                        console.log(`[Boss死亡-碰撞1] ✅ 第${this.currentLevel}层所有Boss都被击败，设置bossDefeated=${this.currentLevel}`)
                    } else {
                        console.log(`[Boss死亡-碰撞1] 第${this.currentLevel}层所有Boss都被击败，但bossDefeated已设置为${this.gameState.bossDefeated}`)
                      }
                    } else {
                      console.log(`[Boss死亡-碰撞1] 第${this.currentLevel}层还有${remainingBosses.length}个Boss存活，暂不设置bossDefeated标志`)
                    }
                  } else {
                    console.error(`[Boss死亡-碰撞1] ❌ gameState为空，无法设置bossDefeated标志`)
                  }
                } else if (enemy.type && enemy.isElite) {
                  // 如果不是Boss但是精英怪，记录日志用于调试
                  console.log(`[Boss死亡-碰撞1] 敌人${enemy.type}是精英怪但不是Boss，isElite=${enemy.isElite}`)
                }
                
                const isElite = enemy.isElite
                if (isElite) {
                  if (this.gameState && !this.gameState.showPassiveSelection) {
                    if (this.gameState.hasDefeatedBoss) {
                      this.gameState.extraAttributeSelect = true
                    }
                  }
                }
                
                if (enemy.type === 'charger' || enemy.type === 'bomb_bat') {
                  if (!(enemy as any).hasExploded) {
                    (enemy as any).hasExploded = true
                    const explosionRadius = enemy.type === 'charger' ? 80 : 100
                    const explosionDamage = enemy.type === 'charger' ? 15 + this.currentLevel : 20 + this.currentLevel
                    this.handleExplosion(enemy, explosionRadius, explosionDamage)
                    this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
                    this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
                  }
                }
                
                enemy.health = 0
                // **关键修复**：确保分数增加并同步
                // 检查是否已经添加过分数，避免重复添加
                if (!(enemy as any).scoreAdded) {
                  const scoreGain = isElite ? 50 : 10
                  this.score += scoreGain
                  // 实时同步分数到gameState
                  if (this.gameState) {
                    this.gameState.score = this.score
                    // 同步金币：击杀获得的金币与分数一致
                    if (this.gameState.player) {
                      this.gameState.player.gold = (this.gameState.player.gold || 0) + scoreGain
                    }
                  }
                  // 标记已添加分数
                  (enemy as any).scoreAdded = true
                  // 调试日志（降低频率，避免日志过多）
                  if (Math.random() < 0.1) { // 10%概率输出日志
                    console.log(`[分数] 敌人死亡（碰撞检测），添加分数: ${scoreGain}，当前总分: ${this.score}`)
                  }
                }
                this.addDeathEffect(enemy.x, enemy.y)
              }
            }
          }
          
          // 高密度分支兜底：若本帧此投射物未命中任何敌人，再做一次“最近若干敌人”的线段-圆检测
          if (!hitAnyEnemyThisProjectile && this.enemies.length > 0) {
            const segX1 = prevX
            const segY1 = prevY
            const segX2 = projectile.x
            const segY2 = projectile.y
            const segDx = segX2 - segX1
            const segDy = segY2 - segY1
            const segLenSq = segDx * segDx + segDy * segDy
            
            const candidates: Array<{ enemy: any, distSq: number }> = []
            for (let ei = 0; ei < this.enemies.length; ei++) {
              const e = this.enemies[ei]
              if (projectile.hitEnemies && projectile.hitEnemies.has(e)) continue
              let t = 0
              if (segLenSq > 0) {
                const toEx = e.x - segX1
                const toEy = e.y - segY1
                t = Math.max(0, Math.min(1, (toEx * segDx + toEy * segDy) / segLenSq))
              }
              const cx = segX1 + t * segDx
              const cy = segY1 + t * segDy
              const dx = cx - e.x
              const dy = cy - e.y
              const d2 = dx * dx + dy * dy
              candidates.push({ enemy: e, distSq: d2 })
            }
            
            const fallbackCount = 24
            candidates.sort((a, b) => a.distSq - b.distSq)
            const shortlist = candidates.slice(0, Math.min(fallbackCount, candidates.length))
            
            for (let ci = 0; ci < shortlist.length; ci++) {
              const e = shortlist[ci].enemy
              const enemyRadius = (e.size || 15)
              const collisionRadius = enemyRadius + 11
              const r2 = collisionRadius * collisionRadius
              
              let collided = false
              if (segLenSq > 0) {
                const toEx = e.x - segX1
                const toEy = e.y - segY1
                const t = Math.max(0, Math.min(1, (toEx * segDx + toEy * segDy) / segLenSq))
                const cx = segX1 + t * segDx
                const cy = segY1 + t * segDy
                const ddx = cx - e.x
                const ddy = cy - e.y
                collided = (ddx * ddx + ddy * ddy) <= r2
              } else {
                const ddx = segX1 - e.x
                const ddy = segY1 - e.y
                collided = (ddx * ddx + ddy * ddy) <= r2
              }
              
              if (collided) {
                if (!projectile.hitEnemies) {
                  projectile.hitEnemies = new Set()
                }
                if (projectile.hitEnemies.has(e)) {
                  continue
                }
                
                let actualDamage = projectile.damage
                const shieldEnemy = e as any
                if (shieldEnemy.shield > 0) {
                  const shieldDamage = Math.min(shieldEnemy.shield, actualDamage)
                  shieldEnemy.shield -= shieldDamage
                  actualDamage -= shieldDamage
                  this.addHitEffect(e.x, e.y, false, '#00ffff')
                  if (shieldEnemy.shield <= 0) {
                    this.addHitEffect(e.x, e.y, true, '#ffff00')
                  }
                }
                if (actualDamage > 0) {
                  e.health -= actualDamage
                  const lifestealPercent = this.gameState?.player?.lifesteal || 0
                  if (lifestealPercent > 0) {
                    const healAmount = Math.floor(actualDamage * lifestealPercent)
                    this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
                  }
                  const specialEffects = (this.gameState?.player as any)?.specialEffects || []
                  if (specialEffects.length > 0) {
                    this.applySpecialEffectsOnHit(e, projectile, actualDamage, specialEffects)
                  }
                  const bossExclusiveEffects = (this.gameState?.player as any)?.bossExclusiveEffects || []
                  if (bossExclusiveEffects.includes('random_special_proc')) {
                    const specialEffects2 = (this.gameState?.player as any)?.specialEffects || []
                    this.applyChaosResonance(e, projectile, actualDamage, specialEffects2)
                  }
                  this.addHitEffect(e.x, e.y, projectile.isCrit)
                  this.audioSystem.playSoundEffect('projectile_hit', {
                    volume: projectile.isCrit ? 1.2 : 0.8,
                    pitch: projectile.isCrit ? 1.5 : 1.0
                  })
                }
                
                projectile.hitEnemies.add(e)
                projectile.pierce++
                
                if (projectile.pierce > projectile.maxPierce) {
                  if (projectile.maxPierce === 0) {
                    const dx = e.x - prevX
                    const dy = e.y - prevY
                    const dist = Math.sqrt(dx * dx + dy * dy)
                    if (dist > 0) {
                      const collisionDist = dist - (e.size || 15) - 5
                      if (collisionDist > 0) {
                        const t = collisionDist / dist
                        projectile.x = prevX + dx * t
                        projectile.y = prevY + dy * t
                      } else {
                        projectile.x = prevX
                        projectile.y = prevY
                      }
                    }
                  }
                  projectile.life = 0
                }
                
                if (e.health <= 0) {
                  if (e.warningLine) {
                    e.warningLine = undefined
                  }
                  const specialEffects = (this.gameState?.player as any)?.specialEffects || []
                  if (specialEffects.length > 0) {
                    this.applySpecialEffectsOnKill(e, specialEffects)
                  }
                  this.audioSystem.playSoundEffect('enemy_death')
                  const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander', 'boss']
                  const isBoss = e.type && bossTypes.includes(e.type)
                  if (isBoss) {
                    if (this.gameState) {
                      const remainingBosses = this.enemies.filter(en => 
                        en !== e && en.type && bossTypes.includes(en.type) && en.health > 0
                      )
                      if (remainingBosses.length === 0) {
                        if (!this.gameState.bossDefeated || this.gameState.bossDefeated !== this.currentLevel) {
                          this.gameState.bossDefeated = this.currentLevel
                          this.gameState.hasDefeatedBoss = true
                        }
                      }
                    }
                  }
                  const isElite = e.isElite
                  if (isElite) {
                    if (this.gameState && !this.gameState.showPassiveSelection) {
                      if (this.gameState.hasDefeatedBoss) {
                        this.gameState.extraAttributeSelect = true
                      }
                    }
                  }
                  e.health = 0
                  if (!(e as any).scoreAdded) {
                    const scoreGain = isElite ? 50 : 10
                    this.score += scoreGain
                    if (this.gameState) {
                      this.gameState.score = this.score
                      if (this.gameState.player) {
                        this.gameState.player.gold = (this.gameState.player.gold || 0) + scoreGain
                      }
                    }
                    ;(e as any).scoreAdded = true
                  }
                  this.addDeathEffect(e.x, e.y)
                }
                
                // 若已无穿透可用，结束兜底
                if (projectile.life <= 0) {
                  break
                }
              }
            }
          }
        }
      } else {
        // **关键修复**：敌人数量正常时，使用优化的碰撞检测
        // **性能优化**：使用简单的最近敌人查找，避免完整排序
        const timeRemaining = this.gameTime
        const isNearEnd = timeRemaining < 20
        // **关键修复**：根据投射物速度动态调整检查数量，速度越快检查越多
        const speedFactor = Math.min(2.5, 1.0 + moveDistance / 15) // **关键修复**：增加速度因子，确保快速投射物检查更多敌人
        const baseMaxScan = isNearEnd ? 30 : 50 // **关键修复**：大幅增加扫描数量，确保不遗漏敌人
        const baseMaxCheck = isNearEnd ? 15 : 25 // **关键修复**：大幅增加检查数量，确保不遗漏敌人
        // **关键修复**：扫描全部敌人，但仅保留最近的若干个用于精确检测
        const maxEnemiesToScan = this.enemies.length
        const maxCheck = Math.min(maxEnemiesToScan, Math.floor(baseMaxCheck * speedFactor))
        
        // **性能优化**：使用简单的最近敌人查找，避免完整排序
        let closestEnemies: Array<{enemy: any, distSq: number}> = []
        let maxDistSq = checkRadiusSq
        
        // **关键修复**：使用移动前的起点和移动后的终点来计算检查范围
        // 检查范围需要覆盖整个移动路径，防止快速投射物跳过敌人
        const pathStartX = prevX
        const pathStartY = prevY
        const pathEndX = projectile.x
        const pathEndY = projectile.y
        const pathCenterX = (pathStartX + pathEndX) / 2
        const pathCenterY = (pathStartY + pathEndY) / 2
        const pathHalfLength = moveDistance / 2
        
        // **关键修复**：计算线段方向向量，用于精确的距离计算
        const lineDx = pathEndX - pathStartX
        const lineDy = pathEndY - pathStartY
        const lineLengthSq = lineDx * lineDx + lineDy * lineDy
        
        // **关键修复**：检查半径需要覆盖路径中心到路径两端的距离，加上敌人半径
        // 对于快速移动的投射物，需要更大的检查半径来确保不会跳过敌人
        const expandedCheckRadius = pathHalfLength + checkRadius + Math.min(40, moveDistance * 0.6)
        const expandedCheckRadiusSq = expandedCheckRadius * expandedCheckRadius
        
        for (let enemyIndex = 0; enemyIndex < maxEnemiesToScan; enemyIndex++) {
          const enemy = this.enemies[enemyIndex]
          if (!enemy || enemy.health <= 0) continue
          
          // **关键修复**：使用线段到圆形的距离来计算，而不是路径中心点
          // 这样可以更准确地判断敌人是否在碰撞范围内
          let roughDistanceSq: number
          if (lineLengthSq > 0) {
            // 计算线段上离敌人最近的点
            const toCircleDx = enemy.x - pathStartX
            const toCircleDy = enemy.y - pathStartY
            const t = Math.max(0, Math.min(1, (toCircleDx * lineDx + toCircleDy * lineDy) / lineLengthSq))
            const closestX = pathStartX + t * lineDx
            const closestY = pathStartY + t * lineDy
            const closestDx = closestX - enemy.x
            const closestDy = closestY - enemy.y
            roughDistanceSq = closestDx * closestDx + closestDy * closestDy
          } else {
            // 线段长度为0，使用点距离
            const dx = pathStartX - enemy.x
            const dy = pathStartY - enemy.y
            roughDistanceSq = dx * dx + dy * dy
          }
          
          // 使用更大的碰撞半径进行初步筛选
          const enemyRadius = enemy.size || 15
          const preliminaryRadius = expandedCheckRadius + enemyRadius
          const preliminaryRadiusSq = preliminaryRadius * preliminaryRadius
          
          // 如果距离太远，跳过（性能优化）
          if (roughDistanceSq > preliminaryRadiusSq) {
            continue
          }
          
          // 如果列表未满，直接添加
          if (closestEnemies.length < maxCheck) {
            closestEnemies.push({ enemy, distSq: roughDistanceSq })
            // 如果列表满了，更新最大距离
            if (closestEnemies.length === maxCheck) {
              maxDistSq = Math.max(...closestEnemies.map(e => e.distSq))
            }
          } else {
            // 列表已满，如果这个敌人更近，替换最远的
            const maxIndex = closestEnemies.findIndex(e => e.distSq === maxDistSq)
            if (maxIndex >= 0 && roughDistanceSq < maxDistSq) {
              closestEnemies[maxIndex] = { enemy, distSq: roughDistanceSq }
              maxDistSq = Math.max(...closestEnemies.map(e => e.distSq))
            }
          }
        }
        
        // **关键修复**：按距离排序，只处理最近的敌人（只对少量元素排序）
        closestEnemies.sort((a, b) => a.distSq - b.distSq)
        const enemiesToCheck = closestEnemies.slice(0, maxCheck)
        // **关键修复**：标记本投射物本帧是否命中过任何敌人，用于兜底检测
        let hitAnyEnemyThisProjectile = false
        
        for (const { enemy, distSq: roughDistanceSq } of enemiesToCheck) {
          // 检查是否已经击中过这个敌人
          if (!projectile.hitEnemies) {
            projectile.hitEnemies = new Set()
          }
          if (projectile.hitEnemies.has(enemy)) {
            continue // 跳过已经击中过的敌人
          }
          
          // **关键修复**：精确碰撞检测，使用更大的碰撞半径防止快速投射物穿过敌人
          // 投射物速度越快，需要的碰撞半径越大
          const baseCollisionRadius = 20 + (enemy.size || 15)
          // **关键修复**：根据移动距离动态增加碰撞半径，确保快速投射物不会穿过
          // 对于快速移动的投射物，需要更大的碰撞半径来补偿
          const speedBonus = Math.min(25, moveDistance * 1.2) // 增加速度补偿，最多25像素
          const collisionRadius = baseCollisionRadius + speedBonus
          const collisionRadiusSq = collisionRadius * collisionRadius
          
          // **关键修复**：使用线段-圆形碰撞检测，检查整个移动路径
          // 计算从prevX,prevY到projectile.x,projectile.y的线段是否与敌人圆形碰撞
          let hasCollision = false
          let finalDistanceSq = roughDistanceSq
          
          // 线段起点和终点
          const lineStartX = prevX
          const lineStartY = prevY
          const lineEndX = projectile.x
          const lineEndY = projectile.y
          
          // 线段方向向量
          const lineDx = lineEndX - lineStartX
          const lineDy = lineEndY - lineStartY
          const lineLengthSq = lineDx * lineDx + lineDy * lineDy
          
          if (lineLengthSq > 0) {
            // 从线段起点到圆心的向量
            const toCircleDx = enemy.x - lineStartX
            const toCircleDy = enemy.y - lineStartY
            
            // 计算投影（线段上离圆心最近的点）
            const t = Math.max(0, Math.min(1, (toCircleDx * lineDx + toCircleDy * lineDy) / lineLengthSq))
            
            // 线段上最近的点
            const closestX = lineStartX + t * lineDx
            const closestY = lineStartY + t * lineDy
            
            // 最近点到圆心的距离
            const closestDx = closestX - enemy.x
            const closestDy = closestY - enemy.y
            const closestDistSq = closestDx * closestDx + closestDy * closestDy
            
            // 如果最近点距离小于半径，则发生碰撞
            if (closestDistSq < collisionRadiusSq) {
              hasCollision = true
              finalDistanceSq = closestDistSq
            }
          } else {
            // 线段长度为0（起点和终点相同），使用点-圆形碰撞检测
            if (roughDistanceSq < collisionRadiusSq) {
              hasCollision = true
            }
          }
          
          if (hasCollision) {
            // **关键修复**：先应用伤害，再检查穿透
            // 无论是否穿透，都要对当前敌人造成伤害
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
            
            // 剩余伤害攻击本体（**关键**：无论是否穿透都要造成伤害）
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
              
              // 应用Boss专属效果（混沌共鸣：随机触发特殊效果）
              const bossExclusiveEffects = (this.gameState?.player as any)?.bossExclusiveEffects || []
              if (bossExclusiveEffects.includes('random_special_proc')) {
                this.applyChaosResonance(enemy, projectile, actualDamage, specialEffects)
              }
              
              // 添加击中特效
              this.addHitEffect(enemy.x, enemy.y, projectile.isCrit)
              
              // 播放投射物命中音效
              this.audioSystem.playSoundEffect('projectile_hit', {
                volume: projectile.isCrit ? 1.2 : 0.8,
                pitch: projectile.isCrit ? 1.5 : 1.0
              })
            }
            
            // 将敌人添加到已击中列表（防止重复击中）
            projectile.hitEnemies!.add(enemy)
            
            // 标记已命中，供兜底逻辑判断
            hitAnyEnemyThisProjectile = true
            
            // 穿透机制：增加已穿透次数
            projectile.pierce++
            
            // 检查穿透次数：如果已穿透次数超过最大穿透次数，则停止投射物
            // maxPierce = 0 表示不能穿透，只能击中第一个敌人（pierce=1时停止）
            // maxPierce = 1 表示可以穿透1个敌人（pierce=2时停止）
            // maxPierce = n 表示可以穿透n个敌人（pierce=n+1时停止）
            if (projectile.pierce > projectile.maxPierce) {
              // **关键修复**：当没有穿透能力时，立即将投射物位置回退到碰撞点，防止继续移动
              if (projectile.maxPierce === 0) {
                // 计算碰撞点：将投射物位置回退到敌人边缘
                const dx = enemy.x - prevX
                const dy = enemy.y - prevY
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist > 0) {
                  const enemyRadius = enemy.size || 15
                  const collisionDist = dist - enemyRadius - 5 // 5是投射物半径
                  if (collisionDist > 0) {
                    const t = collisionDist / dist
                    projectile.x = prevX + dx * t
                    projectile.y = prevY + dy * t
                  } else {
                    // 如果距离太近，直接回退到起点
                    projectile.x = prevX
                    projectile.y = prevY
                  }
                }
              }
              projectile.life = 0
              break // 达到最大穿透次数，停止投射物
            }
            // **关键**：如果没有达到最大穿透次数，继续穿透，不break
            
            if (enemy.health <= 0) {
              // **修复**：清除敌人的预警线（避免击败后仍显示红线）
              if (enemy.warningLine) {
                enemy.warningLine = undefined
              }
              
              // 应用击败敌人时的特殊效果
              const specialEffects = (this.gameState?.player as any)?.specialEffects || []
              if (specialEffects.length > 0) {
                this.applySpecialEffectsOnKill(enemy, specialEffects)
              }
              
              // 播放敌人死亡音效
              this.audioSystem.playSoundEffect('enemy_death')
              
              // **关键修复**：检查是否是Boss（包含所有可能的Boss类型）
              const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander', 'boss']
              const isBoss = enemy.type && bossTypes.includes(enemy.type)
              
              if (isBoss) {
                // **关键修复**：确保所有Boss都被击败后才设置标志
                if (this.gameState) {
                  // 检查当前层是否还有存活的Boss（注意：此时enemy还未从数组中移除）
                  const remainingBosses = this.enemies.filter(e => 
                    e !== enemy && e.type && bossTypes.includes(e.type) && e.health > 0
                  )
                  
                  console.log(`[Boss死亡-碰撞2] 第${this.currentLevel}层Boss(${enemy.type})被击杀，剩余Boss数量: ${remainingBosses.length}`)
                  
                  // 只有当所有Boss都被击败后，才设置标志
                  if (remainingBosses.length === 0) {
                  if (!this.gameState.bossDefeated || this.gameState.bossDefeated !== this.currentLevel) {
                    this.gameState.bossDefeated = this.currentLevel
                    this.gameState.hasDefeatedBoss = true
                      console.log(`[Boss死亡-碰撞2] ✅ 第${this.currentLevel}层所有Boss都被击败，设置bossDefeated=${this.currentLevel}`)
                  } else {
                      console.log(`[Boss死亡-碰撞2] 第${this.currentLevel}层所有Boss都被击败，但bossDefeated已设置为${this.gameState.bossDefeated}`)
                    }
                  } else {
                    console.log(`[Boss死亡-碰撞2] 第${this.currentLevel}层还有${remainingBosses.length}个Boss存活，暂不设置bossDefeated标志`)
                  }
                } else {
                  console.error(`[Boss死亡-碰撞2] ❌ gameState为空，无法设置bossDefeated标志`)
                }
              } else if (enemy.type && enemy.isElite) {
                // 如果不是Boss但是精英怪，记录日志用于调试
                console.log(`[Boss死亡-碰撞2] 敌人${enemy.type}是精英怪但不是Boss，isElite=${enemy.isElite}`)
              }
              
              // 检查是否精英怪
              const isElite = enemy.isElite
              if (isElite) {
                if (this.gameState && !this.gameState.showPassiveSelection) {
                  if (this.gameState.hasDefeatedBoss) {
                    this.gameState.extraAttributeSelect = true
                  }
                }
              }
              
              // 自爆型敌人死后自爆
              if (enemy.type === 'charger' || enemy.type === 'bomb_bat') {
                if (!(enemy as any).hasExploded) {
                  (enemy as any).hasExploded = true
                  const explosionRadius = enemy.type === 'charger' ? 80 : 100
                  const explosionDamage = enemy.type === 'charger' ? 15 + this.currentLevel : 20 + this.currentLevel
                  this.handleExplosion(enemy, explosionRadius, explosionDamage)
                  this.effectsSystem.createExplosionEffect(enemy.x, enemy.y, explosionRadius)
                  this.projectileVisualSystem.createExplosion(enemy.x, enemy.y, explosionRadius, 'fire')
                }
              }
              
              // 标记敌人死亡，稍后统一清理
              enemy.health = 0
              // **关键修复**：确保分数增加并同步
              // 检查是否已经添加过分数，避免重复添加
              if (!(enemy as any).scoreAdded) {
                const scoreGain = isElite ? 50 : 10
                this.score += scoreGain
                // 实时同步分数到gameState
                if (this.gameState) {
                  this.gameState.score = this.score
                  // 同步金币：击杀获得的金币与分数一致
                  if (this.gameState.player) {
                    this.gameState.player.gold = (this.gameState.player.gold || 0) + scoreGain
                  }
                }
                // 标记已添加分数
                (enemy as any).scoreAdded = true
                // 调试日志（降低频率，避免日志过多）
                if (Math.random() < 0.1) { // 10%概率输出日志
                  console.log(`[分数] 敌人死亡（碰撞检测），添加分数: ${scoreGain}，当前总分: ${this.score}`)
                }
              }
              this.addDeathEffect(enemy.x, enemy.y)
            }
          }
        }

        // **关键兜底**：如果本帧未命中任何敌人，再用一轮“最近若干敌人”的线段-圆检测，避免漏判
        if (!hitAnyEnemyThisProjectile && this.enemies.length > 0) {
          // 计算线段向量
          const segX1 = prevX
          const segY1 = prevY
          const segX2 = projectile.x
          const segY2 = projectile.y
          const segDx = segX2 - segX1
          const segDy = segY2 - segY1
          const segLenSq = segDx * segDx + segDy * segDy
          
          // 收集所有敌人到线段的最近距离，用于选取若干最近者
          const candidates: Array<{ enemy: any, distSq: number }> = []
          for (let ei = 0; ei < this.enemies.length; ei++) {
            const e = this.enemies[ei]
            // 跳过已击中过的敌人
            if (projectile.hitEnemies && projectile.hitEnemies.has(e)) continue
            // 最近点投影
            let t = 0
            if (segLenSq > 0) {
              const toEx = e.x - segX1
              const toEy = e.y - segY1
              t = Math.max(0, Math.min(1, (toEx * segDx + toEy * segDy) / segLenSq))
            }
            const cx = segX1 + t * segDx
            const cy = segY1 + t * segDy
            const dx = cx - e.x
            const dy = cy - e.y
            const d2 = dx * dx + dy * dy
            candidates.push({ enemy: e, distSq: d2 })
          }
          
          // 仅取最近的若干个做精确检测
          const fallbackCount = 24
          candidates.sort((a, b) => a.distSq - b.distSq)
          const shortlist = candidates.slice(0, Math.min(fallbackCount, candidates.length))
          
          for (let ci = 0; ci < shortlist.length; ci++) {
            const e = shortlist[ci].enemy
            // 使用保守半径：敌人半径 + 投射物半径(≈5) + 安全余量(≈6)
            const enemyRadius = (e.size || 15)
            const collisionRadius = enemyRadius + 11
            const r2 = collisionRadius * collisionRadius
            
            // 再做一次线段-圆检测
            let collided = false
            if (segLenSq > 0) {
              const toEx = e.x - segX1
              const toEy = e.y - segY1
              const t = Math.max(0, Math.min(1, (toEx * segDx + toEy * segDy) / segLenSq))
              const cx = segX1 + t * segDx
              const cy = segY1 + t * segDy
              const ddx = cx - e.x
              const ddy = cy - e.y
              collided = (ddx * ddx + ddy * ddy) <= r2
            } else {
              const ddx = segX1 - e.x
              const ddy = segY1 - e.y
              collided = (ddx * ddx + ddy * ddy) <= r2
            }
            
            if (collided) {
              // 与上面一致的命中处理
              if (!projectile.hitEnemies) {
                projectile.hitEnemies = new Set()
              }
              if (projectile.hitEnemies.has(e)) {
                continue
              }
              
              let actualDamage = projectile.damage
              const shieldEnemy = e as any
              if (shieldEnemy.shield > 0) {
                const shieldDamage = Math.min(shieldEnemy.shield, actualDamage)
                shieldEnemy.shield -= shieldDamage
                actualDamage -= shieldDamage
                this.addHitEffect(e.x, e.y, false, '#00ffff')
                if (shieldEnemy.shield <= 0) {
                  this.addHitEffect(e.x, e.y, true, '#ffff00')
                }
              }
              if (actualDamage > 0) {
                e.health -= actualDamage
                const lifestealPercent = this.gameState?.player?.lifesteal || 0
                if (lifestealPercent > 0) {
                  const healAmount = Math.floor(actualDamage * lifestealPercent)
                  this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
                }
                const specialEffects = (this.gameState?.player as any)?.specialEffects || []
                if (specialEffects.length > 0) {
                  this.applySpecialEffectsOnHit(e, projectile, actualDamage, specialEffects)
                }
                const bossExclusiveEffects = (this.gameState?.player as any)?.bossExclusiveEffects || []
                if (bossExclusiveEffects.includes('random_special_proc')) {
                  const specialEffects2 = (this.gameState?.player as any)?.specialEffects || []
                  this.applyChaosResonance(e, projectile, actualDamage, specialEffects2)
                }
                this.addHitEffect(e.x, e.y, projectile.isCrit)
                this.audioSystem.playSoundEffect('projectile_hit', {
                  volume: projectile.isCrit ? 1.2 : 0.8,
                  pitch: projectile.isCrit ? 1.5 : 1.0
                })
              }
              
              projectile.hitEnemies.add(e)
              projectile.pierce++
              hitAnyEnemyThisProjectile = true
              
              if (projectile.pierce > projectile.maxPierce) {
                if (projectile.maxPierce === 0) {
                  const dx = e.x - prevX
                  const dy = e.y - prevY
                  const dist = Math.sqrt(dx * dx + dy * dy)
                  if (dist > 0) {
                    const collisionDist = dist - (e.size || 15) - 5
                    if (collisionDist > 0) {
                      const t = collisionDist / dist
                      projectile.x = prevX + dx * t
                      projectile.y = prevY + dy * t
                    } else {
                      projectile.x = prevX
                      projectile.y = prevY
                    }
                  }
                }
                projectile.life = 0
              }
              
              // 处理击杀与分数，同上逻辑
              if (e.health <= 0) {
                if (e.warningLine) {
                  e.warningLine = undefined
                }
                const specialEffects = (this.gameState?.player as any)?.specialEffects || []
                if (specialEffects.length > 0) {
                  this.applySpecialEffectsOnKill(e, specialEffects)
                }
                this.audioSystem.playSoundEffect('enemy_death')
                const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander', 'boss']
                const isBoss = e.type && bossTypes.includes(e.type)
                if (isBoss) {
                  if (this.gameState) {
                    const remainingBosses = this.enemies.filter(en => 
                      en !== e && en.type && bossTypes.includes(en.type) && en.health > 0
                    )
                    if (remainingBosses.length === 0) {
                      if (!this.gameState.bossDefeated || this.gameState.bossDefeated !== this.currentLevel) {
                        this.gameState.bossDefeated = this.currentLevel
                        this.gameState.hasDefeatedBoss = true
                      }
                    }
                  }
                }
                const isElite = e.isElite
                if (isElite) {
                  if (this.gameState && !this.gameState.showPassiveSelection) {
                    if (this.gameState.hasDefeatedBoss) {
                      this.gameState.extraAttributeSelect = true
                    }
                  }
                }
                e.health = 0
                if (!(e as any).scoreAdded) {
                  const scoreGain = isElite ? 50 : 10
                  this.score += scoreGain
                  if (this.gameState) {
                    this.gameState.score = this.score
                    if (this.gameState.player) {
                      this.gameState.player.gold = (this.gameState.player.gold || 0) + scoreGain
                    }
                  }
                  ;(e as any).scoreAdded = true
                }
                this.addDeathEffect(e.x, e.y)
              }
              
              // 如果已无穿透，结束兜底
              if (projectile.life <= 0) {
                break
              }
            }
          }
        }
      }
      
      // **关键修复**：在碰撞检测之后递减life，确保投射物有机会造成伤害
      // 只有在life > 0时才递减，避免已经设置为0的投射物被错误处理
      if (projectile.life > 0) {
        projectile.life--
      }
    } // 结束玩家投射物处理循环
    
    // **关键修复**：处理敌人投射物（限制数量以优化性能）
    for (let enemyIdx = 0; enemyIdx < maxEnemyProjectiles; enemyIdx++) {
      const projectile = enemyProjectiles[enemyIdx]
      if (!projectile) continue
      
      // 处理重力效果（投弹手的抛物线投射物）
      if (projectile.isGrenade) {
        const gravity = 0.2
        const previousVy = projectile.vy
        projectile.vy += gravity
        projectile.x += projectile.vx
        projectile.y += projectile.vy
        
        const groundLevel = this.canvas.height - 10
        let shouldExplode = false
        let explosionX = projectile.x
        let explosionY = projectile.y
        
        if (projectile.y >= groundLevel && previousVy >= 0) {
          explosionY = groundLevel
          shouldExplode = true
        } else {
          const dx = projectile.x - this.playerX
          const dy = projectile.y - this.playerY
          const distToPlayerSq = dx * dx + dy * dy
          const triggerDistSq = 30 * 30
          if (distToPlayerSq < triggerDistSq && projectile.vy > 0) {
            shouldExplode = true
          }
        }
        
        if (shouldExplode) {
          const explosionRadius = this.ENEMY_SKILL_RANGES.GRENADIER_EXPLOSION_RADIUS
          const explosionDamage = projectile.damage || 15 + this.currentLevel * 2
          this.handleExplosion({ x: explosionX, y: explosionY }, explosionRadius, explosionDamage)
          this.effectsSystem.createExplosionEffect(explosionX, explosionY, explosionRadius)
          this.projectileVisualSystem.createExplosion(explosionX, explosionY, explosionRadius, 'fire')
          this.audioSystem.playSoundEffect('explosion', { volume: 1.0 })
          // **修复**：炸弹爆炸时立即清理拖尾
          if (projectile.id) {
            this.projectileVisualSystem.clearProjectileTrails(projectile.id)
          }
          projectile.life = 0
          continue
        }
        
        // **关键修复**：不再在这里递减life，因为已经在批量移除前统一递减了，避免重复递减
        continue
      }
      
      // 追踪弹：朝向玩家移动
      if ((projectile as any).isHoming) {
        const dx = this.playerX - projectile.x
        const dy = this.playerY - projectile.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 0) {
          const homingSpeed = 6
          const turnRate = 0.1
          const currentAngle = Math.atan2(projectile.vy, projectile.vx)
          const targetAngle = Math.atan2(dy, dx)
          let newAngle = currentAngle
          
          let angleDiff = targetAngle - currentAngle
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
          
          if (Math.abs(angleDiff) > turnRate) {
            newAngle = currentAngle + (angleDiff > 0 ? turnRate : -turnRate)
          } else {
            newAngle = targetAngle
          }
          
          projectile.vx = Math.cos(newAngle) * homingSpeed
          projectile.vy = Math.sin(newAngle) * homingSpeed
        }
      }
      
      projectile.x += projectile.vx
      projectile.y += projectile.vy
      // **关键修复**：不再在这里递减life，因为已经在批量移除前统一递减了，避免重复递减
      
      // **修复**：如果投射物已经失效，立即清理拖尾
      if (projectile.life <= 0) {
        if (projectile.id) {
          this.projectileVisualSystem.clearProjectileTrails(projectile.id)
        }
      }
      
      // 处理敌人的投射物 - 检查与玩家的碰撞
      if (projectile.life > 0) {
        // 敌人的投射物 - 检查与玩家的碰撞
        // 投弹手的炸弹不直接碰撞玩家，而是落地爆炸
        if (!projectile.isGrenade) {
          // **性能优化**：使用平方距离避免Math.sqrt
          const dx = projectile.x - this.playerX
          const dy = projectile.y - this.playerY
          const distToPlayerSq = dx * dx + dy * dy
          // **修复**：增加碰撞半径，确保能正确击中（玩家半径15 + 投射物大小约10）
          const collisionRadius = 30
          const collisionRadiusSq = collisionRadius * collisionRadius
          
          if (distToPlayerSq < collisionRadiusSq) {
            // 对玩家造成伤害
            const now = Date.now()
            // **性能优化**：移除所有console.log，减少开销
            
            // **修复**：远程伤害使用独立的无敌帧系统，不受接触伤害影响
            const projectileIFrameDuration = 100 // 远程伤害无敌帧：100ms
            
            if (now >= this.playerProjectileIFrameUntil) {
              // **修复**：远程伤害不检查堆叠上限
              const damageToApply = projectile.damage
              
              // **新增**：检查是否有临时护盾效果，优先消耗护盾
              const specialEffects = (this.gameState?.player as any)?.specialEffects || []
              const hasTempShield = specialEffects.includes('on_hit_temp_shield')
              let actualDamage = damageToApply
              
              if (hasTempShield && this.gameState?.player) {
                const player = this.gameState.player as any
                const currentShield = player.shield || 0
                
                if (currentShield > 0) {
                  // 优先消耗护盾
                  const shieldDamage = Math.min(currentShield, actualDamage)
                  player.shield = Math.max(0, currentShield - shieldDamage)
                  actualDamage -= shieldDamage
                  
                  // 护盾被攻击的特效（青色）
                  this.addHitEffect(this.playerX, this.playerY, false, '#00ffff')
                  
                  // 如果护盾被完全破坏
                  if (player.shield <= 0) {
                    // 护盾破坏特效
                    this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
                      count: 30,
                      colors: ['#00ffff', '#88ffff', '#ffffff'],
                      size: { min: 4, max: 10 },
                      speed: { min: 2, max: 6 },
                      life: { min: 400, max: 800 },
                      spread: 360,
                      fadeOut: true
                    })
                  }
                }
                
                // 受伤时获得临时护盾（如果护盾已耗尽或不存在）
                if (player.shield <= 0) {
                  const tempShieldAmount = 10 + this.currentLevel * 2 // 基础10点，每层+2点
                  const maxTempShield = 50 + this.currentLevel * 5 // 最大护盾值
                  
                  if (!player.maxShield) {
                    player.maxShield = maxTempShield
                  }
                  
                  player.shield = Math.min(tempShieldAmount, maxTempShield)
                  
                  // **新增**：临时护盾获得特效（青色光环）
                  this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
                    count: 40,
                    colors: ['#00ffff', '#88ffff', '#ffffff', '#aaffff'],
                    size: { min: 6, max: 12 },
                    speed: { min: 1, max: 3 },
                    life: { min: 600, max: 1200 },
                    spread: 360,
                    fadeOut: true
                  })
                  
                  // 添加屏幕消息提示
                  this.addScreenMessage('临时护盾', `+${Math.ceil(player.shield)}`, '#00ffff', 2000)
                }
              }
              
              this.playerHealth -= actualDamage
              
              if (this.playerHealth <= 0) {
                this.playerHealth = 0
                this.triggerGameOver()
              }
              
              // 应用远程伤害专用无敌帧（很短暂）
              this.playerProjectileIFrameUntil = now + projectileIFrameDuration
              // 注意：远程伤害不添加到playerDamageHistory，因为堆叠上限只针对接触伤害
              if (!hasTempShield || actualDamage > 0) {
                this.addHitEffect(this.playerX, this.playerY, false)
              }
              
              // 播放玩家受击音效
              this.audioSystem.playSoundEffect('player_hit', { volume: 0.7 })
              
              // 击中玩家后移除
              projectile.life = 0
              continue // 继续处理下一个投射物
            }
          }
        }
        
        // **关键修复**：在碰撞检测之后递减life，确保投射物有机会造成伤害
        // 只有在life > 0时才递减，避免已经设置为0的投射物被错误处理
        if (projectile.life > 0) {
          projectile.life--
        }
      }
    } // 结束敌人投射物处理循环

    // **关键修复**：对没有被处理的投射物递减life，确保所有投射物都会自然消失
    // 注意：已经被处理的投射物已经在处理循环中递减了life，这里只处理未被处理的投射物
    // 使用Set来标记已处理的投射物，避免重复递减
    const processedProjectiles = new Set<string>()
    
    // 标记已处理的投射物（玩家投射物和敌人投射物）
    for (let idx = 0; idx < maxPlayerProjectiles; idx++) {
      const projectile = playerProjectiles[idx]
      if (projectile && projectile.id) {
        processedProjectiles.add(projectile.id)
      }
    }
    for (let enemyIdx = 0; enemyIdx < maxEnemyProjectiles; enemyIdx++) {
      const projectile = enemyProjectiles[enemyIdx]
      if (projectile && projectile.id) {
        processedProjectiles.add(projectile.id)
      }
    }
    
    // **关键修复**：先移动所有未被处理的投射物，确保它们能够移动（即使没有被处理碰撞检测）
    for (let i = 0; i < this.projectiles.length; i++) {
      const projectile = this.projectiles[i]
      if (!projectile || processedProjectiles.has(projectile.id || '')) {
        continue // 跳过已处理的投射物
      }
      
      // 只移动未被处理的投射物（已处理的投射物已经在处理循环中移动过了）
      if (projectile.life > 0) {
        // 处理重力效果（投弹手的抛物线投射物）
        if (projectile.isGrenade) {
          const gravity = 0.2
          projectile.vy += gravity
        }
        
        // 移动投射物
        projectile.x += projectile.vx
        projectile.y += projectile.vy
      }
    }
    
    // 对未被处理的投射物递减life
    for (let i = 0; i < this.projectiles.length; i++) {
      const projectile = this.projectiles[i]
      if (projectile && projectile.life > 0 && !processedProjectiles.has(projectile.id || '')) {
        projectile.life--
      }
    }
    
    // **关键修复**：批量移除投射物，使用反向遍历避免索引问题
    // **性能优化**：最后20秒时更激进的清理策略
    // **关键修复**：清理所有过期的投射物，而不是只检查部分
    // 使用从后往前的循环，避免索引问题
    const timeRemainingColl = this.gameTime
    const isNearEndColl = timeRemainingColl < 20
    
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i]
      if (!projectile) {
        this.projectiles.splice(i, 1)
        continue
      }
      
      // **修复**：检查投射物是否应该被清理（扩大边界检查范围，确保超出屏幕的投射物被清理）
      // **关键修复**：静止的子弹（速度为0或极小）立即移除，避免子弹停留在画面中
      const speedSq = projectile.vx * projectile.vx + projectile.vy * projectile.vy
      const isStationary = speedSq < 0.01 // 速度小于0.1像素/帧的视为静止
      // **关键修复**：静止的子弹立即移除，不等待life减少
      const shouldRemoveStationary = isStationary // 只要静止就立即移除
      
      const shouldRemove = projectile.life <= 0 || 
          projectile.x < -200 || projectile.x > this.canvas.width + 200 ||
          projectile.y < -200 || projectile.y > this.canvas.height + 200 ||
          shouldRemoveStationary // 静止的子弹立即移除
      
      if (shouldRemove) {
        // **修复**：投射物消失时立即清理对应的拖尾效果（使用投射物的唯一ID）
        if (projectile.id) {
          this.projectileVisualSystem.clearProjectileTrails(projectile.id)
        }
        this.projectiles.splice(i, 1)
      }
    }
    
    // **性能优化**：限制最大投射物数量，防止卡顿
    // **关键修复**：最后20秒时适度清理（不要过度优化导致卡顿）
    const maxAllowed = isNearEndColl 
      ? Math.floor(this.MAX_PROJECTILES * 0.6)  // 最后20秒允许60%上限（从40%提高到60%，减少卡顿）
      : this.MAX_PROJECTILES
    
    if (this.projectiles.length > maxAllowed) {
      // **修复**：移除最旧的投射物时，同时清理对应的拖尾效果（使用投射物的唯一ID）
      const removeCount = this.projectiles.length - maxAllowed
      for (let i = 0; i < removeCount; i++) {
        const projectile = this.projectiles[i]
        if (projectile && projectile.id) {
          this.projectileVisualSystem.clearProjectileTrails(projectile.id)
        }
      }
      // 移除最旧的投射物（前面的）
      this.projectiles.splice(0, removeCount)
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
    const baseRange = (player.range || 1) * 300
    let attackRange = baseRange
    let attackRangeSq = attackRange * attackRange
    let enemiesInRange = this.enemies.filter(enemy => {
      const dx = enemy.x - this.playerX
      const dy = enemy.y - this.playerY
      const distanceSq = dx * dx + dy * dy
      return distanceSq <= attackRangeSq
    })

    // 不扩展射程：射程外不攻击
    if (enemiesInRange.length === 0) {
      this.currentAttackRangeSq = attackRangeSq
      return
    }

    this.currentAttackRangeSq = attackRangeSq
    
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
    const attackRangeSq = this.currentAttackRangeSq || Math.pow((player.range || 1) * 300, 2)
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
    // **关键修复**：确保攻击能够正常发出，即使投射物数量较多
    const projectileCount = Math.max(1, player.projectiles || 1)
    
    // **关键修复**：根据当前时间计算实际允许的投射物数量上限
    // 与updateProjectiles()中的逻辑保持一致，避免新子弹被立即清理
    const timeRemaining = this.gameTime
    const isNearEnd = timeRemaining < 20 // 最后20秒
    const maxAllowed = isNearEnd 
      ? Math.floor(this.MAX_PROJECTILES * 0.6)  // 最后20秒允许60%上限（与updateProjectiles一致）
      : this.MAX_PROJECTILES
    
    // **关键修复**：计算实际剩余槽位（基于实际允许的上限，而不是MAX_PROJECTILES）
    let remainingSlots = maxAllowed - this.projectiles.length
    
    // **关键修复**：如果投射物数量过多，清理最旧的投射物，但确保至少能发射1个
    // **性能优化**：限制单次清理数量，避免卡顿
    // **重要修复**：即使达到上限，也强制清理至少projectileCount个槽位，确保新子弹能发射
    if (remainingSlots < projectileCount && this.projectiles.length > 0) {
      const needToRemove = Math.max(projectileCount - remainingSlots, projectileCount) // 至少清理projectileCount个
      // **修复**：限制单次清理数量，避免一次性清理太多导致卡顿
      const maxRemovePerFrame = 30 // 每帧最多清理30个，确保能发射新子弹
      const removeCount = Math.min(needToRemove, this.projectiles.length, maxRemovePerFrame)
      
      // **修复**：清理被移除投射物的拖尾效果（使用投射物的唯一ID）
      // **性能优化**：批量清理，减少循环开销
      const projectilesToRemove = this.projectiles.slice(0, removeCount)
      for (const projectile of projectilesToRemove) {
        if (projectile && projectile.id) {
          this.projectileVisualSystem.clearProjectileTrails(projectile.id)
        }
      }
      // 只移除最旧的投射物（从数组开头移除）
      this.projectiles.splice(0, removeCount)
      remainingSlots = maxAllowed - this.projectiles.length
      
      // **修复**：如果清理后仍然不够，继续清理直到有足够空间
      if (remainingSlots < projectileCount && this.projectiles.length > 0) {
        const additionalNeeded = projectileCount - remainingSlots
        const additionalRemove = Math.min(additionalNeeded, this.projectiles.length, 20) // 再清理最多20个
        if (additionalRemove > 0) {
          const additionalToRemove = this.projectiles.slice(0, additionalRemove)
          for (const projectile of additionalToRemove) {
            if (projectile && projectile.id) {
              this.projectileVisualSystem.clearProjectileTrails(projectile.id)
            }
          }
          this.projectiles.splice(0, additionalRemove)
          remainingSlots = maxAllowed - this.projectiles.length
        }
      }
      
      // **修复**：如果清理后仍然不够，记录警告但不阻止发射（确保至少能发射1个）
      if (remainingSlots < projectileCount) {
        console.warn(`⚠️ 投射物数量过多，已清理${removeCount}个，剩余槽位: ${remainingSlots}，需要: ${projectileCount}`)
      }
    }
    
    // **关键修复**：确保至少能发射1个投射物，即使投射物数量较多
    // **重要修复**：如果清理后仍然不够，强制清理更多，确保至少能发射1个
    if (remainingSlots < 1 && this.projectiles.length > 0) {
      // 强制清理至少1个槽位
      const projectile = this.projectiles[0]
      if (projectile && projectile.id) {
        this.projectileVisualSystem.clearProjectileTrails(projectile.id)
      }
      this.projectiles.splice(0, 1)
      remainingSlots = maxAllowed - this.projectiles.length
    }
    
    const actualProjectileCount = Math.min(projectileCount, Math.max(remainingSlots, 1))
    
    if (actualProjectileCount <= 0) {
      console.warn('⚠️ 无法发射投射物：投射物数量过多')
      return // 如果投射物太多且无法清理，跳过这次攻击
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
    
    const halfSpread = spreadAngle / 2
    const pairCount = Math.floor(actualProjectileCount / 2)
    const angleStep = pairCount > 0 ? halfSpread / pairCount : 0
    const angles: number[] = [baseAngle]

    if (actualProjectileCount > 1) {
      const desiredLength = actualProjectileCount + (actualProjectileCount % 2 === 0 ? 1 : 0)

      for (let i = 1; angles.length < desiredLength; i++) {
        const offset = angleStep * i
        angles.push(baseAngle - offset)
        if (angles.length >= desiredLength) break
        angles.push(baseAngle + offset)
      }

      angles.sort((a, b) => a - b)

      if (actualProjectileCount % 2 === 0) {
        const removeIndex = this.multiShotPhase % 2 === 0 ? 0 : angles.length - 1
        angles.splice(removeIndex, 1)
        this.multiShotPhase = (this.multiShotPhase + 1) % 2
      } else if (angles.length > actualProjectileCount) {
        const excess = angles.length - actualProjectileCount
        if (excess === 1) {
          angles.splice(Math.floor(angles.length / 2), 1)
        } else if (excess > 1) {
          const trimStart = Math.floor(excess / 2)
          angles.splice(0, trimStart)
          while (angles.length > actualProjectileCount) {
            angles.pop()
          }
        }
        this.multiShotPhase = 0
      } else {
        this.multiShotPhase = 0
      }
    } else {
      this.multiShotPhase = 0
    }
    
    // 计算暴击和伤害（所有投射物使用相同的暴击结果，保持一致性）
    const isCrit = Math.random() < player.critChance
    const damage = isCrit ? player.damage * 2 : player.damage
    
    // 播放玩家攻击音效（只播放一次，不管有多少投射物）
    this.audioSystem.playSoundEffect('player_attack', { 
      volume: isCrit ? 1.2 : 1.0, // 暴击时音量更大
      pitch: isCrit ? 1.3 : 1.0 // 暴击时音调更高
    })
    
    // **修复**：根据投射物数量发射多个投射物，扇形分布
    for (let i = 0; i < angles.length; i++) {
      const currentAngle = angles[i]
      const vx = Math.cos(currentAngle) * speed
      const vy = Math.sin(currentAngle) * speed
      
      // **修复**：给每个投射物添加唯一ID
      this.projectiles.push({
        id: `proj_${++this.projectileIdCounter}_${Date.now()}`, // 唯一ID
        x: this.playerX,
        y: this.playerY,
        vx,
        vy,
        damage,
        isCrit,
        life: 120, // **修复**：增加生命周期，确保投射物有足够时间造成伤害（从60增加到120，约2秒）
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
    // **性能优化**：使用传统for循环，限制处理数量
    const maxItems = Math.min(this.droppedItems.length, 100)
    for (let i = 0; i < maxItems; i++) {
      const item = this.droppedItems[i]
      if (!item) continue
      
      // 确保治疗球完全静止
      if (item.type === 'heal_orb') {
        item.vx = 0
        item.vy = 0
        item.attractedToPlayer = false
        // 不更新位置，保持在生成时的位置不变
      }
    }
  }

  // 检查掉落物拾取
  // **关键性能修复**：使用反向遍历避免splice导致的索引问题，限制检查数量
  private checkItemPickup() {
    const maxItems = Math.min(this.droppedItems.length, 100)
    const pickupRadiusSq = (20 + 12) * (20 + 12) // 玩家半径 + 最大掉落物大小，平方
    
    // 反向遍历，避免splice导致索引问题
    for (let i = this.droppedItems.length - 1; i >= 0 && i >= this.droppedItems.length - maxItems; i--) {
      const item = this.droppedItems[i]
      if (!item) continue
      
      // 计算与玩家的距离（使用平方距离）
      const dx = this.playerX - item.x
      const dy = this.playerY - item.y
      const distSq = dx * dx + dy * dy
      
      // 如果玩家接触到掉落物
      if (distSq < pickupRadiusSq) {
        // 根据掉落物类型处理
        switch (item.type) {
          case 'heal_orb': {
            // 治疗球：回复生命值
            const healAmount = item.value
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
            
            // 添加拾取特效（限制粒子数量）
            this.effectsSystem.createParticleEffect('heal_sparkles', item.x, item.y, {
              count: 15, // 从20降到15
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
        
        // 移除已拾取的掉落物（反向遍历，安全删除）
        this.droppedItems.splice(i, 1)
      }
    }
  }

  private updateEffects() {
    // **关键性能修复**：使用反向遍历和in-place删除，避免filter创建新数组
    // 限制特效数量，防止累积
    const maxEffects = 200
    if (this.effects.length > maxEffects) {
      // 如果超过限制，删除最旧的
      this.effects.splice(0, this.effects.length - maxEffects)
    }
    
    // 反向遍历更新和删除
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]
      if (!effect) {
        this.effects.splice(i, 1)
        continue
      }
      
      effect.life--
      effect.size += 0.5 // 特效逐渐变大
      
      // 移除生命结束的特效
      if (effect.life <= 0) {
        this.effects.splice(i, 1)
      }
    }
  }

  private addHitEffect(x: number, y: number, isCrit: boolean, color?: string) {
    // **性能优化**：限制简单特效数量
    if (this.effects.length < 200) {
      // 旧的简单特效（保持兼容性）
      this.effects.push({
        x,
        y,
        type: isCrit ? 'crit_hit' : 'hit',
        life: 10,
        size: 5
      })
    }
    
    // 新的高级特效系统
    this.effectsSystem.createHitEffect(x, y, isCrit)
  }

  private addDeathEffect(x: number, y: number) {
    // **性能优化**：限制简单特效数量
    if (this.effects.length < 200) {
      // 旧的简单特效（保持兼容性）
      this.effects.push({
        x,
        y,
        type: 'death',
        life: 20,
        size: 10
      })
    }
    
    // 新的高级特效系统
    this.effectsSystem.createDeathEffect(x, y, 'normal')
  }

  // 绘制掉落物
  // **性能优化**：限制绘制数量，使用传统for循环
  private drawDroppedItems() {
    const maxItems = Math.min(this.droppedItems.length, 100)
    for (let i = 0; i < maxItems; i++) {
      const item = this.droppedItems[i]
      if (!item) continue
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
    }
  }

  // 绘制虫卵
  private drawEggs() {
    // **性能优化**：直接找到Boss，限制绘制数量，简化绘制逻辑
    const hiveMother = this.enemies.find(e => e.type === 'fortress_guard')
    if (!hiveMother) return
    
    const boss = hiveMother as any
    const eggs = boss.pendingEggs
    if (!eggs || !Array.isArray(eggs) || eggs.length === 0) return
    
    // **关键修复**：大幅减少绘制的虫卵数量，防止渲染卡顿
    // 这是第10层卡死的原因之一：渲染太多虫卵导致性能问题
    const maxEggsToDraw = 8 // 从10进一步减少到8，更严格防止渲染卡顿
    const eggsToDraw = eggs.slice(0, maxEggsToDraw)
    const now = Date.now()
    
    // **关键修复**：使用for循环替代forEach，性能更好
    for (let i = 0; i < eggsToDraw.length; i++) {
      const egg: any = eggsToDraw[i]
      if (!egg) continue
      
      // **关键修复**：验证egg数据有效性，防止无效数据导致渲染错误
      if (!egg.x || !egg.y || !isFinite(egg.x) || !isFinite(egg.y)) {
        continue // 跳过无效的egg
      }
      
      this.ctx.save()
      this.ctx.translate(egg.x, egg.y)
      
      // **关键修复**：计算孵化进度，添加边界检查防止负数导致渲染错误
      // 这是导致卡死的根本原因：负数半径导致Canvas渲染错误
      let hatchProgress = 0
      if (egg.hatchTime && egg.hatchTime > 0) {
        const progress = (now - (egg.hatchTime - 2000)) / 2000
        hatchProgress = Math.max(0, Math.min(1, progress)) // 确保在0-1范围内
      }
      const pulse = Math.max(0.5, Math.min(2, Math.sin(Date.now() / 400) * 0.15 + 1)) // 限制pulse范围
      
      // **关键修复**：虫卵大小计算，添加最小值保护，防止负数或过小的值
      const eggWidth = Math.max(5, 16 + hatchProgress * 6) // 最小5像素
      const eggHeight = Math.max(5, 20 + hatchProgress * 8) // 最小5像素
      
      // **关键修复**：外圈暗色光晕，添加边界检查，防止负数半径
      const gradientRadius = Math.max(5, eggHeight * 2) // 确保半径是正数
      const gradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, gradientRadius)
      gradient.addColorStop(0, `rgba(136, 68, 0, ${0.6 * (1 - hatchProgress * 0.3)})`)  // 棕色
      gradient.addColorStop(0.3, `rgba(57, 255, 20, ${0.4 * (1 - hatchProgress * 0.3)})`)  // 暗绿色
      gradient.addColorStop(0.7, `rgba(0, 136, 68, ${0.2 * (1 - hatchProgress * 0.3)})`)
      gradient.addColorStop(1, 'rgba(136, 68, 0, 0)')
      this.ctx.fillStyle = gradient
      this.ctx.beginPath()
      // **关键修复**：确保所有半径都是正数
      const outerWidth = Math.max(1, eggWidth * 1.8 * pulse)
      const outerHeight = Math.max(1, eggHeight * 1.8 * pulse)
      if (outerWidth > 0 && outerHeight > 0 && isFinite(outerWidth) && isFinite(outerHeight)) {
        this.ctx.ellipse(0, 0, outerWidth, outerHeight, 0, 0, Math.PI * 2)
        this.ctx.fill()
      }
      
      // **关键修复**：虫卵主体，添加边界检查，防止负数半径
      // 基础色：深棕色/暗绿色混合
      const mainGradientRadius = Math.max(5, Math.max(eggWidth, eggHeight))
      const mainGradient = this.ctx.createRadialGradient(
        -eggWidth * 0.15, -eggHeight * 0.25, 0,
        0, 0, mainGradientRadius
      )
      mainGradient.addColorStop(0, '#4a4a2a')  // 深棕色
      mainGradient.addColorStop(0.2, '#6b6b3a')  // 中棕色
      mainGradient.addColorStop(0.5, '#2d5a2d')  // 暗绿色
      mainGradient.addColorStop(0.8, '#1a3a1a')  // 深绿色
      mainGradient.addColorStop(1, '#0a1a0a')  // 几乎黑色
      this.ctx.fillStyle = mainGradient
      this.ctx.beginPath()
      // **关键修复**：确保所有半径都是正数
      const mainWidth = Math.max(1, eggWidth * pulse)
      const mainHeight = Math.max(1, eggHeight * pulse)
      if (mainWidth > 0 && mainHeight > 0 && isFinite(mainWidth) && isFinite(mainHeight)) {
        this.ctx.ellipse(0, 0, mainWidth, mainHeight, 0, 0, Math.PI * 2)
        this.ctx.fill()
      }
      
      // **关键修复**：虫卵外壳纹理，添加严格的边界检查，防止负数半径
      this.ctx.fillStyle = `rgba(34, 68, 34, ${0.8 * (1 - hatchProgress)})`
      // **性能优化**：从5个斑点减少到2个
      const seed = Math.floor(Math.abs(egg.x * 100 + egg.y * 100)) // 确保seed是正数
      for (let j = 0; j < 2; j++) {
        // **关键修复**：确保pseudoRandom在0-1范围内，防止负数
        const sinValue = Math.sin(seed + j * 100) * 10000
        const pseudoRandom = Math.abs((sinValue % 1 + 1) % 1) // 确保是正数
        const spotX = (Math.sin(j * 1.2) * eggWidth * 0.4)
        const spotY = (Math.cos(j * 1.2) * eggHeight * 0.4)
        // **关键修复**：确保spotSize是正数且不会太小
        const spotSize = Math.max(1, eggWidth * (0.08 + pseudoRandom * 0.1)) // 最小1像素
        // **关键修复**：检查所有值都是有效的正数
        if (spotSize > 0 && isFinite(spotSize) && isFinite(spotX) && isFinite(spotY)) {
          this.ctx.beginPath()
          this.ctx.ellipse(spotX, spotY, spotSize, Math.max(1, spotSize * 1.2), j * 0.3, 0, Math.PI * 2)
          this.ctx.fill()
        }
      }
      
      // **关键修复**：虫卵裂纹，添加边界检查
      if (hatchProgress > 0.5 && eggWidth > 0 && eggHeight > 0) {
        const crackAlpha = Math.max(0, Math.min(1, (hatchProgress - 0.5) * 2))  // 确保在0-1范围内
        this.ctx.strokeStyle = `rgba(255, 100, 0, ${crackAlpha * 0.8})`
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        // 绘制几条裂纹，确保坐标有效
        const x1 = -eggWidth * 0.3
        const y1 = -eggHeight * 0.2
        const x2 = eggWidth * 0.2
        const y2 = eggHeight * 0.3
        const x3 = eggWidth * 0.3
        const y3 = -eggHeight * 0.1
        const x4 = -eggWidth * 0.1
        const y4 = eggHeight * 0.4
        if (isFinite(x1) && isFinite(y1) && isFinite(x2) && isFinite(y2) &&
            isFinite(x3) && isFinite(y3) && isFinite(x4) && isFinite(y4)) {
          this.ctx.moveTo(x1, y1)
          this.ctx.lineTo(x2, y2)
          this.ctx.moveTo(x3, y3)
          this.ctx.lineTo(x4, y4)
          this.ctx.stroke()
        }
      }
      
      // **关键修复**：内部发光，添加边界检查
      if (eggWidth > 0 && eggHeight > 0) {
        this.ctx.fillStyle = `rgba(0, 136, 68, ${0.4 * (1 - hatchProgress * 0.5)})`
        this.ctx.beginPath()
        const innerWidth = Math.max(1, eggWidth * 0.6)
        const innerHeight = Math.max(1, eggHeight * 0.5)
        const innerY = eggHeight * 0.1
        if (innerWidth > 0 && innerHeight > 0 && isFinite(innerWidth) && isFinite(innerHeight) && isFinite(innerY)) {
          this.ctx.ellipse(0, innerY, innerWidth, innerHeight, 0, 0, Math.PI * 2)
          this.ctx.fill()
        }
      }
      
      // **关键修复**：高光，添加边界检查
      if (eggWidth > 0 && eggHeight > 0) {
        this.ctx.fillStyle = `rgba(136, 136, 100, ${0.5 * (1 - hatchProgress)})`
        this.ctx.beginPath()
        const highlightWidth = Math.max(1, eggWidth * 0.3)
        const highlightHeight = Math.max(1, eggHeight * 0.25)
        const highlightX = -eggWidth * 0.25
        const highlightY = -eggHeight * 0.35
        if (highlightWidth > 0 && highlightHeight > 0 && 
            isFinite(highlightWidth) && isFinite(highlightHeight) && 
            isFinite(highlightX) && isFinite(highlightY)) {
          this.ctx.ellipse(highlightX, highlightY, highlightWidth, highlightHeight, 0, 0, Math.PI * 2)
          this.ctx.fill()
        }
      }
      
      // **关键修复**：孵化进度指示，添加边界检查
      if (hatchProgress > 0.7 && eggWidth > 0 && eggHeight > 0) {
        const flash = Math.sin(Date.now() / 100) > 0
        if (flash) {
          this.ctx.strokeStyle = '#ff4400'
          this.ctx.lineWidth = 4
          this.ctx.setLineDash([8, 4])
          this.ctx.beginPath()
          const warningWidth = Math.max(1, eggWidth * 1.4)
          const warningHeight = Math.max(1, eggHeight * 1.6)
          if (warningWidth > 0 && warningHeight > 0 && isFinite(warningWidth) && isFinite(warningHeight)) {
            this.ctx.ellipse(0, 0, warningWidth, warningHeight, 0, 0, Math.PI * 2)
            this.ctx.stroke()
          }
          this.ctx.setLineDash([])
        }
      }
      
      this.ctx.restore()
    }
    
    // 绘制风暴区域（虫群风暴技能）
    if (boss.stormZones && Array.isArray(boss.stormZones) && boss.stormZones.length > 0) {
      const now = Date.now()
      // 限制绘制的风暴区域数量
      const maxZonesToDraw = 5
      const zonesToDraw = boss.stormZones.slice(0, maxZonesToDraw)
      
      zonesToDraw.forEach((zone: any) => {
            if (!zone) return
            const remainingTime = zone.duration - (now - zone.startTime)
            if (remainingTime <= 0) return
            
            const alpha = Math.min(0.3, remainingTime / zone.duration * 0.5)
            const pulse = Math.sin(Date.now() / 400) * 0.1 + 1
            
            this.ctx.save()
            
            // 风暴区域外圈
            const stormGradient = this.ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.radius * pulse)
            stormGradient.addColorStop(0, `rgba(57, 255, 20, ${alpha})`)
            stormGradient.addColorStop(0.5, `rgba(0, 255, 136, ${alpha * 0.6})`)
            stormGradient.addColorStop(1, 'rgba(57, 255, 20, 0)')
            this.ctx.fillStyle = stormGradient
            this.ctx.beginPath()
            this.ctx.arc(zone.x, zone.y, zone.radius * pulse, 0, Math.PI * 2)
            this.ctx.fill()
            
            // 风暴区域边界
            this.ctx.strokeStyle = `rgba(57, 255, 20, ${alpha * 2})`
            this.ctx.lineWidth = 2
            this.ctx.setLineDash([5, 5])
            this.ctx.beginPath()
            this.ctx.arc(zone.x, zone.y, zone.radius * pulse, 0, Math.PI * 2)
            this.ctx.stroke()
            this.ctx.setLineDash([])
            
            this.ctx.restore()
          })
    }
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

  // **新增**：绘制治疗轨迹区域
  private drawHealTrailAreas() {
    for (const area of this.healTrailAreas) {
      const lifePercent = area.life / area.maxLife
      const alpha = lifePercent * 0.3 // 透明度随生命值衰减
      
      // 绘制治疗区域（绿色半透明圆形）
      this.ctx.save()
      this.ctx.globalAlpha = alpha
      
      // 外圈（淡绿色）
      const gradient = this.ctx.createRadialGradient(area.x, area.y, 0, area.x, area.y, area.radius)
      gradient.addColorStop(0, 'rgba(0, 255, 136, 0.4)')
      gradient.addColorStop(0.5, 'rgba(0, 255, 170, 0.2)')
      gradient.addColorStop(1, 'rgba(0, 255, 136, 0)')
      
      this.ctx.fillStyle = gradient
      this.ctx.beginPath()
      this.ctx.arc(area.x, area.y, area.radius, 0, Math.PI * 2)
      this.ctx.fill()
      
      // 内圈（更亮的绿色）
      const innerGradient = this.ctx.createRadialGradient(area.x, area.y, 0, area.x, area.y, area.radius * 0.5)
      innerGradient.addColorStop(0, 'rgba(0, 255, 170, 0.6)')
      innerGradient.addColorStop(1, 'rgba(0, 255, 136, 0)')
      
      this.ctx.fillStyle = innerGradient
      this.ctx.beginPath()
      this.ctx.arc(area.x, area.y, area.radius * 0.5, 0, Math.PI * 2)
      this.ctx.fill()
      
      // 边框（绿色）
      this.ctx.strokeStyle = `rgba(0, 255, 136, ${alpha * 0.8})`
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(area.x, area.y, area.radius, 0, Math.PI * 2)
      this.ctx.stroke()
      
      this.ctx.restore()
    }
  }

  private render() {
    // 清空画布
    this.ctx.fillStyle = '#1a1a1a'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
    // 应用屏幕效果（如摇晃、闪光等）
    this.ctx.save()
    this.effectsSystem.applyScreenEffects(this.ctx, this.canvas)

    // 绘制敌人（使用新的视觉系统）
    // **关键修复**：只渲染屏幕内的敌人，大幅限制绘制数量防止卡死
    const margin = 100 // 渲染边距，确保拖尾效果可见
    const minX = -margin
    const maxX = this.canvas.width + margin
    const minY = -margin
    const maxY = this.canvas.height + margin
    
    // **关键修复**：限制绘制的敌人数量，防止渲染卡顿
    const enemyCount = this.enemies.length
    // **性能优化**：根据敌人数量动态限制绘制数量
    let maxEnemiesToDraw: number
    if (enemyCount > 60) {
      maxEnemiesToDraw = Math.min(enemyCount, 50) // 敌人很多时只绘制50个（从60降低到50）
    } else if (enemyCount > 40) {
      maxEnemiesToDraw = Math.min(enemyCount, 55) // 敌人中等时绘制55个
    } else {
      maxEnemiesToDraw = enemyCount // 敌人少时全部绘制
    }
    
    // 使用传统for循环代替forEach，性能更好
    for (let i = 0; i < maxEnemiesToDraw; i++) {
      const enemy = this.enemies[i]
      if (!enemy) continue
      
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
      
      // **关键修复**：禁用中毒粒子效果，减少性能开销
      // 中毒状态视觉效果已禁用，避免性能问题
      // const isPoisoned = enemyAny.statusEffects?.some((e: any) => e.id === 'poison' && e.duration > 0)
      // if (isPoisoned) {
      //   // 在敌人周围创建持续的中毒粒子效果 - 已禁用
      // }
      // **性能优化**：使用简单的ID，避免Date.now()调用
      this.enemyVisualSystem.drawEnemy(this.ctx, enemy.x, enemy.y, enemyOptions, `enemy_${i}`)
    }

    // 绘制虫卵（在敌人之后，掉落物之前）
    this.drawEggs()
    
    // 绘制掉落物（在敌人之后，投射物之前）
    this.drawDroppedItems()

    // **关键修复**：收集所有活跃投射物的ID，只绘制对应投射物仍然存在的拖尾
    const activeProjectileIds = new Set<string>()
    const projectileCount = this.projectiles.length
    const maxProjectilesToDraw = Math.min(projectileCount, 100) // 最多绘制100个投射物
    
    // 使用传统for循环代替forEach，性能更好
    for (let i = 0; i < maxProjectilesToDraw; i++) {
      const projectile = this.projectiles[i]
      if (!projectile) continue
      
      // **修复**：跳过生命值已归零的投射物（避免绘制已失效的投射物）
      if (projectile.life <= 0) {
        continue
      }
      
      // 收集活跃投射物的ID
      if (projectile.id) {
        activeProjectileIds.add(projectile.id)
      }
      
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
      
      // **修复**：使用投射物的唯一ID，而不是索引
      this.projectileVisualSystem.drawProjectile(
        this.ctx, 
        projectile.x, 
        projectile.y, 
        projectileOptions,
        projectileType === 'laser' ? undefined : projectile.id  // 激光不产生拖尾，其他使用唯一ID
      )
    }

    // **关键修复**：绘制非激光投射物的拖尾，只绘制对应投射物仍然存在的拖尾
    this.projectileVisualSystem.drawTrails(this.ctx, activeProjectileIds)

    // 绘制玩家（使用新的视觉系统）
    const player = this.gameState?.player as any
    const playerOptions = {
      health: this.playerHealth,
      maxHealth: this.playerMaxHealth,
      weapon: this.getCurrentWeaponType(),
      skin: 'default',
      animationState: this.getPlayerAnimationState(),
      effects: this.getPlayerEffects(),
      lastAttackTime: this.lastAttackTime,  // 传递最后攻击时间
      weaponMode: player?.weaponMode  // 传递武器模式（形态大师）
    }
    this.visualRenderer.drawPlayer(this.ctx, this.playerX, this.playerY, this.playerAngle, playerOptions)

    // 取消技能预警机制：不再绘制预警图形

    // 绘制预警线（弓箭手和狙击手）
    // **关键修复**：限制预警线检查数量，防止性能问题
    const maxWarningLinesToCheck = Math.min(enemyCount, 15) // 最多检查15个敌人的预警线（从20降低到15）
    for (let i = 0; i < maxWarningLinesToCheck; i++) {
      const enemy = this.enemies[i]
      if (!enemy) continue
      // 只绘制屏幕内的预警线
      if (enemy.x >= minX && enemy.x <= maxX && enemy.y >= minY && enemy.y <= maxY) {
        if (enemy.warningLine && enemy.type === 'archer') {
          this.drawWarningLine(enemy)
        }
      }
    }

    // **新增**：绘制治疗轨迹区域
    this.drawHealTrailAreas()

    // 绘制粒子效果
    this.effectsSystem.drawParticleEffects(this.ctx)
    
    // 绘制爆炸效果
    this.projectileVisualSystem.drawExplosions(this.ctx)
    
    // 绘制基础粒子
    this.visualRenderer.drawParticles(this.ctx)

    this.ctx.restore()

    // 绘制UI（不受屏幕效果影响）
    this.drawUI()
    
    // 绘制屏幕消息和武器模式指示器
    this.drawScreenMessages()
    this.drawWeaponModeIndicator()
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
    
    // 显示金币（与分数一致增长，仅用于购买）
    const gold = this.gameState?.player?.gold ?? 0
    this.ctx.fillText('金币: ' + gold, 220, 25)
    
    // 显示时间
    this.ctx.fillText('时间: ' + Math.ceil(this.gameTime), 320, 25)
    
    // 形态大师已删除：不再在HUD中显示其专属属性读数
    
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

  // **关键修复**：保存最高记录到本地存储
  // 注意：数据库保存由GameView.vue中的updateGameState处理，这里只保存到本地存储
  private saveHighestRecords() {
    if (!this.gameState) return
    
    try {
      // 保存到本地存储
      const records = {
        highestScore: this.gameState.highestScore || 0,
        highestLevel: this.gameState.highestLevel || 0,
        longestSurvival: this.gameState.timeRemaining || 0
      }
      localStorage.setItem('gameRecords', JSON.stringify(records))
      console.log('✅ 已保存最高记录到本地存储:', records)
    } catch (error) {
      console.error('保存最高记录失败:', error)
    }
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
    if (!key) return
    switch (key.toLowerCase()) {
      case 'p': case ' ': this.togglePause(); break
      case 'q': case 'tab': 
        // 形态大师：切换武器模式（按Q或Tab键）
        this.toggleWeaponMode()
        break
      // 被动属性选择现在由Vue组件系统处理，不再使用键盘数字键
    }
  }
  
  // 切换武器模式（形态大师）
  toggleWeaponMode() {
    const player = this.gameState?.player as any
    if (!player) return
    
    const bossExclusiveEffects = player.bossExclusiveEffects || []
    if (!bossExclusiveEffects.includes('dual_weapon_modes')) {
      return // 没有形态大师奖励，不处理
    }
    
    // 初始化原始属性值（如果还没有保存）
    if (player.baseDamage === undefined) {
      player.baseDamage = player.damage || 10
      player.baseAttackSpeed = player.attackSpeed || 1.0
    }
    
    // 切换武器模式：0 = 高伤害模式，1 = 高攻速模式
    if (player.weaponMode === undefined) player.weaponMode = 0
    
    const oldMode = player.weaponMode
    player.weaponMode = player.weaponMode === 0 ? 1 : 0
    
    // 根据模式调整属性（基于原始值）
    if (player.weaponMode === 0) {
      // 模式0：高伤害模式（伤害+50%，攻速-30%）
      player.damage = player.baseDamage * 1.5
      player.attackSpeed = player.baseAttackSpeed * 0.7
      console.log('切换到高伤害模式（伤害+50%，攻速-30%）')
    } else {
      // 模式1：高攻速模式（攻速+50%，伤害-20%）
      player.attackSpeed = player.baseAttackSpeed * 1.5
      player.damage = player.baseDamage * 0.8
      console.log('切换到高攻速模式（攻速+50%，伤害-20%）')
    }
    
    // **关键修复**：强制同步到gameState，确保UI能读取到最新值
    if (this.gameState && this.gameState.player) {
      // 直接修改gameState.player的属性
      const gameStatePlayer = this.gameState.player as any
      gameStatePlayer.damage = player.damage
      gameStatePlayer.attackSpeed = player.attackSpeed
      gameStatePlayer.weaponMode = player.weaponMode
      
      // 确保player对象本身也更新（双重保险）
      player.damage = player.damage
      player.attackSpeed = player.attackSpeed
      player.weaponMode = player.weaponMode
      
      console.log(`[模式切换] 已同步到gameState: weaponMode=${player.weaponMode}, damage=${player.damage}, attackSpeed=${player.attackSpeed}`)
      
      // 触发响应式更新（如果使用Vue）
      if ((this.gameState as any).__ob__) {
        (this.gameState as any).__ob__.dep.notify()
      }
    }
    
    // 添加切换特效（增强版）
    this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
      count: 50,
      spread: 360,
      speed: { min: 3, max: 8 },
      size: { min: 5, max: 12 },
      life: { min: 400, max: 800 },
      colors: player.weaponMode === 0 ? ['#FF0000', '#FF6600', '#FFAA00'] : ['#00AAFF', '#00FF88', '#88FFFF'],
      fadeOut: true
    })
    
    // 添加屏幕提示
    const modeName = player.weaponMode === 0 ? '高伤害模式' : '高攻速模式'
    const modeDesc = player.weaponMode === 0 ? '伤害+50%，攻速-30%' : '攻速+50%，伤害-20%'
    this.addScreenMessage(modeName, modeDesc, player.weaponMode === 0 ? '#FF6600' : '#00AAFF', 2000)
  }
  
  // 添加屏幕消息提示
  private screenMessages: Array<{ text: string, desc: string, color: string, life: number, y: number }> = []
  
  private addScreenMessage(text: string, desc: string, color: string, duration: number = 2000) {
    this.screenMessages.push({
      text,
      desc,
      color,
      life: duration,
      y: this.canvas.height / 2 - 50
    })
  }
  
  private updateScreenMessages(deltaTime: number) {
    for (let i = this.screenMessages.length - 1; i >= 0; i--) {
      const msg = this.screenMessages[i]
      msg.life -= deltaTime
      if (msg.life <= 0) {
        this.screenMessages.splice(i, 1)
      }
    }
  }
  
  private drawScreenMessages() {
    this.screenMessages.forEach((msg, index) => {
      const alpha = Math.min(1, msg.life / 500) // 淡出效果
      const y = msg.y - index * 60
      
      // 背景
      this.ctx.fillStyle = `rgba(0, 0, 0, ${0.7 * alpha})`
      this.ctx.fillRect(
        this.canvas.width / 2 - 150,
        y - 25,
        300,
        50
      )
      
      // 文字
      this.ctx.fillStyle = msg.color
      this.ctx.font = 'bold 24px Arial'
      this.ctx.textAlign = 'center'
      this.ctx.textBaseline = 'middle'
      this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
      this.ctx.shadowBlur = 4
      this.ctx.fillText(msg.text, this.canvas.width / 2, y - 5)
      
      // 描述
      this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      this.ctx.font = '16px Arial'
      this.ctx.fillText(msg.desc, this.canvas.width / 2, y + 15)
      this.ctx.shadowBlur = 0
    })
  }
  // 绘制当前武器模式指示器（持续显示）
  private drawWeaponModeIndicator() {
    // **修复**：直接从gameState读取，确保获取最新值
    const player = this.gameState?.player as any
    if (!player || !player.bossExclusiveEffects?.includes('dual_weapon_modes')) {
      return
    }
    
    // **修复**：确保读取最新的weaponMode值，如果未定义则默认为0
    // **关键修复**：强制从player对象读取，确保获取最新值
    const weaponMode = (player.weaponMode !== undefined && player.weaponMode !== null) ? player.weaponMode : 0
    const modeName = weaponMode === 0 ? '高伤害模式' : '高攻速模式'
    const modeDesc = weaponMode === 0 ? '伤害+50% 攻速-30%' : '攻速+50% 伤害-20%'
    const modeColor = weaponMode === 0 ? '#FF6600' : '#00AAFF'
    
    // **修复**：调整位置，避免和按钮重叠
    // 按钮在右上角（right: 20px, top: 20px），指示器放在右上角下方，避免重叠
    // 按钮区域大约在右上角 20-80px 高度，指示器放在 100px 以下
    const x = this.canvas.width - 210
    const y = 100  // 放在按钮下方，避免重叠
    
    // 背景框
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    this.ctx.fillRect(x - 10, y - 30, 190, 60)
    this.ctx.strokeStyle = modeColor
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(x - 10, y - 30, 190, 60)
    
    // 模式名称
    this.ctx.fillStyle = modeColor
    this.ctx.font = 'bold 18px Arial'
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'top'
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    this.ctx.shadowBlur = 4
    this.ctx.fillText('⚔️ ' + modeName, x, y - 5)
    
    // 模式描述
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    this.ctx.font = '14px Arial'
    this.ctx.fillText(modeDesc, x, y + 20)
    this.ctx.shadowBlur = 0
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
    
    // **修复**：时间到0时进入下一层，但只触发一次，并且确保时间真正到0（而不是负数或接近0）
    // 使用更严格的判断条件，避免浮点数误差导致提前触发
    if (this.gameTime <= 0.1 && !this.hasTriggeredLevelComplete && !this.isInNextLevel) {
      // 确保时间真正到0或接近0（允许0.1秒的误差）
      if (actualElapsedSeconds >= levelTime - 0.1) {
        console.log(`[updateGameTime] 时间到0，触发关卡切换，当前关卡: ${this.currentLevel}, 实际经过时间: ${actualElapsedSeconds.toFixed(2)}s, 关卡时间: ${levelTime}s`)
        this.hasTriggeredLevelComplete = true
        this.nextLevel()
      }
    }
  }

  // 更新玩家移动
  private updatePlayerMovement(deltaTime?: number) {
    // 保存上一帧位置（用于计算移动方向，供phantom背刺检测使用）
    this.playerLastX = this.playerX
    this.playerLastY = this.playerY
    
    // 从gameState获取移动速度
    // **修复**：确保moveSpeed不会因为undefined或0而被重置
    const baseMoveSpeedPerSecond = 360 // 进一步提升基础移动速度（像素/秒），显著更快
    const moveSpeedMultiplier = this.gameState?.player?.moveSpeed ?? 1.0 // 默认1.0（100%），如果未定义或无效则使用1.0
    const moveSpeed = baseMoveSpeedPerSecond * moveSpeedMultiplier
    
    // **调试**：如果moveSpeed异常，输出日志
    if (moveSpeedMultiplier < 0.5 || moveSpeedMultiplier > 2.0) {
      console.warn(`⚠️ 异常移动速度倍数: ${moveSpeedMultiplier}, 当前关卡: ${this.currentLevel}`)
    }
    
    // 限制dt范围，避免极端帧时间影响；不再做EMA，减少输入延迟
    let dt = (deltaTime ?? 16.67) / 1000
    dt = Math.max(0.005, Math.min(0.05, dt))
    
    // 读取输入方向
    let inputX = 0
    let inputY = 0
    if (this.keys['w'] || this.keys['arrowup']) inputY -= 1
    if (this.keys['s'] || this.keys['arrowdown']) inputY += 1
    if (this.keys['a'] || this.keys['arrowleft']) inputX -= 1
    if (this.keys['d'] || this.keys['arrowright']) inputX += 1
    // 对角线归一化，保证各方向速度一致
    if (inputX !== 0 && inputY !== 0) {
      const invSqrt2 = 0.7071067811865476
      inputX *= invSqrt2
      inputY *= invSqrt2
    }
    
    // 目标速度（像素/秒）- 直接跟随输入，消除延迟
    const targetVelX = inputX * moveSpeed
    const targetVelY = inputY * moveSpeed
    this.playerVelX = targetVelX
    this.playerVelY = targetVelY
    this.playerX += targetVelX * dt
    this.playerY += targetVelY * dt
    
    // 边界检查
    this.playerX = Math.max(20, Math.min(this.canvas.width - 20, this.playerX))
    this.playerY = Math.max(20, Math.min(this.canvas.height - 20, this.playerY))
    
    // **新增**：治疗轨迹效果 - 移动时留下治疗区域
    const specialEffects = (this.gameState?.player as any)?.specialEffects || []
    if (specialEffects.includes('move_heal_trail')) {
      const now = Date.now()
      const isMoving = inputX !== 0 || inputY !== 0
      
      if (isMoving && now >= this.healTrailCooldown) {
        // 检查是否移动了足够距离（避免在同一个位置重复创建）
        // **修复**：减少最小距离，让治疗区域更容易创建，更密集
        const minDistance = specialEffects.includes('heal_trail_enhanced') ? 20 : 25 // 增强后20像素，基础25像素
        if (this.lastHealTrailPosition) {
          const dx = this.playerX - this.lastHealTrailPosition.x
          const dy = this.playerY - this.lastHealTrailPosition.y
          const distSq = dx * dx + dy * dy
          
          if (distSq < minDistance * minDistance) {
            // 距离太近，不创建新的治疗区域
            return
          }
        }
        
        // 创建治疗区域
        // **修复**：增加基础持续时间，让玩家有足够时间回血
        let healRadius = 40 // 治疗区域半径
        let healPerSecond = 2 // 每秒回复2点生命
        let duration = 8000 // 持续8秒（从5秒增加到8秒，让玩家有足够时间回血）
        
        // **新增**：检查是否有治愈之路增强效果
        const hasEnhanced = specialEffects.includes('heal_trail_enhanced')
        if (hasEnhanced) {
          duration += 3000 // 持续时间+3秒（总共11秒）
          healRadius = Math.floor(healRadius * 1.5) // 治疗范围+50%
          healPerSecond += 2 // 每秒回复+2（总共4点/秒）
        }
        
        this.healTrailAreas.push({
          x: this.playerX,
          y: this.playerY,
          radius: healRadius,
          healPerSecond: healPerSecond,
          life: duration,
          maxLife: duration,
          createdAt: now
        })
        
        // 限制治疗区域数量（最多20个）
        if (this.healTrailAreas.length > 20) {
          this.healTrailAreas.shift()
        }
        
        // 更新上次位置和冷却时间
        this.lastHealTrailPosition = { x: this.playerX, y: this.playerY }
        // **修复**：减少冷却时间，让治疗区域更密集，更容易回血
        const cooldown = specialEffects.includes('heal_trail_enhanced') ? 150 : 200
        this.healTrailCooldown = now + cooldown // 增强后150ms，基础200ms冷却
        
        // 添加创建特效 - 绿色光环
        this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
          count: 20,
          colors: ['#00ff88', '#00ffaa', '#88ffaa', '#ffffff'],
          size: { min: 3, max: 8 },
          speed: { min: 20, max: 60 },
          life: { min: 500, max: 1000 },
          spread: 360
        })
      }
    }
  }

  // 更新生命回复
  private updateHealthRegen() {
    const now = Date.now()
    
    // **新增**：更新治疗轨迹区域
    this.healTrailAreas = this.healTrailAreas.filter(area => {
      area.life -= 16.67 // 假设60FPS，每帧减少约16.67ms
      return area.life > 0
    })
    
    // 检查玩家是否在治疗区域内
    for (const area of this.healTrailAreas) {
      const dx = this.playerX - area.x
      const dy = this.playerY - area.y
      const distSq = dx * dx + dy * dy
      const radiusSq = area.radius * area.radius
      
      if (distSq <= radiusSq) {
        // 玩家在治疗区域内，每秒回复生命
        const healAmount = (area.healPerSecond * 16.67) / 1000 // 每帧回复量
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
      }
    }
    
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
      
      // **关键修复**：检查是否有Boss被击败（不再限制为特定层，只要击败Boss就有奖励）
      // 通过检查bossDefeated标志来判断是否有Boss被击败
      if (this.gameState) {
        const bossDefeatedValue = this.gameState.bossDefeated
        const bossWasDefeated = bossDefeatedValue === previousLevel && bossDefeatedValue !== undefined
        const isBossLevel = [5, 10, 15, 20].includes(previousLevel) || bossWasDefeated
        
        console.log(`[nextLevel-Engine] Boss检查：previousLevel=${previousLevel}, currentLevel=${this.currentLevel}, bossDefeated=${bossDefeatedValue}, bossWasDefeated=${bossWasDefeated}, isBossLevel=${isBossLevel}`)
        console.log(`[nextLevel-Engine] 所有Boss类型: ${this.enemies.filter(e => e.type && ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander'].includes(e.type)).map(e => e.type).join(', ')}`)
        
        if (bossWasDefeated) {
          console.log(`[nextLevel-Engine] ✅ 第${previousLevel}层Boss被击败，保留bossDefeated=${bossDefeatedValue}标志，供回调使用`)
          // **关键修复**：确保bossDefeated标志在回调前不被清除，让store的nextLevel()可以读取
        } else if (isBossLevel) {
          // 如果本层是Boss层但没有击杀Boss（时间到了），重置hasDefeatedBoss和额外属性选择标志
          console.log(`[nextLevel-Engine] Boss层(${previousLevel})未击杀Boss（时间到），重置hasDefeatedBoss标志`)
          this.gameState.hasDefeatedBoss = false
          this.gameState.extraAttributeSelect = false // **关键修复**：同时重置额外属性选择标志
        } else {
          // **关键修复**：非Boss层进入下一层时，如果之前有未使用的额外属性选择标志，也要清除
          // 避免在非Boss层显示额外属性选择
          if (this.gameState.extraAttributeSelect && !this.gameState.hasDefeatedBoss) {
            console.log(`[nextLevel-Engine] 非Boss层，清除无效的额外属性选择标志`)
            this.gameState.extraAttributeSelect = false
          }
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
      // **关键修复**：确保清空所有Boss相关数据，防止内存泄漏
      // 使用传统for循环，限制检查数量
      const maxBossCheck = Math.min(this.enemies.length, 10) // 最多检查10个（一般只有1个Boss）
      for (let i = 0; i < maxBossCheck; i++) {
        const enemy = this.enemies[i]
        if (enemy && enemy.type === 'fortress_guard') {
          const hiveMother = enemy as any
          if (hiveMother.pendingEggs) hiveMother.pendingEggs = []
          if (hiveMother.stormZones) hiveMother.stormZones = []
        }
      }
      this.enemies = []
      this.pendingEnemies = [] // 清空待添加队列
      this.projectiles = []
      this.effects = []
      // 重置本层Boss生成标记
      this.bossSpawnedInLevel = false
    this.bossCountInLevel = 0
    this.targetBossCount = 1
      this.bossCountInLevel = 0
      this.targetBossCount = 1
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

  // **关键修复**：强制清理所有累积的资源，防止长时间运行后卡顿
  private forceCleanup() {
    // 清理过期的投射物（超出边界或存活时间过长）
    const margin = 200
    const removedProjectiles: string[] = []
    this.projectiles = this.projectiles.filter(p => {
      // 检查是否超出边界太远
      if (p.x < -margin || p.x > this.canvas.width + margin ||
          p.y < -margin || p.y > this.canvas.height + margin) {
        if (p.id) {
          removedProjectiles.push(p.id)
        }
        return false
      }
      return true
    })
    // **修复**：清理被移除投射物的拖尾效果
    removedProjectiles.forEach(id => {
      this.projectileVisualSystem.clearProjectileTrails(id)
    })
    
    // 限制投射物数量（更激进）
    if (this.projectiles.length > this.MAX_PROJECTILES * 0.8) {
      const targetCount = Math.floor(this.MAX_PROJECTILES * 0.8)
      const removeCount = this.projectiles.length - targetCount
      // **修复**：清理被移除投射物的拖尾效果（使用投射物的唯一ID）
      for (let i = 0; i < removeCount; i++) {
        const projectile = this.projectiles[i]
        if (projectile && projectile.id) {
          this.projectileVisualSystem.clearProjectileTrails(projectile.id)
        }
      }
      this.projectiles = this.projectiles.slice(-targetCount)
    }
    
    // 清理过期的特效
    if (this.effects.length > 50) {
      this.effects = this.effects.filter(e => e.life > 0).slice(-50)
    }
    
    // 清理过期的掉落物
    if (this.droppedItems.length > this.MAX_DROPPED_ITEMS * 0.8) {
      this.droppedItems = this.droppedItems.slice(-Math.floor(this.MAX_DROPPED_ITEMS * 0.8))
    }
    
    // **关键修复**：清理Boss的累积数据，限制检查数量
    const maxBossCheck = Math.min(this.enemies.length, 10) // 最多检查10个
    for (let i = 0; i < maxBossCheck; i++) {
      const enemy = this.enemies[i]
      if (enemy && enemy.type === 'fortress_guard') {
        const hiveMother = enemy as any
        // **关键修复**：使用更严格的限制（8个而不是10个）
        if (hiveMother.pendingEggs && hiveMother.pendingEggs.length > 8) {
          hiveMother.pendingEggs = hiveMother.pendingEggs.slice(-8)
        }
        if (hiveMother.stormZones && hiveMother.stormZones.length > 2) {
          hiveMother.stormZones = hiveMother.stormZones.slice(-2)
        }
      }
    }
    
    // 清理敌人数量（如果超过限制）
    if (this.enemies.length > this.MAX_ENEMIES * 0.9) {
      // 删除最旧的敌人（非Boss）
      const bossTypes = ['infantry_captain', 'fortress_guard', 'void_shaman', 'legion_commander']
      const nonBossEnemies = this.enemies.filter((e, i) => !e.type || !bossTypes.includes(e.type))
      if (nonBossEnemies.length > this.MAX_ENEMIES * 0.7) {
        // 删除最旧的10%普通敌人
        const toDelete = Math.floor(nonBossEnemies.length * 0.1)
        for (let i = 0; i < toDelete && this.enemies.length > this.MAX_ENEMIES * 0.8; i++) {
          const index = this.enemies.findIndex(e => e === nonBossEnemies[i])
          if (index >= 0) {
            this.enemies.splice(index, 1)
          }
        }
      }
    }
  }

  // **新增**：获得道具时的特效反馈
  public onItemAcquired(reward: any) {
    if (!reward) return
    
    const quality = reward.color || 'green'
    let particleColors: string[] = []
    let messageColor = '#ffffff'
    
    // 根据品质设置不同的特效颜色
    switch (quality) {
      case 'green':
        particleColors = ['#00ff00', '#88ff88', '#ffffff', '#44ff44']
        messageColor = '#00ff00'
        break
      case 'blue':
        particleColors = ['#00aaff', '#44ddff', '#ffffff', '#88ccff']
        messageColor = '#00aaff'
        break
      case 'purple':
        particleColors = ['#aa00ff', '#cc44ff', '#ffffff', '#dd88ff']
        messageColor = '#aa00ff'
        break
      case 'gold':
        particleColors = ['#ffaa00', '#ffcc44', '#ffffff', '#ffdd88']
        messageColor = '#ffaa00'
        break
    }
    
    // 创建获得道具的特效
    this.effectsSystem.createParticleEffect('magic_burst', this.playerX, this.playerY, {
      count: 50,
      colors: particleColors,
      size: { min: 4, max: 10 },
      speed: { min: 30, max: 100 },
      life: { min: 800, max: 1500 },
      spread: 360
    })
    
    // 添加屏幕消息提示
    this.addScreenMessage('获得道具', reward.name || '未知道具', messageColor, 2500)
    
    // 播放获得道具音效
    this.audioSystem.playSoundEffect('item_pickup', { volume: 0.8 })
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
    if (level < 1) {
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
    this.bossCountInLevel = 0
    this.targetBossCount = 1
    
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
    this.bossCountInLevel = 0
    this.targetBossCount = 1
    
    // 更新游戏状态中的层数
    if (this.gameState) {
      this.gameState.level = level
      this.gameState.timeRemaining = this.getLevelTime(level)
    }
    
    console.log('跳转到第', this.currentLevel, '层，血量回满，位置重置，敌人清空（敌人将自然生成）')
  }
}
