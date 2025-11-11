-- 层叠秘境数据库初始化脚本

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 玩家表
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 赛季表
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    theme VARCHAR(100) NOT NULL,
    seed VARCHAR(100) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 游戏会话表
CREATE TABLE IF NOT EXISTS game_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1,
    score INTEGER NOT NULL DEFAULT 0,
    "time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    build TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 排行榜表
CREATE TABLE IF NOT EXISTS leaderboard (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    "time" DECIMAL(10,2) NOT NULL DEFAULT 0,
    build TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_game_sessions_player_season ON game_sessions(player_id, season_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_score ON game_sessions(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_season_rank ON leaderboard(season_id, rank);
CREATE INDEX IF NOT EXISTS idx_leaderboard_player_season ON leaderboard(player_id, season_id);

-- 创建更新时间触发器函数
DROP FUNCTION IF EXISTS update_updated_at_column();
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要更新时间的表创建触发器
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leaderboard_updated_at ON leaderboard;
CREATE TRIGGER update_leaderboard_updated_at BEFORE UPDATE ON leaderboard
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 插入默认赛季数据
INSERT INTO seasons (name, theme, seed, start_date, end_date, is_active) VALUES
('第一赛季', '极简风格', 'season1_seed_2024', NOW(), NOW() + INTERVAL '30 days', TRUE);

-- 创建获取排行榜的函数
DROP FUNCTION IF EXISTS get_leaderboard(UUID, INTEGER);
CREATE OR REPLACE FUNCTION get_leaderboard(
    season_id_param UUID,
    limit_param INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    player_name VARCHAR(50),
    score INTEGER,
    level INTEGER,
    "time" DECIMAL(10,2),
    build TEXT[],
    rank INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        COALESCE(p.name, '未知玩家') as player_name,
        l.score,
        l.level,
        l."time",
        l.build,
        ROW_NUMBER() OVER (ORDER BY l.score DESC, l.level DESC, l."time" ASC) as rank
    FROM leaderboard l
    LEFT JOIN players p ON l.player_id = p.id
    WHERE l.season_id = season_id_param
    ORDER BY l.score DESC, l.level DESC, l."time" ASC
    LIMIT limit_param;
END;
$$ LANGUAGE plpgsql;

-- 创建更新玩家排名的函数
DROP FUNCTION IF EXISTS update_player_rank(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT[]);
CREATE OR REPLACE FUNCTION update_player_rank(
    player_id_param UUID,
    season_id_param UUID,
    score_param INTEGER,
    level_param INTEGER,
    time_param DECIMAL(10,2),
    build_param TEXT[]
)
RETURNS INTEGER AS $$
DECLARE
    new_rank INTEGER;
    existing_entry UUID;
BEGIN
    -- 检查是否已存在该玩家的记录
    SELECT id INTO existing_entry
    FROM leaderboard
    WHERE player_id = player_id_param AND season_id = season_id_param;
    
    IF existing_entry IS NOT NULL THEN
        -- 更新现有记录
        UPDATE leaderboard
        SET 
            score = score_param,
            level = level_param,
            "time" = time_param,
            build = build_param,
            updated_at = NOW()
        WHERE id = existing_entry;
    ELSE
        -- 插入新记录
        INSERT INTO leaderboard (player_id, season_id, score, level, "time", build)
        VALUES (player_id_param, season_id_param, score_param, level_param, time_param, build_param);
    END IF;
    
    -- 重新计算排名
    WITH ranked_players AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (ORDER BY score DESC, level DESC, "time" ASC) as new_rank
        FROM leaderboard
        WHERE season_id = season_id_param
    )
    UPDATE leaderboard
    SET rank = rp.new_rank
    FROM ranked_players rp
    WHERE leaderboard.id = rp.id;
    
    -- 返回新排名
    SELECT rank INTO new_rank
    FROM leaderboard
    WHERE player_id = player_id_param AND season_id = season_id_param;
    
    RETURN new_rank;
END;
$$ LANGUAGE plpgsql;

-- 启用行级安全策略
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略
-- 玩家可以查看自己的数据
DROP POLICY IF EXISTS "Players can view own data" ON players;
CREATE POLICY "Players can view own data" ON players
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Players can update own data" ON players;
CREATE POLICY "Players can update own data" ON players
    FOR UPDATE USING (auth.uid() = id);

-- 赛季数据对所有认证用户可见
DROP POLICY IF EXISTS "Seasons are viewable by authenticated users" ON seasons;
CREATE POLICY "Seasons are viewable by authenticated users" ON seasons
    FOR SELECT USING (auth.role() = 'authenticated');

-- 游戏会话数据
DROP POLICY IF EXISTS "Players can insert own game sessions" ON game_sessions;
CREATE POLICY "Players can insert own game sessions" ON game_sessions
    FOR INSERT WITH CHECK (auth.uid() = player_id);

DROP POLICY IF EXISTS "Players can view own game sessions" ON game_sessions;
CREATE POLICY "Players can view own game sessions" ON game_sessions
    FOR SELECT USING (auth.uid() = player_id);

-- 排行榜数据对所有认证用户可见
DROP POLICY IF EXISTS "Leaderboard is viewable by authenticated users" ON leaderboard;
CREATE POLICY "Leaderboard is viewable by authenticated users" ON leaderboard
    FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Players can update own leaderboard entries" ON leaderboard;
CREATE POLICY "Players can update own leaderboard entries" ON leaderboard
    FOR UPDATE USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Players can insert own leaderboard entries" ON leaderboard;
CREATE POLICY "Players can insert own leaderboard entries" ON leaderboard
    FOR INSERT WITH CHECK (auth.uid() = player_id);
