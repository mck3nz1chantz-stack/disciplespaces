import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastHost } from "./components/Toast";
import { Dashboard } from "./pages/Dashboard";
import { SpaceDetail } from "./pages/SpaceDetail";
import { Bible } from "./pages/Bible";
import { Settings } from "./pages/Settings";
import { Help } from "./pages/Help";
import { Offline } from "./pages/Offline";
import { JoinGroup } from "./pages/JoinGroup";
import { NewGroup } from "./pages/NewGroup";

export default function App() {
  return (
    <BrowserRouter>
      <ToastHost />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="space/:id" element={<SpaceDetail />} />
          <Route path="join" element={<JoinGroup />} />
          <Route path="new" element={<NewGroup />} />
          <Route path="bible" element={<Bible />} />
          <Route path="settings" element={<Settings />} />
          <Route path="help" element={<Help />} />
          <Route path="offline" element={<Offline />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
