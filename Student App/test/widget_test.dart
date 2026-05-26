// Basic smoke test — verifies the app builds and the entry point exists.
// Full integration tests require mocked Riverpod providers and a network stub.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:attendify/main.dart';

void main() {
  testWidgets('App starts without throwing', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: StudentAttendanceApp()),
    );
    // The splash screen should be visible immediately.
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
