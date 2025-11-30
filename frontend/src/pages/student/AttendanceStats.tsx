import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function AttendanceStats() {
  const courses = [
    { name: "Computer Science 101", code: "CS101", percentage: 92, present: 46, total: 50 },
    { name: "Mathematics Advanced", code: "MATH201", percentage: 88, present: 44, total: 50 },
    { name: "Physics Fundamentals", code: "PHY101", percentage: 85, present: 42, total: 50 },
    { name: "English Literature", code: "ENG201", percentage: 90, present: 45, total: 50 },
    { name: "History Modern", code: "HIST101", percentage: 82, present: 41, total: 50 },
  ];

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Attendance Statistics</h1>
        <p className="text-muted-foreground">Your attendance percentage for each course</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {courses.map((course) => (
          <Card key={course.code} className="p-6 rounded-xl shadow-md">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">{course.name}</h3>
                <p className="text-sm text-muted-foreground">{course.code}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{course.percentage}%</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {course.present}/{course.total} classes
                </p>
              </div>
            </div>
            <Progress value={course.percentage} className="h-3" />
          </Card>
        ))}

        <Card className="p-6 rounded-xl shadow-md bg-primary text-primary-foreground">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">Overall Attendance</p>
            <p className="text-5xl font-bold mb-2">87%</p>
            <p className="text-sm opacity-90">218/250 total classes attended</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
