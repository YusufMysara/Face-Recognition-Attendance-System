class AttendanceSummary {
  final int totalSessions;
  final int attendedSessions;
  final int missedSessions;

  AttendanceSummary({
    required this.totalSessions,
    required this.attendedSessions,
    required this.missedSessions,
  });

  double get attendancePercentage {
    if (totalSessions == 0) return 0;
    return (attendedSessions / totalSessions) * 100;
  }

}
