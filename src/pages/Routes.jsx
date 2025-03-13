// src/routes/Index.jsx
import React from "react";
import { Navigate, Route, Routes } from 'react-router-dom';
import Frontend from "./frontend";
import Dashboard from "./dashboard";
import Auth from "./auth";
import { useAuth } from '../context/AuthContext';
import "bootstrap/dist/js/bootstrap.bundle";
import 'bootstrap/dist/css/bootstrap.min.css';

export default function Index() {
    const { user } = useAuth();

    return (
        <Routes>
            {/* Public routes */}
            <Route path='/*' element={<Frontend />} />

            {/* Auth routes - redirect to dashboard if already logged in */}
            <Route path='auth/*' element={!user ? <Auth /> : <Navigate to="/dashboard" />} />

            {/* Dashboard routes - handled internally by Dashboard component */}
            <Route path='dashboard/*' element={<Dashboard />} />
        </Routes>
    );
}