import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_CLIENT_ID = '572283707219-ndq1o9qi0k5uh3eucrb0e80imfabftrl.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';
const API_VERSION = 'v22';

function getDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  
  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  return { start: format(start), end: format(end) };
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase configuration');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { mssAccountId, accountIds } = await req.json();

    if (!mssAccountId || !accountIds || !Array.isArray(accountIds)) {
      throw new Error('mssAccountId and accountIds[] required');
    }

    // Get MSS account
    const { data: mssAccount, error: mssError } = await supabase
      .from('mss_accounts')
      .select('*')
      .eq('id', mssAccountId)
      .single();

    if (mssError || !mssAccount) throw new Error('MSS account not found');
    if (!mssAccount.google_refresh_token) throw new Error('Google Ads не подключен');

    const clientId = mssAccount.google_client_id || DEFAULT_CLIENT_ID;
    const clientSecret = mssAccount.google_client_secret || DEFAULT_CLIENT_SECRET;
    const accessToken = await getAccessToken(mssAccount.google_refresh_token, clientId, clientSecret);
    const mccId = mssAccount.mcc_number.replace(/-/g, '');

    const { start, end } = getDateRange();
    
    console.log(`MSS: ${mssAccount.name}, MCC: ${mccId}`);
    console.log(`Date range: ${start} to ${end}`);
    console.log(`Fetching metrics for ${accountIds.length} accounts: ${accountIds.slice(0, 5).join(', ')}...`);

    // Fetch metrics for all accounts in parallel
    const metricsPromises = accountIds.map(async (customerId: string) => {
      try {
        // Try without date filter first to see if there's ANY data
        const query = `
          SELECT 
            metrics.clicks,
            metrics.impressions,
            metrics.cost_micros,
            metrics.conversions
          FROM campaign
        `;

        const response = await fetch(
          `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/googleAds:search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'developer-token': mssAccount.developer_token,
              'Content-Type': 'application/json',
              'login-customer-id': mccId,
            },
            body: JSON.stringify({ query }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.log(`Error for ${customerId}: ${response.status} - ${errText.slice(0, 300)}`);
          return { accountId: customerId, metrics: null };
        }

        const responseText = await response.text();
        console.log(`Account ${customerId} RAW response: ${responseText.slice(0, 500)}`);
        
        const data = JSON.parse(responseText);
        const results = data.results || [];
        
        console.log(`Account ${customerId}: ${results.length} campaign rows`);

        let clicks = 0, impressions = 0, costMicros = 0, conversions = 0;
        for (const row of results) {
          const m = row.metrics || {};
          clicks += parseInt(m.clicks || '0');
          impressions += parseInt(m.impressions || '0');
          costMicros += parseInt(m.costMicros || '0');
          conversions += parseFloat(m.conversions || '0');
        }
        
        if (clicks > 0 || impressions > 0) {
          console.log(`Account ${customerId}: ${clicks} clicks, ${impressions} imp`);
        }

        const cost = costMicros / 1_000_000;
        return {
          accountId: customerId,
          metrics: {
            clicks,
            impressions,
            cost: Math.round(cost * 100) / 100,
            ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
            conversions: Math.round(conversions * 100) / 100,
            avgCpc: clicks > 0 ? Math.round((cost / clicks) * 100) / 100 : 0,
          }
        };
      } catch (e) {
        return { accountId: customerId, metrics: null };
      }
    });

    const results = await Promise.all(metricsPromises);
    
    // Build response map
    const metricsMap: Record<string, any> = {};
    let totals = { clicks: 0, impressions: 0, cost: 0, conversions: 0 };
    
    for (const r of results) {
      if (r.metrics) {
        metricsMap[r.accountId] = r.metrics;
        totals.clicks += r.metrics.clicks;
        totals.impressions += r.metrics.impressions;
        totals.cost += r.metrics.cost;
        totals.conversions += r.metrics.conversions;
      }
    }
    
    console.log(`Total: ${Object.keys(metricsMap).length} accounts with metrics`);
    console.log(`Totals: ${totals.clicks} clicks, ${totals.impressions} imp, $${totals.cost}`);

    return new Response(
      JSON.stringify({
        success: true,
        metrics: metricsMap,
        totals: {
          ...totals,
          cost: Math.round(totals.cost * 100) / 100,
          conversions: Math.round(totals.conversions * 100) / 100,
        },
        dateRange: { start, end }
      }),
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

