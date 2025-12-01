import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, TrendingUp, Loader2 } from "lucide-react";
import { coursesApi, attendanceApi, handleApiError } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

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

interface AttendanceDetail {
  totalSessions: number;
  presentCount: number;
  percentage: number;
  sessions: {
    date: string;
    status: string;
  }[];
}

export default function Reports() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [attendanceDetails, setAttendanceDetails] = useState<AttendanceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Load courses on mount
  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setCoursesLoading(true);
      const coursesData = await coursesApi.list();
      setCourses(coursesData);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setCoursesLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedCourseId) return;

    setSearching(true);
    try {
      // For now, we'll need to get all students and filter them
      // In a real implementation, you'd want a search endpoint
      // Since we don't have direct access to students enrolled in courses,
      // we'll show a message that this feature needs backend support

      toast.error("Student search feature requires additional backend endpoints. Please implement course enrollment queries.");
      setStudents([]);

    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setSearching(false);
    }
  };

  const handleViewAttendance = async (student: Student) => {
    if (!selectedCourseId) return;

    setSelectedStudent(student);
    setLoading(true);

    try {
      const courseIdNum = parseInt(selectedCourseId);

      // Get course sessions to calculate total sessions
      const sessionsData = await coursesApi.getCourseSessions(courseIdNum);
      const totalSessions = sessionsData.length;

      // Get student attendance for this course
      // This endpoint might not exist, so we'll try a different approach
      try {
        // For now, we'll use the general student attendance endpoint
        const attendanceData = await attendanceApi.getStudentAttendance(student.id);

        // Filter attendance records for this course
        const courseAttendance = attendanceData.filter(record =>
          record.course_id === courseIdNum
        );

        const presentCount = courseAttendance.filter(record =>
          record.status === "present"
        ).length;

        const percentage = totalSessions > 0
          ? Math.round((presentCount / totalSessions) * 100)
          : 0;

        // Transform sessions data
        const sessions = sessionsData.map(session => {
          const attendanceRecord = courseAttendance.find(att =>
            att.session_id === session.id
          );

          return {
            date: new Date(session.started_at).toLocaleDateString(),
            status: attendanceRecord?.status === "present" ? "Present" : "Absent"
          };
        });

        setAttendanceDetails({
          totalSessions,
          presentCount,
          percentage,
          sessions,
        });
      } catch (attendanceErr) {
        // If we can't get attendance data, show placeholder
        setAttendanceDetails({
          totalSessions,
          presentCount: 0,
          percentage: 0,
          sessions: [],
        });
        toast.warning("Unable to load detailed attendance data");
      }
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Reports</h1>
        <p className="text-muted-foreground">
          Search for students and view their attendance reports
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="p-6 rounded-xl shadow-md">
            <h2 className="text-xl font-semibold mb-4">Search Students</h2>

            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Select Course</label>
              <Select
                value={selectedCourseId}
                onValueChange={setSelectedCourseId}
                disabled={coursesLoading}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={coursesLoading ? "Loading courses..." : "Choose a course"} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={String(course.id)}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Enter student name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                disabled={!selectedCourseId || searching}
              />
              <Button onClick={handleSearch} disabled={searching || !selectedCourseId}>
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="space-y-2">
              {students.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {searchQuery ? "No students found" : "Select course and search"}
                </p>
              ) : (
                students.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 rounded-lg bg-muted hover:bg-muted/70 cursor-pointer"
                    onClick={() => handleViewAttendance(student)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{student.name}</span>
                      <Badge variant="outline">{student.group || 'N/A'}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {student.email}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {!selectedStudent ? (
            <Card className="p-8 rounded-xl shadow-md text-center">
              <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Student Selected</h3>
              <p className="text-muted-foreground mb-4">
                Select a course, search and select a student to view their attendance report
              </p>
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Student search functionality requires additional backend endpoints for course enrollment queries. Currently showing placeholder implementation.
                </p>
              </div>
            </Card>
          ) : loading ? (
            <Card className="p-8 rounded-xl shadow-md text-center">
              <Loader2 className="w-16 h-16 text-muted-foreground mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-semibold mb-2">Loading Attendance Data</h3>
              <p className="text-muted-foreground">
                Fetching attendance records for {selectedStudent.name}...
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="p-6 rounded-xl shadow-md">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{selectedStudent.name}</h2>
                    <p className="text-muted-foreground">{selectedStudent.email}</p>
                    <Badge variant="outline" className="mt-2">{selectedStudent.group || 'N/A'}</Badge>
                  </div>
                  {attendanceDetails && (
                    <div className="text-right">
                      <div className="text-4xl font-bold text-primary">
                        {attendanceDetails.percentage}%
                      </div>
                      <p className="text-sm text-muted-foreground">Attendance Rate</p>
                    </div>
                  )}
                </div>

                {attendanceDetails && (
                  <>
                    <Progress value={attendanceDetails.percentage} className="mb-4" />

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 rounded-lg bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="w-4 h-4 text-success" />
                          <span className="text-sm text-muted-foreground">Present</span>
                        </div>
                        <p className="text-2xl font-bold">{attendanceDetails.presentCount}</p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="text-sm text-muted-foreground">Total Sessions</span>
                        </div>
                        <p className="text-2xl font-bold">{attendanceDetails.totalSessions}</p>
                      </div>
                    </div>
                  </>
                )}
              </Card>

              {attendanceDetails && attendanceDetails.sessions.length > 0 && (
                <Card className="p-6 rounded-xl shadow-md">
                  <h3 className="text-xl font-semibold mb-4">Session-by-Session Attendance</h3>
                  <div className="space-y-2">
                    {attendanceDetails.sessions.map((session, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted"
                      >
                        <span className="text-sm">{session.date}</span>
                        <Badge
                          variant={session.status === "Present" ? "default" : "destructive"}
                        >
                          {session.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {attendanceDetails && attendanceDetails.sessions.length === 0 && (
                <Card className="p-6 rounded-xl shadow-md">
                  <p className="text-center text-muted-foreground py-8">
                    No attendance sessions found for this course.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
