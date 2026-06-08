"use client";

export function MigrationLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-muted-foreground">{children}</label>;
}

export function MigrationInput({
  value, onChange, onBlur, placeholder, type = "text",
}: {
  value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      autoComplete="off"
      className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-slate-500"
    />
  );
}
