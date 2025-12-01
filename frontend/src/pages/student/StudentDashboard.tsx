import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Calendar, TrendingUp, Award, Loader2 } from "lucide-react";
import { StatsCard } from "@/components/shared/StatsCard";
import { coursesApi, attendanceApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Course {
  id: number;
  name: string;
  description: string;
  teacher_id?: number;
}

interface AttendanceRecord {
  id: number;
  session_id: number;
  student_id: number;
  status: "present" | "absent";
  timestamp: string;
  student_name?: string;
  course_id: number;
  course_name: string;
}

interface AttendanceResponse {
  history: AttendanceRecord[];
  percentages: Array<{
    course_id: number;
    attendance_percentage: number;
  }>;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
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

      // Load courses and attendance data in parallel
      const [coursesData, attendanceResponse] = await Promise.all([
        coursesApi.list(),
        attendanceApi.getStudentAttendance(user.id)
      ]);

      setCourses(coursesData);
      setAttendanceData(attendanceResponse);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const enrolledCourses = courses.length;
  const attendanceRecords = attendanceData?.history || [];
  const totalSessions = attendanceRecords.length;
  const presentSessions = attendanceRecords.filter(record => record.status === "present").length;
  const overallAttendance = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

  // Recent attendance (last 4 records)
  const recentAttendance = attendanceRecords
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 4)
    .map(record => ({
      date: new Date(record.timestamp).toLocaleDateString(),
      course: record.course_name,
      status: record.status === "present" ? "Present" : "Absent"
    }));

  const stats = [
    { title: "Enrolled Courses", value: String(enrolledCourses), icon: BookOpen },
    { title: "Total Sessions", value: String(totalSessions), icon: Calendar },
    { title: "Overall Attendance", value: `${overallAttendance}%`, icon: TrendingUp },
  ];

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your dashboard...</p>
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

  // Calculate course attendance
  const courseAttendance = courses.map(course => {
    const courseRecords = attendanceRecords.filter((record: any) => record.course_id === course.id);
    const present = courseRecords.filter((record: any) => record.status === "present").length;
    const total = courseRecords.length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    return {
      ...course,
      attendance: `${percentage}%`,
      sessions: total
    };
  });

  return (
    <div className="content-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your attendance overview.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">My Courses</h2>
          {courses.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No courses enrolled yet
            </p>
          ) : (
            <div className="space-y-3">
              {courseAttendance.map((course) => (
                <div key={course.id} className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{course.name}</span>
                    <span className="text-sm font-semibold text-primary">{course.attendance}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Course ID: {course.id} • {course.sessions} sessions
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Recent Attendance</h2>
          {recentAttendance.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No attendance records yet
            </p>
          ) : (
            <div className="space-y-4">
              {recentAttendance.map((record, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{record.course}</p>
                    <p className="text-xs text-muted-foreground">{record.date}</p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      record.status === "Present" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
