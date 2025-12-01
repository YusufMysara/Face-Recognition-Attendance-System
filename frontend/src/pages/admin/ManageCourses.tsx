import { useState, useEffect } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { CourseFormModal } from "@/components/modals/CourseFormModal";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { coursesApi, usersApi, handleApiError } from "@/lib/api";

interface Course {
  id: number;
  name: string;
  description: string;
  teacher_id?: number;
  teacher_name?: string;
}

interface Teacher {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function ManageCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedCourse, setSelectedCourse] = useState<Course | undefined>();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Load courses and teachers on component mount
  useEffect(() => {
    loadCoursesAndTeachers();
  }, []);

  const loadCoursesAndTeachers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load courses and teachers in parallel
      const [coursesResponse, teachersResponse] = await Promise.all([
        coursesApi.list(),
        usersApi.list().then(users => users.filter(user => user.role === "teacher"))
      ]);

      // Enrich courses with teacher names
      const enrichedCourses = coursesResponse.map(course => ({
        ...course,
        teacher_name: course.teacher_id
          ? teachersResponse.find(teacher => teacher.id === course.teacher_id)?.name
          : undefined
      }));

      setCourses(enrichedCourses);
      setTeachers(teachersResponse);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

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

  const handleViewCourse = (courseId: number) => {
    navigate(`/admin/course/${courseId}`);
  };

  const handleDeleteClick = (course: Course) => {
    setCourseToDelete(course);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!courseToDelete) return;

    try {
      await coursesApi.delete(courseToDelete.id);
      setCourses(courses.filter((c) => c.id !== courseToDelete.id));
      toast.success("Course deleted successfully");
      setDeleteModalOpen(false);
      setCourseToDelete(null);
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      setFormLoading(true);

      if (formMode === "create") {
        const payload = {
          name: data.name,
          description: data.description,
          teacher_id: data.teacher_id ? parseInt(data.teacher_id) : undefined,
        };
        const newCourse = await coursesApi.create(payload);

        // Add teacher name for display
        const enrichedCourse = {
          ...newCourse,
          teacher_name: newCourse.teacher_id
            ? teachers.find(teacher => teacher.id === newCourse.teacher_id)?.name
            : undefined
        };

        setCourses([...courses, enrichedCourse]);
        toast.success("Course created successfully");
      } else if (selectedCourse) {
        const payload: any = {};
        if (data.name !== selectedCourse.name) payload.name = data.name;
        if (data.description !== selectedCourse.description) payload.description = data.description;
        if (parseInt(data.teacher_id) !== selectedCourse.teacher_id) payload.teacher_id = parseInt(data.teacher_id);

        if (Object.keys(payload).length > 0) {
          const updatedCourse = await coursesApi.update(selectedCourse.id, payload);

          // Add teacher name for display
          const enrichedCourse = {
            ...updatedCourse,
            teacher_name: updatedCourse.teacher_id
              ? teachers.find(teacher => teacher.id === updatedCourse.teacher_id)?.name
              : undefined
          };

          setCourses(courses.map((c) => (c.id === selectedCourse.id ? enrichedCourse : c)));
        }
        toast.success("Course updated successfully");
      }
      setCourseFormOpen(false);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const columns: Column<Course>[] = [
    { header: "Course Name", accessor: "name" },
    {
      header: "Teacher",
      accessor: (row) => row.teacher_name || "Not assigned"
    },
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

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading courses...</p>
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
            <Button onClick={loadCoursesAndTeachers} variant="outline">
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
        teachers={teachers.map(t => ({ id: String(t.id), name: t.name }))}
        onSubmit={handleFormSubmit}
        loading={formLoading}
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
