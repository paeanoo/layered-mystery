import type { PlayerState, Enemy } from '../../types/game'

// 动画帧数据
export interface AnimationFrame {
  x: number
  y: number
  width: number
  height: number
  duration: number
}

// 动画数据
export interface Animation {
  id: string
  name: string
  frames: AnimationFrame[]
  loop: boolean
  speed: number
}

// 动画系统类
export class AnimationSystem {
  private animations: Map<string, Animation> = new Map()
  private spriteSheets: Map<string, HTMLImageElement> = new Map()

  constructor() {
    this.initializeAnimations()
  }

  // 初始化动画数据
  private initializeAnimations() {
    // 玩家动画
    this.addAnimation('player_idle', {
      id: 'player_idle',
      name: '待机',
      frames: [
        { x: 0, y: 0, width: 32, height: 32, duration: 200 },
        { x: 32, y: 0, width: 32, height: 32, duration: 200 },
        { x: 64, y: 0, width: 32, height: 32, duration: 200 },
        { x: 96, y: 0, width: 32, height: 32, duration: 200 }
      ],
      loop: true,
      speed: 1.0
    })

    this.addAnimation('player_moving', {
      id: 'player_moving',
      name: '移动',
      frames: [
        { x: 0, y: 32, width: 32, height: 32, duration: 150 },
        { x: 32, y: 32, width: 32, height: 32, duration: 150 },
        { x: 64, y: 32, width: 32, height: 32, duration: 150 },
        { x: 96, y: 32, width: 32, height: 32, duration: 150 }
      ],
      loop: true,
      speed: 1.2
    })

    this.addAnimation('player_attacking', {
      id: 'player_attacking',
      name: '攻击',
      frames: [
        { x: 0, y: 64, width: 32, height: 32, duration: 100 },
        { x: 32, y: 64, width: 32, height: 32, duration: 100 },
        { x: 64, y: 64, width: 32, height: 32, duration: 100 }
      ],
      loop: false,
      speed: 1.5
    })

    this.addAnimation('player_hit', {
      id: 'player_hit',
      name: '受击',
      frames: [
        { x: 0, y: 96, width: 32, height: 32, duration: 200 },
        { x: 32, y: 96, width: 32, height: 32, duration: 200 }
      ],
      loop: false,
      speed: 1.0
    })

    this.addAnimation('player_dying', {
      id: 'player_dying',
      name: '死亡',
      frames: [
        { x: 0, y: 128, width: 32, height: 32, duration: 300 },
        { x: 32, y: 128, width: 32, height: 32, duration: 300 },
        { x: 64, y: 128, width: 32, height: 32, duration: 300 }
      ],
      loop: false,
      speed: 0.8
    })

    // 敌人动画
    this.addAnimation('enemy_idle', {
      id: 'enemy_idle',
      name: '敌人待机',
      frames: [
        { x: 0, y: 0, width: 24, height: 24, duration: 250 },
        { x: 24, y: 0, width: 24, height: 24, duration: 250 }
      ],
      loop: true,
      speed: 1.0
    })

    this.addAnimation('enemy_moving', {
      id: 'enemy_moving',
      name: '敌人移动',
      frames: [
        { x: 0, y: 24, width: 24, height: 24, duration: 150 },
        { x: 24, y: 24, width: 24, height: 24, duration: 150 },
        { x: 48, y: 24, width: 24, height: 24, duration: 150 }
      ],
      loop: true,
      speed: 1.1
    })

    this.addAnimation('enemy_attacking', {
      id: 'enemy_attacking',
      name: '敌人攻击',
      frames: [
        { x: 0, y: 48, width: 24, height: 24, duration: 120 },
        { x: 24, y: 48, width: 24, height: 24, duration: 120 }
      ],
      loop: false,
      speed: 1.3
    })

    this.addAnimation('enemy_hit', {
      id: 'enemy_hit',
      name: '敌人受击',
      frames: [
        { x: 0, y: 72, width: 24, height: 24, duration: 100 },
        { x: 24, y: 72, width: 24, height: 24, duration: 100 }
      ],
      loop: false,
      speed: 1.0
    })

    this.addAnimation('enemy_dying', {
      id: 'enemy_dying',
      name: '敌人死亡',
      frames: [
        { x: 0, y: 96, width: 24, height: 24, duration: 200 },
        { x: 24, y: 96, width: 24, height: 24, duration: 200 },
        { x: 48, y: 96, width: 24, height: 24, duration: 200 }
      ],
      loop: false,
      speed: 0.9
    })

    // 特殊动画
    this.addAnimation('enemy_special', {
      id: 'enemy_special',
      name: '敌人特殊技能',
      frames: [
        { x: 0, y: 120, width: 32, height: 32, duration: 150 },
        { x: 32, y: 120, width: 32, height: 32, duration: 150 },
        { x: 64, y: 120, width: 32, height: 32, duration: 150 }
      ],
      loop: false,
      speed: 1.2
    })
  }

  // 添加动画
  addAnimation(id: string, animation: Animation) {
    this.animations.set(id, animation)
  }

  // 获取动画
  getAnimation(id: string): Animation | undefined {
    return this.animations.get(id)
  }

  // 获取当前动画帧
  getCurrentFrame(animationId: string, frameIndex: number): AnimationFrame | null {
    const animation = this.animations.get(animationId)
    if (!animation || frameIndex >= animation.frames.length) {
      return null
    }
    return animation.frames[frameIndex]
  }

  // 更新动画帧
  updateAnimationFrame(
    currentFrame: number, 
    animationTimer: number, 
    animationId: string
  ): { frame: number; timer: number; finished: boolean } {
    const animation = this.animations.get(animationId)
    if (!animation) {
      return { frame: currentFrame, timer: animationTimer, finished: true }
    }

    const currentFrameData = animation.frames[currentFrame]
    if (!currentFrameData) {
      return { frame: currentFrame, timer: animationTimer, finished: true }
    }

    let newTimer = animationTimer + 16 // 假设60FPS
    let newFrame = currentFrame
    let finished = false

    if (newTimer >= currentFrameData.duration) {
      newTimer = 0
      newFrame = currentFrame + 1

      if (newFrame >= animation.frames.length) {
        if (animation.loop) {
          newFrame = 0
        } else {
          newFrame = animation.frames.length - 1
          finished = true
        }
      }
    }

    return { frame: newFrame, timer: newTimer, finished }
  }

  // 渲染玩家动画
  renderPlayerAnimation(
    ctx: CanvasRenderingContext2D,
    player: PlayerState,
    spriteSheet: HTMLImageElement
  ) {
    const animationId = `player_${player.animationState}`
    const frame = this.getCurrentFrame(animationId, player.animationFrame)
    
    if (!frame) return

    const x = player.position.x - player.size / 2
    const y = player.position.y - player.size / 2

    // 绘制精灵
    ctx.drawImage(
      spriteSheet,
      frame.x, frame.y, frame.width, frame.height,
      x, y, player.size, player.size
    )

    // 绘制发光效果
    if (player.glowColor) {
      ctx.shadowColor = player.glowColor
      ctx.shadowBlur = 10
      ctx.drawImage(
        spriteSheet,
        frame.x, frame.y, frame.width, frame.height,
        x, y, player.size, player.size
      )
      ctx.shadowBlur = 0
    }
  }

  // 渲染敌人动画
  renderEnemyAnimation(
    ctx: CanvasRenderingContext2D,
    enemy: Enemy,
    spriteSheet: HTMLImageElement
  ) {
    const animationId = `enemy_${enemy.animationState}`
    const frame = this.getCurrentFrame(animationId, enemy.animationFrame)
    
    if (!frame) return

    const x = enemy.position.x - enemy.size / 2
    const y = enemy.position.y - enemy.size / 2

    // 绘制精灵
    ctx.drawImage(
      spriteSheet,
      frame.x, frame.y, frame.width, frame.height,
      x, y, enemy.size, enemy.size
    )

    // 绘制发光效果
    if (enemy.glowColor) {
      ctx.shadowColor = enemy.glowColor
      ctx.shadowBlur = 8
      ctx.drawImage(
        spriteSheet,
        frame.x, frame.y, frame.width, frame.height,
        x, y, enemy.size, enemy.size
      )
      ctx.shadowBlur = 0
    }
  }

  // 加载精灵表
  async loadSpriteSheet(id: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        this.spriteSheets.set(id, img)
        resolve()
      }
      img.onerror = reject
      img.src = url
    })
  }

  // 获取精灵表
  getSpriteSheet(id: string): HTMLImageElement | undefined {
    return this.spriteSheets.get(id)
  }

  // 创建粒子效果动画
  createParticleEffect(
    type: string,
    position: { x: number; y: number },
    duration: number = 1000
  ): ParticleEffect {
    return {
      id: Math.random().toString(36).substr(2, 9),
      type,
      position: { ...position },
      duration,
      maxDuration: duration,
      animationFrame: 0,
      animationTimer: 0,
      size: 10,
      color: '#ffffff',
      alpha: 1.0
    }
  }

  // 更新粒子效果
  updateParticleEffect(effect: ParticleEffect, deltaTime: number): boolean {
    effect.duration -= deltaTime
    effect.animationTimer += deltaTime

    if (effect.animationTimer >= 50) { // 20FPS
      effect.animationFrame++
      effect.animationTimer = 0
    }

    // 更新透明度
    effect.alpha = effect.duration / effect.maxDuration

    return effect.duration > 0
  }

  // 渲染粒子效果
  renderParticleEffect(ctx: CanvasRenderingContext2D, effect: ParticleEffect) {
    ctx.save()
    ctx.globalAlpha = effect.alpha
    ctx.fillStyle = effect.color
    ctx.beginPath()
    ctx.arc(effect.position.x, effect.position.y, effect.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// 粒子效果接口
export interface ParticleEffect {
  id: string
  type: string
  position: { x: number; y: number }
  duration: number
  maxDuration: number
  animationFrame: number
  animationTimer: number
  size: number
  color: string
  alpha: number
}

// 动画管理器
export class AnimationManager {
  private animationSystem: AnimationSystem
  private particleEffects: ParticleEffect[] = []

  constructor() {
    this.animationSystem = new AnimationSystem()
  }

  // 更新所有动画
  update(deltaTime: number) {
    // 更新粒子效果
    this.particleEffects = this.particleEffects.filter(effect => {
      return this.animationSystem.updateParticleEffect(effect, deltaTime)
    })
  }

  // 添加粒子效果
  addParticleEffect(effect: ParticleEffect) {
    this.particleEffects.push(effect)
  }

  // 渲染所有效果
  render(ctx: CanvasRenderingContext2D) {
    // 渲染粒子效果
    this.particleEffects.forEach(effect => {
      this.animationSystem.renderParticleEffect(ctx, effect)
    })
  }

  // 获取动画系统
  getAnimationSystem(): AnimationSystem {
    return this.animationSystem
  }
}
