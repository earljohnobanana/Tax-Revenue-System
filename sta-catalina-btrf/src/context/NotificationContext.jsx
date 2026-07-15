import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";
import { useAuth } from "./AuthContext";
const NotificationContext = createContext();
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const fetchNotifications = useCallback(async (page = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await api.get("/notifications", { params: { page, limit: 20 } });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error("Failed to load notifications:", err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(() => fetchNotifications(), 30000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);
  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.error("Failed to mark notification as read:", err.message);
      fetchNotifications();
    }
  };
  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await api.patch("/notifications/read-all");
    } catch (err) {
      console.error("Failed to mark all as read:", err.message);
      fetchNotifications();
    }
  };
  const deleteNotification = async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error("Failed to delete notification:", err.message);
      fetchNotifications();
    }
  };
  const clearNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      await api.delete("/notifications");
    } catch (err) {
      console.error("Failed to clear notifications:", err.message);
      fetchNotifications();
    }
  };
  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
export function useNotifications() {
  return useContext(NotificationContext);
}