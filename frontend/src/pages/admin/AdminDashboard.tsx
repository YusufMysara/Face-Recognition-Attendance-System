import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { StatsCard } from "@/components/shared/StatsCard";
import { Users, BookOpen, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usersApi, coursesApi, handleApiError } from "@/lib/api";
import { toast } from "sonner";

interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalCourses: number;
  activeSessions: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0,
    totalTeachers: 0,
    totalCourses: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const displayStats = [
    {
      title: "Total Students",
      value: stats.totalStudents.toString(),
      icon: Users
    },
    {
      title: "Total Teachers",
      value: stats.totalTeachers.toString(),
      icon: Users
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
              <p>Activity logging not yet implemented</p>
              <p className="text-xs mt-2">This feature requires additional backend endpoints</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start p-3 h-auto rounded-lg"
              onClick={() => navigate("/admin/users")}
            >
              Create New User
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start p-3 h-auto rounded-lg"
              onClick={() => navigate("/admin/courses")}
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
