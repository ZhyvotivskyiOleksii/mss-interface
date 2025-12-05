import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_CLIENT_ID = '572283707219-ndq1o9qi0k5uh3eucrb0e80imfabftrl.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';
const API_VERSION = 'v22';

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
    const { mssAccountId, folderId } = await req.json();

    if (!mssAccountId || !folderId) {
      throw new Error('MSS Account ID and Folder ID are required');
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

    const clientId = mssAccount.google_client_id || DEFAULT_CLIENT_ID;
    const clientSecret = mssAccount.google_client_secret || DEFAULT_CLIENT_SECRET;
    const accessToken = await getAccessToken(mssAccount.google_refresh_token, clientId, clientSecret);
    const mccId = mssAccount.mcc_number.replace(/-/g, '');
    const cleanFolderId = folderId.replace(/-/g, '');

    console.log(`📂 Fetching accounts for Sub-MCC: ${cleanFolderId}`);

    // Query accounts under this Sub-MCC
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
      ORDER BY customer_client.descriptive_name
    `;

    const response = await fetch(
      `https://googleads.googleapis.com/${API_VERSION}/customers/${cleanFolderId}/googleAds:search`,
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
      console.error('Google Ads API error:', errorText.substring(0, 300));
      
      // Return empty array instead of error for permission issues
      if (response.status === 403) {
        return new Response(
          JSON.stringify({ success: true, accounts: [], count: 0 }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      throw new Error(`Google Ads API error: ${response.status}`);
    }

    const data = await response.json();
    
    const accounts = (data.results || [])
      .filter((result: any) => !result.customerClient.manager)
      .map((result: any) => {
        const client = result.customerClient;
        return {
          id: client.id,
          name: client.descriptiveName || `Account ${client.id}`,
          currency: client.currencyCode,
          timezone: client.timeZone,
          status: client.status,
        };
      });

    console.log(`✅ Found ${accounts.length} accounts in folder`);

    return new Response(
      JSON.stringify({
        success: true,
        folderId: cleanFolderId,
        accounts,
        count: accounts.length
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error:', error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message, accounts: [] }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});

