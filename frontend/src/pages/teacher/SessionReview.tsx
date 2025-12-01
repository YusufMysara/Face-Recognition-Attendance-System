import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
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

      // Get attendance records for this session
      const attendanceData = await attendanceApi.getSessionAttendance(sessionIdNum);

      // Get session data to find course_id
      const sessionData = await sessionsApi.get(sessionIdNum);

      // Get course information
      let courseData = null;
      if (sessionData.course_id) {
        courseData = await coursesApi.get(sessionData.course_id);
      }

      // Transform attendance data to our interface
      const studentsData: StudentAttendance[] = attendanceData.map(attendance => ({
        id: attendance.student_id,
        name: attendance.student_name || `Student ${attendance.student_id}`,
        email: attendance.student_email || "",
        attendance_id: attendance.id,
        status: attendance.status,
        marked_at: attendance.marked_at
      }));

      setCourse(courseData);
      setStudents(studentsData);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleAttendance = (studentId: number) => {
    setStudents(students.map(s =>
      s.id === studentId
        ? { ...s, status: s.status === "present" ? "absent" : "present" }
        : s
    ));
  };

  const handleSubmit = async () => {
    if (!sessionId) return;

    try {
      setSubmitting(true);

      // Submit attendance changes to backend
      const sessionIdNum = parseInt(sessionId);

      // For each student, update their attendance status
      for (const student of students) {
        if (student.attendance_id) {
          await attendanceApi.edit(student.attendance_id, student.status);
        }
      }

      // Submit/finalize the session
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
