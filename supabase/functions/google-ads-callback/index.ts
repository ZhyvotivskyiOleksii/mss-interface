import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Default Web Application OAuth credentials (ALMZ)
const DEFAULT_GOOGLE_CLIENT_ID = '669872731512-e0ukp41pdeg631rj6s7jodd1b4uth8mf.apps.googleusercontent.com';
const DEFAULT_GOOGLE_CLIENT_SECRET = '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';
const SUPABASE_URL = 'https://nngnawaxyqzzvbtchhgw.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:8080';
const supabaseAdmin = SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // MSS Account ID
  const error = url.searchParams.get('error');

  console.log('Callback received:', { code: !!code, state, error });

  // Handle errors from Google
  if (error) {
    console.error('OAuth error:', error);
    return Response.redirect(`${APP_URL}/accounts?error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return Response.redirect(`${APP_URL}/accounts?error=missing_params`);
  }

  try {
    if (!supabaseAdmin) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not set');
      throw new Error('Server configuration error');
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('mss_accounts')
      .select('google_client_id, google_client_secret')
      .eq('id', state)
      .maybeSingle();

    if (accountError) {
      console.error('Failed to load MSS account credentials:', accountError);
      throw new Error('Failed to load MSS account credentials');
    }

    if (!account) {
      throw new Error('MSS account not found');
    }

    const hasCustomCredentials = account.google_client_id && account.google_client_secret;
    const clientId = hasCustomCredentials ? account.google_client_id! : DEFAULT_GOOGLE_CLIENT_ID;
    const clientSecret = hasCustomCredentials ? account.google_client_secret! : DEFAULT_GOOGLE_CLIENT_SECRET;

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-ads-callback`;

    console.log('Exchanging code for tokens...');

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Token exchange error:', tokenData);
      throw new Error(tokenData.error_description || tokenData.error);
    }

    console.log('Token exchange successful, getting user info...');

    // Get user info to verify the account
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoResponse.json();

    console.log('User info:', userInfo.email);

    const { error: updateError } = await supabaseAdmin
      .from('mss_accounts')
      .update({
        google_refresh_token: tokenData.refresh_token,
        google_connected_email: userInfo.email,
        google_connected_at: new Date().toISOString(),
      })
      .eq('id', state);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to save credentials');
    }

    console.log('Refresh token saved for MSS:', state);

    // Redirect back to app with success
    return Response.redirect(`${APP_URL}/accounts?google_connected=true`);

  } catch (err: any) {
    console.error('Callback error:', err);
    return Response.redirect(`${APP_URL}/accounts?error=${encodeURIComponent(err.message)}`);
  }
});
