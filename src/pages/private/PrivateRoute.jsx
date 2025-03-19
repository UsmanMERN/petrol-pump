import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import Loader from "../../components/Loader";

// Loading spinner component
const LoadingSpinner = () => (
    <div className="min-vh-100 loading-spinner d-flex justify-content-center align-items-center">
        <Loader />
    </div>
);

export default function PrivateRoute({ component: Component, allowedRoles = [], redirectPath = "/" }) {
    const { user } = useAuth();
    const [isAllowed, setIsAllowed] = useState(null);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        if (!user) {
            setIsAllowed(false);
            return;
        }

        const fetchUserRole = async () => {
            try {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const role = userSnap.data().role;
                    setUserRole(role);

                    // Handle role whether it's a string or an array
                    if (allowedRoles.length === 0) {
                        // Allow all authenticated users if no specific roles required
                        setIsAllowed(true);
                    } else if (Array.isArray(role)) {
                        // If role is an array, check if any role is in allowedRoles
                        const hasAllowedRole = role.some(r => allowedRoles.includes(r));
                        setIsAllowed(hasAllowedRole);
                    } else {
                        // If role is a string, check if it's in allowedRoles
                        setIsAllowed(allowedRoles.includes(role));
                    }
                } else {
                    // User document doesn't exist
                    console.error("User document doesn't exist in Firestore");
                    setIsAllowed(false);
                }
            } catch (error) {
                console.error("Error fetching user role:", error);
                setIsAllowed(false);
            }
        };

        fetchUserRole();
    }, [user, allowedRoles]);


    // Show loading state while checking permissions
    if (isAllowed === null) {
        return <LoadingSpinner />;
    }

    // If not allowed, redirect to specified path
    if (!isAllowed) {
        return <Navigate to={redirectPath} />;
    }

    // If allowed, render the component with the userRole prop
    return <Component userRole={userRole} />;
}