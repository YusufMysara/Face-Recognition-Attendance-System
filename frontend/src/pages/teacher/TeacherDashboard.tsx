import { StatsCard } from "@/components/shared/StatsCard";
import { BookOpen, Users, Calendar, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function TeacherDashboard() {
  const stats = [
    { title: "Courses Taught", value: "5", icon: BookOpen },
    { title: "Total Students", value: "178", icon: Users },
    { title: "Sessions Today", value: "3", icon: Calendar },
  ];

  return (
    <div className="content-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Teacher Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your teaching overview.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid gap-6">
        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
          <div className="space-y-4">
            {[
              { course: "CS101", date: "Yesterday", attendance: "92%" },
              { course: "MATH201", date: "2 days ago", attendance: "88%" },
              { course: "PHY101", date: "3 days ago", attendance: "85%" },
            ].map((session, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{session.course}</p>
                  <p className="text-xs text-muted-foreground">{session.date}</p>
                </div>
                <span className="font-semibold text-primary">{session.attendance}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
