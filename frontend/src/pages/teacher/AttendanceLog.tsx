import { useState, useEffect, useMemo } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatsCard } from "@/components/shared/StatsCard";
import { GraduationCap, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { coursesApi, attendanceApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Course {
  id: number;
  name: string;
  teacher_id: number;
}

interface RawRecord {
  student_id: number;
  student_name?: string;
  status: "present" | "absent";
}

interface StudentSummary {
  student_id: number;
  student_name: string;
  present: number;
  total: number;
  percentage: number;
}

function statusBadge(pct: number) {
  if (pct >= 75) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Good</Badge>;
  if (pct >= 50) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">At Risk</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Critical</Badge>;
}

function buildSummaries(records: RawRecord[]): StudentSummary[] {
  const map = new Map<number, { name: string; present: number; total: number }>();
  for (const r of records) {
    if (!map.has(r.student_id)) {
      map.set(r.student_id, { name: r.student_name || `Student ${r.student_id}`, present: 0, total: 0 });
    }
    const entry = map.get(r.student_id)!;
    entry.total += 1;
    if (r.status === "present") entry.present += 1;
  }
  return Array.from(map.entries())
    .map(([student_id, { name, present, total }]) => ({
      student_id,
      student_name: name,
      present,
      total,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    }))
    .sort((a, b) => a.percentage - b.percentage);
}

async function fetchRecordsForCourse(courseId: number): Promise<RawRecord[]> {
  const sessions = await coursesApi.getCourseSessions(courseId);
  const recordsPerSession = await Promise.all(
    sessions.map((s: { id: number }) =>
      attendanceApi.getSessionAttendance(s.id).catch(() => [])
    )
  );
  return recordsPerSession.flat() as RawRecord[];
}

export default function AttendanceLog() {
  const { user } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [rawRecords, setRawRecords] = useState<RawRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadInitial();
  }, [user]);

  const loadInitial = async () => {
    try {
      setLoading(true);
      setError(null);
      const allCourses = await coursesApi.list();
      const teacherCourses = (allCourses as Course[]).filter((c) => c.teacher_id === user!.id);
      setCourses(teacherCourses);
      if (teacherCourses.length > 0) {
        const firstId = teacherCourses[0].id;
        setSelectedCourseId(firstId);
        const records = await fetchRecordsForCourse(firstId);
        setRawRecords(records);
      }
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCourseChange = async (courseId: number) => {
    try {
      setSelectedCourseId(courseId);
      setLoading(true);
      setError(null);
      const records = await fetchRecordsForCourse(courseId);
      setRawRecords(records);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const summaries = useMemo(() => buildSummaries(rawRecords), [rawRecords]);

  const avgPct = summaries.length
    ? Math.round(summaries.reduce((acc, s) => acc + s.percentage, 0) / summaries.length)
    : 0;

  const columns: Column<StudentSummary>[] = [
    { header: "Student Name", accessor: "student_name" },
    { header: "Sessions Attended", accessor: (row) => `${row.present} / ${row.total}` },
    { header: "Attendance %", accessor: (row) => `${row.percentage}%` },
    { header: "Status", accessor: (row) => statusBadge(row.percentage) },
  ];

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
            <Button onClick={loadInitial} variant="outline">Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="content-container">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Attendance Log</h1>
          <p className="text-muted-foreground">Student attendance overview for your courses</p>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground">You have no courses assigned</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Attendance Log</h1>
          <p className="text-muted-foreground">Student attendance overview for your courses</p>
        </div>
        <Select
          value={selectedCourseId?.toString()}
          onValueChange={(v) => handleCourseChange(Number(v))}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select course" />
          </SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <StatsCard title="Students Tracked" value={summaries.length.toString()} icon={GraduationCap} />
        <StatsCard title="Average Attendance" value={`${avgPct}%`} icon={TrendingUp} />
      </div>

      {summaries.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No attendance records for this course yet</p>
        </div>
      ) : (
        <DataTable
          data={summaries}
          columns={columns}
          searchPlaceholder="Search by student name..."
          searchValue={(row) => row.student_name}
        />
      )}
    </div>
  );
}
