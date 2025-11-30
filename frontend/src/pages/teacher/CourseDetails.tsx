import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Play, Eye, Trash2, Users, Calendar } from "lucide-react";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { useToast } from "@/hooks/use-toast";
import { sessionsApi } from "@/lib/api";

interface Session {
  id: string;
  date: string;
  attendance: string;
}

export default function CourseDetails() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [courseName, setCourseName] = useState("Computer Science 101");
  const [studentCount, setStudentCount] = useState(45);
  const [sessionCount, setSessionCount] = useState(12);
  const [sessions, setSessions] = useState<Session[]>([
    { id: "1", date: "2024-03-20 09:00 AM", attendance: "42/45" },
    { id: "2", date: "2024-03-19 11:00 AM", attendance: "40/45" },
    { id: "3", date: "2024-03-18 02:00 PM", attendance: "43/45" },
  ]);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleStartNewSession = () => {
    navigate(`/teacher/camera?course_id=${courseId}`);
  };

  const handleViewSession = (sessionId: string) => {
    navigate(`/teacher/session/${sessionId}`);
  };

  const handleDeleteSession = async () => {
    if (!selectedSessionId) return;
    
    try {
      await sessionsApi.deleteSession(selectedSessionId);
      setSessions(sessions.filter(s => s.id !== selectedSessionId));
      
      toast({
        title: "Session Deleted",
        description: "The session has been removed successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteModal(false);
      setSelectedSessionId(null);
    }
  };

  const columns: Column<Session>[] = [
    { header: "Session ID", accessor: "id" },
    { header: "Date", accessor: "date" },
    { header: "Attendance", accessor: "attendance" },
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
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="content-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">{courseName}</h1>
          <p className="text-muted-foreground">Course Details & Sessions</p>
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
              <p className="text-2xl font-bold">{sessionCount}</p>
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
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteSession}
        variant="destructive"
      />
    </div>
  );
}
