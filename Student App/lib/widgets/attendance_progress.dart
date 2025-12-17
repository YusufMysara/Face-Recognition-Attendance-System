import 'package:flutter/material.dart';
import '../config/app_theme.dart';

class AttendanceProgress extends StatelessWidget {
  final double percentage;
  final double size;
  final double strokeWidth;
  final bool showLabel;

  const AttendanceProgress({
    super.key,
    required this.percentage,
    this.size = 80,
    this.strokeWidth = 8,
    this.showLabel = true,
  });

  Color get progressColor {
    if (percentage >= 75) return AppTheme.presentColor;
    if (percentage >= 50) return AppTheme.warningColor;
    return AppTheme.absentColor;
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Background circle
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: 1,
              strokeWidth: strokeWidth,
              backgroundColor: Colors.transparent,
              valueColor: AlwaysStoppedAnimation<Color>(
                AppTheme.borderColor,
              ),
            ),
          ),
          // Progress circle
          SizedBox(
            width: size,
            height: size,
            child: CircularProgressIndicator(
              value: percentage / 100,
              strokeWidth: strokeWidth,
              backgroundColor: Colors.transparent,
              valueColor: AlwaysStoppedAnimation<Color>(progressColor),
              strokeCap: StrokeCap.round,
            ),
          ),
          // Percentage text
          if (showLabel)
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${percentage.toStringAsFixed(0)}%',
                  style: TextStyle(
                    fontSize: size * 0.2,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }
}
