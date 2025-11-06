// Boss 战配置与阶段脚本接口（第一版：数据占位，后续可扩展行为）

export type BossId = 5 | 10 | 15 | 20

export interface BossPhaseConfig {
  name: string
  // 阶段触发条件（按生命百分比）
  hpThresholdFrom?: number
  hpThresholdTo?: number
  // 技能时间轴（毫秒为单位的基础CD，实际可随层缩放）
  skills: Array<{
    id: string
    name: string
    cooldown: number
    // 可选：预警时长、范围等参数
    windup?: number
    notes?: string
  }>
  // 被动/常驻效果描述
  passives?: string[]
}

export interface BossConfigEntry {
  bossId: BossId
  name: string
  theme: string
  difficulty: 'basic' | 'advanced' | 'elite' | 'legendary'
  // 战场要素描述
  arena?: string
  // 抗性/控制减免（0~1）
  ccResistance: number
  // 阶段列表
  phases: BossPhaseConfig[]
}

export const BOSS_CONFIGS: Record<BossId, BossConfigEntry> = {
  5: {
    bossId: 5,
    name: '重装指挥官',
    theme: '护盾与阵地防御',
    difficulty: 'basic',
    arena: '标准竞技场，少量掩体',
    ccResistance: 0.1,
    phases: [
      {
        name: '阶段一',
        hpThresholdFrom: 0.6,
        hpThresholdTo: 1.0,
        passives: ['2名护盾兵常驻，为Boss提供减伤'],
        skills: [
          { id: 'infantry_phalanx', name: '步兵方阵', cooldown: 12000, notes: '召唤4名步兵扇形推进' },
          { id: 'artillery_barrage', name: '重炮轰击', cooldown: 15000, windup: 3000, notes: '3发炮弹，红色预警区' },
        ],
      },
      {
        name: '阶段二',
        hpThresholdFrom: 0.0,
        hpThresholdTo: 0.6,
        passives: ['移动速度+50%'],
        skills: [
          { id: 'emergency_mobilize', name: '紧急动员', cooldown: 999999, notes: '<40%HP触发：治疗+远程组合' },
          { id: 'artillery_barrage', name: '重炮轰击', cooldown: 14000, windup: 3000 },
        ],
      },
    ],
  },
  10: {
    bossId: 10,
    name: '虫巢母体',
    theme: '召唤与数量压制',
    difficulty: 'advanced',
    arena: '虫巢地形，多个虫巢出口',
    ccResistance: 0.2,
    phases: [
      {
        name: '常驻',
        skills: [
          { id: 'hive_breed', name: '虫巢繁殖', cooldown: 5000, notes: '3个虫巢每5s生成快速虫；虫巢可破坏，15s重生' },
          { id: 'boom_hatch', name: '爆虫孵化', cooldown: 10000, windup: 2000, notes: '玩家位置3虫卵，孵化后冲刺自爆' },
          { id: 'swarm_storm', name: '虫群风暴', cooldown: 20000, windup: 3000, notes: '覆盖6s范围DoT与减速' },
        ],
      },
      {
        name: '阈值触发',
        skills: [
          { id: 'elite_swarm', name: '精英虫群', cooldown: 1, notes: '每-25%HP触发，移速+50%，死亡分裂' },
        ],
      },
    ],
  },
  15: {
    bossId: 15,
    name: '暗影刺客',
    theme: '高速与精准打击',
    difficulty: 'elite',
    arena: '暗影迷宫，视野受限',
    ccResistance: 0.3,
    phases: [
      {
        name: '潜行',
        passives: ['默认隐身，命中率-70%，伤害-50%；每8-12s现身攻击'],
        skills: [
          { id: 'shadow_step', name: '暗影步', cooldown: 9000 },
          { id: 'backstab', name: '致命背刺', cooldown: 9000, windup: 800, notes: '最大生命40%伤害' },
          { id: 'dagger_array', name: '飞镖阵列', cooldown: 18000, notes: '6枚追踪飞镖，可被摧毁' },
        ],
      },
      {
        name: '分身',
        skills: [
          { id: 'shadow_clone', name: '影分身', cooldown: 1, notes: '<50%HP触发，2分身；真身攻击有音效' },
        ],
      },
    ],
  },
  20: {
    bossId: 20,
    name: '混沌造物',
    theme: '多形态复合机制',
    difficulty: 'legendary',
    arena: '混沌空间，地形周期变化',
    ccResistance: 0.4,
    phases: [
      {
        name: '混沌巨兽',
        hpThresholdFrom: 0.7,
        hpThresholdTo: 1.0,
        skills: [
          { id: 'chaos_slam', name: '混沌重击', cooldown: 9000, notes: '前方扇形高伤' },
          { id: 'affix_absorb', name: '词缀吸收', cooldown: 25000, notes: '随机2个精英词缀，持续25s' },
          { id: 'chaos_summon', name: '混沌召唤', cooldown: 18000 },
        ],
      },
      {
        name: '混沌织法者',
        hpThresholdFrom: 0.3,
        hpThresholdTo: 0.7,
        skills: [
          { id: 'element_stream', name: '元素洪流', cooldown: 12000, notes: '冰/火/雷交替弹道' },
          { id: 'chaos_zone', name: '混沌领域', cooldown: 15000, notes: '4个持续伤害区域' },
          { id: 'time_warp', name: '时空扭曲', cooldown: 16000, notes: '5s攻速/移速变化' },
          { id: 'affix_grant', name: '词缀赋予', cooldown: 20000, notes: '为小怪赋随机词缀' },
        ],
      },
      {
        name: '混沌本源',
        hpThresholdFrom: 0.0,
        hpThresholdTo: 0.3,
        skills: [
          { id: 'chaos_dash', name: '混沌突袭', cooldown: 8000, notes: '高速冲刺留轨迹' },
          { id: 'ultimate_affixes', name: '终极词缀', cooldown: 22000, notes: '同时获得3个随机词缀' },
          { id: 'chaos_assimilation', name: '混沌同化', cooldown: 1, notes: '血量越低攻速越快，最高+100%' },
        ],
      },
    ],
  },
}


