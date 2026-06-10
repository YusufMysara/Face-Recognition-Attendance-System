import { useState, useEffect, useMemo } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { attendanceApi, usersApi, coursesApi, handleApiError } from "@/lib/api";
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
  course_name: string;
  present: number;
  total: number;
  percentage: number;
}

function statusBadge(pct: number) {
  if (pct >= 75) return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Good</Badge>;
  return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Critical</Badge>;
}

function buildSummaries(records: AttendanceRecord[], userMap: Map<number, User>): StudentSummary[] {
  const map = new Map<string, { student_id: number; name: string; course_name: string; present: number; total: number }>();
  for (const r of records) {
    const key = `${r.student_id}__${r.course_name ?? ""}`;
    if (!map.has(key)) {
      map.set(key, { student_id: r.student_id, name: r.student_name || `Student ${r.student_id}`, course_name: r.course_name ?? "—", present: 0, total: 0 });
    }
    const entry = map.get(key)!;
    entry.total += 1;
    if (r.status === "present") entry.present += 1;
  }
  return Array.from(map.values())
    .map(({ student_id, name, course_name, present, total }) => ({
      student_id,
      student_name: name,
      group: userMap.get(student_id)?.group || "—",
      course_name,
      present,
      total,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    }))
    .sort((a, b) => a.percentage - b.percentage);
}

export default function AttendanceRecords() {
  const [rawRecords, setRawRecords] = useState<AttendanceRecord[]>([]);
  const [userMap, setUserMap] = useState<Map<number, User>>(new Map());
  const [courseYearMap, setCourseYearMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state — applied top-down: year → course → group → status
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const years = [1, 2, 3, 4];

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [records, users, allCourses] = await Promise.all([
        attendanceApi.getAll(),
        usersApi.list(),
        coursesApi.list(),
      ]);

      const map = new Map<number, User>();
      for (const u of users as User[]) map.set(u.id, u);

      // Map course name → year so we can filter records by year
      const yearMap = new Map<string, number>();
      for (const c of allCourses as { name: string; year: number }[]) {
        if (c.name && c.year) yearMap.set(c.name, c.year);
      }

      setRawRecords(records as AttendanceRecord[]);
      setUserMap(map);
      setCourseYearMap(yearMap);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  // Step 1 — apply year filter to raw records
  const yearFilteredRecords = useMemo(() => {
    if (yearFilter === "all") return rawRecords;
    return rawRecords.filter(
      (r) => String(courseYearMap.get(r.course_name ?? "")) === yearFilter
    );
  }, [rawRecords, yearFilter, courseYearMap]);

  // Courses available within the year-filtered records (drives the course dropdown)
  const coursesInYear = useMemo(() => {
    const unique = new Set(yearFilteredRecords.map((r) => r.course_name).filter(Boolean) as string[]);
    return Array.from(unique).sort();
  }, [yearFilteredRecords]);

  // Step 2 — apply course filter on top of year-filtered records
  const courseFilteredRecords = useMemo(() => {
    if (courseFilter === "all") return yearFilteredRecords;
    return yearFilteredRecords.filter((r) => r.course_name === courseFilter);
  }, [yearFilteredRecords, courseFilter]);

  // Build per-student summaries from the course-filtered records
  const summaries = useMemo(
    () => buildSummaries(courseFilteredRecords, userMap),
    [courseFilteredRecords, userMap]
  );

  // Groups available within the current summaries (drives the group dropdown)
  const groups = useMemo(() => {
    const unique = new Set(summaries.map((s) => s.group).filter((g) => g !== "—"));
    return Array.from(unique).sort();
  }, [summaries]);

  // Step 3 & 4 — apply group and status filters
  const filtered = useMemo(() => summaries.filter((s) => {
    if (groupFilter !== "all" && s.group !== groupFilter) return false;
    if (statusFilter === "good" && s.percentage < 75) return false;
    if (statusFilter === "critical" && s.percentage >= 75) return false;
    return true;
  }), [summaries, groupFilter, statusFilter]);

  const avgPct = filtered.length
    ? Math.round(filtered.reduce((acc, s) => acc + s.percentage, 0) / filtered.length)
    : 0;

  const handleYearChange = (year: string) => {
    setYearFilter(year);
    setCourseFilter("all");
    setGroupFilter("all");
  };

  const handleCourseChange = (course: string) => {
    setCourseFilter(course);
    setGroupFilter("all");
  };

  const columns: Column<StudentSummary>[] = [
    { header: "Student Name", accessor: "student_name" },
    { header: "Course", accessor: "course_name" },
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
              <Select value={yearFilter} onValueChange={handleYearChange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={courseFilter} onValueChange={handleCourseChange}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {coursesInYear.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="good">Good (≥75%)</SelectItem>
                  <SelectItem value="critical">Critical (&lt;75%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      )}
    </div>
  );
}
