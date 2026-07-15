import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";

export default function NotificationDropdown({ onClose }) {
  const {
    notifications,
    markAsRead,
    clearNotifications,
  } = useNotifications();

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div>
          <h2 className="font-semibold text-gray-800">
            Notifications
          </h2>

          <p className="text-xs text-gray-500">
            {notifications.length} notification
            {notifications.length !== 1 && "s"}
          </p>
        </div>

        <div className="flex gap-2">

          <button
            onClick={clearNotifications}
            className="p-2 rounded-md hover:bg-gray-200 transition"
            title="Clear all"
          >
            <Trash2 size={16} />
          </button>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black text-lg px-2"
          >
            ✕
          </button>

        </div>
      </div>

      {/* Body */}

      <div className="max-h-96 overflow-y-auto">

        {notifications.length === 0 ? (

          <div className="flex flex-col items-center justify-center py-12 text-gray-400">

            <Bell size={40} />

            <p className="mt-3 text-sm">
              No notifications
            </p>

          </div>

        ) : (

          notifications.map((notification) => (

            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={`cursor-pointer border-b p-4 transition hover:bg-gray-50 ${
                notification.read
                  ? "bg-white"
                  : "bg-blue-50"
              }`}
            >

              <div className="flex items-start justify-between">

                <div className="flex-1">

                  <div className="flex items-center gap-2">

                    {!notification.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    )}

                    <h3 className="font-medium text-gray-800">
                      {notification.title}
                    </h3>

                  </div>

                  <p className="text-sm text-gray-600 mt-1">
                    {notification.message}
                  </p>

                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(notification.time).toLocaleString()}
                  </p>

                </div>

                {notification.read && (
                  <CheckCheck
                    size={16}
                    className="text-green-500"
                  />
                )}

              </div>

            </div>

          ))

        )}

      </div>

    </div>
  );
}