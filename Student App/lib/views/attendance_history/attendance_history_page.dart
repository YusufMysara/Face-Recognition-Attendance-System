import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/attendance_provider.dart';
import '../../widgets/session_tile.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/error_view.dart';

class AttendanceHistoryPage extends ConsumerWidget {
  const AttendanceHistoryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(attendanceHistoryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(attendanceHistoryProvider);
        },
        child: historyAsync.when(
          data: (sessions) {
            if (sessions.isEmpty) {
              return const EmptyStateView(
                title: 'No History',
                message: 'Your attendance history will appear here.',
                icon: Icons.history,
              );
            }

            // Group sessions by date
            final groupedSessions = <String, List<dynamic>>{};
            for (final session in sessions) {
              if (session.dateTime != null) {
                final dateKey = _formatDateKey(session.dateTime!);
                if (!groupedSessions.containsKey(dateKey)) {
                  groupedSessions[dateKey] = [];
                }
                groupedSessions[dateKey]!.add(session);
              }
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: groupedSessions.length,
              itemBuilder: (context, index) {
                final dateKey = groupedSessions.keys.elementAt(index);
                final dateSessions = groupedSessions[dateKey]!;

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12, top: 8),
                      child: Text(
                        dateKey,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                      ),
                    ),
                    ...dateSessions.map((session) => SessionTile(
                          session: session,
                          showCourseName: true,
                        )),
                    const SizedBox(height: 8),
                  ],
                );
              },
            );
          },
          loading: () =>
              const LoadingIndicator(message: 'Loading history...'),
          error: (error, _) => ErrorView(
            message: error.toString(),
            onRetry: () => ref.invalidate(attendanceHistoryProvider),
          ),
        ),
      ),
    );
  }

  String _formatDateKey(DateTime date) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final dateOnly = DateTime(date.year, date.month, date.day);

    if (dateOnly == today) {
      return 'Today';
    } else if (dateOnly == yesterday) {
      return 'Yesterday';
    } else {
      final months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return '${months[date.month - 1]} ${date.day}, ${date.year}';
    }
  }
}
