class Course {
  final int id;
  final String name;
  final String? description;
  final int? teacherId;
  final DateTime? createdAt;
  final DateTime? updatedAt;
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
    this.createdAt,
    this.updatedAt,
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
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : null,
      updatedAt: json['updated_at'] != null ? DateTime.parse(json['updated_at']) : null,
      schedule: json['schedule'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'teacher_id': teacherId,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'schedule': schedule,
    };
  }
}
