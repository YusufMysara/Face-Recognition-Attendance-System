import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { attendanceApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface AttendanceRecord {
  id: number;
  session_id: number;
  course_id: number;
  status: "present" | "absent";
  marked_at: string;
  course_name?: string;
}

export default function AttendanceHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load attendance history on mount
  useEffect(() => {
    if (user) {
      loadAttendanceHistory();
    }
  }, [user]);

  const loadAttendanceHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const data = await attendanceApi.getStudentAttendance(user.id);
      setRecords(data.history);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<AttendanceRecord>[] = [
    {
      header: "Course",
      accessor: (row) => row.course_name || `Course ${row.course_id}`
    },
    {
      header: "Date",
      accessor: (row) => new Date(row.marked_at).toLocaleDateString()
    },
    {
      header: "Time",
      accessor: (row) => new Date(row.marked_at).toLocaleTimeString()
    },
    {
      header: "Status",
      accessor: (row) => (
        <Badge variant={row.status === "present" ? "default" : "destructive"}>
          {row.status === "present" ? "Present" : "Absent"}
        </Badge>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading attendance history...</p>
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
            <Button onClick={loadAttendanceHistory} variant="outline">
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
        <h1 className="text-3xl font-bold mb-2">Attendance History</h1>
        <p className="text-muted-foreground">Complete record of your attendance</p>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No attendance records found</p>
        </div>
      ) : (
        <DataTable data={records} columns={columns} searchPlaceholder="Search history..." />
      )}
    </div>
  );
}
