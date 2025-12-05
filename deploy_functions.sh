#!/bin/bash
# Deploy Edge Functions to Supabase

echo "🚀 Deploying Edge Functions..."

# You need to run these commands manually with your Supabase CLI:
# supabase functions deploy create-google-ads-accounts
# supabase functions deploy get-mcc-accounts
# supabase functions deploy sync-mss-metrics

echo "📄 Files updated:"
echo "   - supabase/functions/create-google-ads-accounts/index.ts"
echo "   - supabase/functions/get-mcc-accounts/index.ts"
echo ""
echo "Run: supabase functions deploy --all"
