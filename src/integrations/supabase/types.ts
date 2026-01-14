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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      change_requests: {
        Row: {
          cost_impact: number | null
          created_at: string
          description: string
          id: string
          image_url: string | null
          project_id: string
          reason: string | null
          resolution_comment: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["change_request_status"]
          time_impact: string | null
          title: string
          type: Database["public"]["Enums"]["change_request_type"]
        }
        Insert: {
          cost_impact?: number | null
          created_at?: string
          description: string
          id?: string
          image_url?: string | null
          project_id: string
          reason?: string | null
          resolution_comment?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          time_impact?: string | null
          title: string
          type?: Database["public"]["Enums"]["change_request_type"]
        }
        Update: {
          cost_impact?: number | null
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          project_id?: string
          reason?: string | null
          resolution_comment?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["change_request_status"]
          time_impact?: string | null
          title?: string
          type?: Database["public"]["Enums"]["change_request_type"]
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          change_request_id: string | null
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          scope_item_id: string | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          change_request_id?: string | null
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          scope_item_id?: string | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          change_request_id?: string | null
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          scope_item_id?: string | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_scope_item_id_fkey"
            columns: ["scope_item_id"]
            isOneToOne: false
            referencedRelation: "scope_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          created_at: string
          due_date: string | null
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          project_id: string
          quote_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          terms: string | null
          total: number | null
          type: Database["public"]["Enums"]["invoice_type"]
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string | null
          paid_at?: string | null
          project_id: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms?: string | null
          total?: number | null
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          project_id?: string
          quote_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms?: string | null
          total?: number | null
          type?: Database["public"]["Enums"]["invoice_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_documents: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string
          stage_order: number
          status: Database["public"]["Enums"]["stage_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id: string
          stage_order?: number
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          stage_order?: number
          status?: Database["public"]["Enums"]["stage_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          active_quote_id: string | null
          client_email: string
          client_name: string
          created_at: string
          id: string
          name: string
          status: Database["public"]["Enums"]["project_status"]
          total_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_quote_id?: string | null
          client_email: string
          client_name: string
          created_at?: string
          id?: string
          name: string
          status?: Database["public"]["Enums"]["project_status"]
          total_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_quote_id?: string | null
          client_email?: string
          client_name?: string
          created_at?: string
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["project_status"]
          total_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_active_quote_id_fkey"
            columns: ["active_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          client_comment: string | null
          created_at: string
          declined_at: string | null
          id: string
          notes: string | null
          project_id: string
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          terms: string | null
          total: number | null
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          client_comment?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          quote_number: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          client_comment?: string | null
          created_at?: string
          declined_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_items: {
        Row: {
          acknowledged: boolean
          category: Database["public"]["Enums"]["scope_category"]
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          image_urls: string[] | null
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          category?: Database["public"]["Enums"]["scope_category"]
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          category?: Database["public"]["Enums"]["scope_category"]
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      change_request_status: "pending" | "approved" | "declined"
      change_request_type: "client_request" | "site_issue" | "substitution"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      invoice_type: "staged" | "final"
      project_status: "draft" | "sent" | "in_progress" | "completed"
      quote_status: "draft" | "sent" | "approved" | "declined" | "revised"
      scope_category: "included" | "excluded" | "assumption"
      stage_status: "upcoming" | "current" | "completed"
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
      change_request_status: ["pending", "approved", "declined"],
      change_request_type: ["client_request", "site_issue", "substitution"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      invoice_type: ["staged", "final"],
      project_status: ["draft", "sent", "in_progress", "completed"],
      quote_status: ["draft", "sent", "approved", "declined", "revised"],
      scope_category: ["included", "excluded", "assumption"],
      stage_status: ["upcoming", "current", "completed"],
    },
  },
} as const
