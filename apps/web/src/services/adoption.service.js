import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { ApplicationStatus } from "@aniresq/shared-types";
const COLLECTION_NAME = "adoptionApplications";
const collectionRef = collection(db, COLLECTION_NAME);
const submitApplication = async (data) => {
  const docRef = await addDoc(collectionRef, {
    ...data,
    status: ApplicationStatus.SUBMITTED,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};
const getApplicationsByApplicant = async (applicantId) => {
  const q = query(collectionRef, where("applicantId", "==", applicantId), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
};
const getApplicationsByAnimal = async (animalId) => {
  const q = query(collectionRef, where("animalId", "==", animalId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
};
const getApplicationsForReview = async (status) => {
  let q = query(collectionRef, orderBy("createdAt", "asc"));
  if (status) {
    q = query(collectionRef, where("status", "==", status), orderBy("createdAt", "asc"));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
};
const reviewApplication = async (id, status, reviewerId, screeningNotes) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    status,
    reviewerId,
    screeningNotes,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};
const getApplicationById = async (id) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};
export {
  getApplicationById,
  getApplicationsByAnimal,
  getApplicationsByApplicant,
  getApplicationsForReview,
  reviewApplication,
  submitApplication
};
