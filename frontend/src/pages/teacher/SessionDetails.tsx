import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Users, CheckCircle2, XCircle } from "lucide-react";

interface Student {
  id: string;
  name: string;
  student_id: string;
  status: "Present" | "Absent";
}

export default function SessionDetails() {
  const { sessionId } = useParams<{ sessionId: string }>();
  
  const [courseName] = useState("Computer Science 101");
  const [sessionDate] = useState("March 20, 2024 - 09:00 AM");
  const [students] = useState<Student[]>([
    { id: "1", name: "John Doe", student_id: "S001", status: "Present" },
    { id: "2", name: "Jane Smith", student_id: "S002", status: "Present" },
    { id: "3", name: "Bob Johnson", student_id: "S003", status: "Absent" },
    { id: "4", name: "Alice Brown", student_id: "S004", status: "Present" },
    { id: "5", name: "Charlie Wilson", student_id: "S005", status: "Present" },
  ]);

  const presentCount = students.filter(s => s.status === "Present").length;
  const totalCount = students.length;

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Session Details</h1>
        <p className="text-muted-foreground">View attendance for this session</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Course</p>
              <p className="font-semibold">{courseName}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date & Time</p>
              <p className="font-semibold">{sessionDate}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Attendance</p>
              <p className="font-semibold text-xl">
                {presentCount} / {totalCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4">Student List</h2>
        <div className="space-y-3">
          {students.map((student) => (
            <div
              key={student.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-muted"
            >
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
                {student.status === "Present" ? (
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
          ))}
        </div>
      </Card>
    </div>
  );
}
