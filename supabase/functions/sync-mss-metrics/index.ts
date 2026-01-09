import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OAuth credentials
const DEFAULT_CLIENT_ID = '669872731512-e0ukp41pdeg631rj6s7jodd1b4uth8mf.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';
const API_VERSION = 'v22';

// Get date range for metrics (last 30 days)
function getDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  
  const format = (d: Date) => d.toISOString().split('T')[0];
  return { start: format(start), end: format(end) };
}

// Get fresh access token
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
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

// Fetch aggregated metrics for entire MCC
async function getMccMetrics(
  mccId: string,
  accessToken: string,
  developerToken: string,
  accountIds: string[]
): Promise<{ clicks: number; impressions: number; cost: number; conversions: number }> {
  const { start, end } = getDateRange();
  
  // Query metrics from campaigns for each account
  const metricsQuery = `
    SELECT 
      metrics.clicks,
      metrics.impressions,
      metrics.cost_micros,
      metrics.conversions
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
  `;

  let totalClicks = 0;
  let totalImpressions = 0;
  let totalCostMicros = 0;
  let totalConversions = 0;

  // Only fetch first 5 accounts to minimize API calls
  const accountsToFetch = accountIds.slice(0, 5);

  for (const customerId of accountsToFetch) {
    try {
      const response = await fetch(
        `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': developerToken,
            'Content-Type': 'application/json',
            'login-customer-id': mccId,
          },
          body: JSON.stringify({ query: metricsQuery }),
        }
      );

      if (response.status === 429) {
        console.log(`Rate limited, skipping remaining accounts...`);
        break;
      }

      if (response.ok) {
        const data = await response.json();
        for (const row of data.results || []) {
          const m = row.metrics || {};
          totalClicks += parseInt(m.clicks || '0');
          totalImpressions += parseInt(m.impressions || '0');
          totalCostMicros += parseInt(m.costMicros || '0');
          totalConversions += parseFloat(m.conversions || '0');
        }
      }

      // Delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.log(`Error fetching metrics for ${customerId}:`, e);
    }
  }

  return {
    clicks: totalClicks,
    impressions: totalImpressions,
    cost: totalCostMicros / 1_000_000,
    conversions: totalConversions,
  };
}

// Get account and folder counts and IDs
async function getAccountCounts(
  mccId: string,
  accessToken: string,
  developerToken: string
): Promise<{ accountCount: number; folderCount: number; accountIds: string[] }> {
  const query = `
    SELECT 
      customer_client.id,
      customer_client.manager
    FROM customer_client
  `;

  try {
    const response = await fetch(
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
      if (response.status === 429) {
        console.log(`Rate limited for MCC ${mccId}, skipping...`);
      }
      return { accountCount: 0, folderCount: 0, accountIds: [] };
    }

    const data = await response.json();
    const results = data.results || [];
    
    const accounts = results.filter((r: any) => !r.customerClient?.manager);
    const folders = results.filter((r: any) => r.customerClient?.manager && r.customerClient?.id !== mccId);
    const accountIds = accounts.map((r: any) => r.customerClient?.id).filter(Boolean);

    return {
      accountCount: accounts.length,
      folderCount: folders.length,
      accountIds,
    };
  } catch (e) {
    return { accountCount: 0, folderCount: 0, accountIds: [] };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get optional mssAccountId to sync specific MSS only
    let mssAccountId: string | null = null;
    try {
      const body = await req.json();
      mssAccountId = body.mssAccountId || null;
    } catch {
      // No body, sync all
    }

    // Get MSS accounts to sync
    let query = supabase
      .from('mss_accounts')
      .select('*')
      .not('google_refresh_token', 'is', null);
    
    if (mssAccountId) {
      query = query.eq('id', mssAccountId);
    }

    const { data: mssAccounts, error: mssError } = await query;

    if (mssError) {
      throw new Error('Failed to fetch MSS accounts');
    }

    const results: any[] = [];

    for (const mss of mssAccounts || []) {
      console.log(`Syncing metrics for ${mss.name}...`);
      
      try {
        const clientId = mss.google_client_id || DEFAULT_CLIENT_ID;
        const clientSecret = mss.google_client_secret || DEFAULT_CLIENT_SECRET;
        const mccId = mss.mcc_number.replace(/-/g, '');

        const accessToken = await getAccessToken(mss.google_refresh_token, clientId, clientSecret);

        // Get counts and account IDs first
        const { accountCount, folderCount, accountIds } = await getAccountCounts(mccId, accessToken, mss.developer_token);

        // Get metrics (only if we have accounts)
        const metrics = accountIds.length > 0 
          ? await getMccMetrics(mccId, accessToken, mss.developer_token, accountIds)
          : { clicks: 0, impressions: 0, cost: 0, conversions: 0 };

        const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0;
        const avgCpc = metrics.clicks > 0 ? metrics.cost / metrics.clicks : 0;

        // Upsert to cache table
        const { error: upsertError } = await supabase
          .from('mss_metrics_cache')
          .upsert({
            mss_account_id: mss.id,
            total_clicks: metrics.clicks,
            total_impressions: metrics.impressions,
            total_cost: Math.round(metrics.cost * 100) / 100,
            total_conversions: Math.round(metrics.conversions * 100) / 100,
            avg_cpc: Math.round(avgCpc * 100) / 100,
            ctr: Math.round(ctr * 100) / 100,
            account_count: accountCount,
            folder_count: folderCount,
            last_updated_at: new Date().toISOString(),
          }, {
            onConflict: 'mss_account_id',
          });

        if (upsertError) {
          console.log(`Failed to save metrics for ${mss.name}:`, upsertError);
        }

        results.push({
          mss: mss.name,
          success: true,
          metrics: {
            clicks: metrics.clicks,
            impressions: metrics.impressions,
            cost: metrics.cost,
            accountCount,
            folderCount,
          }
        });

        console.log(`✅ ${mss.name}: ${metrics.clicks} clicks, $${metrics.cost}`);

        // Delay between MSS accounts
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (e: any) {
        console.log(`❌ ${mss.name}: ${e.message}`);
        results.push({
          mss: mss.name,
          success: false,
          error: e.message
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

