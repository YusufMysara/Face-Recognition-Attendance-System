import { useCallback, useEffect, useState } from "react";

import CameraStream from "../components/CameraStream";
import { attendanceService, courseService, sessionService } from "../services/api";

const TeacherDashboard = () => {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchCourses = async () => {
    const data = await courseService.list();
    setCourses(data);
  };

  const fetchSessions = async (courseId: number) => {
    const data = await sessionService.byCourse(courseId);
    setSessions(data);
  };

  const fetchAttendance = async (sessionId: number) => {
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
    if (!selectedCourse) return;
    const session = await sessionService.start(selectedCourse);
    setActiveSessionId(session.id);
    setCameraActive(true);
    fetchSessions(selectedCourse);
    setStatusMessage("Session started, camera active");
  };

  const handleEndSession = async (sessionId: number) => {
    await sessionService.end(sessionId);
    if (activeSessionId === sessionId) {
      setCameraActive(false);
    }
    selectedCourse && fetchSessions(selectedCourse);
    setStatusMessage("Session closed");
  };

  const handleSubmitSession = async (sessionId: number) => {
    await sessionService.submit(sessionId);
    selectedCourse && fetchSessions(selectedCourse);
    setStatusMessage("Session submitted");
  };

  const handleDeleteSession = async (sessionId: number) => {
    await sessionService.remove(sessionId);
    selectedCourse && fetchSessions(selectedCourse);
    setStatusMessage("Session deleted");
  };

  const handleRetake = async (sessionId: number) => {
    await attendanceService.retake(sessionId);
    if (sessionId === activeSessionId) {
      setCameraActive(true);
    }
    fetchAttendance(sessionId);
    setStatusMessage("Attendance reset for retake");
  };

  const handleCameraMark = useCallback(
    (response: any) => {
      if (activeSessionId) {
        fetchAttendance(activeSessionId);
      }
      setStatusMessage(
        response.attendance?.length
          ? `Marked ${response.attendance.length} student(s)`
          : "No recognized faces"
      );
    },
    [activeSessionId]
  );

  const handleSelectSession = (sessionId: number) => {
    setActiveSessionId(sessionId);
    fetchAttendance(sessionId);
    setCameraActive(sessionId === activeSessionId ? cameraActive : false);
  };

  const handleManualEdit = async (attendanceId: number, status: string) => {
    await attendanceService.edit(attendanceId, status);
    if (activeSessionId) {
      fetchAttendance(activeSessionId);
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Teacher Dashboard</h2>
      {statusMessage && <p>{statusMessage}</p>}

      <section>
        <h3>Your Courses</h3>
        <select
          value={selectedCourse ?? ""}
          onChange={(e) => setSelectedCourse(Number(e.target.value))}
        >
          <option value="">Select Course</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.name}
            </option>
          ))}
        </select>
        <button onClick={handleStartSession} disabled={!selectedCourse}>
          Start Session
        </button>
      </section>

      <section>
        <h3>Sessions</h3>
        <ul>
          {sessions.map((session) => (
            <li key={session.id}>
              Session #{session.id} - Status: {session.status}
              <button onClick={() => handleSelectSession(session.id)}>
                View
              </button>
              <button onClick={() => handleEndSession(session.id)}>
                End
              </button>
              <button onClick={() => handleSubmitSession(session.id)}>
                Submit
              </button>
              <button onClick={() => handleRetake(session.id)}>Retake</button>
              <button onClick={() => handleDeleteSession(session.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Live Camera</h3>
        <label>
          <input
            type="checkbox"
            checked={cameraActive}
            onChange={(e) => setCameraActive(e.target.checked)}
            disabled={!activeSessionId}
          />
          Camera Active
        </label>
        <CameraStream
          sessionId={activeSessionId}
          active={cameraActive}
          onMarked={handleCameraMark}
        />
      </section>

      <section>
        <h3>Attendance Records</h3>
        <ul>
          {attendanceRecords.map((record) => (
            <li key={record.id}>
              {record.student_name ?? `Student #${record.student_id}`} - {record.status}
              <select
                value={record.status}
                onChange={(e) =>
                  handleManualEdit(record.id, e.target.value)
                }
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="excused">Excused</option>
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default TeacherDashboard;

