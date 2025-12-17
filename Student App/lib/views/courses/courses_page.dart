import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../config/app_routes.dart';
import '../../providers/courses_provider.dart';
import '../../widgets/course_card.dart';
import '../../widgets/loading_indicator.dart';
import '../../widgets/error_view.dart';

class CoursesPage extends ConsumerWidget {
  const CoursesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(coursesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Courses'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(coursesProvider);
        },
        child: coursesAsync.when(
          data: (courses) {
            if (courses.isEmpty) {
              return const EmptyStateView(
                title: 'No Courses',
                message: 'You are not enrolled in any courses yet.',
                icon: Icons.school_outlined,
              );
            }

            return ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: courses.length,
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
            );
          },
          loading: () => const LoadingIndicator(message: 'Loading courses...'),
          error: (error, _) => ErrorView(
            message: error.toString(),
            onRetry: () => ref.invalidate(coursesProvider),
          ),
        ),
      ),
    );
  }
}
