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

// Fetch ALL accounts from Google Ads API with pagination
async function fetchFromGoogleAds(
  accessToken: string,
  developerToken: string,
  mccId: string
) {
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

  let allResults: any[] = [];
  let pageToken: string | null = null;
  let pageCount = 0;
  const maxPages = 20; // Safety limit

  do {
    const body: any = { 
      query,
      pageSize: 10000  // Maximum allowed
    };
    if (pageToken) {
      body.pageToken = pageToken;
    }

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
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google Ads API error:', errorText.substring(0, 500));
      throw new Error(`Google Ads API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results) {
      allResults = allResults.concat(data.results);
    }
    
    pageToken = data.nextPageToken || null;
    pageCount++;
    
    console.log(`📄 Page ${pageCount}: ${data.results?.length || 0} results, total: ${allResults.length}`);
    
  } while (pageToken && pageCount < maxPages);

  console.log(`✅ Total fetched: ${allResults.length} accounts`);
  
  return { results: allResults };
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
    const { mssAccountId, forceRefresh = false } = await req.json();

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

    // ========== CHECK CACHE FIRST ==========
    if (!forceRefresh) {
      const { data: cache } = await supabase
        .from('mcc_structure_cache')
        .select('*')
        .eq('mss_account_id', mssAccountId)
        .single();

      if (cache && new Date(cache.expires_at) > new Date()) {
        console.log('📦 Returning from cache');
        
        // Get our accounts
        const { data: ourAccounts } = await supabase
          .from('google_ads_accounts')
          .select('*')
          .eq('mss_account_id', mssAccountId);

        return new Response(
          JSON.stringify({
            success: true,
            fromCache: true,
            cachedAt: cache.cached_at,
            mss: {
              id: mssAccount.id,
              name: mssAccount.name,
              mcc_number: mssAccount.mcc_number
            },
            folders: cache.folders || [],
            accounts: cache.direct_accounts || [],
            summary: {
              total: cache.total_accounts || 0,
              createdByUs: (ourAccounts || []).length,
              external: (cache.total_accounts || 0) - (ourAccounts || []).length,
              folders: cache.total_folders || 0
            },
            totals: { clicks: 0, impressions: 0, cost: 0, conversions: 0 }
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    // ========== FETCH FROM API ==========
    console.log('🔄 Fetching fresh data from Google Ads API');
    
    const clientId = mssAccount.google_client_id || DEFAULT_CLIENT_ID;
    const clientSecret = mssAccount.google_client_secret || DEFAULT_CLIENT_SECRET;
    const accessToken = await getAccessToken(mssAccount.google_refresh_token, clientId, clientSecret);
    const mccId = mssAccount.mcc_number.replace(/-/g, '');

    const data = await fetchFromGoogleAds(accessToken, mssAccount.developer_token, mccId);
    
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

    // Separate managers (Sub-MCCs) and regular accounts
    const managers = allClients.filter((c: any) => c.isManager && c.id !== mccId);
    const regularAccounts = allClients.filter((c: any) => !c.isManager);

    console.log(`✅ Found ${managers.length} Sub-MCCs, ${regularAccounts.length} accounts`);

    // Get accounts created by our service
    const { data: ourAccounts } = await supabase
      .from('google_ads_accounts')
      .select('*')
      .eq('mss_account_id', mssAccountId);

    const ourAccountIds = new Set((ourAccounts || []).map(a => a.customer_id.replace(/-/g, '')));

    // Mark accounts created by us
    const processedAccounts = regularAccounts.map((acc: any) => ({
      ...acc,
      createdByUs: ourAccountIds.has(acc.id),
    }));

    // Build folders with account counts
    const folders = managers.map((m: any) => ({
      ...m,
      accounts: [],
      accountCount: 0 // Will be filled by separate lazy-load
    }));

    // ========== SAVE TO CACHE ==========
    try {
      await supabase.rpc('update_mcc_cache', {
        p_mss_account_id: mssAccountId,
        p_folders: folders,
        p_direct_accounts: processedAccounts,
        p_total_accounts: regularAccounts.length,
        p_total_folders: managers.length
      });
      console.log('💾 Cache updated');
    } catch (cacheError) {
      console.error('Cache update failed:', cacheError);
      // Continue anyway - cache is optional
    }

    return new Response(
      JSON.stringify({
        success: true,
        fromCache: false,
        mss: {
          id: mssAccount.id,
          name: mssAccount.name,
          mcc_number: mssAccount.mcc_number
        },
        folders,
        accounts: processedAccounts,
        summary: {
          total: regularAccounts.length,
          createdByUs: ourAccountIds.size,
          external: regularAccounts.length - ourAccountIds.size,
          folders: managers.length
        },
        totals: { clicks: 0, impressions: 0, cost: 0, conversions: 0 }
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
