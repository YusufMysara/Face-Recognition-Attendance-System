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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;
    group?: string;
  };
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export function UserFormModal({
  open,
  onOpenChange,
  mode,
  user,
  onSubmit,
  loading = false,
}: UserFormModalProps) {
  const [role, setRole] = useState(user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Student");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [group, setGroup] = useState(user?.group || "");
  const [password, setPassword] = useState("");

  // Reset form when modal opens or user changes
  useEffect(() => {
    if (open) {
      setName(user?.name || "");
      setEmail(user?.email || "");
      setRole(user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Student");
      setGroup(user?.group || "");
      setPassword("");
    }
  }, [open, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData = {
      name,
      email,
      role: role.toLowerCase(),
      ...(role === "Student" && { group }),
      ...(password && { password }),
    };
    onSubmit(formData);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create User" : "Edit User"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} disabled={mode === "edit" || loading}>
              <SelectTrigger className="rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Teacher">Teacher</SelectItem>
                <SelectItem value="Student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg"
              required
              disabled={loading}
            />
          </div>

          {role === "Student" && mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="group">Group</Label>
              <Input
                id="group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="rounded-lg"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {mode === "create" ? "Password" : "New Password (leave empty to keep current)"}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg"
              required={mode === "create"}
              disabled={loading}
            />
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
              {loading ? "Saving..." : (mode === "create" ? "Create User" : "Save Changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
