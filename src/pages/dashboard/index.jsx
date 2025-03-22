import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PrivateRoute from "../private/PrivateRoute";
import DashboardLayout from "./DashboardLayout";

// Import dashboard pages
import DashboardHome from "./Home";
import AccessDenied from "./AccessDenied";
import Settings from "./Settings";
import UserManagement from "./Users"
import Registration from "./Registration"
import Invoices from "./Invoices"
import DailyReport from "./DailyReport"


export default function Dashboard() {
    const { user } = useAuth();

    // If user is not authenticated, redirect to login
    if (!user) {
        return <Navigate to="/auth/login" replace />;
    }

    return (
        <DashboardLayout>
            <Routes>
                {/* Dashboard Home */}
                <Route index element={<DashboardHome />} />

                {/* Common routes */}
                <Route path="settings" element={<Settings />} />

                {/* Reports Section */}
                <Route
                    path="daily-report"
                    element={
                        <PrivateRoute
                            component={DailyReport}
                            allowedRoles={["manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="registration/*"
                    element={
                        <PrivateRoute
                            component={Registration}
                            allowedRoles={["admin", "manager"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="invoices/*"
                    element={
                        <PrivateRoute
                            component={Invoices}
                            allowedRoles={["admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />

                {/* Admin-only route */}
                <Route
                    path="user-management"
                    element={
                        <PrivateRoute
                            component={UserManagement}
                            allowedRoles={["admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />

                {/* Access Denied */}
                <Route path="access-denied" element={<AccessDenied />} />

                {/* Catch all for undefined routes */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </DashboardLayout>
    );
}