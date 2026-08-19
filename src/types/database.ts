export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          discord_posted_at: string | null
          event_id: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          discord_posted_at?: string | null
          event_id: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          discord_posted_at?: string | null
          event_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          event_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          event_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          event_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_windows: {
        Row: {
          created_at: string
          ends_at: string
          event_id: string
          id: string
          note: string | null
          profile_id: string
          starts_at: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          event_id: string
          id?: string
          note?: string | null
          profile_id: string
          starts_at: string
          status: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          event_id?: string
          id?: string
          note?: string | null
          profile_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["availability_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_windows_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_windows_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_tokens: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          assignment_id: string | null
          claimed_by: string | null
          created_at: string
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["change_request_kind"]
          note: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          state: Database["public"]["Enums"]["change_request_state"]
          target_user_id: string | null
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          claimed_by?: string | null
          created_at?: string
          event_id: string
          id?: string
          kind: Database["public"]["Enums"]["change_request_kind"]
          note?: string | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          state?: Database["public"]["Enums"]["change_request_state"]
          target_user_id?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          claimed_by?: string | null
          created_at?: string
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["change_request_kind"]
          note?: string | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          state?: Database["public"]["Enums"]["change_request_state"]
          target_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "shift_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_roles: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_directors: {
        Row: {
          assigned_by: string | null
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_directors_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_directors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_directors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          location: string | null
          name: string
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          name: string
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          name?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          expires_at: string
          id: string
          max_uses: number
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at: string
          id?: string
          max_uses?: number
          role: Database["public"]["Enums"]["app_role"]
          token: string
          used_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          expires_at?: string
          id?: string
          max_uses?: number
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      member_coverage_roles: {
        Row: {
          coverage_role_id: string
          created_at: string
          event_id: string
          id: string
          profile_id: string
        }
        Insert: {
          coverage_role_id: string
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
        }
        Update: {
          coverage_role_id?: string
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_coverage_roles_coverage_role_id_fkey"
            columns: ["coverage_role_id"]
            isOneToOne: false
            referencedRelation: "coverage_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_coverage_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_coverage_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_settings: {
        Row: {
          created_at: string
          event_id: string
          id: string
          max_hours: number
          minimum_break_minutes: number
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          max_hours: number
          minimum_break_minutes?: number
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          max_hours?: number
          minimum_break_minutes?: number
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channel: string
          enabled: boolean
          kind: string
          profile_id: string
        }
        Insert: {
          channel: string
          enabled?: boolean
          kind: string
          profile_id: string
        }
        Update: {
          channel?: string
          enabled?: boolean
          kind?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          profile_id: string
          read_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          profile_id: string
          read_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          profile_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          created_at: string
          default_shift_buffer_minutes: number
          discord_notify_kinds: Json
          fairness_settings: Json
          id: boolean
          org_name: string
          public_name_display: string
          semester_ends_on: string | null
          semester_starts_on: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string
          default_shift_buffer_minutes?: number
          discord_notify_kinds?: Json
          fairness_settings?: Json
          id?: boolean
          org_name?: string
          public_name_display?: string
          semester_ends_on?: string | null
          semester_starts_on?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string
          default_shift_buffer_minutes?: number
          discord_notify_kinds?: Json
          fairness_settings?: Json
          id?: boolean
          org_name?: string
          public_name_display?: string
          semester_ends_on?: string | null
          semester_starts_on?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          theme: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          theme?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_availability_windows: {
        Row: {
          created_at: string
          day_of_week: number
          ends_at_local: string
          id: string
          profile_id: string
          starts_at_local: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          ends_at_local: string
          id?: string
          profile_id: string
          starts_at_local: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          ends_at_local?: string
          id?: string
          profile_id?: string
          starts_at_local?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_availability_windows_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_publications: {
        Row: {
          event_id: string
          id: string
          notes: string | null
          published_at: string
          published_by: string | null
        }
        Insert: {
          event_id: string
          id?: string
          notes?: string | null
          published_at?: string
          published_by?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          notes?: string | null
          published_at?: string
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_publications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_publications_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          label: string | null
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          label?: string | null
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          label?: string | null
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_tokens_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_assignments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assigned_by: string | null
          coverage_role_id: string | null
          created_at: string
          id: string
          origin: string
          profile_id: string
          proposed_by_ai: boolean
          published_at: string | null
          shift_id: string
          state: Database["public"]["Enums"]["assignment_state"]
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          warnings: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          coverage_role_id?: string | null
          created_at?: string
          id?: string
          origin?: string
          profile_id: string
          proposed_by_ai?: boolean
          published_at?: string | null
          shift_id: string
          state?: Database["public"]["Enums"]["assignment_state"]
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          warnings?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assigned_by?: string | null
          coverage_role_id?: string | null
          created_at?: string
          id?: string
          origin?: string
          profile_id?: string
          proposed_by_ai?: boolean
          published_at?: string | null
          shift_id?: string
          state?: Database["public"]["Enums"]["assignment_state"]
          status?: Database["public"]["Enums"]["assignment_status"]
          updated_at?: string
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "shift_assignments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_coverage_role_id_fkey"
            columns: ["coverage_role_id"]
            isOneToOne: false
            referencedRelation: "coverage_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_role_requirements: {
        Row: {
          coverage_role_id: string
          created_at: string
          id: string
          required_people: number
          shift_id: string
          updated_at: string
        }
        Insert: {
          coverage_role_id: string
          created_at?: string
          id?: string
          required_people: number
          shift_id: string
          updated_at?: string
        }
        Update: {
          coverage_role_id?: string
          created_at?: string
          id?: string
          required_people?: number
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_role_requirements_coverage_role_id_fkey"
            columns: ["coverage_role_id"]
            isOneToOne: false
            referencedRelation: "coverage_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_role_requirements_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_roles: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_roles_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          ends_at: string
          event_id: string | null
          id: string
          location: string | null
          notes: string | null
          required_people: number
          shift_role_id: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          required_people?: number
          shift_role_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          event_id?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          required_people?: number
          shift_role_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_shift_role_id_fkey"
            columns: ["shift_role_id"]
            isOneToOne: false
            referencedRelation: "shift_roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_assignments: {
        Args: { p_ids: string[] }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          assigned_by: string | null
          coverage_role_id: string | null
          created_at: string
          id: string
          origin: string
          profile_id: string
          proposed_by_ai: boolean
          published_at: string | null
          shift_id: string
          state: Database["public"]["Enums"]["assignment_state"]
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          warnings: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "shift_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_change_request: {
        Args: { p_id: string }
        Returns: {
          assignment_id: string | null
          claimed_by: string | null
          created_at: string
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["change_request_kind"]
          note: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          state: Database["public"]["Enums"]["change_request_state"]
          target_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "change_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_shift: {
        Args: { p_shift_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          assigned_by: string | null
          coverage_role_id: string | null
          created_at: string
          id: string
          origin: string
          profile_id: string
          proposed_by_ai: boolean
          published_at: string | null
          shift_id: string
          state: Database["public"]["Enums"]["assignment_state"]
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          warnings: Json
        }
        SetofOptions: {
          from: "*"
          to: "shift_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_schedule: { Args: { p_token: string }; Returns: Json }
      hours_per_event: {
        Args: { p_event_id: string; p_profile_id: string }
        Returns: number
      }
      hours_semester: { Args: { p_profile_id: string }; Returns: number }
      redeem_invite: {
        Args: { p_token: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      resolve_change_request: {
        Args: { p_claimed_by?: string; p_decision: string; p_id: string }
        Returns: {
          assignment_id: string | null
          claimed_by: string | null
          created_at: string
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["change_request_kind"]
          note: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          state: Database["public"]["Enums"]["change_request_state"]
          target_user_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "change_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unassign_assignment: {
        Args: { p_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          assigned_by: string | null
          coverage_role_id: string | null
          created_at: string
          id: string
          origin: string
          profile_id: string
          proposed_by_ai: boolean
          published_at: string | null
          shift_id: string
          state: Database["public"]["Enums"]["assignment_state"]
          status: Database["public"]["Enums"]["assignment_status"]
          updated_at: string
          warnings: Json
        }
        SetofOptions: {
          from: "*"
          to: "shift_assignments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "member" | "director"
      assignment_state: "not_assigned" | "in_approval" | "approved"
      assignment_status: "draft" | "published" | "removed" | "swap_pending"
      availability_status: "available" | "unavailable"
      change_request_kind:
        | "swap_any"
        | "swap_with"
        | "drop"
        | "cant_make_time"
        | "more_hours"
      change_request_state:
        | "open"
        | "claimed"
        | "approved"
        | "declined"
        | "cancelled"
      event_status: "draft" | "published" | "archived"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "member", "director"],
      assignment_state: ["not_assigned", "in_approval", "approved"],
      assignment_status: ["draft", "published", "removed", "swap_pending"],
      availability_status: ["available", "unavailable"],
      change_request_kind: [
        "swap_any",
        "swap_with",
        "drop",
        "cant_make_time",
        "more_hours",
      ],
      change_request_state: [
        "open",
        "claimed",
        "approved",
        "declined",
        "cancelled",
      ],
      event_status: ["draft", "published", "archived"],
    },
  },
} as const

