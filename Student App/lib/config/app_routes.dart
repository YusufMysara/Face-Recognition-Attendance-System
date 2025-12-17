import 'package:flutter/material.dart';
import '../views/login/login_page.dart';
import '../views/splash/splash_page.dart';
import '../views/main_layout.dart';
import '../views/course_details/course_details_page.dart';
import '../models/course.dart';

class AppRoutes {
  static const String splash = '/';
  static const String login = '/login';
  static const String main = '/main';
  static const String courseDetails = '/course-details';

  static Route<dynamic> generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case splash:
        return MaterialPageRoute(
          builder: (_) => const SplashPage(),
        );
      case login:
        return MaterialPageRoute(
          builder: (_) => const LoginPage(),
        );
      case main:
        return MaterialPageRoute(
          builder: (_) => const MainLayout(),
        );
      case courseDetails:
        final course = settings.arguments as Course;
        return MaterialPageRoute(
          builder: (_) => CourseDetailsPage(course: course),
        );
      default:
        return MaterialPageRoute(
          builder: (_) => Scaffold(
            body: Center(
              child: Text('No route defined for ${settings.name}'),
            ),
          ),
        );
    }
  }
}
