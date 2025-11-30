import { Card } from "@/components/ui/card";
import { BookOpen, Calendar, TrendingUp, Award } from "lucide-react";
import { StatsCard } from "@/components/shared/StatsCard";

export default function StudentDashboard() {
  const stats = [
    { title: "Enrolled Courses", value: "5", icon: BookOpen },
    { title: "Classes This Week", value: "12", icon: Calendar },
    { title: "Overall Attendance", value: "87%", icon: TrendingUp },
  ];

  return (
    <div className="content-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your attendance overview.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">My Courses</h2>
          <div className="space-y-3">
            {[
              { name: "Computer Science 101", code: "CS101", attendance: "92%" },
              { name: "Mathematics Advanced", code: "MATH201", attendance: "88%" },
              { name: "Physics Fundamentals", code: "PHY101", attendance: "85%" },
              { name: "English Literature", code: "ENG201", attendance: "90%" },
              { name: "History Modern", code: "HIST101", attendance: "82%" },
            ].map((course, i) => (
              <div key={i} className="p-4 rounded-lg bg-muted">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">{course.name}</span>
                  <span className="text-sm font-semibold text-primary">{course.attendance}</span>
                </div>
                <p className="text-sm text-muted-foreground">{course.code}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Recent Attendance</h2>
          <div className="space-y-4">
            {[
              { date: "Today", course: "CS101", status: "Present" },
              { date: "Yesterday", course: "MATH201", status: "Present" },
              { date: "2 days ago", course: "PHY101", status: "Absent" },
              { date: "3 days ago", course: "ENG201", status: "Present" },
            ].map((record, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{record.course}</p>
                  <p className="text-xs text-muted-foreground">{record.date}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    record.status === "Present" ? "text-success" : "text-destructive"
                  }`}
                >
                  {record.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
