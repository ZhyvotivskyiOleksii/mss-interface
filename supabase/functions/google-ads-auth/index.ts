import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Web Application OAuth credentials (ALMZ)
const GOOGLE_CLIENT_ID = '572283707219-6a3p5r4v60u6odm6c2os9v17e2n0ij41.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
const SUPABASE_URL = 'https://nngnawaxyqzzvbtchhgw.supabase.co';

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

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-ads-callback`;
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
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
