import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";

import { HealthChat } from "@/components/HealthChat";
import { Shell } from "@/components/Shell";
import { apiRequest, setAuthToken } from "@/lib/api";
import { cacheData, readCachedData } from "@/lib/offline";
import { blankMedicine, blankProfile } from "@/constants";

const LandingPage = lazy(() => import("@/pages/LandingPage").then(module => ({ default: module.LandingPage })));
const AuthPage = lazy(() => import("@/pages/AuthPage").then(module => ({ default: module.AuthPage })));
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(module => ({ default: module.DashboardPage })));
const RecordsPage = lazy(() => import("@/pages/RecordsPage").then(module => ({ default: module.RecordsPage })));
const SharingPage = lazy(() => import("@/pages/SharingPage").then(module => ({ default: module.SharingPage })));
const ProfilePage = lazy(() => import("@/pages/ProfilePage").then(module => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import("@/pages/AdminPage").then(module => ({ default: module.AdminPage })));
const PublicReportPage = lazy(() => import("@/pages/PublicReportPage").then(module => ({ default: module.PublicReportPage })));

const LoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50">
    <LoaderCircle className="h-8 w-8 animate-spin text-sky-600" />
  </div>
);

const ProtectedApp = ({ token, user, onLogout, onSessionChange }) => {
  const [dashboard, setDashboard] = useState({ summary: {}, medicines: [], alerts: [], records: [], reminders: [], user });
  const [reports, setReports] = useState([]);
  const [records, setRecords] = useState([]);
  const [profileForm, setProfileForm] = useState({ ...blankProfile, ...user });
  const [medicineForm, setMedicineForm] = useState(blankMedicine);
  const [adminData, setAdminData] = useState({ summary: {}, users: [], rules: [] });
  const location = useLocation();

  const refreshData = async () => {
    try {
      const requests = [
        apiRequest({ method: "get", url: "/dashboard", token }),
        apiRequest({ method: "get", url: "/records", token }),
        apiRequest({ method: "get", url: "/reports", token }),
      ];
      if (user.role === "admin") {
        requests.push(apiRequest({ method: "get", url: "/admin/overview", token }));
      }
      const [dashboardResponse, recordsResponse, reportsResponse, adminResponse] = await Promise.all(requests);
      setDashboard(dashboardResponse);
      setRecords(recordsResponse.items || []);
      setReports(reportsResponse.items || []);
      setProfileForm({ ...blankProfile, ...dashboardResponse.user });
      await cacheData("meditrack-dashboard", dashboardResponse);
      await cacheData("meditrack-records", recordsResponse.items || []);
      await cacheData("meditrack-reports", reportsResponse.items || []);
      if (adminResponse) {
        setAdminData(adminResponse);
        await cacheData("meditrack-admin", adminResponse);
      }
    } catch {
      const [cachedDashboard, cachedRecords, cachedReports, cachedAdmin] = await Promise.all([
        readCachedData("meditrack-dashboard"),
        readCachedData("meditrack-records"),
        readCachedData("meditrack-reports"),
        readCachedData("meditrack-admin"),
      ]);
      if (cachedDashboard) setDashboard(cachedDashboard);
      if (cachedRecords) setRecords(cachedRecords);
      if (cachedReports) setReports(cachedReports);
      if (cachedAdmin) setAdminData(cachedAdmin);
      toast.info("Loaded cached health data for offline use.");
    }
  };

  useEffect(() => {
    refreshData();
  }, [token, user.role]);

  useEffect(() => {
    if (!("Notification" in window) || !dashboard.medicines?.length) return;
    Notification.requestPermission();
    const interval = window.setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      dashboard.medicines.forEach((medicine) => {
        if (medicine.reminder_times?.includes(currentTime) && Notification.permission === "granted") {
          new Notification(`Time for ${medicine.medicine_name}`, {
            body: `${medicine.dosage} • ${medicine.frequency}`,
          });
        }
      });
    }, 60000);
    return () => window.clearInterval(interval);
  }, [dashboard.medicines]);

  const addMedicine = async (payload, refreshOnly = false) => {
    if (refreshOnly) {
      await refreshData();
      return;
    }
    try {
      await apiRequest({ method: "post", url: "/medicines", token, data: payload });
      toast.success("Medicine added and interactions refreshed.");
      setMedicineForm(blankMedicine);
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not add medicine.");
    }
  };

  const refreshAlerts = async () => {
    try {
      const response = await apiRequest({ method: "post", url: "/alerts/refresh", token });
      setDashboard((prev) => ({ ...prev, alerts: response.items || [], summary: { ...prev.summary, alert_count: (response.items || []).length } }));
      const count = response.count || 0;
      if (count > 0) {
        toast.success(`Found ${count} interaction alert${count === 1 ? "" : "s"}.`);
      } else {
        toast.info("No new interaction alerts found.");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not refresh alerts.");
    }
  };

  const markTaken = async (medicineId) => {
    try {
      await apiRequest({ method: "post", url: `/medicines/${medicineId}/mark-taken`, token });
      toast.success("Medicine marked as taken.");
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Unable to mark medicine as taken.");
    }
  };

  const deleteMedicine = async (medicineId) => {
    try {
      await apiRequest({ method: "delete", url: `/medicines/${medicineId}`, token });
      toast.success("Medicine removed.");
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Unable to remove medicine.");
    }
  };

  const addRecord = async (payload, onDone) => {
    try {
      await apiRequest({ method: "post", url: "/records", token, data: payload });
      toast.success("Medical record saved.");
      onDone?.();
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not save record.");
    }
  };

  const deleteRecord = async (recordId) => {
    try {
      await apiRequest({ method: "delete", url: `/records/${recordId}`, token });
      toast.success("Record deleted.");
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Unable to delete record.");
    }
  };

  const createReport = async (payload, onDone) => {
    try {
      await apiRequest({ method: "post", url: "/reports", token, data: payload });
      toast.success("Doctor report generated.");
      onDone?.();
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not generate report.");
    }
  };

  const saveProfile = async () => {
    try {
      const response = await apiRequest({ method: "put", url: "/profile", token, data: { ...profileForm, age: Number(profileForm.age) } });
      onSessionChange(token, response.profile);
      toast.success("Profile updated.");
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Could not save profile.");
    }
  };

  const deleteAccount = async () => {
    try {
      await apiRequest({ method: "delete", url: "/auth/account", token });
      toast.success("Account deleted.");
      onLogout();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Unable to delete account.");
    }
  };

  const addRule = async (payload, onDone) => {
    try {
      await apiRequest({ method: "post", url: "/admin/interaction-rules", token, data: payload });
      toast.success("Interaction rule saved.");
      onDone?.();
      await refreshData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Unable to save interaction rule.");
    }
  };

  const currentPage = useMemo(() => {
    if (location.pathname === "/app/records") {
      return <RecordsPage token={token} records={records} onAddMedicine={addMedicine} onAddRecord={addRecord} onDeleteRecord={deleteRecord} />;
    }
    if (location.pathname === "/app/sharing") {
      return <SharingPage reports={reports} onCreateReport={createReport} />;
    }
    if (location.pathname === "/app/profile") {
      return <ProfilePage user={user} profileForm={profileForm} setProfileForm={setProfileForm} onSaveProfile={saveProfile} onDeleteAccount={deleteAccount} />;
    }
    if (location.pathname === "/app/admin") {
      return <AdminPage user={user} adminData={adminData} onAddRule={addRule} />;
    }
    return <DashboardPage dashboard={dashboard} medicineForm={medicineForm} setMedicineForm={setMedicineForm} onAddMedicine={addMedicine} onMarkTaken={markTaken} onDeleteMedicine={deleteMedicine} onRefreshAlerts={refreshAlerts} />;
  }, [location.pathname, token, records, reports, user, profileForm, dashboard, medicineForm, adminData]);

  return (
    <Shell user={user} onLogout={onLogout}>
      {currentPage}
      <HealthChat token={token} />
    </Shell>
  );
};

export const App = () => {
  const [token, setToken] = useState(localStorage.getItem("meditrack-token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("meditrack-user");
    return raw ? JSON.parse(raw) : null;
  });

  const handleSessionChange = (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    setAuthToken(nextToken);
    localStorage.setItem("meditrack-token", nextToken);
    localStorage.setItem("meditrack-user", JSON.stringify(nextUser));
  };

  const logout = () => {
    setToken("");
    setUser(null);
    setAuthToken("");
    localStorage.removeItem("meditrack-token");
    localStorage.removeItem("meditrack-user");
  };

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={token && user ? <Navigate to="/app/dashboard" replace /> : <LandingPage />} />
          <Route path="/auth" element={token && user ? <Navigate to="/app/dashboard" replace /> : <AuthPage onAuthSuccess={handleSessionChange} />} />
          <Route path="/report/:token" element={<PublicReportPage />} />
          <Route path="/app/dashboard" element={token && user ? <ProtectedApp token={token} user={user} onLogout={logout} onSessionChange={handleSessionChange} /> : <Navigate to="/auth" replace />} />
          <Route path="/app/records" element={token && user ? <ProtectedApp token={token} user={user} onLogout={logout} onSessionChange={handleSessionChange} /> : <Navigate to="/auth" replace />} />
          <Route path="/app/sharing" element={token && user ? <ProtectedApp token={token} user={user} onLogout={logout} onSessionChange={handleSessionChange} /> : <Navigate to="/auth" replace />} />
          <Route path="/app/profile" element={token && user ? <ProtectedApp token={token} user={user} onLogout={logout} onSessionChange={handleSessionChange} /> : <Navigate to="/auth" replace />} />
          <Route path="/app/admin" element={token && user ? <ProtectedApp token={token} user={user} onLogout={logout} onSessionChange={handleSessionChange} /> : <Navigate to="/auth" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
