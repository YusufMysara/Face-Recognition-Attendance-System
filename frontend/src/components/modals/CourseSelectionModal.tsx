import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookOpen } from "lucide-react";

interface Course {
  id: string;
  name: string;
  code: string;
}

interface CourseSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Course[];
  onStart: (courseId: string, sessionName?: string) => void;
  loading?: boolean;
}

export function CourseSelectionModal({
  open,
  onOpenChange,
  courses,
  onStart,
  loading = false,
}: CourseSelectionModalProps) {
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("");

  const handleStart = () => {
    if (selectedCourse) {
      onStart(selectedCourse, sessionName || undefined);
      setSessionName("");
      setSelectedCourse("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Session</DialogTitle>
          <DialogDescription>
            Select a course and optionally name your session to begin attendance tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Course</Label>
            <RadioGroup value={selectedCourse} onValueChange={setSelectedCourse}>
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No courses available
                </p>
              ) : (
                courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => setSelectedCourse(course.id)}
                  >
                    <RadioGroupItem value={course.id} id={course.id} />
                    <Label
                      htmlFor={course.id}
                      className="flex items-center gap-2 flex-1 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-primary" />
                      <div>
                        <p className="font-medium">{course.name}</p>
                        <p className="text-xs text-muted-foreground">{course.code}</p>
                      </div>
                    </Label>
                  </div>
                ))
              )}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-name">Session Name (Optional)</Label>
            <Input
              id="session-name"
              placeholder="e.g., Week 5 Lecture"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            disabled={!selectedCourse || loading}
            className="rounded-xl"
          >
            {loading ? "Starting..." : "Start Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
