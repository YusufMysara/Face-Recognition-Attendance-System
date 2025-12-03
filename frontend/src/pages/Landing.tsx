import { Button } from "@/components/ui/button";
import { UserCog, GraduationCap, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroBg from "@/assets/hero-bg.jpg";

export default function Landing() {
  const navigate = useNavigate();

  const portals = [
    {
      title: "Admin Portal",
      description: "Manage users, courses, and attendance records",
      icon: UserCog,
      path: "/login?role=admin",
      color: "bg-primary",
    },
    {
      title: "Teacher Portal",
      description: "Manage sessions and track student attendance",
      icon: BookOpen,
      path: "/login?role=teacher",
      color: "bg-accent-foreground",
    },
    {
      title: "Student Portal",
      description: "View attendance history and statistics",
      icon: GraduationCap,
      path: "/login?role=student",
      color: "bg-success",
    },
  ];

  return (
    <div className="page-container">
      {/* Hero Section */}
      <section
        className="relative min-h-[70vh] flex items-center justify-center bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" />
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in">
            Face Recognition
            <span className="text-primary block mt-2">Attendance System</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            Modern, automated attendance tracking powered by AI technology
          </p>
          <div className="flex flex-wrap gap-4 justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Button size="lg" className="rounded-xl" onClick={() => navigate("/login")}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" className="rounded-xl">
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Portal Cards */}
      <section className="content-container py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Choose Your Portal</h2>
          <p className="text-muted-foreground">
            Select the appropriate portal to access your dashboard
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {portals.map((portal, index) => (
            <div
              key={portal.title}
              className="bg-card rounded-2xl p-8 shadow-lg border border-border card-hover animate-fade-in"
              style={{ animationDelay: `${0.3 + index * 0.1}s` }}
            >
              <div className={`w-16 h-16 rounded-xl ${portal.color} flex items-center justify-center mb-6`}>
                <portal.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-semibold mb-3">{portal.title}</h3>
              <p className="text-muted-foreground mb-6">{portal.description}</p>
              <Button
                className="w-full rounded-xl"
                variant="outline"
                onClick={() => navigate(portal.path)}
              >
                Access Portal
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-card py-16 border-y border-border">
        <div className="content-container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-muted-foreground">
              Everything you need for efficient attendance management
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                title: "Face Recognition",
                description: "Advanced AI-powered face detection and recognition",
              },
              {
                title: "Real-time Tracking",
                description: "Instant attendance recording with live camera feed",
              },
              {
                title: "Comprehensive Reports",
                description: "Detailed analytics and attendance statistics",
              },
            ].map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <div className="w-6 h-6 bg-primary rounded" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="content-container text-center text-muted-foreground">
          <p>© 2024 Face Recognition Attendance System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
