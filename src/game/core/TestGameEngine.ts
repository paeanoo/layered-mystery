export class TestGameEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private onLevelComplete?: () => void // 关卡完成回调
  private gameState: any = null // 游戏状态引用
  private playerX = 100
  private playerY = 100
  private playerAngle = 0
  private enemies: Array<{ x: number; y: number; size: number; color: string; health: number; maxHealth: number; type?: string; icdUntil?: number }> = []
  private projectiles: Array<{ x: number; y: number; vx: number; vy: number; damage: number; isCrit: boolean; life: number; pierce: number; maxPierce: number }> = []
  private effects: Array<{ x: number; y: number; type: string; life: number; size: number }> = []
  private enemySpawnTimer = 0
  private attackTimer = 0
  private attackCooldown = 100 // 攻击间隔（毫秒）- 进一步提高攻击速度
  private score = 0
  private playerHealth = 100
  private playerMaxHealth = 100
  private playerIFrameUntil = 0 // 玩家无敌帧结束时间戳（毫秒）
  private playerDamageHistory: Array<{ time: number; damage: number }> = [] // 伤害堆叠窗口历史
  private isPaused = false
  private gameTime = 30 // 游戏时间（秒）
  private gameStartTime = 0 // 游戏开始时间
  private pausedTime = 0 // 暂停时累计的时间
  private lastPauseTime = 0 // 最后一次暂停的时间戳
  private keys: { [key: string]: boolean } = {} // 键盘状态跟踪
  private currentLevel = 1 // 当前层数
  private showPassiveSelection = false // 是否显示被动属性选择
  private passiveOptions: Array<{id: string, name: string, description: string}> = [] // 被动属性选项
  private lifestealPercent = 0 // 生命偷取百分比
  private autoRegenAmount = 0 // 自动回复生命值
  private regenTimer = 0 // 回复计时器
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
    'runner': 600,   // 疾跑
    'shooter': 800,  // 投射
    'shield': 800,   // 护盾
    'shielded': 800, // 护盾（别名）
    'brute': 900,    // 肉盾
    'exploder': 0,   // 爆裂（只有爆炸伤害，不吃接触循环）
  }

  // 接触伤害倍数
  private readonly ENEMY_DMG_MULTIPLIER: Record<string, number> = {
    'grunt': 1.0,    // 默认
    'runner': 1.05,  // ×1.05
    'shooter': 0.9,  // ×0.9（顶身）
    'brute': 1.25,   // ×1.25
    'boss': 1.6,     // ×1.6
  }

  constructor(canvas: HTMLCanvasElement, onLevelComplete?: () => void, gameState?: any) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onLevelComplete = onLevelComplete
    this.gameState = gameState
    this.setupCanvas()
    this.setupEventListeners()
    this.spawnEnemy()
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
    // 基础伤害: 6 + (层-1) × 0.7（11层后改 × 1.0）
    const baseDamage = 6 + (layer - 1) * (layer < 11 ? 0.7 : 1.0)
    
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
  private handleContactDamage(enemy: { type?: string; icdUntil?: number }, layer: number) {
    const now = Date.now()
    const enemyType = enemy.type || 'grunt'
    const enemyICD = this.ENEMY_ICD[enemyType] || 750
    
    // 跳过 exploder（只有爆炸伤害，不吃接触循环）
    if (enemyType === 'exploder') return
    
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
  }

  // 更新游戏状态引用
  updateGameState(gameState: any) {
    this.gameState = gameState
  }

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
    this.playerIFrameUntil = 0 // 重置无敌帧
    this.playerDamageHistory = [] // 重置伤害历史
    this.score = 0
    this.gameTime = 30
    this.gameStartTime = Date.now()
    this.pausedTime = 0
    this.lastPauseTime = 0
    this.hasTriggeredLevelComplete = false // 重置关卡完成标志
    this.gameLoop()
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  private gameLoop = () => {
    if (!this.isPaused) {
      this.update()
    }
    this.render()
    this.animationId = requestAnimationFrame(this.gameLoop)
  }

  private update() {
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
    
    // 处理玩家移动
    this.updatePlayerMovement()
    
    // 处理生命回复
    this.updateHealthRegen()
    
    // 更新敌人
    this.enemies.forEach((enemy, index) => {
      // 简单AI：朝玩家移动
      const dx = this.playerX - enemy.x
      const dy = this.playerY - enemy.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        enemy.x += (dx / distance) * 1
        enemy.y += (dy / distance) * 1
      }

      // 检查与玩家的碰撞
      const playerDistance = Math.sqrt(
        (enemy.x - this.playerX) ** 2 + (enemy.y - this.playerY) ** 2
      )
      
      // 碰撞检测（接触伤害范围：玩家半径15 + 敌人尺寸）
      const contactDistance = 15 + (enemy.size || 20)
      
      if (playerDistance < contactDistance) {
        // 使用新的间断结算系统
        this.handleContactDamage(enemy, this.currentLevel)
      }
    })

    // 更新投射物
    this.updateProjectiles()

    // 更新特效
    this.updateEffects()

    // 自动攻击
    this.handleAutoAttack()

    // 生成新敌人（根据层数和当前敌人数量调整生成速率）
    this.enemySpawnTimer++
    
    // 计算生成间隔：基础时间 + 敌人过多时的延迟
    const baseSpawnInterval = 60 - (this.currentLevel - 1) * 2 // 随层数加快
    const maxSpawnInterval = 120
    const enemyCountPenalty = this.enemies.length * 5 // 敌人越多，生成越慢
    const spawnInterval = Math.min(maxSpawnInterval, baseSpawnInterval + enemyCountPenalty)
    
    // 目标敌人数量：随层数增加
    const targetEnemyCount = Math.min(20, 5 + this.currentLevel * 2)
    
    if (this.enemySpawnTimer >= spawnInterval && this.enemies.length < targetEnemyCount) {
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
    this.enemies.push(enemy)
  }

  // 根据层数创建不同难度的敌人
  private createEnemyByLevel(layer: number, x: number, y: number) {
    // 基础属性随层数增长
    const healthMultiplier = 1 + (layer - 1) * 0.15
    const baseHealth = 30 * healthMultiplier
    const baseSize = 16 + layer * 0.5
    
    // 选择敌人类型（根据层数逐步解锁）
    let enemyType = 'grunt'
    let color = '#ff4444'
    let size = baseSize
    let health = baseHealth
    
    const roll = Math.random()
    
    // 精英概率：随层数增加（最多30%）
    const eliteChance = Math.min(0.3, 0.05 + (layer - 1) * 0.015)
    const isElite = roll < eliteChance
    
    if (isElite) {
      // 精英敌人：更高的血量和伤害
      health = baseHealth * 2.5
      size = baseSize * 1.3
      
      // 精英敌人随机类型
      const eliteTypes = ['elite_boss', 'elite_tank', 'elite_speed', 'elite_assassin']
      enemyType = eliteTypes[Math.floor(Math.random() * eliteTypes.length)]
      
      // 精英敌人特殊颜色
      switch (enemyType) {
        case 'elite_boss':
          color = '#ff0000' // 红色Boss
          size = baseSize * 1.5
          health = baseHealth * 3
          break
        case 'elite_tank':
          color = '#884400' // 棕色坦克
          size = baseSize * 1.4
          health = baseHealth * 3.5
          break
        case 'elite_speed':
          color = '#00ff00' // 绿色高速
          size = baseSize * 1.1
          health = baseHealth * 1.8
          break
        case 'elite_assassin':
          color = '#ff00ff' // 紫色刺客
          size = baseSize * 0.9
          health = baseHealth * 2
          break
      }
    } else {
      // 普通敌人类型（根据层数逐步解锁）
      let typeChance = Math.random()
      
      if (layer >= 12) {
        // 12层以上：所有类型
        if (typeChance < 0.15) enemyType = 'split' // 分裂型
        else if (typeChance < 0.30) enemyType = 'hunter' // 追踪型
        else if (typeChance < 0.45) enemyType = 'reflect' // 反射型
        else if (typeChance < 0.60) enemyType = 'support' // 支援型
        else if (typeChance < 0.75) enemyType = 'assassin' // 刺客型
        else if (typeChance < 0.85) enemyType = 'tank' // 坦克型
        else if (typeChance < 0.92) enemyType = 'swarm' // 群体型
        else enemyType = 'ranged' // 远程型
      } else if (layer >= 10) {
        // 10层以上
        if (typeChance < 0.20) enemyType = 'hunter'
        else if (typeChance < 0.40) enemyType = 'reflect'
        else if (typeChance < 0.60) enemyType = 'support'
        else if (typeChance < 0.80) enemyType = 'assassin'
        else enemyType = 'ranged'
      } else if (layer >= 8) {
        // 8层以上
        if (typeChance < 0.15) enemyType = 'support'
        else if (typeChance < 0.35) enemyType = 'assassin'
        else if (typeChance < 0.55) enemyType = 'tank'
        else if (typeChance < 0.75) enemyType = 'ranged'
        else enemyType = 'swarm'
      } else if (layer >= 5) {
        // 5层以上
        if (typeChance < 0.20) enemyType = 'tank'
        else if (typeChance < 0.50) enemyType = 'ranged'
        else if (typeChance < 0.75) enemyType = 'swarm'
        else enemyType = 'runner'
      } else if (layer >= 3) {
        // 3层以上
        if (typeChance < 0.30) enemyType = 'ranged'
        else if (typeChance < 0.60) enemyType = 'runner'
        else enemyType = 'grunt'
      }
      
      // 设置普通敌人颜色和属性
      switch (enemyType) {
        case 'grunt':
          color = '#ff4444'
          health = baseHealth
          break
        case 'runner':
          color = '#ff8888'
          health = baseHealth * 0.7
          size = baseSize * 0.8
          break
        case 'swarm':
          color = '#44ff44'
          health = baseHealth * 0.5
          size = baseSize * 0.7
          break
        case 'ranged':
          color = '#4444ff'
          health = baseHealth * 1.2
          size = baseSize * 0.9
          break
        case 'tank':
          color = '#888888'
          health = baseHealth * 2.5
          size = baseSize * 1.4
          break
        case 'assassin':
          color = '#ff44ff'
          health = baseHealth * 1.1
          size = baseSize * 0.85
          break
        case 'support':
          color = '#ffff44'
          health = baseHealth * 1.3
          size = baseSize * 1.1
          break
        case 'reflect':
          color = '#ff0044'
          health = baseHealth * 1.8
          size = baseSize * 1.2
          break
        case 'hunter':
          color = '#44ffff'
          health = baseHealth * 1.2
          size = baseSize * 0.9
          break
        case 'split':
          color = '#ff44ff'
          health = baseHealth * 2.0
          size = baseSize * 1.3
          break
      }
    }
    
    return {
      x,
      y,
      size: Math.floor(size),
      color,
      health: Math.floor(health),
      maxHealth: Math.floor(health),
      type: enemyType,
      icdUntil: 0
    }
  }

  private updateProjectiles() {
    this.projectiles.forEach((projectile, index) => {
      projectile.x += projectile.vx
      projectile.y += projectile.vy
      projectile.life--

      // 检查与敌人的碰撞
      this.enemies.forEach((enemy, enemyIndex) => {
        const distance = Math.sqrt(
          (projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2
        )
        if (distance < 15 + enemy.size) {
          // 造成伤害
          enemy.health -= projectile.damage
          
          // 生命偷取（从gameState获取）
          const lifestealPercent = this.gameState?.player?.lifesteal || 0
          if (lifestealPercent > 0) {
            const healAmount = Math.floor(projectile.damage * lifestealPercent)
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
          }
          
          // 穿透机制：增加已穿透次数
          projectile.pierce++
          
          // 添加击中特效
          this.addHitEffect(enemy.x, enemy.y, projectile.isCrit)
          
          if (enemy.health <= 0) {
            this.enemies.splice(enemyIndex, 1)
            // 增加分数
            this.score += 10
            // 添加死亡特效
            this.addDeathEffect(enemy.x, enemy.y)
          }
          
          // 如果穿透次数超过最大穿透次数，移除投射物
          if (projectile.pierce > projectile.maxPierce) {
            // 使用标记而不是直接splice，避免修改正在遍历的数组
            projectile.life = 0
          }
        }
      })
    })

    // 移除超出边界或生命结束的投射物
    this.projectiles = this.projectiles.filter(projectile => {
      return projectile.x >= 0 && 
             projectile.x <= this.canvas.width &&
             projectile.y >= 0 && 
             projectile.y <= this.canvas.height &&
             projectile.life > 0
    })
  }

  private handleAutoAttack() {
    // 获取玩家攻击速度属性
    const player = this.gameState?.player || { attackSpeed: 1 }
    // attackSpeed是每秒攻击次数，转换为每帧所需的攻击间隔
    const attacksPerSecond = player.attackSpeed
    const attacksPerFrame = attacksPerSecond / 60 // 假设60fps
    const framesPerAttack = Math.max(1, Math.floor(1 / attacksPerFrame))
    
    this.attackTimer++
    if (this.attackTimer >= framesPerAttack && this.enemies.length > 0) {
      this.attackTimer = 0
      this.shootProjectile()
    }
  }

  private shootProjectile() {
    // 找到最近的敌人
    let nearestEnemy: typeof this.enemies[0] | null = null
    let nearestDistance = Infinity

    this.enemies.forEach(enemy => {
      const distance = Math.sqrt(
        (enemy.x - this.playerX) ** 2 + (enemy.y - this.playerY) ** 2
      )
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = enemy
      }
    })

    if (!nearestEnemy) return
    
    const enemy = nearestEnemy as typeof this.enemies[0]
    const dx = enemy.x - this.playerX
    const dy = enemy.y - this.playerY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      const speed = 12 // 提高投射物速度
      const vx = (dx / distance) * speed
      const vy = (dy / distance) * speed

      // 获取玩家属性
      const player = this.gameState?.player || {
        damage: 20,
        critChance: 0.2,
        projectiles: 1,
        pierce: 0
      }

      // 计算暴击和伤害（使用游戏状态管理中的属性）
      const isCrit = Math.random() < player.critChance
      const damage = isCrit ? player.damage * 2 : player.damage

      // 创建多个投射物（如果玩家有投射物加成）
      for (let i = 0; i < player.projectiles; i++) {
        // 为多个投射物添加角度偏移，使用对称分布
        const angleOffset = (i - (player.projectiles - 1) / 2) * 0.15
        const adjustedVx = vx * Math.cos(angleOffset) - vy * Math.sin(angleOffset)
        const adjustedVy = vx * Math.sin(angleOffset) + vy * Math.cos(angleOffset)

        this.projectiles.push({
          x: this.playerX,
          y: this.playerY,
          vx: adjustedVx,
          vy: adjustedVy,
          damage,
          isCrit,
          life: 60, // 投射物生命周期
          pierce: 0, // 当前穿透次数
          maxPierce: player.pierce // 最大穿透次数
        })
      }
    }

    // 更新玩家朝向
    this.playerAngle = Math.atan2(dy, dx)
  }

  private updateEffects() {
    this.effects.forEach((effect, index) => {
      effect.life--
      effect.size += 0.5 // 特效逐渐变大
    })

    // 移除生命结束的特效
    this.effects = this.effects.filter(effect => effect.life > 0)
  }

  private addHitEffect(x: number, y: number, isCrit: boolean) {
    this.effects.push({
      x,
      y,
      type: isCrit ? 'crit_hit' : 'hit',
      life: 10,
      size: 5
    })
  }

  private addDeathEffect(x: number, y: number) {
    this.effects.push({
      x,
      y,
      type: 'death',
      life: 20,
      size: 10
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
      }

      this.ctx.restore()
    })
  }

  private render() {
    // 清空画布
    this.ctx.fillStyle = '#1a1a1a'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // 绘制投射物
    this.projectiles.forEach(projectile => {
      this.drawProjectile(projectile)
    })

    // 绘制敌人
    this.enemies.forEach(enemy => {
      this.drawEnemy(enemy)
    })

    // 绘制玩家
    this.drawPlayer()

    // 绘制特效
    this.drawEffects()

    // 绘制UI
    this.drawUI()
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

    const isElite = enemy.type && enemy.type.startsWith('elite')
    
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
    if (enemy.type === 'tank' || isElite) {
      // 坦克和精英：圆形，更大更坚固
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
    } else {
      // 普通敌人：不同形状
      if (enemy.type === 'runner' || enemy.type === 'hunter') {
        // 快速型：菱形
        this.ctx.fillStyle = enemy.color
        this.ctx.beginPath()
        this.ctx.moveTo(0, -enemy.size/2)
        this.ctx.lineTo(enemy.size/2, 0)
        this.ctx.lineTo(0, enemy.size/2)
        this.ctx.lineTo(-enemy.size/2, 0)
        this.ctx.closePath()
        this.ctx.fill()
      } else if (enemy.type === 'swarm') {
        // 群体型：小三角
        this.ctx.fillStyle = enemy.color
        this.ctx.beginPath()
        this.ctx.moveTo(0, -enemy.size/2)
        this.ctx.lineTo(enemy.size/2, enemy.size/2)
        this.ctx.lineTo(-enemy.size/2, enemy.size/2)
        this.ctx.closePath()
        this.ctx.fill()
      } else if (enemy.type === 'ranged') {
        // 远程型：六边形
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
      } else {
        // 默认：方形
        this.ctx.fillStyle = enemy.color
        this.ctx.fillRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size)
      }
    }

    // 绘制敌人眼睛
    if (enemy.type !== 'swarm') { // 群体型太小时不画眼睛
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
    if (isElite) {
      this.ctx.font = 'bold 10px Arial'
      this.ctx.fillStyle = '#ffff00'
      this.ctx.textAlign = 'center'
      this.ctx.fillText('★', 0, -enemy.size/2 - 15)
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
    // 从gameState获取移动速度
    const baseMoveSpeed = 3.5 // 从8降低到3.5，减少40%以增加策略性
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
    this.regenTimer++
    
    // 每秒回复一次
    if (this.regenTimer >= 60) {
      this.regenTimer = 0
      
      // 从gameState获取生命回复量
      const regenAmount = this.gameState?.player?.regeneration || 0
      if (regenAmount > 0) {
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + regenAmount)
      }
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
    // 清空所有敌人、投射物和特效
    this.enemies = []
    this.projectiles = []
    this.effects = []
    // 重新生成敌人
    this.spawnEnemy()
    // 重置计时器
    this.enemySpawnTimer = 0
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
    console.log('进入第', this.currentLevel, '层，血量回满，位置重置')
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
