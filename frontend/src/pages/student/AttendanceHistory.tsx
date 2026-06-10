import { useState, useEffect, useMemo } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { attendanceApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

interface AttendanceRecord {
  id: number;
  session_id: number;
  course_id: number;
  status: "present" | "absent";
  timestamp: string;
  course_name?: string;
  session_name?: string;
}

export default function AttendanceHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (user) loadAttendanceHistory();
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

  const courses = useMemo(() => {
    const unique = new Set(records.map((r) => r.course_name).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      const matchCourse = courseFilter === "all" || r.course_name === courseFilter;
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchCourse && matchStatus;
    });
  }, [records, courseFilter, statusFilter]);

  const columns: Column<AttendanceRecord>[] = [
    {
      header: "Course",
      accessor: (row) => row.course_name || `Course ${row.course_id}`,
    },
    {
      header: "Session",
      accessor: (row) => row.session_name || "—",
    },
    {
      header: "Date",
      accessor: (row) =>
        new Date(row.timestamp).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
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
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="Search by course..."
          searchValue={(row) => row.course_name || ""}
          filterComponent={
            <div className="flex gap-2">
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      )}
    </div>
  );
}
