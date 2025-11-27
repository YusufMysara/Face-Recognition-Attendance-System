import { useEffect, useState } from "react";

import { useAuth } from "../hooks/useAuth";
import { attendanceService } from "../services/api";

const StudentDashboard = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [percentages, setPercentages] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      const data = await attendanceService.student(user.id);
      setHistory(data.history);
      setPercentages(data.percentages);
    };
    fetchData();
  }, [user]);

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Student Dashboard</h2>
      <section>
        <h3>Attendance Percentages</h3>
        <ul>
          {percentages.map((item) => (
            <li key={item.course_id}>
              Course #{item.course_id}: {item.attendance_percentage.toFixed(2)}%
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>History</h3>
        <ul>
          {history.map((record) => (
            <li key={record.id}>
              Session #{record.session_id} - {record.status}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default StudentDashboard;

