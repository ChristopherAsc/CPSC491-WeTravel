import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import CreatePost from "./CreatePost"
import Feed from "./Feed"
import { ApiRequestError, createPost, getPosts } from "@/api_configs"
import { onUnauthorized } from "@/auth/authFetch"
import { PlaceSearchError, searchPlaces, type PlaceResult } from "@/lib/placeSearch"

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }))

vi.mock("@/auth/useAuth", () => ({ useAuth: useAuthMock }))

vi.mock("@/api_configs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api_configs")>()),
  createPost: vi.fn(),
  getPosts: vi.fn(),
}))

vi.mock("@/lib/placeSearch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/placeSearch")>()),
  searchPlaces: vi.fn(),
}))

const yosemite: PlaceResult = {
  id: "poi.1",
  name: "Yosemite National Park",
  fullName: "Yosemite National Park, California, United States",
  latitude: 37.8651,
  longitude: -119.5383,
}
const yosemiteValley: PlaceResult = {
  id: "locality.2",
  name: "Yosemite Valley",
  fullName: "Yosemite Valley, California, United States",
  latitude: 37.7456,
  longitude: -119.5936,
}

const renderPage = () => render(
  <MemoryRouter initialEntries={["/create-post"]}>
    <Routes>
      <Route path="/create-post" element={<CreatePost />} />
      <Route path="/feed" element={<Feed />} />
    </Routes>
  </MemoryRouter>
)
const signIn = () => useAuthMock.mockReturnValue({ token: "example-test-token", isAuthenticated: true, isLoading: false })
const fillRequiredFields = () => {
  fireEvent.change(screen.getByLabelText(/caption/i), { target: { value: "Wonderful views in Yosemite" } })
  fireEvent.change(screen.getByLabelText(/place name/i), { target: { value: "Yosemite" } })
}
const chooseYosemite = async () => {
  vi.mocked(searchPlaces).mockResolvedValue([yosemite, yosemiteValley])
  fireEvent.click(screen.getByRole("button", { name: /find location/i }))
  fireEvent.click(await screen.findByRole("button", { name: /Yosemite National Park, California/ }))
  expect(screen.getByText(`Selected: ${yosemite.fullName}`)).toBeInTheDocument()
}
const publish = () => fireEvent.click(screen.getByRole("button", { name: /publish post/i }))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  // Signed out by default; tests call signIn() to simulate a logged-in user
  useAuthMock.mockReturnValue({ token: null, isAuthenticated: false, isLoading: false })
  // Keep the real URL constructor: React Router uses it when navigating
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:mock-photo")
    static revokeObjectURL = vi.fn()
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe("Create Post", () => {
  it("displays the form and requires signing in to publish", () => {
    renderPage()
    expect(screen.getByRole("heading", { name: "Create a travel post" })).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("You must be signed in")
    expect(screen.getByRole("link", { name: /go to login/i })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("button", { name: /publish post/i })).toBeDisabled()
  })

  it("keeps publishing disabled while the saved session is being verified", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: true })
    renderPage()
    expect(screen.queryByText(/you must be signed in/i)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /publish post/i })).toBeDisabled()
  })

  it("validates an empty caption and location", async () => {
    signIn()
    renderPage()
    publish()
    expect(await screen.findByText("Caption is required")).toBeInTheDocument()
    expect(screen.getByText("Location name is required")).toBeInTheDocument()
    expect(createPost).not.toHaveBeenCalled()
  })

  it("shows an image preview and allows removing it", async () => {
    signIn()
    renderPage()
    const image = new File(["image bytes"], "vacation.png", { type: "image/png" })
    fireEvent.change(screen.getByLabelText("Upload travel photo"), { target: { files: [image] } })
    expect(await screen.findByAltText("Selected travel photo preview")).toHaveAttribute("src", "blob:mock-photo")
    expect(screen.getByText("vacation.png")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /remove photo/i }))
    expect(screen.queryByAltText("Selected travel photo preview")).not.toBeInTheDocument()
  })

  it("rejects unsupported image types", async () => {
    signIn()
    renderPage()
    const file = new File(["text"], "notes.txt", { type: "text/plain" })
    fireEvent.change(screen.getByLabelText("Upload travel photo"), { target: { files: [file] } })
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPG, PNG, or WebP image.")
    expect(screen.queryByAltText("Selected travel photo preview")).not.toBeInTheDocument()
  })
})

describe("Create Post location search", () => {
  beforeEach(() => {
    signIn()
  })

  it("lists matching places for the entered place name", async () => {
    vi.mocked(searchPlaces).mockResolvedValue([yosemite, yosemiteValley])
    renderPage()
    fillRequiredFields()
    fireEvent.click(screen.getByRole("button", { name: /find location/i }))

    const matches = await screen.findByRole("list", { name: "Matching places" })
    expect(matches).toHaveTextContent(yosemite.fullName)
    expect(matches).toHaveTextContent(yosemiteValley.fullName)
    expect(searchPlaces).toHaveBeenCalledWith("Yosemite")
  })

  it("searches when Enter is pressed in the place field instead of submitting", async () => {
    vi.mocked(searchPlaces).mockResolvedValue([yosemite])
    renderPage()
    fillRequiredFields()
    fireEvent.keyDown(screen.getByLabelText(/place name/i), { key: "Enter" })

    expect(await screen.findByRole("list", { name: "Matching places" })).toBeInTheDocument()
    expect(createPost).not.toHaveBeenCalled()
  })

  it("does not search for an empty place name", async () => {
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: /find location/i }))

    expect(await screen.findByText("Location name is required")).toBeInTheDocument()
    expect(searchPlaces).not.toHaveBeenCalled()
  })

  it("explains when no places match", async () => {
    vi.mocked(searchPlaces).mockResolvedValue([])
    renderPage()
    fillRequiredFields()
    fireEvent.click(screen.getByRole("button", { name: /find location/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent("No places found for “Yosemite”")
  })

  it("shows the location search error", async () => {
    vi.mocked(searchPlaces).mockRejectedValue(new PlaceSearchError("Location search is unavailable because the Mapbox token is not configured."))
    renderPage()
    fillRequiredFields()
    fireEvent.click(screen.getByRole("button", { name: /find location/i }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Mapbox token is not configured")
  })

  it("clears the chosen place when the place name is edited", async () => {
    renderPage()
    fillRequiredFields()
    await chooseYosemite()

    fireEvent.change(screen.getByLabelText(/place name/i), { target: { value: "Yellowstone" } })

    expect(screen.queryByText(/^Selected:/)).not.toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Matching places" })).not.toBeInTheDocument()
  })

  it("requires choosing a matching place before publishing", async () => {
    renderPage()
    fillRequiredFields()
    publish()

    expect(await screen.findByRole("alert")).toHaveTextContent("Search for this place and choose a match before publishing.")
    expect(createPost).not.toHaveBeenCalled()
  })
})

describe("Create Post to Feed", () => {
  beforeEach(() => {
    signIn()
  })

  it("publishes the post and shows it at the top of the feed", async () => {
    const created = {
      post_id: 42,
      user_id: 7,
      caption: "Wonderful views in Yosemite",
      media_url: null,
      location: { name: yosemite.fullName, latitude: yosemite.latitude, longitude: yosemite.longitude },
      created_at: "2026-11-02T18:00:00Z",
    }
    vi.mocked(createPost).mockResolvedValue(created)
    vi.mocked(getPosts).mockResolvedValue([created])
    renderPage()
    fillRequiredFields()
    await chooseYosemite()
    publish()

    expect(await screen.findByText("Your post was published.")).toBeInTheDocument()
    expect(createPost).toHaveBeenCalledWith({
      caption: "Wonderful views in Yosemite",
      media_url: null,
      location: { name: yosemite.fullName, latitude: 37.8651, longitude: -119.5383 },
    }, "example-test-token")
    expect(await screen.findByText("Wonderful views in Yosemite")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Explore travel" })).toBeInTheDocument()
  })

  it("keeps the form and shows the server error when publishing fails", async () => {
    vi.mocked(createPost).mockRejectedValue(new ApiRequestError("Unable to create post", 500))
    renderPage()
    fillRequiredFields()
    await chooseYosemite()
    publish()

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create post")
    expect(screen.getByLabelText(/caption/i)).toHaveValue("Wonderful views in Yosemite")
    expect(screen.getByRole("button", { name: /publish post/i })).toBeEnabled()
  })

  it("shows a connection error when the server can't be reached", async () => {
    vi.mocked(createPost).mockRejectedValue(new TypeError("Failed to fetch"))
    renderPage()
    fillRequiredFields()
    await chooseYosemite()
    publish()

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server, so your post was not published.")
  })

  it("ends the session when the login has expired", async () => {
    const sessionEnded = vi.fn()
    const stopListening = onUnauthorized(sessionEnded)
    localStorage.setItem("access_token", "example-test-token")
    vi.mocked(createPost).mockRejectedValue(new ApiRequestError("Your login has expired. Please log in again.", 401))
    renderPage()
    fillRequiredFields()
    await chooseYosemite()
    publish()

    expect(await screen.findByRole("alert")).toHaveTextContent("Your login has expired. Please log in again.")
    expect(sessionEnded).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem("access_token")).toBeNull()
    stopListening()
  })
})