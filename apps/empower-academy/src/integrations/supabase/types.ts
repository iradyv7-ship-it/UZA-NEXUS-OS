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
      assessment_attempts: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          passed: boolean
          score: number
          submitted_at: string
          total: number
          user_id: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          passed: boolean
          score: number
          submitted_at?: string
          total: number
          user_id: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          passed?: boolean
          score?: number
          submitted_at?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          created_at: string
          id: string
          kind: string
          max_attempts: number
          module_id: string | null
          pass_mark: number
          slug: string
          title_en: string
          title_rw: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          max_attempts?: number
          module_id?: string | null
          pass_mark?: number
          slug: string
          title_en: string
          title_rw: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          max_attempts?: number
          module_id?: string | null
          pass_mark?: number
          slug?: string
          title_en?: string
          title_rw?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      attempt_answers: {
        Row: {
          attempt_id: string
          chosen_index: number
          correct: boolean
          created_at: string
          id: string
          question_id: string
        }
        Insert: {
          attempt_id: string
          chosen_index: number
          correct: boolean
          created_at?: string
          id?: string
          question_id: string
        }
        Update: {
          attempt_id?: string
          chosen_index?: number
          correct?: boolean
          created_at?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          id: string
          marked_at: string
          marked_by: string | null
          present: boolean
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          present?: boolean
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          marked_at?: string
          marked_by?: string | null
          present?: boolean
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cohort_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          certificate_id: string
          cohort_id: string | null
          cohort_label: string | null
          created_at: string
          final_score: number | null
          id: string
          issued_on: string
          learner_name: string
          modules_completed: number
          revoked_at: string | null
          revoked_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_id: string
          cohort_id?: string | null
          cohort_label?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          issued_on?: string
          learner_name: string
          modules_completed?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_id?: string
          cohort_id?: string | null
          cohort_label?: string | null
          created_at?: string
          final_score?: number | null
          id?: string
          issued_on?: string
          learner_name?: string
          modules_completed?: number
          revoked_at?: string | null
          revoked_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_sessions: {
        Row: {
          cohort_id: string
          created_at: string
          facilitator_id: string | null
          id: string
          location: string | null
          module_slug: string | null
          scheduled_for: string | null
          title_en: string
          title_rw: string | null
          updated_at: string
        }
        Insert: {
          cohort_id: string
          created_at?: string
          facilitator_id?: string | null
          id?: string
          location?: string | null
          module_slug?: string | null
          scheduled_for?: string | null
          title_en: string
          title_rw?: string | null
          updated_at?: string
        }
        Update: {
          cohort_id?: string
          created_at?: string
          facilitator_id?: string | null
          id?: string
          location?: string | null
          module_slug?: string | null
          scheduled_for?: string | null
          title_en?: string
          title_rw?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cohort_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          code: string
          created_at: string
          ends_on: string | null
          facilitator: string | null
          facilitator_id: string | null
          id: string
          location: string | null
          name: string
          starts_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          ends_on?: string | null
          facilitator?: string | null
          facilitator_id?: string | null
          id?: string
          location?: string | null
          name: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          ends_on?: string | null
          facilitator?: string | null
          facilitator_id?: string | null
          id?: string
          location?: string | null
          name?: string
          starts_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          blurb_en: string | null
          blurb_rw: string | null
          created_at: string
          id: string
          slug: string
          sort_order: number
          title_en: string
          title_rw: string
          updated_at: string
        }
        Insert: {
          blurb_en?: string | null
          blurb_rw?: string | null
          created_at?: string
          id?: string
          slug: string
          sort_order?: number
          title_en: string
          title_rw: string
          updated_at?: string
        }
        Update: {
          blurb_en?: string | null
          blurb_rw?: string | null
          created_at?: string
          id?: string
          slug?: string
          sort_order?: number
          title_en?: string
          title_rw?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrolments: {
        Row: {
          cohort_id: string | null
          created_at: string
          enrolled_at: string
          graduated_at: string | null
          id: string
          mode: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          enrolled_at?: string
          graduated_at?: string | null
          id?: string
          mode?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          enrolled_at?: string
          graduated_at?: string | null
          id?: string
          mode?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolments_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          audio_url_en: string | null
          audio_url_rw: string | null
          body_en: Json
          body_rw: Json
          created_at: string
          facilitator_en: string | null
          facilitator_rw: string | null
          id: string
          image_url: string | null
          module_id: string
          practice_en: string | null
          practice_rw: string | null
          resources: Json
          slug: string
          sort_order: number
          title_en: string
          title_rw: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          audio_url_en?: string | null
          audio_url_rw?: string | null
          body_en?: Json
          body_rw?: Json
          created_at?: string
          facilitator_en?: string | null
          facilitator_rw?: string | null
          id?: string
          image_url?: string | null
          module_id: string
          practice_en?: string | null
          practice_rw?: string | null
          resources?: Json
          slug: string
          sort_order?: number
          title_en: string
          title_rw: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          audio_url_en?: string | null
          audio_url_rw?: string | null
          body_en?: Json
          body_rw?: Json
          created_at?: string
          facilitator_en?: string | null
          facilitator_rw?: string | null
          id?: string
          image_url?: string | null
          module_id?: string
          practice_en?: string | null
          practice_rw?: string | null
          resources?: Json
          slug?: string
          sort_order?: number
          title_en?: string
          title_rw?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      module_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          module_id: string
          quiz_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id: string
          quiz_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_id?: string
          quiz_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      modules: {
        Row: {
          code: string
          course_id: string
          created_at: string
          delivery: string
          id: string
          minutes: number
          partner_en: string | null
          partner_rw: string | null
          slug: string
          sort_order: number
          tier: string
          title_en: string
          title_rw: string
          updated_at: string
          why_en: string | null
          why_rw: string | null
        }
        Insert: {
          code: string
          course_id: string
          created_at?: string
          delivery?: string
          id?: string
          minutes?: number
          partner_en?: string | null
          partner_rw?: string | null
          slug: string
          sort_order?: number
          tier?: string
          title_en: string
          title_rw: string
          updated_at?: string
          why_en?: string | null
          why_rw?: string | null
        }
        Update: {
          code?: string
          course_id?: string
          created_at?: string
          delivery?: string
          id?: string
          minutes?: number
          partner_en?: string | null
          partner_rw?: string | null
          slug?: string
          sort_order?: number
          tier?: string
          title_en?: string
          title_rw?: string
          updated_at?: string
          why_en?: string | null
          why_rw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "partner_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_orgs: {
        Row: {
          about: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          district: string | null
          id: string
          kind: Database["public"]["Enums"]["partner_kind"]
          name: string
          status: Database["public"]["Enums"]["partner_status"]
          updated_at: string
        }
        Insert: {
          about?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          district?: string | null
          id?: string
          kind: Database["public"]["Enums"]["partner_kind"]
          name: string
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Update: {
          about?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          district?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["partner_kind"]
          name?: string
          status?: Database["public"]["Enums"]["partner_status"]
          updated_at?: string
        }
        Relationships: []
      }
      partner_sessions: {
        Row: {
          cohort_id: string | null
          created_at: string
          created_by: string
          id: string
          learners_present: number | null
          location: string | null
          notes: string | null
          org_id: string
          scheduled_for: string | null
          status: string
          title: string
          track: string | null
          updated_at: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          learners_present?: number | null
          location?: string | null
          notes?: string | null
          org_id: string
          scheduled_for?: string | null
          status?: string
          title: string
          track?: string | null
          updated_at?: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          learners_present?: number | null
          location?: string | null
          notes?: string | null
          org_id?: string
          scheduled_for?: string | null
          status?: string
          title?: string
          track?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_sessions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "partner_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_sponsorships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_sponsorships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "partner_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cohort_id: string | null
          created_at: string
          full_name: string | null
          id: string
          lang: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          lang?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cohort_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          lang?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          assessment_id: string
          correct_index: number
          created_at: string
          explain_en: string | null
          explain_rw: string | null
          id: string
          options_en: Json
          options_rw: Json
          prompt_en: string
          prompt_rw: string
          slug: string
          sort_order: number
        }
        Insert: {
          assessment_id: string
          correct_index: number
          created_at?: string
          explain_en?: string | null
          explain_rw?: string | null
          id?: string
          options_en: Json
          options_rw: Json
          prompt_en: string
          prompt_rw: string
          slug: string
          sort_order?: number
        }
        Update: {
          assessment_id?: string
          correct_index?: number
          created_at?: string
          explain_en?: string | null
          explain_rw?: string | null
          id?: string
          options_en?: Json
          options_rw?: Json
          prompt_en?: string
          prompt_rw?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      is_partner_member: {
        Args: { _org: string; _user: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      my_partner_org_ids: { Args: never; Returns: string[] }
      sponsors_learner: { Args: { _user: string }; Returns: boolean }
      verify_certificate: {
        Args: { _certificate_id: string }
        Returns: {
          certificate_id: string
          cohort_label: string
          issued_on: string
          learner_name: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "learner" | "facilitator" | "admin"
      partner_kind: "rnp" | "driving_school" | "bank" | "garage" | "employer"
      partner_status: "pending" | "approved" | "suspended"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["learner", "facilitator", "admin"],
      partner_kind: ["rnp", "driving_school", "bank", "garage", "employer"],
      partner_status: ["pending", "approved", "suspended"],
    },
  },
} as const
