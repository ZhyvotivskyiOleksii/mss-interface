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
  
  // Budget data
  const [budgetData, setBudgetData] = useState({
    totalBudget: 0,
    totalSpent: 0,
    totalRemaining: 0,
    percentUsed: 0,
    lastUpdated: null as string | null,
  });
  const [loadingBudgets, setLoadingBudgets] = useState(false);
  
  // Auto-refresh timer (30 min = 1800 seconds)
  const [timeToRefresh, setTimeToRefresh] = useState(1800);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track the latest MSS load to avoid stale updates when switching tabs quickly
  const loadRequestRef = useRef(0);
  const selectedMssRef = useRef<string>("");

  useEffect(() => {
    selectedMssRef.current = selectedMSS;
  }, [selectedMSS]);

  const isLatestLoad = (loadId: number) => loadRequestRef.current === loadId;
  const isActiveLoad = (loadId: number, mssId: string) => isLatestLoad(loadId) && selectedMssRef.current === mssId;

  // Load budgets
  const loadBudgets = async (mssId: string) => {
    setLoadingBudgets(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-mcc-budgets', {
        body: { mssAccountId: mssId }
      });
      
      if (data?.success) {
        setBudgetData({
          totalBudget: data.totalBudget || 0,
          totalSpent: data.totalSpent || 0,
          totalRemaining: data.totalRemaining || 0,
          percentUsed: data.percentUsed || 0,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
        });
        setTimeToRefresh(1800); // Reset timer
        toast.success('Бюджети оновлено!');
      }
    } catch (e) {
      console.error('Failed to load budgets:', e);
    } finally {
      setLoadingBudgets(false);
    }
  };

  // Auto-refresh timer
  useEffect(() => {
    if (selectedMSS) {
      // Start countdown
      timerRef.current = setInterval(() => {
        setTimeToRefresh(prev => {
          if (prev <= 1) {
            // Auto-refresh
            loadBudgets(selectedMSS);
            return 1800;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [selectedMSS]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Folder accounts cache (lazy loaded)
  const [folderAccounts, setFolderAccounts] = useState<Record<string, any[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const toggleFolder = async (folderId: string) => {
    const isExpanding = !expandedFolders.has(folderId);
    
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });

    // Lazy load folder accounts if expanding and not already loaded
    if (isExpanding && !folderAccounts[folderId] && selectedMSS) {
      setLoadingFolders(prev => new Set(prev).add(folderId));
      
      try {
        const { data, error } = await supabase.functions.invoke('get-folder-accounts', {
          body: { mssAccountId: selectedMSS, folderId }
        });
        
        if (data?.success) {
          setFolderAccounts(prev => ({
            ...prev,
            [folderId]: data.accounts || []
          }));
          
          // Update folder count in folders state
          setFolders(prev => prev.map(f => 
            f.id === folderId ? { ...f, accountCount: data.count, accounts: data.accounts } : f
          ));
        }
      } catch (e) {
        console.error('Failed to load folder accounts:', e);
      } finally {
        setLoadingFolders(prev => {
          const newSet = new Set(prev);
          newSet.delete(folderId);
          return newSet;
        });
      }
    }
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
              variant="outline" 
              className="gap-2 border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/20 hover:text-emerald-300 hover:border-emerald-500/70"
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
                    className="data-[state=active]:bg-slate-700 data-[state=active]:text-white data-[state=active]:border-green-500/50 border border-transparent flex-col items-start gap-1 px-4 py-2 h-auto min-w-[140px] rounded-lg"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Building2 className="h-4 w-4" />
                      <span className="font-medium">{mss.name}</span>
                      {mss.google_refresh_token ? (
                        <span className="h-2 w-2 rounded-full bg-green-400 ml-auto"></span>
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-yellow-400 ml-auto"></span>
                      )}
                    </div>
                    {mss.google_refresh_token && (
                      <div className="flex items-center gap-2 text-[10px] text-green-400 w-full">
                        {isLoading ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : cached ? (
                          <>
                            <span>{cached.accountCount} акк</span>
                            <span className="font-bold">${cached.totals.cost.toLocaleString()}</span>
                            <span>{cached.totals.clicks.toLocaleString()} кл</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">нажмите синхр.</span>
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

                {/* Stats - Budget Cards with Gradients */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {/* Аккаунтов */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 via-emerald-600/10 to-transparent border border-emerald-500/20 p-4 group hover:border-emerald-500/40 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-400">{summary.total || googleAccounts.length}</p>
                        <p className="text-xs text-emerald-300/60">Аккаунтов</p>
                      </div>
                    </div>
                  </div>

                  {/* Бюджет */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-transparent border border-blue-500/20 p-4 group hover:border-blue-500/40 transition-all cursor-pointer" onClick={() => loadBudgets(mss.id)}>
                    <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                        {loadingBudgets ? <RefreshCw className="h-5 w-5 text-white animate-spin" /> : <DollarSign className="h-5 w-5 text-white" />}
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-400">${budgetData.totalBudget.toLocaleString()}</p>
                        <p className="text-xs text-blue-300/60">Бюджет</p>
                      </div>
                    </div>
                  </div>

                  {/* Витрачено */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-rose-500/20 via-rose-600/10 to-transparent border border-rose-500/20 p-4 group hover:border-rose-500/40 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/25">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-rose-400">${budgetData.totalSpent.toLocaleString()}</p>
                        <p className="text-xs text-rose-300/60">Витрачено</p>
                      </div>
                    </div>
                  </div>

                  {/* Залишок */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-green-500/20 via-green-600/10 to-transparent border border-green-500/20 p-4 group hover:border-green-500/40 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                        <DollarSign className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-400">${budgetData.totalRemaining.toLocaleString()}</p>
                        <p className="text-xs text-green-300/60">Залишок</p>
                      </div>
                    </div>
                  </div>

                  {/* % Використано */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-transparent border border-orange-500/20 p-4 group hover:border-orange-500/40 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                        <Filter className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-400">{budgetData.percentUsed}%</p>
                        <p className="text-xs text-orange-300/60">Використано</p>
                      </div>
                    </div>
                  </div>

                  {/* Суб МСС */}
                  <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent border border-amber-500/20 p-4 group hover:border-amber-500/40 transition-all">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all" />
                    <div className="relative flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                        <FolderOpen className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-400">{summary.folders || folders.length}</p>
                        <p className="text-xs text-amber-300/60">Суб МСС</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {budgetData.lastUpdated 
                      ? `Оновлено: ${new Date(budgetData.lastUpdated).toLocaleTimeString('uk-UA')}`
                      : 'Клікни на "Бюджет" для завантаження'
                    }
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Авто-оновлення: {formatTime(timeToRefresh)}
                  </span>
                </div>

                {/* Hierarchy Tree View */}
                <div className="space-y-4">
                  {loadingAccounts ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* New Accounts Section */}
                      {googleAccounts.length > 0 && (
                        <div className="space-y-3">
                          <div 
                            className="flex items-center gap-3 cursor-pointer group"
                            onClick={() => {
                              const newSet = new Set(expandedFolders);
                              if (newSet.has('new-accounts')) {
                                newSet.delete('new-accounts');
                              } else {
                                newSet.add('new-accounts');
                              }
                              setExpandedFolders(newSet);
                            }}
                          >
                            <ChevronRight className={`h-4 w-4 text-green-400 transition-transform ${expandedFolders.has('new-accounts') ? 'rotate-90' : ''}`} />
                            <div className="h-8 w-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                              <Sparkles className="h-4 w-4 text-green-400" />
                            </div>
                            <span className="font-semibold text-green-400">Новые аккаунты</span>
                            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                              {googleAccounts.length}
                            </Badge>
                          </div>
                          
                          {expandedFolders.has('new-accounts') && (
                            <div className="ml-6 border-l-2 border-green-500/30 pl-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                              {googleAccounts.map((account, index) => {
                                const accountInvitation = invitations[index];
                                return (
                                  <Card key={account.id} className="glass border-border/50 hover:border-green-500/30 transition-all">
                                    <CardContent className="p-3">
                                      <div className="font-mono font-bold text-sm mb-1">
                                        {formatCustomerId(account.customer_id)}
                                      </div>
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span>{account.currency_code}</span>
                                        <span>•</span>
                                        <span>{account.timezone}</span>
                                      </div>
                                      {accountInvitation && (
                                        <div className="flex items-center gap-1 mt-2 text-xs text-blue-400">
                                          <Mail className="h-3 w-3" />
                                          <span className="truncate">{accountInvitation.email}</span>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Sub-MCCs Section */}
                      {folders.length > 0 && (
                        <div className="space-y-2">
                          {folders.map((folder) => {
                            const isExpanded = expandedFolders.has(folder.id);
                            const isLoading = loadingFolders.has(folder.id);
                            const accounts = folderAccounts[folder.id] || folder.accounts || [];
                            
                            return (
                              <div key={folder.id}>
                                <div 
                                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 cursor-pointer transition-all group"
                                  onClick={() => toggleFolder(folder.id)}
                                >
                                  {isLoading ? (
                                    <RefreshCw className="h-4 w-4 text-yellow-400 animate-spin" />
                                  ) : (
                                    <ChevronRight className={`h-4 w-4 text-yellow-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                  )}
                                  <div className="h-8 w-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                    {isExpanded ? (
                                      <FolderOpen className="h-4 w-4 text-yellow-400" />
                                    ) : (
                                      <FolderClosed className="h-4 w-4 text-yellow-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold truncate">{folder.name}</span>
                                      <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/30 shrink-0">
                                        SUB-MCC
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">{formatCustomerId(folder.id)}</span>
                                  </div>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs shrink-0 ${accounts.length > 0 ? 'text-green-400 border-green-500/30' : 'text-muted-foreground'}`}
                                  >
                                    {accounts.length > 0 ? `${accounts.length} акк.` : 'клік →'}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`https://ads.google.com/aw/accounts?ocid=${folder.id}`, '_blank');
                                    }}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                
                                {isExpanded && (
                                  <div className="ml-6 border-l-2 border-yellow-500/30 pl-4 py-2 space-y-1">
                                    {isLoading ? (
                                      <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                                        <RefreshCw className="h-3 w-3 animate-spin" />
                                        <span>Загрузка...</span>
                                      </div>
                                    ) : accounts.length > 0 ? (
                                      <>
                                        {accounts.slice(0, 15).map((account: any) => (
                                          <div 
                                            key={account.id} 
                                            className="flex items-center gap-3 p-2 rounded hover:bg-secondary/20 transition-all group"
                                          >
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            <span className="text-sm font-mono">{formatCustomerId(account.id)}</span>
                                            <span className="text-sm text-muted-foreground truncate flex-1">{account.name}</span>
                                            <span className="text-xs text-muted-foreground">{account.currency}</span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                              onClick={() => window.open(`https://ads.google.com/aw/overview?ocid=${account.id}`, '_blank')}
                                            >
                                              <ExternalLink className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        ))}
                                        {accounts.length > 15 && (
                                          <p className="text-xs text-muted-foreground pl-6">
                                            +{accounts.length - 15} ещё...
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      <p className="text-xs text-muted-foreground pl-2 py-1">
                                        Нет аккаунтов
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Empty state */}
                      {googleAccounts.length === 0 && folders.length === 0 && (
                        <Card className="glass border-border/50">
                          <CardContent className="py-12 text-center">
                            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">Нет аккаунтов</p>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
};

export default GoogleAdsAccounts;
