import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { attendanceApi, coursesApi, sessionsApi, handleApiError } from "@/lib/api";

interface StudentAttendance {
  id: number;
  name: string;
  email: string;
  attendance_id?: number;
  status: "present" | "absent";
  marked_at?: string;
}

interface Course {
  id: number;
  name: string;
  description: string;
}

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load session data and course information
  useEffect(() => {
    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  const loadSessionData = async () => {
    if (!sessionId) return;

    try {
      setLoading(true);
      setError(null);

      const sessionIdNum = parseInt(sessionId);

      // Get session data to find course_id
      const sessionData = await sessionsApi.get(sessionIdNum);

      // Get course information
      let courseData = null;
      if (sessionData.course_id) {
        courseData = await coursesApi.get(sessionData.course_id);
      }

      // Get all enrolled students in the course
      const enrolledStudents = await coursesApi.getCourseStudents(sessionData.course_id);

      // Get existing attendance records for this session
      const attendanceData = await attendanceApi.getSessionAttendance(sessionIdNum);

      // Create a map of attendance records by student_id for quick lookup
      const attendanceMap = new Map();
      attendanceData.forEach(attendance => {
        attendanceMap.set(attendance.student_id, attendance);
      });

      // Transform data to show all enrolled students with their attendance status
      const studentsData: StudentAttendance[] = enrolledStudents.map(student => {
        const attendanceRecord = attendanceMap.get(student.id);
        return {
          id: student.id,
          name: student.name,
          email: student.email,
          attendance_id: attendanceRecord?.id,
          status: attendanceRecord ? attendanceRecord.status : "absent",
          marked_at: attendanceRecord?.timestamp
        };
      });

      setCourse(courseData);
      setStudents(studentsData);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = async (studentId: number) => {
    if (!sessionId) return;

    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const newStatus = student.status === "present" ? "absent" : "present";
    const sessionIdNum = parseInt(sessionId);

    try {
      let result;
      if (student.attendance_id) {
        // Update existing record
        result = await attendanceApi.edit(student.attendance_id, newStatus);
      } else {
        // Create new record for students without attendance
        result = await attendanceApi.createManual(sessionIdNum, studentId, newStatus);
      }

      // Update local state
      setStudents(students.map(s =>
        s.id === studentId
          ? {
              ...s,
              status: newStatus,
              attendance_id: result.id,
              marked_at: result.timestamp
            }
          : s
      ));

      toast.success(`Marked ${student.name} as ${newStatus}`);
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  const handleRetake = () => {
    if (!sessionId) return;

    // Navigate back to live camera with the session_id to continue the session
    navigate(`/teacher/camera?session_id=${sessionId}`);
  };

  const handleSubmit = async () => {
    if (!sessionId) return;

    try {
      setSubmitting(true);

      const sessionIdNum = parseInt(sessionId);

      // Submit/finalize the session (ensures all enrolled students have attendance records)
      await sessionsApi.submit(sessionIdNum);

      toast.success("Attendance submitted successfully");
      navigate(`/teacher/course/${course?.id || ''}`);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading attendance data...</p>
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
            <Button onClick={loadSessionData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const presentCount = students.filter(s => s.status === "present").length;
  const totalCount = students.length;

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Review Attendance</h1>
        <p className="text-muted-foreground">
          {course?.name || "Course"} - Session #{sessionId}
        </p>
      </div>

      <Card className="p-6 rounded-xl shadow-md mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Attendance Summary</p>
            <p className="text-2xl font-bold">
              {presentCount} / {totalCount}
            </p>
            <p className="text-sm text-muted-foreground">
              {((presentCount / totalCount) * 100).toFixed(1)}% attendance rate
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="rounded-xl"
              onClick={handleRetake}
              disabled={submitting}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Retake
            </Button>
            <Button
              size="lg"
              className="rounded-xl"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Attendance"
              )}
            </Button>
          </div>
        </div>
      </Card>

      {students.length === 0 ? (
        <Card className="p-8 rounded-xl shadow-md text-center">
          <p className="text-muted-foreground">No attendance records found for this session.</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {students.map((student) => (
            <Card
              key={student.id}
              className="p-4 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => toggleAttendance(student.id)}
            >
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {student.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                  {student.marked_at && (
                    <p className="text-xs text-muted-foreground">
                      Marked: {new Date(student.marked_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>

                <div>
                  {student.status === "present" ? (
                    <Badge className="bg-success hover:bg-success/90">
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Present
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="w-4 h-4 mr-1" />
                      Absent
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
