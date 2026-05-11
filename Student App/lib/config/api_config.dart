import 'package:dio/dio.dart';

class ApiConfig {
  static const String _localhostUrl = 'http://localhost:8000';

  static const String _emulator = 'http://10.0.2.2:8000'; // Replace with your ngrok URL

  // Fallback IP - replace with your computer's IP for physical device testing
  static const String _fallbackIp = 'http://192.168.1.13:8000'; // Change this
  // to your IP

  static const String _railway = "https://face-recognition-attendance-system-"
      "production-0ed1.up.railway.app" ;

  static String? _detectedBaseUrl;

  // Get the base URL
  static String getBaseUrl() {
    // For browser testing, use localhost
    // For physical device testing, manually change to return _fallbackIp after updating it with your IP
    // return _localhostUrl;
    //return _emulator;
    // return _fallbackIp;
    return _railway;
  }

  // Auth endpoints
  static const String login = '/auth/login';
  static const String logout = '/auth/logout';
  static const String refreshToken = '/auth/refresh';

  // Student endpoints
  static const String studentCourses = '/courses';
  static const String studentAttendance = '/attendance/student/{studentId}';
  static const String courseDetails = '/courses/{courseId}';
  static const String courseSessions = '/sessions/course/{courseId}';
  static const String notifications = '/attendance/notifications';

  // Timeout durations
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
}
