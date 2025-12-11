import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Users, CheckCircle2, XCircle, Loader2, RotateCcw, Play, Filter } from "lucide-react";
import { attendanceApi, coursesApi, sessionsApi, handleApiError } from "@/lib/api";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  email: string;
  status: "present" | "absent";
  attendance_id?: number;
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
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

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

      // Get course information and enrolled students
      const courseData = await coursesApi.get(sessionData.course_id);
      const enrolledStudents = await coursesApi.getCourseStudents(sessionData.course_id);

      // Get existing attendance records for this session
      let attendanceData: any[] = [];
      try {
        attendanceData = await attendanceApi.getSessionAttendance(sessionIdNum);
      } catch (attendanceErr) {
        // If no attendance data, that's okay - session might be new
        console.log("No attendance data yet for this session");
      }

      const sessionInfo: SessionInfo = {
        id: sessionIdNum,
        started_at: sessionData.started_at,
        status: sessionData.status,
        course_id: sessionData.course_id,
        course_name: courseData.name
      };

      // Create a map of attendance records by student_id for quick lookup
      const attendanceMap = new Map();
      attendanceData.forEach(attendance => {
        attendanceMap.set(attendance.student_id, attendance);
      });

      // Transform data to show all enrolled students with their attendance status
      const studentsData: Student[] = enrolledStudents.map(student => {
        const attendanceRecord = attendanceMap.get(student.id);
        return {
          id: student.id,
          name: student.name,
          email: student.email,
          group: student.group,
          attendance_id: attendanceRecord?.id,
          status: attendanceRecord ? attendanceRecord.status : "absent",
          marked_at: attendanceRecord?.timestamp
        };
      });

      setSession(sessionInfo);
      setStudents(studentsData);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Get unique groups for filter
  const availableGroups = Array.from(new Set(students.map(s => s.group).filter(Boolean)));

  // Filter students by selected group
  const filteredStudents = selectedGroup === "all"
    ? students
    : students.filter(s => s.group === selectedGroup);

  // Calculate stats based on filtered students
  const presentCount = filteredStudents.filter(s => s.status === "present").length;
  const totalCount = filteredStudents.length;

  const handleContinue = async () => {
    if (!sessionId) return;

    try {
      setSubmitting(true);
      const sessionIdNum = parseInt(sessionId);

      // Continue the session (reopen it)
      await sessionsApi.continue(sessionIdNum);

      toast.success("Session continued successfully");
      // Navigate to live camera to continue taking attendance
      navigate(`/teacher/camera?session_id=${sessionIdNum}`);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = async () => {
    if (!sessionId) return;

    try {
      setSubmitting(true);
      const sessionIdNum = parseInt(sessionId);

      // Navigate to live camera with session_id to retake
      navigate(`/teacher/camera?session_id=${sessionIdNum}`);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setSubmitting(false);
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

  const handleSubmit = async () => {
    if (!sessionId) return;

    try {
      setSubmitting(true);
      const sessionIdNum = parseInt(sessionId);

      // Submit/finalize the session
      await sessionsApi.submit(sessionIdNum);

      toast.success("Session submitted successfully");
      // Reload the session data to show updated status
      loadSessionData();
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

      {session.status !== "submitted" && (
        <Card className="p-6 rounded-xl shadow-md mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">Session Actions</h2>
              <p className="text-muted-foreground">
                Manage this session - retake attendance or submit final results
              </p>
            </div>
            <div className="flex gap-3">
              {session.status === "closed" && (
                <Button
                  variant="outline"
                  onClick={handleContinue}
                  disabled={submitting}
                >
                  Continue
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleRetake}
                disabled={submitting}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Session"
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6 rounded-xl shadow-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Student List</h2>
          <div className="flex items-center gap-3">
            {availableGroups.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="px-3 py-1 border border-input rounded-md bg-background text-sm"
                >
                  <option value="all">All Groups</option>
                  {availableGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              </div>
            )}
            {session.status !== "submitted" && (
              <p className="text-sm text-muted-foreground">
                Click on students to change their attendance status
              </p>
            )}
          </div>
        </div>
        {students.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No students enrolled in this course.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                  session.status !== "submitted"
                    ? "bg-muted hover:bg-muted/80 cursor-pointer"
                    : "bg-muted"
                }`}
                onClick={() => session.status !== "submitted" && toggleAttendance(student.id)}
              >
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {student.name.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.group || "No Group"}</p>
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
