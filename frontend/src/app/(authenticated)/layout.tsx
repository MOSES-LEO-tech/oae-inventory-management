"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { RoleGuard } from "@/components/auth/role-guard";
import { useUIStore } from "@/stores/ui-store";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-canvas p-4 lg:p-8">
            <div className="mx-auto w-full max-w-[1280px]">
              <RoleGuard>{children}</RoleGuard>
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
