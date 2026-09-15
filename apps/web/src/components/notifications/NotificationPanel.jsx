import { useNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/utils";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
const NotificationPanel = () => {
  const { notifications, isLoading, markAsRead, markAllAsRead } = useNotifications();
  return <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border z-50 overflow-hidden flex flex-col max-h-[80vh]">
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h3 className="font-semibold text-gray-900">Notifications</h3>
        {notifications.length > 0 && <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-8 text-xs text-blue-600">
            Mark all as read
          </Button>}
      </div>

      <div className="overflow-y-auto flex-1">
        {isLoading ? <div className="p-4 text-center text-gray-500 text-sm">Loading...</div> : notifications.length === 0 ? <div className="p-8 text-center text-gray-500">
            <Bell className="mx-auto h-8 w-8 text-gray-300 mb-2" />
            <p className="text-sm">No notifications</p>
          </div> : <div className="divide-y">
            {notifications.map((notif) => <div
    key={notif.id}
    className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${notif.isRead ? "opacity-70" : "bg-blue-50/30"}`}
    onClick={() => {
      if (!notif.isRead) markAsRead(notif.id);
    }}
  >
                <div className="flex gap-3">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${notif.isRead ? "bg-transparent" : "bg-blue-500"}`} />
                  <div>
                    <p className={`text-sm ${notif.isRead ? "text-gray-700" : "text-gray-900 font-medium"}`}>
                      {notif.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-2">
                      {formatRelativeTime(notif.createdAt)}
                    </p>
                  </div>
                </div>
              </div>)}
          </div>}
      </div>
    </div>;
};
export {
  NotificationPanel
};
