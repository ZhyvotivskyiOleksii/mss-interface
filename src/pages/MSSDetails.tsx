import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, RefreshCw, Building2, ExternalLink, Mail, 
  DollarSign, Clock, CheckCircle, XCircle, Sparkles, Users, 
  FolderOpen, FolderClosed, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MSSAccount {
  id: string;
  name: string;
  mcc_number: string;
  google_connected_email?: string;
}

interface GoogleAdsAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  isManager: boolean;
  isTest: boolean;
  status: string;
  level?: number;
  createdByUs: boolean;
  invitations?: any[];
}

interface Folder {
  id: string;
  name: string;
  level: number;
}

const MSSDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mssAccount, setMssAccount] = useState<MSSAccount | null>(null);
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [summary, setSummary] = useState({ total: 0, createdByUs: 0, external: 0, folders: 0 });

  useEffect(() => {
    if (id) {
      loadMSSDetails();
      loadAccounts();
    }
  }, [id]);

  const loadMSSDetails = async () => {
    const { data, error } = await supabase
      .from('mss_accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (data) setMssAccount(data);
    if (error) toast.error("Ошибка загрузки MCC");
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-mcc-accounts', {
        body: { mssAccountId: id }
      });

      if (error) throw error;

      if (data?.success) {
        setAccounts(data.accounts || []);
        setFolders(data.folders || []);
        setSummary(data.summary || { total: 0, createdByUs: 0, external: 0, folders: 0 });
      } else {
        throw new Error(data?.error || 'Ошибка загрузки');
      }
    } catch (error: any) {
      console.error('Error loading accounts:', error);
      toast.error(error.message || "Ошибка загрузки аккаунтов");
    } finally {
      setLoading(false);
    }
  };

  const formatAccountId = (id: string) => {
    if (id.length === 10) {
      return `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}`;
    }
    return id;
  };

  const ourAccounts = accounts.filter(a => a.createdByUs);
  const externalAccounts = accounts.filter(a => !a.createdByUs);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/accounts")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{mssAccount?.name || 'MCC'}</h1>
            <p className="text-muted-foreground text-sm font-mono">
              MCC: {mssAccount?.mcc_number}
            </p>
          </div>
          <Button onClick={loadAccounts} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="glass border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.total}</p>
                  <p className="text-xs text-muted-foreground">Аккаунтов</p>
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
                  <p className="text-2xl font-bold">{summary.folders}</p>
                  <p className="text-xs text-muted-foreground">Папок</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.createdByUs}</p>
                  <p className="text-xs text-muted-foreground">Созданы нами</p>
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
                  <p className="text-2xl font-bold">{summary.external}</p>
                  <p className="text-xs text-muted-foreground">Внешние</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Accounts Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="all">Все ({summary.total})</TabsTrigger>
            <TabsTrigger value="folders">Папки ({summary.folders})</TabsTrigger>
            <TabsTrigger value="ours">Наши ({summary.createdByUs})</TabsTrigger>
            <TabsTrigger value="external">Внешние ({summary.external})</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <AccountsList accounts={accounts} loading={loading} formatId={formatAccountId} />
          </TabsContent>

          <TabsContent value="folders">
            <FoldersList folders={folders} accounts={accounts} loading={loading} formatId={formatAccountId} />
          </TabsContent>

          <TabsContent value="ours">
            <AccountsList accounts={ourAccounts} loading={loading} formatId={formatAccountId} />
          </TabsContent>

          <TabsContent value="external">
            <AccountsList accounts={externalAccounts} loading={loading} formatId={formatAccountId} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

// Accounts List Component
const AccountsList = ({ 
  accounts, 
  loading, 
  formatId 
}: { 
  accounts: GoogleAdsAccount[]; 
  loading: boolean;
  formatId: (id: string) => string;
}) => {
  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground mt-2">Загрузка аккаунтов из Google Ads...</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Нет аккаунтов</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <Card key={account.id} className="glass border-border/50 hover:border-border transition-all">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                account.createdByUs 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-secondary/50 border border-border/50'
              }`}>
                <Building2 className={`h-5 w-5 ${account.createdByUs ? 'text-green-400' : 'text-muted-foreground'}`} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-semibold">{formatId(account.id)}</span>
                  {account.createdByUs && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs gap-1">
                      <Sparkles className="h-3 w-3" />
                      Наш
                    </Badge>
                  )}
                  {account.status === 'ENABLED' ? (
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                      Активен
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {account.status}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {account.name}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {account.currency}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {account.timezone}
                  </span>
                </div>
              </div>

              {/* Invitations */}
              {account.invitations && account.invitations.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Приглашения</p>
                  <div className="flex items-center gap-1 justify-end">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{account.invitations.length}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => window.open(`https://ads.google.com/aw/overview?ocid=${account.id}`, '_blank')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Открыть
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Folders List Component with expandable folders
const FoldersList = ({ 
  folders,
  accounts,
  loading, 
  formatId 
}: { 
  folders: Folder[];
  accounts: GoogleAdsAccount[];
  loading: boolean;
  formatId: (id: string) => string;
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

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

  // Group accounts by their level (folders are level 1, their accounts are level 2, etc.)
  const getAccountsForFolder = (folderId: string) => {
    // For now, show all accounts under level 2+ 
    // In future, we'd need to track parent-child relationship
    return accounts.filter(acc => acc.level && acc.level > 1);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        <p className="text-muted-foreground mt-2">Загрузка папок...</p>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <Card className="glass border-border/50">
        <CardContent className="py-12 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Нет суб-менеджеров (папок)</p>
          <p className="text-xs text-muted-foreground mt-1">
            Все аккаунты находятся на верхнем уровне MCC
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {folders.map((folder) => {
        const isExpanded = expandedFolders.has(folder.id);
        const folderAccounts = getAccountsForFolder(folder.id);
        
        return (
          <div key={folder.id}>
            <Card 
              className={`glass border-border/50 hover:border-yellow-500/30 transition-all cursor-pointer ${
                isExpanded ? 'border-yellow-500/50' : ''
              }`}
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <ChevronRight className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      <span className="font-semibold">{folder.name}</span>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                        Папка (Sub-MCC)
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-mono ml-6">
                      {formatId(folder.id)}
                    </p>
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
            
            {/* Expanded content - accounts in this folder */}
            {isExpanded && (
              <div className="ml-6 mt-2 space-y-2 border-l-2 border-yellow-500/30 pl-4">
                {folderAccounts.length > 0 ? (
                  folderAccounts.slice(0, 10).map((account) => (
                    <Card key={account.id} className="glass border-border/30">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-mono">{formatId(account.id)}</span>
                            <span className="text-xs text-muted-foreground ml-2">{account.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{account.currency}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground py-2">
                    Для просмотра аккаунтов папки откройте её в Google Ads
                  </p>
                )}
                {folderAccounts.length > 10 && (
                  <p className="text-xs text-muted-foreground">
                    +{folderAccounts.length - 10} ещё...
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MSSDetails;

