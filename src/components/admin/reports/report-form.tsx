import { FilePlus2 } from "lucide-react";
import { generateMonthlyReportAction } from "@/app/admin/reports/actions";

type Facilitator = {
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
};

type ReportFormProps = {
  facilitators: Facilitator[];
};

function facilitatorName(facilitator: Facilitator) {
  const profile = Array.isArray(facilitator.profiles) ? facilitator.profiles[0] : facilitator.profiles;
  return facilitator.company_name || profile?.full_name || "Arrangør";
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function ReportForm({ facilitators }: ReportFormProps) {
  return (
    <form action={generateMonthlyReportAction} className="rounded-md border border-midnight/10 bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-terracotta text-white">
          <FilePlus2 className="size-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-midnight">Generér månedsrapport</h2>
          <p className="text-sm text-ink/64">Opret rapport og fakturakladde for én arrangør og måned.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Arrangør
          <select
            className="h-11 rounded-md border border-midnight/15 bg-white px-3 text-base outline-none transition focus:border-sage-700"
            name="facilitator_id"
            required
          >
            <option value="">Vælg arrangør</option>
            {facilitators.map((facilitator) => (
              <option key={facilitator.id} value={facilitator.id}>
                {facilitatorName(facilitator)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-ink/72">
          Måned
          <input
            className="h-11 rounded-md border border-midnight/15 px-3 text-base outline-none transition focus:border-sage-700"
            defaultValue={currentMonth()}
            name="month"
            required
            type="month"
          />
        </label>
      </div>

      <label className="mt-4 grid gap-2 text-sm font-medium text-ink/72">
        Bankoplysninger
        <textarea
          className="min-h-24 rounded-md border border-midnight/15 p-3 text-base outline-none transition focus:border-sage-700"
          name="bank_details"
          placeholder="Reg.nr., kontonummer eller betalingsoplysninger"
        />
      </label>

      <button
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-midnight px-4 text-sm font-semibold text-white transition hover:bg-sage-700"
        type="submit"
      >
        <FilePlus2 className="size-4" aria-hidden="true" />
        Opret rapport og fakturakladde
      </button>
    </form>
  );
}
