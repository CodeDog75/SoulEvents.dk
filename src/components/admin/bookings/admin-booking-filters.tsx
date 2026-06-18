type AdminBookingFiltersProps = {
  selected: {
    facilitator: string;
    status: string;
    from: string;
    to: string;
  };
  facilitators: Array<{
    id: string;
    company_name: string | null;
    profiles:
      | {
          full_name: string;
        }
      | Array<{
          full_name: string;
        }>
      | null;
  }>;
};

const statusOptions = [
  { label: "Alle statusser", value: "" },
  { label: "Afventer", value: "pending" },
  { label: "Bekræftet", value: "confirmed" },
  { label: "Udsolgt", value: "sold_out" },
  { label: "Aflyst", value: "cancelled" },
  { label: "Afholdt", value: "completed" },
  { label: "Faktureret", value: "invoiced" },
  { label: "Betalt", value: "paid" },
];

function facilitatorName(facilitator: AdminBookingFiltersProps["facilitators"][number]) {
  const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
  return facilitator.company_name || profile?.full_name || "Arrangør";
}

export function AdminBookingFilters({ selected, facilitators }: AdminBookingFiltersProps) {
  return (
    <form className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <h2 className="text-lg font-semibold text-midnight">Filtrer tilmeldinger</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Arrangør
          <select
            className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={selected.facilitator}
            name="facilitator"
          >
            <option value="">Alle arrangører</option>
            {facilitators.map((facilitator) => (
              <option key={facilitator.id} value={facilitator.id}>
                {facilitatorName(facilitator)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Status
          <select
            className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={selected.status}
            name="status"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Fra
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={selected.from}
            name="from"
            type="date"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Til
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={selected.to}
            name="to"
            type="date"
          />
        </label>

        <div className="flex items-end">
          <button
            className="h-11 w-full rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
            type="submit"
          >
            Filtrer
          </button>
        </div>
      </div>
    </form>
  );
}
