-- ============================================
-- 🔧 必须执行的修复SQL（解决所有问题）
-- ============================================
-- 
-- 执行步骤：
-- 1. 打开 Supabase Dashboard → SQL Editor
-- 2. 复制下面的所有SQL代码
-- 3. 粘贴并点击 "Run"
--
-- ============================================

-- 【修复1】强制修复 time/play_time 列问题（确保使用 time 列）
DO $$
BEGIN
    -- 修复 leaderboard 表：确保使用 time 列而不是 play_time
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'leaderboard' 
        AND column_name = 'play_time'
    ) THEN
        -- 如果存在 play_time 列，需要处理
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'leaderboard' 
            AND column_name = 'time'
        ) THEN
            -- 如果 time 列也存在，需要合并数据后删除 play_time
            -- 先更新 time 列的值（如果 time 为空但 play_time 有值）
            UPDATE leaderboard 
            SET "time" = play_time 
            WHERE "time" IS NULL OR "time" = 0;
            -- 然后删除 play_time 列
            ALTER TABLE leaderboard DROP COLUMN play_time;
            RAISE NOTICE '✅ 已删除 leaderboard.play_time 列（time 列已存在且数据已合并）';
        ELSE
            -- 如果只有 play_time 列，重命名为 time
            ALTER TABLE leaderboard RENAME COLUMN play_time TO "time";
            RAISE NOTICE '✅ 已重命名 leaderboard.play_time 为 time';
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'leaderboard' 
        AND column_name = 'time'
    ) THEN
        -- 如果既没有 play_time 也没有 time，创建 time 列
        ALTER TABLE leaderboard ADD COLUMN "time" DECIMAL(10,2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ 已添加 leaderboard.time 列';
    ELSE
        RAISE NOTICE '✅ leaderboard.time 列已存在，无需修复';
    END IF;

    -- 强制修复 game_sessions 表：确保使用 time 列而不是 play_time
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'play_time'
    ) THEN
        -- 如果存在 play_time 列，需要处理
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'game_sessions' 
            AND column_name = 'time'
        ) THEN
            -- 如果 time 列也存在，需要合并数据后删除 play_time
            -- 先更新 time 列的值（如果 time 为空但 play_time 有值）
            UPDATE game_sessions 
            SET "time" = play_time 
            WHERE "time" IS NULL OR "time" = 0;
            -- 然后删除 play_time 列
            ALTER TABLE game_sessions DROP COLUMN play_time;
            RAISE NOTICE '✅ 已删除 game_sessions.play_time 列（time 列已存在且数据已合并）';
        ELSE
            -- 如果只有 play_time 列，重命名为 time
            ALTER TABLE game_sessions RENAME COLUMN play_time TO "time";
            RAISE NOTICE '✅ 已重命名 game_sessions.play_time 为 time';
        END IF;
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name = 'time'
    ) THEN
        -- 如果既没有 play_time 也没有 time，创建 time 列
        ALTER TABLE game_sessions ADD COLUMN "time" DECIMAL(10,2) NOT NULL DEFAULT 0;
        RAISE NOTICE '✅ 已添加 game_sessions.time 列';
    ELSE
        RAISE NOTICE '✅ game_sessions.time 列已存在，无需修复';
    END IF;
END $$;

-- 【修复2】添加 players 表的 INSERT 策略（解决无法创建玩家记录，错误码 42501）
DROP POLICY IF EXISTS "Players can insert own data" ON players;
CREATE POLICY "Players can insert own data" ON players
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 【修复3】修复 update_player_rank 函数权限（添加 SECURITY DEFINER）
-- 先删除所有可能存在的旧版本函数（不同参数签名）
DROP FUNCTION IF EXISTS update_player_rank(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT[]);
DROP FUNCTION IF EXISTS update_player_rank(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT[]) CASCADE;
-- 删除其他可能的旧版本（如果有）
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure as func_name
        FROM pg_proc
        WHERE proname = 'update_player_rank'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_name || ' CASCADE';
        RAISE NOTICE '已删除旧函数: %', r.func_name;
    END LOOP;
END $$;

-- 创建新函数（确保在 public schema 中）
CREATE OR REPLACE FUNCTION public.update_player_rank(
    player_id_param UUID,
    season_id_param UUID,
    score_param INTEGER,
    level_param INTEGER,
    time_param DECIMAL(10,2),
    build_param TEXT[]
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- 【验证】检查所有策略是否创建成功
SELECT 
    tablename as 表名,
    policyname as 策略名称,
    cmd as 操作类型
FROM pg_policies
WHERE tablename IN ('players', 'game_sessions', 'leaderboard')
ORDER BY tablename, policyname;

-- 【验证】检查 update_player_rank 函数是否存在
SELECT 
    routine_name as 函数名,
    routine_type as 函数类型,
    data_type as 返回类型
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'update_player_rank';

-- 【诊断】列出所有 update_player_rank 函数版本（包括参数）
SELECT 
    p.proname as 函数名,
    pg_get_function_identity_arguments(p.oid) as 参数列表,
    pg_get_function_result(p.oid) as 返回类型,
    p.prosecdef as 是否安全定义者
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'update_player_rank';

-- 【重要】授予函数执行权限（确保所有认证用户都可以调用）
GRANT EXECUTE ON FUNCTION public.update_player_rank(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_player_rank(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION public.update_player_rank(UUID, UUID, INTEGER, INTEGER, DECIMAL, TEXT[]) TO public;

-- 【重要】刷新 Supabase schema cache（可能需要等待几秒钟）
-- 注意：Supabase 会自动刷新，但可能需要等待几秒
-- 如果还是 404，请等待 10-30 秒后重试

-- 【手动刷新提示】
-- 如果执行后仍然出现 404 错误，请尝试以下方法：
-- 1. 等待 10-30 秒后刷新浏览器页面
-- 2. 在 Supabase Dashboard 中：Database → Functions，查看函数是否存在
-- 3. 如果函数存在但仍然 404，尝试在 Supabase Dashboard 中手动刷新 schema cache
-- 4. 或者重新部署项目（如果使用 CI/CD）

-- ✅ 执行完成后，刷新浏览器页面，应该可以正常保存分数了！
