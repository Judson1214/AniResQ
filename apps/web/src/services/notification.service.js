import api from "@/lib/api";

const getNotifications = async () => {
  const response = await api.get('/notifications/');
  return response.data;
};

const markAsRead = async (notificationId) => {
  await api.patch(`/notifications/${notificationId}/read`);
};

const markAllAsRead = async () => {
  await api.post('/notifications/mark-all-read');
};

const getUnreadCount = async () => {
  const notifications = await getNotifications();
  return notifications.filter((n) => !n.isRead).length;
};

export {
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead
};
