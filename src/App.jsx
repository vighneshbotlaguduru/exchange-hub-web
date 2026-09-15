import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./modules/AuthContext.jsx";
import MainLayout from "./modules/MainLayout";
import DashboardLayout from "./modules/DashboardLayout";
import ProtectedRoute from "./modules/ProtectedRoute";
import AdminRoute from "./modules/AdminRoute";
import Home from "./modules/Home";
import Login from "./modules/Login";
import Register from "./modules/Register";
import UserDashboard from "./modules/UserDashboard";
import AdminLogin from "./modules/AdminLogin";
import AdminDashboard from "./modules/AdminDashboard";
import NotFound from "./modules/NotFound";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin/login" element={<AdminLogin />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<UserDashboard />} />
            </Route>
          </Route>

          <Route element={<AdminRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
