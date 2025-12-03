import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Student {
  id: string;
  name: string;
  email: string;
  group: string;
}

interface AddStudentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableStudents: Student[];
  onSubmit: (studentIds: string[]) => void;
  loading?: boolean;
}

export function AddStudentsModal({
  open,
  onOpenChange,
  availableStudents,
  onSubmit,
  loading = false,
}: AddStudentsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);

  const filteredStudents = availableStudents.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSubmit = () => {
    onSubmit(selectedStudents);
    setSelectedStudents([]);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Students to Course</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search Students</Label>
            <Input
              id="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or group"
              className="rounded-lg"
            />
          </div>

          <ScrollArea className="h-[400px] rounded-lg border p-4">
            {filteredStudents.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No students found
              </p>
            ) : (
              <div className="space-y-3">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Checkbox
                      checked={selectedStudents.includes(student.id)}
                      onCheckedChange={() => handleToggleStudent(student.id)}
                      disabled={loading}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{student.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {student.email} • Group {student.group}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <p className="text-sm text-muted-foreground">
            {selectedStudents.length} student(s) selected
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedStudents.length === 0 || loading}
            className="rounded-lg"
          >
            {loading ? "Adding..." : "Add Students"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
