import { supabase } from "@/integrations/supabase/client";

type ActionType = 
  | 'create_mss' 
  | 'delete_mss' 
  | 'edit_mss'
  | 'connect_google'
  | 'disconnect_google'
  | 'create_account' 
  | 'delete_account'
  | 'transfer'
  | 'add_manager'
  | 'delete_manager'
  | 'login'
  | 'logout';

type EntityType = 
  | 'mss_account' 
  | 'google_ads_account' 
  | 'manager' 
  | 'user';

interface LogActivityParams {
  action: ActionType;
  entityType?: EntityType;
  entityId?: string;
  entityName?: string;
  details?: Record<string, any>;
}

export async function logActivity({
  action,
  entityType,
  entityId,
  entityName,
  details
}: LogActivityParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('activity_log').insert({
      user_id: user?.id,
      user_email: user?.email,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      details
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging should not break the main flow
  }
}


















