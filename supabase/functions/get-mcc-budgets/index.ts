import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_CLIENT_ID = '669872731512-e0ukp41pdeg631rj6s7jodd1b4uth8mf.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';
const API_VERSION = 'v22';

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
    const { mssAccountId } = await req.json();

    if (!mssAccountId) throw new Error('MSS Account ID is required');

    // Get MSS account
    const { data: mssAccount, error: mssError } = await supabase
      .from('mss_accounts')
      .select('*')
      .eq('id', mssAccountId)
      .single();

    if (mssError || !mssAccount) throw new Error('MSS account not found');
    if (!mssAccount.google_refresh_token) throw new Error('Google Ads не підключений');

    const clientId = mssAccount.google_client_id || DEFAULT_CLIENT_ID;
    const clientSecret = mssAccount.google_client_secret || DEFAULT_CLIENT_SECRET;
    const accessToken = await getAccessToken(mssAccount.google_refresh_token, clientId, clientSecret);
    const mccId = mssAccount.mcc_number.replace(/-/g, '');

    console.log('💰 Fetching budgets from MCC:', mccId);

    // Get account budgets directly from MCC
    const budgetQuery = `
      SELECT 
        account_budget.status,
        account_budget.approved_spending_limit_micros,
        account_budget.adjusted_spending_limit_micros,
        account_budget.amount_micros
      FROM account_budget
      WHERE account_budget.status = 'APPROVED'
    `;

    let totalBudget = 0;
    let totalSpent = 0;
    let accountsWithBudget = 0;

    // Try to get budgets from the MCC itself
    try {
      const response = await fetch(
        `https://googleads.googleapis.com/${API_VERSION}/customers/${mccId}/googleAds:search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': mssAccount.developer_token,
            'Content-Type': 'application/json',
            'login-customer-id': mccId,
          },
          body: JSON.stringify({ query: budgetQuery }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Budget results:', JSON.stringify(data).substring(0, 500));
        
        for (const result of (data.results || [])) {
          const budget = result.accountBudget;
          const limitMicros = budget.approvedSpendingLimitMicros || budget.adjustedSpendingLimitMicros || '0';
          const spentMicros = budget.amountMicros || '0';
          
          // Handle "infinite" budgets
          if (limitMicros !== '-1' && limitMicros !== '0') {
            totalBudget += Number(limitMicros) / 1000000;
            totalSpent += Number(spentMicros) / 1000000;
            accountsWithBudget++;
          }
        }
      } else {
        const errText = await response.text();
        console.log('Budget query returned:', response.status, errText.substring(0, 200));
      }
    } catch (e: any) {
      console.log('Budget fetch error:', e.message);
    }

    const totalRemaining = Math.max(0, totalBudget - totalSpent);
    const percentUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    console.log(`✅ Budgets: $${totalBudget.toFixed(2)} total, $${totalSpent.toFixed(2)} spent, ${accountsWithBudget} accounts`);

    const cacheData = {
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      percentUsed,
      accountsWithBudget,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache in database
    try {
      await supabase
        .from('mss_metrics_cache')
        .upsert({
          mss_account_id: mssAccountId,
          total_budget: cacheData.totalBudget,
          total_spent: cacheData.totalSpent,
          total_remaining: cacheData.totalRemaining,
          percent_used: cacheData.percentUsed,
          last_updated_at: cacheData.lastUpdated,
        }, { onConflict: 'mss_account_id' });
    } catch (e) {
      console.log('Cache update skipped');
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...cacheData
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
