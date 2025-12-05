import { Server, ArrowRightLeft, Settings, Plus, Activity, Clock, CheckCircle, TrendingUp, Users, Trash2, Link2, UserPlus, Edit } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ActivityItem {
  id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_name: string;
  details: any;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalMSS: 0,
    totalGoogleAds: 0,
    totalManagers: 0
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load MSS accounts count
      const { count: mssCount } = await supabase
        .from('mss_accounts')
        .select('*', { count: 'exact', head: true });

      // Load Google Ads accounts count
      const { count: gadsCount } = await supabase
        .from('google_ads_accounts')
        .select('*', { count: 'exact', head: true });

      // Load managers count
      const { count: managersCount } = await supabase
        .from('managers')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalMSS: mssCount || 0,
        totalGoogleAds: gadsCount || 0,
        totalManagers: managersCount || 0
      });

      // Load recent activity
      const { data: activityData } = await supabase
        .from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityData) {
        setActivities(activityData);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    {
      title: "Создать аккаунты",
      description: "Новые Google Ads аккаунты",
      icon: Plus,
      onClick: () => navigate("/add-account"),
      color: "bg-primary/10 text-primary border-primary/20",
    },
    {
      title: "Перенос",
      description: "Переместить аккаунты",
      icon: ArrowRightLeft,
      onClick: () => navigate("/transfer"),
      color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    {
      title: "MCC Аккаунты",
      description: "Управление MCC",
      icon: Server,
      onClick: () => navigate("/accounts"),
      color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
    {
      title: "Менеджеры",
      description: "Управление доступом",
      icon: Users,
      onClick: () => navigate("/managers"),
      color: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    },
  ];

  const statsCards = [
    {
      title: "MCC Аккаунтов",
      value: stats.totalMSS.toString(),
      icon: Server,
      color: "text-primary",
    },
    {
      title: "Google Ads аккаунтов",
      value: stats.totalGoogleAds.toString(),
      icon: Activity,
      color: "text-blue-400",
    },
    {
      title: "Менеджеров",
      value: stats.totalManagers.toString(),
      icon: Users,
      color: "text-orange-400",
    },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "только что";
    if (diffMins < 60) return `${diffMins} мин. назад`;
    if (diffHours < 24) return `${diffHours} ч. назад`;
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString('ru-RU');
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create_mss':
      case 'create_account':
        return <Plus className="h-4 w-4" />;
      case 'delete_mss':
      case 'delete_account':
        return <Trash2 className="h-4 w-4" />;
      case 'connect_google':
        return <Link2 className="h-4 w-4" />;
      case 'transfer':
        return <ArrowRightLeft className="h-4 w-4" />;
      case 'add_manager':
        return <UserPlus className="h-4 w-4" />;
      case 'edit':
        return <Edit className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete')) return 'bg-red-500/10 text-red-400';
    if (action.includes('create') || action.includes('add')) return 'bg-green-500/10 text-green-400';
    if (action.includes('connect')) return 'bg-blue-500/10 text-blue-400';
    if (action.includes('transfer')) return 'bg-purple-500/10 text-purple-400';
    return 'bg-primary/10 text-primary';
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create_mss': return 'Создал MCC';
      case 'delete_mss': return 'Удалил MCC';
      case 'create_account': return 'Создал аккаунт';
      case 'delete_account': return 'Удалил аккаунт';
      case 'connect_google': return 'Подключил Google Ads';
      case 'transfer': return 'Перенёс аккаунт';
      case 'add_manager': return 'Добавил менеджера';
      case 'edit': return 'Редактировал';
      default: return action;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">
            Панель управления
          </h1>
          <p className="text-muted-foreground mt-1">
            Добро пожаловать! Обзор ваших аккаунтов
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {statsCards.map((stat, index) => (
            <Card key={index} className="glass border-border/50 hover:border-border transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {stat.title}
                    </p>
                    <p className={`text-3xl font-bold mt-2 ${stat.color}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-xl bg-secondary/50 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Быстрые действия</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => (
              <Card 
                key={index}
                className="glass border-border/50 hover:border-primary/30 cursor-pointer transition-all group"
                onClick={action.onClick}
              >
                <CardContent className="p-5">
                  <div className={`inline-flex p-3 rounded-xl border ${action.color} mb-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{action.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {action.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Activity Log */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-secondary/50">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">История действий</CardTitle>
                <CardDescription>
                  Все действия пользователей в системе
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Нет записей о действиях</p>
                <p className="text-sm mt-1">Действия будут отображаться здесь</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50 hover:border-border transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${getActionColor(activity.action)}`}>
                      {getActionIcon(activity.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">
                        {getActionLabel(activity.action)}
                        {activity.entity_name && (
                          <span className="text-muted-foreground"> · {activity.entity_name}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.user_email || 'Система'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(activity.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
