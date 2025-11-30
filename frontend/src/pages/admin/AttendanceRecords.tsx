import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface AttendanceRecord {
  id: string;
  student: string;
  course: string;
  date: string;
  status: string;
  time: string;
}

export default function AttendanceRecords() {
  const records: AttendanceRecord[] = [
    { id: "1", student: "John Doe", course: "CS101", date: "2024-03-20", status: "Present", time: "09:00 AM" },
    { id: "2", student: "Jane Smith", course: "MATH201", date: "2024-03-20", status: "Present", time: "10:15 AM" },
    { id: "3", student: "Bob Johnson", course: "PHY101", date: "2024-03-20", status: "Absent", time: "-" },
  ];

  const columns: Column<AttendanceRecord>[] = [
    { header: "Student", accessor: "student" },
    { header: "Course", accessor: "course" },
    { header: "Date", accessor: "date" },
    { header: "Time", accessor: "time" },
    {
      header: "Status",
      accessor: (row) => (
        <Badge variant={row.status === "Present" ? "default" : "destructive"}>
          {row.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="content-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Attendance Records</h1>
          <p className="text-muted-foreground">View all attendance records</p>
        </div>
        <Button className="rounded-xl">
          <Download className="w-4 h-4 mr-2" />
          Export Records
        </Button>
      </div>

      <DataTable data={records} columns={columns} searchPlaceholder="Search records..." />
    </div>
  );
}
