import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/components/shared/DataTable";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { AddStudentsModal } from "@/components/modals/AddStudentsModal";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
  email: string;
  group: string;
}

export default function CourseDetails() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  // Mock data - replace with API call
  const course = {
    id: courseId,
    name: "Computer Science 101",
    code: "CS101",
    description: "Introduction to Computer Science",
    teacher: "Dr. Smith",
    studentCount: 3,
    sessionCount: 12,
  };

  const [enrolledStudents, setEnrolledStudents] = useState<Student[]>([
    { id: "1", name: "John Doe", email: "john@example.com", group: "A" },
    { id: "3", name: "Bob Johnson", email: "bob@example.com", group: "B" },
    { id: "5", name: "Alice Williams", email: "alice@example.com", group: "A" },
  ]);

  const [availableStudents] = useState<Student[]>([
    { id: "6", name: "Charlie Brown", email: "charlie@example.com", group: "C" },
    { id: "7", name: "Diana Prince", email: "diana@example.com", group: "A" },
    { id: "8", name: "Eve Davis", email: "eve@example.com", group: "B" },
  ]);

  const [addStudentsOpen, setAddStudentsOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState<Student | null>(null);

  const handleRemoveClick = (student: Student) => {
    setStudentToRemove(student);
    setRemoveModalOpen(true);
  };

  const handleRemoveConfirm = () => {
    if (studentToRemove) {
      setEnrolledStudents(enrolledStudents.filter((s) => s.id !== studentToRemove.id));
      toast.success("Student removed from course");
      setRemoveModalOpen(false);
      setStudentToRemove(null);
    }
  };

  const handleAddStudents = (studentIds: string[]) => {
    const studentsToAdd = availableStudents.filter((s) => studentIds.includes(s.id));
    setEnrolledStudents([...enrolledStudents, ...studentsToAdd]);
    toast.success(`${studentIds.length} student(s) added to course`);
    setAddStudentsOpen(false);
  };

  const columns: Column<Student>[] = [
    { header: "Name", accessor: "name" },
    { header: "Email", accessor: "email" },
    { header: "Group", accessor: "group" },
    {
      header: "Actions",
      accessor: (row) => (
        <Button size="sm" variant="ghost" onClick={() => handleRemoveClick(row)}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      ),
    },
  ];

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
                <span className="ml-2 font-medium">{course.teacher}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Students:</span>
                <span className="ml-2 font-medium">{enrolledStudents.length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sessions:</span>
                <span className="ml-2 font-medium">{course.sessionCount}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Enrolled Students</h2>
        <Button onClick={() => setAddStudentsOpen(true)} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Add Students
        </Button>
      </div>

      <DataTable
        data={enrolledStudents}
        columns={columns}
        searchPlaceholder="Search students..."
      />

      <AddStudentsModal
        open={addStudentsOpen}
        onOpenChange={setAddStudentsOpen}
        availableStudents={availableStudents}
        onSubmit={handleAddStudents}
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
