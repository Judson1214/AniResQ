export type UserRole = 'CITIZEN' | 'NGO' | 'VOLUNTEER' | 'SHELTER' | 'VET' | 'ADMIN';

export declare const UserRole: {
  readonly CITIZEN: 'CITIZEN';
  readonly NGO: 'NGO';
  readonly VOLUNTEER: 'VOLUNTEER';
  readonly SHELTER: 'SHELTER';
  readonly VET: 'VET';
  readonly ADMIN: 'ADMIN';
};

export type RescueSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export declare const RescueSeverity: {
  readonly LOW: 'LOW';
  readonly MEDIUM: 'MEDIUM';
  readonly HIGH: 'HIGH';
  readonly CRITICAL: 'CRITICAL';
};

export type RescueStatus = 'PENDING' | 'DISPATCHED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';
export declare const RescueStatus: {
  readonly PENDING: 'PENDING';
  readonly DISPATCHED: 'DISPATCHED';
  readonly IN_PROGRESS: 'IN_PROGRESS';
  readonly RESOLVED: 'RESOLVED';
  readonly CANCELLED: 'CANCELLED';
};

export type AnimalHealthStatus = 'HEALTHY' | 'UNDER_TREATMENT' | 'CRITICAL' | 'RECOVERED';
export type AdoptionStatus = 'AVAILABLE' | 'PENDING' | 'ADOPTED' | 'NOT_READY';
export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LocationCoordinates {
  latitude: number | null;
  longitude: number | null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  role: UserRole;
  requestedRole?: UserRole | null;
  latitude?: number | null;
  longitude?: number | null;
  serviceRadiusKm?: number;
  alertsEnabled?: boolean;
  createdAt: string;
}

export interface RescueIncident {
  id: string;
  title: string;
  description: string;
  species: string;
  severity: RescueSeverity;
  status: RescueStatus;
  reporterId: string;
  assignedTo?: string | null;
  location: LocationCoordinates;
  address: string;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnimalRecord {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  ageEstimate?: string | null;
  gender: string;
  weight?: number | null;
  healthStatus: AnimalHealthStatus;
  adoptionStatus: AdoptionStatus;
  description?: string | null;
  vaccinations: string[];
  isNeutered: boolean;
  specialNeeds?: string | null;
  shelterId?: string | null;
  surrenderedBy?: string | null;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdoptionApplication {
  id: string;
  animalId: string;
  applicantId: string;
  status: ApplicationStatus;
  housingType: string;
  hasFencedYard: boolean;
  hasOtherPets: boolean;
  otherPetsDetails?: string | null;
  experienceDescription?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
  isRead: boolean;
  createdAt: string;
}
