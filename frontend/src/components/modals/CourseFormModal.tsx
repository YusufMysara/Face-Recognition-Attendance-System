import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CourseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  course?: {
    id: number;
    name: string;
    description: string;
    teacher_id?: number;
  };
  teachers: { id: string; name: string }[];
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function CourseFormModal({
  open,
  onOpenChange,
  mode,
  course,
  teachers,
  onSubmit,
  loading = false,
}: CourseFormModalProps) {
  const [name, setName] = useState(course?.name || "");
  const [description, setDescription] = useState(course?.description || "");
  const [teacherId, setTeacherId] = useState(course?.teacher_id ? String(course.teacher_id) : "");

  // Reset form when modal opens or course changes
  useEffect(() => {
    if (open) {
      setName(course?.name || "");
      setDescription(course?.description || "");
      setTeacherId(course?.teacher_id ? String(course.teacher_id) : "");
    }
  }, [open, course]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      teacher_id: teacherId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Course" : "Edit Course"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Course Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-lg"
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Assigned Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId} disabled={loading}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers.map((teacher) => (
                  <SelectItem key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" className="rounded-lg" disabled={loading}>
              {loading ? "Saving..." : (mode === "create" ? "Create Course" : "Save Changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
