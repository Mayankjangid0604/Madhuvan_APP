import { Routes, Route } from "react-router-dom";
import { useBodyScrollReset } from "../../hooks/useBodyScrollLock";
import ProtectedRoute from "../../components/auth/ProtectedRoute";
import MainLayout from "../../layout/MainLayout/MainLayout";
import Dashboard from "../../pages/Dashboard/Dashboard";
import Students from "../../pages/Students/Students";
import Rooms from "../../pages/Rooms/Rooms";
import AddRoom from "../../pages/Rooms/AddRoom";
import BulkAddRoom from "../../pages/Rooms/BulkAddRoom";
import Fees from "../../pages/Fees/ReceiveFee";
import Ledger from "../../pages/Ledger/Ledger";
import Reports from "../../pages/Reports/Reports";
import Settings from "../../pages/Settings/Settings";
import Communication from "../../pages/Settings/Communication/Communication";
import CommunicationLogs from "../../pages/Settings/Communication/CommunicationLogs";
import AddStudent from "../../pages/Students/AddStudent/AddStudent";
import EditStudent from "../../pages/Students/EditStudent/EditStudent";
import FeeDetails from "../../pages/Fees/FeeDetails";
import Login from "../../pages/Auth/Login";
import AllocateRoom from "../../pages/Rooms/AllocateRoom";
import FinePage from "../../pages/fine/FinePage";
import Members from "../../pages/members/Members";
import MemberDetailsPage from "../../pages/members/MemberDetailsPage";

const AppRoutes = () => {
  useBodyScrollReset();

  return (
    <Routes>
      {/* ✅ FIX: Login OUTSIDE MainLayout — no sidebar/topbar on login page */}
      <Route path="/login" element={<Login />} />

      {/* ✅ All protected routes INSIDE MainLayout */}
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />

        {/* Students */}
        <Route path="/students" element={<Students />} />
        <Route path="/students/add" element={<AddStudent />} />
        <Route path="/students/edit/:id" element={<EditStudent />} />

        {/* Rooms */}
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/add" element={<AddRoom />} />
        <Route path="/rooms/bulk-add" element={<BulkAddRoom />} />
        <Route path="/rooms/allocate" element={<AllocateRoom />} />

        {/* Fees & Finance */}
        <Route path="/fees" element={<Fees />} />
        <Route path="/fees/student/:studentId" element={<FeeDetails />} />
        <Route path="/fine" element={<FinePage />} />
        <Route path="/ledger" element={<Ledger />} />

        {/* Other */}
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/communication" element={<Communication />} />
        <Route path="/settings/communication/logs" element={<CommunicationLogs />} />
        <Route path="/members" element={<Members />} />
        <Route path="/members/:id" element={<MemberDetailsPage />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;