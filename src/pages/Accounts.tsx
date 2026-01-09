import { useState, useEffect } from "react";
import { Search, Plus, MoreVertical, Activity, XCircle, CheckCircle, Trash2, Edit, Eye, RefreshCw, Link2, Unlink, ExternalLink, Settings2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/contexts/AuthContext";

interface MSSAccount {
  id: string;
  name: string;
  mcc_number: string;
  status: "active" | "pending" | "suspended" | "closed";
  developer_token: string;
  manager_email: string;
  created_at: string;
  google_refresh_token?: string;
  google_connected_email?: string;
  google_connected_at?: string;
  google_client_id?: string;
  google_client_secret?: string;
}

const Accounts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { canDelete, canEdit, canCreate } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [accounts, setAccounts] = useState<MSSAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<MSSAccount | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<MSSAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [connectAccount, setConnectAccount] = useState<MSSAccount | null>(null);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [connectedEmail, setConnectedEmail] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Add MSS Account - спрощена форма
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newMccNumber, setNewMccNumber] = useState("");
  const [newMccName, setNewMccName] = useState("");
  const [adding, setAdding] = useState(false);
  
  // Disconnect Google
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [accountToDisconnect, setAccountToDisconnect] = useState<MSSAccount | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    loadAccounts();
    
    // Check for Google connection result
    const googleConnected = searchParams.get('google_connected');
    const error = searchParams.get('error');
    
    if (googleConnected === 'true') {
      toast.success('Google Ads успешно подключен!');
      // Clear URL params
      window.history.replaceState({}, '', '/accounts');
    } else if (error) {
      toast.error(`Ошибка подключения: ${error}`);
      window.history.replaceState({}, '', '/accounts');
    }
  }, [searchParams]);

  const loadAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('mss_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setAccounts(data || []);
    } catch (error: any) {
      toast.error("Ошибка загрузки аккаунтов: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectGoogle = async (account: MSSAccount) => {
    setConnectingGoogle(account.id);
    try {
      const { data, error } = await supabase.functions.invoke('google-ads-auth', {
        body: { mssAccountId: account.id }
      });

      if (error) throw error;
      
      if (data?.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error("Не удалось получить URL авторизации");
      }
    } catch (error: any) {
      console.error('Error connecting Google:', error);
      toast.error("Ошибка подключения: " + error.message);
      setConnectingGoogle(null);
    }
  };
  
  const handleConnectGoogleManual = (account: MSSAccount) => {
    setConnectAccount(account);
    // Pre-fill if account already has some credentials
    setGoogleClientId(account.google_client_id || "");
    setGoogleClientSecret(account.google_client_secret || "");
    setRefreshToken(account.google_refresh_token || "");
    setConnectedEmail(account.google_connected_email || "");
    setShowConnectDialog(true);
  };

  const handleSaveGoogleConnection = async () => {
    if (!connectAccount) {
      toast.error("Не выбран аккаунт");
      return;
    }

    if (!googleClientId || !googleClientSecret) {
      toast.error("Введите Client ID и Client Secret");
      return;
    }

    if (refreshToken && !connectedEmail) {
      toast.error("Укажите email Google аккаунта для сохранения refresh token");
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, any> = {
        google_client_id: googleClientId.trim(),
        google_client_secret: googleClientSecret.trim(),
      };

      if (refreshToken) {
        updates.google_refresh_token = refreshToken.trim();
        updates.google_connected_email = connectedEmail.trim();
        updates.google_connected_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('mss_accounts')
        .update(updates)
        .eq('id', connectAccount.id);

      if (error) throw error;

      toast.success(
        refreshToken 
          ? "Google Ads успешно подключен вручную!"
          : "OAuth данные сохранены. Теперь можете нажать «Подключить Google Ads»."
      );
      setShowConnectDialog(false);
      setGoogleClientId("");
      setGoogleClientSecret("");
      setRefreshToken("");
      setConnectedEmail("");
      loadAccounts();
    } catch (error: any) {
      toast.error("Ошибка сохранения: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Дефолтний Developer Token (ALMZ)
  const DEFAULT_DEVELOPER_TOKEN = "5k9zvX4_DBzcFeyO_dwArQ";

  const handleAddAccount = async () => {
    // Validate - тільки MCC номер обов'язковий
    const mccNumber = newMccNumber.trim().replace(/[-\s]/g, '');
    
    if (!mccNumber || mccNumber.length < 10) {
      toast.error("Введіть коректний MCC номер (10 цифр)");
      return;
    }

    setAdding(true);
    try {
      // Автоматична назва якщо не вказана
      const name = newMccName.trim() || `MCC ${mccNumber.slice(0, 3)}-${mccNumber.slice(3, 6)}-${mccNumber.slice(6)}`;
      
      const insertData = {
        name,
        mcc_number: mccNumber,
        developer_token: DEFAULT_DEVELOPER_TOKEN,
        manager_email: "auto@mss.service",
        status: 'active' as const
      };

      const { data, error } = await supabase
        .from('mss_accounts')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await logActivity({
        action: 'create_mss',
        entityType: 'mss_account',
        entityName: name,
        details: { mcc_number: mccNumber }
      });
      
      toast.success(`MCC додано! Зараз підключаємо Google Ads...`);
      setShowAddDialog(false);
      setNewMccNumber("");
      setNewMccName("");
      
      // Автоматично запускаємо OAuth
      if (data) {
        await loadAccounts();
        handleConnectGoogle(data as MSSAccount);
      }
    } catch (error: any) {
      toast.error("Помилка: " + error.message);
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    
    setDeleting(true);
    try {
      const { error, count } = await supabase
        .from('mss_accounts')
        .delete()
        .eq('id', accountToDelete.id)
        .select();

      if (error) {
        if (error.code === '42501' || error.message.includes('policy')) {
          throw new Error("У вас нет прав на это действие. Требуются права администратора.");
        }
        throw error;
      }
      
      // Проверяем что удаление реально произошло
      const { data: checkData } = await supabase
        .from('mss_accounts')
        .select('id')
        .eq('id', accountToDelete.id)
        .single();
      
      if (checkData) {
        throw new Error("У вас нет прав на удаление. Обратитесь к администратору.");
      }

      // Log activity
      await logActivity({
        action: 'delete_mss',
        entityType: 'mss_account',
        entityId: accountToDelete.id,
        entityName: accountToDelete.name,
        details: { mcc_number: accountToDelete.mcc_number }
      });
      
      toast.success("Аккаунт удален");
      setAccounts(accounts.filter(a => a.id !== accountToDelete.id));
    } catch (error: any) {
      toast.error(error.message || "Ошибка удаления");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setAccountToDelete(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!accountToDisconnect) return;
    
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from('mss_accounts')
        .update({
          google_refresh_token: null,
          google_connected_email: null,
          google_connected_at: null
        })
        .eq('id', accountToDisconnect.id);

      if (error) throw error;

      // Log activity
      await logActivity({
        action: 'disconnect_google',
        entityType: 'mss_account',
        entityId: accountToDisconnect.id,
        entityName: accountToDisconnect.name,
        details: { mcc_number: accountToDisconnect.mcc_number }
      });
      
      toast.success("Google Ads отключен");
      loadAccounts();
    } catch (error: any) {
      toast.error("Ошибка отключения: " + error.message);
    } finally {
      setDisconnecting(false);
      setShowDisconnectConfirm(false);
      setAccountToDisconnect(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-3.5 w-3.5" />;
      case "pending":
        return <Activity className="h-3.5 w-3.5" />;
      case "suspended":
      case "closed":
        return <XCircle className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "active":
        return "default";
      case "pending":
        return "secondary";
      case "suspended":
      case "closed":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Активен";
      case "pending":
        return "Ожидание";
      case "suspended":
        return "Приостановлен";
      case "closed":
        return "Закрыт";
      default:
        return status;
    }
  };

  const filteredAccounts = accounts.filter((account) =>
    account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.mcc_number.includes(searchQuery)
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">MCC Аккаунты</h1>
            <p className="text-muted-foreground mt-1">
              Управление всеми вашими MCC аккаунтами
            </p>
          </div>
          <div className="flex gap-2">
            {canCreate && (
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
              >
                <Plus className="h-4 w-4" />
                Підключити MCC
              </Button>
            )}
            {canCreate && (
              <Button 
                variant="outline"
                onClick={() => navigate("/add-account")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Створити акаунти
              </Button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию или MCC номеру..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 "
          />
        </div>

        {/* Accounts List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Загрузка аккаунтов...
            </div>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <Card className="glass border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? "Аккаунты не найдены" : "Нет MCC аккаунтов. Добавьте новый для начала."}
              </p>
              {!searchQuery && (
                <Button 
                  onClick={() => navigate("/add-account")}
                  className="mt-4 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Добавить первый MCC
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((account) => (
              <Card 
                key={account.id} 
                className="glass border-border/50 hover:border-border transition-all"
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-primary">
                        {account.name.charAt(0)}
                      </span>
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{account.name}</h3>
                        {account.google_refresh_token && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs gap-1">
                            <Link2 className="h-3 w-3" />
                            Google Ads
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">
                        MCC: {account.mcc_number}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {account.manager_email}
                      </p>
                    </div>

                    {/* Google Connection Status */}
                    {!account.google_refresh_token ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnectGoogle(account)}
                        disabled={connectingGoogle === account.id}
                        className="gap-2 text-xs"
                      >
                        {connectingGoogle === account.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Link2 className="h-3 w-3" />
                        )}
                        {connectingGoogle === account.id ? "Підключення..." : "Підключити Google Ads"}
                      </Button>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 gap-1.5">
                        <CheckCircle className="h-3 w-3" />
                        Google Ads підключено
                      </Badge>
                    )}

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-popover border-border/50">
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedAccount(account);
                            setShowDetails(true);
                          }}
                          className="gap-2 cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                          Просмотр
                        </DropdownMenuItem>
                        {account.google_refresh_token && (
                          <DropdownMenuItem 
                            onClick={() => navigate(`/mss/${account.id}`)}
                            className="gap-2 cursor-pointer"
                          >
                            <Activity className="h-4 w-4" />
                            Все аккаунты MCC
                          </DropdownMenuItem>
                        )}
                        {canEdit && (
                          <DropdownMenuItem 
                            onClick={() => navigate(`/edit-account/${account.id}`)}
                            className="gap-2 cursor-pointer"
                          >
                            <Edit className="h-4 w-4" />
                            Редактировать
                          </DropdownMenuItem>
                        )}
                        {!account.google_refresh_token ? (
                          canEdit && (
                            <DropdownMenuItem 
                              onClick={() => handleConnectGoogle(account)}
                              className="gap-2 cursor-pointer"
                            >
                              <Link2 className="h-4 w-4" />
                              Подключить Google Ads
                            </DropdownMenuItem>
                          )
                        ) : (
                          <>
                            <DropdownMenuItem 
                              onClick={() => handleConnectGoogle(account)}
                              className="gap-2 cursor-pointer"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Переподключить Google Ads
                            </DropdownMenuItem>
                            {canEdit && (
                              <DropdownMenuItem 
                                onClick={() => {
                                  setAccountToDisconnect(account);
                                  setShowDisconnectConfirm(true);
                                }}
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Unlink className="h-4 w-4" />
                                Отключить Google Ads
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                        {canEdit && (
                          <DropdownMenuItem 
                            onClick={() => handleConnectGoogleManual(account)}
                            className="gap-2 cursor-pointer"
                          >
                            <Settings2 className="h-4 w-4" />
                            OAuth настройки
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator className="bg-border/50" />
                            <DropdownMenuItem 
                              onClick={() => {
                                setAccountToDelete(account);
                                setShowDeleteConfirm(true);
                              }}
                              className="text-destructive gap-2 cursor-pointer focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Удалить
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="bg-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle>Детали MCC аккаунта</DialogTitle>
            <DialogDescription>
              Информация о MCC аккаунте
            </DialogDescription>
          </DialogHeader>
          {selectedAccount && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Название</p>
                  <p className="font-medium">{selectedAccount.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">MCC номер</p>
                  <p className="font-medium font-mono">{selectedAccount.mcc_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email менеджера</p>
                  <p className="font-medium">{selectedAccount.manager_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Статус</p>
                  <Badge variant={getStatusVariant(selectedAccount.status)} className="mt-1">
                    {getStatusLabel(selectedAccount.status)}
                  </Badge>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Developer Token</p>
                  <p className="font-medium font-mono text-sm bg-secondary/50 p-2 rounded mt-1 break-all">
                    {selectedAccount.developer_token}
                  </p>
                </div>
                {selectedAccount.google_refresh_token && (
                  <div className="col-span-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-sm text-green-500 font-medium flex items-center gap-2">
                      <Link2 className="h-4 w-4" />
                      Google Ads подключен
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedAccount.google_connected_email}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Создан</p>
                  <p className="font-medium">
                    {new Date(selectedAccount.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Закрыть
            </Button>
            {selectedAccount && !selectedAccount.google_refresh_token && (
              <Button onClick={() => {
                setShowDetails(false);
                handleConnectGoogle(selectedAccount);
              }} className="gap-2">
                <Link2 className="h-4 w-4" />
                Подключить Google Ads
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect Google Ads Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="bg-card border-border/50 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>OAuth настройки Google Ads</DialogTitle>
            <DialogDescription>
              Эта форма нужна только если для "{connectAccount?.name}" требуется собственный OAuth клиент Google Cloud.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-500">
              По умолчанию система использует наш опубликованный OAuth клиент, и от вас требуется лишь нажать «Подключить Google Ads» и войти под нужной почтой.
              Используйте эту форму только если Google требует подключить собственный OAuth проект для конкретного MCC.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Client ID (обязательно при сохранении своих данных)</label>
              <Input
                placeholder="669872731512-xxx.apps.googleusercontent.com"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Client Secret (обязательно при сохранении своих данных)</label>
              <Input
                placeholder="GOCSPX-xxx"
                value={googleClientSecret}
                onChange={(e) => setGoogleClientSecret(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Refresh Token (опционально)</label>
              <Input
                placeholder="1//0xxx"
                value={refreshToken}
                onChange={(e) => setRefreshToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Google аккаунта (обязательно, если есть Refresh Token)</label>
              <Input
                placeholder="dev@pestnovaltd.com"
                value={connectedEmail}
                onChange={(e) => setConnectedEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Email аккаунта с доступом к Google Ads MCC
              </p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-blue-400">
                <strong>Де взяти ці дані:</strong><br/>
                1. <a href="https://console.cloud.google.com/apis/credentials" target="_blank" className="underline">Google Cloud Console</a> → OAuth Client ID/Secret<br/>
                2. <a href="https://developers.google.com/oauthplayground" target="_blank" className="underline">OAuth Playground</a> → Refresh Token (при необходимости)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
              Отмена
            </Button>
            <Button 
              onClick={handleSaveGoogleConnection}
              disabled={saving || !googleClientId || !googleClientSecret || (!!refreshToken && !connectedEmail)}
              className="gap-2"
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Сохранить данные
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add MSS Account Dialog - Спрощена версія */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">🚀 Підключити MCC</DialogTitle>
            <DialogDescription>
              Введіть номер MCC і ми автоматично підключимо Google Ads
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">MCC номер *</label>
              <Input
                placeholder="521-179-6829 або 5211796829"
                value={newMccNumber}
                onChange={(e) => setNewMccNumber(e.target.value)}
                className="h-12 text-lg font-mono text-center"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Знайдіть у Google Ads → Налаштування → Ідентифікатор клієнта
              </p>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Назва (опціонально)</label>
              <Input
                placeholder="Моя компанія"
                value={newMccName}
                onChange={(e) => setNewMccName(e.target.value)}
              />
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
              <p className="text-sm text-green-400 text-center">
                <strong>Що буде далі:</strong><br/>
                1. Натискаєте "Підключити"<br/>
                2. Входите в Google акаунт з доступом до MCC<br/>
                3. Готово! ✨
              </p>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Скасувати
            </Button>
            <Button 
              onClick={handleAddAccount}
              disabled={adding || !newMccNumber.trim()}
              className="gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
            >
              {adding ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {adding ? "Підключення..." : "Підключити MCC"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить MCC аккаунт?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить "{accountToDelete?.name}"? 
              Это действие нельзя отменить. Все связанные Google Ads аккаунты также будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect Google Confirmation */}
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent className="bg-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить Google Ads?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отключить Google Ads от "{accountToDisconnect?.name}"?
              {accountToDisconnect?.google_connected_email && (
                <span className="block mt-2 text-muted-foreground">
                  Текущее подключение: {accountToDisconnect.google_connected_email}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Отмена</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisconnectGoogle}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? "Отключение..." : "Отключить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default Accounts;
