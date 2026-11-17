import { Routes, Route } from "react-router-dom";

import Navbar from "@/components/layout/Navbar"
import MainContent from "@/components/layout/MainContent"
import PageContainer from "@/components/layout/PageContainer"
import ProtectedRoute from "@/auth/ProtectedRoute"

import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Feed from "@/pages/Feed";
import CreatePost from "@/pages/CreatePost";
import Itinerary from "@/pages/Itinerary";
import Profile from "@/pages/Profile";
import MapPage from "@/pages/MapPage";
import AccountSettings from "@/pages/AccountSettings";
import TravelerSearch from "@/pages/TravelerSearch";
import TravelerProfile from "@/pages/TravelerProfile";
import Friends from "@/pages/Friends";

function App() {
  return (
    <>
      <Navbar />

      <MainContent>
        <PageContainer>
          <div className="py-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/map" element={<MapPage />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/create-post" element={<CreatePost />} />
                <Route path="/itinerary" element={<Itinerary />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<AccountSettings />} />
                <Route path="/travelers" element={<TravelerSearch />} />
                <Route path="/travelers/:userId" element={<TravelerProfile />} />
                <Route path="/friends" element={<Friends />} />
              </Route>
            </Routes>
          </div>
        </PageContainer>
      </MainContent>
    </>
  );
}

export default App;
