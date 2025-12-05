import { useState, useEffect } from "react";
import { ArrowRight, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface MSSAccount {
  id: string;
  name: string;
  mcc_number: string;
}

interface GoogleAdsAccount {
  id: string;
  customer_id: string;
  currency_code: string;
  status: string;
  mss_account_id: string;
}

const Transfer = () => {
  const navigate = useNavigate();
  const [mssAccounts, setMssAccounts] = useState<MSSAccount[]>([]);
  const [googleAdsAccounts, setGoogleAdsAccounts] = useState<GoogleAdsAccount[]>([]);
  const [fromMSS, setFromMSS] = useState("");
  const [toMSS, setToMSS] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (fromMSS) {
      loadGoogleAdsAccounts(fromMSS);
    } else {
      setGoogleAdsAccounts([]);
      setSelectedAccounts([]);
    }
  }, [fromMSS]);

  const loadData = async () => {
    try {
      const { data } = await supabase
        .from('mss_accounts')
        .select('*')
        .order('name');
      
      if (data) setMssAccounts(data);
    } catch (error) {
      console.error('Error loading MSS accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGoogleAdsAccounts = async (mssId: string) => {
    try {
      const { data } = await supabase
        .from('google_ads_accounts')
        .select('*')
        .eq('mss_account_id', mssId);
      
      if (data) setGoogleAdsAccounts(data);
    } catch (error) {
      console.error('Error loading Google Ads accounts:', error);
    }
  };

  const handleTransfer = async () => {
    if (!fromMSS || !toMSS || selectedAccounts.length === 0) {
      toast.error("Выберите источник, назначение и хотя бы один аккаунт");
      return;
    }

    if (fromMSS === toMSS) {
      toast.error("Источник и назначение не могут совпадать");
      return;
    }

    setTransferring(true);
    try {
      // Update accounts to new MSS
      const { error } = await supabase
        .from('google_ads_accounts')
        .update({ mss_account_id: toMSS })
        .in('id', selectedAccounts);

      if (error) throw error;

      const fromName = mssAccounts.find(m => m.id === fromMSS)?.name;
      const toName = mssAccounts.find(m => m.id === toMSS)?.name;
      
      toast.success(`${selectedAccounts.length} аккаунт(ов) перенесено из ${fromName} в ${toName}`);
      
      // Reset selection and reload
      setSelectedAccounts([]);
      loadGoogleAdsAccounts(fromMSS);
    } catch (error: any) {
      toast.error("Ошибка переноса: " + error.message);
    } finally {
      setTransferring(false);
    }
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  const toggleAll = () => {
    if (selectedAccounts.length === googleAdsAccounts.length) {
      setSelectedAccounts([]);
    } else {
      setSelectedAccounts(googleAdsAccounts.map(a => a.id));
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
            onClick={() => navigate("/dashboard")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Перенос аккаунтов</h1>
            <p className="text-muted-foreground text-sm">
              Переместить аккаунты между MCC платформами
            </p>
          </div>
        </div>

        {/* Source & Destination */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Источник</CardTitle>
              <CardDescription>Откуда переносить</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={fromMSS} onValueChange={setFromMSS}>
                <SelectTrigger className="h-11 ">
                  <SelectValue placeholder="Выберите источник" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border/50">
                  {mssAccounts.map(mss => (
                    <SelectItem key={mss.id} value={mss.id}>
                      {mss.name} ({mss.mcc_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="glass border-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Назначение</CardTitle>
              <CardDescription>Куда переносить</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={toMSS} onValueChange={setToMSS}>
                <SelectTrigger className="h-11 ">
                  <SelectValue placeholder="Выберите назначение" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border/50">
                  {mssAccounts
                    .filter(mss => mss.id !== fromMSS)
                    .map(mss => (
                      <SelectItem key={mss.id} value={mss.id}>
                        {mss.name} ({mss.mcc_number})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Accounts List */}
        <Card className="glass border-border/50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Аккаунты для переноса</CardTitle>
                <CardDescription>
                  {fromMSS 
                    ? `Найдено ${googleAdsAccounts.length} аккаунт(ов)` 
                    : "Выберите источник для отображения аккаунтов"}
                </CardDescription>
              </div>
              {googleAdsAccounts.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={toggleAll}
                  className="h-8"
                >
                  {selectedAccounts.length === googleAdsAccounts.length ? "Снять все" : "Выбрать все"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!fromMSS ? (
              <div className="text-center py-8 text-muted-foreground">
                Выберите источник MCC
              </div>
            ) : googleAdsAccounts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Нет аккаунтов в выбранном MCC
              </div>
            ) : (
              <div className="space-y-2">
                {googleAdsAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 p-4 rounded-xl bg-secondary/30 border border-border/50 hover:border-border transition-colors cursor-pointer"
                    onClick={() => toggleAccount(account.id)}
                  >
                    <Checkbox
                      checked={selectedAccounts.includes(account.id)}
                      onCheckedChange={() => toggleAccount(account.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium font-mono">{account.customer_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.currency_code} · {account.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">
            {selectedAccounts.length} аккаунт(ов) выбрано
          </p>
          <Button
            onClick={handleTransfer}
            disabled={!fromMSS || !toMSS || selectedAccounts.length === 0 || transferring}
            className="gap-2"
          >
            {transferring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Перенос...
              </>
            ) : (
              <>
                Начать перенос
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Transfer;
