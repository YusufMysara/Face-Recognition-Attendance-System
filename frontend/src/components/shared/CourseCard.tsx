import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

interface CourseCardProps {
  id: string;
  name: string;
  code: string;
  onView: (id: string) => void;
}

export function CourseCard({ id, name, code, onView }: CourseCardProps) {
  return (
    <Card className="p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold mb-1 truncate">{name}</h3>
          <p className="text-sm text-muted-foreground mb-4">{code}</p>
          <Button
            className="w-full rounded-xl"
            onClick={() => onView(id)}
          >
            View Course
          </Button>
        </div>
      </div>
    </Card>
  );
}
