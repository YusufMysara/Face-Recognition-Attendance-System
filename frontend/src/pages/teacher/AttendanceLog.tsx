import { useState } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Trash2 } from "lucide-react";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { sessionsApi } from "@/lib/api";

interface Session {
  id: string;
  course: string;
  date: string;
  attendance: string;
}

export default function AttendanceLog() {
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [sessions, setSessions] = useState<Session[]>([
    { id: "1", course: "Computer Science 101", date: "2024-03-20 09:00 AM", attendance: "42/45" },
    { id: "2", course: "Mathematics 201", date: "2024-03-19 11:00 AM", attendance: "35/38" },
    { id: "3", course: "Physics 101", date: "2024-03-18 02:00 PM", attendance: "48/52" },
    { id: "4", course: "Computer Science 101", date: "2024-03-17 09:00 AM", attendance: "40/45" },
  ]);
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

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
    { header: "Course Name", accessor: "course" },
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Attendance Log</h1>
        <p className="text-muted-foreground">View all attendance sessions across all courses</p>
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
