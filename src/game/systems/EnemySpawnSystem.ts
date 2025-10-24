import type { Enemy } from '../../types/game'
import { Enemy as EnemyEntity } from '../entities/Enemy'

export class EnemySpawnSystem {
  private spawnTimer = 0
  private spawnRate = 1000 // 基础生成间隔（毫秒）
  private maxEnemies = 50 // 最大敌人数量
  private levelMultiplier = 1 // 关卡难度倍数

  constructor() {
    this.reset()
  }

  // 重置生成系统
  reset() {
    this.spawnTimer = 0
    this.spawnRate = 1000
    this.maxEnemies = 50
    this.levelMultiplier = 1
  }

  // 更新生成系统
  update(
    deltaTime: number,
    level: number,
    currentEnemyCount: number,
    canvasWidth: number,
    canvasHeight: number
  ): Enemy[] {
    this.updateSpawnRate(level)
    this.spawnTimer += deltaTime

    const newEnemies: Enemy[] = []

    // 检查是否可以生成新敌人
    if (this.shouldSpawn(currentEnemyCount)) {
      const enemy = this.spawnEnemy(level, canvasWidth, canvasHeight)
      if (enemy) {
        newEnemies.push(enemy)
        this.spawnTimer = 0
      }
    }

    return newEnemies
  }

  // 更新生成速率
  private updateSpawnRate(level: number) {
    this.levelMultiplier = 1 + (level - 1) * 0.2 // 每层增加20%难度
    this.spawnRate = Math.max(500, 1000 - (level - 1) * 50) // 最快500ms间隔
    this.maxEnemies = Math.min(100, 50 + (level - 1) * 5) // 最多100个敌人
  }

  // 检查是否应该生成敌人
  private shouldSpawn(currentEnemyCount: number): boolean {
    return this.spawnTimer >= this.spawnRate && 
           currentEnemyCount < this.maxEnemies
  }

  // 生成敌人
  private spawnEnemy(level: number, canvasWidth: number, canvasHeight: number): Enemy | null {
    const spawnSide = Math.floor(Math.random() * 4)
    const position = this.getSpawnPosition(spawnSide, canvasWidth, canvasHeight)
    
    if (!position) return null

    // 根据关卡和随机性选择敌人类型
    const enemyType = this.selectEnemyType(level)
    
    switch (enemyType) {
      case 'normal':
        return EnemyEntity.createNormalEnemy(level, position)
      case 'elite':
        return EnemyEntity.createEliteEnemy(level, position)
      case 'boss':
        return EnemyEntity.createBossEnemy(level, position)
      default:
        return EnemyEntity.createNormalEnemy(level, position)
    }
  }

  // 获取生成位置
  private getSpawnPosition(
    side: number,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } | null {
    const margin = 50

    switch (side) {
      case 0: // 上边
        return {
          x: Math.random() * canvasWidth,
          y: -margin
        }
      case 1: // 右边
        return {
          x: canvasWidth + margin,
          y: Math.random() * canvasHeight
        }
      case 2: // 下边
        return {
          x: Math.random() * canvasWidth,
          y: canvasHeight + margin
        }
      case 3: // 左边
        return {
          x: -margin,
          y: Math.random() * canvasHeight
        }
      default:
        return null
    }
  }

  // 选择敌人类型
  private selectEnemyType(level: number): 'normal' | 'elite' | 'boss' {
    const random = Math.random()
    
    // Boss层（每10层一个Boss）
    if (level % 10 === 0) {
      return 'boss'
    }
    
    // 精英敌人概率随关卡增加
    const eliteChance = Math.min(0.3, 0.05 + (level - 1) * 0.02)
    if (random < eliteChance) {
      return 'elite'
    }
    
    return 'normal'
  }

  // 生成Boss敌人（特殊关卡）
  spawnBoss(level: number, canvasWidth: number, canvasHeight: number): Enemy {
    const position = {
      x: canvasWidth / 2,
      y: canvasHeight / 2
    }
    return EnemyEntity.createBossEnemy(level, position)
  }

  // 生成精英敌人
  spawnElite(level: number, canvasWidth: number, canvasHeight: number): Enemy {
    const spawnSide = Math.floor(Math.random() * 4)
    const position = this.getSpawnPosition(spawnSide, canvasWidth, canvasHeight)
    
    if (!position) {
      // 如果生成位置失败，在中心生成
      position.x = canvasWidth / 2
      position.y = canvasHeight / 2
    }
    
    return EnemyEntity.createEliteEnemy(level, position)
  }

  // 获取当前生成速率
  getSpawnRate(): number {
    return this.spawnRate
  }

  // 获取最大敌人数量
  getMaxEnemies(): number {
    return this.maxEnemies
  }

  // 获取关卡难度倍数
  getLevelMultiplier(): number {
    return this.levelMultiplier
  }

  // 设置生成参数
  setSpawnParameters(rate: number, maxEnemies: number) {
    this.spawnRate = rate
    this.maxEnemies = maxEnemies
  }
}
