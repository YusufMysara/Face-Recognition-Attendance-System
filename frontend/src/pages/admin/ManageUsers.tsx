import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Upload, FileSpreadsheet, Loader2, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserFormModal } from "@/components/modals/UserFormModal";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { usersApi, handleApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  group?: string;
  photo_path?: string;
}

export default function ManageUsers() {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filteredUsers = roleFilter === "all" ? users : users.filter(user => user.role === roleFilter);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Check for create query parameter on mount
  useEffect(() => {
    const createParam = searchParams.get('create');
    if (createParam === 'true') {
      handleCreateUser();
      // Clear the query parameter from URL
      setSearchParams({});
    }
  }, [searchParams]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await usersApi.list();
      setUsers(response);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setFormMode("create");
    setSelectedUser(undefined);
    setUserFormOpen(true);
  };

  const handleBulkUploadClick = () => {
    console.log("Bulk upload button clicked");
    setBulkUploadOpen(true);
    console.log("bulkUploadOpen set to:", true);
  };

  const handleEditUser = (user: User) => {
    setFormMode("edit");
    setSelectedUser(user);
    setUserFormOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      await usersApi.delete(userToDelete.id);
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      toast.success("User deleted successfully");
      setDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err) {
      toast.error(handleApiError(err));
    }
  };

  const handleFormSubmit = async (data: any) => {
    try {
      setFormLoading(true);

      if (formMode === "create") {
        const payload: any = {
          name: data.name,
          email: data.email,
          role: data.role.toLowerCase(),
          ...(data.role === "student" && { group: data.group }),
        };
        // Only include password if it's provided
        if (data.password) {
          payload.password = data.password;
        }
        const newUser = await usersApi.create(payload);
        toast.success("User created successfully");
        setUsers([...users, newUser]);
      } else if (selectedUser) {
        const payload: any = {};
        if (data.name !== selectedUser.name) payload.name = data.name;
        if (data.email !== selectedUser.email) payload.email = data.email;
        if (data.group !== selectedUser.group) payload.group = data.group;
        if (data.role !== selectedUser.role) payload.role = data.role;
        if (data.password) payload.password = data.password;

        if (Object.keys(payload).length > 0) {
          const updatedUser = await usersApi.update(selectedUser.id, payload);
          setUsers(users.map((u) => (u.id === selectedUser.id ? updatedUser : u)));
        }
        toast.success("User updated successfully");
      }
      setUserFormOpen(false);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setFormLoading(false);
    }
  };

  const handleBulkUpload = async (file: File) => {
    try {
      setBulkUploading(true);
      const result = await usersApi.bulkUpload(file);
      toast.success(`Successfully uploaded ${result.created_count} users`);
      // Reload users to show the new ones
      loadUsers();
      setBulkUploadOpen(false);
    } catch (err) {
      toast.error(handleApiError(err));
    } finally {
      setBulkUploading(false);
    }
  };

  const columns: Column<User>[] = [
    { header: "Name", accessor: "name" },
    { header: "Email", accessor: "email" },
    {
      header: "Role",
      accessor: (row) => (
        <Badge variant={row.role === "admin" ? "default" : "secondary"}>
          {row.role.charAt(0).toUpperCase() + row.role.slice(1)}
        </Badge>
      ),
    },
    {
      header: "Actions",
      accessor: (row) => {
        const isSuperAdmin = row.email === "admin@example.com" || row.name === "Super Admin";
        const isCurrentUserSuperAdmin = currentUser?.email === "admin@example.com" || currentUser?.name === "Super Admin";
        const isEditingAdmin = row.role === "admin";
        const isOwnAccount = row.id === currentUser?.id;

        // Show delete button logic:
        // - Super Admin: can delete anyone (except Super Admin, but that's handled by backend)
        // - Regular admin: can delete students and teachers, but not other admins and not themselves
        const canDelete = isCurrentUserSuperAdmin ||
                          (!isEditingAdmin && !isOwnAccount && !isSuperAdmin);

        return (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => handleEditUser(row)}>
              <Pencil className="w-4 h-4" />
            </Button>
            {canDelete && (
              <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(row)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div className="content-container">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading users...</p>
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
            <Button onClick={loadUsers} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Manage Users</h1>
          <p className="text-muted-foreground">Create and manage user accounts</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleBulkUploadClick} variant="outline" className="rounded-xl">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>
          <Button onClick={handleCreateUser} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
      </div>

      <DataTable
        data={filteredUsers}
        columns={columns}
        searchPlaceholder="Search users..."
        filterComponent={
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="teacher">Teachers</SelectItem>
              <SelectItem value="student">Students</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Dialog open={bulkUploadOpen} onOpenChange={setBulkUploadOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Bulk Upload Users</DialogTitle>
            <DialogDescription>
              Upload an Excel file to create multiple users at once.
              <br />
              <strong>Required columns:</strong> name, email, role
              <br />
              <strong>Optional column:</strong> group (for students)
              <br />
              <strong>Note:</strong> Only Super Admin can create admin users via bulk upload.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="excel-file" className="text-right">
                Excel File
              </label>
              <input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                className="col-span-3"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleBulkUpload(file);
                  }
                }}
                disabled={bulkUploading}
              />
            </div>
            {bulkUploading && (
              <div className="flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Uploading and processing...
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkUploadOpen(false)}
              disabled={bulkUploading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserFormModal
        open={userFormOpen}
        onOpenChange={setUserFormOpen}
        mode={formMode}
        user={selectedUser}
        currentUser={currentUser}
        onSubmit={handleFormSubmit}
        loading={formLoading}
      />

      <ConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
      />
    </div>
  );
}
