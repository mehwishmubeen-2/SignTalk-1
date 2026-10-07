import { createBrowserRouter } from "react-router";
import { Root } from "./pages/Root";
import { Onboarding } from "./pages/Onboarding";
import { Home } from "./pages/Home";
import { SignDictionary } from "./pages/SignDictionary";
import { SignToText } from "./pages/SignToText";
import { VoiceToText } from "./pages/VoiceToText";
import VideoCall from "./pages/VideoCall";
import { VideoCallLanding } from "./pages/VideoCallLanding";
import { Dashboard } from "./pages/Dashboard";
import { Profile } from "./pages/Profile";
import { Auth } from "./pages/Auth";
import { NotFound } from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ResetPassword } from "./pages/ResetPassword";


export const router = createBrowserRouter([
  {
    path: "/onboarding",
    Component: Onboarding,
  },
  {
    path: "/auth",
    Component: Auth,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    // Full-screen video call — outside Root so no nav header overlaid
    path: "/call/:roomId",
    Component: VideoCall,
  },
  {
    // Public layout — accessible without login
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "dictionary", Component: SignDictionary },
      { path: "sign-to-text", Component: SignToText },
      { path: "voice-to-text", Component: VoiceToText },
      { path: "video-call", Component: VideoCallLanding },
      {
        // Protected — must be logged in
        Component: ProtectedRoute,
        children: [
          { path: "dashboard", Component: Dashboard },
          { path: "profile", Component: Profile },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);
