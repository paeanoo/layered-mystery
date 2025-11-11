-- 修复排行榜显示玩家名称问题
-- 问题：players 表的 RLS 策略只允许用户查看自己的数据，导致排行榜无法显示其他玩家的名称
-- 解决方案：添加策略允许所有认证用户查看所有玩家的名称（用于排行榜显示）

-- 添加策略：允许所有认证用户查看所有玩家的名称
DROP POLICY IF EXISTS "Players names are viewable by authenticated users" ON players;
CREATE POLICY "Players names are viewable by authenticated users" ON players
    FOR SELECT USING (auth.role() = 'authenticated');

-- 同时更新 get_leaderboard 函数，使用 SECURITY DEFINER 确保可以访问所有玩家数据
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

