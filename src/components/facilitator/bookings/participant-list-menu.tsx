"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Printer, Users, X } from "lucide-react";
import type { BookingStatus } from "@/types/database";

type ParticipantListRow = {
  id: string;
  bookingValueCents: number;
  createdAt: string;
  email: string;
  manualPaymentNote: string | null;
  message: string | null;
  name: string;
  paymentReference: string | null;
  paymentStatus: "Afventer" | "Betalt" | "Ikke relevant";
  phone: string | null;
  seats: number;
  sourceLabel?: string;
  status: BookingStatus;
};

type ParticipantListMenuProps = {
  bookings: ParticipantListRow[];
  eventLocation?: string | null;
  eventStartsAt: string;
  eventTitle: string;
};

type FilterKey = "active" | "all" | "cancelled" | "confirmed" | "pending";

const filterLabels: Record<FilterKey, string> = {
  active: "Aktive tilmeldinger",
  confirmed: "Kun bekræftede",
  pending: "Legacy: afventer",
  cancelled: "Annullerede",
  all: "Alle",
};

const statusLabels: Partial<Record<BookingStatus, string>> = {
  pending: "Afventer",
  confirmed: "Bekræftet",
  cancelled: "Annulleret",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMoney(cents: number) {
  return `${new Intl.NumberFormat("da-DK").format(cents / 100)} kr.`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function csvEscape(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = "\ufeff" + rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function filterRows(rows: ParticipantListRow[], filter: FilterKey) {
  if (filter === "active") {
    return rows.filter((row) => row.status === "pending" || row.status === "confirmed");
  }

  if (filter === "all") {
    return rows;
  }

  return rows.filter((row) => row.status === filter);
}

export function ParticipantListMenu({ bookings, eventLocation, eventStartsAt, eventTitle }: ParticipantListMenuProps) {
  const [filter, setFilter] = useState<FilterKey>("active");
  const [includeContact, setIncludeContact] = useState(true);
  const [includePayment, setIncludePayment] = useState(true);
  const [includeValue, setIncludeValue] = useState(false);
  const [includeNote, setIncludeNote] = useState(false);
  const [includeMessage, setIncludeMessage] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  const visibleRows = useMemo(() => filterRows(bookings, filter), [bookings, filter]);
  const bookingCount = visibleRows.length;
  const seatCount = visibleRows.reduce((sum, row) => sum + row.seats, 0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    wasOpenRef.current = true;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && wasOpenRef.current) {
      openerRef.current?.focus();
    }
  }, [isOpen]);

  function handleCsvDownload() {
    const headers = ["Navn"];
    if (includeContact) {
      headers.push("E-mail", "Telefon");
    }
    headers.push("Antal pladser", "Tilmeldingsstatus", "Kilde");
    if (includePayment) {
      headers.push("Betalingsstatus");
    }
    if (includeValue) {
      headers.push("Bookingværdi");
    }
    headers.push("Tilmeldingsdato");
    if (includePayment) {
      headers.push("Betalingsreference");
    }
    if (includeNote) {
      headers.push("Intern note");
    }
    if (includeMessage) {
      headers.push("Deltagerens besked");
    }

    const rows = visibleRows.map((row) => {
      const values: Array<string | number> = [row.name];
      if (includeContact) {
        values.push(row.email, row.phone || "");
      }
      values.push(row.seats, statusLabels[row.status] ?? row.status, row.sourceLabel ?? "SoulEvents-booking");
      if (includePayment) {
        values.push(row.paymentStatus);
      }
      if (includeValue) {
        values.push((row.bookingValueCents / 100).toLocaleString("da-DK"));
      }
      values.push(formatDateTime(row.createdAt));
      if (includePayment) {
        values.push(row.paymentReference || "");
      }
      if (includeNote) {
        values.push(row.manualPaymentNote || "");
      }
      if (includeMessage) {
        values.push(row.message || "");
      }
      return values.map(String);
    });
    const eventDate = new Date(eventStartsAt).toISOString().slice(0, 10);
    downloadCsv(`${slugify(eventTitle) || "event"}-deltagerliste-${eventDate}.csv`, [headers, ...rows.map((row) => row.map(String))]);
  }

  return (
    <>
      <button
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
        onClick={() => setIsOpen(true)}
        ref={openerRef}
        type="button"
      >
        <Users className="size-4" aria-hidden="true" />
        Deltagerliste
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-midnight/35 px-3 py-6 participant-list-no-print"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-md bg-white shadow-lift" role="dialog" aria-modal="true" aria-labelledby="participant-list-title">
            <div className="flex items-start justify-between gap-4 border-b border-midnight/10 p-4 sm:p-6 participant-list-no-print">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-lavender">Deltagerliste</p>
                <h2 className="text-2xl font-semibold text-midnight" id="participant-list-title">
                  {eventTitle}
                </h2>
                <p className="mt-1 text-sm text-ink/64">
                  {formatDateTime(eventStartsAt)}{eventLocation ? ` · ${eventLocation}` : ""}
                </p>
                <p className="mt-2 text-sm font-semibold text-sage-700">
                  {bookingCount} tilmeldinger · {seatCount} reserverede pladser
                </p>
              </div>
              <button
                aria-label="Luk deltagerliste"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-sand/50 text-midnight transition hover:bg-sand"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-96px)] overflow-y-auto">
              <div className="grid gap-5 p-4 sm:p-6 participant-list-no-print">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
                  <fieldset className="grid gap-2">
                    <legend className="text-sm font-semibold text-midnight">Vis tilmeldinger</legend>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
                        <button
                          className={
                            "rounded-full border px-3 py-1.5 text-sm font-semibold transition " +
                            (filter === key ? "border-sage-700 bg-sage-50 text-sage-700" : "border-midnight/10 bg-white text-ink/70 hover:border-sage-700")
                          }
                          key={key}
                          onClick={() => setFilter(key)}
                          type="button"
                        >
                          {filterLabels[key]}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                      onClick={() => window.print()}
                      type="button"
                    >
                      <Printer className="size-4" aria-hidden="true" />
                      Udskriv deltagerliste
                    </button>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-midnight/15 bg-white px-3 text-sm font-semibold text-midnight transition hover:border-sage-700 hover:text-sage-700"
                      onClick={handleCsvDownload}
                      type="button"
                    >
                      <Download className="size-4" aria-hidden="true" />
                      Download CSV
                    </button>
                  </div>
                </div>

                <div className="rounded-md bg-sand/35 p-4">
                  <p className="text-sm font-semibold text-midnight">Vælg oplysninger</p>
                  <p className="mt-1 text-sm text-ink/64">Deltagerlisten indeholder personoplysninger. Opbevar og del den forsvarligt.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      ["Kontaktoplysninger", includeContact, setIncludeContact],
                      ["Betalingsstatus", includePayment, setIncludePayment],
                      ["Bookingværdi", includeValue, setIncludeValue],
                      ["Intern note", includeNote, setIncludeNote],
                      ["Deltagerens besked", includeMessage, setIncludeMessage],
                    ].map(([label, checked, setter]) => (
                      <label className="flex items-center gap-2 text-sm font-semibold text-midnight" key={String(label)}>
                        <input
                          checked={Boolean(checked)}
                          className="size-4 accent-lavender"
                          onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)}
                          type="checkbox"
                        />
                        {label as string}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <section className="p-4 sm:p-6" id="participant-list-print">
                <div className="hidden print:block">
                  <h1 className="text-xl font-bold text-midnight">SoulEvents</h1>
                  <h2 className="mt-4 text-2xl font-bold text-midnight">{eventTitle}</h2>
                  <p className="mt-1 text-sm text-ink/70">{formatDateTime(eventStartsAt)}</p>
                  {eventLocation ? <p className="text-sm text-ink/70">{eventLocation}</p> : null}
                  <p className="mt-3 text-sm font-bold text-midnight">
                    Antal bookinger: {bookingCount} · Antal reserverede pladser: {seatCount}
                  </p>
                </div>

                {visibleRows.length === 0 ? (
                  <div className="rounded-md border border-midnight/10 bg-white p-8 text-center">
                    <h3 className="font-semibold text-midnight">Ingen tilmeldinger matcher filteret</h3>
                  </div>
                ) : (
                  <>
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-midnight/10 text-xs uppercase tracking-wide text-ink/55">
                            <th className="py-3 pr-3 print:table-cell hidden">✓</th>
                            <th className="py-3 pr-3">Deltager</th>
                            {includeContact ? <th className="px-3 py-3">Kontakt</th> : null}
                            <th className="px-3 py-3 text-right">Pladser</th>
                            <th className="px-3 py-3">Status</th>
                            <th className="px-3 py-3">Kilde</th>
                            {includePayment ? <th className="px-3 py-3">Betaling</th> : null}
                            {includeValue ? <th className="px-3 py-3 text-right">Værdi</th> : null}
                            <th className="px-3 py-3">Tilmeldt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => (
                            <tr className="border-b border-midnight/10 align-top" key={row.id}>
                              <td className="py-3 pr-3 print:table-cell hidden">☐</td>
                              <td className="py-3 pr-3 font-semibold text-midnight">{row.name}</td>
                              {includeContact ? (
                                <td className="px-3 py-3 text-ink/70">
                                  <span className="block">{row.email}</span>
                                  <span className="block">{row.phone || "Ingen telefon"}</span>
                                </td>
                              ) : null}
                              <td className="px-3 py-3 text-right font-semibold text-midnight">{row.seats}</td>
                              <td className="px-3 py-3">{statusLabels[row.status] ?? row.status}</td>
                              <td className="px-3 py-3">{row.sourceLabel ?? "SoulEvents-booking"}</td>
                              {includePayment ? <td className="px-3 py-3">{row.paymentStatus}</td> : null}
                              {includeValue ? <td className="px-3 py-3 text-right">{formatMoney(row.bookingValueCents)}</td> : null}
                              <td className="px-3 py-3">{formatDateTime(row.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="grid gap-3 md:hidden">
                      {visibleRows.map((row) => (
                        <article className="rounded-md border border-midnight/10 bg-white p-4 shadow-soft" key={row.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-midnight">{row.name}</h3>
                              <p className="text-sm text-ink/60">{statusLabels[row.status] ?? row.status}</p>
                              <p className="text-xs font-semibold uppercase tracking-wide text-lavender">{row.sourceLabel ?? "SoulEvents-booking"}</p>
                            </div>
                            <span className="rounded-full bg-sage-50 px-3 py-1 text-sm font-semibold text-sage-700">{row.seats} pladser</span>
                          </div>
                          {includeContact ? (
                            <p className="mt-3 text-sm leading-6 text-ink/70">
                              {row.email}<br />
                              {row.phone || "Ingen telefon"}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-ink/60">
                            {includePayment ? <span className="rounded-full bg-sand/45 px-2.5 py-1">{row.paymentStatus}</span> : null}
                            {includeValue ? <span className="rounded-full bg-sand/45 px-2.5 py-1">{formatMoney(row.bookingValueCents)}</span> : null}
                            <span className="rounded-full bg-sand/45 px-2.5 py-1">{formatDateTime(row.createdAt)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                )}

                <p className="mt-6 hidden text-xs text-ink/50 print:block">
                  Udskrevet {new Intl.DateTimeFormat("da-DK", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}
                </p>
              </section>
            </div>
          </div>

          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #participant-list-print,
              #participant-list-print * {
                visibility: visible !important;
              }
              #participant-list-print {
                background: white !important;
                left: 0;
                padding: 24px !important;
                position: absolute;
                top: 0;
                width: 100%;
              }
              .participant-list-no-print {
                display: none !important;
              }
              table {
                font-size: 11px !important;
              }
            }
          `}</style>
        </div>
      ) : null}
    </>
  );
}
