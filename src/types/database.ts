export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "facilitator";
export type FacilitatorStatus = "pending" | "approved" | "disabled" | "changes_requested";
export type EventStatus = "draft" | "pending_review" | "active" | "rejected" | "sold_out" | "cancelled" | "completed" | "archived";
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "sold_out"
  | "cancelled"
  | "completed"
  | "invoiced"
  | "paid";
export type CoOrganizerStatus = "pending" | "accepted" | "declined" | "cancelled" | "withdrawn";
export type InvoiceStatus = "draft" | "approved" | "sent" | "paid" | "cancelled";
export type EmailStatus = "queued" | "sent" | "failed";
export type LegalDocumentType = "terms" | "privacy" | "guidelines" | "organizer_terms" | "cookies";

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Row<{
          id: string;
          role: AppRole;
          first_name: string | null;
          full_name: string;
          last_name: string | null;
          email: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      regions: {
        Row: Row<{
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["regions"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["regions"]["Row"]>;
        Relationships: [];
      };
      categories: {
        Row: Row<{
          id: string;
          name: string;
          slug: string;
          description: string | null;
          color_hex: string;
          icon_name: string | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["categories"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["categories"]["Row"]>;
        Relationships: [];
      };
      facilitator_profiles: {
        Row: Row<{
          id: string;
          profile_id: string;
          status: FacilitatorStatus;
          is_paused: boolean;
          is_disabled: boolean;
          disabled_at: string | null;
          disabled_by: string | null;
          disabled_reason: string | null;
          company_name: string | null;
          facilitator_hero_key: string | null;
          profile_image_path: string | null;
          short_description: string;
          specialties: string | null;
          long_description: string;
          website_url: string | null;
          facebook_url: string | null;
          instagram_url: string | null;
          practical_information: string | null;
          event_format: string;
          online_description: string | null;
          online_url_or_note: string | null;
          country: string;
          address_line: string | null;
          postal_code: string | null;
          city: string | null;
          region_id: string | null;
          latitude: number | null;
          longitude: number | null;
          max_ticket_price_per_person: number | null;
          accepted_terms_at: string | null;
          accepted_privacy_at: string | null;
          accepted_guidelines_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["facilitator_profiles"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["facilitator_profiles"]["Row"]>;
        Relationships: [];
      };
      events: {
        Row: Row<{
          id: string;
          facilitator_id: string;
          status: EventStatus;
          title: string;
          slug: string;
          short_description: string;
          long_description: string;
          cover_image_path: string | null;
          starts_at: string;
          ends_at: string;
          address_line: string | null;
          postal_code: string | null;
          city: string | null;
          region_id: string | null;
          latitude: number | null;
          longitude: number | null;
          price_cents: number;
          capacity: number;
          contact_name: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          facebook_url: string | null;
          instagram_url: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["events"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["events"]["Row"]>;
        Relationships: [];
      };
      bookings: {
        Row: Row<{
          id: string;
          event_id: string;
          facilitator_id: string;
          status: BookingStatus;
          participant_name: string;
          participant_email: string;
          participant_phone: string | null;
          seats: number;
          message: string | null;
          event_title_snapshot: string;
          event_starts_at_snapshot: string;
          facilitator_name_snapshot: string;
          primary_category_snapshot: string | null;
          price_per_seat_cents: number;
          commission_rate_bps: number;
          booking_value_cents: number;
          commission_cents: number;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["bookings"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["bookings"]["Row"]>;
        Relationships: [];
      };
      event_co_organizers: {
        Row: Row<{
          id: string;
          event_id: string;
          primary_organizer_profile_id: string;
          co_organizer_profile_id: string;
          status: CoOrganizerStatus;
          response_token: string;
          invited_by_user_id: string | null;
          invited_at: string;
          responded_at: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["event_co_organizers"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["event_co_organizers"]["Row"]>;
        Relationships: [];
      };
      legal_documents: {
        Row: Row<{
          id: string;
          type: LegalDocumentType;
          title: string;
          slug: string;
          body: string;
          current_version_id: string | null;
          effective_at: string | null;
          is_published: boolean;
          requires_acceptance: boolean;
          version: string;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["legal_documents"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["legal_documents"]["Row"]>;
        Relationships: [];
      };
      legal_document_versions: {
        Row: Row<{
          id: string;
          document_id: string;
          document_type: LegalDocumentType;
          title: string;
          slug: string;
          body: string;
          version: string;
          published_at: string;
          effective_at: string;
          requires_acceptance: boolean;
          created_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["legal_document_versions"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["legal_document_versions"]["Row"]>;
        Relationships: [];
      };
      legal_document_acceptances: {
        Row: Row<{
          id: string;
          profile_id: string;
          document_version_id: string;
          document_type: LegalDocumentType;
          version: string;
          action: string;
          accepted_at: string;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["legal_document_acceptances"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["legal_document_acceptances"]["Row"]>;
        Relationships: [];
      };
      booking_legal_acceptances: {
        Row: Row<{
          id: string;
          booking_id: string;
          user_id: string | null;
          participant_email: string;
          terms_document_version_id: string | null;
          privacy_document_version_id: string | null;
          guidelines_document_version_id: string | null;
          event_terms_snapshot: string | null;
          accepted_at: string;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["booking_legal_acceptances"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["booking_legal_acceptances"]["Row"]>;
        Relationships: [];
      };
      site_settings: {
        Row: Row<{
          key: string;
          value: string | null;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["site_settings"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["site_settings"]["Row"]>;
        Relationships: [];
      };
      weekly_reflections: {
        Row: Row<{
          id: string;
          title: string;
          reflection_text: string;
          author: string | null;
          background_color: string;
          image_path: string | null;
          image_alt_text: string | null;
          is_active: boolean;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["weekly_reflections"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["weekly_reflections"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      event_capacity_view: {
        Row: {
          event_id: string | null;
          capacity: number | null;
          reserved_seats: number | null;
          available_seats: number | null;
        };
      };
      admin_booking_overview: {
        Row: {
          booking_id: string | null;
          booking_status: BookingStatus | null;
          booking_created_at: string | null;
          participant_name: string | null;
          participant_email: string | null;
          seats: number | null;
          event_title_snapshot: string | null;
          event_starts_at_snapshot: string | null;
          facilitator_name_snapshot: string | null;
          primary_category_snapshot: string | null;
          price_per_seat_cents: number | null;
          booking_value_cents: number | null;
          commission_cents: number | null;
          event_id: string | null;
          facilitator_id: string | null;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      facilitator_status: FacilitatorStatus;
      event_status: EventStatus;
      booking_status: BookingStatus;
      invoice_status: InvoiceStatus;
      email_status: EmailStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
