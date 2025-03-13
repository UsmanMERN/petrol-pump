// src/routes/dashboard/index.jsx
import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PrivateRoute from "../private/PrivateRoute";
import DashboardLayout from "./DashboardLayout";

// Import dashboard pages
import DashboardHome from "./Home";
// import NozelSales from "../../pages/dashboard/NozelSales";
// import Accounts from "../../pages/dashboard/Accounts";
// import Purchase from "../../pages/dashboard/Purchase";
// import Inventory from "../../pages/dashboard/Inventory";
// import Payroll from "../../pages/dashboard/Payroll";
// import SmsIntegration from "../../pages/dashboard/SmsIntegration";
// import DailyReport from "../../pages/dashboard/reports/DailyReport";
// import CreditReport from "../../pages/dashboard/reports/CreditReport";
// import UserRoles from "../../pages/dashboard/UserRoles";
// import Profile from "../../pages/dashboard/Profile";
// import Settings from "../../pages/dashboard/Settings";
import AccessDenied from "./AccessDenied";
import Settings from "./Settings";

const NozelSales = () => <h1>NozelSales</h1>
const Accounts = () => <h1>Accounts</h1>
const Purchase = () => <h1>Purchase</h1>
const Inventory = () => <h1>Inventory</h1>
const Payroll = () => <h1>Inventory</h1>
const SmsIntegration = () => <h1>SmsIntegration</h1>
const DailyReport = () => <h1>DailyReport</h1>
const CreditReport = () => <h1>CreditReport</h1>
const UserRoles = () => <h1>UserRoles</h1>
const Profile = () => <h1>Profile</h1>
// const Settings = () => <h1>Settings</h1>

export default function Dashboard() {
    const { user } = useAuth();

    // If user is not authenticated, redirect to login
    if (!user) {
        return <Navigate to="/auth/login" replace />;
    }

    return (
        <DashboardLayout>
            <Routes>
                {/* Dashboard home */}
                <Route index element={<DashboardHome />} />

                {/* Routes for all authenticated users */}
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />

                {/* Routes for sellers, managers, and admins */}
                <Route path="nozel-sales" element={
                    <PrivateRoute component={NozelSales} allowedRoles={["seller", "manager", "admin"]} redirectPath="/dashboard/access-denied" />
                } />

                <Route path="purchase" element={
                    <PrivateRoute component={Purchase} allowedRoles={["seller", "manager", "admin"]} redirectPath="/dashboard/access-denied" />
                } />

                <Route path="inventory" element={
                    <PrivateRoute component={Inventory} allowedRoles={["seller", "manager", "admin"]} redirectPath="/dashboard/access-denied" />
                } />

                {/* Reports section */}
                <Route path="reports/daily" element={
                    <PrivateRoute component={DailyReport} allowedRoles={["seller", "manager", "admin"]} redirectPath="/dashboard/access-denied" />
                } />

                <Route path="reports/credit" element={
                    <PrivateRoute component={CreditReport} allowedRoles={["manager", "admin"]} redirectPath="/dashboard/access-denied" />
                } />

                {/* Routes for managers and admins */}
                <Route path="accounts" element={
                    <PrivateRoute component={Accounts} allowedRoles={["manager", "admin"]} redirectPath="/dashboard/access-denied" />
                } />

                <Route path="payroll" element={
                    <PrivateRoute component={Payroll} allowedRoles={["manager", "admin"]} redirectPath="/dashboard/access-denied" />
                } />

                {/* Admin-only routes */}
                <Route path="sms" element={
                    <PrivateRoute component={SmsIntegration} allowedRoles={["admin"]} redirectPath="/dashboard/access-denied" />
                } />

                <Route path="user-roles" element={
                    <PrivateRoute component={UserRoles} allowedRoles={["admin"]} redirectPath="/dashboard/access-denied" />
                } />
                <Route path="settings" element={
                    <PrivateRoute component={Settings} allowedRoles={["admin"]} redirectPath="/dashboard/access-denied" />
                } />

                {/* Access denied page */}
                <Route path="access-denied" element={<AccessDenied />} />

                {/* Catch all for undefined routes */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </DashboardLayout>
    );
}