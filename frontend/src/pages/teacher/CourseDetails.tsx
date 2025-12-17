import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Play, Eye, Trash2, Users, Calendar, Loader2 } from "lucide-react";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";
import { coursesApi, sessionsApi, handleApiError } from "@/lib/api";

interface Session {
  id: number;
  started_at: string;
  status: string;
  attendance_count?: number;
  total_students?: number;
}

interface Course {
  id: number;
  name: string;
  description: string;
  teacher_id?: number;
}

interface Student {
  id: number;
  name: string;
  email: string;
  group?: string;
}

export default function CourseDetails() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [deletingSession, setDeletingSession] = useState(false);

  // Load course and session data on mount
  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  const loadCourseData = async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      setError(null);

      const courseIdNum = parseInt(courseId);
      const [courseData, sessionsData, enrolledData] = await Promise.all([
        coursesApi.get(courseIdNum),
        coursesApi.getCourseSessions(courseIdNum),
        coursesApi.getCourseStudents(courseIdNum)
      ]);

      setCourse(courseData);
      setSessions(sessionsData);
      setEnrolledStudents(enrolledData);
      setStudentCount(enrolledData.length);

    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStartNewSession = () => {
    if (courseId) {
      navigate(`/teacher/camera?course_id=${courseId}`);
    }
  };

  const handleViewSession = (session: Session) => {
    if (session.status === "open") {
      navigate(`/teacher/camera?session_id=${session.id}`);
    } else {
      navigate(`/teacher/session/${session.id}`);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSessionId) return;

    try {
      setDeletingSession(true);
      await sessionsApi.delete(selectedSessionId);
      setSessions(sessions.filter(s => s.id !== selectedSessionId));
      toast.success("Session deleted successfully");
    } catch (error) {
      toast.error(handleApiError(error));
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
    {
      header: "Date",
      accessor: (row) => new Date(row.started_at).toLocaleString()
    },
    {
      header: "Status",
      accessor: (row) => (
        <Badge variant={row.status === "open" ? "default" : "secondary"}>
          {row.status}
        </Badge>
      )
    },
    {
      header: "Actions",
      accessor: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            title="View"
            onClick={() => handleViewSession(row)}
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
            <p className="text-muted-foreground">Loading course details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-4">{error || "Course not found"}</p>
            <Button onClick={loadCourseData} variant="outline">
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
          <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
          <p className="text-muted-foreground">{course.description}</p>
        </div>
        <Button
          className="rounded-xl bg-success hover:bg-success/90"
          onClick={handleStartNewSession}
        >
          <Play className="w-4 h-4 mr-2" />
          Start New Session
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Students</p>
              <p className="text-2xl font-bold">{studentCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Sessions</p>
              <p className="text-2xl font-bold">{sessions.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <DataTable
        data={sessions}
        columns={columns}
        searchPlaceholder="Search sessions..."
      />

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
