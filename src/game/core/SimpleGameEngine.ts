import type { GameState } from '../../types/game'

type Enemy = { x: number; y: number; size: number; color: string; health: number; maxHealth: number }
type Projectile = { x: number; y: number; vx: number; vy: number; damage: number }

export class SimpleGameEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gameState: GameState
  private animationId: number | null = null
  private lastTime = 0
  private keys: Set<string> = new Set()
  private playerX = 400
  private playerY = 300
  private enemies: Enemy[] = []
  private enemySpawnTimer = 0
  private attackTimer = 0
  private projectiles: Projectile[] = []

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
    const dpr = window.devicePixelRatio || 1
    
    // 设置Canvas实际尺寸
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    
    // 设置Canvas显示尺寸
    this.canvas.style.width = rect.width + 'px'
    this.canvas.style.height = rect.height + 'px'
    
    // 缩放上下文
    this.ctx.scale(dpr, dpr)
    
    console.log('Canvas调整尺寸:', {
      width: this.canvas.width,
      height: this.canvas.height,
      styleWidth: this.canvas.style.width,
      styleHeight: this.canvas.style.height,
      dpr
    })
  }

  start() {
    this.resizeCanvas()
    console.log('Canvas尺寸:', this.canvas.width, this.canvas.height)
    console.log('Canvas上下文:', this.ctx)
    this.gameLoop(performance.now())
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
    // 更新玩家位置
    this.updatePlayer(deltaTime)

    // 更新敌人
    this.updateEnemies(deltaTime)

    // 更新投射物
    this.updateProjectiles(deltaTime)

    // 玩家攻击
    this.handlePlayerAttack(deltaTime)

    // 生成敌人
    this.spawnEnemies(deltaTime)

    // 更新游戏时间
    this.updateGameTime(deltaTime)
  }

  private updatePlayer(deltaTime: number) {
    const moveSpeed = 200 // 像素/秒

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
    this.playerX += velocityX * moveSpeed * deltaTime / 1000
    this.playerY += velocityY * moveSpeed * deltaTime / 1000

    // 边界检查
    const margin = 20
    this.playerX = Math.max(margin, Math.min(this.canvas.width - margin, this.playerX))
    this.playerY = Math.max(margin, Math.min(this.canvas.height - margin, this.playerY))

    // 更新游戏状态中的玩家位置
    this.gameState.player.position.x = this.playerX
    this.gameState.player.position.y = this.playerY
  }

  private updateEnemies(deltaTime: number) {
    this.enemies.forEach((enemy, index) => {
      // 简单的AI：朝玩家移动
      const dx = this.playerX - enemy.x
      const dy = this.playerY - enemy.y
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > 0) {
        const moveSpeed = 50 + this.gameState.level * 10
        enemy.x += (dx / distance) * moveSpeed * deltaTime / 1000
        enemy.y += (dy / distance) * moveSpeed * deltaTime / 1000
      }

      // 检查与玩家的碰撞
      const playerDistance = Math.sqrt(
        (enemy.x - this.playerX) ** 2 + (enemy.y - this.playerY) ** 2
      )
      if (playerDistance < 20 + enemy.size) {
        // 玩家受到伤害
        this.gameState.player.health -= 20 * deltaTime / 1000
        if (this.gameState.player.health <= 0) {
          this.gameState.isGameOver = true
        }
      }
    })

    // 移除超出边界的敌人
    this.enemies = this.enemies.filter(enemy => {
      return enemy.x >= -50 && 
             enemy.x <= this.canvas.width + 50 &&
             enemy.y >= -50 && 
             enemy.y <= this.canvas.height + 50
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
    const side = Math.floor(Math.random() * 4)
    let x = 0
    let y = 0

    switch (side) {
      case 0: // 上
        x = Math.random() * this.canvas.width
        y = -20
        break
      case 1: // 右
        x = this.canvas.width + 20
        y = Math.random() * this.canvas.height
        break
      case 2: // 下
        x = Math.random() * this.canvas.width
        y = this.canvas.height + 20
        break
      case 3: // 左
        x = -20
        y = Math.random() * this.canvas.height
        break
      default:
        x = Math.random() * this.canvas.width
        y = -20
        break
    }

    this.enemies.push({
      x,
      y,
      size: 15 + this.gameState.level,
      color: '#ff4444',
      health: 20 + this.gameState.level * 5,
      maxHealth: 20 + this.gameState.level * 5
    })
  }

  private updateGameTime(deltaTime: number) {
    this.gameState.timeRemaining -= deltaTime / 1000
    if (this.gameState.timeRemaining <= 0) {
      this.gameState.timeRemaining = 0
      // 触发被动属性选择
      this.triggerPassiveSelection()
    }
    
    // 确保时间不为负数
    if (this.gameState.timeRemaining < 0) {
      this.gameState.timeRemaining = 0
    }
  }

  private triggerPassiveSelection() {
    // 这里可以触发被动属性选择界面
    // 暂时直接进入下一层
    this.gameState.level++
    this.gameState.timeRemaining = 30
    this.enemies = []
    this.projectiles = []
  }

  private updateProjectiles(deltaTime: number) {
    this.projectiles.forEach((projectile, index) => {
      projectile.x += projectile.vx * deltaTime / 1000
      projectile.y += projectile.vy * deltaTime / 1000

      // 检查与敌人的碰撞
      this.enemies.forEach((enemy, enemyIndex) => {
        const distance = Math.sqrt(
          (projectile.x - enemy.x) ** 2 + (projectile.y - enemy.y) ** 2
        )
        if (distance < projectile.damage + enemy.size) {
          // 造成伤害
          enemy.health -= projectile.damage
          this.projectiles.splice(index, 1)
          
          if (enemy.health <= 0) {
            this.enemies.splice(enemyIndex, 1)
            this.gameState.score += 10 + this.gameState.level * 5
          }
        }
      })
    })

    // 移除超出边界的投射物
    this.projectiles = this.projectiles.filter(projectile => {
      return projectile.x >= 0 && 
             projectile.x <= this.canvas.width &&
             projectile.y >= 0 && 
             projectile.y <= this.canvas.height
    })
  }

  private handlePlayerAttack(deltaTime: number) {
    this.attackTimer += deltaTime
    const attackInterval = 1000 / this.gameState.player.attackSpeed // 毫秒

    if (this.attackTimer >= attackInterval && this.enemies.length > 0) {
      this.attackTimer = 0
      this.createProjectiles()
    }
  }

  private createProjectiles() {
    // 找到最近的敌人
    let nearestEnemy: Enemy | null = null
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

    if (!nearestEnemy) {
      return
    }

    // TypeScript 类型收缩辅助
    const enemy = nearestEnemy as Enemy
    const dx = enemy.x - this.playerX
    const dy = enemy.y - this.playerY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      const speed = 300 // 像素/秒
      const vx = (dx / distance) * speed
      const vy = (dy / distance) * speed

      this.projectiles.push({
        x: this.playerX,
        y: this.playerY,
        vx,
        vy,
        damage: this.gameState.player.damage
      })
    }
  }

  private render() {
    // 获取Canvas显示尺寸
    const rect = this.canvas.getBoundingClientRect()
    
    // 清空画布
    this.ctx.fillStyle = '#1a1a1a'
    this.ctx.fillRect(0, 0, rect.width, rect.height)

    // 绘制玩家
    this.ctx.fillStyle = '#00ff88'
    this.ctx.beginPath()
    this.ctx.arc(this.playerX, this.playerY, 15, 0, Math.PI * 2)
    this.ctx.fill()
    
    console.log('渲染玩家位置:', this.playerX, this.playerY)

    // 绘制敌人
    this.enemies.forEach(enemy => {
      this.ctx.fillStyle = enemy.color
      this.ctx.beginPath()
      this.ctx.arc(enemy.x, enemy.y, enemy.size, 0, Math.PI * 2)
      this.ctx.fill()

      // 敌人生命值条
      const barWidth = enemy.size * 2
      const barHeight = 3
      const healthPercent = enemy.health / enemy.maxHealth

      this.ctx.fillStyle = '#ff4444'
      this.ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 8, barWidth, barHeight)

      this.ctx.fillStyle = '#ffaa00'
      this.ctx.fillRect(enemy.x - barWidth/2, enemy.y - enemy.size - 8, barWidth * healthPercent, barHeight)
    })

    // 绘制投射物
    this.projectiles.forEach(projectile => {
      this.ctx.fillStyle = '#00ff88'
      this.ctx.beginPath()
      this.ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2)
      this.ctx.fill()
    })

    // 绘制UI
    this.renderUI()
  }

  private renderUI() {
    // 分数与金币
    this.ctx.fillStyle = '#ffffff'
    this.ctx.font = '20px Arial'
    this.ctx.fillText(`分数: ${this.gameState.score}`, 20, 30)
    const gold = this.gameState?.player?.gold ?? 0
    this.ctx.fillText(`金币: ${gold}`, 120, 30)

    // 层数
    this.ctx.fillText(`层数: ${this.gameState.level}`, 20, 60)

    // 剩余时间
    this.ctx.fillText(`时间: ${Math.ceil(this.gameState.timeRemaining)}`, 20, 90)

    // 生命值
    const healthPercent = this.gameState.player.health / this.gameState.player.maxHealth
    this.ctx.fillText(`生命: ${Math.ceil(this.gameState.player.health)}/${this.gameState.player.maxHealth}`, 20, 120)

    // 生命值条
    const barWidth = 200
    const barHeight = 20
    const barX = 20
    const barY = 140

    // 背景
    this.ctx.fillStyle = '#ff4444'
    this.ctx.fillRect(barX, barY, barWidth, barHeight)

    // 生命值
    this.ctx.fillStyle = '#00ff88'
    this.ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight)

    // 边框
    this.ctx.strokeStyle = '#ffffff'
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(barX, barY, barWidth, barHeight)
  }
}
