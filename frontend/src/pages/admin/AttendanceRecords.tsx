import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { attendanceApi, handleApiError } from "@/lib/api";
import { toast } from "sonner";

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name?: string;
  session_id: number;
  status: "present" | "absent";
  timestamp: string;
  course_name?: string;
}

export default function AttendanceRecords() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load attendance records on mount
  useEffect(() => {
    loadAttendanceRecords();
  }, []);

  const loadAttendanceRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await attendanceApi.getAll();
      setRecords(data);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const columns: Column<AttendanceRecord>[] = [
    {
      header: "Student",
      accessor: (row) => row.student_name || `Student ${row.student_id}`
    },
    {
      header: "Course",
      accessor: (row) => row.course_name || `Course ${row.session_id}`
    },
    {
      header: "Date",
      accessor: (row) => row.timestamp ? new Date(row.timestamp).toLocaleDateString() : "N/A"
    },
    {
      header: "Time",
      accessor: (row) => row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : "N/A"
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
            <p className="text-muted-foreground">Loading attendance records...</p>
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
            <Button onClick={loadAttendanceRecords} variant="outline">
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
          <h1 className="text-3xl font-bold mb-2">Attendance Records</h1>
          <p className="text-muted-foreground">View all attendance records across all courses</p>
        </div>
        <Button className="rounded-xl" disabled>
          <Download className="w-4 h-4 mr-2" />
          Export Records (Coming Soon)
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No attendance records found</p>
        </div>
      ) : (
        <DataTable data={records} columns={columns} searchPlaceholder="Search records..." />
      )}
    </div>
  );
}
