import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Student {
  id: string;
  name: string;
  student_id: string;
  detected: boolean;
}

export default function SessionReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const courseId = searchParams.get("course_id");
  const courseName = "Computer Science 101"; // Fetch from API
  
  const [students, setStudents] = useState<Student[]>([
    { id: "1", name: "John Doe", student_id: "S001", detected: true },
    { id: "2", name: "Jane Smith", student_id: "S002", detected: true },
    { id: "3", name: "Bob Johnson", student_id: "S003", detected: false },
    { id: "4", name: "Alice Brown", student_id: "S004", detected: false },
    { id: "5", name: "Charlie Wilson", student_id: "S005", detected: true },
  ]);

  const toggleAttendance = (studentId: string) => {
    setStudents(students.map(s =>
      s.id === studentId ? { ...s, detected: !s.detected } : s
    ));
  };

  const handleSubmit = async () => {
    try {
      // Submit attendance to backend
      toast({
        title: "Attendance Submitted",
        description: "The attendance has been saved successfully.",
      });
      
      navigate(`/teacher/course/${courseId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit attendance. Please try again.",
        variant: "destructive",
      });
    }
  };

  const presentCount = students.filter(s => s.detected).length;
  const totalCount = students.length;

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Review Attendance</h1>
        <p className="text-muted-foreground">{courseName} - Session #{sessionId}</p>
      </div>

      <Card className="p-6 rounded-xl shadow-md mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Attendance Summary</p>
            <p className="text-2xl font-bold">
              {presentCount} / {totalCount}
            </p>
          </div>
          <Button
            size="lg"
            className="rounded-xl"
            onClick={handleSubmit}
          >
            Submit Attendance
          </Button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {students.map((student) => (
          <Card
            key={student.id}
            className="p-4 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => toggleAttendance(student.id)}
          >
            <div className="flex items-center gap-4">
              <Avatar className="w-12 h-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {student.name.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{student.name}</p>
                <p className="text-sm text-muted-foreground">ID: {student.student_id}</p>
              </div>
              
              <div>
                {student.detected ? (
                  <Badge className="bg-success hover:bg-success/90">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Present
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="w-4 h-4 mr-1" />
                    Absent
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
