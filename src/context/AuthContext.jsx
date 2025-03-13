import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../config/firebase";
import { signOut, createUserWithEmailAndPassword } from "firebase/auth";
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
} from "firebase/firestore";
import Cookies from "js-cookie";
import CryptoJS from "crypto-js";

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY;
// Helper functions for encryption and decryption

const encryptData = (data) => {
    return CryptoJS.AES.encrypt(JSON.stringify(data), SECRET_KEY).toString();
};

const decryptData = (ciphertext) => {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
};

// Create Context
const AuthContext = createContext();

// Auth Provider Component
export const AuthContextProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Function to fetch user details from Firestore
    const fetchUserDetails = async (uid) => {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            return null;
        }
    };

    useEffect(() => {
        // Check if encrypted user exists in cookies first
        const cookieUser = Cookies.get("user");
        if (cookieUser) {
            try {
                const decryptedUser = decryptData(cookieUser);
                setUser(decryptedUser);
            } catch (error) {
                console.error("Error decrypting user data:", error);
            }
            setLoading(false);
        }

        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            if (currentUser) {
                fetchUserDetails(currentUser.uid)
                    .then((userDetails) => {
                        const userData = userDetails ? userDetails : currentUser;
                        setUser(userData);
                        // Encrypt user data before storing in cookie
                        const encryptedUser = encryptData(userData);
                        Cookies.set("user", encryptedUser, {
                            expires: 7,
                            secure: true,
                            sameSite: "strict",
                        });
                        setLoading(false);
                    })
                    .catch((err) => {
                        console.error("Error fetching user details:", err);
                        setUser(currentUser);
                        setLoading(false);
                    });
            } else {
                setUser(null);
                Cookies.remove("user");
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    // Logout function: remove cookie and sign out
    const logout = async () => {
        Cookies.remove("user");
        return signOut(auth);
    };

    // Update user details function: update Firestore and refresh cookie data
    const updateUser = async (uid, updatedData) => {
        const userDocRef = doc(db, "users", uid);
        await updateDoc(userDocRef, updatedData);
        if (user && user.uid === uid) {
            const updatedUser = { ...user, ...updatedData };
            setUser(updatedUser);
            const encryptedUser = encryptData(updatedUser);
            Cookies.set("user", encryptedUser, {
                expires: 7,
                secure: true,
                sameSite: "strict",
            });
        }
    };

    // Get all users function
    const getAllUsers = async () => {
        const querySnapshot = await getDocs(collection(db, "users"));
        const usersData = [];
        querySnapshot.forEach((doc) => {
            usersData.push({ uid: doc.id, ...doc.data() });
        });
        return usersData;
    };

    // Add user function - used when creating a new user document
    const addUser = async (uid, data) => {
        await setDoc(doc(db, "users", uid), data);
    };

    // Create new user account function
    const createNewUser = async (email, password, additionalData = {}) => {
        const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
        const userData = { uid: newUser.uid, email, ...additionalData };
        await addUser(newUser.uid, userData);
        setUser(userData);
        const encryptedUser = encryptData(userData);
        Cookies.set("user", encryptedUser, {
            expires: 7,
            secure: true,
            sameSite: "strict",
        });
        return userData;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                logout,
                loading,
                updateUser,
                getAllUsers,
                addUser,
                createNewUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

// Custom Hook to use Auth Context
export const useAuth = () => {
    return useContext(AuthContext);
};
