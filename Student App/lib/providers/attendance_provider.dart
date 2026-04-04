import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/attendance_service.dart';
import '../services/auth_service.dart';
import '../models/session.dart';
import '../models/attendance_summary.dart';
import 'auth_provider.dart';

final attendanceServiceProvider = Provider<AttendanceService>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AttendanceService(authService);
});

final attendanceSummaryProvider = FutureProvider<AttendanceSummary>((ref) async {
  final attendanceService = ref.watch(attendanceServiceProvider);
  return attendanceService.getAttendanceSummary();
});

final attendanceHistoryProvider = FutureProvider<List<Session>>((ref) async {
  final attendanceService = ref.watch(attendanceServiceProvider);
  return attendanceService.getAttendanceHistory();
});

final notificationsProvider = FutureProvider<List<AttendanceNotification>>((ref) async {
  final attendanceService = ref.watch(attendanceServiceProvider);
  return attendanceService.getNotifications();
});
