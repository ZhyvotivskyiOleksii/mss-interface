import { useState, useEffect } from "react";
import { Search, Plus, MoreVertical, Trash2, Edit, UserCheck, UserX, Loader2, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Manager {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface UserWithRole {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'manager' | 'client';
  created_at: string;
}

const Managers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [managers, setManagers] = useState<Manager[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [managerToDelete, setManagerToDelete] = useState<Manager | null>(null);
  
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load managers from managers table
      const { data: managersData } = await supabase
        .from('managers')
        .select('*')
        .order('created_at', { ascending: false });

      if (managersData) setManagers(managersData);

      // Load users with roles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*');

      if (profilesData) {
        const usersWithRoles: UserWithRole[] = [];
        
        for (const profile of profilesData) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', profile.id)
            .single();
          
          usersWithRoles.push({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: (roleData?.role as any) || 'client',
            created_at: profile.created_at
          });
        }
        
        setUsers(usersWithRoles);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddManager = async () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error("Заполните все поля");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('managers')
        .insert({ name: newName, email: newEmail });

      if (error) throw error;

      toast.success("Менеджер добавлен");
      setShowAddDialog(false);
      setNewName("");
      setNewEmail("");
      loadData();
    } catch (error: any) {
      toast.error("Ошибка: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditManager = async () => {
    if (!editingManager || !newName.trim() || !newEmail.trim()) {
      toast.error("Заполните все поля");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('managers')
        .update({ name: newName, email: newEmail })
        .eq('id', editingManager.id);

      if (error) throw error;

      toast.success("Менеджер обновлен");
      setShowEditDialog(false);
      setEditingManager(null);
      setNewName("");
      setNewEmail("");
      loadData();
    } catch (error: any) {
      toast.error("Ошибка: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteManager = async () => {
    if (!managerToDelete) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('managers')
        .delete()
        .eq('id', managerToDelete.id);

      if (error) throw error;
      
      toast.success("Менеджер удален");
      setManagers(managers.filter(m => m.id !== managerToDelete.id));
    } catch (error: any) {
      toast.error("Ошибка: " + error.message);
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setManagerToDelete(null);
    }
  };

  const handleChangeUserRole = async (userId: string, newRole: 'admin' | 'manager' | 'client') => {
    try {
      // First check if user has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existingRole) {
        const { error } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });
        
        if (error) throw error;
      }

      toast.success("Роль обновлена");
      loadData();
    } catch (error: any) {
      toast.error("Ошибка: " + error.message);
    }
  };

  const filteredManagers = managers.filter((manager) =>
    manager.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    manager.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Admin</Badge>;
      case 'manager':
        return <Badge className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">Manager</Badge>;
      default:
        return <Badge variant="secondary">Client</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Менеджеры</h1>
            <p className="text-muted-foreground mt-1">
              Управление менеджерами и правами доступа
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Добавить менеджера
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск менеджеров..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 "
          />
        </div>

        {/* Managers List */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold mb-4">Менеджеры Google Ads</h2>
            {filteredManagers.length === 0 ? (
              <Card className="glass border-border/50">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Нет менеджеров
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredManagers.map((manager) => (
                  <Card key={manager.id} className="glass border-border/50 hover:border-border transition-all">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-400">
                            {manager.name.charAt(0)}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold">{manager.name}</h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {manager.email}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-popover border-border/50">
                            <DropdownMenuItem 
                              onClick={() => {
                                setEditingManager(manager);
                                setNewName(manager.name);
                                setNewEmail(manager.email);
                                setShowEditDialog(true);
                              }}
                              className="gap-2 cursor-pointer"
                            >
                              <Edit className="h-4 w-4" />
                              Редактировать
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-border/50" />
                            <DropdownMenuItem 
                              onClick={() => {
                                setManagerToDelete(manager);
                                setShowDeleteConfirm(true);
                              }}
                              className="text-destructive gap-2 cursor-pointer focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Удалить
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* System Users */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Пользователи системы</h2>
            <div className="space-y-3">
              {users.map((user) => (
                <Card key={user.id} className="glass border-border/50 hover:border-border transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{user.full_name || 'Без имени'}</h3>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {getRoleBadge(user.role)}
                        
                        <Select
                          value={user.role}
                          onValueChange={(value: 'admin' | 'manager' | 'client') => 
                            handleChangeUserRole(user.id, value)
                          }
                        >
                          <SelectTrigger className="w-[130px] h-9 ">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-popover border-border/50">
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Manager Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Добавить менеджера</DialogTitle>
            <DialogDescription>
              Добавьте нового менеджера Google Ads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Введите имя"
                className="h-11 "
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 "
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={handleAddManager} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Добавление..." : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Manager Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Редактировать менеджера</DialogTitle>
            <DialogDescription>
              Измените данные менеджера
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Имя</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Введите имя"
                className="h-11 "
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="h-11 "
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={handleEditManager} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить менеджера?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить менеджера "{managerToDelete?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteManager}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Managers;

