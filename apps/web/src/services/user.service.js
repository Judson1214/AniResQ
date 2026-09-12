import { collection, doc, getDoc, getDocs, updateDoc, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
const COLLECTION_NAME = "users";
const collectionRef = collection(db, COLLECTION_NAME);
const getUserById = async (uid) => {
  const docRef = doc(db, COLLECTION_NAME, uid);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { uid: snapshot.id, ...snapshot.data() };
};
const getUsersByRole = async (role) => {
  const q = query(collectionRef, where("role", "==", role));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc2) => ({ uid: doc2.id, ...doc2.data() }));
};
const updateUserProfile = async (uid, data) => {
  const docRef = doc(db, COLLECTION_NAME, uid);
  await updateDoc(docRef, data);
};
const searchUsers = async (searchQuery) => {
  const q = query(
    collectionRef,
    where("displayName", ">=", searchQuery),
    where("displayName", "<=", searchQuery + "\uF8FF")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc2) => ({ uid: doc2.id, ...doc2.data() }));
};
export {
  getUserById,
  getUsersByRole,
  searchUsers,
  updateUserProfile
};
