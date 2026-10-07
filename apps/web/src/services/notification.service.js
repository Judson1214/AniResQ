import { supabase } from "@/config/supabase";

const mapNotificationToCamelCase = (dbData) => ({
  id: dbData.id,
  userId: dbData.user_id,
  type: dbData.type,
  title: dbData.title,
  message: dbData.message,
  isRead: dbData.is_read,
  relatedEntityId: dbData.related_entity_id,
  relatedEntityType: dbData.related_entity_type,
  createdAt: dbData.created_at
});

const createNotification = async (userId, type, title, message, relatedEntityId, relatedEntityType) => {
  const dbData = {
    user_id: userId,
    type,
    title,
    message,
    is_read: false,
    related_entity_id: relatedEntityId,
    related_entity_type: relatedEntityType
  };

  const { data, error } = await supabase
    .from('notifications')
    .insert(dbData)
    .select()
    .single();

  if (error) throw error;
  return data.id;
};

const getNotifications = async (userId) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data.map(mapNotificationToCamelCase);
};

const markAsRead = async (notificationId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw error;
};

const markAllAsRead = async (userId) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
};

const getUnreadCount = async (userId) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count;
};

export {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead
};
