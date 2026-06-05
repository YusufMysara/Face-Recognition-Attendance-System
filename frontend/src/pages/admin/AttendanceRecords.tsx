import { useState, useEffect, useMemo } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { attendanceApi, usersApi, handleApiError } from "@/lib/api";
import { StatsCard } from "@/components/shared/StatsCard";
import { GraduationCap, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface AttendanceRecord {
  student_id: number;
  student_name?: string;
  status: "present" | "absent";
  course_name?: string;
}

interface User {
  id: number;
  name: string;
  role: string;
  group?: string;
}

interface StudentSummary {
  student_id: number;
  student_name: string;
  group: string;
  present: number;
  total: number;
  percentage: number;
}

function statusBadge(pct: number) {
  if (pct >= 75) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Good</Badge>;
  if (pct >= 50) return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">At Risk</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Critical</Badge>;
}

function buildSummaries(records: AttendanceRecord[], userMap: Map<number, User>): StudentSummary[] {
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
      group: userMap.get(student_id)?.group || "—",
      present,
      total,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    }))
    .sort((a, b) => a.percentage - b.percentage);
}

export default function AttendanceRecords() {
  const [rawRecords, setRawRecords] = useState<AttendanceRecord[]>([]);
  const [userMap, setUserMap] = useState<Map<number, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [records, users] = await Promise.all([attendanceApi.getAll(), usersApi.list()]);
      const map = new Map<number, User>();
      for (const u of users as User[]) map.set(u.id, u);
      const recs = records as AttendanceRecord[];
      const firstCourse = [...new Set(recs.map((r) => r.course_name).filter(Boolean) as string[])].sort()[0];
      setRawRecords(recs);
      setUserMap(map);
      if (firstCourse) setCourseFilter(firstCourse);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const courses = useMemo(() => {
    const unique = new Set(rawRecords.map((r) => r.course_name).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [rawRecords]);

  const summaries = useMemo(() => {
    const filtered = courseFilter === "all"
      ? rawRecords
      : rawRecords.filter((r) => r.course_name === courseFilter);
    return buildSummaries(filtered, userMap);
  }, [rawRecords, userMap, courseFilter]);

  const groups = useMemo(() => {
    const unique = new Set(summaries.map((s) => s.group).filter((g) => g !== "—"));
    return Array.from(unique).sort();
  }, [summaries]);

  const filtered = useMemo(
    () => groupFilter === "all" ? summaries : summaries.filter((s) => s.group === groupFilter),
    [summaries, groupFilter]
  );

  const avgPct = filtered.length
    ? Math.round(filtered.reduce((acc, s) => acc + s.percentage, 0) / filtered.length)
    : 0;

  const columns: Column<StudentSummary>[] = [
    { header: "Student Name", accessor: "student_name" },
    { header: "Group", accessor: "group" },
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
            <Button onClick={load} variant="outline">Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Attendance Records</h1>
        <p className="text-muted-foreground">Student attendance overview across all courses</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <StatsCard title="Students Tracked" value={filtered.length.toString()} icon={GraduationCap} />
        <StatsCard title="Average Attendance" value={`${avgPct}%`} icon={TrendingUp} />
      </div>

      {rawRecords.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No attendance records found</p>
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          searchPlaceholder="Search by student name..."
          searchValue={(row) => row.student_name}
          filterComponent={
            <div className="flex gap-2">
              {courses.length > 0 && (
                <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setGroupFilter("all"); }}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All courses" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {groups.length > 0 && (
                <Select value={groupFilter} onValueChange={setGroupFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="All groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All groups</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          }
        />
      )}
    </div>
  );
}
