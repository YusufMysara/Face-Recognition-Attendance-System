import { useState, useEffect } from "react";
import { CourseCard } from "@/components/shared/CourseCard";
import { useNavigate } from "react-router-dom";
import { coursesApi, handleApiError } from "@/lib/api";
import { toast } from "sonner";

interface Course {
  id: number;
  name: string;
  description: string;
  teacher_id?: number;
}

export default function Courses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await coursesApi.list();
      setCourses(data || []);
    } catch (err) {
      setError(handleApiError(err));
      toast.error(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleViewCourse = (courseId: number) => {
    navigate(`/teacher/course/${courseId}`);
  };

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
            <Button onClick={loadCourses} variant="outline">
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
        <h1 className="text-3xl font-bold mb-2">My Courses</h1>
        <p className="text-muted-foreground">View and manage your assigned courses</p>
      </div>

      {courses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No courses assigned yet</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              id={String(course.id)}
              name={course.name}
              code={`COURSE-${course.id}`}
              onView={() => handleViewCourse(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
