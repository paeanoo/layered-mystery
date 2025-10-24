import type { PlayerState, Enemy, Projectile } from '../../types/game'

export class CollisionSystem {
  // 检查投射物与敌人的碰撞
  static checkProjectileEnemyCollision(
    projectiles: Projectile[],
    enemies: Enemy[]
  ): Array<{ projectile: Projectile; enemy: Enemy }> {
    const collisions: Array<{ projectile: Projectile; enemy: Enemy }> = []

    for (const projectile of projectiles) {
      for (const enemy of enemies) {
        if (this.isProjectileEnemyCollision(projectile, enemy)) {
          collisions.push({ projectile, enemy })
        }
      }
    }

    return collisions
  }

  // 检查投射物与敌人的碰撞
  private static isProjectileEnemyCollision(projectile: Projectile, enemy: Enemy): boolean {
    const dx = enemy.position.x - projectile.position.x
    const dy = enemy.position.y - projectile.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < projectile.size + enemy.size
  }

  // 检查敌人与玩家的碰撞
  static checkEnemyPlayerCollision(
    enemies: Enemy[],
    player: PlayerState
  ): Array<{ enemy: Enemy; player: PlayerState }> {
    const collisions: Array<{ enemy: Enemy; player: PlayerState }> = []

    for (const enemy of enemies) {
      if (this.isEnemyPlayerCollision(enemy, player)) {
        collisions.push({ enemy, player })
      }
    }

    return collisions
  }

  // 检查敌人与玩家的碰撞
  private static isEnemyPlayerCollision(enemy: Enemy, player: PlayerState): boolean {
    const dx = player.position.x - enemy.position.x
    const dy = player.position.y - enemy.position.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    return distance < 20 + enemy.size // 玩家碰撞半径 + 敌人大小
  }

  // 检查投射物是否超出边界
  static checkProjectileBounds(
    projectiles: Projectile[],
    canvasWidth: number,
    canvasHeight: number
  ): Projectile[] {
    return projectiles.filter(projectile => {
      return projectile.position.x >= 0 &&
             projectile.position.x <= canvasWidth &&
             projectile.position.y >= 0 &&
             projectile.position.y <= canvasHeight
    })
  }

  // 检查敌人是否超出边界
  static checkEnemyBounds(
    enemies: Enemy[],
    canvasWidth: number,
    canvasHeight: number
  ): Enemy[] {
    return enemies.filter(enemy => {
      return enemy.position.x >= -50 && // 允许敌人从边界外进入
             enemy.position.x <= canvasWidth + 50 &&
             enemy.position.y >= -50 &&
             enemy.position.y <= canvasHeight + 50
    })
  }

  // 检查玩家是否超出边界
  static checkPlayerBounds(
    player: PlayerState,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } {
    const margin = 20
    return {
      x: Math.max(margin, Math.min(canvasWidth - margin, player.position.x)),
      y: Math.max(margin, Math.min(canvasHeight - margin, player.position.y))
    }
  }

  // 计算两点之间的距离
  static getDistance(
    pos1: { x: number; y: number },
    pos2: { x: number; y: number }
  ): number {
    const dx = pos1.x - pos2.x
    const dy = pos1.y - pos2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 计算角度
  static getAngle(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): number {
    const dx = to.x - from.x
    const dy = to.y - from.y
    return Math.atan2(dy, dx)
  }

  // 计算方向向量
  static getDirection(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): { x: number; y: number } {
    const distance = this.getDistance(from, to)
    if (distance === 0) return { x: 0, y: 0 }
    
    return {
      x: (to.x - from.x) / distance,
      y: (to.y - from.y) / distance
    }
  }

  // 检查圆形碰撞
  static isCircleCollision(
    pos1: { x: number; y: number },
    radius1: number,
    pos2: { x: number; y: number },
    radius2: number
  ): boolean {
    const distance = this.getDistance(pos1, pos2)
    return distance < radius1 + radius2
  }

  // 检查矩形碰撞
  static isRectCollision(
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number }
  ): boolean {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y
  }

  // 检查点是否在圆形内
  static isPointInCircle(
    point: { x: number; y: number },
    center: { x: number; y: number },
    radius: number
  ): boolean {
    const distance = this.getDistance(point, center)
    return distance <= radius
  }

  // 检查点是否在矩形内
  static isPointInRect(
    point: { x: number; y: number },
    rect: { x: number; y: number; width: number; height: number }
  ): boolean {
    return point.x >= rect.x &&
           point.x <= rect.x + rect.width &&
           point.y >= rect.y &&
           point.y <= rect.y + rect.height
  }
}
