import type { components, paths, operations } from '@aniresq/shared-types';

export type ApiPaths = paths;
export type ApiComponents = components;
export type ApiOperations = operations;

// Typed domain models directly derived from the FastAPI OpenAPI schema:
export type ApiUserResponse = components['schemas']['UserResponse'];
export type ApiUserProfileUpdate = components['schemas']['UserProfileUpdate'];
export type ApiRescueResponse = components['schemas']['RescueResponse'];
export type ApiPublicRescueResponse = components['schemas']['PublicRescueResponse'];
export type ApiRescueCreate = components['schemas']['RescueRequestCreate'];
export type ApiTimelineEventResponse = components['schemas']['TimelineEventResponse'];
export type ApiAnimalResponse = components['schemas']['AnimalResponse'];
export type ApiAnimalUpdate = components['schemas']['AnimalUpdate'];
export type ApiAdoptionCreate = components['schemas']['AdoptionCreate'];
export type ApiAdoptionResponse = components['schemas']['AdoptionResponse'];
export type ApiLostFoundResponse = components['schemas']['LostFoundResponse'];
export type ApiNotificationResponse = components['schemas']['NotificationResponse'];
