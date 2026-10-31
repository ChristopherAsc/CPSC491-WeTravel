import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProtectedRoute from "@/auth/ProtectedRoute";
import { useAuth } from "@/auth/useAuth";

vi.mock("@/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/login" element={<p>Login Page</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<p>Profile Page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProtectedRoute - SOC 2 C03", () => {
  it("redirects unauthenticated users to login", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();

    expect(await screen.findByText("Login Page")).toBeTruthy();
    expect(screen.queryByText("Profile Page")).toBeNull();
  });

  it("allows authenticated users to access protected pages", async () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();

    expect(await screen.findByText("Profile Page")).toBeTruthy();
  });

  it("does not render protected content during session validation", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    } as ReturnType<typeof useAuth>);

    renderProtectedRoute();

    expect(screen.queryByText("Profile Page")).toBeNull();
    expect(screen.queryByText("Login Page")).toBeNull();
  });
});
