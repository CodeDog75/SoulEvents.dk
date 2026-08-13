import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Banknote, CalendarCheck, FileDown, ReceiptText, Settings, Users } from "lucide-react";
import { AuthMessage } from "@/components/auth/auth-message";
import { FacilitatorCommissionTermsForm } from "@/components/admin/commission/facilitator-commission-terms-form";
import { StandardCommissionSettingsForm } from "@/components/admin/commission/standard-commission-settings-form";
import { InvoiceDraftList } from "@/components/admin/reports/invoice-draft-list";
import { ReportForm } from "@/components/admin/reports/report-form";
import { requireRole } from "@/lib/auth/roles";
import { billableBookingStatuses, defaultCommissionRateBps } from "@/lib/commission/terms";
import { formatDanishEventDateTime } from "@/lib/events/date-format";
import { resetFacilitatorCommissionTermsAction, syncCompletedEventFinancialRecordsAction, updateEventFinancialRecordStatusAction } from "./actions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AdminCommissionPageProps = {
  searchParams: Promise<{
    message?: string;
    settlement_filter?: string;
    tab?: string;
  }>;
};

type FacilitatorRow = {
  company_name: string | null;
  id: string;
  profiles:
    | {
        full_name: string | null;
      }
    | Array<{
        full_name: string | null;
      }>
    | null;
};

type CommissionSettingRow = {
  commission_rate_bps: number;
  created_at: string;
  currency: string;
  effective_from: string;
  id: string;
  is_active: boolean;
  minimum_commission_cents: number;
  reason: string | null;
  threshold_cents: number;
  tier_one_limit_cents: number | null;
  tier_three_rate_bps: number | null;
  tier_two_limit_cents: number | null;
  tier_two_rate_bps: number | null;
};

type FacilitatorTermRow = {
  commission_rate_bps: number | null;
  created_at: string;
  currency: string | null;
  effective_from: string;
  facilitator_id: string;
  id: string;
  minimum_commission_cents: number | null;
  reason: string | null;
  threshold_cents: number | null;
  tier_one_limit_cents: number | null;
  tier_three_rate_bps: number | null;
  tier_two_limit_cents: number | null;
  tier_two_rate_bps: number | null;
  facilitator_profiles:
    | {
        company_name: string | null;
        profiles:
          | {
              full_name: string | null;
            }
          | Array<{
              full_name: string | null;
            }>
          | null;
      }
    | Array<{
        company_name: string | null;
        profiles:
          | {
              full_name: string | null;
            }
          | Array<{
              full_name: string | null;
            }>
          | null;
      }>
    | null;
};

const tabs = [
  { key: "overview", label: "Overblik" },
  { key: "settings", label: "Indstillinger" },
  { key: "event-settlements", label: "Eventafregning" },
  { key: "facilitators", label: "Arrangørvilkår" },
  { key: "reports", label: "Månedsrapporter" },
];

const settlementHistoryFilters = [
  { key: "all", label: "Alle" },
  { key: "commission", label: "Udløser kommission" },
  { key: "no_revenue", label: "Ingen omsætning" },
  { key: "below_threshold", label: "Under beløbsgrænsen" },
  { key: "waived", label: "Fravalgt" },
  { key: "invoiced", label: "Faktureret" },
  { key: "settled", label: "Afregnet" },
];

function first<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function facilitatorName(facilitator: FacilitatorRow | FacilitatorTermRow["facilitator_profiles"]) {
  const row = first(facilitator);
  const profile = first(row?.profiles);
  return row?.company_name || profile?.full_name || "Arrangør";
}

function kroner(cents: number | null | undefined) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(Math.round((cents ?? 0) / 100)) + " kr.";
}

function percentFromBps(bps: number | null | undefined) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format((bps ?? 0) / 100) + " %";
}

function dateLabel(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat("da-DK", { dateStyle: "medium" }).format(new Date(value)) : "Ikke angivet";
}

function settingTierOneLimit(setting: CommissionSettingRow | null | undefined) {
  return setting?.tier_one_limit_cents ?? 2_000_000;
}

function settingTierTwoLimit(setting: CommissionSettingRow | null | undefined) {
  return setting?.tier_two_limit_cents ?? 3_000_000;
}

function settingTierTwoRate(setting: CommissionSettingRow | null | undefined) {
  return setting?.tier_two_rate_bps ?? 500;
}

function settingTierThreeRate(setting: CommissionSettingRow | null | undefined) {
  return setting?.tier_three_rate_bps ?? 400;
}

function kronerBefore(cents: number | null | undefined) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(Math.max(0, Math.floor(((cents ?? 0) - 1) / 100))) + " kr.";
}

function revenueBracketPlanLabel(setting: CommissionSettingRow | null | undefined) {
  const freeThreshold = setting?.threshold_cents ?? 1_000_000;
  const tierOneLimit = settingTierOneLimit(setting);
  const tierOneRate = setting?.commission_rate_bps ?? defaultCommissionRateBps;
  const tierTwoLimit = settingTierTwoLimit(setting);
  const tierTwoRate = settingTierTwoRate(setting);
  const tierThreeRate = settingTierThreeRate(setting);

  return `0-${kronerBefore(freeThreshold)}: 0 % · ${kroner(freeThreshold)}-${kronerBefore(tierOneLimit)}: ${percentFromBps(tierOneRate)} · ${kroner(tierOneLimit)}-${kronerBefore(tierTwoLimit)}: ${percentFromBps(tierTwoRate)} · ${kroner(tierTwoLimit).replace(" kr.", " kr.+")}: ${percentFromBps(tierThreeRate)}`;
}

function fieldClass() {
  return "h-11 rounded-md border border-midnight/15 bg-white px-3 text-sm outline-none transition focus:border-[#7A5D91]";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={"rounded-md border border-midnight/10 bg-white p-5 shadow-soft " + className}>{children}</section>;
}

const eventFinancialStatusLabels: Record<string, string> = {
  below_threshold: "Under grænsen",
  invoiced: "Faktureret",
  no_revenue: "Ingen omsætning",
  ready_for_review: "Til gennemgang",
  selected_for_invoice: "Valgt til faktura",
  settled: "Afregnet",
  waived: "Eftergivet",
};

const eventFinancialStatusClasses: Record<string, string> = {
  below_threshold: "bg-sage-50 text-sage-800",
  invoiced: "bg-[#F3F0F7] text-[#6E5A86]",
  no_revenue: "bg-midnight/5 text-ink/65",
  ready_for_review: "bg-[#FFF6E8] text-[#8A6A2E]",
  selected_for_invoice: "bg-[#F4E8F7] text-[#7A4B88]",
  settled: "bg-sage-50 text-sage-800",
  waived: "bg-[#F8EFE8] text-terracotta",
};

function compactDateTime(value: string | null | undefined) {
  return formatDanishEventDateTime(value, "Ikke angivet");
}

function FinancialStatusButton({
  children,
  recordId,
  status,
}: {
  children: ReactNode;
  recordId: string;
  status: "invoiced" | "selected_for_invoice" | "settled" | "waived";
}) {
  return (
    <form action={updateEventFinancialRecordStatusAction}>
      <input name="financial_record_id" type="hidden" value={recordId} />
      <input name="status" type="hidden" value={status} />
      <button className="h-9 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-[#2F4A3A] hover:text-[#2F4A3A]" type="submit">
        {children}
      </button>
    </form>
  );
}

export default async function AdminCommissionPage({ searchParams }: AdminCommissionPageProps) {
  const [{ message, settlement_filter, tab }, adminProfile] = await Promise.all([searchParams, requireRole("admin")]);
  const activeTab = tabs.some((item) => item.key === tab) ? tab ?? "overview" : "overview";
  const activeSettlementFilter = settlementHistoryFilters.some((item) => item.key === settlement_filter) ? settlement_filter ?? "all" : "all";
  const supabase = createAdminClient();
  const currentMonth = new Date();
  const currentReportingMonth = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const [
    { data: settings },
    { data: individualTerms },
    { data: facilitators },
    { data: monthlyReports },
    { data: invoices },
    { data: eventFinancialRecords },
    { count: billableBookingCount },
  ] = await Promise.all([
    supabase
      .from("commission_settings")
      .select("id, threshold_cents, tier_one_limit_cents, tier_two_limit_cents, commission_rate_bps, tier_two_rate_bps, tier_three_rate_bps, minimum_commission_cents, currency, effective_from, is_active, reason, created_at")
      .order("effective_from", { ascending: false })
      .limit(12),
    supabase
      .from("facilitator_commission_terms")
      .select("id, facilitator_id, threshold_cents, tier_one_limit_cents, tier_two_limit_cents, commission_rate_bps, tier_two_rate_bps, tier_three_rate_bps, minimum_commission_cents, currency, effective_from, reason, created_at, facilitator_profiles(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name))")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("facilitator_profiles")
      .select("id, company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)")
      .order("company_name", { ascending: true }),
    supabase
      .from("monthly_reports")
      .select("id, facilitator_id, period_start, period_end, total_bookings, total_seats, booking_value_cents, commission_cents, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("invoice_drafts")
      .select("id, status, period_start, period_end, total_commission_cents, payment_due_date, payment_reference, created_at, facilitator_profiles(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name)), monthly_reports(total_bookings, total_seats, booking_value_cents)")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("event_financial_records")
      .select("id, event_id, primary_facilitator_id, event_ends_at, status, classification, currency, included_booking_count, excluded_booking_count, included_seats, gross_revenue_cents, free_threshold_cents, tier_one_limit_cents, tier_two_limit_cents, tier_one_rate_bps, tier_two_rate_bps, tier_three_rate_bps, free_revenue_cents, tier_one_revenue_cents, tier_two_revenue_cents, tier_three_revenue_cents, calculated_commission_cents, manual_adjustment_cents, final_commission_cents, reviewed_at, invoiced_at, settled_at, created_at, events(title, slug, city), facilitator_profiles(company_name, profiles!facilitator_profiles_profile_id_fkey(full_name))")
      .order("event_ends_at", { ascending: false })
      .limit(120),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("status", [...billableBookingStatuses]),
  ]);

  const activeSettings = (settings ?? []) as CommissionSettingRow[];
  const currentSetting = activeSettings.find((setting) => setting.is_active && new Date(setting.effective_from) <= new Date()) ?? activeSettings[0];
  const activeIndividualTerms = (individualTerms ?? []) as FacilitatorTermRow[];
  const facilitatorRows = (facilitators ?? []) as FacilitatorRow[];
  const financialRecords = eventFinancialRecords ?? [];
  const recordsReadyForReview = financialRecords.filter((record) => record.status === "ready_for_review" && (record.final_commission_cents ?? 0) > 0);
  const filteredFinancialRecords = financialRecords.filter((record) => {
    if (activeSettlementFilter === "all") return true;
    if (activeSettlementFilter === "commission") return record.classification === "ready_for_review";
    if (activeSettlementFilter === "no_revenue") return record.classification === "no_revenue";
    if (activeSettlementFilter === "below_threshold") return record.classification === "below_threshold";
    return record.status === activeSettlementFilter;
  });
  const currentEventSettlementMonth = currentReportingMonth;
  const currentMonthFinancialRecords = financialRecords.filter((record) => record.event_ends_at?.startsWith(currentEventSettlementMonth.slice(0, 7)));
  const currentMonthSettlementStats = currentMonthFinancialRecords.reduce(
    (totals, record) => {
      totals.completedEvents += 1;
      totals.grossRevenueCents += record.gross_revenue_cents ?? 0;
      if (record.classification === "no_revenue") totals.noRevenueCents += record.gross_revenue_cents ?? 0;
      if (record.classification === "below_threshold") totals.belowThresholdRevenueCents += record.gross_revenue_cents ?? 0;
      if (record.classification === "ready_for_review") totals.commissionRevenueCents += record.gross_revenue_cents ?? 0;
      totals.calculatedCommissionCents += record.calculated_commission_cents ?? 0;
      if (record.status === "waived") totals.waivedCommissionCents += record.final_commission_cents ?? 0;
      if (["invoiced", "settled"].includes(record.status ?? "")) totals.invoicedCommissionCents += record.final_commission_cents ?? 0;
      return totals;
    },
    {
      belowThresholdRevenueCents: 0,
      calculatedCommissionCents: 0,
      commissionRevenueCents: 0,
      completedEvents: 0,
      grossRevenueCents: 0,
      invoicedCommissionCents: 0,
      noRevenueCents: 0,
      waivedCommissionCents: 0,
    },
  );

  return (
    <main className="min-h-screen bg-[#fbfaf7]">
      <header className="border-b border-midnight/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-[#2F4A3A] text-white">
              <ReceiptText className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-sage-700">Administrator</p>
              <h1 className="text-xl font-semibold text-midnight">Kommission og fakturering</h1>
            </div>
          </div>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-terracotta hover:text-terracotta"
            href="/admin"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Tilbage
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <AuthMessage message={message} />
        <nav className="flex flex-wrap gap-2 rounded-md border border-midnight/10 bg-white p-2 shadow-soft" aria-label="Kommission og fakturering">
          {tabs.map((item) => (
            <Link
              className={
                "rounded-md px-4 py-2 text-sm font-semibold transition " +
                (activeTab === item.key ? "bg-[#2F4A3A] text-white" : "text-midnight hover:bg-sage-50")
              }
              href={`/admin/commission?tab=${item.key}`}
              key={item.key}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {activeTab === "overview" ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <p className="text-sm font-semibold text-ink/60">Kommissionsfri omsætning</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">Under {kroner(currentSetting?.threshold_cents ?? 1_000_000)}</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold text-ink/60">Første sats</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">{percentFromBps(currentSetting?.commission_rate_bps ?? defaultCommissionRateBps)}</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold text-ink/60">Denne måneds eventomsætning</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">{kroner(currentMonthSettlementStats.grossRevenueCents)}</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold text-ink/60">Denne måneds kommission</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">{kroner(currentMonthSettlementStats.calculatedCommissionCents)}</p>
              </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <div className="flex items-center gap-3">
                  <Banknote className="size-5 text-[#2F4A3A]" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-midnight">Aktuelt fakturagrundlag</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/68">
                  {billableBookingCount ?? 0} fakturerbare tilmeldinger indgår på tværs af rapporteringsmåneder. Nye bookinger snapshottes nu med sats,
                  grænse, kilde og rapporteringsmåned ved oprettelse.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link className="rounded-md bg-midnight px-3 py-2 text-sm font-semibold text-white" href="/admin/commission?tab=reports">
                    Åbn månedsrapporter
                  </Link>
                  <Link className="rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm font-semibold text-midnight" href="/admin/commission/export?type=booking-lines">
                    Eksportér bookinglinjer
                  </Link>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-[#7A5D91]" aria-hidden="true" />
                  <h2 className="text-lg font-semibold text-midnight">Individuelle arrangørvilkår</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/68">
                  {activeIndividualTerms.length} arrangør{activeIndividualTerms.length === 1 ? "" : "er"} har aktive individuelle vilkår. Alle andre bruger
                  standardvilkårene.
                </p>
                <Link className="mt-4 inline-flex rounded-md border border-midnight/15 bg-white px-3 py-2 text-sm font-semibold text-midnight" href="/admin/commission?tab=facilitators">
                  Se arrangørvilkår
                </Link>
              </Card>
            </div>
          </>
        ) : null}

        {activeTab === "settings" ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <div className="flex items-center gap-3">
                <Settings className="size-5 text-[#2F4A3A]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-midnight">Kommission efter eventets omsætning</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-ink/64">
                Kommissionen bestemmes af det enkelte events samlede realiserede omsætning. Når omsætningstrinnet er fundet, beregnes satsen af hele
                omsætningen.
              </p>
              <StandardCommissionSettingsForm
                currentValues={{
                  commissionRateBps: currentSetting?.commission_rate_bps ?? defaultCommissionRateBps,
                  currency: currentSetting?.currency ?? "DKK",
                  minimumCommissionCents: currentSetting?.minimum_commission_cents ?? 0,
                  thresholdCents: currentSetting?.threshold_cents ?? 1_000_000,
                  tierOneLimitCents: settingTierOneLimit(currentSetting),
                  tierThreeRateBps: settingTierThreeRate(currentSetting),
                  tierTwoLimitCents: settingTierTwoLimit(currentSetting),
                  tierTwoRateBps: settingTierTwoRate(currentSetting),
                }}
              />
            </Card>
            <Card>
              <h2 className="text-lg font-semibold text-midnight">Versionshistorik</h2>
              <p className="mt-2 text-sm leading-6 text-ink/64">Hver linje er ét samlet regelsæt for omsætningstrappen.</p>
              <div className="mt-4 divide-y divide-midnight/10">
                {activeSettings.map((setting) => (
                  <article className="py-3" key={setting.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-midnight">{revenueBracketPlanLabel(setting)}</p>
                      {setting.id === currentSetting?.id ? (
                        <span className="rounded-full bg-sage-50 px-2.5 py-1 text-xs font-bold text-sage-800">Aktiv</span>
                      ) : (
                        <span className="rounded-full bg-midnight/5 px-2.5 py-1 text-xs font-bold text-ink/55">Historik</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink/62">
                      {setting.currency} · gælder fra {dateLabel(setting.effective_from)} · oprettet {dateLabel(setting.created_at)}
                    </p>
                    {setting.reason ? <p className="mt-2 text-sm text-ink/72">{setting.reason}</p> : null}
                  </article>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "event-settlements" ? (
          <div className="grid gap-5">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <CalendarCheck className="size-5 text-[#2F4A3A]" aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-midnight">Eventbaseret økonomisk registrering</h2>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/68">
                    Afsluttede, tidligere publicerede events registreres økonomisk pr. event. Kun events med beregnet kommission over 0 kr. vises som
                    manuel opgave.
                  </p>
                </div>
                <form action={syncCompletedEventFinancialRecordsAction}>
                  <button className="h-10 rounded-md bg-[#2F4A3A] px-4 text-sm font-semibold text-white transition hover:bg-[#263D30]" type="submit">
                    Opdater registreringer
                  </button>
                </form>
              </div>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <p className="text-sm font-semibold text-ink/60">Afsluttede events</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">{currentMonthSettlementStats.completedEvents}</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold text-ink/60">Registreret omsætning</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">{kroner(currentMonthSettlementStats.grossRevenueCents)}</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold text-ink/60">Beregnet kommission</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">{kroner(currentMonthSettlementStats.calculatedCommissionCents)}</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold text-ink/60">Faktureret kommission</p>
                <p className="mt-2 text-2xl font-semibold text-midnight">{kroner(currentMonthSettlementStats.invoicedCommissionCents)}</p>
              </Card>
            </div>

            <Card>
              <h2 className="text-lg font-semibold text-midnight">Månedsoversigt</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md bg-midnight/5 p-3">
                  <dt className="font-semibold text-ink/60">Gratis events</dt>
                  <dd className="mt-1 text-midnight">{kroner(currentMonthSettlementStats.noRevenueCents)}</dd>
                </div>
                <div className="rounded-md bg-sage-50 p-3">
                  <dt className="font-semibold text-ink/60">Under grænsen</dt>
                  <dd className="mt-1 text-midnight">{kroner(currentMonthSettlementStats.belowThresholdRevenueCents)}</dd>
                </div>
                <div className="rounded-md bg-[#FFF6E8] p-3">
                  <dt className="font-semibold text-ink/60">Udløser kommission</dt>
                  <dd className="mt-1 text-midnight">{kroner(currentMonthSettlementStats.commissionRevenueCents)}</dd>
                </div>
                <div className="rounded-md bg-[#F8EFE8] p-3">
                  <dt className="font-semibold text-ink/60">Eftergivet kommission</dt>
                  <dd className="mt-1 text-midnight">{kroner(currentMonthSettlementStats.waivedCommissionCents)}</dd>
                </div>
              </dl>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-midnight">Til gennemgang</h2>
              <p className="mt-1 text-sm text-ink/64">Kun afsluttede events med beregnet kommission over 0 kr. kræver manuel adminbehandling.</p>
              <div className="mt-4 divide-y divide-midnight/10">
                {recordsReadyForReview.length ? (
                  recordsReadyForReview.map((record) => {
                    const event = first(record.events);
                    const facilitator = first(record.facilitator_profiles);
                    const profile = first(facilitator?.profiles);
                    return (
                      <article className="grid gap-3 py-4 lg:grid-cols-[1fr_auto] lg:items-center" key={record.id}>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + (eventFinancialStatusClasses[record.status] ?? "bg-midnight/5 text-ink/70")}>
                              {eventFinancialStatusLabels[record.status] ?? record.status}
                            </span>
                            <span className="text-xs font-semibold text-ink/50">Slutdato {compactDateTime(record.event_ends_at)}</span>
                          </div>
                          <h3 className="mt-2 break-words text-base font-semibold text-midnight">{event?.title ?? "Event"}</h3>
                          <p className="mt-1 text-sm text-ink/64">{facilitator?.company_name || profile?.full_name || "Arrangør"}</p>
                          <p className="mt-2 text-sm text-ink/72">
                            {record.included_booking_count} medregnede bookinger · {record.included_seats} pladser · omsætning {kroner(record.gross_revenue_cents)} · kommission {kroner(record.final_commission_cents)}
                          </p>
                          <p className="mt-1 text-xs text-ink/52">
                            Omsætningstrin:{" "}
                            {record.tier_three_revenue_cents > 0
                              ? `${kroner(record.tier_two_limit_cents)} og derover ved ${percentFromBps(record.tier_three_rate_bps)}`
                              : record.tier_two_revenue_cents > 0
                                ? `${kroner(record.tier_one_limit_cents)}-${kronerBefore(record.tier_two_limit_cents)} ved ${percentFromBps(record.tier_two_rate_bps)}`
                                : record.tier_one_revenue_cents > 0
                                  ? `${kroner(record.free_threshold_cents)}-${kronerBefore(record.tier_one_limit_cents)} ved ${percentFromBps(record.tier_one_rate_bps)}`
                                  : `under ${kroner(record.free_threshold_cents)} ved 0 %`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <FinancialStatusButton recordId={record.id} status="selected_for_invoice">Vælg til faktura</FinancialStatusButton>
                          <FinancialStatusButton recordId={record.id} status="waived">Eftergiv</FinancialStatusButton>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="py-5 text-sm text-ink/64">Ingen events udløser kommission lige nu.</p>
                )}
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-midnight">Historik</h2>
              <p className="mt-1 text-sm text-ink/64">Alle økonomisk registrerede events, også 0 kr.-events og events under beløbsgrænsen.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {settlementHistoryFilters.map((filter) => (
                  <Link
                    className={
                      "rounded-full px-3 py-2 text-sm font-semibold transition " +
                      (activeSettlementFilter === filter.key
                        ? "bg-[#2F4A3A] text-white"
                        : "border border-midnight/10 bg-white text-midnight hover:border-[#2F4A3A] hover:text-[#2F4A3A]")
                    }
                    href={`/admin/commission?tab=event-settlements&settlement_filter=${filter.key}`}
                    key={filter.key}
                  >
                    {filter.label}
                  </Link>
                ))}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-midnight/10 text-xs uppercase tracking-wide text-ink/45">
                    <tr>
                      <th className="py-2 pr-4">Event</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Omsætning</th>
                      <th className="py-2 pr-4">Kommission</th>
                      <th className="py-2 pr-4">Bookinger</th>
                      <th className="py-2 pr-4">Slutdato</th>
                      <th className="py-2">Handling</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-midnight/10">
                    {filteredFinancialRecords.map((record) => {
                      const event = first(record.events);
                      return (
                        <tr key={record.id}>
                          <td className="max-w-xs break-words py-3 pr-4 font-semibold text-midnight">{event?.title ?? "Event"}</td>
                          <td className="py-3 pr-4">
                            <span className={"whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold " + (eventFinancialStatusClasses[record.status] ?? "bg-midnight/5 text-ink/70")}>
                              {eventFinancialStatusLabels[record.status] ?? record.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4">{kroner(record.gross_revenue_cents)}</td>
                          <td className="py-3 pr-4">{kroner(record.final_commission_cents)}</td>
                          <td className="py-3 pr-4">{record.included_booking_count}</td>
                          <td className="py-3 pr-4">{compactDateTime(record.event_ends_at)}</td>
                          <td className="py-3">
                            {record.status === "selected_for_invoice" ? (
                              <FinancialStatusButton recordId={record.id} status="invoiced">Marker faktureret</FinancialStatusButton>
                            ) : record.status === "invoiced" ? (
                              <FinancialStatusButton recordId={record.id} status="settled">Marker afregnet</FinancialStatusButton>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredFinancialRecords.length === 0 ? (
                      <tr>
                        <td className="py-5 text-sm text-ink/64" colSpan={7}>
                          Ingen økonomisk registrerede events matcher filteret.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "facilitators" ? (
          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <h2 className="text-lg font-semibold text-midnight">Opret eller ændr individuelle vilkår</h2>
              <FacilitatorCommissionTermsForm
                facilitators={facilitatorRows.map((facilitator) => ({
                  id: facilitator.id,
                  name: facilitatorName(facilitator),
                }))}
                standardValues={{
                  commissionRateBps: currentSetting?.commission_rate_bps ?? defaultCommissionRateBps,
                  currency: currentSetting?.currency ?? "DKK",
                  minimumCommissionCents: currentSetting?.minimum_commission_cents ?? 0,
                  thresholdCents: currentSetting?.threshold_cents ?? 1_000_000,
                  tierOneLimitCents: settingTierOneLimit(currentSetting),
                  tierThreeRateBps: settingTierThreeRate(currentSetting),
                  tierTwoLimitCents: settingTierTwoLimit(currentSetting),
                  tierTwoRateBps: settingTierTwoRate(currentSetting),
                }}
                terms={activeIndividualTerms.map((term) => ({
                  commissionRateBps: term.commission_rate_bps ?? currentSetting?.commission_rate_bps ?? defaultCommissionRateBps,
                  currency: term.currency ?? currentSetting?.currency ?? "DKK",
                  facilitatorId: term.facilitator_id,
                  minimumCommissionCents: term.minimum_commission_cents ?? currentSetting?.minimum_commission_cents ?? 0,
                  thresholdCents: term.threshold_cents ?? currentSetting?.threshold_cents ?? 1_000_000,
                  tierOneLimitCents: term.tier_one_limit_cents ?? settingTierOneLimit(currentSetting),
                  tierThreeRateBps: term.tier_three_rate_bps ?? settingTierThreeRate(currentSetting),
                  tierTwoLimitCents: term.tier_two_limit_cents ?? settingTierTwoLimit(currentSetting),
                  tierTwoRateBps: term.tier_two_rate_bps ?? term.commission_rate_bps ?? settingTierTwoRate(currentSetting),
                }))}
              />
            </Card>
            <Card>
              <h2 className="text-lg font-semibold text-midnight">Aktive individuelle vilkår</h2>
              <div className="mt-4 divide-y divide-midnight/10">
                {activeIndividualTerms.length ? (
                  activeIndividualTerms.map((term) => (
                    <article className="grid gap-3 py-3 md:grid-cols-[1fr_auto] md:items-center" key={term.id}>
                      <div>
                        <p className="font-semibold text-midnight">{facilitatorName(term.facilitator_profiles)}</p>
                        <p className="mt-1 text-sm text-ink/68">
                          {revenueBracketPlanLabel({
                            commission_rate_bps: term.commission_rate_bps ?? currentSetting?.commission_rate_bps ?? defaultCommissionRateBps,
                            created_at: term.created_at,
                            currency: term.currency ?? currentSetting?.currency ?? "DKK",
                            effective_from: term.effective_from,
                            id: term.id,
                            is_active: true,
                            minimum_commission_cents: term.minimum_commission_cents ?? currentSetting?.minimum_commission_cents ?? 0,
                            reason: term.reason,
                            threshold_cents: term.threshold_cents ?? currentSetting?.threshold_cents ?? 1_000_000,
                            tier_one_limit_cents: term.tier_one_limit_cents ?? settingTierOneLimit(currentSetting),
                            tier_three_rate_bps: term.tier_three_rate_bps ?? settingTierThreeRate(currentSetting),
                            tier_two_limit_cents: term.tier_two_limit_cents ?? settingTierTwoLimit(currentSetting),
                            tier_two_rate_bps: term.tier_two_rate_bps ?? term.commission_rate_bps ?? settingTierTwoRate(currentSetting),
                          })}{" "}
                          · {term.currency ?? "DKK"} · fra {dateLabel(term.effective_from)}
                        </p>
                        {term.reason ? <p className="mt-1 text-sm text-ink/62">{term.reason}</p> : null}
                      </div>
                      <form action={resetFacilitatorCommissionTermsAction}>
                        <input name="facilitator_id" type="hidden" value={term.facilitator_id} />
                        <button className="h-10 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" type="submit">
                          Nulstil til standard
                        </button>
                      </form>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-ink/64">Ingen aktive individuelle vilkår. Alle arrangører bruger standarden.</p>
                )}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === "reports" ? (
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" href="/admin/commission/export?type=invoice-basis">
                <FileDown className="size-4" aria-hidden="true" />
                Fakturagrundlag CSV
              </Link>
              <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" href="/admin/commission/export?type=facilitator-totals">
                <FileDown className="size-4" aria-hidden="true" />
                Arrangørtotaler CSV
              </Link>
              <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight" href="/admin/commission/export?type=monthly-report">
                <FileDown className="size-4" aria-hidden="true" />
                Månedsrapporter CSV
              </Link>
            </div>
            <ReportForm
              facilitators={facilitatorRows.map((facilitator) => ({
                ...facilitator,
                profiles: Array.isArray(facilitator.profiles)
                  ? facilitator.profiles.map((profile) => ({ full_name: profile.full_name ?? "" }))
                  : facilitator.profiles
                    ? { full_name: facilitator.profiles.full_name ?? "" }
                    : null,
              }))}
            />
            <InvoiceDraftList invoices={invoices ?? []} />
            <Card>
              <h2 className="text-lg font-semibold text-midnight">Seneste månedsrapporter</h2>
              <div className="mt-4 divide-y divide-midnight/10">
                {(monthlyReports ?? []).map((report) => (
                  <article className="grid gap-2 py-3 text-sm md:grid-cols-4" key={report.id}>
                    <span className="font-semibold text-midnight">{dateLabel(report.period_start)}</span>
                    <span>{report.total_bookings} tilmeldinger</span>
                    <span>{kroner(report.booking_value_cents)}</span>
                    <span>{kroner(report.commission_cents)} kommission</span>
                  </article>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        <p className="text-xs text-ink/50">
          Admin: {adminProfile.email}. Kommissionslogikken anvender kun centrale standardvilkår eller aktive individuelle arrangørvilkår.
        </p>
      </section>
    </main>
  );
}
