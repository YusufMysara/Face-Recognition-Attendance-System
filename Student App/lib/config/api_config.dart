import 'package:dio/dio.dart';

class ApiConfig {
  // ── Base URL ──────────────────────────────────────────────────────────────
  // Uncomment the appropriate line for your environment:
  // static const String _localUrl    = 'http://localhost:8000';
  // static const String _emulatorUrl = 'http://10.0.2.2:8000';  // Android emulator
  // static const String _deviceUrl   = 'http://192.168.x.x:8000'; // physical device (replace IP)
  static const String _railwayUrl =
      'https://face-recognition-attendance-system-production-0ed1.up.railway.app';

  static String getBaseUrl() => _railwayUrl;

  // ── Auth endpoints ────────────────────────────────────────────────────────
  static const String login = '/auth/login';

  // ── Student endpoints ─────────────────────────────────────────────────────
  static const String studentCourses  = '/courses';
  static const String studentAttendance = '/attendance/student/{studentId}';
  static const String courseDetails   = '/courses/{courseId}';
  static const String courseSessions  = '/sessions/course/{courseId}';
  static const String notifications   = '/attendance/notifications';

  // ── Timeout durations (ms) ────────────────────────────────────────────────
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
}
