import 'package:dio/dio.dart';
import '../config/api_config.dart';
import '../models/session.dart';
import '../models/attendance_summary.dart';
import 'auth_service.dart';

class AttendanceService {
  final Dio _dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.getBaseUrl(),
      connectTimeout: Duration(milliseconds: ApiConfig.connectTimeout),
      receiveTimeout: Duration(milliseconds: ApiConfig.receiveTimeout),
    ),
  );
  final AuthService _authService;

  AttendanceService(this._authService) {
    _setupInterceptors();
  }

  void _setupInterceptors() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authService.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
    ));
  }

  /// Get overall attendance summary for the student
  Future<AttendanceSummary> getAttendanceSummary() async {
    final userId = await _authService.getCurrentUserId();
    if (userId == null) throw Exception('User not authenticated');

    try {
      final response = await _dio.get(ApiConfig.studentAttendance.replaceFirst('{studentId}', userId.toString()));

      final data = response.data as Map<String, dynamic>;

      // The backend returns per-course percentages but not raw session counts,
      // so we derive overall totals from the flat history list instead.
      final history = data['history'] as List;
      final int totalSessions = history.length;
      final int attendedSessions =
          history.where((h) => h['status'] == 'present').length;

      return AttendanceSummary(
        totalSessions: totalSessions,
        attendedSessions: attendedSessions,
        missedSessions: totalSessions - attendedSessions,
      );
    } on DioException catch (e) {
      throw Exception('Failed to load attendance summary: ${e.message}');
    }
  }

  /// Get all attendance history across all courses
  Future<List<Session>> getAttendanceHistory() async {
    final userId = await _authService.getCurrentUserId();
    if (userId == null) throw Exception('User not authenticated');

    try {
      final response = await _dio.get(ApiConfig.studentAttendance.replaceFirst('{studentId}', userId.toString()));

      final data = response.data as Map<String, dynamic>;
      final history = data['history'] as List;

      final sessions = history.map((h) {
        return Session(
          id: h['session_id'] as int,
          courseId: h['course_id'] as int,
          teacherId: 0, // Not provided in history
          status: SessionStatus.closed, // Not relevant for history
          startedAt: h['timestamp'] != null ? DateTime.parse(h['timestamp']) : null,
          sessionName: h['session_name'] as String,
          courseName: h['course_name'] as String,
          attendanceStatus: h['status'] == 'present' ? AttendanceStatus.present : AttendanceStatus.absent,
        );
      }).toList();

      // Sort by date (most recent first)
      sessions.sort((a, b) => (b.startedAt ?? DateTime.now()).compareTo(a.startedAt ?? DateTime.now()));

      return sessions;
    } on DioException catch (e) {
      throw Exception('Failed to load attendance history: ${e.message}');
    }
  }

  /// Get low-attendance warnings for the logged-in student.
  /// Returns a list of courses where attendance has dropped below 75%.
  Future<List<AttendanceNotification>> getNotifications() async {
    try {
      final response = await _dio.get(ApiConfig.notifications);
      final data = response.data as List<dynamic>;
      return data.map((item) => AttendanceNotification.fromJson(item as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw Exception('Failed to load notifications: ${e.message}');
    }
  }
}

/// Model for a single low-attendance warning.
class AttendanceNotification {
  final int courseId;
  final String courseName;
  final double attendancePercentage;

  const AttendanceNotification({
    required this.courseId,
    required this.courseName,
    required this.attendancePercentage,
  });

  factory AttendanceNotification.fromJson(Map<String, dynamic> json) {
    return AttendanceNotification(
      courseId: json['course_id'] as int,
      courseName: json['course_name'] as String,
      attendancePercentage: (json['attendance_percentage'] as num).toDouble(),
    );
  }
}
