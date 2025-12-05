import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Plus, X, Loader2, Star, Check, AlertCircle, Link2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EmailEntry {
  id: string;
  email: string;
  accessLevel: 'admin' | 'standard' | 'read';
}

interface MSSAccount {
  id: string;
  name: string;
  mcc_number: string;
  manager_email: string;
  developer_token: string;
  google_refresh_token?: string;
  google_connected_email?: string;
}

interface Manager {
  id: string;
  name: string;
  email: string;
}

interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  is_default: boolean;
}

interface Timezone {
  id: string;
  name: string;
  timezone_offset: string;
  flag_emoji: string;
  country: string;
}

const AddAccount = () => {
  const navigate = useNavigate();
  const { canCreate } = useAuth();
  const [mssAccounts, setMssAccounts] = useState<MSSAccount[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [timezones, setTimezones] = useState<Timezone[]>([]);
  
  const [selectedMSS, setSelectedMSS] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);
  const [favoriteCurrencies, setFavoriteCurrencies] = useState<string[]>(['USD', 'EUR', 'UAH', 'PLN']);
  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [emails, setEmails] = useState<EmailEntry[]>([
    { id: crypto.randomUUID(), email: "", accessLevel: "admin" }
  ]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [mssRes, managersRes, currenciesRes, timezonesRes] = await Promise.all([
        supabase.from('mss_accounts').select('*'),
        supabase.from('managers').select('*'),
        supabase.from('currencies').select('*').order('code'),
        supabase.from('timezones').select('*').order('timezone_offset')
      ]);
      
      if (mssRes.data) setMssAccounts(mssRes.data);
      if (managersRes.data) setManagers(managersRes.data);
      if (currenciesRes.data) setCurrencies(currenciesRes.data);
      if (timezonesRes.data) setTimezones(timezonesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoadingData(false);
    }
  };

  const addEmailEntry = () => {
    if (emails.length < 20) {
      setEmails([...emails, { id: crypto.randomUUID(), email: "", accessLevel: "admin" }]);
    } else {
      toast.error("Максимум 20 email адресов");
    }
  };

  const removeEmailEntry = (id: string) => {
    if (emails.length > 1) {
      setEmails(emails.filter(e => e.id !== id));
    }
  };

  const updateEmail = (id: string, field: keyof EmailEntry, value: string) => {
    setEmails(emails.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const toggleFavoriteCurrency = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteCurrencies(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validEmails = emails.filter(e => e.email.trim() !== '');
    if (validEmails.length === 0) {
      toast.error("Введите хотя бы один email адрес");
      return;
    }

    if (!selectedMSS || !selectedManager || !selectedCurrency || !selectedTimezone) {
      toast.error("Заполните все обязательные поля");
      return;
    }

    // Check if Google Ads is connected
    if (!selectedMSSData?.google_refresh_token) {
      toast.error("Google Ads не подключен к выбранному MCC. Сначала подключите Google Ads в разделе Аккаунты.");
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmCreate = async () => {
    setIsCreating(true);
    
    try {
      const validEmails = emails.filter(e => e.email.trim() !== '');
      const payload = {
        mssAccountId: selectedMSS,
        managerId: selectedManager,
        currency: selectedCurrency,
        timezone: selectedTimezone,
        emails: validEmails.map(e => ({
          email: e.email,
          accessLevel: e.accessLevel
        }))
      };

      console.log('Invoking Supabase function create-google-ads-accounts with:', payload);

      const { data, error } = await supabase.functions.invoke('create-google-ads-accounts', {
        body: payload
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || "Ошибка вызова функции");
      }

      if (!data?.success) {
        const backendError = data?.errors?.[0]?.error;
        throw new Error(
          backendError ||
          data?.error ||
          data?.details?.message ||
          "Ошибка создания аккаунтов"
        );
      }

      const createdCount = data.summary?.accountsCreated 
        ?? data.accounts?.length 
        ?? 0;

      toast.success(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span>{createdCount} аккаунт(ов) создано!</span>
          </div>
          {data.testMode && (
            <span className="text-xs text-muted-foreground">
              Тестовый режим включен — аккаунты не созданы в Google Ads
            </span>
          )}
        </div>
      );

      if (data.errors?.length) {
        toast.error(`Ошибки по ${data.errors.length} email: ${data.errors[0].error}`);
      }

      setShowConfirmDialog(false);
      setTimeout(() => navigate("/accounts"), 1500);
    } catch (error: any) {
      console.error('Error creating accounts:', error);
      toast.error(error.message || "Ошибка при создании аккаунтов");
    } finally {
      setIsCreating(false);
    }
  };

  // Показываем избранные валюты или все
  const displayedCurrencies = showAllCurrencies 
    ? currencies 
    : currencies.filter(c => favoriteCurrencies.includes(c.code));

  const selectedMSSData = mssAccounts.find(m => m.id === selectedMSS);
  const selectedManagerData = managers.find(m => m.id === selectedManager);
  const selectedTimezoneData = timezones.find(t => t.id === selectedTimezone);
  const selectedCurrencyData = currencies.find(c => c.code === selectedCurrency);
  const validEmails = emails.filter(e => e.email.trim() !== '');

  const getAccessLevelLabel = (level: string) => {
    switch (level) {
      case 'admin': return 'Админ';
      case 'standard': return 'Стандарт';
      case 'read': return 'Чтение';
      default: return level;
    }
  };

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Check permissions
  if (!canCreate) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Нет доступа</h2>
          <p className="text-muted-foreground">
            У вас нет прав для создания аккаунтов. Обратитесь к администратору.
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/accounts")}
          >
            Вернуться к аккаунтам
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
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
          <div>
            <h1 className="text-2xl font-bold">Создать аккаунт</h1>
            <p className="text-muted-foreground text-sm">
              Создание Google Ads аккаунтов с приглашениями
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: MSS Selection */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">1</Badge>
                <CardTitle className="text-base">Выберите MCC</CardTitle>
              </div>
              <CardDescription>
                MCC аккаунт для создания новых аккаунтов
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mssAccounts.length === 0 ? (
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
                  <p className="text-muted-foreground text-sm">Нет MCC аккаунтов</p>
                  <Button 
                    variant="link" 
                    className="text-sm"
                    onClick={() => navigate("/accounts?addMss=true")}
                  >
                    Добавить MCC
                  </Button>
                </div>
              ) : (
                <Select value={selectedMSS} onValueChange={setSelectedMSS}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Выберите MCC аккаунт" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50">
                    {mssAccounts.map(mss => (
                      <SelectItem key={mss.id} value={mss.id} className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <span className="font-medium">{mss.name}</span>
                            <span className="text-xs text-muted-foreground">MCC: {mss.mcc_number}</span>
                          </div>
                          {mss.google_refresh_token ? (
                            <Badge variant="outline" className="ml-auto bg-green-500/10 text-green-500 border-green-500/30 text-xs gap-1">
                              <Link2 className="h-3 w-3" />
                              Подключен
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="ml-auto bg-yellow-500/10 text-yellow-500 border-yellow-500/30 text-xs">
                              Не подключен
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedMSSData && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  selectedMSSData.google_refresh_token 
                    ? 'bg-green-500/5 border border-green-500/20' 
                    : 'bg-yellow-500/5 border border-yellow-500/20'
                }`}>
                  {selectedMSSData.google_refresh_token ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <Link2 className="h-4 w-4" />
                      <span>Google Ads подключен: {selectedMSSData.google_connected_email}</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-yellow-500">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="font-medium">Google Ads не подключен!</span>
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Сначала подключите Google Ads в разделе{" "}
                        <Button 
                          variant="link" 
                          className="h-auto p-0 text-xs text-primary"
                          onClick={() => navigate("/accounts")}
                        >
                          Аккаунты
                        </Button>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Manager Selection */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">2</Badge>
                <CardTitle className="text-base">Выберите менеджера</CardTitle>
              </div>
              <CardDescription>
                Менеджер который будет создавать аккаунты
              </CardDescription>
            </CardHeader>
            <CardContent>
              {managers.length === 0 ? (
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
                  <p className="text-muted-foreground text-sm">Нет менеджеров</p>
                </div>
              ) : (
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Выберите менеджера" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50">
                    {managers.map(manager => (
                      <SelectItem key={manager.id} value={manager.id} className="py-3">
                        <div className="flex flex-col">
                          <span className="font-medium">{manager.name}</span>
                          <span className="text-xs text-muted-foreground">{manager.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Currency Selection */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">3</Badge>
                  <CardTitle className="text-base">Выберите валюту</CardTitle>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllCurrencies(!showAllCurrencies)}
                  className="text-xs h-8 gap-1"
                >
                  {showAllCurrencies ? "Показать избранные" : "Показать все валюты"}
                </Button>
              </div>
              <CardDescription>
                Нажмите ⭐ чтобы добавить в избранные
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {displayedCurrencies.map(currency => (
                  <div 
                    key={currency.id} 
                    className={`relative flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedCurrency === currency.code 
                        ? 'bg-primary/10 border-primary/50 ring-1 ring-primary/30' 
                        : ' hover:border-border'
                    }`}
                    onClick={() => setSelectedCurrency(currency.code)}
                  >
                    <button
                      type="button"
                      onClick={(e) => toggleFavoriteCurrency(currency.code, e)}
                      className="absolute top-1 right-1 p-1 hover:bg-background/50 rounded"
                    >
                      <Star className={`h-3 w-3 ${favoriteCurrencies.includes(currency.code) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/50'}`} />
                    </button>
                    <span className="text-lg">{currency.symbol}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{currency.code}</span>
                    </div>
                    {selectedCurrency === currency.code && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 4: Timezone Selection */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">4</Badge>
                <CardTitle className="text-base">Выберите часовой пояс</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {timezones.length === 0 ? (
                <div className="p-4 rounded-lg bg-secondary/30 border border-border/50 text-center">
                  <p className="text-muted-foreground text-sm">Нет часовых поясов</p>
                </div>
              ) : (
                <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Выберите часовой пояс" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border/50 max-h-[300px]">
                    {timezones.map(tz => (
                      <SelectItem key={tz.id} value={tz.id} className="py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{tz.flag_emoji}</span>
                          <div className="flex flex-col">
                            <span className="font-medium">{tz.name}</span>
                            <span className="text-xs text-muted-foreground">UTC{tz.timezone_offset}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Step 5: Email Addresses */}
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">5</Badge>
                <CardTitle className="text-base">Email адреса для приглашений</CardTitle>
              </div>
              <CardDescription>
                Введите до 20 email. Для каждого email будет создан отдельный аккаунт.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {emails.map((entry, index) => (
                <div key={entry.id} className="flex gap-2 items-center">
                  <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-xs font-medium text-muted-foreground flex-shrink-0">
                    {index + 1}
                  </div>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={entry.email}
                    onChange={(e) => updateEmail(entry.id, 'email', e.target.value)}
                    className="h-11 flex-1 "
                  />
                  <Select
                    value={entry.accessLevel}
                    onValueChange={(value) => updateEmail(entry.id, 'accessLevel', value)}
                  >
                    <SelectTrigger className="w-[130px] h-11 ">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border/50">
                      <SelectItem value="admin">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary"></span>
                          Админ
                        </span>
                      </SelectItem>
                      <SelectItem value="standard">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-blue-400"></span>
                          Стандарт
                        </span>
                      </SelectItem>
                      <SelectItem value="read">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground"></span>
                          Чтение
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {emails.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEmailEntry(entry.id)}
                      className="h-11 w-11 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {emails.length < 20 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addEmailEntry}
                  className="w-full h-11 gap-2 border-dashed"
                >
                  <Plus className="h-4 w-4" />
                  Добавить email ({emails.length}/20)
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Summary & Actions */}
          <Card className="glass border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Аккаунтов: </span>
                    <span className="font-bold text-primary">{validEmails.length}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Валюта: </span>
                    <span className="font-medium">{selectedCurrency || '—'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/accounts")}
                  >
                    Отмена
                  </Button>
                  <Button 
                    type="submit" 
                    className="gap-2" 
                    disabled={validEmails.length === 0 || !selectedMSSData?.google_refresh_token}
                  >
                    <Save className="h-4 w-4" />
                    Создать {validEmails.length > 0 ? `(${validEmails.length})` : ''}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* Confirm Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="bg-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Подтверждение создания аккаунтов
              </DialogTitle>
              <DialogDescription>
                Проверьте параметры перед созданием
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* MSS Info */}
              <div className="p-4 rounded-xl bg-secondary/30 border border-border/50 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">MSS</p>
                    <p className="font-semibold">{selectedMSSData?.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedMSSData?.mcc_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Менеджер</p>
                    <p className="font-semibold">{selectedManagerData?.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedManagerData?.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t border-border/50">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Валюта</p>
                    <p className="font-semibold">{selectedCurrencyData?.symbol} {selectedCurrency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Часовой пояс</p>
                    <p className="font-semibold">{selectedTimezoneData?.flag_emoji} {selectedTimezoneData?.name}</p>
                  </div>
                </div>
              </div>

              {/* Accounts to create */}
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">
                  Будет создано аккаунтов: <span className="text-primary font-bold">{validEmails.length}</span>
                </p>
                <div className="max-h-[200px] overflow-y-auto space-y-2">
                  {validEmails.map((entry, index) => (
                    <div key={entry.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/20 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{index + 1}.</span>
                        <span className="font-mono">{entry.email}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {getAccessLevelLabel(entry.accessLevel)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
                <p className="text-yellow-500 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  На каждый email будет отправлено приглашение с указанным уровнем доступа
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                disabled={isCreating}
              >
                Отмена
              </Button>
              <Button onClick={confirmCreate} disabled={isCreating} className="gap-2">
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Создать {validEmails.length} аккаунт(ов)
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default AddAccount;
