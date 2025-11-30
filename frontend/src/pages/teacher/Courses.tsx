import { useState, useEffect } from "react";
import { CourseCard } from "@/components/shared/CourseCard";
import { useNavigate } from "react-router-dom";
import { coursesApi } from "@/lib/api";

interface Course {
  id: string;
  name: string;
  code: string;
}

export default function Courses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const teacherId = "teacher_123"; // Replace with actual teacher ID from auth
      const data = await coursesApi.getTeacherCourses(teacherId);
      setCourses(data || []);
    } catch (error) {
      console.error("Error loading courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCourse = (courseId: string) => {
    navigate(`/teacher/course/${courseId}`);
  };

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading courses...</p>
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
              id={course.id}
              name={course.name}
              code={course.code}
              onView={handleViewCourse}
            />
          ))}
        </div>
      )}
    </div>
  );
}
