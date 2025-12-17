import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/courses_service.dart';
import '../services/auth_service.dart';
import '../models/course.dart';
import '../models/session.dart';
import 'auth_provider.dart';

final coursesServiceProvider = Provider<CoursesService>((ref) {
  final authService = ref.watch(authServiceProvider);
  return CoursesService(authService);
});

final coursesProvider = FutureProvider<List<Course>>((ref) async {
  final coursesService = ref.watch(coursesServiceProvider);
  return coursesService.getCourses();
});

final courseSessionsProvider = FutureProvider.family<List<Session>, int>((ref, courseId) async {
  final coursesService = ref.watch(coursesServiceProvider);
  return coursesService.getCourseSessions(courseId);
});

final courseByIdProvider = FutureProvider.family<Course, int>((ref, courseId) async {
  final coursesService = ref.watch(coursesServiceProvider);
  return coursesService.getCourseById(courseId);
});
