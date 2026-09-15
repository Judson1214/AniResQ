import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationPanel } from "./NotificationPanel";
import { useAuth } from "@/hooks/useAuth";
const NotificationBell = ({ buttonClassName = "relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors", iconClassName = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const { isAuthenticated } = useAuth();
  const wrapperRef = useRef(null);
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  if (!isAuthenticated) return null;
  return <div className="relative" ref={wrapperRef}>
      <button
    onClick={() => setIsOpen(!isOpen)}
    className={buttonClassName}
  >
        <Bell size={20} className={iconClassName} />
        {unreadCount > 0 && <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>}
      </button>

      {isOpen && <NotificationPanel />}
    </div>;
};
export {
  NotificationBell
};
