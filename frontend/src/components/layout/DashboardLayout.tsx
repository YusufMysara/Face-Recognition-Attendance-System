import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Navbar } from "./Navbar";
import { useAuth } from "@/context/AuthContext";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "admin" | "teacher" | "student";
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const { user } = useAuth();
  const userName = user?.name || "User";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar role={role} />
        <div className="flex-1 flex flex-col">
          <Navbar userName={userName} userRole={role.charAt(0).toUpperCase() + role.slice(1)} />
          <main className="flex-1 bg-muted">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
