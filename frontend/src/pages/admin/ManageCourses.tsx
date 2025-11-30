import { useState } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { CourseFormModal } from "@/components/modals/CourseFormModal";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Course {
  id: string;
  name: string;
  code: string;
  teacher: string;
  teacherId: string;
  description: string;
}

export default function ManageCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([
    {
      id: "1",
      name: "Computer Science 101",
      code: "CS101",
      teacher: "Dr. Smith",
      teacherId: "2",
      description: "Introduction to Computer Science",
    },
    {
      id: "2",
      name: "Mathematics Advanced",
      code: "MATH201",
      teacher: "Prof. Johnson",
      teacherId: "4",
      description: "Advanced Mathematics",
    },
  ]);

  const [teachers] = useState([
    { id: "2", name: "Dr. Smith" },
    { id: "4", name: "Prof. Johnson" },
    { id: "5", name: "Dr. Williams" },
  ]);

  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedCourse, setSelectedCourse] = useState<Course | undefined>();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  const handleCreateCourse = () => {
    setFormMode("create");
    setSelectedCourse(undefined);
    setCourseFormOpen(true);
  };

  const handleEditCourse = (course: Course) => {
    setFormMode("edit");
    setSelectedCourse(course);
    setCourseFormOpen(true);
  };

  const handleViewCourse = (courseId: string) => {
    navigate(`/admin/course/${courseId}`);
  };

  const handleDeleteClick = (course: Course) => {
    setCourseToDelete(course);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (courseToDelete) {
      setCourses(courses.filter((c) => c.id !== courseToDelete.id));
      toast.success("Course deleted successfully");
      setDeleteModalOpen(false);
      setCourseToDelete(null);
    }
  };

  const handleFormSubmit = (data: any) => {
    const teacherName = teachers.find((t) => t.id === data.teacher_id)?.name || "";

    if (formMode === "create") {
      const newCourse: Course = {
        id: String(courses.length + 1),
        name: data.name,
        code: `COURSE${courses.length + 1}`,
        description: data.description,
        teacher: teacherName,
        teacherId: data.teacher_id,
      };
      setCourses([...courses, newCourse]);
      toast.success("Course created successfully");
    } else if (selectedCourse) {
      setCourses(
        courses.map((c) =>
          c.id === selectedCourse.id
            ? {
                ...c,
                name: data.name,
                description: data.description,
                teacher: teacherName,
                teacherId: data.teacher_id,
              }
            : c
        )
      );
      toast.success("Course updated successfully");
    }
    setCourseFormOpen(false);
  };

  const columns: Column<Course>[] = [
    { header: "Course Name", accessor: "name" },
    { header: "Teacher", accessor: "teacher" },
    {
      header: "Actions",
      accessor: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleViewCourse(row.id)}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleEditCourse(row)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(row)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="content-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Courses</h1>
          <p className="text-muted-foreground">Create and manage course information</p>
        </div>
        <Button onClick={handleCreateCourse} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Create Course
        </Button>
      </div>

      <DataTable data={courses} columns={columns} searchPlaceholder="Search courses..." />

      <CourseFormModal
        open={courseFormOpen}
        onOpenChange={setCourseFormOpen}
        mode={formMode}
        course={selectedCourse}
        teachers={teachers}
        onSubmit={handleFormSubmit}
      />

      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete Course"
        description="Are you sure you want to delete this course? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
