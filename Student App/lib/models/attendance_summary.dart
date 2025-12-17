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

  factory AttendanceSummary.fromJson(Map<String, dynamic> json) {
    return AttendanceSummary(
      totalSessions: json['total_sessions'] as int,
      attendedSessions: json['attended_sessions'] as int,
      missedSessions: json['missed_sessions'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total_sessions': totalSessions,
      'attended_sessions': attendedSessions,
      'missed_sessions': missedSessions,
    };
  }
}
