// Supabase 数据库类型定义

export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      seasons: {
        Row: {
          id: string
          name: string
          theme: string
          seed: string
          start_date: string
          end_date: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          theme: string
          seed: string
          start_date: string
          end_date: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          theme?: string
          seed?: string
          start_date?: string
          end_date?: string
          is_active?: boolean
          created_at?: string
        }
      }
      game_sessions: {
        Row: {
          id: string
          player_id: string
          season_id: string
          level: number
          score: number
          time: number
          build: string[]
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          season_id: string
          level: number
          score: number
          time: number
          build: string[]
          created_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          season_id?: string
          level?: number
          score?: number
          time?: number
          build?: string[]
          created_at?: string
        }
      }
      leaderboard: {
        Row: {
          id: string
          player_id: string
          season_id: string
          rank: number
          score: number
          level: number
          time: number
          build: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          player_id: string
          season_id: string
          rank: number
          score: number
          level: number
          time: number
          build: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          season_id?: string
          rank?: number
          score?: number
          level?: number
          time?: number
          build?: string[]
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_leaderboard: {
        Args: {
          season_id: string
          limit?: number
        }
        Returns: {
          id: string
          player_name: string
          score: number
          level: number
          time: number
          build: string[]
          rank: number
        }[]
      }
      update_player_rank: {
        Args: {
          player_id: string
          season_id: string
          score: number
          level: number
          time: number
          build: string[]
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

