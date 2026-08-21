// Minimal Database type for the Supabase JS client. In production this
// would be generated via `supabase gen types typescript` against your
// live database. The shape below is enough to make the client return
// typed rows instead of `never`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      guide_versions: {
        Row: { id: string; version: string; content_json: Json; effective_from: string; retired_at: string | null; created_at: string };
        Insert: { id?: string; version: string; content_json: Json; effective_from?: string; retired_at?: string | null; created_at?: string };
        Update: Partial<Database['public']['Tables']['guide_versions']['Insert']>;
      };
      signature_sessions: {
        Row: {
          id: string; booking_id: string; reference_code: string; password_hash: string;
          guide_version_id: string; status: string; language: string;
          lead_traveller_email: string; lead_traveller_name: string;
          party_size: number | null; has_minor: boolean | null;
          retain_until: string | null;
          created_at: string; last_activity_at: string; signed_at: string | null;
          expires_at: string; completed_ip: string | null; completed_user_agent: string | null;
          content_hash: string | null; pdf_path: string | null;
          archived_at: string | null; previous_session_id: string | null;
        };
        Insert: Partial<Database['public']['Tables']['signature_sessions']['Row']> & {
          booking_id: string; reference_code: string; password_hash: string;
          guide_version_id: string; lead_traveller_email: string;
          lead_traveller_name: string; expires_at: string;
        };
        Update: Partial<Database['public']['Tables']['signature_sessions']['Insert']>;
      };
      travellers: {
        Row: { id: string; session_id: string; full_name: string; date_of_birth: string; is_minor: boolean; role: string; passport_number: string | null; passport_expiry: string | null; passport_country: string | null; ordinal: number; created_at: string };
        Insert: { session_id: string; full_name: string; date_of_birth: string; is_minor: boolean; role: string; ordinal: number; passport_number?: string | null; passport_expiry?: string | null; passport_country?: string | null };
        Update: Partial<Database['public']['Tables']['travellers']['Insert']>;
      };
      child_scenarios: {
        Row: { id: string; traveller_id: string; scenario: string; non_travelling_parent_name: string | null; non_travelling_parent_id_last4: string | null; receiving_person_name: string | null; receiving_person_address: string | null; notes: string | null; created_at: string };
        Insert: { traveller_id: string; scenario: 'both_parents'|'one_parent'|'grandparent_guardian'|'unaccompanied'; non_travelling_parent_name?: string | null; non_travelling_parent_id_last4?: string | null; receiving_person_name?: string | null; receiving_person_address?: string | null; notes?: string | null };
        Update: Partial<Database['public']['Tables']['child_scenarios']['Insert']>;
      };
      document_uploads: {
        Row: { id: string; session_id: string; traveller_id: string | null; doc_type: string; storage_path: string; original_filename: string; mime_type: string; byte_size: number; sha256: string; uploaded_at: string; verified_by_admin: boolean; verified_at: string | null; verified_by: string | null; rejected_reason: string | null };
        Insert: { session_id: string; doc_type: string; storage_path: string; original_filename: string; mime_type: string; byte_size: number; sha256: string; traveller_id?: string | null };
        Update: Partial<Database['public']['Tables']['document_uploads']['Insert']>;
      };
      checklist_state: {
        Row: { id: string; session_id: string; item_key: string; checked: boolean; checked_at: string | null };
        Insert: { session_id: string; item_key: string; checked?: boolean; checked_at?: string | null };
        Update: Partial<Database['public']['Tables']['checklist_state']['Insert']>;
      };
      section_acknowledgments: {
        Row: { id: string; session_id: string; section_key: string; acknowledged: boolean; acknowledged_at: string | null };
        Insert: { session_id: string; section_key: string; acknowledged?: boolean; acknowledged_at?: string | null };
        Update: Partial<Database['public']['Tables']['section_acknowledgments']['Insert']>;
      };
      signature_records: {
        Row: { id: string; session_id: string; signed_name: string; signature_image_path: string; ip: string; user_agent: string; signed_at: string; declarations_json: Json; content_hash: string; guide_version_id: string };
        Insert: Database['public']['Tables']['signature_records']['Row'];
        Update: never;
      };
      audit_log: {
        Row: { id: number; session_id: string | null; actor: string; event_type: string; event_data: Json | null; ip: string | null; user_agent: string | null; occurred_at: string };
        Insert: { session_id?: string | null; actor: string; event_type: string; event_data?: Json | null; ip?: string | null; user_agent?: string | null; occurred_at?: string };
        Update: never;
      };
      user_roles: {
        Row: { user_id: string; role: string; granted_by: string | null; granted_at: string; revoked_at: string | null; notes: string | null };
        Insert: { user_id: string; role: 'founder' | 'super_admin'; granted_by?: string | null; notes?: string | null };
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>;
      };
      deposits: {
        Row: { id: string; booking_id: string; amount: number; currency: string; confirmed_at: string | null; confirmed_by: string | null; reference: string | null; notes: string | null; created_at: string };
        Insert: { booking_id: string; amount: number; currency?: string; reference?: string | null; notes?: string | null };
        Update: Partial<Database['public']['Tables']['deposits']['Insert']>;
      };
    };
    Views: {
      v_signing_overview: {
        Row: any;
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
