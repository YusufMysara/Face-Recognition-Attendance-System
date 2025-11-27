import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  adminService,
  attendanceService,
  courseService,
} from "../services/api";

const AdminDashboard = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [createUserForm, setCreateUserForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    group: "",
  });
  const [newCourse, setNewCourse] = useState({
    name: "",
    description: "",
    teacher_id: "",
  });
  const [studentAssignment, setStudentAssignment] = useState({
    student_id: "",
    course_id: "",
  });
  const [teacherAssignment, setTeacherAssignment] = useState({
    teacher_id: "",
    course_id: "",
  });
  const [photoUpload, setPhotoUpload] = useState<{
    student_id: string;
    file: File | null;
  }>({ student_id: "", file: null });
  const [resetPassword, setResetPassword] = useState({
    user_id: "",
    new_password: "",
  });
  const [attendanceSessionId, setAttendanceSessionId] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchUsers = async () => {
    const data = await adminService.listUsers();
    setUsers(data);
  };

  const fetchCourses = async () => {
    const data = await courseService.list();
    setCourses(data);
  };

  useEffect(() => {
    fetchUsers();
    fetchCourses();
  }, []);

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    await adminService.createUser({
      name: createUserForm.name,
      email: createUserForm.email,
      password: createUserForm.password,
      role: createUserForm.role,
      group: createUserForm.group || undefined,
    });
    setCreateUserForm({
      name: "",
      email: "",
      password: "",
      role: "student",
      group: "",
    });
    fetchUsers();
    setStatusMessage("User created");
  };

  const handleCreateCourse = async (event: FormEvent) => {
    event.preventDefault();
    await courseService.create({
      name: newCourse.name,
      description: newCourse.description,
      teacher_id: Number(newCourse.teacher_id),
    });
    setNewCourse({ name: "", description: "", teacher_id: "" });
    fetchCourses();
    setStatusMessage("Course created");
  };

  const handleAssignStudent = async (event: FormEvent) => {
    event.preventDefault();
    await courseService.assignStudent({
      student_id: Number(studentAssignment.student_id),
      course_id: Number(studentAssignment.course_id),
    });
    setStatusMessage("Student assigned");
  };

  const handleAssignTeacher = async (event: FormEvent) => {
    event.preventDefault();
    await courseService.assignTeacher({
      teacher_id: Number(teacherAssignment.teacher_id),
      course_id: Number(teacherAssignment.course_id),
    });
    setStatusMessage("Teacher assigned");
  };

  const handleUploadPhoto = async (event: FormEvent) => {
    event.preventDefault();
    if (!photoUpload.file) return;
    await adminService.uploadPhoto(
      Number(photoUpload.student_id),
      photoUpload.file
    );
    setPhotoUpload({ student_id: "", file: null });
    setStatusMessage("Photo uploaded");
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    await adminService.resetPassword({
      user_id: Number(resetPassword.user_id),
      new_password: resetPassword.new_password,
    });
    setResetPassword({ user_id: "", new_password: "" });
    setStatusMessage("Password reset");
  };

  const handleFetchAttendance = async (event: FormEvent) => {
    event.preventDefault();
    const data = await attendanceService.session(
      Number(attendanceSessionId)
    );
    setAttendanceRecords(data);
  };

  const students = useMemo(
    () => users.filter((user) => user.role === "student"),
    [users]
  );
  const teachers = useMemo(
    () => users.filter((user) => user.role === "teacher"),
    [users]
  );

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Admin Dashboard</h2>
      {statusMessage && <p>{statusMessage}</p>}
      <section>
        <h3>Create User</h3>
        <form
          onSubmit={handleCreateUser}
          style={{ display: "grid", gap: "0.5rem", maxWidth: 400 }}
        >
          <input
            placeholder="Name"
            value={createUserForm.name}
            onChange={(e) =>
              setCreateUserForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <input
            placeholder="Email"
            value={createUserForm.email}
            onChange={(e) =>
              setCreateUserForm((prev) => ({ ...prev, email: e.target.value }))
            }
          />
          <input
            placeholder="Password"
            type="password"
            value={createUserForm.password}
            onChange={(e) =>
              setCreateUserForm((prev) => ({
                ...prev,
                password: e.target.value,
              }))
            }
          />
          <select
            value={createUserForm.role}
            onChange={(e) =>
              setCreateUserForm((prev) => ({ ...prev, role: e.target.value }))
            }
          >
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
          <input
            placeholder="Group (optional)"
            value={createUserForm.group}
            onChange={(e) =>
              setCreateUserForm((prev) => ({ ...prev, group: e.target.value }))
            }
          />
          <button type="submit">Create</button>
        </form>
      </section>

      <section>
        <h3>Create Course</h3>
        <form
          onSubmit={handleCreateCourse}
          style={{ display: "grid", gap: "0.5rem", maxWidth: 400 }}
        >
          <input
            placeholder="Name"
            value={newCourse.name}
            onChange={(e) =>
              setNewCourse((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <textarea
            placeholder="Description"
            value={newCourse.description}
            onChange={(e) =>
              setNewCourse((prev) => ({ ...prev, description: e.target.value }))
            }
          />
          <select
            value={newCourse.teacher_id}
            onChange={(e) =>
              setNewCourse((prev) => ({ ...prev, teacher_id: e.target.value }))
            }
          >
            <option value="">Select Teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
          <button type="submit">Create Course</button>
        </form>
      </section>

      <section>
        <h3>Assign Student to Course</h3>
        <form
          onSubmit={handleAssignStudent}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <select
            value={studentAssignment.student_id}
            onChange={(e) =>
              setStudentAssignment((prev) => ({
                ...prev,
                student_id: e.target.value,
              }))
            }
          >
            <option value="">Select Student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <select
            value={studentAssignment.course_id}
            onChange={(e) =>
              setStudentAssignment((prev) => ({
                ...prev,
                course_id: e.target.value,
              }))
            }
          >
            <option value="">Select Course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          <button type="submit">Assign</button>
        </form>
      </section>

      <section>
        <h3>Assign Teacher to Course</h3>
        <form
          onSubmit={handleAssignTeacher}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <select
            value={teacherAssignment.teacher_id}
            onChange={(e) =>
              setTeacherAssignment((prev) => ({
                ...prev,
                teacher_id: e.target.value,
              }))
            }
          >
            <option value="">Select Teacher</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name}
              </option>
            ))}
          </select>
          <select
            value={teacherAssignment.course_id}
            onChange={(e) =>
              setTeacherAssignment((prev) => ({
                ...prev,
                course_id: e.target.value,
              }))
            }
          >
            <option value="">Select Course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
          <button type="submit">Assign</button>
        </form>
      </section>

      <section>
        <h3>Upload Student Photo</h3>
        <form
          onSubmit={handleUploadPhoto}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
        >
          <select
            value={photoUpload.student_id}
            onChange={(e) =>
              setPhotoUpload((prev) => ({ ...prev, student_id: e.target.value }))
            }
          >
            <option value="">Select Student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setPhotoUpload((prev) => ({
                ...prev,
                file: e.target.files?.[0] ?? null,
              }))
            }
          />
          <button type="submit">Upload</button>
        </form>
      </section>

      <section>
        <h3>Reset Password</h3>
        <form
          onSubmit={handleResetPassword}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <select
            value={resetPassword.user_id}
            onChange={(e) =>
              setResetPassword((prev) => ({
                ...prev,
                user_id: e.target.value,
              }))
            }
          >
            <option value="">Select User</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.role})
              </option>
            ))}
          </select>
          <input
            type="password"
            placeholder="New Password"
            value={resetPassword.new_password}
            onChange={(e) =>
              setResetPassword((prev) => ({
                ...prev,
                new_password: e.target.value,
              }))
            }
          />
          <button type="submit">Reset</button>
        </form>
      </section>

      <section>
        <h3>View Session Attendance</h3>
        <form
          onSubmit={handleFetchAttendance}
          style={{ display: "flex", gap: "0.5rem" }}
        >
          <input
            placeholder="Session ID"
            value={attendanceSessionId}
            onChange={(e) => setAttendanceSessionId(e.target.value)}
          />
          <button type="submit">Fetch</button>
        </form>
        <ul>
          {attendanceRecords.map((record) => (
            <li key={record.id}>
              Student #{record.student_id} - {record.status}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Users</h3>
        <ul>
          {users.map((user) => (
            <li key={user.id}>
              {user.name} ({user.role})
              <button onClick={() => adminService.deleteUser(user.id).then(fetchUsers)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AdminDashboard;

