/**
 * 音频管理系统
 * 处理游戏中所有音效和背景音乐
 */
export class AudioSystem {
  private soundEffects: Map<string, HTMLAudioElement> = new Map()
  private backgroundMusic: HTMLAudioElement | null = null
  private masterVolume: number = 0.7 // 主音量（0-1）
  private soundEffectsVolume: number = 0.8 // 音效音量（0-1）
  private musicVolume: number = 0.4 // 背景音乐音量（0-1）
  private isMuted: boolean = false
  private audioContext: AudioContext | null = null
  private musicFadeInterval: number | null = null
  private generatedMusicOscillator: OscillatorNode | null = null // 保存生成的背景音乐振荡器，用于停止
  private generatedMusicGain: GainNode | null = null // 保存生成的背景音乐增益节点

  constructor() {
    // 初始化 Web Audio API（用于程序化生成音效）
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (e) {
      console.warn('Web Audio API not supported, will use fallback audio')
    }

    // 预加载常用音效（使用程序化生成作为后备）
    this.preloadSounds()
  }

  /**
   * 预加载音效（使用程序化生成）
   */
  private preloadSounds() {
    // 这些音效会在需要时动态生成
    // 如果用户提供了音频文件，可以在这里加载
  }

  /**
   * 设置主音量
   */
  setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume))
  }

  /**
   * 设置音效音量
   */
  setSoundEffectsVolume(volume: number) {
    this.soundEffectsVolume = Math.max(0, Math.min(1, volume))
  }

  /**
   * 设置背景音乐音量
   */
  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume))
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = this.musicVolume * this.masterVolume
    }
  }

  /**
   * 静音/取消静音
   */
  setMuted(muted: boolean) {
    this.isMuted = muted
    if (this.backgroundMusic) {
      this.backgroundMusic.muted = muted
    }
  }

  /**
   * 加载音效文件（可选，如果用户有音频文件）
   */
  async loadSoundEffect(name: string, url: string): Promise<void> {
    try {
      const audio = new Audio(url)
      audio.preload = 'auto'
      audio.volume = this.soundEffectsVolume * this.masterVolume
      await audio.load()
      this.soundEffects.set(name, audio)
    } catch (error) {
      console.warn(`Failed to load sound effect ${name}:`, error)
    }
  }

  /**
   * 加载背景音乐
   */
  async loadBackgroundMusic(url: string, loop: boolean = true): Promise<void> {
    try {
      const audio = new Audio(url)
      audio.loop = loop
      audio.volume = this.musicVolume * this.masterVolume
      audio.preload = 'auto'
      await audio.load()
      this.backgroundMusic = audio
    } catch (error) {
      console.warn(`Failed to load background music:`, error)
    }
  }

  /**
   * 播放音效
   */
  playSoundEffect(name: string, options: { volume?: number; pitch?: number } = {}): void {
    if (this.isMuted) return

    // 首先尝试使用加载的音频文件
    const audio = this.soundEffects.get(name)
    if (audio) {
      const sound = audio.cloneNode() as HTMLAudioElement
      sound.volume = (options.volume ?? 1) * this.soundEffectsVolume * this.masterVolume
      if (options.pitch) {
        sound.playbackRate = options.pitch
      }
      sound.play().catch(e => console.warn('Failed to play sound:', e))
      return
    }

    // 如果没有加载的音频，使用程序化生成
    this.generateSound(name, options)
  }

  /**
   * 程序化生成音效（使用 Web Audio API）
   */
  private generateSound(name: string, options: { volume?: number; pitch?: number } = {}): void {
    if (!this.audioContext) return

    const volume = (options.volume ?? 1) * this.soundEffectsVolume * this.masterVolume
    const pitch = options.pitch ?? 1

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    const duration = 0.1 // 基础持续时间（秒）

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // 根据音效类型设置不同波形和频率
    switch (name) {
      case 'player_attack':
        // 玩家攻击音效：短促的"啾"声
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(800 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(400 * pitch, this.audioContext.currentTime + duration * 0.3)
        gainNode.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration)
        break

      case 'enemy_attack':
        // 敌人攻击音效：低沉的"砰"声
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(200 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(100 * pitch, this.audioContext.currentTime + duration * 0.5)
        gainNode.gain.setValueAtTime(volume * 0.2, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration * 0.8)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration * 0.8)
        break

      case 'projectile_hit':
        // 投射物命中音效：尖锐的"叮"声
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(600 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(300 * pitch, this.audioContext.currentTime + duration * 0.5)
        gainNode.gain.setValueAtTime(volume * 0.25, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration * 0.6)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration * 0.6)
        break

      case 'explosion':
        // 爆炸音效：低沉的"轰"声
        const duration2 = 0.3
        oscillator.type = 'sawtooth'
        oscillator.frequency.setValueAtTime(150 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(50 * pitch, this.audioContext.currentTime + duration2)
        gainNode.gain.setValueAtTime(volume * 0.4, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration2)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration2)
        break

      case 'enemy_death':
        // 敌人死亡音效：下落的音调
        const duration3 = 0.2
        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(400 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(100 * pitch, this.audioContext.currentTime + duration3)
        gainNode.gain.setValueAtTime(volume * 0.2, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration3)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration3)
        break

      case 'player_hit':
        // 玩家受击音效：短促的"啪"声
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(300 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(150 * pitch, this.audioContext.currentTime + duration * 0.4)
        gainNode.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration * 0.4)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration * 0.4)
        break

      case 'level_up':
        // 升级音效：上升的音调
        const duration4 = 0.5
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(200 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(600 * pitch, this.audioContext.currentTime + duration4)
        gainNode.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime)
        gainNode.gain.setValueAtTime(volume * 0.3, this.audioContext.currentTime + duration4 * 0.8)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration4)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration4)
        break

      case 'ui_click':
        // UI点击音效：轻微的"咔"声
        oscillator.type = 'square'
        oscillator.frequency.setValueAtTime(800 * pitch, this.audioContext.currentTime)
        oscillator.frequency.exponentialRampToValueAtTime(400 * pitch, this.audioContext.currentTime + duration * 0.2)
        gainNode.gain.setValueAtTime(volume * 0.2, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration * 0.2)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration * 0.2)
        break

      default:
        // 默认音效
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(440 * pitch, this.audioContext.currentTime)
        gainNode.gain.setValueAtTime(volume * 0.2, this.audioContext.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration)
        oscillator.start(this.audioContext.currentTime)
        oscillator.stop(this.audioContext.currentTime + duration)
    }
  }

  /**
   * 播放背景音乐
   */
  playBackgroundMusic(fadeIn: boolean = true): void {
    // **修复**：如果没有加载的背景音乐文件，直接返回，不生成背景音乐（避免嗡嗡声）
    if (!this.backgroundMusic) {
      console.debug('No background music file loaded, skipping playback')
      return
    }
    
    if (this.isMuted) return

    this.backgroundMusic.currentTime = 0

    if (fadeIn) {
      this.backgroundMusic.volume = 0
      this.backgroundMusic.play().catch(e => {
        // 如果播放失败（可能是文件不存在），静默失败
        console.debug('Background music file not available, using generated music')
      })

      // 淡入效果
      const fadeSteps = 20
      const fadeDuration = 1000 // 1秒
      const volumeStep = (this.musicVolume * this.masterVolume) / fadeSteps
      let step = 0

      this.musicFadeInterval = window.setInterval(() => {
        step++
        if (this.backgroundMusic) {
          this.backgroundMusic.volume = Math.min(
            volumeStep * step,
            this.musicVolume * this.masterVolume
          )
        }
        if (step >= fadeSteps) {
          if (this.musicFadeInterval) {
            clearInterval(this.musicFadeInterval)
            this.musicFadeInterval = null
          }
        }
      }, fadeDuration / fadeSteps)
    } else {
      this.backgroundMusic.volume = this.musicVolume * this.masterVolume
      this.backgroundMusic.play().catch(e => console.warn('Failed to play background music:', e))
    }
  }

  /**
   * 停止背景音乐
   */
  stopBackgroundMusic(fadeOut: boolean = true): void {
    // 停止生成的背景音乐（如果存在）
    if (this.generatedMusicOscillator) {
      try {
        this.generatedMusicOscillator.stop()
      } catch (e) {
        // 振荡器可能已经停止
      }
      this.generatedMusicOscillator = null
      this.generatedMusicGain = null
    }

    if (!this.backgroundMusic) return

    if (fadeOut) {
      // 淡出效果
      const fadeSteps = 20
      const fadeDuration = 1000 // 1秒
      const startVolume = this.backgroundMusic.volume
      const volumeStep = startVolume / fadeSteps
      let step = 0

      const fadeInterval = window.setInterval(() => {
        step++
        if (this.backgroundMusic) {
          this.backgroundMusic.volume = Math.max(0, startVolume - volumeStep * step)
        }
        if (step >= fadeSteps) {
          clearInterval(fadeInterval)
          if (this.backgroundMusic) {
            this.backgroundMusic.pause()
            this.backgroundMusic.currentTime = 0
          }
        }
      }, fadeDuration / fadeSteps)
    } else {
      this.backgroundMusic.pause()
      this.backgroundMusic.currentTime = 0
    }
  }

  /**
   * 暂停背景音乐
   */
  pauseBackgroundMusic(): void {
    // 停止生成的背景音乐（如果存在）
    if (this.generatedMusicOscillator) {
      try {
        this.generatedMusicOscillator.stop()
      } catch (e) {
        // 振荡器可能已经停止
      }
      this.generatedMusicOscillator = null
      this.generatedMusicGain = null
    }

    if (this.backgroundMusic) {
      this.backgroundMusic.pause()
    }
  }

  /**
   * 恢复背景音乐
   */
  resumeBackgroundMusic(): void {
    if (this.backgroundMusic && !this.isMuted) {
      this.backgroundMusic.play().catch(e => console.warn('Failed to resume background music:', e))
    }
  }

  /**
   * 生成简单的背景音乐（如果没有提供音频文件）
   */
  generateBackgroundMusic(): void {
    if (!this.audioContext) return

    // **修复**：先停止之前生成的背景音乐（如果存在）
    if (this.generatedMusicOscillator) {
      try {
        this.generatedMusicOscillator.stop()
      } catch (e) {
        // 振荡器可能已经停止
      }
      this.generatedMusicOscillator = null
      this.generatedMusicGain = null
    }

    // **修复**：默认不生成背景音乐，避免嗡嗡声
    // 如果用户需要背景音乐，应该加载音频文件
    // 如果需要启用程序化生成的背景音乐，可以取消下面的注释
    /*
    // 创建一个简单的循环音乐（低沉的嗡嗡声）
    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.value = 110 // A2 音符
    gainNode.gain.value = this.musicVolume * this.masterVolume * 0.1 // 非常低的音量

    oscillator.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    oscillator.start()

    // 保存引用以便后续停止
    this.generatedMusicOscillator = oscillator
    this.generatedMusicGain = gainNode
    */
    
    console.log('Background music generation disabled to avoid buzzing sound. Load an audio file for background music.')
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.musicFadeInterval) {
      clearInterval(this.musicFadeInterval)
      this.musicFadeInterval = null
    }

    // 停止生成的背景音乐
    if (this.generatedMusicOscillator) {
      try {
        this.generatedMusicOscillator.stop()
      } catch (e) {
        // 振荡器可能已经停止
      }
      this.generatedMusicOscillator = null
      this.generatedMusicGain = null
    }

    this.soundEffects.forEach(audio => {
      audio.pause()
      audio.src = ''
    })
    this.soundEffects.clear()

    if (this.backgroundMusic) {
      this.backgroundMusic.pause()
      this.backgroundMusic.src = ''
      this.backgroundMusic = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }
}

