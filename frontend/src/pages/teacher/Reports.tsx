import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Users, TrendingUp } from "lucide-react";
import { coursesApi, attendanceApi } from "@/lib/api";
import { Progress } from "@/components/ui/progress";

interface Student {
  id: string;
  name: string;
  student_id: string;
  group: string;
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
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [attendanceDetails, setAttendanceDetails] = useState<AttendanceDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const mockCourses = [
    { id: "1", name: "Computer Science 101", code: "CS101" },
    { id: "2", name: "Mathematics 201", code: "MATH201" },
    { id: "3", name: "Physics 101", code: "PHY101" },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim() || !selectedCourseId) return;
    
    setLoading(true);
    try {
      const results = await coursesApi.getCourseStudents(selectedCourseId, searchQuery);
      setStudents(results || []);
    } catch (error) {
      console.error("Error searching students:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttendance = async (student: Student) => {
    if (!selectedCourseId) return;
    
    setSelectedStudent(student);
    setLoading(true);
    
    try {
      const sessionsData = await coursesApi.getCourseSessionsCount(selectedCourseId);
      const totalSessions = sessionsData.count || 0;
      
      const attendanceData = await attendanceApi.getStudentCourseAttendance(
        student.id,
        selectedCourseId
      );
      const presentCount = attendanceData.present_count || 0;
      
      const percentage = totalSessions > 0 
        ? Math.round((presentCount / totalSessions) * 100) 
        : 0;
      
      setAttendanceDetails({
        totalSessions,
        presentCount,
        percentage,
        sessions: attendanceData.sessions || [],
      });
    } catch (error) {
      console.error("Error fetching attendance details:", error);
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
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {mockCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
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
                disabled={!selectedCourseId}
              />
              <Button onClick={handleSearch} disabled={loading || !selectedCourseId}>
                <Search className="w-4 h-4" />
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
                      <Badge variant="outline">{student.group}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ID: {student.student_id}
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
              <p className="text-muted-foreground">
                Select a course, search and select a student to view their attendance report
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card className="p-6 rounded-xl shadow-md">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold mb-1">{selectedStudent.name}</h2>
                    <p className="text-muted-foreground">ID: {selectedStudent.student_id}</p>
                    <Badge variant="outline" className="mt-2">{selectedStudent.group}</Badge>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
