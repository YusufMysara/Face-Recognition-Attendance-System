import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/shared/StatsCard";
import { GraduationCap, UserCog, BookOpen, Calendar, TrendingUp, Loader2, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi, coursesApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  activeSessions: number;
}

export default function AdminDashboard() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [usersData, coursesData] = await Promise.all([
        usersApi.list(),
        coursesApi.list()
      ]);

      // Calculate stats from the data
      const totalStudents = usersData.filter(user => user.role === "student").length;
      const totalTeachers = usersData.filter(user => user.role === "teacher").length;
      const totalCourses = coursesData.length;
      // For active sessions, we can't easily get this without a new endpoint
      // For now, we'll set it to 0
      const activeSessions = 0;

      setStats({
        totalStudents,
        totalTeachers,
        totalCourses,
        activeSessions
      });
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    try {
      setChangingPassword(true);
      const updatedUser = await usersApi.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Update localStorage with the updated user data to hide the section
      localStorage.setItem("user", JSON.stringify(updatedUser));
      // Refresh user context
      await refreshUser();
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setChangingPassword(false);
    }
  };

  const displayStats = [
    {
      title: "Total Students",
      value: stats.totalStudents.toString(),
      icon: GraduationCap
    },
    {
      title: "Total Teachers",
      value: stats.totalTeachers.toString(),
      icon: UserCog
    },
    {
      title: "Total Courses",
      value: stats.totalCourses.toString(),
      icon: BookOpen
    },
  ];

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadDashboardStats} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your system overview.</p>
      </div>

      {/* Password Change Section - Only show if admin hasn't changed their password */}
      {!user?.password_changed && (
        <Card className="p-6 rounded-xl shadow-md mb-8 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <Lock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-amber-900">Complete Your Profile</h2>
              <p className="text-amber-700">Change your default password to secure your account</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="current-password" className="text-sm font-medium">
                Current Password
              </Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter default123"
                className="mt-1"
                disabled={changingPassword}
              />
            </div>
            <div>
              <Label htmlFor="new-password" className="text-sm font-medium">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="mt-1"
                disabled={changingPassword}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm New Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="mt-1"
                disabled={changingPassword}
              />
            </div>
            <Button
              onClick={handlePasswordChange}
              disabled={!currentPassword || !newPassword || !confirmPassword || changingPassword}
              className="rounded-lg w-full"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing Password...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {displayStats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
          <div className="space-y-4">
            <div className="text-center text-muted-foreground py-8">
              <p>Coming Soon</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start p-3 h-auto rounded-lg"
              onClick={() => navigate("/admin/users?create=true")}
            >
              Create New User
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start p-3 h-auto rounded-lg"
              onClick={() => navigate("/admin/courses?create=true")}
            >
              Add New Course
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start p-3 h-auto rounded-lg"
              onClick={() => navigate("/admin/upload-photos")}
            >
              Upload Student Photos
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start p-3 h-auto rounded-lg"
              onClick={() => navigate("/admin/attendance")}
            >
              View All Reports
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
