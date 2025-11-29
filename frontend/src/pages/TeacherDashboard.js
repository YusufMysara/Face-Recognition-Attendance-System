import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import CameraStream from "../components/CameraStream";
import { attendanceService, courseService, sessionService } from "../services/api";
const TeacherDashboard = () => {
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [statusMessage, setStatusMessage] = useState(null);
    const fetchCourses = async () => {
        const data = await courseService.list();
        setCourses(data);
    };
    const fetchSessions = async (courseId) => {
        const data = await sessionService.byCourse(courseId);
        setSessions(data);
    };
    const fetchAttendance = async (sessionId) => {
        const data = await attendanceService.session(sessionId);
        setAttendanceRecords(data);
    };
    useEffect(() => {
        fetchCourses();
    }, []);
    useEffect(() => {
        if (selectedCourse) {
            fetchSessions(selectedCourse);
        }
    }, [selectedCourse]);
    const handleStartSession = async () => {
        if (!selectedCourse)
            return;
        const session = await sessionService.start(selectedCourse);
        setActiveSessionId(session.id);
        setCameraActive(true);
        fetchSessions(selectedCourse);
        setStatusMessage("Session started, camera active");
    };
    const handleEndSession = async (sessionId) => {
        await sessionService.end(sessionId);
        if (activeSessionId === sessionId) {
            setCameraActive(false);
        }
        selectedCourse && fetchSessions(selectedCourse);
        setStatusMessage("Session closed");
    };
    const handleSubmitSession = async (sessionId) => {
        await sessionService.submit(sessionId);
        selectedCourse && fetchSessions(selectedCourse);
        setStatusMessage("Session submitted");
    };
    const handleDeleteSession = async (sessionId) => {
        await sessionService.remove(sessionId);
        selectedCourse && fetchSessions(selectedCourse);
        setStatusMessage("Session deleted");
    };
    const handleRetake = async (sessionId) => {
        await attendanceService.retake(sessionId);
        if (sessionId === activeSessionId) {
            setCameraActive(true);
        }
        fetchAttendance(sessionId);
        setStatusMessage("Attendance reset for retake");
    };
    const handleCameraMark = useCallback((response) => {
        if (activeSessionId) {
            fetchAttendance(activeSessionId);
        }
        setStatusMessage(response.attendance?.length
            ? `Marked ${response.attendance.length} student(s)`
            : "No recognized faces");
    }, [activeSessionId]);
    const handleSelectSession = (sessionId) => {
        setActiveSessionId(sessionId);
        fetchAttendance(sessionId);
        setCameraActive(sessionId === activeSessionId ? cameraActive : false);
    };
    const handleManualEdit = async (attendanceId, status) => {
        await attendanceService.edit(attendanceId, status);
        if (activeSessionId) {
            fetchAttendance(activeSessionId);
        }
    };
    return (_jsxs("div", { style: { padding: "1rem" }, children: [_jsx("h2", { children: "Teacher Dashboard" }), statusMessage && _jsx("p", { children: statusMessage }), _jsxs("section", { children: [_jsx("h3", { children: "Your Courses" }), _jsxs("select", { value: selectedCourse ?? "", onChange: (e) => setSelectedCourse(Number(e.target.value)), children: [_jsx("option", { value: "", children: "Select Course" }), courses.map((course) => (_jsx("option", { value: course.id, children: course.name }, course.id)))] }), _jsx("button", { onClick: handleStartSession, disabled: !selectedCourse, children: "Start Session" })] }), _jsxs("section", { children: [_jsx("h3", { children: "Sessions" }), _jsx("ul", { children: sessions.map((session) => (_jsxs("li", { children: ["Session #", session.id, " - Status: ", session.status, _jsx("button", { onClick: () => handleSelectSession(session.id), children: "View" }), _jsx("button", { onClick: () => handleEndSession(session.id), children: "End" }), _jsx("button", { onClick: () => handleSubmitSession(session.id), children: "Submit" }), _jsx("button", { onClick: () => handleRetake(session.id), children: "Retake" }), _jsx("button", { onClick: () => handleDeleteSession(session.id), children: "Delete" })] }, session.id))) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Live Camera" }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: cameraActive, onChange: (e) => setCameraActive(e.target.checked), disabled: !activeSessionId }), "Camera Active"] }), _jsx(CameraStream, { sessionId: activeSessionId, active: cameraActive, onMarked: handleCameraMark })] }), _jsxs("section", { children: [_jsx("h3", { children: "Attendance Records" }), _jsx("ul", { children: attendanceRecords.map((record) => (_jsxs("li", { children: [record.student_name ?? `Student #${record.student_id}`, " - ", record.status, _jsxs("select", { value: record.status, onChange: (e) => handleManualEdit(record.id, e.target.value), children: [_jsx("option", { value: "present", children: "Present" }), _jsx("option", { value: "absent", children: "Absent" }), _jsx("option", { value: "late", children: "Late" }), _jsx("option", { value: "excused", children: "Excused" })] })] }, record.id))) })] })] }));
};
export default TeacherDashboard;
