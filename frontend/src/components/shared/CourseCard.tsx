import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

interface CourseCardProps {
  id: string;
  name: string;
  code: string;
  year?: number;
  department?: string;
  onView: () => void;
}

export function CourseCard({ id, name, code, year, department, onView }: CourseCardProps) {
  const yearLabel = year ? `Year ${year}` : null;
  const deptLabel = department && department !== "General" ? department : null;

  return (
    <Card className="p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold mb-1 truncate">{name}</h3>
          <p className="text-sm text-muted-foreground">{code}</p>
          {(yearLabel || deptLabel) && (
            <p className="text-sm text-muted-foreground mb-4">
              {[yearLabel, deptLabel].filter(Boolean).join(" · ")}
            </p>
          )}
          {!yearLabel && !deptLabel && <div className="mb-4" />}
          <Button
            className="w-full rounded-xl"
            onClick={onView}
          >
            View Course
          </Button>
        </div>
      </div>
    </Card>
  );
}
