import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// OAuth credentials
const DEFAULT_CLIENT_ID = '572283707219-ndq1o9qi0k5uh3eucrb0e80imfabftrl.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';

const API_VERSION = 'v22';

// Get fresh access token
async function getAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
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
    const { mssAccountId } = await req.json();

    if (!mssAccountId) {
      throw new Error('MSS Account ID is required');
    }

    // Get MSS account
    const { data: mssAccount, error: mssError } = await supabase
      .from('mss_accounts')
      .select('*')
      .eq('id', mssAccountId)
      .single();

    if (mssError || !mssAccount) {
      throw new Error('MSS account not found');
    }

    if (!mssAccount.google_refresh_token) {
      throw new Error('Google Ads не підключений');
    }

    // Get OAuth credentials
    const clientId = mssAccount.google_client_id || DEFAULT_CLIENT_ID;
    const clientSecret = mssAccount.google_client_secret || DEFAULT_CLIENT_SECRET;
    
    // Get access token
    const accessToken = await getAccessToken(mssAccount.google_refresh_token, clientId, clientSecret);
    const mccId = mssAccount.mcc_number.replace(/-/g, '');

    // Fetch all client accounts
    const query = `
      SELECT 
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.manager,
        customer_client.test_account,
        customer_client.status,
        customer_client.level
      FROM customer_client
      ORDER BY customer_client.level, customer_client.descriptive_name
    `;

    console.log('📋 Fetching accounts from MCC:', mccId);

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
        body: JSON.stringify({ query }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Ads API error:', errorText.substring(0, 500));
      throw new Error(`Google Ads API error: ${response.status}`);
    }

    const data = await response.json();
    
    const allClients = (data.results || []).map((result: any) => {
      const client = result.customerClient;
      return {
        id: client.id,
        name: client.descriptiveName || `Account ${client.id}`,
        currency: client.currencyCode,
        timezone: client.timeZone,
        isManager: client.manager,
        isTest: client.testAccount,
        status: client.status,
        level: client.level || 0,
      };
    });

    // Separate managers and accounts
    const managers = allClients.filter((c: any) => c.isManager && c.id !== mccId);
    const googleAccounts = allClients.filter((c: any) => !c.isManager);

    console.log(`✅ Found ${managers.length} managers, ${googleAccounts.length} accounts`);

    // Get accounts created by our service
    const { data: ourAccounts } = await supabase
      .from('google_ads_accounts')
      .select('*')
      .eq('mss_account_id', mssAccountId);

    // Get invitations
    const { data: invitations } = await supabase
      .from('account_invitations')
      .select('*')
      .eq('mss_account_id', mssAccountId);

    // Merge data
    const ourAccountIds = new Set((ourAccounts || []).map(a => a.customer_id.replace(/-/g, '')));
    
    const mergedAccounts = googleAccounts.map((acc: any) => {
      const isOurs = ourAccountIds.has(acc.id);
      const ourData = isOurs 
        ? ourAccounts?.find(a => a.customer_id.replace(/-/g, '') === acc.id)
        : null;

      return {
        ...acc,
        createdByUs: isOurs,
        ourData,
        metrics: { clicks: 0, impressions: 0, cost: 0, ctr: 0, conversions: 0, avgCpc: 0 }
      };
    });

    // Calculate totals
    const totals = {
      clicks: 0,
      impressions: 0,
      cost: 0,
      conversions: 0,
    };

    return new Response(
      JSON.stringify({
        success: true,
        mss: {
          id: mssAccount.id,
          name: mssAccount.name,
          mcc_number: mssAccount.mcc_number
        },
        folders: managers.map((m: any) => ({ ...m, accounts: [], accountCount: 0 })),
        accounts: mergedAccounts,
        summary: {
          total: googleAccounts.length,
          createdByUs: ourAccountIds.size,
          external: googleAccounts.length - ourAccountIds.size,
          folders: managers.length
        },
        totals
      }),
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
