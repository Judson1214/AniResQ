import { useAuth } from "./useAuth";
import { useRealtimeCollection } from "./useRealtimeCollection";
import { markAsRead, markAllAsRead } from "@/services/notification.service";

const useNotifications = () => {
  const { user, isAuthenticated } = useAuth();

  const params = {
    userId: user?.uid || "",
    sortBy: "createdAt:desc",
    limit: 50
  };

  const { data: rawData, isLoading } = useRealtimeCollection(
    "/notifications",
    params,
    isAuthenticated && !!user?.uid
  );
  const notifications = Array.isArray(rawData) ? rawData : (rawData?.items || []);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const handleMarkAsRead = async (id) => {
    await markAsRead(id);
  };
  const handleMarkAllAsRead = async () => {
    if (user?.uid) {
      await markAllAsRead(user.uid);
    }
  };
  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead
  };
};
export {
  useNotifications
};
