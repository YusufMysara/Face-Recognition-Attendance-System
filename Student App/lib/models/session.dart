enum SessionStatus {
  open,
  closed,
  submitted,
}

class Session {
  final int id;
  final int courseId;
  final int teacherId;
  final SessionStatus status;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final String? sessionName;
  final String? courseName;

  // For attendance (to be fetched separately)
  AttendanceStatus? attendanceStatus;

  Session({
    required this.id,
    required this.courseId,
    required this.teacherId,
    required this.status,
    this.startedAt,
    this.endedAt,
    this.sessionName,
    this.courseName,
    this.attendanceStatus,
  });

  // Backward compatibility
  DateTime? get dateTime => startedAt;

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      id: json['id'] as int,
      courseId: json['course_id'] as int,
      teacherId: json['teacher_id'] as int,
      status: _parseStatus(json['status'] as String),
      startedAt: json['started_at'] != null ? DateTime.parse(json['started_at']) : null,
      endedAt: json['ended_at'] != null ? DateTime.parse(json['ended_at']) : null,
      sessionName: json['session_name'] as String?,
      courseName: json['course_name'] as String?,
    );
  }

  static SessionStatus _parseStatus(String status) {
    switch (status) {
      case 'open':
        return SessionStatus.open;
      case 'closed':
        return SessionStatus.closed;
      case 'submitted':
        return SessionStatus.submitted;
      default:
        return SessionStatus.closed;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'course_id': courseId,
      'teacher_id': teacherId,
      'status': status.toString().split('.').last,
      'started_at': startedAt?.toIso8601String(),
      'ended_at': endedAt?.toIso8601String(),
      'session_name': sessionName,
      'course_name': courseName,
    };
  }
}

enum AttendanceStatus {
  present,
  absent,
}
