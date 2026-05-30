"""Business logic for attendance — face recognition orchestration and record management."""
import json
import logging
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from fastapi import HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.models import Attendance as AttendanceModel, User
from app.repositories.attendance_repository import AttendanceRepository
from app.schemas.attendance import AttendanceEdit, AttendanceResponse, RetakeRequest
from app.utils.face import bytes_to_bgr, embedding_from_crop, get_face_app

logger = logging.getLogger(__name__)

_SIMILARITY_THRESHOLD = 0.35


class AttendanceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AttendanceRepository(db)

    # ── private helpers ───────────────────────────────────────────────────────

    def _to_response(
        self, record: AttendanceModel, student_name: Optional[str]
    ) -> AttendanceResponse:
        return AttendanceResponse(
            id=record.id,
            session_id=record.session_id,
            student_id=record.student_id,
            status=record.status,
            timestamp=record.timestamp,
            student_name=student_name,
        )

    def _require_session(self, session_id: int):
        session = self.repo.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    def _require_owner(self, session, teacher_id: int) -> None:
        if session.teacher_id != teacher_id:
            raise HTTPException(status_code=403, detail="Not your session")

    def _build_known(self, students: List[User]) -> List[Tuple[User, np.ndarray]]:
        """Build a list of (student, unit-normalised ArcFace embedding) pairs.

        Filters out students who have no embedding or whose embedding is not the
        expected 512-dimensional ArcFace shape (old dlib 128-dim embeddings).
        """
        known: List[Tuple[User, np.ndarray]] = []
        for student in students:
            if not student.face_embedding:
                continue
            emb = np.array(json.loads(student.face_embedding), dtype=np.float32)
            if emb.shape[0] != 512:
                continue
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            known.append((student, emb))
        return known

    def _best_match(
        self, embedding: np.ndarray, known: List[Tuple[User, np.ndarray]]
    ) -> Tuple[Optional[User], float]:
        best_student: Optional[User] = None
        best_score = 0.0
        for student, known_emb in known:
            score = float(np.dot(embedding, known_emb))
            if score > best_score:
                best_score = score
                best_student = student
        return best_student, best_score

    # ── face recognition endpoints ────────────────────────────────────────────

    def mark_full_frame(
        self, session_id: int, file: UploadFile, current_user: User
    ) -> Dict[str, Any]:
        """SCRFD detection + ArcFace recognition on a full camera frame."""
        session = self._require_session(session_id)
        if session.status == "submitted":
            raise HTTPException(status_code=400, detail="Session already submitted")
        self._require_owner(session, current_user.id)

        students = self.repo.get_course_students(session.course_id)
        known = self._build_known(students)
        if not known:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No valid face embeddings registered. "
                    "Students must re-upload their photos after the InsightFace migration."
                ),
            )

        file.file.seek(0)
        img = bytes_to_bgr(file.file.read())
        faces = get_face_app().get(img)
        if not faces:
            return {"attendance": [], "detected_faces": []}

        attendance_responses: List[AttendanceResponse] = []
        detected_faces: List[Dict[str, Any]] = []

        for face in faces:
            bbox = face.bbox.astype(int).tolist()

            embedding = face.embedding.astype(np.float32)
            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

            best_student, best_score = self._best_match(embedding, known)
            matched_id: Optional[int] = None
            matched_name: Optional[str] = None

            if best_student and best_score >= _SIMILARITY_THRESHOLD:
                matched_id = best_student.id
                matched_name = best_student.name
                record = self.repo.upsert_present(session_id, best_student.id)
                attendance_responses.append(
                    self._to_response(record, best_student.name)
                )

            detected_faces.append(
                {
                    "bbox": bbox,
                    "student_id": matched_id,
                    "student_name": matched_name,
                    "score": round(best_score, 3),
                }
            )

        self.db.commit()
        return {"attendance": attendance_responses, "detected_faces": detected_faces}

    def mark_crops(
        self, session_id: int, files: List[UploadFile], current_user: User
    ) -> Dict[str, Any]:
        """ArcFace-only recognition on pre-detected face crops from the client (SCRFD).

        SCRFD is skipped on the backend — the browser already ran it and sent a
        tight face crop, so calling get_feat() directly saves ~15-30 ms per crop.
        """
        session = self._require_session(session_id)
        if session.status == "submitted":
            raise HTTPException(status_code=400, detail="Session already submitted")
        self._require_owner(session, current_user.id)

        students = self.repo.get_course_students(session.course_id)
        known = self._build_known(students)
        if not known:
            raise HTTPException(
                status_code=400, detail="No valid face embeddings registered."
            )

        results: List[Dict[str, Any]] = []
        t_start = time.perf_counter()

        for idx, file in enumerate(files):
            t_crop = time.perf_counter()
            file.file.seek(0)
            try:
                img = bytes_to_bgr(file.file.read())
            except Exception:
                results.append(
                    {
                        "face_index": idx,
                        "student_id": None,
                        "student_name": None,
                        "score": 0.0,
                    }
                )
                continue

            embedding = embedding_from_crop(img)
            t_arcface = time.perf_counter()
            logger.info(
                "[timing] crop %d: ArcFace=%d ms",
                idx,
                int(1000 * (t_arcface - t_crop)),
            )

            if embedding is None:
                results.append(
                    {
                        "face_index": idx,
                        "student_id": None,
                        "student_name": None,
                        "score": 0.0,
                    }
                )
                continue

            norm = np.linalg.norm(embedding)
            if norm > 0:
                embedding = embedding / norm

            best_student, best_score = self._best_match(embedding, known)
            logger.info(
                "[recognition] crop %d: best_match=%s score=%.3f threshold=%.2f → %s",
                idx,
                best_student.name if best_student else "none",
                best_score,
                _SIMILARITY_THRESHOLD,
                "MATCH" if best_student and best_score >= _SIMILARITY_THRESHOLD else "NO MATCH",
            )

            if best_student and best_score >= _SIMILARITY_THRESHOLD:
                self.repo.upsert_present(session_id, best_student.id)
                results.append(
                    {
                        "face_index": idx,
                        "student_id": best_student.id,
                        "student_name": best_student.name,
                        "score": round(best_score, 3),
                    }
                )
            else:
                results.append(
                    {
                        "face_index": idx,
                        "student_id": None,
                        "student_name": None,
                        "score": round(best_score, 3),
                    }
                )

        t_end = time.perf_counter()
        logger.info(
            "[timing] mark-crops total: %d crops in %d ms (%d ms/crop avg)",
            len(files),
            int(1000 * (t_end - t_start)),
            int(1000 * (t_end - t_start) / max(len(files), 1)),
        )
        self.db.commit()
        return {"recognized": results}

    # ── attendance management ─────────────────────────────────────────────────

    def retake(self, payload: RetakeRequest, current_user: User) -> dict:
        session = self._require_session(payload.session_id)
        self._require_owner(session, current_user.id)
        if session.status == "submitted":
            raise HTTPException(
                status_code=400, detail="Cannot retake submitted session"
            )
        self.repo.delete_for_session(payload.session_id)
        session.status = "open"
        self.db.commit()
        return {"detail": "Attendance cleared for retake"}

    def get_session_attendance(
        self, session_id: int, current_user: User
    ) -> List[AttendanceResponse]:
        session = self._require_session(session_id)
        if current_user.role == "teacher":
            self._require_owner(session, current_user.id)
        elif current_user.role == "student":
            enrollment = self.repo.get_enrollment(session.course_id, current_user.id)
            if not enrollment:
                raise HTTPException(status_code=403, detail="Not enrolled")
        records = self.repo.get_for_session(session_id)
        return [self._to_response(record, name) for record, name in records]

    def get_student_attendance(
        self, student_id: int, current_user: User
    ) -> Dict[str, Any]:
        if current_user.role == "student" and current_user.id != student_id:
            raise HTTPException(status_code=403, detail="Cannot view other students")
        student = self.repo.get_student_by_id(student_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")

        rows = self.repo.get_student_attendance_history(student_id)

        # Build session-number map per course (session 1, 2, 3 … by date)
        course_session_counts: Dict[int, dict] = {}
        history = []
        for record, student_name, course_name, course_id, _ in rows:
            if course_id not in course_session_counts:
                course_session_counts[course_id] = {}

            if "sessions" not in course_session_counts[course_id]:
                sessions = self.repo.get_sessions_for_course_ordered(course_id)
                course_session_counts[course_id] = {
                    "sessions": sessions,
                    "session_map": {s.id: i + 1 for i, s in enumerate(sessions)},
                }

            session_number = course_session_counts[course_id]["session_map"].get(
                record.session_id, 1
            )
            history.append(
                {
                    "id": record.id,
                    "session_id": record.session_id,
                    "student_id": record.student_id,
                    "status": record.status,
                    "timestamp": record.timestamp,
                    "student_name": student_name,
                    "course_id": course_id,
                    "course_name": course_name,
                    "session_name": f"Session {session_number}",
                }
            )

        records = [r for r, *_ in rows]

        # Compute per-course attendance percentages.
        # Fetch only sessions for courses the student is actually enrolled in
        # (avoids get_all_sessions + N enrollment queries — single IN query instead).
        enrolled_course_ids = {
            e.course_id
            for e in self.repo.get_enrollments_for_student(student_id)
        }
        sessions_for_courses = self.repo.get_sessions_for_courses(enrolled_course_ids)
        records_by_session: Dict[int, Any] = {rec.session_id: rec for rec in records}

        course_totals: Dict[int, Dict[str, int]] = defaultdict(
            lambda: {"present": 0, "total": 0}
        )
        for session in sessions_for_courses:
            course_totals[session.course_id]["total"] += 1
            rec = records_by_session.get(session.id)
            if rec and rec.status == "present":
                course_totals[session.course_id]["present"] += 1

        percentages = [
            {
                "course_id": cid,
                "attendance_percentage": (
                    (stats["present"] / stats["total"]) * 100
                    if stats["total"]
                    else 0.0
                ),
            }
            for cid, stats in course_totals.items()
        ]

        return {"history": history, "percentages": percentages}

    def edit(
        self, payload: AttendanceEdit, current_user: User
    ) -> AttendanceResponse:
        record = self.repo.get_by_id(payload.attendance_id)
        if not record:
            raise HTTPException(status_code=404, detail="Attendance not found")
        session = self._require_session(record.session_id)
        if session.status == "submitted":
            raise HTTPException(
                status_code=400,
                detail="Cannot edit attendance for a submitted session",
            )
        if current_user.role == "teacher":
            self._require_owner(session, current_user.id)
        elif current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Not authorized")
        record.status = payload.status
        student_name = self.repo.get_student_name(record.student_id)
        self.db.commit()
        return self._to_response(record, student_name)

    def get_all(self, skip: int = 0, limit: int = 100) -> list:
        rows = self.repo.get_all_with_joins(skip=skip, limit=limit)
        return [
            {
                "id": record.id,
                "session_id": record.session_id,
                "student_id": record.student_id,
                "student_name": student_name,
                "course_name": course_name,
                "status": record.status,
                "timestamp": record.timestamp.isoformat() if record.timestamp else None,
            }
            for record, student_name, course_name in rows
        ]

    def create_manual(
        self,
        session_id: int,
        student_id: int,
        status: str,
        current_user: User,
    ) -> AttendanceResponse:
        session = self._require_session(session_id)
        if session.status == "submitted":
            raise HTTPException(
                status_code=400,
                detail="Cannot modify attendance for a submitted session",
            )
        self._require_owner(session, current_user.id)

        enrollment = self.repo.get_enrollment(session.course_id, student_id)
        if not enrollment:
            raise HTTPException(
                status_code=400, detail="Student not enrolled in this course"
            )

        record = self.repo.upsert_manual(session_id, student_id, status)
        student_name = self.repo.get_student_name(student_id)
        self.db.commit()
        return self._to_response(record, student_name)

    def get_notifications(self, current_user: User) -> list:
        """Low-attendance warnings for the logged-in student (< 75 %).

        Uses 4 queries regardless of the number of enrolled courses, replacing
        the previous 3N+1 pattern (one course fetch + one session fetch + one
        present-count per enrolled course).
        """
        enrollments = self.repo.get_enrollments_for_student(current_user.id)
        if not enrollments:
            return []

        course_ids = [e.course_id for e in enrollments]

        courses = {
            c.id: c for c in self.repo.get_courses_by_ids(course_ids)
        }
        total_per_course = self.repo.count_submitted_sessions_per_course(course_ids)
        present_per_course = self.repo.count_present_per_course(
            current_user.id, course_ids
        )

        notifications = []
        for course_id in course_ids:
            course = courses.get(course_id)
            if not course:
                continue
            total = total_per_course.get(course_id, 0)
            if total == 0:
                continue
            present = present_per_course.get(course_id, 0)
            percentage = round((present / total) * 100, 1)
            if percentage < 75.0:
                notifications.append(
                    {
                        "course_id": course.id,
                        "course_name": course.name,
                        "attendance_percentage": percentage,
                    }
                )
        return notifications
