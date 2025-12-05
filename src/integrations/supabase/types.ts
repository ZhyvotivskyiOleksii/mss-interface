export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_invitations: {
        Row: {
          accepted_at: string | null
          access_level: Database["public"]["Enums"]["access_level"] | null
          email: string
          id: string
          invited_at: string | null
          mss_account_id: string | null
          status: string | null
        }
        Insert: {
          accepted_at?: string | null
          access_level?: Database["public"]["Enums"]["access_level"] | null
          email: string
          id?: string
          invited_at?: string | null
          mss_account_id?: string | null
          status?: string | null
        }
        Update: {
          accepted_at?: string | null
          access_level?: Database["public"]["Enums"]["access_level"] | null
          email?: string
          id?: string
          invited_at?: string | null
          mss_account_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_invitations_mss_account_id_fkey"
            columns: ["mss_account_id"]
            isOneToOne: false
            referencedRelation: "mss_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      google_ads_accounts: {
        Row: {
          created_at: string | null
          currency_code: string
          customer_id: string
          id: string
          mss_account_id: string | null
          status: Database["public"]["Enums"]["account_status"] | null
          timezone: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency_code: string
          customer_id: string
          id?: string
          mss_account_id?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          timezone: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency_code?: string
          customer_id?: string
          id?: string
          mss_account_id?: string | null
          status?: Database["public"]["Enums"]["account_status"] | null
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_accounts_mss_account_id_fkey"
            columns: ["mss_account_id"]
            isOneToOne: false
            referencedRelation: "mss_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      mss_accounts: {
        Row: {
          created_at: string | null
          developer_token: string
          id: string
          manager_email: string
          manager_password: string | null
          mcc_number: string
          name: string
          status: Database["public"]["Enums"]["account_status"] | null
          updated_at: string | null
          google_refresh_token: string | null
          google_connected_email: string | null
          google_connected_at: string | null
        }
        Insert: {
          created_at?: string | null
          developer_token: string
          id?: string
          manager_email: string
          manager_password?: string | null
          mcc_number: string
          name: string
          status?: Database["public"]["Enums"]["account_status"] | null
          updated_at?: string | null
          google_refresh_token?: string | null
          google_connected_email?: string | null
          google_connected_at?: string | null
        }
        Update: {
          created_at?: string | null
          developer_token?: string
          id?: string
          manager_email?: string
          manager_password?: string | null
          mcc_number?: string
          name?: string
          status?: Database["public"]["Enums"]["account_status"] | null
          updated_at?: string | null
          google_refresh_token?: string | null
          google_connected_email?: string | null
          google_connected_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      timezones: {
        Row: {
          country: string | null
          created_at: string | null
          flag_emoji: string | null
          id: string
          name: string
          timezone_offset: string
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          flag_emoji?: string | null
          id?: string
          name: string
          timezone_offset: string
        }
        Update: {
          country?: string | null
          created_at?: string | null
          flag_emoji?: string | null
          id?: string
          name?: string
          timezone_offset?: string
        }
        Relationships: []
      }
      user_favorite_currencies: {
        Row: {
          created_at: string | null
          currency_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          currency_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          currency_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_currencies_currency_id_fkey"
            columns: ["currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      access_level: "admin" | "standard" | "read"
      account_status: "pending" | "active" | "suspended" | "closed"
      app_role: "manager" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      access_level: ["admin", "standard", "read"],
      account_status: ["pending", "active", "suspended", "closed"],
      app_role: ["manager", "client"],
    },
  },
} as const
