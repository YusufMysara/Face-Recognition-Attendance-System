import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";

interface AttendanceRecord {
  id: string;
  course: string;
  date: string;
  time: string;
  status: string;
}

export default function AttendanceHistory() {
  const records: AttendanceRecord[] = [
    { id: "1", course: "CS101", date: "2024-03-20", time: "09:00 AM", status: "Present" },
    { id: "2", course: "MATH201", date: "2024-03-19", time: "11:00 AM", status: "Present" },
    { id: "3", course: "PHY101", date: "2024-03-18", time: "02:00 PM", status: "Absent" },
    { id: "4", course: "ENG201", date: "2024-03-17", time: "10:00 AM", status: "Present" },
    { id: "5", course: "HIST101", date: "2024-03-16", time: "03:00 PM", status: "Present" },
  ];

  const columns: Column<AttendanceRecord>[] = [
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Attendance History</h1>
        <p className="text-muted-foreground">Complete record of your attendance</p>
      </div>

      <DataTable data={records} columns={columns} searchPlaceholder="Search history..." />
    </div>
  );
}
