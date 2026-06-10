import { useState, useEffect, useRef } from "react";
import { Bell, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { notificationsApi, AttendanceNotification } from "@/lib/api";

interface NavbarProps {
  userName?: string;
  userRole?: string;
}

export function Navbar({ userName = "John Doe", userRole = "Admin" }: NavbarProps) {
  const { logout, user } = useAuth();
  const [notifications, setNotifications] = useState<AttendanceNotification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  // Fetch notifications only for students
  useEffect(() => {
    if (user?.role === "student") {
      notificationsApi.get().then(setNotifications).catch(() => {});
    }
  }, [user?.role]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="h-16 border-b border-border bg-card sticky top-0 z-50 shadow-sm">
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="lg:hidden" />
        </div>

        <div className="flex items-center gap-3">
          {/* Bell — interactive with dropdown for students only */}
          {user?.role === "student" ? (
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setDropdownOpen((o) => !o)}
                aria-label="Open notifications"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {notifications.length}
                  </span>
                )}
              </Button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-sm font-semibold">
                      {notifications.length === 0
                        ? "Notifications"
                        : `${notifications.length} Low-Attendance Warning${notifications.length > 1 ? "s" : ""}`}
                    </p>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No notifications
                    </div>
                  ) : (
                    <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                      {notifications.map((n) => (
                        <li key={n.course_id} className="px-4 py-3 flex items-start gap-3">
                          <span className="text-lg mt-0.5">⚠️</span>
                          <div>
                            <p className="text-sm font-medium leading-tight">{n.course_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Attendance:{" "}
                              <span className="text-destructive font-semibold">
                                {n.attendance_percentage}%
                              </span>{" "}
                              — below the 75% threshold
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex items-center gap-3 pl-3 border-l border-border">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{userName}</p>
              <p className="text-xs text-muted-foreground">{userRole}</p>
            </div>
            <Avatar>
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>

          <Button variant="ghost" size="icon" onClick={logout} title="Logout">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
