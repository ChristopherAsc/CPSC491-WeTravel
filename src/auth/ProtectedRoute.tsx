import { Navigate, Outlet, useLocation } from "react-router-dom"

import { useAuth } from "@/auth/useAuth"

// Wrap routes that need a logged-in user:
//   <Route element={<ProtectedRoute />}>
//     <Route path="/profile" element={<Profile />} />
//   </Route>
function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  // A saved token is still being verified after a page refresh
  if (isLoading) {
    return <p>Checking your session...</p>
  }

  if (!isAuthenticated) {
    // Remember where the user was going so Login can send them back later
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}

export default ProtectedRoute
