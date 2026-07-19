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
          slug: string;
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
          published_at: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
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
          commission_threshold_cents: number | null;
          commission_source: "standard" | "individual" | "legacy";
          commission_currency: string;
          commission_calculated_at: string;
          commission_terms_snapshot: Json;
          reporting_month: string;
          reporting_month_locked_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["bookings"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["bookings"]["Row"]>;
        Relationships: [];
      };
      commission_settings: {
        Row: Row<{
          id: string;
          threshold_cents: number;
          tier_one_limit_cents: number;
          commission_rate_bps: number;
          tier_two_limit_cents: number;
          tier_two_rate_bps: number;
          tier_three_rate_bps: number;
          minimum_commission_cents: number;
          currency: string;
          effective_from: string;
          is_active: boolean;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["commission_settings"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["commission_settings"]["Row"]>;
        Relationships: [];
      };
      facilitator_commission_terms: {
        Row: Row<{
          id: string;
          facilitator_id: string;
          threshold_cents: number | null;
          commission_rate_bps: number | null;
          minimum_commission_cents: number | null;
          currency: string | null;
          tier_one_limit_cents: number | null;
          tier_two_limit_cents: number | null;
          tier_two_rate_bps: number | null;
          tier_three_rate_bps: number | null;
          effective_from: string;
          is_active: boolean;
          reason: string | null;
          created_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["facilitator_commission_terms"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["facilitator_commission_terms"]["Row"]>;
        Relationships: [];
      };
      event_financial_records: {
        Row: Row<{
          id: string;
          event_id: string;
          primary_facilitator_id: string;
          event_ends_at: string;
          status: "below_threshold" | "invoiced" | "no_revenue" | "ready_for_review" | "selected_for_invoice" | "settled" | "waived";
          classification: "below_threshold" | "no_revenue" | "ready_for_review";
          currency: string;
          included_booking_count: number;
          excluded_booking_count: number;
          included_seats: number;
          gross_revenue_cents: number;
          commission_plan_id: string | null;
          free_threshold_cents: number;
          tier_one_limit_cents: number;
          tier_two_limit_cents: number;
          tier_one_rate_bps: number;
          tier_two_rate_bps: number;
          tier_three_rate_bps: number;
          free_revenue_cents: number;
          tier_one_revenue_cents: number;
          tier_two_revenue_cents: number;
          tier_three_revenue_cents: number;
          calculated_commission_cents: number;
          manual_adjustment_cents: number;
          final_commission_cents: number;
          payment_provider: string | null;
          payment_transaction_id: string | null;
          paid_amount_cents: number | null;
          payment_fee_cents: number | null;
          refunded_amount_cents: number | null;
          payout_amount_cents: number | null;
          net_settlement_cents: number | null;
          internal_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          invoiced_at: string | null;
          settled_at: string | null;
          archived_at: string | null;
          calculated_at: string;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["event_financial_records"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["event_financial_records"]["Row"]>;
        Relationships: [];
      };
      event_financial_record_booking_lines: {
        Row: Row<{
          financial_record_id: string;
          booking_id: string;
          booking_status_snapshot: string;
          seats_snapshot: number;
          price_per_seat_cents_snapshot: number;
          booking_value_cents_snapshot: number;
          included_in_financial_record: boolean;
          exclusion_reason: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["event_financial_record_booking_lines"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["event_financial_record_booking_lines"]["Row"]>;
        Relationships: [];
      };
      event_financial_adjustments: {
        Row: Row<{
          id: string;
          financial_record_id: string;
          event_id: string;
          amount_cents: number;
          reason: string;
          created_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["event_financial_adjustments"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["event_financial_adjustments"]["Row"]>;
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
          commission_rate_bps: number | null;
          commission_threshold_cents: number | null;
          commission_source: "standard" | "individual" | "legacy" | null;
          commission_currency: string | null;
          commission_calculated_at: string | null;
          reporting_month: string | null;
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
