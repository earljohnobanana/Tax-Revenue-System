import { useState, useEffect, useRef } from "react";
import {
  Bell,
  Calendar,
  User,
  Settings,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationContext";

import NotificationDropdown from "../components/topbar/NotificationDropdown";
import SettingsDropdown from "../components/topbar/SettingsDropdown";
import ProfileDropdown from "../components/topbar/ProfileDropdown";

function getToday() {
  return new Date().toLocaleDateString("en-PH", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const { notifications, unreadCount } = useNotifications();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
        setShowSettings(false);
        setShowProfile(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
  }, []);

  return (
    <header
      ref={wrapperRef}
      className="h-[60px] bg-white border-b border-gray-200 shadow-sm flex items-center px-5"
    >
      <div className="flex-1" />

      {/* Greeting */}
      <div className="hidden lg:flex flex-col items-end mr-6">
        <span className="text-xs text-gray-400">
          {getGreeting()}
        </span>

        <span className="text-sm font-semibold text-[#1E4E9D]">
          {user?.name}
        </span>
      </div>

      {/* Date */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mr-5">
        <Calendar
          size={16}
          className="text-[#1E4E9D]"
        />

        <span>{getToday()}</span>
      </div>

      {/* Notification */}
      <div className="relative">
        <button
          onClick={() => {
            setShowNotifications((prev) => !prev);
            setShowSettings(false);
            setShowProfile(false);
          }}
          className="relative w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center transition"
        >
          <Bell size={19} />

          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-semibold">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <NotificationDropdown
            onClose={() => setShowNotifications(false)}
          />
        )}
      </div>

      {/* Settings */}
      <div className="relative ml-2">
        <button
          onClick={() => {
            setShowSettings((prev) => !prev);
            setShowNotifications(false);
            setShowProfile(false);
          }}
          className="w-10 h-10 rounded-lg hover:bg-gray-100 flex items-center justify-center transition"
        >
          <Settings size={19} />
        </button>

        {showSettings && (
          <SettingsDropdown
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>

      {/* Profile */}
      <div className="relative ml-3">
        <button
          onClick={() => {
            setShowProfile((prev) => !prev);
            setShowNotifications(false);
            setShowSettings(false);
          }}
          className="flex items-center gap-3 pl-4 border-l border-gray-200 hover:bg-gray-50 rounded-lg pr-2 py-1 transition"
        >
          <div className="w-9 h-9 rounded-full bg-[#1E4E9D] flex items-center justify-center">
            <User
              size={16}
              className="text-white"
            />
          </div>

          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">
              {user?.name || "Administrator"}
            </p>

            <p className="text-xs text-gray-500">
              {user?.role || "Admin"}
            </p>
          </div>
        </button>

        {showProfile && (
          <ProfileDropdown
            user={user}
            logout={logout}
            onClose={() => setShowProfile(false)}
          />
        )}
      </div>
    </header>
  );
}