import { Bell, Menu, User, LogOut, LayoutDashboard, Server, ArrowRightLeft, Settings, Users, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
      loadUserRole();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) setProfile(data);
  };

  const loadUserRole = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    if (data) setUserRole(data.role);
  };

  const navItems = [
    { label: "Панель", icon: LayoutDashboard, path: "/dashboard" },
    { label: "MCC", icon: Server, path: "/accounts" },
    { label: "Google Ads", icon: Building2, path: "/google-ads" },
    { label: "Перенос", icon: ArrowRightLeft, path: "/transfer" },
    { label: "Менеджеры", icon: Users, path: "/managers" },
    { label: "Настройки", icon: Settings, path: "/settings" },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Вы успешно вышли из системы");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.message || "Ошибка при выходе");
    }
  };

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  const getRoleBadge = () => {
    switch (userRole) {
      case 'admin':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Admin</span>;
      case 'manager':
        return <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Manager</span>;
      default:
        return <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">Client</span>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                <img src={logo} alt="MCC Manager" className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-semibold hidden sm:block">
                MCC Manager
              </h2>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "gap-2 h-9 px-4 font-medium",
                      isActive 
                        ? "bg-primary/10 text-primary hover:bg-primary/15" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-primary rounded-full" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 h-9 pl-2 pr-3">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
                      {profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-popover border-border/50">
                  <div className="px-3 py-2 border-b border-border/50">
                    <p className="text-sm font-medium truncate">
                      {profile?.full_name || user?.user_metadata?.full_name || 'Пользователь'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                    <div className="mt-2">
                      {getRoleBadge()}
                    </div>
                  </div>
                  <DropdownMenuItem 
                    onClick={() => navigate("/profile")} 
                    className="cursor-pointer gap-2 py-2"
                  >
                    <User className="h-4 w-4" />
                    Профиль
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => navigate("/settings")} 
                    className="cursor-pointer gap-2 py-2"
                  >
                    <Settings className="h-4 w-4" />
                    Настройки
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <DropdownMenuItem 
                    onClick={handleLogout} 
                    className="text-destructive cursor-pointer gap-2 py-2 focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Выход
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-9 w-9"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
            <nav className="container mx-auto px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Button
                    key={item.path}
                    variant="ghost"
                    onClick={() => {
                      navigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full justify-start gap-3 h-11 font-medium",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
