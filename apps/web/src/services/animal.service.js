import { collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/config/firebase";
import { uploadMultipleFiles } from "./storage.service";
import { AdoptionStatus } from "@aniresq/shared-types";
const COLLECTION_NAME = "animals";
const collectionRef = collection(db, COLLECTION_NAME);
const createAnimal = async (data, photos) => {
  const docRef = await addDoc(collectionRef, {
    ...data,
    adoptionStatus: data.adoptionStatus || AdoptionStatus.AVAILABLE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  if (photos.length > 0) {
    const photoUrls = await uploadMultipleFiles(`animal-photos/${docRef.id}`, photos);
    await updateDoc(docRef, { photos: photoUrls });
  }
  return docRef.id;
};
const getAnimals = async (filters) => {
  let q = query(collectionRef, orderBy("createdAt", "desc"));
  if (filters) {
    const conditions = [];
    if (filters.species && filters.species !== "All") conditions.push(where("species", "==", filters.species));
    if (filters.adoptionStatus) conditions.push(where("adoptionStatus", "==", filters.adoptionStatus));
    if (filters.shelterId) conditions.push(where("shelterId", "==", filters.shelterId));
    if (conditions.length > 0) {
      q = query(collectionRef, ...conditions, orderBy("createdAt", "desc"));
    }
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc2) => ({ id: doc2.id, ...doc2.data() }));
};
const getAnimalById = async (id) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};
const updateAnimal = async (id, data) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
};
const updateAdoptionStatus = async (id, status) => {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, { adoptionStatus: status, updatedAt: serverTimestamp() });
};
const getFeaturedAnimals = async (limitNum) => {
  const q = query(
    collectionRef,
    where("adoptionStatus", "==", AdoptionStatus.AVAILABLE),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limitNum).map((doc2) => ({ id: doc2.id, ...doc2.data() }));
};
export {
  createAnimal,
  getAnimalById,
  getAnimals,
  getFeaturedAnimals,
  updateAdoptionStatus,
  updateAnimal
};
