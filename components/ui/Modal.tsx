"use client";

export default function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b p-4">
            <div className="text-sm font-semibold">{title}</div>
            <button
              className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
