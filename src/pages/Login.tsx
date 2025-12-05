import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Chrome, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

const Login = () => {
  const navigate = useNavigate();
  const { user, signInWithEmail, signUpWithEmail, signInWithGoogle, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { error } = await signInWithEmail(email, password);
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Неверный email или пароль");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Успешный вход!");
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (password.length < 6) {
        toast.error("Пароль должен содержать минимум 6 символов");
        setLoading(false);
        return;
      }

      const { error } = await signUpWithEmail(email, password);
      
      if (error) {
        if (error.message.includes("already registered")) {
          toast.error("Этот email уже зарегистрирован");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Регистрация успешна! Проверьте почту для подтверждения.");
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка при регистрации");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || "Ошибка входа через Google");
      }
    } catch (error: any) {
      toast.error(error.message || "Ошибка входа через Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      
      <Card className="w-full max-w-md glass border-border/50 shadow-2xl animate-scale-in">
        <div className="p-8 space-y-8">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 glow-sm">
              <img 
                src={logo} 
                alt="MCC Manager" 
                className="h-10 w-10"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                MCC Manager
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Управление Google Ads аккаунтами
              </p>
            </div>
          </div>

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 gap-3 text-base font-medium hover:bg-secondary/80 hover:border-primary/50 transition-all"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || isLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Chrome className="h-5 w-5" />
            )}
            Войти через Google
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">
                или по email
              </span>
            </div>
          </div>

          {/* Email/Password Tabs */}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-11 bg-secondary/50">
              <TabsTrigger value="signin" className="text-sm font-medium">
                Вход
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-sm font-medium">
                Регистрация
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10"
                      required
                      disabled={loading || isLoading}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-sm font-medium">
                    Пароль
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-10"
                      required
                      disabled={loading || isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 gap-2 font-medium"
                  disabled={loading || isLoading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Войти
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="text-sm font-medium">
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 pl-10"
                      required
                      disabled={loading || isLoading}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium">
                    Пароль
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 pl-10"
                      required
                      disabled={loading || isLoading}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Минимум 6 символов
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 gap-2 font-medium"
                  disabled={loading || isLoading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Создать аккаунт
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                
                <p className="text-xs text-center text-muted-foreground">
                  Новым пользователям назначается роль "Клиент"
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
};

export default Login;
