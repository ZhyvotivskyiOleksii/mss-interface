import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: string;
}

const StatsCard = ({ title, value, icon: Icon, trend }: StatsCardProps) => {
  return (
    <Card className="animate-fade-in border shadow-lg bg-gradient-to-br from-card to-primary/5 hover:shadow-xl transition-all">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 shadow-md">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{trend}</p>
      </CardContent>
    </Card>
  );
};

export default StatsCard;