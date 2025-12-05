import { useState, useEffect, useRef } from "react";
import { 
  Search, ExternalLink, Mail, RefreshCw, Calendar, DollarSign, 
  Clock, Building2, Filter, Sparkles, Users, FolderOpen, FolderClosed, 
  ChevronRight, ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MSSAccount {
  id: string;
  name: string;
  mcc_number: string;
  google_refresh_token?: string;
  google_connected_email?: string;
}

interface MSSMetricsCache {
  [mssId: string]: {
    totals: AccountMetrics;
    accountCount: number;
    folderCount: number;
    lastUpdated: string;
  };
}

interface GoogleAdsAccount {
  id: string;
  customer_id: string;
  currency_code: string;
  timezone: string;
  status: string;
  created_at: string;
  mss_account_id: string;
}

interface AccountInvitation {
  id: string;
  email: string;
  access_level: string;
  status: string;
  invited_at: string;
  mss_account_id: string;
}

interface AccountMetrics {
  clicks: number;
  impressions: number;
  cost: number;
  ctr: number;
  conversions: number;
  avgCpc: number;
}

interface MccAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  isManager: boolean;
  status: string;
  level?: number;
  createdByUs: boolean;
  metrics?: AccountMetrics;
}

interface FolderAccount {
  id: string;
  name: string;
  currency: string;
}

interface Folder {
  id: string;
  name: string;
  level: number;
  accounts?: FolderAccount[];
  accountCount?: number;
}

const GoogleAdsAccounts = () => {
  const [mssAccounts, setMssAccounts] = useState<MSSAccount[]>([]);
  const [selectedMSS, setSelectedMSS] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Data for selected MSS
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAdsAccount[]>([]);
  const [invitations, setInvitations] = useState<AccountInvitation[]>([]);
  const [mccAccounts, setMccAccounts] = useState<MccAccount[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [summary, setSummary] = useState({ total: 0, createdByUs: 0, external: 0, folders: 0 });
  const [totals, setTotals] = useState<AccountMetrics>({ clicks: 0, impressions: 0, cost: 0, ctr: 0, conversions: 0, avgCpc: 0 });
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsLoaded, setMetricsLoaded] = useState(false);
  const [mssMetricsCache, setMssMetricsCache] = useState<MSSMetricsCache>({});
  const [loadingMssIds, setLoadingMssIds] = useState<Set<string>>(new Set());
  // Track the latest MSS load to avoid stale updates when switching tabs quickly
  const loadRequestRef = useRef(0);
  const selectedMssRef = useRef<string>("");

  useEffect(() => {
    selectedMssRef.current = selectedMSS;
  }, [selectedMSS]);

  const isLatestLoad = (loadId: number) => loadRequestRef.current === loadId;
  const isActiveLoad = (loadId: number, mssId: string) => isLatestLoad(loadId) && selectedMssRef.current === mssId;

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  // Load metrics from database cache
  const loadMetricsFromDatabase = async () => {
    try {
      // Load MSS totals
      const { data: totalsData } = await supabase
        .from('mss_metrics_cache')
        .select('*');
      
      if (totalsData && totalsData.length > 0) {
        const cache: MSSMetricsCache = {};
        for (const row of totalsData) {
          cache[row.mss_account_id] = {
            totals: {
              clicks: Number(row.total_clicks) || 0,
              impressions: Number(row.total_impressions) || 0,
              cost: Number(row.total_cost) || 0,
              ctr: 0,
              conversions: Number(row.total_conversions) || 0,
              avgCpc: 0,
            },
            accountCount: Number(row.account_count) || 0,
            folderCount: Number(row.folder_count) || 0,
            lastUpdated: row.last_updated_at,
          };
        }
        setMssMetricsCache(cache);
      }
    } catch (e) {
      console.log('Failed to load metrics from DB:', e);
    }
  };

  // Trigger full sync (fetches ALL accounts from API and saves to DB)
  const triggerFullSync = async (mssId?: string) => {
    setLoadingMetrics(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-all-metrics', {
        body: mssId ? { mssAccountId: mssId } : {}
      });
      
      if (error) {
        toast.error('Ошибка синхронизации: ' + error.message);
      } else if (data?.success) {
        const successResults = data.results?.filter((r: any) => r.success) || [];
        const failedResults = data.results?.filter((r: any) => !r.success) || [];
        
        if (successResults.length > 0) {
          toast.success(`Синхронизировано! ${successResults.map((r: any) => `${r.mss}: ${r.accounts || 0} акк`).join(', ')}`);
        }
        if (failedResults.length > 0) {
          toast.error(`Ошибки: ${failedResults.map((r: any) => `${r.mss}: ${r.error?.slice(0, 50)}`).join(', ')}`);
        }
        
        await loadMetricsFromDatabase();
        if (selectedMSS) {
          await loadMSSData(selectedMSS);
        }
      }
    } catch (e: any) {
      console.log('Sync failed:', e);
      toast.error('Ошибка синхронизации');
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    loadMSSAccounts();
  }, []);

  // Load from database on startup
  useEffect(() => {
    loadMetricsFromDatabase();
  }, []);

  // Auto-sync every 30 minutes (no auto-sync on load - only manual)
  useEffect(() => {
    if (mssAccounts.length === 0) return;
    
    // Auto-sync every 30 minutes
    const interval = setInterval(() => {
      console.log('Auto-syncing all metrics...');
      triggerFullSync();
    }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [mssAccounts]);

  // Sync all MSS metrics (full sync to database)
  const syncAllMSSMetrics = async () => {
    await triggerFullSync();
  };

  // Sync specific MSS metrics
  const syncMSSMetrics = async (mssId: string) => {
    setLoadingMssIds(prev => new Set([...prev, mssId]));
    try {
      await triggerFullSync(mssId);
    } finally {
      setLoadingMssIds(prev => {
        const next = new Set(prev);
        next.delete(mssId);
        return next;
      });
    }
  };

  useEffect(() => {
    if (selectedMSS && mssAccounts.length > 0) {
      loadMSSData(selectedMSS);
    }
  }, [selectedMSS, mssAccounts]);

  useEffect(() => {
    if (!selectedMSS) return;
    const cached = mssMetricsCache[selectedMSS];
    if (cached) {
      setTotals(cached.totals);
      setSummary(prev => ({
        ...prev,
        total: cached.accountCount || prev.total,
        folders: cached.folderCount || prev.folders,
      }));
      setMetricsLoaded(true);
    }
  }, [selectedMSS, mssMetricsCache]);

  const loadMSSAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('mss_accounts')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setMssAccounts(data || []);
      
      // Auto-select first connected MSS
      const connectedMSS = data?.find(m => m.google_refresh_token);
      if (connectedMSS) {
        setSelectedMSS(connectedMSS.id);
      } else if (data && data.length > 0) {
        setSelectedMSS(data[0].id);
      }
      
      // Metrics loaded from database cache - no API call needed
    } catch (error: any) {
      toast.error("Ошибка загрузки MCC: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMSSData = async (mssId: string) => {
    if (!mssId) return;
    const loadId = ++loadRequestRef.current;
    // Перевіряємо чи є кеш для цього MCC
    const cached = mssMetricsCache[mssId];
    if (!cached) {
      // Очистити тільки якщо немає кешу
      setMccAccounts([]);
      setFolders([]);
      setTotals({ clicks: 0, impressions: 0, cost: 0, ctr: 0, conversions: 0, avgCpc: 0 });
      setSummary({ total: 0, createdByUs: 0, external: 0, folders: 0 });
    }
    
    setLoadingAccounts(true);
    
    try {
      // Паралельно завантажуємо всі дані з бази (швидко!)
      const [accountsRes, invsRes, cachedRes, cachedTotalsRes] = await Promise.all([
        supabase.from('google_ads_accounts').select('*').eq('mss_account_id', mssId).order('created_at', { ascending: false }),
        supabase.from('account_invitations').select('*').eq('mss_account_id', mssId).order('invited_at', { ascending: false }),
        supabase.from('account_metrics_cache').select('*').eq('mss_account_id', mssId).order('clicks', { ascending: false }),
        supabase.from('mss_metrics_cache').select('*').eq('mss_account_id', mssId).single(),
      ]);

      const accounts = accountsRes.data || [];
      const invs = invsRes.data || [];
      const cachedAccounts = cachedRes.data || [];
      const cachedTotals = cachedTotalsRes.data;

      if (!isActiveLoad(loadId, mssId)) {
        return;
      }

      setGoogleAccounts(accounts);
      setInvitations(invs);

      // Якщо є кешовані дані - використовуємо їх миттєво!
      if (cachedAccounts.length > 0) {
        const mccAccountsList: MccAccount[] = cachedAccounts.map(acc => ({
          id: acc.customer_id,
          name: acc.customer_name || `Account ${acc.customer_id}`,
          currency: acc.currency_code,
          timezone: acc.timezone,
          isManager: acc.is_manager,
          status: acc.status,
          createdByUs: accounts.some(a => a.customer_id?.replace(/-/g, '') === acc.customer_id),
          metrics: {
            clicks: Number(acc.clicks) || 0,
            impressions: Number(acc.impressions) || 0,
            cost: Number(acc.cost) || 0,
            ctr: Number(acc.ctr) || 0,
            conversions: Number(acc.conversions) || 0,
            avgCpc: Number(acc.avg_cpc) || 0,
          }
        }));
        
        setMccAccounts(mccAccountsList);
        
        // Totals з кешу
        if (cachedTotals) {
          setTotals({
            clicks: Number(cachedTotals.total_clicks) || 0,
            impressions: Number(cachedTotals.total_impressions) || 0,
            cost: Number(cachedTotals.total_cost) || 0,
            ctr: 0,
            conversions: Number(cachedTotals.total_conversions) || 0,
            avgCpc: 0,
          });
          setSummary({
            total: Number(cachedTotals.account_count) || cachedAccounts.length,
            createdByUs: accounts.length,
            external: (Number(cachedTotals.account_count) || cachedAccounts.length) - accounts.length,
            folders: Number(cachedTotals.folder_count) || 0,
          });
        } else {
          // Рахуємо з акаунтів
          const totalClicks = cachedAccounts.reduce((sum, a) => sum + Number(a.clicks || 0), 0);
          const totalImpressions = cachedAccounts.reduce((sum, a) => sum + Number(a.impressions || 0), 0);
          const totalCost = cachedAccounts.reduce((sum, a) => sum + Number(a.cost || 0), 0);
          const totalConversions = cachedAccounts.reduce((sum, a) => sum + Number(a.conversions || 0), 0);
          
          setTotals({
            clicks: totalClicks,
            impressions: totalImpressions,
            cost: Math.round(totalCost * 100) / 100,
            ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10000) / 100 : 0,
            conversions: Math.round(totalConversions * 100) / 100,
            avgCpc: totalClicks > 0 ? Math.round((totalCost / totalClicks) * 100) / 100 : 0,
          });
          setSummary({
            total: cachedAccounts.length,
            createdByUs: accounts.length,
            external: cachedAccounts.length - accounts.length,
            folders: 0,
          });
        }
        
        setMetricsLoaded(true);
        
        // Папки завантажуємо у фоні (не блокуємо UI)
        const selectedMssData = mssAccounts.find(m => m.id === mssId);
        if (selectedMssData?.google_refresh_token) {
          supabase.functions.invoke('get-mcc-accounts', { body: { mssAccountId: mssId } })
            .then(({ data: mccData }) => {
              if (!isActiveLoad(loadId, mssId)) {
                return;
              }
              if (mccData?.success && mccData.folders) {
                setFolders(mccData.folders);
                setSummary(prev => ({ ...prev, folders: mccData.folders.length }));
              }
            })
            .catch(() => {});
        }
        return;
      }

      // Немає кешу - завантажуємо з API
      const selectedMssData = mssAccounts.find(m => m.id === mssId);
      if (selectedMssData?.google_refresh_token) {
        try {
          const { data: mccData } = await supabase.functions.invoke('get-mcc-accounts', {
            body: { mssAccountId: mssId }
          });

          if (!isActiveLoad(loadId, mssId)) {
            return;
          }

          if (mccData?.success) {
            setMccAccounts(mccData.accounts || []);
            setFolders(mccData.folders || []);
            setSummary(mccData.summary || { total: 0, createdByUs: 0, external: 0, folders: 0 });
            setTotals(mccData.totals || { clicks: 0, impressions: 0, cost: 0, ctr: 0, conversions: 0, avgCpc: 0 });
            setMetricsLoaded(true);
          }
        } catch (e) {
          console.log('Could not load MCC accounts:', e);
        }
      }
    } catch (error: any) {
      console.error('Error loading MSS data:', error);
    } finally {
      if (isLatestLoad(loadId)) {
        setLoadingAccounts(false);
      }
    }
  };

  const loadMetrics = async () => {
    if (!selectedMSS) return;
    await syncMSSMetrics(selectedMSS);
    setMetricsLoaded(true);
  };

  const formatCustomerId = (id: string) => {
    const cleanId = id.replace(/-/g, '');
    if (cleanId.length === 10) {
      return `${cleanId.slice(0, 3)}-${cleanId.slice(3, 6)}-${cleanId.slice(6)}`;
    }
    return id;
  };

  const getAccessLevelBadge = (level: string) => {
    switch (level) {
      case 'admin':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Админ</Badge>;
      case 'standard':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Стандарт</Badge>;
      case 'read':
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Чтение</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const selectedMssData = mssAccounts.find(m => m.id === selectedMSS);

  // Group invitations by account
  const getInvitationsForAccount = (customerId: string) => {
    // For now, show all invitations since we don't have direct linking
    return invitations;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Google Ads Аккаунты</h1>
            <p className="text-muted-foreground mt-1">
              Управление аккаунтами по MCC
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={syncAllMSSMetrics} 
              variant="default" 
              className="gap-2"
              disabled={loadingMetrics}
            >
              {loadingMetrics ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <DollarSign className="h-4 w-4" />
              )}
              Синхронизировать метрики
            </Button>
            <Button 
              onClick={() => selectedMSS && loadMSSData(selectedMSS)} 
              variant="outline" 
              className="gap-2"
              disabled={loadingAccounts}
            >
              <RefreshCw className={`h-4 w-4 ${loadingAccounts ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </div>

        {/* MSS Tabs */}
        {mssAccounts.length === 0 ? (
          <Card className="glass border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Нет MCC аккаунтов</p>
              <p className="text-sm text-muted-foreground mt-1">Сначала добавьте MCC</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={selectedMSS} onValueChange={setSelectedMSS} className="space-y-6">
            {/* MSS Selector Tabs with Metrics */}
            <TabsList className="bg-secondary/50 h-auto flex-wrap gap-2 p-2">
              {mssAccounts.map(mss => {
                const cached = mssMetricsCache[mss.id];
                const isLoading = loadingMssIds.has(mss.id);
                
                return (
                  <TabsTrigger 
                    key={mss.id} 
                    value={mss.id}
                    className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white flex-col items-start gap-1 px-4 py-2 h-auto min-w-[140px]"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium">{mss.name}</span>
                      {mss.google_refresh_token ? (
                        <span className="h-2 w-2 rounded-full bg-cyan-400 ml-auto"></span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-yellow-400 ml-auto"></span>
                      )}
                    </div>
                    {mss.google_refresh_token && (
                      <div className="flex items-center gap-2 text-[10px] opacity-90 w-full">
                        {isLoading ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : cached ? (
                          <>
                            <span>{cached.accountCount} акк</span>
                            <span className="font-bold">${cached.totals.cost.toLocaleString()}</span>
                            <span>{cached.totals.clicks.toLocaleString()} кл</span>
                          </>
                        ) : (
                          <span className="opacity-70">нажмите синхр.</span>
                        )}
                      </div>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Content for each MSS */}
            {mssAccounts.map(mss => (
              <TabsContent key={mss.id} value={mss.id} className="space-y-6">
                {/* MSS Info */}
                <Card className="glass border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">{mss.name}</h2>
                        <p className="text-sm text-muted-foreground font-mono">MCC: {mss.mcc_number}</p>
                      </div>
                      {mss.google_refresh_token ? (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                          <span className="h-2 w-2 rounded-full bg-green-400"></span>
                          Подключен: {mss.google_connected_email}
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          Не подключен
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Stats - Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card className="glass border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summary.total || googleAccounts.length}</p>
                          <p className="text-xs text-muted-foreground">Аккаунтов</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="glass border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totals.clicks.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Кликов</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="glass border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Filter className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totals.impressions.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Показов</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="glass border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                          <DollarSign className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">${totals.cost.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Расход</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="glass border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{totals.conversions.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">Конверсий</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="glass border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <FolderOpen className="h-5 w-5 text-yellow-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{summary.folders || folders.length}</p>
                          <p className="text-xs text-muted-foreground">Папок</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Accounts Tabs */}
                <Tabs defaultValue="created" className="space-y-4">
                  <TabsList className="bg-secondary/50">
                    <TabsTrigger value="created">Созданные ({googleAccounts.length})</TabsTrigger>
                    <TabsTrigger value="all">Все в MCC ({summary.total || 0})</TabsTrigger>
                    <TabsTrigger value="folders">Папки ({folders.length})</TabsTrigger>
                  </TabsList>

                  {/* Created by us */}
                  <TabsContent value="created">
                    {loadingAccounts ? (
                      <div className="text-center py-12">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    ) : googleAccounts.length === 0 ? (
                      <Card className="glass border-border/50">
                        <CardContent className="py-12 text-center">
                          <p className="text-muted-foreground">Нет созданных аккаунтов</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {googleAccounts.map((account, index) => {
                          // Get invitation for this account by index
                          const accountInvitation = invitations[index];
                          
                          return (
                            <Card key={account.id} className="glass border-border/50 hover:border-primary/30 transition-all">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                  {/* Icon */}
                                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                                    <Sparkles className="h-6 w-6 text-green-400" />
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-mono font-bold text-lg">
                                        {formatCustomerId(account.customer_id)}
                                      </span>
                                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                        Создан
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                      <span className="flex items-center gap-1">
                                        <DollarSign className="h-3.5 w-3.5" />
                                        {account.currency_code}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {account.timezone}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {new Date(account.created_at).toLocaleDateString('ru-RU')}
                                      </span>
                                    </div>
                                    {/* Invitation inline */}
                                    {accountInvitation && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <Mail className="h-3.5 w-3.5 text-blue-400" />
                                        <span className="text-sm text-blue-400">{accountInvitation.email}</span>
                                        <Badge variant="outline" className="text-xs capitalize">
                                          {accountInvitation.access_level}
                                        </Badge>
                                      </div>
                                    )}
                                  </div>

                                  {/* Action */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 shrink-0"
                                    onClick={() => window.open(`https://ads.google.com/aw/overview?ocid=${account.customer_id.replace(/-/g, '')}`, '_blank')}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Открыть
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>

                  {/* All MCC accounts with metrics */}
                  <TabsContent value="all">
                    {loadingAccounts ? (
                      <div className="text-center py-12">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mt-2">Загружаем аккаунты и метрики...</p>
                      </div>
                    ) : !mss.google_refresh_token ? (
                      <Card className="glass border-border/50">
                        <CardContent className="py-12 text-center">
                          <p className="text-muted-foreground">Подключите Google Ads чтобы видеть все аккаунты</p>
                        </CardContent>
                      </Card>
                    ) : mccAccounts.length === 0 ? (
                      <Card className="glass border-border/50">
                        <CardContent className="py-12 text-center">
                          <p className="text-muted-foreground">Нет аккаунтов в MCC</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card className="glass border-border/50 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-secondary/30 border-b border-border/50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Аккаунт</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Клики</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Показы</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">CTR</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Ср.CPC</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Расход</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Конв.</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {mccAccounts.map((account) => (
                                <tr key={account.id} className={`hover:bg-secondary/20 transition-colors ${account.createdByUs ? 'bg-green-500/5' : ''}`}>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        account.createdByUs 
                                          ? 'bg-green-500/10 border border-green-500/20' 
                                          : 'bg-secondary/50'
                                      }`}>
                                        <Building2 className={`h-4 w-4 ${account.createdByUs ? 'text-green-400' : 'text-muted-foreground'}`} />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono text-sm">{formatCustomerId(account.id)}</span>
                                          {account.createdByUs && (
                                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">Наш</Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{account.name}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-sm">
                                    {(account.metrics?.clicks || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                                    {(account.metrics?.impressions || 0).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-sm">
                                    <span className={account.metrics?.ctr && account.metrics.ctr > 2 ? 'text-green-400' : ''}>
                                      {(account.metrics?.ctr || 0).toFixed(2)}%
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-sm text-muted-foreground">
                                    ${(account.metrics?.avgCpc || 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                                    <span className={account.metrics?.cost && account.metrics.cost > 0 ? 'text-primary' : 'text-muted-foreground'}>
                                      ${(account.metrics?.cost || 0).toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right font-mono text-sm">
                                    <span className={account.metrics?.conversions && account.metrics.conversions > 0 ? 'text-orange-400' : 'text-muted-foreground'}>
                                      {(account.metrics?.conversions || 0).toFixed(1)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => window.open(`https://ads.google.com/aw/overview?ocid=${account.id}`, '_blank')}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            {/* Totals row */}
                            <tfoot className="bg-secondary/40 border-t-2 border-primary/30">
                              <tr className="font-semibold">
                                <td className="px-4 py-3 text-sm">ИТОГО ({mccAccounts.length} акк.)</td>
                                <td className="px-4 py-3 text-right font-mono text-sm">{totals.clicks.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-mono text-sm">{totals.impressions.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-mono text-sm">
                                  {totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(2) : '0.00'}%
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sm">
                                  ${totals.clicks > 0 ? (totals.cost / totals.clicks).toFixed(2) : '0.00'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-sm text-primary">${totals.cost.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-mono text-sm text-orange-400">{totals.conversions.toFixed(1)}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <div className="px-4 py-2 text-xs text-muted-foreground border-t border-border/30 bg-secondary/20">
                          * Данные за последние 30 дней
                        </div>
                      </Card>
                    )}
                  </TabsContent>

                  {/* Folders */}
                  <TabsContent value="folders">
                    {loadingAccounts ? (
                      <div className="text-center py-12">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </div>
                    ) : folders.length === 0 ? (
                      <Card className="glass border-border/50">
                        <CardContent className="py-12 text-center">
                          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">Нет папок (Sub-MCC)</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {folders.map((folder) => {
                          const isExpanded = expandedFolders.has(folder.id);
                          const folderAccounts = folder.accounts || [];
                          
                          return (
                            <div key={folder.id}>
                              <Card 
                                className={`glass border-border/50 hover:border-yellow-500/30 transition-all cursor-pointer ${isExpanded ? 'border-yellow-500/50' : ''}`}
                                onClick={() => toggleFolder(folder.id)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                      {isExpanded ? (
                                        <FolderOpen className="h-5 w-5 text-yellow-400" />
                                      ) : (
                                        <FolderClosed className="h-5 w-5 text-yellow-400" />
                                      )}
                                    </div>
                                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">{folder.name}</span>
                                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">sub-mcc</span>
                                        <Badge variant="outline" className="text-xs text-muted-foreground">
                                          {folder.accountCount || 0} акк.
                                        </Badge>
                                      </div>
                                      <p className="text-sm text-muted-foreground font-mono">{formatCustomerId(folder.id)}</p>
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-2"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`https://ads.google.com/aw/accounts?ocid=${folder.id}`, '_blank');
                                      }}
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      Открыть
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                              
                              {/* Expanded content - real accounts from this folder */}
                              {isExpanded && (
                                <div className="ml-6 mt-2 space-y-2 border-l-2 border-yellow-500/30 pl-4">
                                  {folderAccounts.length > 0 ? (
                                    <>
                                      {folderAccounts.slice(0, 15).map((account) => (
                                        <Card key={account.id} className="glass border-border/30">
                                          <CardContent className="p-3">
                                            <div className="flex items-center gap-3">
                                              <Building2 className="h-4 w-4 text-muted-foreground" />
                                              <span className="text-sm font-mono font-medium">{formatCustomerId(account.id)}</span>
                                              <span className="text-sm text-muted-foreground truncate flex-1">{account.name}</span>
                                              <span className="text-xs text-muted-foreground">{account.currency}</span>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  window.open(`https://ads.google.com/aw/overview?ocid=${account.id}`, '_blank');
                                                }}
                                              >
                                                <ExternalLink className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                      {folderAccounts.length > 15 && (
                                        <p className="text-xs text-muted-foreground px-2 py-1">
                                          +{folderAccounts.length - 15} ещё...
                                        </p>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-sm text-muted-foreground py-2 px-2">
                                      Нет аккаунтов в этой папке
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GoogleAdsAccounts;
