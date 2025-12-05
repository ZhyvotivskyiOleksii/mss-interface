import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_CLIENT_ID = '572283707219-ndq1o9qi0k5uh3eucrb0e80imfabftrl.apps.googleusercontent.com';
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

    // Get all customer IDs first
    const customerQuery = `
      SELECT customer_client.id
      FROM customer_client
      WHERE customer_client.manager = false
    `;

    const customerResponse = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${mccId}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': mssAccount.developer_token,
          'Content-Type': 'application/json',
          'login-customer-id': mccId,
        },
        body: JSON.stringify({ query: customerQuery, pageSize: 10000 }),
      }
    );

    if (!customerResponse.ok) {
      throw new Error(`Failed to get customers: ${customerResponse.status}`);
    }

    const customerData = await customerResponse.json();
    const customerIds = (customerData.results || []).map((r: any) => r.customerClient.id);
    
    console.log(`📊 Found ${customerIds.length} accounts, fetching budgets...`);

    // Fetch budgets for each account (batch by chunks)
    let totalBudget = 0;
    let totalSpent = 0;
    let totalRemaining = 0;
    let accountsWithBudget = 0;

    // Process in chunks of 50 to avoid rate limiting
    const chunkSize = 50;
    const chunks = [];
    for (let i = 0; i < customerIds.length; i += chunkSize) {
      chunks.push(customerIds.slice(i, i + chunkSize));
    }

    for (const chunk of chunks.slice(0, 10)) { // Limit to first 500 accounts for now
      const budgetPromises = chunk.map(async (customerId: string) => {
        try {
          const budgetQuery = `
            SELECT 
              account_budget.approved_spending_limit_micros,
              account_budget.amount_micros,
              account_budget.adjusted_spending_limit_micros
            FROM account_budget
            WHERE account_budget.status = 'APPROVED'
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
              body: JSON.stringify({ query: budgetQuery }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              const budget = data.results[0].accountBudget;
              const limitMicros = budget.approvedSpendingLimitMicros || budget.adjustedSpendingLimitMicros || 0;
              const spentMicros = budget.amountMicros || 0;
              
              if (limitMicros > 0) {
                totalBudget += Number(limitMicros) / 1000000;
                totalSpent += Number(spentMicros) / 1000000;
                accountsWithBudget++;
              }
            }
          }
        } catch (e) {
          // Skip failed accounts
        }
      });

      await Promise.all(budgetPromises);
      
      // Small delay between chunks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    totalRemaining = totalBudget - totalSpent;
    const percentUsed = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

    console.log(`✅ Budgets: $${totalBudget.toFixed(2)} total, $${totalSpent.toFixed(2)} spent, ${accountsWithBudget} accounts`);

    // Cache the result
    const cacheData = {
      totalBudget,
      totalSpent,
      totalRemaining,
      percentUsed,
      accountsWithBudget,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache in database
    await supabase
      .from('mss_metrics_cache')
      .upsert({
        mss_account_id: mssAccountId,
        total_budget: totalBudget,
        total_spent: totalSpent,
        total_remaining: totalRemaining,
        percent_used: percentUsed,
        last_updated_at: new Date().toISOString(),
      }, { onConflict: 'mss_account_id' });

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

