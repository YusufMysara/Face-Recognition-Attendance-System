import { Home, Users, BookOpen, Camera, ClipboardList, UserCog, Upload, KeyRound, BarChart3, Calendar, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  role: "admin" | "teacher" | "student";
}

const sidebarItems = {
  admin: [
    { title: "Dashboard", url: "/admin/dashboard", icon: Home },
    { title: "Manage Users", url: "/admin/users", icon: Users },
    { title: "Manage Courses", url: "/admin/courses", icon: BookOpen },
    { title: "Upload Photos", url: "/admin/upload-photos", icon: Upload },
    { title: "Attendance Records", url: "/admin/attendance", icon: ClipboardList },
  ],
  teacher: [
    { title: "Dashboard", url: "/teacher/dashboard", icon: Home },
    { title: "Courses", url: "/teacher/courses", icon: BookOpen },
    { title: "Reports", url: "/teacher/reports", icon: BarChart3 },
    { title: "Attendance Log", url: "/teacher/attendance-log", icon: ClipboardList },
  ],
  student: [
    { title: "Dashboard", url: "/student/dashboard", icon: Home },
    { title: "Attendance Stats", url: "/student/stats", icon: BarChart3 },
    { title: "Attendance History", url: "/student/history", icon: ClipboardList },
  ],
};

export function AppSidebar({ role }: AppSidebarProps) {
  const { state } = useSidebar();
  const items = sidebarItems[role];
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="p-4 border-b border-sidebar-border">
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <User className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold capitalize">{role} Portal</p>
                <p className="text-xs text-muted-foreground">Attendance System</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <User className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
        </div>
        
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
