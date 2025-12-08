import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookOpen, Calendar, TrendingUp, Award, Loader2, Upload, Camera } from "lucide-react";
import { StatsCard } from "@/components/shared/StatsCard";
import { coursesApi, attendanceApi, usersApi, handleApiError } from "@/lib/api";
import { useAuth, AuthContextType } from "@/context/AuthContext";
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
  session_name: string;
}

interface AttendanceResponse {
  history: AttendanceRecord[];
  percentages: Array<{
    course_id: number;
    attendance_percentage: number;
  }>;
}

export default function StudentDashboard() {
  const { user, refreshUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Load data on mount
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const handlePhotoUpload = async () => {
    if (!photoFile) {
      toast.error("Please select a photo to upload");
      return;
    }

    try {
      setUploadingPhoto(true);
      const updatedUser = await usersApi.uploadStudentPhoto(photoFile);
      toast.success("Photo uploaded successfully! Your face embedding has been created for attendance recognition.");
      setPhotoFile(null);

      // Update localStorage with the updated user data to hide the upload section
      localStorage.setItem("user", JSON.stringify(updatedUser));
      // Refresh user context
      await refreshUser();
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Please select a valid image file");
        return;
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setPhotoFile(file);
    }
  };

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
      session: record.session_name || 'Session',
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

      {/* Photo Upload Section - Only show if student hasn't uploaded a photo */}
      {!user?.photo_path && (
        <Card className="p-6 rounded-xl shadow-md mb-8 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <Camera className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-amber-900">Complete Your Profile</h2>
              <p className="text-amber-700">Upload a clear photo of your face to enable attendance recognition</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="photo-upload" className="text-sm font-medium">
                Select Photo
              </Label>
              <Input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="mt-1"
                disabled={uploadingPhoto}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Supports JPG, PNG, JPEG (Max 10MB). Photo must contain a clear face.
              </p>
            </div>
            <Button
              onClick={handlePhotoUpload}
              disabled={!photoFile || uploadingPhoto}
              className="rounded-lg"
            >
              {uploadingPhoto ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </>
              )}
            </Button>
          </div>

          {photoFile && (
            <div className="mt-4 p-3 bg-white rounded-lg border">
              <p className="text-sm text-green-600">
                ✓ Selected: {photoFile.name} ({(photoFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            </div>
          )}
        </Card>
      )}

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
                    {course.sessions} sessions
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
                    <p className="text-xs text-muted-foreground">{record.session}</p>
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
