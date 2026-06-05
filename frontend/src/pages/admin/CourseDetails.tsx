import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/DataTable";
import { ArrowLeft, Plus, Trash2, Loader2, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AddStudentsModal } from "@/components/modals/AddStudentsModal";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { coursesApi, usersApi, handleApiError } from "@/lib/api";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  email: string;
  group?: string;
}

interface Course {
  id: number;
  name: string;
  description: string;
  teacher_id?: number;
  teacher_name?: string;
}

export default function CourseDetails() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState<Course | null>(null);
  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);
  const [assigningStudents, setAssigningStudents] = useState(false);
  const [enrollByGroupOpen, setEnrollByGroupOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [enrollingGroup, setEnrollingGroup] = useState(false);

  // Load course and student data on mount
  useEffect(() => {
    if (courseId) {
      loadCourseData();
    }
  }, [courseId]);

  const loadCourseData = async () => {
    if (!courseId) return;

    try {
      setLoading(true);
      setError(null);

      const courseIdNum = parseInt(courseId);

      // Load course, enrolled students, and all students in parallel
      const [courseData, enrolledData, allStudentsData] = await Promise.all([
        coursesApi.get(courseIdNum),
        coursesApi.getCourseStudents(courseIdNum),
        usersApi.list()
      ]);

      // Get teacher name if teacher_id exists
      let teacherName = undefined;
      if (courseData.teacher_id) {
        const teacher = allStudentsData.find(user => user.id === courseData.teacher_id);
        teacherName = teacher?.name;
      }

      setCourse({
        ...courseData,
        teacher_name: teacherName
      });

      setEnrolledStudents(enrolledData);

      // Filter available students (students not enrolled in this course)
      const enrolledIds = new Set(enrolledData.map(s => s.id));
      const available = allStudentsData
        .filter(user => user.role === "student" && !enrolledIds.has(user.id))
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          group: user.group
        }));

      setAvailableStudents(available);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveClick = (student: Student) => {
    setStudentToRemove(student);
    setRemoveModalOpen(true);
  };

  const handleRemoveConfirm = async () => {
    if (!studentToRemove || !courseId) return;

    try {
      await coursesApi.removeStudent(parseInt(courseId), studentToRemove.id);
      toast.success("Student removed from course successfully");

      // Refresh the data
      await loadCourseData();

      setRemoveModalOpen(false);
      setStudentToRemove(null);
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  const handleAddStudents = async (studentIds: string[]) => {
    if (!courseId) return;
    try {
      setAssigningStudents(true);
      const courseIdNum = parseInt(courseId);
      await Promise.all(studentIds.map(id => coursesApi.assignStudent(courseIdNum, parseInt(id))));
      toast.success(`${studentIds.length} student(s) added to course`);
      await loadCourseData();
      setAddStudentsOpen(false);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setAssigningStudents(false);
    }
  };

  const availableGroups = Array.from(
    new Set(availableStudents.map(s => s.group).filter(Boolean) as string[])
  ).sort();

  const handleEnrollByGroup = async () => {
    if (!courseId || !selectedGroup) return;
    const groupStudents = availableStudents.filter(s => s.group === selectedGroup);
    if (groupStudents.length === 0) {
      toast.info("All students from this group are already enrolled");
      setEnrollByGroupOpen(false);
      return;
    }
    try {
      setEnrollingGroup(true);
      const courseIdNum = parseInt(courseId);
      await Promise.all(groupStudents.map(s => coursesApi.assignStudent(courseIdNum, s.id)));
      toast.success(`${groupStudents.length} student(s) from ${selectedGroup} enrolled`);
      setEnrollByGroupOpen(false);
      setSelectedGroup("");
      await loadCourseData();
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setEnrollingGroup(false);
    }
  };

  const columns: Column<Student>[] = [
    { header: "Name", accessor: "name" },
    { header: "Email", accessor: "email" },
    { header: "Group", accessor: (row) => row.group || "N/A" },
    {
      header: "Actions",
      accessor: (row) => (
        <Button size="sm" variant="ghost" onClick={() => handleRemoveClick(row)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading course details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-4">{error || "Course not found"}</p>
            <Button onClick={loadCourseData} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <Button
        variant="ghost"
        onClick={() => navigate("/admin/courses")}
        className="mb-4 rounded-lg"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Courses
      </Button>

      <Card className="p-6 rounded-xl shadow-md mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{course.name}</h1>
            <p className="text-muted-foreground mb-4">{course.description}</p>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Teacher:</span>
                <span className="ml-2 font-medium">{course.teacher_name || "Not assigned"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Students:</span>
                <span className="ml-2 font-medium">{enrolledStudents.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sessions:</span>
                <span className="ml-2 font-medium">0</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Enrolled Students</h2>
        <div className="flex gap-2">
          {availableGroups.length > 0 && (
            <Button
              variant="outline"
              onClick={() => { setSelectedGroup(""); setEnrollByGroupOpen(true); }}
              className="rounded-xl"
              disabled={assigningStudents || enrollingGroup}
            >
              <Users className="w-4 h-4 mr-2" />
              Enroll by Group
            </Button>
          )}
          <Button
            onClick={() => setAddStudentsOpen(true)}
            className="rounded-xl"
            disabled={assigningStudents || enrollingGroup}
          >
            {assigningStudents ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add Students
              </>
            )}
          </Button>
        </div>
      </div>

      {enrolledStudents.length === 0 ? (
        <Card className="p-8 rounded-xl shadow-md text-center">
          <p className="text-muted-foreground">No students enrolled in this course yet.</p>
        </Card>
      ) : (
        <DataTable
          data={enrolledStudents}
          columns={columns}
          searchPlaceholder="Search students..."
        />
      )}

      <Dialog open={enrollByGroupOpen} onOpenChange={setEnrollByGroupOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Enroll by Group</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              All unenrolled students from the selected group will be added to this course.
            </p>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {availableGroups.map(g => {
                  const count = availableStudents.filter(s => s.group === g).length;
                  return (
                    <SelectItem key={g} value={g}>
                      {g} — {count} unenrolled student{count !== 1 ? "s" : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnrollByGroupOpen(false)} disabled={enrollingGroup}>
              Cancel
            </Button>
            <Button onClick={handleEnrollByGroup} disabled={!selectedGroup || enrollingGroup}>
              {enrollingGroup ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enrolling...</> : "Enroll Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddStudentsModal
        open={addStudentsOpen}
        onOpenChange={setAddStudentsOpen}
        availableStudents={availableStudents.map(s => ({ id: String(s.id), name: s.name, email: s.email, group: s.group || "N/A" }))}
        onSubmit={handleAddStudents}
        loading={assigningStudents}
      />

      <ConfirmationModal
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        title="Remove Student"
        description="Are you sure you want to remove this student from the course?"
        confirmText="Remove"
        onConfirm={handleRemoveConfirm}
        variant="destructive"
      />
    </div>
  );
}
