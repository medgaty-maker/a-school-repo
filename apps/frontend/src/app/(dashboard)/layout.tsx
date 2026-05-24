import { Sidebar } from '@/components/sidebar';
import { FilterBar } from '@/components/filter-bar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <FilterBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
