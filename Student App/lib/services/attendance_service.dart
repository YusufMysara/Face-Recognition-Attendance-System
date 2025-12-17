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
      final percentages = data['percentages'] as List;

      int totalSessions = 0;
      int attendedSessions = 0;

      for (var p in percentages) {
        // Assuming percentages are calculated as (present/total)*100
        // But backend gives percentage, need to infer total and present
        // For simplicity, let's sum the totals from history or assume
        // Actually, backend doesn't give total per course, only percentage
        // So, perhaps compute overall from history
      }

      final history = data['history'] as List;
      totalSessions = history.length;
      attendedSessions = history.where((h) => h['status'] == 'present').length;

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

  /// Get attendance for a specific date range
  Future<List<Session>> getAttendanceByDateRange(
    DateTime startDate,
    DateTime endDate,
  ) async {
    final allSessions = await getAttendanceHistory();

    return allSessions.where((session) {
      return session.dateTime != null &&
             session.dateTime!.isAfter(startDate) &&
             session.dateTime!.isBefore(endDate);
    }).toList();
  }
}
