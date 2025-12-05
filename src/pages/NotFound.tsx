import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 animate-scale-in">
        <div className="space-y-2">
          <h1 className="text-8xl font-bold text-primary">404</h1>
          <p className="text-xl text-muted-foreground">
            Страница не найдена
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Запрашиваемая страница не существует или была перемещена
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => navigate(-1)}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>
          <Button 
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            На главную
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
