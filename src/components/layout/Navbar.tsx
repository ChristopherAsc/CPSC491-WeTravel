import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { House, Map, Plus, CalendarDays, User, LogOut } from "lucide-react";

const navItems = [
  { name: "Feed", path: "/feed", icon: House },
  { name: "Map", path: "/map", icon: Map },
  { name: "Create Post", path: "/create-post", icon: Plus },
  { name: "Itinerary", path: "/itinerary", icon: CalendarDays },
  { name: "Profile", path: "/profile", icon: User },
];

function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      {/* Desktop Navbar */}
      <nav className="sticky top-0 z-50 hidden border-b bg-white md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <NavLink to="/feed" className="text-2xl font-bold text-[#0D3B66]">
            WeTravel
          </NavLink>

          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[#0D3B66] text-white"
                        : "text-gray-600 hover:bg-gray-100 hover:text-[#0D3B66]"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.name}
                </NavLink>
              );
            })}

            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={18} />
                Logout
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Logout Button */}
      {isAuthenticated && (
        <div className="fixed bottom-16 right-3 z-50 md:hidden">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-red-600 shadow-md"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      )}

      {/* Mobile Bottom Navbar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isCreatePost = item.name === "Create Post";

            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                    isActive ? "text-[#0D3B66]" : "text-gray-500"
                  }`
                }
              >
                <div
                  className={
                    isCreatePost
                      ? "flex h-10 w-10 items-center justify-center rounded-xl bg-[#0D3B66] text-white"
                      : ""
                  }
                >
                  <Icon size={22} />
                </div>

                {!isCreatePost && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export default Navbar;
