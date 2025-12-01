import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Users, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { attendanceApi, coursesApi, sessionsApi, handleApiError } from "@/lib/api";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  email: string;
  status: "present" | "absent";
  marked_at?: string;
}

interface SessionInfo {
  id: number;
  started_at: string;
  status: string;
  course_id: number;
  course_name?: string;
}

export default function SessionDetails() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session data on mount
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

      // First get the session data
      const sessionData = await sessionsApi.get(sessionIdNum);

      // Then get attendance records for this session
      let attendanceData: any[] = [];
      try {
        attendanceData = await attendanceApi.getSessionAttendance(sessionIdNum);
      } catch (attendanceErr) {
        // If no attendance data, that's okay - session might be new
        console.log("No attendance data yet for this session");
      }

      // Get course information
      let courseName = "Unknown Course";
      try {
        const courseData = await coursesApi.get(sessionData.course_id);
        courseName = courseData.name;
      } catch (courseErr) {
        console.log("Could not fetch course data");
      }

      const sessionInfo: SessionInfo = {
        id: sessionIdNum,
        started_at: sessionData.started_at,
        status: sessionData.status,
        course_id: sessionData.course_id,
        course_name: courseName
      };

      // Transform attendance data
      const studentsData: Student[] = attendanceData.map(attendance => ({
        id: attendance.student_id,
        name: attendance.student_name || `Student ${attendance.student_id}`,
        email: attendance.student_email || "",
        status: attendance.status,
        marked_at: attendance.timestamp
      }));

      setSession(sessionInfo);
      setStudents(studentsData);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const presentCount = students.filter(s => s.status === "present").length;
  const totalCount = students.length;

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading session details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-4">{error || "Session not found"}</p>
            <Button onClick={loadSessionData} variant="outline">
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
        <h1 className="text-3xl font-bold mb-2">Session Details</h1>
        <p className="text-muted-foreground">View attendance for this session</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Course</p>
              <p className="font-semibold">{session.course_name || "Course"}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date & Time</p>
              <p className="font-semibold">
                {new Date(session.started_at).toLocaleDateString()} - {new Date(session.started_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Attendance</p>
              <p className="font-semibold text-xl">
                {presentCount} / {totalCount}
              </p>
              <p className="text-sm text-muted-foreground">
                {totalCount > 0 ? ((presentCount / totalCount) * 100).toFixed(1) : 0}% attendance rate
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">Student List</h2>
        {students.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No attendance records found for this session.
          </p>
        ) : (
          <div className="space-y-3">
            {students.map((student) => (
              <div
                key={student.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-muted"
              >
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
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
