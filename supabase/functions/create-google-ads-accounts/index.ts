import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ OAUTH CREDENTIALS ============
const DEFAULT_CLIENT_ID = '572283707219-ndq1o9qi0k5uh3eucrb0e80imfabftrl.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';

// Google Ads API version
const API_VERSION = 'v22';

interface EmailInvitation {
  email: string;
  accessLevel: 'admin' | 'standard' | 'read';
}

interface CreateAccountsRequest {
  mssAccountId: string;
  managerId: string;
  currency: string;
  timezone: string;
  emails: EmailInvitation[];
}

// Get fresh access token from refresh token
async function getAccessToken(
  refreshToken: string, 
  clientId: string, 
  clientSecret: string
): Promise<string> {
  console.log('🔐 Getting access token...');
  
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
    console.error('❌ OAuth error:', data);
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }
  
  console.log('✅ Access token obtained');
  return data.access_token;
}

// Map access level to Google Ads API format
function mapAccessLevel(level: string): string {
  switch (level) {
    case 'admin': return 'ADMIN';
    case 'standard': return 'STANDARD';
    case 'read': return 'READ_ONLY';
    default: return 'ADMIN';
  }
}

// Map timezone name to IANA format
function mapTimezone(name: string): string {
  const timezoneMap: Record<string, string> = {
    'Kyiv': 'Europe/Kiev',
    'Warsaw': 'Europe/Warsaw',
    'New York': 'America/New_York',
    'Los Angeles': 'America/Los_Angeles',
    'London': 'Europe/London',
    'Berlin': 'Europe/Berlin',
    'Paris': 'Europe/Paris',
    'Moscow': 'Europe/Moscow',
    'Tokyo': 'Asia/Tokyo',
    'Sydney': 'Australia/Sydney',
    'Dubai': 'Asia/Dubai',
    'Singapore': 'Asia/Singapore',
    'Hong Kong': 'Asia/Hong_Kong',
    'Istanbul': 'Europe/Istanbul',
    'Toronto': 'America/Toronto',
  };
  return timezoneMap[name] || 'America/New_York';
}

// Create a customer account using Google Ads API
async function createCustomerAccount(
  accessToken: string,
  developerToken: string,
  mccId: string,
  accountName: string,
  currencyCode: string,
  timeZone: string
): Promise<string> {
  
  const apiUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${mccId}:createCustomerClient`;
  
  const requestBody = {
    customerId: mccId,
    customerClient: {
      descriptiveName: accountName,
      currencyCode: currencyCode,
      timeZone: timeZone,
    }
  };

  console.log('🆕 Creating account:', accountName);
  console.log('   MCC:', mccId);
  console.log('   Currency:', currencyCode);
  console.log('   Timezone:', timeZone);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
      'login-customer-id': mccId,
    },
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();
  console.log('   Response:', response.status);

  if (!response.ok) {
    console.error('❌ API Error:', responseText.substring(0, 500));
    
    let errorMessage = `API Error ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      if (errorData.error?.details) {
        for (const detail of errorData.error.details) {
          if (detail.errors && detail.errors.length > 0) {
            errorMessage = detail.errors.map((e: any) => e.message).join('; ');
            break;
          }
        }
      } else if (errorData.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch (e) {
      errorMessage = responseText.substring(0, 200);
    }
    throw new Error(errorMessage);
  }

  const data = JSON.parse(responseText);
  const resourceName = data.resourceName || '';
  const customerId = resourceName.split('/').pop() || '';

  console.log('✅ Account created! ID:', customerId);
  return customerId;
}

// Send user access invitation
async function sendUserInvitation(
  accessToken: string,
  developerToken: string,
  mccId: string,
  customerId: string,
  email: string,
  accessRole: string
): Promise<{ success: boolean; error?: string }> {
  
  const apiUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${customerId}/customerUserAccessInvitations:mutate`;
  
  const requestBody = {
    operation: {
      create: {
        emailAddress: email,
        accessRole: accessRole,
      }
    }
  };

  console.log('📨 Sending invitation to:', email, 'Role:', accessRole);
  console.log('   URL:', apiUrl);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json',
        'login-customer-id': mccId,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('   Invitation response:', response.status, responseText.substring(0, 200));

    if (!response.ok) {
      console.error('❌ Invitation failed:', responseText.substring(0, 300));
      return { success: false, error: responseText.substring(0, 200) };
    }

    console.log('✅ Invitation sent successfully!');
    return { success: true };
  } catch (err: any) {
    console.error('❌ Invitation error:', err.message);
    return { success: false, error: err.message };
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
    const requestData: CreateAccountsRequest = await req.json();
    
    console.log('='.repeat(50));
    console.log('🚀 CREATE GOOGLE ADS ACCOUNTS');
    console.log('='.repeat(50));

    // Validate request
    if (!requestData.mssAccountId || !requestData.managerId || !requestData.currency || !requestData.timezone) {
      throw new Error('Missing required fields');
    }

    if (!requestData.emails || requestData.emails.length === 0) {
      throw new Error('At least one email is required');
    }

    if (requestData.emails.length > 20) {
      throw new Error('Maximum 20 emails allowed');
    }

    // Get MSS account
    const { data: mssAccount, error: mssError } = await supabase
      .from('mss_accounts')
      .select('*')
      .eq('id', requestData.mssAccountId)
      .single();

    if (mssError || !mssAccount) {
      console.error('MSS error:', mssError);
      throw new Error('MSS account not found');
    }

    console.log('📋 MSS:', mssAccount.name, '| MCC:', mssAccount.mcc_number);

    // Check Google Ads connection
    if (!mssAccount.google_refresh_token) {
      throw new Error('Google Ads не підключений. Спочатку підключіть Google Ads.');
    }

    // Get timezone
    const { data: timezone, error: tzError } = await supabase
      .from('timezones')
      .select('*')
      .eq('id', requestData.timezone)
      .single();

    if (tzError || !timezone) {
      throw new Error('Timezone not found');
    }

    // OAuth credentials
    const clientId = mssAccount.google_client_id || DEFAULT_CLIENT_ID;
    const clientSecret = mssAccount.google_client_secret || DEFAULT_CLIENT_SECRET;

    // Get access token
    const accessToken = await getAccessToken(mssAccount.google_refresh_token, clientId, clientSecret);
    
    const mccId = mssAccount.mcc_number.replace(/-/g, '');
    const timeZoneId = mapTimezone(timezone.name);

    const createdAccounts = [];
    const invitations = [];
    const errors = [];

    // Process each email
    for (const emailEntry of requestData.emails) {
      try {
        console.log(`\n--- Processing: ${emailEntry.email} ---`);

        const accountName = emailEntry.email.split('@')[0] + '_' + Date.now();

        // Create account via Google Ads API
        const customerId = await createCustomerAccount(
          accessToken,
          mssAccount.developer_token,
          mccId,
          accountName,
          requestData.currency,
          timeZoneId
        );

        // Save to database
        const { data: account, error: accountError } = await supabase
          .from('google_ads_accounts')
          .insert({
            mss_account_id: requestData.mssAccountId,
            customer_id: customerId,
            currency_code: requestData.currency,
            timezone: timezone.name,
            status: 'active'
          })
          .select()
          .single();

        if (accountError) {
          console.error('DB error:', accountError);
        } else {
          createdAccounts.push(account);
        }

        // Send invitation
        const invResult = await sendUserInvitation(
          accessToken,
          mssAccount.developer_token,
          mccId,
          customerId,
          emailEntry.email,
          mapAccessLevel(emailEntry.accessLevel)
        );

        // Save invitation record
        const { data: invitation } = await supabase
          .from('account_invitations')
          .insert({
            mss_account_id: requestData.mssAccountId,
            email: emailEntry.email,
            access_level: emailEntry.accessLevel,
            status: invResult.success ? 'sent' : 'failed'
          })
          .select()
          .single();

        if (invitation) {
          invitations.push(invitation);
        }

        console.log(`✅ ${emailEntry.email} → Account: ${customerId}`);

      } catch (err: any) {
        console.error(`❌ Error for ${emailEntry.email}:`, err.message);
        errors.push({ email: emailEntry.email, error: err.message });
      }
    }

    const response = {
      success: createdAccounts.length > 0,
      message: errors.length === 0 
        ? `✅ Створено ${createdAccounts.length} акаунт(ів)!`
        : `Створено ${createdAccounts.length} з ${requestData.emails.length} акаунтів`,
      summary: {
        mss: mssAccount.name,
        currency: requestData.currency,
        timezone: timezone.name,
        totalRequested: requestData.emails.length,
        accountsCreated: createdAccounts.length,
        invitationsSent: invitations.filter(i => i.status === 'sent').length,
        errorsCount: errors.length
      },
      accounts: createdAccounts,
      invitations: invitations,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('\n' + '='.repeat(50));
    console.log('📊 RESULT:', JSON.stringify(response.summary));
    console.log('='.repeat(50));

    return new Response(
      JSON.stringify(response),
      {
        status: createdAccounts.length > 0 ? 200 : 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('❌ FATAL ERROR:', error.message);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'An error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
