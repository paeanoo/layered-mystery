import type { GameState, PlayerState, Enemy, Projectile } from '../../types/game'

export class GameEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gameState: GameState
  private animationId: number | null = null
  private lastTime = 0
  private keys: Set<string> = new Set()
  private enemySpawnTimer = 0
  private attackTimer = 0

  constructor(canvas: HTMLCanvasElement, gameState: GameState) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.gameState = gameState
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // 键盘事件
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase())
    })

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase())
    })

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.resizeCanvas()
    })
  }

  private resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width * window.devicePixelRatio
    this.canvas.height = rect.height * window.devicePixelRatio
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
  }

  start() {
    this.resizeCanvas()
    this.gameLoop(0)
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  private gameLoop = (currentTime: number) => {
    const deltaTime = currentTime - this.lastTime
    this.lastTime = currentTime

    if (!this.gameState.isPaused && !this.gameState.isGameOver) {
      this.update(deltaTime)
    }

    this.render()
    this.animationId = requestAnimationFrame(this.gameLoop)
  }

  private update(deltaTime: number) {
    // 更新玩家
    this.updatePlayer(deltaTime)

    // 更新敌人
    this.updateEnemies(deltaTime)

    // 更新投射物
    this.updateProjectiles(deltaTime)

    // 生成敌人
    this.spawnEnemies(deltaTime)

    // 玩家攻击
    this.handlePlayerAttack(deltaTime)

    // 碰撞检测
    this.checkCollisions()

    // 更新游戏时间
    this.updateGameTime(deltaTime)
  }

  private updatePlayer(deltaTime: number) {
    const player = this.gameState.player
    const moveSpeed = player.moveSpeed * 200 // 像素/秒

    // 处理移动输入
    let velocityX = 0
    let velocityY = 0

    if (this.keys.has('w') || this.keys.has('arrowup')) velocityY = -1
    if (this.keys.has('s') || this.keys.has('arrowdown')) velocityY = 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) velocityX = -1
    if (this.keys.has('d') || this.keys.has('arrowright')) velocityX = 1

    // 标准化对角线移动
    if (velocityX !== 0 && velocityY !== 0) {
      velocityX *= 0.707
      velocityY *= 0.707
    }

    // 更新位置
    player.position.x += velocityX * moveSpeed * deltaTime / 1000
    player.position.y += velocityY * moveSpeed * deltaTime / 1000

    // 边界检查
    const margin = 20
    player.position.x = Math.max(margin, Math.min(this.canvas.width - margin, player.position.x))
    player.position.y = Math.max(margin, Math.min(this.canvas.height - margin, player.position.y))

    // 生命回复
    if (player.regeneration > 0) {
      player.health = Math.min(player.maxHealth, player.health + player.regeneration * deltaTime / 1000)
    }
  }

  private updateEnemies(deltaTime: number) {
    this.gameState.enemies.forEach(enemy => {
      // 简单的AI：朝玩家移动
      const dx = this.gameState.player.position.x - enemy.position.x
      const dy = this.gameState.player.position.y - enemy.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        enemy.position.x += (dx / distance) * enemy.moveSpeed * deltaTime / 1000
        enemy.position.y += (dy / distance) * enemy.moveSpeed * deltaTime / 1000
      }
    })
  }

  private updateProjectiles(deltaTime: number) {
    this.gameState.projectiles.forEach(projectile => {
      projectile.position.x += projectile.velocity.x * deltaTime / 1000
      projectile.position.y += projectile.velocity.y * deltaTime / 1000
    })

    // 移除超出边界的投射物
    this.gameState.projectiles = this.gameState.projectiles.filter(projectile => {
      return projectile.position.x >= 0 && 
             projectile.position.x <= this.canvas.width &&
             projectile.position.y >= 0 && 
             projectile.position.y <= this.canvas.height
    })
  }

  private spawnEnemies(deltaTime: number) {
    this.enemySpawnTimer += deltaTime
    const spawnRate = 1000 + Math.random() * 1000 // 1-2秒随机间隔

    if (this.enemySpawnTimer >= spawnRate) {
      this.enemySpawnTimer = 0
      this.createEnemy()
    }
  }

  private createEnemy() {
    const canvas = this.canvas
    const side = Math.floor(Math.random() * 4)
    let x = 0, y = 0

    switch (side) {
      case 0: // 上
        x = Math.random() * canvas.width
        y = -20
        break
      case 1: // 右
        x = canvas.width + 20
        y = Math.random() * canvas.height
        break
      case 2: // 下
        x = Math.random() * canvas.width
        y = canvas.height + 20
        break
      case 3: // 左
        x = -20
        y = Math.random() * canvas.height
        break
    }

    const enemy: Enemy = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'normal',
      health: 20 + this.gameState.level * 5,
      maxHealth: 20 + this.gameState.level * 5,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      damage: 10 + this.gameState.level * 2,
      moveSpeed: 50 + this.gameState.level * 10,
      size: 15 + this.gameState.level,
      color: '#ff4444',
      armor: 0,
      magicResistance: 0,
      dodgeChance: 0,
      attackRange: 20,
      attackSpeed: 1,
      lastAttackTime: 0,
      aiType: 'aggressive',
      targetId: '',
      aggroRange: 100,
      deaggroRange: 150,
      statusEffects: [],
      abilities: [],
      animationState: 'idle',
      animationFrame: 0,
      animationTimer: 0,
      glowColor: '#ff0000',
      particleEffects: [],
      dropTable: [],
      experienceValue: 10
    }

    this.gameState.enemies.push(enemy)
  }

  private handlePlayerAttack(deltaTime: number) {
    this.attackTimer += deltaTime
    const attackInterval = 1000 / this.gameState.player.attackSpeed // 毫秒

    if (this.attackTimer >= attackInterval && this.gameState.enemies.length > 0) {
      this.attackTimer = 0
      this.createProjectiles()
    }
  }

  private createProjectiles() {
    const player = this.gameState.player
    const projectileCount = player.projectiles

    for (let i = 0; i < projectileCount; i++) {
      // 找到最近的敌人
      const nearestEnemy = this.findNearestEnemy()
      if (!nearestEnemy) return

      const dx = nearestEnemy.position.x - player.position.x
      const dy = nearestEnemy.position.y - player.position.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        const speed = 300 // 像素/秒
        const velocityX = (dx / distance) * speed
        const velocityY = (dy / distance) * speed

        // 多投射物时分散角度
        const angle = (i - (projectileCount - 1) / 2) * 0.2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const finalVelocityX = velocityX * cos - velocityY * sin
        const finalVelocityY = velocityX * sin + velocityY * cos

        const projectile: Projectile = {
          id: Math.random().toString(36).substr(2, 9),
          position: { x: player.position.x, y: player.position.y },
          velocity: { x: finalVelocityX, y: finalVelocityY },
          damage: player.damage,
          pierce: 0,
          maxPierce: player.pierce,
          size: 5,
          color: '#00ff88'
        }

        this.gameState.projectiles.push(projectile)
      }
    }
  }

  private findNearestEnemy(): Enemy | null {
    if (this.gameState.enemies.length === 0) return null

    const player = this.gameState.player
    let nearest = this.gameState.enemies[0]
    let nearestDistance = this.getDistance(player.position, nearest.position)

    for (let i = 1; i < this.gameState.enemies.length; i++) {
      const distance = this.getDistance(player.position, this.gameState.enemies[i].position)
      if (distance < nearestDistance) {
        nearest = this.gameState.enemies[i]
        nearestDistance = distance
      }
    }

    return nearest
  }

  private getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  private checkCollisions() {
    // 投射物与敌人碰撞
    this.gameState.projectiles.forEach(projectile => {
      this.gameState.enemies.forEach((enemy, enemyIndex) => {
        const distance = this.getDistance(projectile.position, enemy.position)
        if (distance < projectile.size + enemy.size) {
          // 造成伤害
          enemy.health -= projectile.damage
          
          // 生命偷取
          if (this.gameState.player.lifesteal > 0) {
            const healAmount = projectile.damage * this.gameState.player.lifesteal
            this.gameState.player.health = Math.min(
              this.gameState.player.maxHealth,
              this.gameState.player.health + healAmount
            )
          }

          // 减少穿透
          projectile.pierce++
          if (projectile.pierce > projectile.maxPierce) {
            this.gameState.projectiles = this.gameState.projectiles.filter(p => p.id !== projectile.id)
          }

          // 移除死亡的敌人
          if (enemy.health <= 0) {
            this.gameState.enemies.splice(enemyIndex, 1)
            this.gameState.score += 10 + this.gameState.level * 5
          }
        }
      })
    })

    // 敌人与玩家碰撞
    this.gameState.enemies.forEach(enemy => {
      const distance = this.getDistance(this.gameState.player.position, enemy.position)
      if (distance < 20 + enemy.size) {
        // 玩家受到伤害
        this.gameState.player.health -= enemy.damage * 0.016 // 每帧伤害
        if (this.gameState.player.health <= 0) {
          this.gameState.isGameOver = true
        }
      }
    })
  }

  private updateGameTime(deltaTime: number) {
    this.gameState.timeRemaining -= deltaTime / 1000
    if (this.gameState.timeRemaining <= 0) {
      this.gameState.timeRemaining = 0
      // 进入下一层逻辑由外部处理
    }
  }

  private render() {
    // 清空画布
    this.ctx.fillStyle = '#1a1a1a'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // 绘制玩家
    this.renderPlayer()

    // 绘制敌人
    this.renderEnemies()

    // 绘制投射物
    this.renderProjectiles()

    // 绘制UI
    this.renderUI()
  }

  private renderPlayer() {
    const player = this.gameState.player
    this.ctx.fillStyle = '#00ff88'
    this.ctx.beginPath()
    this.ctx.arc(player.position.x, player.position.y, 15, 0, Math.PI * 2)
    this.ctx.fill()

    // 生命值条
    const barWidth = 30
    const barHeight = 4
    const healthPercent = player.health / player.maxHealth

    this.ctx.fillStyle = '#ff4444'
    this.ctx.fillRect(player.position.x - barWidth/2, player.position.y - 25, barWidth, barHeight)

    this.ctx.fillStyle = '#00ff88'
    this.ctx.fillRect(player.position.x - barWidth/2, player.position.y - 25, barWidth * healthPercent, barHeight)
  }

  private renderEnemies() {
    this.gameState.enemies.forEach(enemy => {
      this.ctx.fillStyle = enemy.color
      this.ctx.beginPath()
      this.ctx.arc(enemy.position.x, enemy.position.y, enemy.size, 0, Math.PI * 2)
      this.ctx.fill()

      // 敌人生命值条
      const barWidth = enemy.size * 2
      const barHeight = 3
      const healthPercent = enemy.health / enemy.maxHealth

      this.ctx.fillStyle = '#ff4444'
      this.ctx.fillRect(enemy.position.x - barWidth/2, enemy.position.y - enemy.size - 8, barWidth, barHeight)

      this.ctx.fillStyle = '#ffaa00'
      this.ctx.fillRect(enemy.position.x - barWidth/2, enemy.position.y - enemy.size - 8, barWidth * healthPercent, barHeight)
    })
  }

  private renderProjectiles() {
    this.gameState.projectiles.forEach(projectile => {
      this.ctx.fillStyle = projectile.color
      this.ctx.beginPath()
      this.ctx.arc(projectile.position.x, projectile.position.y, projectile.size, 0, Math.PI * 2)
      this.ctx.fill()
    })
  }

  private renderUI() {
    // 分数与金币
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '20px Arial'
    this.ctx.fillText(`分数: ${this.gameState.score}`, 20, 30)
    const gold = (this.gameState as any)?.player?.gold ?? 0
    this.ctx.fillText(`金币: ${gold}`, 120, 30)

    // 层数
    this.ctx.fillText(`层数: ${this.gameState.level}`, 20, 60)

    // 剩余时间
    this.ctx.fillText(`时间: ${Math.ceil(this.gameState.timeRemaining)}`, 20, 90)

    // 生命值
    const healthPercent = this.gameState.player.health / this.gameState.player.maxHealth
    this.ctx.fillText(`生命: ${Math.ceil(this.gameState.player.health)}/${this.gameState.player.maxHealth}`, 20, 120)
  }
}

