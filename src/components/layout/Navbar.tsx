import { NavLink, useNavigate } from "react-router-dom"
import {
  House,
  Map,
  Plus,
  CalendarDays,
  User,
  LogIn,
  LogOut,
  UserPlus,
} from "lucide-react"

import { useAuth } from "@/auth/useAuth"

const navItems = [
  {
    name: "Feed",
    path: "/feed",
    icon: House,
  },
  {
    name: "Map",
    path: "/map",
    icon: Map,
  },
  {
    name: "Create Post",
    path: "/create-post",
    icon: Plus,
  },
  {
    name: "Itinerary",
    path: "/itinerary",
    icon: CalendarDays,
  },
  {
    name: "Profile",
    path: "/profile",
    icon: User,
  },
]

const authLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-[#0D3B66] text-white"
      : "text-gray-600 hover:bg-gray-100 hover:text-[#0D3B66]"
  }`

// Login/Register for guests, username and Logout for signed-in users
function AuthControls() {
  const { isAuthenticated, isLoading, user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate("/login")
  }

  // Hide the controls while a saved session is being verified, to avoid flicker
  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return (
      <>
        <NavLink to="/login" className={authLinkClass}>
          <LogIn size={18} />
          Login
        </NavLink>

        <NavLink to="/register" className={authLinkClass}>
          <UserPlus size={18} />
          Register
        </NavLink>
      </>
    )
  }

  return (
    <>
      {user && (
        <span className="px-2 text-sm font-medium text-gray-700">
          {user.username}
        </span>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#0D3B66]"
      >
        <LogOut size={18} />
        Logout
      </button>
    </>
  )
}

function Navbar() {
  return (
    <>
      {/* Mobile top strip: the bottom bar has no room for auth controls */}
      <div className="flex items-center justify-end gap-1 border-b bg-white px-3 py-1 md:hidden">
        <AuthControls />
      </div>

      {/* Desktop Navbar */}
      <nav className="sticky top-0 z-50 hidden border-b bg-white md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          {/* Logo */}
          <NavLink
            to="/feed"
            className="text-2xl font-bold text-[#0D3B66]"
          >
            WeTravel
          </NavLink>

          {/* Links */}
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon

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
              )
            })}

            {/* Auth */}
            <div className="ml-2 flex items-center gap-2 border-l pl-4">
              <AuthControls />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navbar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white md:hidden">
        <div className="grid grid-cols-5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isCreatePost = item.name === "Create Post"

            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${
                    isActive
                      ? "text-[#0D3B66]"
                      : "text-gray-500"
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
            )
          })}
        </div>
      </nav>
    </>
  )
}

export default Navbar