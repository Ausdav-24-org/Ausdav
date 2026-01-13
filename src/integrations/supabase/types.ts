export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          allow_signup: boolean;
          batch: number | null;
          allow_exam_applications: boolean;
          allow_results_view: boolean;
          allow_finance_submissions: boolean;
          id: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allow_signup?: boolean;
          batch?: number | null;
          allow_exam_applications?: boolean;
          allow_results_view?: boolean;
          allow_finance_submissions?: boolean;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allow_signup?: boolean;
          batch?: number | null;
          allow_exam_applications?: boolean;
          allow_results_view?: boolean;
          allow_finance_submissions?: boolean;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      admin_permissions: {
        Row: {
          created_at: string;
          description: string | null;
          display_name: string;
          id: string;
          is_enabled: boolean;
          permission_key: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          display_name: string;
          id?: string;
          is_enabled?: boolean;
          permission_key: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          display_name?: string;
          id?: string;
          is_enabled?: boolean;
          permission_key?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      announcements: {
        Row: {
          created_at: string;
          created_by: string | null;
          cta_label: string | null;
          end_at: string | null;
          id: string;
          is_active: boolean;
          link_url: string | null;
          message_en: string | null;
          message_ta: string | null;
          priority: number;
          start_at: string | null;
          tag: string | null;
          title_en: string;
          title_ta: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          cta_label?: string | null;
          end_at?: string | null;
          id?: string;
          is_active?: boolean;
          link_url?: string | null;
          message_en?: string | null;
          message_ta?: string | null;
          priority?: number;
          start_at?: string | null;
          tag?: string | null;
          title_en: string;
          title_ta?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          cta_label?: string | null;
          end_at?: string | null;
          id?: string;
          is_active?: boolean;
          link_url?: string | null;
          message_en?: string | null;
          message_ta?: string | null;
          priority?: number;
          start_at?: string | null;
          tag?: string | null;
          title_en?: string;
          title_ta?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: Json | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          created_at: string;
          created_by: string | null;
          description_en: string | null;
          description_ta: string | null;
          event_date: string;
          id: string;
          image_url: string | null;
          is_active: boolean;
          location: string | null;
          title_en: string;
          title_ta: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description_en?: string | null;
          description_ta?: string | null;
          event_date: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          title_en: string;
          title_ta?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description_en?: string | null;
          description_ta?: string | null;
          event_date?: string;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          location?: string | null;
          title_en?: string;
          title_ta?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      finance: {
        Row: {
          fin_id: number;
          exp_type: Database["public"]["Enums"]["finance_direction"];
          party_role: Database["public"]["Enums"]["finance_party_role"];
          category: string;
          amount: number;
          created_at: string;
          updated_at: string;
          description: string;
          photo_bucket: string;
          photo_path: string | null;
          approved: boolean;
          submitted_by: string | null;
          verified_by: string | null;
          verified_at: string | null;
          rejection_reason: string | null;
          txn_date: string | null;
        };
        Insert: {
          fin_id?: number;
          exp_type: Database["public"]["Enums"]["finance_direction"];
          party_role: Database["public"]["Enums"]["finance_party_role"];
          category: string;
          amount: number;
          created_at?: string;
          updated_at?: string;
          description: string;
          photo_bucket?: string;
          photo_path?: string | null;
          approved?: boolean;
          submitted_by?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          txn_date?: string | null;
        };
        Update: {
          fin_id?: number;
          exp_type?: Database["public"]["Enums"]["finance_direction"];
          party_role?: Database["public"]["Enums"]["finance_party_role"];
          category?: string;
          amount?: number;
          created_at?: string;
          updated_at?: string;
          description?: string;
          photo_bucket?: string;
          photo_path?: string | null;
          approved?: boolean;
          submitted_by?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          txn_date?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          batch: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          mfa_enabled: boolean;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          batch?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id?: string;
          is_active?: boolean;
          mfa_enabled?: boolean;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          batch?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          mfa_enabled?: boolean;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      members: {
        Row: {
          auth_user_id: string | null;
          batch: number;
          created_at: string;
          designation: string;
          fullname: string;
          gender: boolean;
          mem_id: number;
          nic: string;
          phone: string;
          profile_bucket: string;
          profile_path: string | null;
          role: Database["public"]["Enums"]["app_role"];
          school: string;
          uni_degree: string | null;
          university: string;
          updated_at: string;
          username: string;
        };
        Insert: {
          auth_user_id?: string | null;
          batch: number;
          created_at?: string;
          designation: string;
          fullname: string;
          gender: boolean;
          mem_id?: number;
          nic: string;
          phone: string;
          profile_bucket?: string;
          profile_path?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          school: string;
          uni_degree?: string | null;
          university: string;
          updated_at?: string;
          username: string;
        };
        Update: {
          auth_user_id?: string | null;
          batch?: number;
          created_at?: string;
          designation?: string;
          fullname?: string;
          gender?: boolean;
          mem_id?: number;
          nic?: string;
          phone?: string;
          profile_bucket?: string;
          profile_path?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          school?: string;
          uni_degree?: string | null;
          university?: string;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      past_papers: {
        Row: {
          created_at: string;
          exam_paper_bucket: string;
          exam_paper_path: string | null;
          pp_id: number;
          scheme_bucket: string;
          scheme_path: string | null;
          subject: string;
          updated_at: string;
          yrs: number;
        };
        Insert: {
          created_at?: string;
          exam_paper_bucket?: string;
          exam_paper_path?: string | null;
          pp_id?: number;
          scheme_bucket?: string;
          scheme_path?: string | null;
          subject: string;
          updated_at?: string;
          yrs: number;
        };
        Update: {
          created_at?: string;
          exam_paper_bucket?: string;
          exam_paper_path?: string | null;
          pp_id?: number;
          scheme_bucket?: string;
          scheme_path?: string | null;
          subject?: string;
          updated_at?: string;
          yrs?: number;
        };
        Relationships: [];
      };
      seminars: {
        Row: {
          created_at: string;
          seminar_paper_bucket: string;
          seminar_paper_path: string | null;
          sem_id: number;
          answers_bucket: string;
          answers_path: string | null;
          updated_at: string;
          yrs: number;
        };
        Insert: {
          created_at?: string;
          seminar_paper_bucket?: string;
          seminar_paper_path?: string | null;
          sem_id?: number;
          answers_bucket?: string;
          answers_path?: string | null;
          updated_at?: string;
          yrs: number;
        };
        Update: {
          created_at?: string;
          seminar_paper_bucket?: string;
          seminar_paper_path?: string | null;
          sem_id?: number;
          answers_bucket?: string;
          answers_path?: string | null;
          updated_at?: string;
          yrs?: number;
        };
        Relationships: [];
      };
      index_counters: {
        Row: {
          last_sequence: number;
          year: number;
        };
        Insert: {
          last_sequence?: number;
          year: number;
        };
        Update: {
          last_sequence?: number;
          year?: number;
        };
        Relationships: [];
      };
      admin_granted_permissions: {
        Row: {
          admin_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          permission_key: string;
          updated_at: string;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          permission_key: string;
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          permission_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      applicants: {
        Row: {
          index_no: string;
          created_at: string;
          email: string;
          fullname: string;
          gender: boolean;
          nic: string;
          phone: string;
          school: string;
          stream: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          index_no?: string;
          created_at?: string;
          email: string;
          fullname: string;
          gender: boolean;
          nic: string;
          phone: string;
          school: string;
          stream: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          index_no?: string;
          created_at?: string;
          email?: string;
          fullname?: string;
          gender?: boolean;
          nic?: string;
          phone?: string;
          school?: string;
          stream?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
      results: {
        Row: {
          application_id: string;
          bio_marks: number | null;
          chemistry_marks: number | null;
          created_at: string;
          maths_marks: number | null;
          physics_marks: number | null;
          result_id: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          application_id: string;
          bio_marks?: number | null;
          chemistry_marks?: number | null;
          created_at?: string;
          maths_marks?: number | null;
          physics_marks?: number | null;
          result_id?: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          application_id?: string;
          bio_marks?: number | null;
          chemistry_marks?: number | null;
          created_at?: string;
          maths_marks?: number | null;
          physics_marks?: number | null;
          result_id?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
      permission_requests: {
        Row: {
          admin_id: string;
          created_at: string;
          id: string;
          permission_key: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          admin_id: string;
          created_at?: string;
          id?: string;
          permission_key: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          admin_id?: string;
          created_at?: string;
          id?: string;
          permission_key?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patrons: {
        Row: {
          created_at: string;
          designation: string;
          display_order: number | null;
          id: string;
          image_alt: string | null;
          image_paths: string[] | null;
          is_active: boolean;
          linkedin_id: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          designation: string;
          display_order?: number | null;
          id?: string;
          image_alt?: string | null;
          image_paths?: string[] | null;
          is_active?: boolean;
          linkedin_id?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          designation?: string;
          display_order?: number | null;
          id?: string;
          image_alt?: string | null;
          image_paths?: string[] | null;
          is_active?: boolean;
          linkedin_id?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      galleries: {
        Row: {
          caption: string | null;
          created_at: string;
          event_id: string;
          file_path: string;
          id: string;
          sort_order: number | null;
          updated_at: string;
        };
        Insert: {
          caption?: string | null;
          created_at?: string;
          event_id: string;
          file_path: string;
          id?: string;
          sort_order?: number | null;
          updated_at?: string;
        };
        Update: {
          caption?: string | null;
          created_at?: string;
          event_id?: string;
          file_path?: string;
          id?: string;
          sort_order?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_actions: {
        Row: {
          id: string;
          year: number;
          event: string;
          bucket_id: string;
          object_path: string;
          file_name: string | null;
          file_size: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          event: string;
          bucket_id: string;
          object_path: string;
          file_name?: string | null;
          file_size?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          event?: string;
          bucket_id?: string;
          object_path?: string;
          file_name?: string | null;
          file_size?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      quiz_mcq: {
        Row: {
          id: number;
          question_text: string;
          language: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          question_text: string;
          language?: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          question_text?: string;
          language?: string;
          option_a?: string;
          option_b?: string;
          option_c?: string;
          option_d?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      bulk_insert_applicants: {
        Args: { p_applicants: Json; p_year: number };
        Returns: Json;
      };
      check_nic_exists: {
        Args: { p_nic: string };
        Returns: boolean;
      };
      compute_results_rankings: {
        Args: { p_year: number; p_stream: string };
        Returns: void;
      };
      get_user_role: {
        Args: { _user_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      insert_applicant: {
        Args: {
          p_fullname: string;
          p_gender: boolean;
          p_stream: string;
          p_nic: string;
          p_phone: string;
          p_email: string;
          p_school: string;
          p_year: number;
        };
        Returns: string;
      };
      is_admin_or_super: { Args: { _user_id: string }; Returns: boolean };
      log_audit_event: {
        Args: {
          _action: string;
          _details?: Json;
          _entity_id?: string;
          _entity_type: string;
        };
        Returns: string;
      };
      set_member_roles: {
        Args: {
          p_ids: string[];
          p_role: Database["public"]["Enums"]["app_role"];
        };
        Returns: {
          mem_id: number;
          role: Database["public"]["Enums"]["app_role"];
        }[];
      };
    };
    Enums: {
      app_role: "member" | "honourable" | "admin" | "super_admin";
      finance_direction: "income" | "expense";
      finance_party_role: "payer" | "payee";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["member", "honourable", "admin", "super_admin"],
      finance_direction: ["income", "expense"],
      finance_party_role: ["payer", "payee"],
    },
  },
} as const;
