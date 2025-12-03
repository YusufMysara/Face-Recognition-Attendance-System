import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserFormModal } from "@/components/modals/UserFormModal";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";
import { usersApi, handleApiError } from "@/lib/api";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  group?: string;
  photo_path?: string;
}

export default function ManageUsers() {
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
        const payload = {
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role.toLowerCase(),
          ...(data.role === "student" && { group: data.group }),
        };
        const newUser = await usersApi.create(payload);

        // Upload photo for students after user creation (required for face recognition)
        if (data.role === "student") {
          if (!data.photo) {
            // Delete the user since photo is required
            await usersApi.delete(newUser.id);
            throw new Error("Photo is required for student users");
          }

          try {
            await usersApi.uploadPhoto(newUser.id, data.photo);
            toast.success("Student created and photo processed for face recognition");
            setUsers([...users, newUser]);
          } catch (photoErr) {
            // If photo upload fails, delete the user since face recognition setup failed
            try {
              await usersApi.delete(newUser.id);
            } catch (deleteErr) {
              console.error("Failed to delete user after photo upload failure:", deleteErr);
            }
            throw new Error("Failed to process student photo for face recognition. Student was not created. Please ensure the photo contains a clear face.");
          }
        } else {
          toast.success("User created successfully");
          setUsers([...users, newUser]);
        }
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
      accessor: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => handleEditUser(row)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(row)}>
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
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
        <Button onClick={handleCreateUser} className="rounded-xl">
          <Plus className="w-4 h-4 mr-2" />
          Create User
        </Button>
      </div>

      <DataTable data={users} columns={columns} searchPlaceholder="Search users..." />

      <UserFormModal
        open={userFormOpen}
        onOpenChange={setUserFormOpen}
        mode={formMode}
        user={selectedUser}
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
