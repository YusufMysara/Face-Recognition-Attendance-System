import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { coursesApi, attendanceApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface Course {
  id: number;
  name: string;
  description: string;
  teacher_id?: number;
}

interface CourseStats {
  id: number;
  name: string;
  description: string;
  percentage: number;
  present: number;
  total: number;
}

export default function AttendanceStats() {
  const { user } = useAuth();
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [overallStats, setOverallStats] = useState({ percentage: 0, present: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadAttendanceStats();
    }
  }, [user]);

  const loadAttendanceStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Load courses and attendance data in parallel
      const [coursesData, attendanceData] = await Promise.all([
        coursesApi.list(),
        attendanceApi.getStudentAttendance(user.id)
      ]);

      // Calculate stats for each course
      const stats: CourseStats[] = coursesData.map(course => {
        const courseRecords = attendanceData.history.filter((record: any) => record.course_id === course.id);
        const present = courseRecords.filter((record: any) => record.status === "present").length;
        const total = courseRecords.length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        return {
          id: course.id,
          name: course.name,
          description: course.description,
          percentage,
          present,
          total
        };
      });

      // Calculate overall stats
      const totalPresent = stats.reduce((sum, course) => sum + course.present, 0);
      const totalSessions = stats.reduce((sum, course) => sum + course.total, 0);
      const overallPercentage = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

      setCourseStats(stats);
      setOverallStats({
        percentage: overallPercentage,
        present: totalPresent,
        total: totalSessions
      });
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading attendance statistics...</p>
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
            <Button onClick={loadAttendanceStats} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Attendance Statistics</h1>
        <p className="text-muted-foreground">Your attendance percentage for each course</p>
      </div>

      {courseStats.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No course data available</p>
        </div>
      ) : (
        <div className="grid gap-6 max-w-4xl">
          {courseStats.map((course) => (
            <Card key={course.id} className="p-6 rounded-xl shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3
                    className="mb-2"
                    style={{
                      fontSize: '1.875rem',
                      lineHeight: '2.75rem',
                      fontWeight: '500'
                    }}
                  >
                    {course.name}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{course.percentage}%</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {course.present}/{course.total} classes
                  </p>
                </div>
              </div>
              <Progress value={course.percentage} className="h-3" />
            </Card>
          ))}

          <Card className="p-6 rounded-xl shadow-md bg-primary text-primary-foreground">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Overall Attendance</p>
              <p className="text-5xl font-bold mb-2">{overallStats.percentage}%</p>
              <p className="text-sm opacity-90">
                {overallStats.present}/{overallStats.total} total classes attended
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
