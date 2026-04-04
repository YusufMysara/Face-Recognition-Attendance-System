import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/app_routes.dart';
import '../../config/app_theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/attendance_provider.dart';
import '../../providers/courses_provider.dart';
import '../../services/attendance_service.dart';
import '../../widgets/stat_card.dart';
import '../../widgets/course_card.dart';
import '../../widgets/attendance_progress.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/error_view.dart';

class DashboardPage extends ConsumerWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final summaryAsync = ref.watch(attendanceSummaryProvider);
    final coursesAsync = ref.watch(coursesProvider);
    final notificationsAsync = ref.watch(notificationsProvider);

    // Extract the warning list (empty list while loading / on error)
    final notifications = notificationsAsync.valueOrNull ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Dashboard'),
            if (authState.user != null)
              Text(
                authState.user!.name,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.textMuted,
                    ),
              ),
          ],
        ),
        actions: [
          // Notification bell with badge
          Badge(
            isLabelVisible: notifications.isNotEmpty,
            label: Text(
              '${notifications.length}',
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
            ),
            backgroundColor: Colors.red,
            child: IconButton(
              icon: const Icon(Icons.notifications_outlined),
              tooltip: 'Attendance Warnings',
              onPressed: () => _showNotificationsSheet(context, notifications),
            ),
          ),
          const SizedBox(width: 4),
          IconButton(
            icon: const Icon(Icons.logout_outlined),
            onPressed: () async {
              await ref.read(authStateProvider.notifier).logout();
              if (context.mounted) {
                Navigator.of(context).pushReplacementNamed(AppRoutes.login);
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(attendanceSummaryProvider);
          ref.invalidate(coursesProvider);
          ref.invalidate(notificationsProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Overall attendance progress
              summaryAsync.when(
                data: (summary) => Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppTheme.primaryColor,
                        AppTheme.primaryLight,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primaryColor.withOpacity(0.3),
                        blurRadius: 20,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(50),
                        ),
                        child: AttendanceProgress(
                          percentage: summary.attendancePercentage,
                          size: 90,
                          strokeWidth: 8,
                        ),
                      ),
                      const SizedBox(width: 24),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Overall Attendance',
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${summary.attendancePercentage.toStringAsFixed(1)}%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '${summary.attendedSessions} of ${summary.totalSessions} sessions',
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                loading: () => const SizedBox(
                  height: 140,
                  child: LoadingIndicator(),
                ),
                error: (error, _) => ErrorView(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(attendanceSummaryProvider),
                ),
              ),
              const SizedBox(height: 24),

              // Attendance summary cards
              summaryAsync.when(
                data: (summary) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: _SummaryItem(
                          label: 'Total',
                          value: '${summary.totalSessions}',
                          icon: Icons.calendar_month_outlined,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _SummaryItem(
                          label: 'Attended',
                          value: '${summary.attendedSessions}',
                          icon: Icons.check_circle_outline,
                          color: AppTheme.presentColor,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _SummaryItem(
                          label: 'Missed',
                          value: '${summary.missedSessions}',
                          icon: Icons.cancel_outlined,
                          color: AppTheme.absentColor,
                        ),
                      ),
                    ],
                  ),
                ),
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
              const SizedBox(height: 28),

              // Courses section
              Text(
                'My Courses',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),

              // Courses list
              coursesAsync.when(
                data: (courses) => ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: courses.length > 3 ? 3 : courses.length,
                  itemBuilder: (context, index) {
                    final course = courses[index];
                    return CourseCard(
                      course: course,
                      onTap: () {
                        Navigator.of(context).pushNamed(
                          AppRoutes.courseDetails,
                          arguments: course,
                        );
                      },
                    );
                  },
                ),
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: LoadingIndicator(message: 'Loading courses...'),
                ),
                error: (error, _) => ErrorView(
                  message: error.toString(),
                  onRetry: () => ref.invalidate(coursesProvider),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Shows a bottom sheet listing all low-attendance warnings.
  void _showNotificationsSheet(
    BuildContext context,
    List<AttendanceNotification> notifications,
  ) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle bar
              Center(
                child: Container(
                  margin: const EdgeInsets.only(top: 12),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Text(
                  notifications.isEmpty
                      ? 'Notifications'
                      : '⚠️  ${notifications.length} Low-Attendance Warning${notifications.length > 1 ? 's' : ''}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const Divider(height: 1),
              if (notifications.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32, horizontal: 20),
                  child: Center(
                    child: Text(
                      '✅  All courses above 75% attendance',
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: notifications.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (_, i) {
                    final n = notifications[i];
                    return ListTile(
                      leading: const Icon(
                        Icons.warning_amber_rounded,
                        color: Colors.red,
                      ),
                      title: Text(
                        n.courseName,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      subtitle: Text(
                        'Attendance: ${n.attendancePercentage.toStringAsFixed(1)}%  —  below 75% threshold',
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    );
                  },
                ),
              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }
}

class _SummaryItem extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _SummaryItem({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondary,
                ),
          ),
        ],
      ),
    );
  }
}
