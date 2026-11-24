import type { components, paths, operations } from '@aniresq/shared-types';

export type ApiPaths = paths;
export type ApiComponents = components;
export type ApiOperations = operations;

// Typed domain models directly derived from the FastAPI OpenAPI schema:
export type ApiUserResponse = components['schemas']['UserResponse'];
export type ApiUserProfileUpdate = components['schemas']['UserProfileUpdate'];
export type ApiRescueResponse = components['schemas']['RescueResponse'];
export type ApiRescueCreate = components['schemas']['RescueRequestCreate'];
export type ApiAnimalResponse = components['schemas']['AnimalResponse'];
export type ApiAnimalUpdate = components['schemas']['AnimalUpdate'];
export type ApiAdoptionApplicationCreate = components['schemas']['AdoptionApplicationCreate'];
