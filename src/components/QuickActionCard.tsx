import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "secondary" | "outline";
}

const QuickActionCard = ({ 
  title, 
  description, 
  icon: Icon, 
  onClick,
  variant = "outline" 
}: QuickActionCardProps) => {
  return (
    <Card 
      className="cursor-pointer animate-fade-in border shadow-lg bg-gradient-to-br from-card to-violet-500/5 hover:shadow-xl hover:scale-105 transition-all" 
      onClick={onClick}
    >
      <CardHeader>
        <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 flex items-center justify-center mb-4 shadow-md">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-lg font-bold">{title}</CardTitle>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant={variant} className="w-full shadow-md hover:shadow-lg">
          Начать
        </Button>
      </CardContent>
    </Card>
  );
};

export default QuickActionCard;