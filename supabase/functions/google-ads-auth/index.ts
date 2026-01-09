import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default Web Application OAuth credentials (ALMZ)
const DEFAULT_GOOGLE_CLIENT_ID = '669872731512-e0ukp41pdeg631rj6s7jodd1b4uth8mf.apps.googleusercontent.com';
const SUPABASE_URL = 'https://nngnawaxyqzzvbtchhgw.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAdmin = SUPABASE_SERVICE_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// Google Ads API scope
const GOOGLE_ADS_SCOPE = 'https://www.googleapis.com/auth/adwords';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mssAccountId } = await req.json();
    
    if (!mssAccountId) {
      throw new Error('MSS Account ID is required');
    }

    let clientId = DEFAULT_GOOGLE_CLIENT_ID;

    if (!supabaseAdmin) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set, falling back to default OAuth client');
    } else {
      const { data: account, error } = await supabaseAdmin
        .from('mss_accounts')
        .select('google_client_id, google_client_secret')
        .eq('id', mssAccountId)
        .maybeSingle();

      if (error) {
        console.error('Failed to load MSS credentials, using default client:', error);
      } else if (account?.google_client_id && account?.google_client_secret) {
        clientId = account.google_client_id;
      }
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-ads-callback`;
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', GOOGLE_ADS_SCOPE);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'select_account consent');
    authUrl.searchParams.set('state', mssAccountId); // Pass MSS ID in state

    return new Response(
      JSON.stringify({ authUrl: authUrl.toString() }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in google-ads-auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
