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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      autopay_settings: {
        Row: {
          active_days: string[] | null
          age_range: string | null
          car_type: string[] | null
          city: string | null
          created_at: string
          credit_score_max: number | null
          credit_score_min: number | null
          dealer_id: string
          distance: string | null
          enabled: boolean | null
          end_time: string | null
          id: string
          income_max: number | null
          income_min: number | null
          leads_per_day: number | null
          loan_type: string | null
          price_range_max: number | null
          price_range_min: number | null
          start_time: string | null
          state: string | null
          updated_at: string
          vehicle_search: string | null
        }
        Insert: {
          active_days?: string[] | null
          age_range?: string | null
          car_type?: string[] | null
          city?: string | null
          created_at?: string
          credit_score_max?: number | null
          credit_score_min?: number | null
          dealer_id: string
          distance?: string | null
          enabled?: boolean | null
          end_time?: string | null
          id?: string
          income_max?: number | null
          income_min?: number | null
          leads_per_day?: number | null
          loan_type?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          start_time?: string | null
          state?: string | null
          updated_at?: string
          vehicle_search?: string | null
        }
        Update: {
          active_days?: string[] | null
          age_range?: string | null
          car_type?: string[] | null
          city?: string | null
          created_at?: string
          credit_score_max?: number | null
          credit_score_min?: number | null
          dealer_id?: string
          distance?: string | null
          enabled?: boolean | null
          end_time?: string | null
          id?: string
          income_max?: number | null
          income_min?: number | null
          leads_per_day?: number | null
          loan_type?: string | null
          price_range_max?: number | null
          price_range_min?: number | null
          start_time?: string | null
          state?: string | null
          updated_at?: string
          vehicle_search?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "autopay_settings_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_promo_codes: {
        Row: {
          applied_at: string
          dealer_id: string
          id: string
          promo_code_id: string
        }
        Insert: {
          applied_at?: string
          dealer_id: string
          id?: string
          promo_code_id: string
        }
        Update: {
          applied_at?: string
          dealer_id?: string
          id?: string
          promo_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_promo_codes_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_subscription_usage: {
        Row: {
          created_at: string
          dealer_id: string
          id: string
          leads_limit: number
          leads_used: number
          period_start: string
        }
        Insert: {
          created_at?: string
          dealer_id: string
          id?: string
          leads_limit: number
          leads_used?: number
          period_start: string
        }
        Update: {
          created_at?: string
          dealer_id?: string
          id?: string
          leads_limit?: number
          leads_used?: number
          period_start?: string
        }
        Relationships: []
      }
      dealers: {
        Row: {
          address: string | null
          approval_status: string
          autopay_enabled: boolean | null
          business_type: string | null
          contact_person: string
          created_at: string
          dealership_name: string
          email: string
          id: string
          notification_email: string | null
          phone: string | null
          profile_picture_url: string | null
          province: string | null
          subscription_tier: string
          updated_at: string
          user_id: string
          wallet_balance: number
          webhook_secret: string | null
          webhook_url: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          approval_status?: string
          autopay_enabled?: boolean | null
          business_type?: string | null
          contact_person: string
          created_at?: string
          dealership_name: string
          email: string
          id?: string
          notification_email?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          province?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id: string
          wallet_balance?: number
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          approval_status?: string
          autopay_enabled?: boolean | null
          business_type?: string | null
          contact_person?: string
          created_at?: string
          dealership_name?: string
          email?: string
          id?: string
          notification_email?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          province?: string | null
          subscription_tier?: string
          updated_at?: string
          user_id?: string
          wallet_balance?: number
          webhook_secret?: string | null
          webhook_url?: string | null
          website?: string | null
        }
        Relationships: []
      }
      delivery_logs: {
        Row: {
          attempted_at: string
          channel: string
          endpoint: string | null
          error_details: string | null
          id: string
          payload_summary: string | null
          purchase_id: string
          response_code: number | null
          success: boolean | null
        }
        Insert: {
          attempted_at?: string
          channel: string
          endpoint?: string | null
          error_details?: string | null
          id?: string
          payload_summary?: string | null
          purchase_id: string
          response_code?: number | null
          success?: boolean | null
        }
        Update: {
          attempted_at?: string
          channel?: string
          endpoint?: string | null
          error_details?: string | null
          id?: string
          payload_summary?: string | null
          purchase_id?: string
          response_code?: number | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_logs_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_score: number | null
          appointment_time: string | null
          buyer_type: string | null
          city: string | null
          created_at: string
          credit_range_max: number | null
          credit_range_min: number | null
          document_files: Json | null
          documents: string[] | null
          email: string | null
          first_name: string
          has_bankruptcy: boolean | null
          id: string
          income: number | null
          last_name: string
          notes: string | null
          phone: string | null
          price: number
          province: string | null
          quality_grade: string | null
          reference_code: string
          sold_at: string | null
          sold_status: string
          sold_to_dealer_id: string | null
          trade_in: boolean | null
          vehicle_mileage: number | null
          vehicle_preference: string | null
          vehicle_price: number | null
        }
        Insert: {
          ai_score?: number | null
          appointment_time?: string | null
          buyer_type?: string | null
          city?: string | null
          created_at?: string
          credit_range_max?: number | null
          credit_range_min?: number | null
          document_files?: Json | null
          documents?: string[] | null
          email?: string | null
          first_name: string
          has_bankruptcy?: boolean | null
          id?: string
          income?: number | null
          last_name: string
          notes?: string | null
          phone?: string | null
          price: number
          province?: string | null
          quality_grade?: string | null
          reference_code: string
          sold_at?: string | null
          sold_status?: string
          sold_to_dealer_id?: string | null
          trade_in?: boolean | null
          vehicle_mileage?: number | null
          vehicle_preference?: string | null
          vehicle_price?: number | null
        }
        Update: {
          ai_score?: number | null
          appointment_time?: string | null
          buyer_type?: string | null
          city?: string | null
          created_at?: string
          credit_range_max?: number | null
          credit_range_min?: number | null
          document_files?: Json | null
          documents?: string[] | null
          email?: string | null
          first_name?: string
          has_bankruptcy?: boolean | null
          id?: string
          income?: number | null
          last_name?: string
          notes?: string | null
          phone?: string | null
          price?: number
          province?: string | null
          quality_grade?: string | null
          reference_code?: string
          sold_at?: string | null
          sold_status?: string
          sold_to_dealer_id?: string | null
          trade_in?: boolean | null
          vehicle_mileage?: number | null
          vehicle_preference?: string | null
          vehicle_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_sold_to_dealer_id_fkey"
            columns: ["sold_to_dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          dealer_id: string
          id: string
          link: string | null
          message: string | null
          read: boolean
          title: string
        }
        Insert: {
          created_at?: string
          dealer_id: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title: string
        }
        Update: {
          created_at?: string
          dealer_id?: string
          id?: string
          link?: string | null
          message?: string | null
          read?: boolean
          title?: string
        }
        Relationships: []
      }
      payment_gateways: {
        Row: {
          config: Json
          display_name: string
          enabled: boolean
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          config?: Json
          display_name: string
          enabled?: boolean
          id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          display_name?: string
          enabled?: boolean
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          completed_at: string | null
          created_at: string
          dealer_id: string
          gateway: string
          gateway_reference: string | null
          id: string
          status: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          completed_at?: string | null
          created_at?: string
          dealer_id: string
          gateway: string
          gateway_reference?: string | null
          id?: string
          status?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          completed_at?: string | null
          created_at?: string
          dealer_id?: string
          gateway?: string
          gateway_reference?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      plan_features: {
        Row: {
          feature_text: string
          id: string
          plan_id: string
          sort_order: number
        }
        Insert: {
          feature_text: string
          id?: string
          plan_id: string
          sort_order?: number
        }
        Update: {
          feature_text?: string
          id?: string
          plan_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          value: string | null
        }
        Insert: {
          key: string
          value?: string | null
        }
        Update: {
          key?: string
          value?: string | null
        }
        Relationships: []
      }
      promo_code_usage: {
        Row: {
          created_at: string
          dealer_id: string
          id: string
          lead_id: string
          original_price: number
          price_paid: number
          promo_code_id: string
        }
        Insert: {
          created_at?: string
          dealer_id: string
          id?: string
          lead_id: string
          original_price: number
          price_paid: number
          promo_code_id: string
        }
        Update: {
          created_at?: string
          dealer_id?: string
          id?: string
          lead_id?: string
          original_price?: number
          price_paid?: number
          promo_code_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_code_usage_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number | null
          expires_at: string | null
          flat_price: number
          id: string
          is_active: boolean
          max_uses: number | null
          times_used: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number | null
          expires_at?: string | null
          flat_price: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          times_used?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number | null
          expires_at?: string | null
          flat_price?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          times_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          dealer_id: string
          dealer_tier_at_purchase: string | null
          delivery_method: string | null
          delivery_status: string
          id: string
          lead_id: string
          price_paid: number
          purchased_at: string
        }
        Insert: {
          dealer_id: string
          dealer_tier_at_purchase?: string | null
          delivery_method?: string | null
          delivery_status?: string
          id?: string
          lead_id: string
          price_paid: number
          purchased_at?: string
        }
        Update: {
          dealer_id?: string
          dealer_tier_at_purchase?: string | null
          delivery_method?: string | null
          delivery_status?: string
          id?: string
          lead_id?: string
          price_paid?: number
          purchased_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          accent_color: string
          created_at: string
          delay_hours: number
          glow_color: string
          id: string
          is_active: boolean
          is_popular: boolean
          leads_per_month: number
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          accent_color?: string
          created_at?: string
          delay_hours?: number
          glow_color?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          leads_per_month?: number
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string
          created_at?: string
          delay_hours?: number
          glow_color?: string
          id?: string
          is_active?: boolean
          is_popular?: boolean
          leads_per_month?: number
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          billing_cycle: string | null
          created_at: string
          dealer_id: string
          delay_hours: number | null
          end_date: string | null
          id: string
          leads_per_month: number | null
          plan_id: string | null
          price: number
          start_date: string
          status: string
          stripe_subscription_id: string | null
          tier: string
        }
        Insert: {
          auto_renew?: boolean | null
          billing_cycle?: string | null
          created_at?: string
          dealer_id: string
          delay_hours?: number | null
          end_date?: string | null
          id?: string
          leads_per_month?: number | null
          plan_id?: string | null
          price: number
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          tier?: string
        }
        Update: {
          auto_renew?: boolean | null
          billing_cycle?: string | null
          created_at?: string
          dealer_id?: string
          delay_hours?: number | null
          end_date?: string | null
          id?: string
          leads_per_month?: number | null
          plan_id?: string | null
          price?: number
          start_date?: string
          status?: string
          stripe_subscription_id?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          dealer_id: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          dealer_id: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          dealer_id?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_marketplace_leads: {
        Args: { requesting_dealer_id?: string }
        Returns: {
          ai_score: number
          appointment_time: string
          buyer_type: string
          city: string
          created_at: string
          credit_range_max: number
          credit_range_min: number
          documents: string[]
          email: string
          first_name: string
          has_bankruptcy: boolean
          id: string
          income: number
          last_name: string
          notes: string
          phone: string
          price: number
          province: string
          quality_grade: string
          reference_code: string
          sold_at: string
          sold_status: string
          sold_to_dealer_id: string
          trade_in: boolean
          vehicle_mileage: number
          vehicle_preference: string
          vehicle_price: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
