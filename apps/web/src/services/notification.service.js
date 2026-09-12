import { collection, doc, getDocs, addDoc, updateDoc, query, where, orderBy, limit, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/config/firebase";
const COLLECTION_NAME = "notifications";
const collectionRef = collection(db, COLLECTION_NAME);
const createNotification = async (userId, type, title, message, relatedEntityId, relatedEntityType) => {
  const docRef = await addDoc(collectionRef, {
    userId,
    type,
    title,
    message,
    isRead: false,
    relatedEntityId,
    relatedEntityType,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};
const getNotifications = async (userId) => {
  const q = query(
    collectionRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
};
const markAsRead = async (notificationId) => {
  const docRef = doc(db, COLLECTION_NAME, notificationId);
  await updateDoc(docRef, { isRead: true });
};
const markAllAsRead = async (userId) => {
  const q = query(collectionRef, where("userId", "==", userId), where("isRead", "==", false));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  const batch = writeBatch(db);
  snapshot.docs.forEach((document) => {
    batch.update(document.ref, { isRead: true });
  });
  await batch.commit();
};
const getUnreadCount = async (userId) => {
  const q = query(collectionRef, where("userId", "==", userId), where("isRead", "==", false));
  const snapshot = await getDocs(q);
  return snapshot.size;
};
export {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead
};
