import { useEffect, useState } from "react"
import { healthCheck } from "@/api_configs"

function Home() {

  const [status, setStatus] = useState("Checking backend...")

  useEffect(() => {
    healthCheck()
      .then((data) => {
        setStatus(data.status)
        console.log("Backend status:", data.status)
      })
      .catch((error) => {
        console.error(error)
        setStatus("Backend connection failed")
      })
  }, [])
  return (
    <div>
      <h1>Home Landing Page</h1>
    </div>
  )
}

export default Home