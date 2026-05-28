export default function Placeholder({
  title,
  fase,
  children,
}: {
  title: string;
  fase: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
          {fase}
        </span>
      </div>
      <div className="mt-6 rounded-xl border border-dashed border-black/15 p-8 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
        {children}
      </div>
    </div>
  );
}
