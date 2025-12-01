import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usersApi, handleApiError } from "@/lib/api";

interface Student {
  id: number;
  name: string;
  email: string;
  group?: string;
}

interface PhotoFile {
  file: File;
  preview: string;
}

export default function UploadPhotos() {
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load students on component mount
  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await usersApi.list();
      // Filter to only show students
      const studentsOnly = response.filter(user => user.role === "student");
      setStudents(studentsOnly);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedStudent) {
      toast.error("Please select a student first");
      return;
    }

    const files = e.target.files;
    if (files) {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const validFiles: PhotoFile[] = [];
      const invalidFiles: string[] = [];

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) {
          invalidFiles.push(`${file.name} is not an image file`);
        } else if (file.size > maxSize) {
          invalidFiles.push(`${file.name} exceeds 10MB limit`);
        } else {
          validFiles.push({
            file,
            preview: URL.createObjectURL(file)
          });
        }
      });

      if (invalidFiles.length > 0) {
        toast.error(`Invalid files: ${invalidFiles.join(', ')}`);
      }

      if (validFiles.length > 0) {
        setPhotos([...photos, ...validFiles]);
        toast.success(`Added ${validFiles.length} photo(s)`);
      }
    }
  };

  const removePhoto = (index: number) => {
    // Clean up the preview URL to prevent memory leaks
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!selectedStudent) {
      toast.error("Please select a student");
      return;
    }
    if (photos.length === 0) {
      toast.error("Please select photos to upload");
      return;
    }

    try {
      setUploading(true);
      const studentId = parseInt(selectedStudent);

      // Upload each photo
      for (const photo of photos) {
        await usersApi.uploadPhoto(studentId, photo.file);
      }

      toast.success(`${photos.length} photo(s) uploaded successfully and embeddings calculated`);

      // Clean up preview URLs
      photos.forEach(photo => URL.revokeObjectURL(photo.preview));

      // Reset form
      setPhotos([]);
      setSelectedStudent("");
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setUploading(false);
    }
  };

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      photos.forEach(photo => URL.revokeObjectURL(photo.preview));
    };
  }, [photos]);

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading students...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadStudents} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Upload Student Photos</h1>
        <p className="text-muted-foreground">Upload photos for face recognition training</p>
      </div>

      <Card className="p-6 rounded-xl shadow-md mb-6">
        <div className="space-y-2">
          <Label>Select Student</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={uploading}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Choose a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={String(student.id)}>
                  {student.name} ({student.email}) - Group {student.group || 'N/A'}
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
              disabled={!selectedStudent || uploading}
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
              disabled={photos.length === 0 || !selectedStudent || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {photos.length} Photo{photos.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </Card>

        <Card className="p-6 rounded-xl shadow-md">
          <h2 className="text-xl font-semibold mb-4">Image Previews</h2>
          {photos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No images selected</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 max-h-[500px] overflow-y-auto">
              {photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img
                    src={photo.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    disabled={uploading}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
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
