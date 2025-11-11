-- 修复排行榜排名计算：按照分数降序排序
-- 执行此文件以更新数据库函数

-- 更新获取排行榜的函数，按照分数降序排序并重新计算排名
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

