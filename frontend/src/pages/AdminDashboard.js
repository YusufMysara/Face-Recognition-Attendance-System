import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { adminService, attendanceService, courseService, } from "../services/api";
const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [courses, setCourses] = useState([]);
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
    const [photoUpload, setPhotoUpload] = useState({ student_id: "", file: null });
    const [resetPassword, setResetPassword] = useState({
        user_id: "",
        new_password: "",
    });
    const [attendanceSessionId, setAttendanceSessionId] = useState("");
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [statusMessage, setStatusMessage] = useState(null);
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
    const handleCreateUser = async (event) => {
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
    const handleCreateCourse = async (event) => {
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
    const handleAssignStudent = async (event) => {
        event.preventDefault();
        await courseService.assignStudent({
            student_id: Number(studentAssignment.student_id),
            course_id: Number(studentAssignment.course_id),
        });
        setStatusMessage("Student assigned");
    };
    const handleAssignTeacher = async (event) => {
        event.preventDefault();
        await courseService.assignTeacher({
            teacher_id: Number(teacherAssignment.teacher_id),
            course_id: Number(teacherAssignment.course_id),
        });
        setStatusMessage("Teacher assigned");
    };
    const handleUploadPhoto = async (event) => {
        event.preventDefault();
        if (!photoUpload.file)
            return;
        await adminService.uploadPhoto(Number(photoUpload.student_id), photoUpload.file);
        setPhotoUpload({ student_id: "", file: null });
        setStatusMessage("Photo uploaded");
    };
    const handleResetPassword = async (event) => {
        event.preventDefault();
        await adminService.resetPassword({
            user_id: Number(resetPassword.user_id),
            new_password: resetPassword.new_password,
        });
        setResetPassword({ user_id: "", new_password: "" });
        setStatusMessage("Password reset");
    };
    const handleFetchAttendance = async (event) => {
        event.preventDefault();
        const data = await attendanceService.session(Number(attendanceSessionId));
        setAttendanceRecords(data);
    };
    const students = useMemo(() => users.filter((user) => user.role === "student"), [users]);
    const teachers = useMemo(() => users.filter((user) => user.role === "teacher"), [users]);
    return (_jsxs("div", { style: { padding: "1rem" }, children: [_jsx("h2", { children: "Admin Dashboard" }), statusMessage && _jsx("p", { children: statusMessage }), _jsxs("section", { children: [_jsx("h3", { children: "Create User" }), _jsxs("form", { onSubmit: handleCreateUser, style: { display: "grid", gap: "0.5rem", maxWidth: 400 }, children: [_jsx("input", { placeholder: "Name", value: createUserForm.name, onChange: (e) => setCreateUserForm((prev) => ({ ...prev, name: e.target.value })) }), _jsx("input", { placeholder: "Email", value: createUserForm.email, onChange: (e) => setCreateUserForm((prev) => ({ ...prev, email: e.target.value })) }), _jsx("input", { placeholder: "Password", type: "password", value: createUserForm.password, onChange: (e) => setCreateUserForm((prev) => ({
                                    ...prev,
                                    password: e.target.value,
                                })) }), _jsxs("select", { value: createUserForm.role, onChange: (e) => setCreateUserForm((prev) => ({ ...prev, role: e.target.value })), children: [_jsx("option", { value: "student", children: "Student" }), _jsx("option", { value: "teacher", children: "Teacher" })] }), _jsx("input", { placeholder: "Group (optional)", value: createUserForm.group, onChange: (e) => setCreateUserForm((prev) => ({ ...prev, group: e.target.value })) }), _jsx("button", { type: "submit", children: "Create" })] })] }), _jsxs("section", { children: [_jsx("h3", { children: "Create Course" }), _jsxs("form", { onSubmit: handleCreateCourse, style: { display: "grid", gap: "0.5rem", maxWidth: 400 }, children: [_jsx("input", { placeholder: "Name", value: newCourse.name, onChange: (e) => setNewCourse((prev) => ({ ...prev, name: e.target.value })) }), _jsx("textarea", { placeholder: "Description", value: newCourse.description, onChange: (e) => setNewCourse((prev) => ({ ...prev, description: e.target.value })) }), _jsxs("select", { value: newCourse.teacher_id, onChange: (e) => setNewCourse((prev) => ({ ...prev, teacher_id: e.target.value })), children: [_jsx("option", { value: "", children: "Select Teacher" }), teachers.map((teacher) => (_jsx("option", { value: teacher.id, children: teacher.name }, teacher.id)))] }), _jsx("button", { type: "submit", children: "Create Course" })] })] }), _jsxs("section", { children: [_jsx("h3", { children: "Assign Student to Course" }), _jsxs("form", { onSubmit: handleAssignStudent, style: { display: "flex", gap: "0.5rem" }, children: [_jsxs("select", { value: studentAssignment.student_id, onChange: (e) => setStudentAssignment((prev) => ({
                                    ...prev,
                                    student_id: e.target.value,
                                })), children: [_jsx("option", { value: "", children: "Select Student" }), students.map((student) => (_jsx("option", { value: student.id, children: student.name }, student.id)))] }), _jsxs("select", { value: studentAssignment.course_id, onChange: (e) => setStudentAssignment((prev) => ({
                                    ...prev,
                                    course_id: e.target.value,
                                })), children: [_jsx("option", { value: "", children: "Select Course" }), courses.map((course) => (_jsx("option", { value: course.id, children: course.name }, course.id)))] }), _jsx("button", { type: "submit", children: "Assign" })] })] }), _jsxs("section", { children: [_jsx("h3", { children: "Assign Teacher to Course" }), _jsxs("form", { onSubmit: handleAssignTeacher, style: { display: "flex", gap: "0.5rem" }, children: [_jsxs("select", { value: teacherAssignment.teacher_id, onChange: (e) => setTeacherAssignment((prev) => ({
                                    ...prev,
                                    teacher_id: e.target.value,
                                })), children: [_jsx("option", { value: "", children: "Select Teacher" }), teachers.map((teacher) => (_jsx("option", { value: teacher.id, children: teacher.name }, teacher.id)))] }), _jsxs("select", { value: teacherAssignment.course_id, onChange: (e) => setTeacherAssignment((prev) => ({
                                    ...prev,
                                    course_id: e.target.value,
                                })), children: [_jsx("option", { value: "", children: "Select Course" }), courses.map((course) => (_jsx("option", { value: course.id, children: course.name }, course.id)))] }), _jsx("button", { type: "submit", children: "Assign" })] })] }), _jsxs("section", { children: [_jsx("h3", { children: "Upload Student Photo" }), _jsxs("form", { onSubmit: handleUploadPhoto, style: { display: "flex", gap: "0.5rem", alignItems: "center" }, children: [_jsxs("select", { value: photoUpload.student_id, onChange: (e) => setPhotoUpload((prev) => ({ ...prev, student_id: e.target.value })), children: [_jsx("option", { value: "", children: "Select Student" }), students.map((student) => (_jsx("option", { value: student.id, children: student.name }, student.id)))] }), _jsx("input", { type: "file", accept: "image/*", onChange: (e) => setPhotoUpload((prev) => ({
                                    ...prev,
                                    file: e.target.files?.[0] ?? null,
                                })) }), _jsx("button", { type: "submit", children: "Upload" })] })] }), _jsxs("section", { children: [_jsx("h3", { children: "Reset Password" }), _jsxs("form", { onSubmit: handleResetPassword, style: { display: "flex", gap: "0.5rem" }, children: [_jsxs("select", { value: resetPassword.user_id, onChange: (e) => setResetPassword((prev) => ({
                                    ...prev,
                                    user_id: e.target.value,
                                })), children: [_jsx("option", { value: "", children: "Select User" }), users.map((user) => (_jsxs("option", { value: user.id, children: [user.name, " (", user.role, ")"] }, user.id)))] }), _jsx("input", { type: "password", placeholder: "New Password", value: resetPassword.new_password, onChange: (e) => setResetPassword((prev) => ({
                                    ...prev,
                                    new_password: e.target.value,
                                })) }), _jsx("button", { type: "submit", children: "Reset" })] })] }), _jsxs("section", { children: [_jsx("h3", { children: "View Session Attendance" }), _jsxs("form", { onSubmit: handleFetchAttendance, style: { display: "flex", gap: "0.5rem" }, children: [_jsx("input", { placeholder: "Session ID", value: attendanceSessionId, onChange: (e) => setAttendanceSessionId(e.target.value) }), _jsx("button", { type: "submit", children: "Fetch" })] }), _jsx("ul", { children: attendanceRecords.map((record) => (_jsxs("li", { children: ["Student #", record.student_id, " - ", record.status] }, record.id))) })] }), _jsxs("section", { children: [_jsx("h3", { children: "Users" }), _jsx("ul", { children: users.map((user) => (_jsxs("li", { children: [user.name, " (", user.role, ")", _jsx("button", { onClick: () => adminService.deleteUser(user.id).then(fetchUsers), children: "Delete" })] }, user.id))) })] })] }));
};
export default AdminDashboard;
