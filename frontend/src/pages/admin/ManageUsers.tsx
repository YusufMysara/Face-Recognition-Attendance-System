import { useState } from "react";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserFormModal } from "@/components/modals/UserFormModal";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  group?: string;
}

export default function ManageUsers() {
  const [users, setUsers] = useState<User[]>([
    { id: "1", name: "John Doe", email: "john@example.com", role: "Student", group: "A" },
    { id: "2", name: "Jane Smith", email: "jane@example.com", role: "Teacher" },
    { id: "3", name: "Bob Johnson", email: "bob@example.com", role: "Student", group: "B" },
  ]);

  const [userFormOpen, setUserFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | undefined>();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

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

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      setUsers(users.filter((u) => u.id !== userToDelete.id));
      toast.success("User deleted successfully");
      setDeleteModalOpen(false);
      setUserToDelete(null);
    }
  };

  const handleFormSubmit = (data: any) => {
    if (formMode === "create") {
      const newUser: User = {
        id: String(users.length + 1),
        name: data.name,
        email: data.email,
        role: data.role,
        ...(data.role === "Student" && { group: data.group }),
      };
      setUsers([...users, newUser]);
      toast.success("User created successfully");
    } else if (selectedUser) {
      setUsers(
        users.map((u) =>
          u.id === selectedUser.id
            ? { ...u, name: data.name, email: data.email, ...(data.group && { group: data.group }) }
            : u
        )
      );
      toast.success("User updated successfully");
    }
    setUserFormOpen(false);
  };

  const columns: Column<User>[] = [
    { header: "Name", accessor: "name" },
    { header: "Email", accessor: "email" },
    {
      header: "Role",
      accessor: (row) => (
        <Badge variant={row.role === "Teacher" ? "default" : "secondary"}>
          {row.role}
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
