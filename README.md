# 层叠秘境 - 轻量级爬塔冒险游戏

《层叠秘境》是一款以"极简操作" + "深度构建"为核心的轻量级爬塔冒险游戏。玩家将在20层秘境中挑战时间与策略的极限，通过"三选一"的被动属性叠加，构筑独一无二的战斗风格。

## 游戏特色

- **极简操作**: WASD移动，自动攻击，专注策略构筑
- **深度构建**: 9种被动属性，乘法加法组合，策略深度极高
- **公平竞技**: 统一赛季种子，消除运气差异，纯策略比拼
- **可持续复玩**: 每周主题变化，保持内容新鲜感

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + Pinia
- **后端**: Supabase (PostgreSQL + Auth + Edge Functions)
- **自动化**: n8n (赛季更新、数据统计)
- **渲染**: Canvas 2D API
- **部署**: Vercel/Netlify

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 环境配置

1. 复制环境变量文件：
```bash
cp env.example .env
```

2. 配置 Supabase：
   - 创建 Supabase 项目
   - 获取项目 URL 和匿名密钥
   - 更新 `.env` 文件中的配置

### 开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看游戏。

### 构建生产版本

```bash
npm run build
```

## 项目结构

```
src/
├── components/          # Vue 组件
├── views/              # 页面视图
├── stores/             # Pinia 状态管理
├── types/              # TypeScript 类型定义
├── utils/               # 工具函数
└── game/               # 游戏核心逻辑
    ├── core/           # 游戏引擎
    ├── entities/       # 游戏实体
    ├── systems/        # 游戏系统
    └── ui/             # 游戏UI组件
```

## 游戏系统

### 被动属性系统

游戏包含9种基础被动属性：

1. **攻速提升** (AS%): 攻击速度 +20%
2. **伤害增强** (DMG%): 攻击伤害 +25%
3. **暴击几率** (CRIT%): 暴击率 +15%
4. **投射物+1** (PROJ): 同时发射投射物数量 +1
5. **穿透+1** (PIERCE): 投射物穿透次数 +1
6. **生命回复** (REGEN): 每秒回复 5 点生命值
7. **最大生命** (HP+): 最大生命值 +50
8. **移动速度** (MS%): 移动速度 +30%
9. **生命偷取** (LIFESTEAL%): 攻击命中后回复伤害的 5%

### 协同效果

- 投射物 + 穿透：降低攻击间隔惩罚
- 暴击 + 攻速：暴击时重置攻击间隔
- 回复 + 偷取：低血量时偷取效率提升

## 数据库设计

### 主要表结构

- `players`: 玩家信息
- `seasons`: 赛季配置
- `game_sessions`: 游戏会话记录
- `leaderboard`: 排行榜数据

### Edge Functions

- `get_leaderboard`: 获取排行榜数据
- `update_player_rank`: 更新玩家排名

## 部署指南

### Supabase 设置

1. 创建 Supabase 项目
2. 执行数据库迁移脚本
3. 配置 RLS 策略
4. 部署 Edge Functions

### n8n 自动化

1. 设置 n8n 实例
2. 配置赛季更新工作流
3. 设置数据统计任务

### 前端部署

#### Netlify 部署（推荐）

项目已配置 `netlify.toml`，可以直接部署到 Netlify：

**方法一：通过 Git 仓库部署（推荐）**
1. 将代码推送到 GitHub/GitLab/Bitbucket
2. 登录 [Netlify](https://app.netlify.com)
3. 点击 "Add new site" -> "Import an existing project"
4. 选择你的 Git 仓库
5. Netlify 会自动检测配置：
   - Build command: `npm run build`
   - Publish directory: `dist`
6. 在 "Environment variables" 中添加：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. 点击 "Deploy site"

**方法二：通过 Netlify CLI**
```bash
# 安装 Netlify CLI
npm install -g netlify-cli

# 登录 Netlify
netlify login

# 构建项目
npm run build

# 部署到 Netlify
netlify deploy --prod
```

**方法三：手动部署**
1. 构建项目：`npm run build`
2. 登录 Netlify 控制台
3. 拖拽 `dist` 目录到 Netlify 部署区域

#### Vercel 部署

如果需要部署到 Vercel，项目也包含 `vercel.json` 配置：

```bash
npm install -g vercel
vercel --prod
```

**注意：** 记得在部署平台设置环境变量 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

## 开发指南

### 添加新的被动属性

1. 在 `src/types/game.ts` 中添加属性定义
2. 在 `GameEngine.ts` 中实现属性效果
3. 更新 UI 显示逻辑

### 自定义敌人类型

1. 在 `src/game/entities/` 中创建敌人类
2. 在 `GameEngine.ts` 中注册敌人类型
3. 实现敌人的 AI 行为

### 添加新的游戏模式

1. 扩展 `GameState` 接口
2. 在 `GameEngine` 中实现新模式逻辑
3. 更新 UI 组件

## 性能优化

- 实体数量限制在150个以内
- 目标帧率60FPS
- 使用对象池管理投射物和敌人
- Canvas 渲染优化

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或联系开发团队。

