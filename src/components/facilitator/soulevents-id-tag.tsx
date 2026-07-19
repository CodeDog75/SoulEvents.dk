type SoulEventsIdTagProps = {
  className?: string;
  hostReferenceId?: string | null;
};

export function SoulEventsIdTag({ className = "", hostReferenceId }: SoulEventsIdTagProps) {
  const referenceId = hostReferenceId?.trim();

  if (!referenceId) {
    return null;
  }

  return (
    <span
      className={
        "inline-flex w-fit items-center rounded-full border border-[#D8CBE4] bg-white px-3 py-1 text-[11px] font-semibold leading-none text-[#6E5285] shadow-[0_6px_16px_rgba(47,36,55,0.06)] " +
        className
      }
    >
      SoulEvents-ID: {referenceId}
    </span>
  );
}
