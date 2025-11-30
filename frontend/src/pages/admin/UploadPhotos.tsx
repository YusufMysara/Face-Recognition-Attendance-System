import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Student {
  id: string;
  name: string;
  email: string;
  group: string;
}

export default function UploadPhotos() {
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [previews, setPreviews] = useState<string[]>([]);

  // Mock data - replace with API call
  const students: Student[] = [
    { id: "1", name: "John Doe", email: "john@example.com", group: "A" },
    { id: "3", name: "Bob Johnson", email: "bob@example.com", group: "B" },
    { id: "5", name: "Alice Williams", email: "alice@example.com", group: "A" },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedStudent) {
      toast.error("Please select a student first");
      return;
    }

    const files = e.target.files;
    if (files) {
      const newPreviews = Array.from(files).map((file) => URL.createObjectURL(file));
      setPreviews([...previews, ...newPreviews]);
    }
  };

  const removePreview = (index: number) => {
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (!selectedStudent) {
      toast.error("Please select a student");
      return;
    }
    if (previews.length === 0) {
      toast.error("Please select photos to upload");
      return;
    }

    // API call to upload photos would go here
    toast.success(`${previews.length} photo(s) uploaded successfully`);
    setPreviews([]);
    setSelectedStudent("");
  };

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Upload Student Photos</h1>
        <p className="text-muted-foreground">Upload photos for face recognition training</p>
      </div>

      <Card className="p-6 rounded-xl shadow-md mb-6">
        <div className="space-y-2">
          <Label>Select Student</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Choose a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name} ({student.email}) - Group {student.group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-8 rounded-xl shadow-md">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
              selectedStudent
                ? "border-border hover:border-primary"
                : "border-muted-foreground/30 cursor-not-allowed"
            }`}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              disabled={!selectedStudent}
            />
            <label
              htmlFor="file-upload"
              className={selectedStudent ? "cursor-pointer" : "cursor-not-allowed"}
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {selectedStudent
                  ? "Drop files here or click to browse"
                  : "Select a student first"}
              </h3>
              <p className="text-sm text-muted-foreground">
                Supports: JPG, PNG, JPEG (Max 10MB each)
              </p>
            </label>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleUpload}
              className="w-full rounded-xl"
              size="lg"
              disabled={previews.length === 0 || !selectedStudent}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload {previews.length} Photo{previews.length !== 1 ? "s" : ""}
            </Button>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Image Previews</h2>
          {previews.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No images selected</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
              {previews.map((preview, index) => (
                <div key={index} className="relative group">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removePreview(index)}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
