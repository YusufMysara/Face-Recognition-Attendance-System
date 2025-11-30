import { StatsCard } from "@/components/shared/StatsCard";
import { Users, BookOpen, Calendar, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AdminDashboard() {
  const stats = [
    { title: "Total Students", value: "1,234", icon: Users, trend: { value: "12%", isPositive: true } },
    { title: "Total Teachers", value: "56", icon: Users, trend: { value: "5%", isPositive: true } },
    { title: "Total Courses", value: "42", icon: BookOpen, trend: { value: "3%", isPositive: true } },
    { title: "Active Sessions", value: "18", icon: Calendar, trend: { value: "8%", isPositive: true } },
  ];

  return (
    <div className="content-container">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's your system overview.</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <StatsCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
          <div className="space-y-4">
            {[
              { action: "New user registered", time: "2 minutes ago" },
              { action: "Course updated", time: "15 minutes ago" },
              { action: "Attendance session started", time: "1 hour ago" },
              { action: "Student photo uploaded", time: "2 hours ago" },
            ].map((activity, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm">{activity.action}</span>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button className="w-full p-3 text-left rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              Create New User
            </button>
            <button className="w-full p-3 text-left rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              Add New Course
            </button>
            <button className="w-full p-3 text-left rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              Upload Student Photos
            </button>
            <button className="w-full p-3 text-left rounded-lg bg-muted hover:bg-muted/80 transition-colors">
              View All Reports
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
