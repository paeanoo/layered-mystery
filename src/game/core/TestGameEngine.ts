export class TestGameEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private onLevelComplete?: () => void // 关卡完成回调
  private gameState: any = null // 游戏状态引用
  private playerX = 100
  private playerY = 100
  private playerAngle = 0
  private enemies: Array<{ x: number; y: number; size: number; color: string; health: number; maxHealth: number }> = []
  private projectiles: Array<{ x: number; y: number; vx: number; vy: number; damage: number; isCrit: boolean; life: number; pierce: number; maxPierce: number }> = []
  private effects: Array<{ x: number; y: number; type: string; life: number; size: number }> = []
  private enemySpawnTimer = 0
  private attackTimer = 0
  private attackCooldown = 100 // 攻击间隔（毫秒）- 进一步提高攻击速度
  private score = 0
  private playerHealth = 100
  private playerMaxHealth = 100
  private isPaused = false
  private showStats = false
  private showPauseStats = false // 暂停时显示属性窗口
  private gameTime = 30 // 游戏时间（秒）
  private gameStartTime = 0 // 游戏开始时间
  private keys: { [key: string]: boolean } = {} // 键盘状态跟踪
  private currentLevel = 1 // 当前层数
  private showPassiveSelection = false // 是否显示被动属性选择
  private passiveOptions: Array<{id: string, name: string, description: string}> = [] // 被动属性选项
  private lifestealPercent = 0 // 生命偷取百分比
  private autoRegenAmount = 0 // 自动回复生命值
  private regenTimer = 0 // 回复计时器
  
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

  constructor(canvas: HTMLCanvasElement, onLevelComplete?: () => void, gameState?: any) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.onLevelComplete = onLevelComplete
    this.gameState = gameState
    this.setupCanvas()
    this.setupEventListeners()
    this.spawnEnemy()
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
    this.score = 0
    this.gameTime = 30
    this.gameStartTime = Date.now()
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
      if (playerDistance < 25) {
        // 玩家受到伤害
        this.playerHealth -= 0.5
        if (this.playerHealth <= 0) {
          this.playerHealth = 0
          // 重置游戏
          this.resetGame()
        }
      }
    })

    // 更新投射物
    this.updateProjectiles()

    // 更新特效
    this.updateEffects()

    // 自动攻击
    this.handleAutoAttack()

    // 生成新敌人
    this.enemySpawnTimer++
    if (this.enemySpawnTimer > 120) { // 每2秒生成一个敌人
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

    this.enemies.push({
      x: x!,
      y: y!,
      size: 20,
      color: '#ff4444',
      health: 30,
      maxHealth: 30
    })
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
          
          // 生命偷取
          if (this.lifestealPercent > 0) {
            const healAmount = Math.floor(projectile.damage * this.lifestealPercent / 100)
            this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + healAmount)
          }
          
          // 穿透机制：如果投射物还有穿透次数，继续飞行
          projectile.pierce++
          if (projectile.pierce > projectile.maxPierce) {
            this.projectiles.splice(index, 1)
          }
          
          // 添加击中特效
          this.addHitEffect(enemy.x, enemy.y, projectile.isCrit)
          
          if (enemy.health <= 0) {
            this.enemies.splice(enemyIndex, 1)
            // 增加分数
            this.score += 10
            // 添加死亡特效
            this.addDeathEffect(enemy.x, enemy.y)
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
    const actualCooldown = Math.max(50, this.attackCooldown / player.attackSpeed)
    
    this.attackTimer++
    if (this.attackTimer >= actualCooldown && this.enemies.length > 0) {
      this.attackTimer = 0
      this.shootProjectile()
    }
  }

  private shootProjectile() {
    // 找到最近的敌人
    let nearestEnemy = null
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

    if (nearestEnemy) {
      const dx = nearestEnemy.x - this.playerX
      const dy = nearestEnemy.y - this.playerY
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
          // 为多个投射物添加角度偏移
          const angleOffset = i > 0 ? (i - 1) * 0.3 - 0.3 : 0
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

        // 更新玩家朝向
        this.playerAngle = Math.atan2(dy, dx);
      }
    }
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

  private drawEnemy(enemy: { x: number; y: number; size: number; color: string; health: number; maxHealth: number }) {
    // 保存上下文
    this.ctx.save()
    this.ctx.translate(enemy.x, enemy.y)

    // 绘制敌人身体（方形，更邪恶的外观）
    this.ctx.fillStyle = enemy.color
    this.ctx.fillRect(-enemy.size/2, -enemy.size/2, enemy.size, enemy.size)

    // 绘制敌人眼睛（红色小点）
    this.ctx.fillStyle = '#ff0000'
    this.ctx.beginPath()
    this.ctx.arc(-enemy.size/4, -enemy.size/4, 2, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.beginPath()
    this.ctx.arc(enemy.size/4, -enemy.size/4, 2, 0, Math.PI * 2)
    this.ctx.fill()

    // 绘制生命值条
    const barWidth = enemy.size
    const barHeight = 4
    const healthPercent = enemy.health / enemy.maxHealth

    this.ctx.fillStyle = '#ff4444'
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 8, barWidth, barHeight)

    this.ctx.fillStyle = '#ffaa00'
    this.ctx.fillRect(-barWidth/2, -enemy.size/2 - 8, barWidth * healthPercent, barHeight)

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
    this.ctx.fillText('时间: ' + this.gameTime, 220, 25)
    
    // 显示暂停状态
    if (this.isPaused) {
      this.ctx.fillStyle = '#ff4444'
      this.ctx.font = 'bold 24px Arial'
      this.ctx.fillText('游戏暂停 - 按P或空格键继续', this.canvas.width/2 - 150, this.canvas.height/2)
    }
    
    // 绘制生命值条
    this.drawHealthBar()
    
    // 绘制属性面板
    if (this.showStats) {
      this.drawStatsPanel()
    }
    
    // 被动属性选择界面现在由Vue组件系统处理，不再在Canvas中绘制
    
    // 绘制暂停属性窗口
    if (this.showPauseStats) {
      this.drawPauseStatsWindow()
    }
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

  private drawStatsPanel() {
    const panelX = this.canvas.width - 250
    const panelY = 50
    const panelWidth = 230
    const panelHeight = 300

    // 绘制面板背景
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight)

    // 绘制面板边框
    this.ctx.strokeStyle = '#00ff88'
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight)

    // 绘制标题
    this.ctx.fillStyle = '#00ff88'
    this.ctx.font = 'bold 20px Arial'
    this.ctx.fillText('角色属性', panelX + 10, panelY + 25)

    // 绘制属性信息
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '16px Arial'
    let yOffset = 50

    const stats = [
      `生命值: ${Math.ceil(this.playerHealth)}/${this.playerMaxHealth}`,
      `攻击力: 20`,
      `攻击速度: ${(1000/this.attackCooldown).toFixed(1)}/秒`,
      `暴击率: 20%`,
      `移动速度: 8像素/帧`,
      `当前分数: ${this.score}`,
      `击败敌人: ${Math.floor(this.score/10)}`,
      `投射物数量: ${this.projectiles.length}`,
      `敌人数量: ${this.enemies.length}`,
      `特效数量: ${this.effects.length}`
    ]

    stats.forEach(stat => {
      this.ctx.fillText(stat, panelX + 10, panelY + yOffset)
      yOffset += 20
    })

    // 绘制操作提示
    this.ctx.fillStyle = '#ffff00'
    this.ctx.font = '14px Arial'
    this.ctx.fillText('按Tab键关闭属性面板', panelX + 10, panelY + panelHeight - 20)
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

  // 处理键盘输入（特殊按键）
  handleKeyDown(key: string) {
    switch (key.toLowerCase()) {
      case 'p': case ' ': this.togglePause(); break
      case 'tab': this.toggleStats(); break
      // 被动属性选择现在由Vue组件系统处理，不再使用键盘数字键
    }
  }

  // 暂停/继续游戏
  togglePause() {
    this.isPaused = !this.isPaused
    this.showPauseStats = this.isPaused // 暂停时显示属性窗口
    console.log('游戏', this.isPaused ? '暂停' : '继续')
  }

  // 切换属性显示
  toggleStats() {
    this.showStats = !this.showStats
  }

  // 更新游戏时间
  private updateGameTime() {
    const currentTime = Date.now()
    const elapsedSeconds = Math.floor((currentTime - this.gameStartTime) / 1000)
    this.gameTime = Math.max(0, 30 - elapsedSeconds)
    
    // 时间到0时进入下一层
    if (this.gameTime <= 0) {
      this.nextLevel()
    }
  }

  // 更新玩家移动
  private updatePlayerMovement() {
    const moveSpeed = 8 // 每帧移动距离
    
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
      
      // 自动回复
      if (this.autoRegenAmount > 0) {
        this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + this.autoRegenAmount)
      }
    }
  }

  // 进入下一层
  private nextLevel() {
    this.currentLevel++
    // 通知Vue组件系统处理被动属性选择
    if (this.onLevelComplete) {
      this.onLevelComplete()
    }
    // 重置时间但保持游戏状态
    this.gameTime = 30
    this.gameStartTime = Date.now()
    console.log('进入第', this.currentLevel, '层')
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

  // 绘制暂停属性窗口
  private drawPauseStatsWindow() {
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2
    const windowWidth = 700
    const windowHeight = 600
    
    // 绘制半透明背景覆盖层
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
    // 绘制窗口阴影
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    this.ctx.fillRect(centerX - windowWidth/2 + 8, centerY - windowHeight/2 + 8, windowWidth, windowHeight)
    
    // 绘制窗口背景
    this.ctx.fillStyle = 'rgba(15, 15, 15, 0.98)'
    this.ctx.fillRect(centerX - windowWidth/2, centerY - windowHeight/2, windowWidth, windowHeight)
    
    // 绘制窗口边框（渐变效果）
    const gradient = this.ctx.createLinearGradient(centerX - windowWidth/2, centerY - windowHeight/2, centerX + windowWidth/2, centerY + windowHeight/2)
    gradient.addColorStop(0, '#00ff88')
    gradient.addColorStop(0.5, '#00cc66')
    gradient.addColorStop(1, '#00ff88')
    this.ctx.strokeStyle = gradient
    this.ctx.lineWidth = 4
    this.ctx.strokeRect(centerX - windowWidth/2, centerY - windowHeight/2, windowWidth, windowHeight)
    
    // 绘制内边框
    this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)'
    this.ctx.lineWidth = 1
    this.ctx.strokeRect(centerX - windowWidth/2 + 4, centerY - windowHeight/2 + 4, windowWidth - 8, windowHeight - 8)
    
    // 绘制标题背景
    this.ctx.fillStyle = 'rgba(0, 255, 136, 0.1)'
    this.ctx.fillRect(centerX - windowWidth/2 + 10, centerY - windowHeight/2 + 10, windowWidth - 20, 50)
    
    // 绘制标题
    this.ctx.fillStyle = '#00ff88'
    this.ctx.font = 'bold 32px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.fillText('角色属性详情', centerX, centerY - 220)
    
    // 绘制属性信息 - 使用更好的布局避免重叠
    let yOffset = centerY - 160
    const leftColumn = centerX - 280
    const rightColumn = centerX + 20
    const lineHeight = 32 // 增加行高避免重叠
    
    // 左列属性（游戏状态）
    this.drawStatItem(leftColumn, yOffset, '当前层数', `${this.currentLevel}`, '#00ff88')
    yOffset += lineHeight
    this.drawStatItem(leftColumn, yOffset, '当前分数', `${this.score}`, '#ffffff')
    yOffset += lineHeight
    this.drawStatItem(leftColumn, yOffset, '剩余时间', `${this.gameTime}秒`, '#ffff00')
    yOffset += lineHeight
    this.drawStatItem(leftColumn, yOffset, '击败敌人', `${Math.floor(this.score/10)}`, '#ffffff')
    yOffset += lineHeight
    this.drawStatItem(leftColumn, yOffset, '当前敌人数量', `${this.enemies.length}`, '#ff4444')
    yOffset += lineHeight
    this.drawStatItem(leftColumn, yOffset, '投射物数量', `${this.projectiles.length}`, '#4488ff')
    
    // 右列属性（角色属性）
    yOffset = centerY - 160
    this.drawStatItem(rightColumn, yOffset, '伤害', '20', '#ff4444')
    yOffset += lineHeight
    this.drawStatItem(rightColumn, yOffset, '攻击速度', `${(1000/this.attackCooldown).toFixed(1)}/秒`, '#ff8800')
    yOffset += lineHeight
    this.drawStatItem(rightColumn, yOffset, '暴击率', '20%', '#ffff00')
    yOffset += lineHeight
    this.drawStatItem(rightColumn, yOffset, '移动速度', '8像素/帧', '#00ff88')
    yOffset += lineHeight
    this.drawStatItem(rightColumn, yOffset, '暴击伤害', '40', '#ff8800')
    yOffset += lineHeight
    this.drawStatItem(rightColumn, yOffset, '敌人移动速度', '1像素/帧', '#ff4444')
    yOffset += lineHeight
    this.drawStatItem(rightColumn, yOffset, '生命偷取', `${this.lifestealPercent}%`, '#ff4444')
    yOffset += lineHeight
    this.drawStatItem(rightColumn, yOffset, '生命回复', `${this.autoRegenAmount}/秒`, '#4488ff')
    
    // 绘制生命值条背景
    this.ctx.fillStyle = 'rgba(50, 50, 50, 0.8)'
    this.ctx.fillRect(centerX - 200, centerY + 100, 400, 30)
    
    // 绘制生命值条
    const healthPercent = Math.max(0, this.playerHealth / this.playerMaxHealth)
    if (healthPercent > 0) {
      // 渐变生命值条
      const healthGradient = this.ctx.createLinearGradient(centerX - 200, centerY + 100, centerX + 200, centerY + 100)
      if (healthPercent > 0.6) {
        healthGradient.addColorStop(0, '#00ff88')
        healthGradient.addColorStop(1, '#00cc66')
      } else if (healthPercent > 0.3) {
        healthGradient.addColorStop(0, '#ffaa00')
        healthGradient.addColorStop(1, '#ff8800')
      } else {
        healthGradient.addColorStop(0, '#ff4444')
        healthGradient.addColorStop(1, '#cc2222')
      }
      this.ctx.fillStyle = healthGradient
      this.ctx.fillRect(centerX - 200, centerY + 100, 400 * healthPercent, 30)
    }
    
    // 绘制生命值条边框
    this.ctx.strokeStyle = '#00ff88'
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(centerX - 200, centerY + 100, 400, 30)
    
    // 绘制生命值条文字
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = 'bold 16px Arial'
    this.ctx.textAlign = 'center'
    this.ctx.fillText(`生命值: ${Math.ceil(this.playerHealth)}/${this.playerMaxHealth} (${Math.round(healthPercent*100)}%)`, centerX, centerY + 120)
    
    // 绘制底部提示
    this.ctx.fillStyle = '#ffff00'
    this.ctx.font = 'bold 18px Arial'
    this.ctx.fillText('按P键或空格键继续游戏', centerX, centerY + 160)
    
    this.ctx.textAlign = 'left'
  }

  // 绘制属性项
  private drawStatItem(x: number, y: number, label: string, value: string, valueColor: string) {
    // 绘制标签
    this.ctx.fillStyle = '#cccccc'
    this.ctx.font = '16px Arial'
    this.ctx.textAlign = 'left'
    this.ctx.fillText(label + ':', x, y)
    
    // 绘制数值
    this.ctx.fillStyle = valueColor
    this.ctx.font = 'bold 16px Arial'
    this.ctx.textAlign = 'right'
    this.ctx.fillText(value, x + 250, y) // 增加数值位置避免重叠
    
    // 绘制分隔线
    this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)'
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.moveTo(x, y + 8)
    this.ctx.lineTo(x + 250, y + 8) // 调整分隔线长度
    this.ctx.stroke()
  }

  // 公共方法：暂停/继续游戏
  public pauseToggle() {
    this.togglePause()
  }
}
