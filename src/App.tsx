import { Routes, Route } from "react-router-dom"

import Navbar from "@/components/layout/Navbar"
import MainContent from "@/components/layout/MainContent"
import PageContainer from "@/components/layout/PageContainer"

import Home from "@/pages/Home"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import Feed from "@/pages/Feed"
import Map from "@/pages/Map"
import CreatePost from "@/pages/CreatePost"
import Itinerary from "@/pages/Itinerary"
import Profile from "@/pages/Profile"

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
              <Route path="/map" element={<Map />} />
              <Route path="/create-post" element={<CreatePost />} />
              <Route path="/itinerary" element={<Itinerary />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </div>
        </PageContainer>
      </MainContent>
    </>
  )
}

export default App