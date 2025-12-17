import 'package:dio/dio.dart';
import '../config/api_config.dart';
import '../models/course.dart';
import '../models/session.dart';
import 'auth_service.dart';

class CoursesService {
  final Dio _dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.getBaseUrl(),
      connectTimeout: Duration(milliseconds: ApiConfig.connectTimeout),
      receiveTimeout: Duration(milliseconds: ApiConfig.receiveTimeout),
    ),
  );
  final AuthService _authService;

  CoursesService(this._authService) {
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

  /// Get all courses for the authenticated student
  Future<List<Course>> getCourses() async {
    try {
      final response = await _dio.get(ApiConfig.studentCourses);
      final courses = (response.data as List)
          .map((json) => Course.fromJson(json))
          .toList();

      // Fetch attendance data to compute course attendance
      final userId = await _authService.getCurrentUserId();
      if (userId != null) {
        try {
          final attendanceResponse = await _dio.get(ApiConfig.studentAttendance.replaceFirst('{studentId}', userId.toString()));
          final data = attendanceResponse.data as Map<String, dynamic>;
          final history = data['history'] as List;

          // Group attendance by course
          final courseAttendance = <int, Map<String, int>>{};
          for (var record in history) {
            final courseId = record['course_id'] as int;
            final status = record['status'] as String;
            courseAttendance.putIfAbsent(courseId, () => {'total': 0, 'present': 0});
            courseAttendance[courseId]!['total'] = courseAttendance[courseId]!['total']! + 1;
            if (status == 'present') {
              courseAttendance[courseId]!['present'] = courseAttendance[courseId]!['present']! + 1;
            }
          }

          // Update courses with attendance data
          for (var course in courses) {
            final attendance = courseAttendance[course.id];
            if (attendance != null) {
              course.totalSessions = attendance['total']!;
              course.attendedSessions = attendance['present']!;
            }
            // Set placeholder teacher name
            if (course.teacherId != null) {
              course.teacherName = "Teacher"; // TODO: Fetch actual teacher name
            }
          }
        } catch (e) {
          // If attendance fetch fails, continue with courses without attendance
          print('Failed to fetch attendance for courses: $e');
        }
      }

      return courses;
    } on DioException catch (e) {
      throw Exception('Failed to load courses: ${e.message}');
    }
  }

  /// Get details for a specific course
  Future<Course> getCourseById(int courseId) async {
    try {
      final response = await _dio.get('${ApiConfig.courseDetails.replaceFirst('{courseId}', courseId.toString())}');
      return Course.fromJson(response.data);
    } on DioException catch (e) {
      throw Exception('Failed to load course: ${e.message}');
    }
  }

  /// Get all sessions for a specific course
  Future<List<Session>> getCourseSessions(int courseId) async {
    try {
      final response = await _dio.get(ApiConfig.courseSessions.replaceFirst('{courseId}', courseId.toString()));
      final sessions = (response.data as List)
          .map((json) => Session.fromJson(json))
          .toList();

      // Fetch attendance data for this course
      final userId = await _authService.getCurrentUserId();
      if (userId != null) {
        try {
          final attendanceResponse = await _dio.get(ApiConfig.studentAttendance.replaceFirst('{studentId}', userId.toString()));
          final data = attendanceResponse.data as Map<String, dynamic>;
          final history = data['history'] as List;

          // Create map of session_id to attendance status
          final attendanceMap = <int, String>{};
          for (var record in history) {
            if (record['course_id'] == courseId) {
              attendanceMap[record['session_id'] as int] = record['status'] as String;
            }
          }

          // Sort sessions by started_at
          sessions.sort((a, b) => (a.startedAt ?? DateTime.now()).compareTo(b.startedAt ?? DateTime.now()));
    
          // Assign session names
          for (int i = 0; i < sessions.length; i++) {
            sessions[i] = Session(
              id: sessions[i].id,
              courseId: sessions[i].courseId,
              teacherId: sessions[i].teacherId,
              status: sessions[i].status,
              startedAt: sessions[i].startedAt,
              endedAt: sessions[i].endedAt,
              createdAt: sessions[i].createdAt,
              sessionName: 'Session ${i + 1}',
              attendanceStatus: sessions[i].attendanceStatus,
            );
          }
    
          // Update sessions with attendance status
          for (var session in sessions) {
            final status = attendanceMap[session.id];
            if (status != null) {
              session.attendanceStatus = status == 'present' ? AttendanceStatus.present : AttendanceStatus.absent;
            }
          }
        } catch (e) {
          // If attendance fetch fails, continue with sessions without attendance
          print('Failed to fetch attendance for sessions: $e');
        }
      }

      return sessions;
    } on DioException catch (e) {
      throw Exception('Failed to load sessions: ${e.message}');
    }
  }

}
