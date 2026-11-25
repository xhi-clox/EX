export const inputClassName =
  'w-full rounded-xl border border-[#d1e2de] bg-[#f4f9f7] px-4 py-3 text-sm font-medium text-[#17343a] outline-none transition-all placeholder:text-[#668384] focus:border-[#5aa99d] focus:bg-white focus:ring-4 focus:ring-[#dff1ed]';

export const labelClassName = 'mb-1.5 block text-[13px] font-bold text-[#17343a]';

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="rounded-xl border border-[#f2cdc7] bg-[#fdf1ef] px-4 py-3 text-sm font-medium text-[#b04a3b]"
    >
      {message}
    </p>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-[#e2ecea]" />
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#829697]">or</span>
      <span className="h-px flex-1 bg-[#e2ecea]" />
    </div>
  );
}
