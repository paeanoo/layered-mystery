import type { Projectile as ProjectileType } from '../../types/game'

export class Projectile {
  private state: ProjectileType
  private creationTime: number
  private maxLifetime = 5000 // 5秒最大生命周期

  constructor(state: ProjectileType) {
    this.state = { ...state }
    this.creationTime = Date.now()
  }

  get id() {
    return this.state.id
  }

  get position() {
    return this.state.position
  }

  get velocity() {
    return this.state.velocity
  }

  get damage() {
    return this.state.damage
  }

  get pierce() {
    return this.state.pierce
  }

  get maxPierce() {
    return this.state.maxPierce
  }

  get size() {
    return this.state.size
  }

  get color() {
    return this.state.color
  }

  // 更新位置
  updatePosition(x: number, y: number) {
    this.state.position.x = x
    this.state.position.y = y
  }

  // 更新速度
  updateVelocity(vx: number, vy: number) {
    this.state.velocity.x = vx
    this.state.velocity.y = vy
  }

  // 增加穿透计数
  incrementPierce() {
    this.state.pierce++
  }

  // 检查是否应该销毁
  shouldDestroy(): boolean {
    return this.state.pierce > this.state.maxPierce || this.isExpired()
  }

  // 检查是否过期
  isExpired(): boolean {
    return Date.now() - this.creationTime > this.maxLifetime
  }

  // 获取完整状态
  getState(): ProjectileType {
    return { ...this.state }
  }

  // 更新（每帧调用）
  update(deltaTime: number) {
    // 更新位置
    this.state.position.x += this.state.velocity.x * deltaTime / 1000
    this.state.position.y += this.state.velocity.y * deltaTime / 1000
  }

  // 检查与目标的碰撞
  checkCollision(targetPosition: { x: number; y: number }, targetSize: number): boolean {
    const dx = targetPosition.x - this.state.position.x
    const dy = targetPosition.y - this.state.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < this.state.size + targetSize
  }

  // 创建不同类型的投射物
  static createBasicProjectile(
    position: { x: number; y: number },
    velocity: { x: number; y: number },
    damage: number,
    pierce: number = 0
  ): Projectile {
    const projectile: ProjectileType = {
      id: Math.random().toString(36).substr(2, 9),
      position,
      velocity,
      damage,
      pierce: 0,
      maxPierce: pierce,
      size: 5,
      color: '#00ff88'
    }
    return new Projectile(projectile)
  }

  static createPiercingProjectile(
    position: { x: number; y: number },
    velocity: { x: number; y: number },
    damage: number,
    pierce: number = 3
  ): Projectile {
    const projectile: ProjectileType = {
      id: Math.random().toString(36).substr(2, 9),
      position,
      velocity,
      damage,
      pierce: 0,
      maxPierce: pierce,
      size: 6,
      color: '#0088ff'
    }
    return new Projectile(projectile)
  }

  static createExplosiveProjectile(
    position: { x: number; y: number },
    velocity: { x: number; y: number },
    damage: number,
    pierce: number = 0
  ): Projectile {
    const projectile: ProjectileType = {
      id: Math.random().toString(36).substr(2, 9),
      position,
      velocity,
      damage,
      pierce: 0,
      maxPierce: pierce,
      size: 8,
      color: '#ff8800'
    }
    return new Projectile(projectile)
  }

  // 创建多投射物
  static createMultipleProjectiles(
    position: { x: number; y: number },
    targetPosition: { x: number; y: number },
    damage: number,
    count: number,
    spread: number = 0.3
  ): Projectile[] {
    const projectiles: Projectile[] = []
    const dx = targetPosition.x - position.x
    const dy = targetPosition.y - position.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > 0) {
      const baseAngle = Math.atan2(dy, dx)
      const angleStep = spread / (count - 1)

      for (let i = 0; i < count; i++) {
        const angle = baseAngle + (i - (count - 1) / 2) * angleStep
        const velocity = {
          x: Math.cos(angle) * 300,
          y: Math.sin(angle) * 300
        }

        const projectile = Projectile.createBasicProjectile(
          { ...position },
          velocity,
          damage
        )
        projectiles.push(projectile)
      }
    }

    return projectiles
  }
}
