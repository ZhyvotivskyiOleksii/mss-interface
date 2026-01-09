import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_CLIENT_ID = '669872731512-e0ukp41pdeg631rj6s7jodd1b4uth8mf.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';
const API_VERSION = 'v22';

function getDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { 
    start: start.toISOString().split('T')[0], 
    end: end.toISOString().split('T')[0] 
  };
}

async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(`OAuth error: ${data.error_description || data.error}`);
  return data.access_token;
}

// Retry з затримкою при 429
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const waitTime = Math.pow(2, i + 1) * 5000; // 10s, 20s, 40s
      console.log(`Rate limited, waiting ${waitTime/1000}s before retry ${i + 1}/${maxRetries}...`);
      await new Promise(r => setTimeout(r, waitTime));
      continue;
    }
    
    return response;
  }
  
  // Остання спроба
  return fetch(url, options);
}

// Отримати всі акаунти під MCC
async function getAllAccounts(mccId: string, accessToken: string, developerToken: string) {
  const query = `
    SELECT 
      customer_client.id,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.manager,
      customer_client.status
    FROM customer_client
    WHERE customer_client.manager = false
  `;

  const response = await fetchWithRetry(
    `https://googleads.googleapis.com/${API_VERSION}/customers/${mccId}/googleAds:search`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
        'login-customer-id': mccId,
      },
      body: JSON.stringify({ query }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get accounts: ${response.status} - ${error.slice(0, 200)}`);
  }

  const data = await response.json();
  return (data.results || []).map((r: any) => ({
    id: r.customerClient?.id,
    name: r.customerClient?.descriptiveName || `Account ${r.customerClient?.id}`,
    currency: r.customerClient?.currencyCode,
    timezone: r.customerClient?.timeZone,
    isManager: r.customerClient?.manager,
    status: r.customerClient?.status,
  }));
}

// Отримати метрики для одного акаунта
async function getAccountMetrics(
  customerId: string,
  mccId: string,
  accessToken: string,
  developerToken: string,
  dateRange: { start: string; end: string }
) {
  const query = `
    SELECT 
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${dateRange.start}' AND '${dateRange.end}'
  `;

  try {
    const response = await fetchWithRetry(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json',
          'login-customer-id': mccId,
        },
        body: JSON.stringify({ query }),
      },
      2 // менше retry для окремих акаунтів
    );

    if (!response.ok) {
      // Пропускаємо акаунти без доступу
      return { clicks: 0, impressions: 0, costMicros: 0, conversions: 0 };
    }

    const data = await response.json();
    let clicks = 0, impressions = 0, costMicros = 0, conversions = 0;

    for (const row of data.results || []) {
      const m = row.metrics || {};
      clicks += parseInt(m.clicks || '0');
      impressions += parseInt(m.impressions || '0');
      costMicros += parseInt(m.costMicros || '0');
      conversions += parseFloat(m.conversions || '0');
    }

    return { clicks, impressions, costMicros, conversions };
  } catch (e) {
    return { clicks: 0, impressions: 0, costMicros: 0, conversions: 0 };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let mssAccountId: string | null = null;
    try {
      const body = await req.json();
      mssAccountId = body.mssAccountId || null;
    } catch {}

    // Отримати MSS акаунти
    let query = supabase
      .from('mss_accounts')
      .select('*')
      .not('google_refresh_token', 'is', null);
    
    if (mssAccountId) {
      query = query.eq('id', mssAccountId);
    }

    const { data: mssAccounts, error: mssError } = await query;
    if (mssError) throw new Error('Failed to fetch MSS accounts');

    const dateRange = getDateRange();
    const results: any[] = [];

    for (const mss of mssAccounts || []) {
      console.log(`\n📊 Syncing ${mss.name}...`);
      
      try {
        const clientId = mss.google_client_id || DEFAULT_CLIENT_ID;
        const clientSecret = mss.google_client_secret || DEFAULT_CLIENT_SECRET;
        const mccId = mss.mcc_number.replace(/-/g, '');
        const accessToken = await getAccessToken(mss.google_refresh_token, clientId, clientSecret);

        // Отримати всі акаунти
        const accounts = await getAllAccounts(mccId, accessToken, mss.developer_token);
        console.log(`Found ${accounts.length} accounts`);

        // Отримати метрики для кожного акаунта
        const accountsWithMetrics: any[] = [];
        let totalClicks = 0, totalImpressions = 0, totalCostMicros = 0, totalConversions = 0;

        for (let i = 0; i < accounts.length; i++) {
          const acc = accounts[i];
          
          // Більша пауза щоб не бити по ліміту (200мс між запитами, 2с кожні 5 акаунтів)
          if (i > 0) {
            await new Promise(r => setTimeout(r, 200));
          }
          if (i > 0 && i % 5 === 0) {
            await new Promise(r => setTimeout(r, 2000));
          }

          const metrics = await getAccountMetrics(acc.id, mccId, accessToken, mss.developer_token, dateRange);
          
          const cost = metrics.costMicros / 1_000_000;
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
          const avgCpc = metrics.clicks > 0 ? cost / metrics.clicks : 0;

          accountsWithMetrics.push({
            mss_account_id: mss.id,
            customer_id: acc.id,
            customer_name: acc.name,
            currency_code: acc.currency,
            timezone: acc.timezone,
            is_manager: acc.isManager,
            status: acc.status,
            clicks: metrics.clicks,
            impressions: metrics.impressions,
            cost_micros: metrics.costMicros,
            cost: Math.round(cost * 100) / 100,
            conversions: Math.round(metrics.conversions * 100) / 100,
            ctr: Math.round(ctr * 100) / 100,
            avg_cpc: Math.round(avgCpc * 100) / 100,
            metrics_date_from: dateRange.start,
            metrics_date_to: dateRange.end,
            last_updated_at: new Date().toISOString(),
          });

          totalClicks += metrics.clicks;
          totalImpressions += metrics.impressions;
          totalCostMicros += metrics.costMicros;
          totalConversions += metrics.conversions;
        }

        // Видалити старі дані для цього MSS
        await supabase
          .from('account_metrics_cache')
          .delete()
          .eq('mss_account_id', mss.id);

        // Вставити нові дані батчами по 100
        for (let i = 0; i < accountsWithMetrics.length; i += 100) {
          const batch = accountsWithMetrics.slice(i, i + 100);
          const { error: insertError } = await supabase
            .from('account_metrics_cache')
            .insert(batch);
          
          if (insertError) {
            console.log(`Insert error:`, insertError);
          }
        }

        // Оновити загальні метрики MSS
        const totalCost = totalCostMicros / 1_000_000;
        await supabase
          .from('mss_metrics_cache')
          .upsert({
            mss_account_id: mss.id,
            total_clicks: totalClicks,
            total_impressions: totalImpressions,
            total_cost: Math.round(totalCost * 100) / 100,
            total_conversions: Math.round(totalConversions * 100) / 100,
            account_count: accounts.length,
            folder_count: 0, // Можна додати пізніше
            last_updated_at: new Date().toISOString(),
          }, { onConflict: 'mss_account_id' });

        console.log(`✅ ${mss.name}: ${accounts.length} accounts, ${totalClicks} clicks, $${Math.round(totalCost)}`);

        results.push({
          mss: mss.name,
          success: true,
          accounts: accounts.length,
          clicks: totalClicks,
          cost: Math.round(totalCost * 100) / 100,
        });

        // Пауза між MCC (5 секунд)
        await new Promise(r => setTimeout(r, 5000));

      } catch (e: any) {
        console.log(`❌ ${mss.name}: ${e.message}`);
        results.push({ mss: mss.name, success: false, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results, syncedAt: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});

