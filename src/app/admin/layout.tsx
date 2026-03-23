import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Console',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10">{children}</div>
    </div>
  );
}
