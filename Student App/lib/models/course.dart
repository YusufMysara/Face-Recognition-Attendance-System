class Course {
  final int id;
  final String name;
  final String? description;
  final int? teacherId;
  final String? schedule;

  // These will be computed from attendance data
  int totalSessions = 0;
  int attendedSessions = 0;
  String? teacherName;

  Course({
    required this.id,
    required this.name,
    this.description,
    this.teacherId,
    this.schedule,
  });

  double get attendancePercentage {
    if (totalSessions == 0) return 0;
    return (attendedSessions / totalSessions) * 100;
  }

  int get missedSessions => totalSessions - attendedSessions;

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: json['id'] as int,
      name: json['name'] as String,
      description: json['description'] as String?,
      teacherId: json['teacher_id'] as int?,
      schedule: json['schedule'] as String?,
    );
  }
}
