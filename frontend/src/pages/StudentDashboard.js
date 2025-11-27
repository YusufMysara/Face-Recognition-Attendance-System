import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { attendanceService } from "../services/api";
const StudentDashboard = () => {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [percentages, setPercentages] = useState([]);
    useEffect(() => {
        const fetchData = async () => {
            if (!user)
                return;
            const data = await attendanceService.student(user.id);
            setHistory(data.history);
            setPercentages(data.percentages);
        };
        fetchData();
    }, [user]);
    return (_jsxs("div", { style: { padding: "1rem" }, children: [_jsx("h2", { children: "Student Dashboard" }), _jsxs("section", { children: [_jsx("h3", { children: "Attendance Percentages" }), _jsx("ul", { children: percentages.map((item) => (_jsxs("li", { children: ["Course #", item.course_id, ": ", item.attendance_percentage.toFixed(2), "%"] }, item.course_id))) })] }), _jsxs("section", { children: [_jsx("h3", { children: "History" }), _jsx("ul", { children: history.map((record) => (_jsxs("li", { children: ["Session #", record.session_id, " - ", record.status] }, record.id))) })] })] }));
};
export default StudentDashboard;
