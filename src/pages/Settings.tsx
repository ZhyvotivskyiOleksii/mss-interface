import { useState, useEffect } from "react";
import { ArrowLeft, Save, User, Bell, Shield, Palette, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [fullName, setFullName] = useState("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      
      toast.success("Настройки сохранены");
    } catch (error: any) {
      toast.error("Ошибка сохранения: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const userInitials = fullName
    ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

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
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Настройки</h1>
            <p className="text-muted-foreground text-sm">
              Управление профилем и предпочтениями
            </p>
          </div>
        </div>

        {/* Profile Section */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Профиль</CardTitle>
                <CardDescription>Ваша личная информация</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{fullName || 'Не указано'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fullName">Полное имя</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Введите ваше имя"
                className="h-11 "
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user?.email || ''}
                disabled
                className="h-11 bg-secondary/50 border-border/50"
              />
              <p className="text-xs text-muted-foreground">
                Email нельзя изменить
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Bell className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">Уведомления</CardTitle>
                <CardDescription>Настройки оповещений</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
              <div>
                <p className="font-medium text-sm">Email уведомления</p>
                <p className="text-xs text-muted-foreground">
                  Получать уведомления на почту
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
              <div>
                <p className="font-medium text-sm">Push уведомления</p>
                <p className="text-xs text-muted-foreground">
                  Уведомления в браузере
                </p>
              </div>
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Shield className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <CardTitle className="text-base">Безопасность</CardTitle>
                <CardDescription>Настройки безопасности аккаунта</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
              <p className="font-medium text-sm">Способ входа</p>
              <p className="text-xs text-muted-foreground mt-1">
                {user?.app_metadata?.provider === 'google' 
                  ? 'Google OAuth' 
                  : 'Email и пароль'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Сохранение..." : "Сохранить изменения"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
