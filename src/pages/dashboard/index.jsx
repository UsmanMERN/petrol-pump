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


// Petrol Pump Management Dummy Components
const FuelInventory = () => <h1>Fuel Inventory</h1>;
const Sales = () => <h1>Sales</h1>;
const Pumps = () => <h1>Pumps</h1>;
const Employees = () => <h1>Employees</h1>;
const Customers = () => <h1>Customers</h1>;
const Maintenance = () => <h1>Maintenance</h1>;
const Suppliers = () => <h1>Suppliers</h1>;
const SalesReport = () => <h1>Sales Report</h1>;
const InventoryReport = () => <h1>Inventory Report</h1>;
const Profile = () => <h1>Profile</h1>;
const Shifts = () => <h1>Shifts</h1>;

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
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />

                {/* Petrol Pump Management Routes */}
                <Route
                    path="fuel-inventory"
                    element={
                        <PrivateRoute
                            component={FuelInventory}
                            allowedRoles={["salesman", "manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="sales"
                    element={
                        <PrivateRoute
                            component={Sales}
                            allowedRoles={["salesman", "manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="pumps"
                    element={
                        <PrivateRoute
                            component={Pumps}
                            allowedRoles={["manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="employees"
                    element={
                        <PrivateRoute
                            component={Employees}
                            allowedRoles={["manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="customers"
                    element={
                        <PrivateRoute
                            component={Customers}
                            allowedRoles={["salesman", "manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="maintenance"
                    element={
                        <PrivateRoute
                            component={Maintenance}
                            allowedRoles={["manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="suppliers"
                    element={
                        <PrivateRoute
                            component={Suppliers}
                            allowedRoles={["admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="shifts"
                    element={
                        <PrivateRoute
                            component={Shifts}
                            allowedRoles={["salesman", "manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />

                {/* Reports Section */}
                <Route
                    path="reports/sales"
                    element={
                        <PrivateRoute
                            component={SalesReport}
                            allowedRoles={["manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="reports/sales"
                    element={
                        <PrivateRoute
                            component={SalesReport}
                            allowedRoles={["manager", "admin"]}
                            redirectPath="/dashboard/access-denied"
                        />
                    }
                />
                <Route
                    path="reports/inventory"
                    element={
                        <PrivateRoute
                            component={InventoryReport}
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
                            allowedRoles={["admin"]}
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