import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/shared/StatsCard";
import { BookOpen, Users, Calendar, TrendingUp, Loader2, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { coursesApi, sessionsApi, attendanceApi, usersApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface RecentSession {
  id: number;
  course_name: string;
  session_name: string;
  attendance_percentage: number;
}

export default function TeacherDashboard() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    coursesTaught: 0,
    totalStudents: 0,
    sessionsToday: 0,
  });
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Load dashboard data on mount
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Load courses taught by this teacher
      const coursesData = await coursesApi.list();
      const teacherCourses = coursesData.filter(course => course.teacher_id === user.id);

      // Calculate total students across all courses
      let totalStudents = 0;
      for (const course of teacherCourses) {
        const courseStudents = await coursesApi.getCourseStudents(course.id);
        totalStudents += courseStudents.length;
      }

      // Get sessions for today (this would need a proper date filter, but for now we'll get recent sessions)
      let sessionsToday = 0;
      const allSessions: RecentSession[] = [];

      for (const course of teacherCourses) {
        const courseSessions = await coursesApi.getCourseSessions(course.id);

        // Filter sessions from today (simplified - in real implementation, you'd check actual dates)
        const todaySessions = courseSessions.filter(session => {
          const sessionDate = new Date(session.started_at);
          const today = new Date();
          return sessionDate.toDateString() === today.toDateString();
        });
        sessionsToday += todaySessions.length;

        // Get recent sessions with attendance data
        const recentSessionsForCourse = courseSessions
          .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
          .slice(0, 3);

        // Create a map to track session numbers per course
        const courseSessionNumbers = new Map();

        for (const session of recentSessionsForCourse) {
          try {
            const attendance = await attendanceApi.getSessionAttendance(session.id);
            const presentCount = attendance.filter(record => record.status === "present").length;
            const totalCount = attendance.length;
            const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

            // Get session number for this course
            const currentNumber = courseSessionNumbers.get(course.id) || 0;
            const sessionNumber = currentNumber + 1;
            courseSessionNumbers.set(course.id, sessionNumber);

            allSessions.push({
              id: session.id,
              course_name: course.name,
              session_name: `Session ${sessionNumber}`,
              attendance_percentage: percentage
            });
          } catch (err) {
            // If no attendance data, skip this session
            continue;
          }
        }
      }

      // Sort by session ID (descending) and take the 5 most recent sessions
      const sortedSessions = allSessions
        .sort((a, b) => b.id - a.id)
        .slice(0, 5);

      setStats({
        coursesTaught: teacherCourses.length,
        totalStudents,
        sessionsToday,
      });
      setRecentSessions(sortedSessions);

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

  const handleSessionClick = (sessionId: number) => {
    navigate(`/teacher/session/${sessionId}`);
  };

  const displayStats = [
    { title: "Courses Taught", value: stats.coursesTaught.toString(), icon: BookOpen },
    { title: "Total Students", value: stats.totalStudents.toString(), icon: Users },
    { title: "Sessions Today", value: stats.sessionsToday.toString(), icon: Calendar },
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
            <Button onClick={loadDashboardData} variant="outline">
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
        <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your teaching overview.</p>
      </div>

      {/* Password Change Section - Only show if teacher hasn't changed their password */}
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

      <div className="grid gap-6">
        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
          {recentSessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No recent sessions found
            </p>
          ) : (
            <div className="space-y-4">
              {recentSessions.map((session, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                  onClick={() => handleSessionClick(session.id)}
                >
                  <div>
                    <p className="font-medium">{session.course_name}</p>
                    <p className="text-xs text-muted-foreground">{session.session_name}</p>
                  </div>
                  <span className="font-semibold text-primary">{session.attendance_percentage}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
