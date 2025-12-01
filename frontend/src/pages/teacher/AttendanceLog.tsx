import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, Loader2, Download } from "lucide-react";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { coursesApi, sessionsApi, attendanceApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Session {
  id: number;
  course_name: string;
  started_at: string;
  status: string;
  attendance_count?: number;
  total_students?: number;
}

export default function AttendanceLog() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  // Load sessions on mount
  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Get all courses taught by this teacher
      const coursesData = await coursesApi.list();
      const teacherCourses = coursesData.filter(course => course.teacher_id === user.id);

      // Get all sessions for these courses and enrich with attendance data
      const allSessions: Session[] = [];

      for (const course of teacherCourses) {
        const courseSessions = await coursesApi.getCourseSessions(course.id);

        for (const session of courseSessions) {
          try {
            const attendanceData = await attendanceApi.getSessionAttendance(session.id);
            const presentCount = attendanceData.filter(record => record.status === "present").length;

            allSessions.push({
              id: session.id,
              course_name: course.name,
              started_at: session.started_at,
              status: session.status,
              attendance_count: presentCount,
              total_students: attendanceData.length
            });
          } catch (err) {
            // If no attendance data, still show the session
            allSessions.push({
              id: session.id,
              course_name: course.name,
              started_at: session.started_at,
              status: session.status,
              attendance_count: 0,
              total_students: 0
            });
          }
        }
      }

      // Sort by date (most recent first)
      allSessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

      setSessions(allSessions);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleViewSession = (sessionId: number) => {
    navigate(`/teacher/session/${sessionId}`);
  };

  const handleDeleteSession = async () => {
    if (!selectedSessionId) return;

    try {
      setDeletingSession(true);
      await sessionsApi.delete(selectedSessionId);
      setSessions(sessions.filter(s => s.id !== selectedSessionId));
      toast.success("Session deleted successfully");
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setDeletingSession(false);
      setShowDeleteModal(false);
      setSelectedSessionId(null);
    }
  };

  const columns: Column<Session>[] = [
    {
      header: "Session ID",
      accessor: (row) => `Session ${row.id}`
    },
    { header: "Course Name", accessor: "course_name" },
    {
      header: "Date",
      accessor: (row) => new Date(row.started_at).toLocaleDateString()
    },
    {
      header: "Time",
      accessor: (row) => new Date(row.started_at).toLocaleTimeString()
    },
    {
      header: "Status",
      accessor: (row) => (
        <Badge variant={row.status === "open" ? "default" : "secondary"}>
          {row.status}
        </Badge>
      ),
    },
    {
      header: "Attendance",
      accessor: (row) =>
        row.total_students ?
          `${row.attendance_count || 0}/${row.total_students}` :
          "No data"
    },
    {
      header: "Actions",
      accessor: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            title="View"
            onClick={() => handleViewSession(row.id)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Delete"
            onClick={() => {
              setSelectedSessionId(row.id);
              setShowDeleteModal(true);
            }}
            disabled={row.status === "open"}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading attendance sessions...</p>
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
            <Button onClick={loadSessions} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Attendance Log</h1>
          <p className="text-muted-foreground">View all attendance sessions across all courses</p>
        </div>
        <Button className="rounded-xl" disabled>
          <Download className="w-4 h-4 mr-2" />
          Export Records (Coming Soon)
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No attendance sessions found</p>
        </div>
      ) : (
        <DataTable
          data={sessions}
          columns={columns}
          searchPlaceholder="Search sessions..."
        />
      )}

      <ConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Delete Session"
        description="Are you sure you want to delete this session? This action cannot be undone."
        confirmText={deletingSession ? "Deleting..." : "Delete"}
        onConfirm={handleDeleteSession}
        variant="destructive"
      />
    </div>
  );
}
