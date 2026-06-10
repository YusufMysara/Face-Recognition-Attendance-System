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

const DEPARTMENTS_YEAR_3_4 = [
  "Software Engineering",
  "Cyber Security",
  "Computer Science",
  "Data Science",
  "Artificial Intelligence",
];

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
    year?: number;
    department?: string;
  };
  currentUser?: {
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
  currentUser,
  onSubmit,
  loading = false,
}: UserFormModalProps) {
  const [role, setRole] = useState(user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Student");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [group, setGroup] = useState(user?.group || "");
  const [password, setPassword] = useState("");
  const [year, setYear] = useState<string>(user?.year ? String(user.year) : "");
  const [department, setDepartment] = useState(user?.department || "");

  const isSuperAdmin = user?.email === "admin@example.com" || user?.name === "Super Admin";
  const isCurrentUserSuperAdmin = currentUser?.email === "admin@example.com" || currentUser?.name === "Super Admin";
  const isEditingAdmin = user?.role === "admin";
  const isEditingOwnAccount = user?.id === currentUser?.id;
  const canEditSuperAdminFields = mode === "edit" && isSuperAdmin && isCurrentUserSuperAdmin;
  const canEditAdminFields = mode === "edit" && (isCurrentUserSuperAdmin || isEditingOwnAccount || !isEditingAdmin);
  const canEditAdminPassword = mode === "edit" && (isCurrentUserSuperAdmin || isEditingOwnAccount || !isEditingAdmin);

  const yearNum = parseInt(year);
  const isLowYear = yearNum === 1 || yearNum === 2;

  // Auto-lock department to "General" for years 1 and 2
  useEffect(() => {
    if (isLowYear) {
      setDepartment("General");
    } else if (yearNum === 3 || yearNum === 4) {
      // Only clear if currently "General" (switching from low year)
      setDepartment((prev) => (prev === "General" ? "" : prev));
    }
  }, [year]);

  // Reset form when modal opens or user changes
  useEffect(() => {
    if (open) {
      setName(user?.name || "");
      setEmail(user?.email || "");
      setRole(user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Student");
      setGroup(user?.group || "");
      setPassword("");
      setYear(user?.year ? String(user.year) : "");
      setDepartment(user?.department || "");
    }
  }, [open, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData: any = {
      name,
      email,
      role: role.toLowerCase(),
      ...(password && { password }),
    };

    if (role === "Student") {
      formData.group = group;
      formData.year = yearNum;
      formData.department = department;
    }

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
                {isCurrentUserSuperAdmin && <SelectItem value="Admin">Admin</SelectItem>}
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
              disabled={loading || (isEditingAdmin && !canEditAdminFields) || (isSuperAdmin && !canEditSuperAdminFields)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg"
              required
              disabled={loading || (isEditingAdmin && !canEditAdminFields) || (isSuperAdmin && !canEditSuperAdminFields)}
            />
          </div>

          {role === "Student" && (
            <>
              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear} disabled={loading}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Year 1</SelectItem>
                    <SelectItem value="2">Year 2</SelectItem>
                    <SelectItem value="3">Year 3</SelectItem>
                    <SelectItem value="4">Year 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                {isLowYear ? (
                  <Input value="General" className="rounded-lg" disabled />
                ) : (
                  <Select value={department} onValueChange={setDepartment} disabled={loading || !year}>
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder={year ? "Select department" : "Select year first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS_YEAR_3_4.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

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
            </>
          )}

          {(mode === "create" || (mode === "edit" && canEditAdminPassword)) && !(isSuperAdmin && !canEditSuperAdminFields) && (
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
                required={mode === "create" && role === "Admin"}
                disabled={loading}
              />
            </div>
          )}

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
