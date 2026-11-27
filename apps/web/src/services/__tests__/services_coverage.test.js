import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import * as animalService from '@/services/animal.service';
import * as adoptionService from '@/services/adoption.service';
import * as lostfoundService from '@/services/lostfound.service';
import * as notificationService from '@/services/notification.service';
import * as auditService from '@/services/audit.service';
import * as settingsService from '@/services/settings.service';
import * as userService from '@/services/user.service';
import * as rescueService from '@/services/rescue.service';
import * as authService from '@/services/auth.service';
import * as storageService from '@/services/storage.service';
import { supabase } from '@/config/supabase';

describe('Frontend Services Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('animal.service.js', () => {
    it('getAnimals queries animals with optional filters', async () => {
      const mockAnimals = [{ id: 'a1', name: 'Buddy', species: 'DOG' }];
      vi.spyOn(api, 'get').mockResolvedValue({ data: mockAnimals });

      const result = await animalService.getAnimals({ species: 'DOG', adoptionStatus: 'AVAILABLE', shelterId: 'sh-1' });
      expect(result).toEqual(mockAnimals);
      expect(api.get).toHaveBeenCalledWith('/animals/', {
        params: { species: 'DOG', status: 'AVAILABLE', shelterId: 'sh-1' },
      });
    });

    it('getAnimalById returns animal on success and null on 404', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { id: 'a1', name: 'Milo' } });
      const animal = await animalService.getAnimalById('a1');
      expect(animal.name).toBe('Milo');

      vi.spyOn(api, 'get').mockRejectedValueOnce({ response: { status: 404 } });
      const notFound = await animalService.getAnimalById('unknown');
      expect(notFound).toBeNull();
    });

    it('createAnimal and surrenderAnimal post payloads to API', async () => {
      vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'new-animal-id' } });

      const id = await animalService.createAnimal({
        name: 'Rex',
        species: 'DOG',
        breed: 'German Shepherd',
        ageEstimate: '2 years',
        gender: 'MALE',
        weight: '25.5',
        healthStatus: 'HEALTHY',
      });
      expect(id).toBe('new-animal-id');

      const surrenderId = await animalService.surrenderAnimal({
        name: 'Cat',
        species: 'CAT',
        description: 'Friendly cat needing home',
      });
      expect(surrenderId).toBe('new-animal-id');
    });

    it('updateAnimal and updateAdoptionStatus send patch requests', async () => {
      const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true } });
      const getSpy = vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: 'feat-1' }] });

      await animalService.updateAnimal('a1', { name: 'New Name', isNeutered: true });
      expect(patchSpy).toHaveBeenCalledWith('/animals/a1', { name: 'New Name', isNeutered: true });

      await animalService.updateAdoptionStatus('a1', 'ADOPTED');
      expect(patchSpy).toHaveBeenCalledWith('/animals/a1', { adoptionStatus: 'ADOPTED' });

      await animalService.claimAnimal('a1');
      expect(postSpy).toHaveBeenCalledWith('/animals/a1/claim');

      const feat = await animalService.getFeaturedAnimals(4);
      expect(feat).toEqual([{ id: 'feat-1' }]);
    });
  });

  describe('adoption.service.js', () => {
    it('handles getApplications, submitApplication, and reviewApplication', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: 'app-1', status: 'SUBMITTED' }] });
      vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'app-new' } });
      vi.spyOn(api, 'patch').mockResolvedValue({ data: { id: 'app-1', status: 'APPROVED' } });

      const apps = await adoptionService.getApplicationsForReview();
      expect(apps).toHaveLength(1);

      const applicantApps = await adoptionService.getApplicationsByApplicant('usr-1');
      expect(applicantApps).toHaveLength(1);

      const created = await adoptionService.submitApplication({ animalId: 'a1', livingEnvironment: 'HOUSE' });
      expect(created).toBe('app-new');

      const byAnimal = await adoptionService.getApplicationsByAnimal('an-1');
      expect(byAnimal).toBeDefined();

      const singleApp = await adoptionService.getApplicationById('app-1');
      expect(singleApp).toBeDefined();

      vi.spyOn(api, 'get').mockRejectedValueOnce({ response: { status: 404 } });
      const notFoundApp = await adoptionService.getApplicationById('missing');
      expect(notFoundApp).toBeNull();

      await adoptionService.reviewApplication('app-1', 'APPROVED', 'usr-reviewer', 'Good environment');
      expect(api.patch).toHaveBeenCalledWith('/adoptions/app-1/status', {
        status: 'APPROVED',
        screeningNotes: 'Good environment',
      });
    });
  });

  describe('lostfound.service.js', () => {
    it('manages lost & found posts and replies', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [{ id: 'lf-1', title: 'Lost Pup' }], total: 1 } });
      vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'lf-1' } });
      vi.spyOn(api, 'patch').mockResolvedValue({ data: { id: 'lf-1', status: 'RESOLVED' } });

      const posts = await lostfoundService.getPosts({ type: 'LOST' });
      expect(posts.total).toBe(1);

      const post = await lostfoundService.getPostById('lf-1');
      expect(post.total).toBe(1);

      const newId = await lostfoundService.createPost({ title: 'Found Cat', type: 'FOUND' });
      expect(newId).toBe('lf-1');

      await lostfoundService.updatePostStatus('lf-1', 'RESOLVED');
      expect(api.patch).toHaveBeenCalledWith('/lostfound/lf-1/status', { status: 'RESOLVED' });

      await lostfoundService.addReply('lf-1', 'Saw this cat near central park');
      expect(api.post).toHaveBeenCalledWith('/lostfound/lf-1/replies', { text: 'Saw this cat near central park' });

      await lostfoundService.getReplies('lf-1');
      expect(api.get).toHaveBeenCalledWith('/lostfound/lf-1/replies');
    });
  });

  describe('notification.service.js', () => {
    it('fetches notifications, counts unread, and marks read', async () => {
      const mockNotifications = [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: true },
        { id: 'n3', isRead: false },
      ];
      vi.spyOn(api, 'get').mockResolvedValue({ data: mockNotifications });
      const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({ data: {} });
      const postSpy = vi.spyOn(api, 'post').mockResolvedValue({ data: {} });

      const notifs = await notificationService.getNotifications();
      expect(notifs).toHaveLength(3);

      const unread = await notificationService.getUnreadCount();
      expect(unread).toBe(2);

      await notificationService.markAsRead('n1');
      expect(patchSpy).toHaveBeenCalledWith('/notifications/n1/read');

      await notificationService.markAllAsRead();
      expect(postSpy).toHaveBeenCalledWith('/notifications/mark-all-read');
    });
  });

  describe('audit.service.js and settings.service.js', () => {
    it('retrieves audit logs', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: 'audit-1', action: 'ROLE_CHANGE' }] });
      const logs = await auditService.getAuditLogs({ limit: 50 });
      expect(logs).toHaveLength(1);
    });

    it('manages system settings', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: { defaultDispatchRadiusKm: 15 } });
      vi.spyOn(api, 'patch').mockResolvedValue({ data: { defaultDispatchRadiusKm: 20 } });

      const settings = await settingsService.getSystemSettings();
      expect(settings.defaultDispatchRadiusKm).toBe(15);

      const updated = await settingsService.updateSystemSettings({ defaultDispatchRadiusKm: 20 });
      expect(updated.defaultDispatchRadiusKm).toBe(20);
    });
  });

  describe('user.service.js', () => {
    it('handles user queries, profile updates, and role clearance workflows', async () => {
      const mockUser = {
        id: 'usr-1',
        email: 'user@test.com',
        display_name: 'Test User',
        role: 'CITIZEN',
      };
      vi.spyOn(api, 'get').mockResolvedValue({ data: mockUser });
      vi.spyOn(api, 'patch').mockResolvedValue({ data: mockUser });
      vi.spyOn(api, 'post').mockResolvedValue({ data: { success: true } });
      vi.spyOn(api, 'delete').mockResolvedValue({ data: { success: true } });

      const user = await userService.getUserById('usr-1');
      expect(user.displayName).toBe('Test User');

      vi.spyOn(api, 'get').mockResolvedValueOnce({ data: [mockUser] });
      const usersByRole = await userService.getUsersByRole('CITIZEN');
      expect(usersByRole).toHaveLength(1);

      vi.spyOn(api, 'get').mockResolvedValueOnce({ data: [mockUser] });
      const searched = await userService.searchUsers('Test');
      expect(searched).toHaveLength(1);

      await userService.updateUserProfile('usr-1', { displayName: 'Updated Name', bio: 'Animal lover' });
      expect(api.patch).toHaveBeenCalledWith('/users/usr-1', { displayName: 'Updated Name', bio: 'Animal lover' });

      await userService.updateUserRole('usr-1', 'VOLUNTEER');
      expect(api.patch).toHaveBeenCalledWith('/users/usr-1/role', { role: 'VOLUNTEER' });

      await userService.declineRoleRequest('usr-1');
      expect(api.post).toHaveBeenCalledWith('/users/usr-1/role-request/decline');

      await userService.requestClearance({ requestedRole: 'VOLUNTEER', idCardUrl: 'https://test.co/id.jpg' });
      expect(api.post).toHaveBeenCalledWith('/users/request-clearance', {
        requestedRole: 'VOLUNTEER',
        idCardUrl: 'https://test.co/id.jpg',
      });

      await userService.withdrawClearance();
      expect(api.delete).toHaveBeenCalledWith('/users/request-clearance');
    });
  });

  describe('rescue.service.js', () => {
    it('handles rescue lifecycle operations', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({ data: [{ id: 'res-1', title: 'Dog in danger' }] });
      vi.spyOn(api, 'post').mockResolvedValue({ data: { id: 'new-res-id' } });
      vi.spyOn(api, 'patch').mockResolvedValue({ data: { success: true } });
      vi.spyOn(api, 'delete').mockResolvedValue({ data: { success: true } });

      const rescues = await rescueService.getRescueRequests({ status: 'PENDING' });
      expect(rescues).toHaveLength(1);

      const publicRescues = await rescueService.getPublicRescues();
      expect(publicRescues).toHaveLength(1);

      vi.spyOn(api, 'get').mockResolvedValueOnce({ data: { id: 'res-1', title: 'Dog in danger' } });
      const singleRescue = await rescueService.getRescueRequestById('res-1');
      expect(singleRescue.title).toBe('Dog in danger');

      const createdId = await rescueService.createRescueRequest({ title: 'Stray Cat', species: 'CAT' });
      expect(createdId).toBe('new-res-id');

      await rescueService.updateRescueStatus('res-1', 'RESOLVED', 'Animal safe', 'u1', 'Responder 1');
      expect(api.patch).toHaveBeenCalledWith('/rescues/res-1/status', {
        status: 'RESOLVED',
        message: 'Animal safe',
        updatedBy: 'u1',
        updatedByName: 'Responder 1',
      });

      await rescueService.assignVolunteer('res-1', 'vol-1', 'Volunteer Joe');
      expect(api.post).toHaveBeenCalledWith('/rescues/res-1/assign', {
        volunteerId: 'vol-1',
        volunteerName: 'Volunteer Joe',
      });

      vi.spyOn(api, 'get').mockResolvedValueOnce({ data: [{ id: 'tl-1', message: 'Reported' }] });
      const timeline = await rescueService.getRescueTimeline('res-1');
      expect(timeline).toHaveLength(1);

      await rescueService.deleteRescueRequest('res-1');
      expect(api.delete).toHaveBeenCalledWith('/rescues/res-1');
    });
  });

  describe('auth.service.js', () => {
    it('fetches and updates user profiles', async () => {
      vi.spyOn(api, 'get').mockResolvedValue({
        data: { id: 'u1', email: 'vet@aniresq.org', displayName: 'Dr. Jane', role: 'VET' },
      });
      vi.spyOn(api, 'patch').mockResolvedValue({ data: { success: true } });

      const profile = await authService.getUserProfile('u1');
      expect(profile.displayName).toBe('Dr. Jane');
      expect(profile.role).toBe('VET');

      await authService.updateUserProfile('u1', { displayName: 'Dr. Jane Doe', phone: '1234567890' });
      expect(api.patch).toHaveBeenCalledWith('/users/u1', {
        displayName: 'Dr. Jane Doe',
        phone: '1234567890',
        phoneNumber: '1234567890',
      });
    });
  });

  describe('storage.service.js', () => {
    it('validates file formats, sizes, and deletes files', async () => {
      const validFile = new File(['valid content'], 'photo.jpg', { type: 'image/jpeg' });
      expect(storageService.validateFile(validFile)).toBe(true);

      const hugeFile = new File(['x'.repeat(100)], 'large.jpg', { type: 'image/jpeg' });
      expect(() => storageService.validateFile(hugeFile, { maxSize: 10 })).toThrow(/exceeds maximum allowed size/i);

      const invalidTypeFile = new File(['data'], 'script.exe', { type: 'application/x-msdownload' });
      expect(() => storageService.validateFile(invalidTypeFile)).toThrow(/invalid format/i);

      vi.spyOn(supabase.storage, 'from').mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.co/file.jpg' } }),
      });

      await storageService.deleteFile('https://test.co/storage/v1/object/public/uploads/user1/photo.jpg');
      expect(supabase.storage.from).toHaveBeenCalledWith('uploads');
    });

    it('handles file uploads to public and private buckets', async () => {
      const mockSession = { user: { id: 'usr-1' } };
      vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: mockSession } });
      vi.spyOn(supabase.storage, 'from').mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://test.co/file.jpg' } }),
      });

      const testFile = new File(['image content'], 'test.jpg', { type: 'image/jpeg' });
      const publicUrl = await storageService.uploadFile('pets/dog.jpg', testFile);
      expect(publicUrl).toBe('https://test.co/file.jpg');

      const idDocPath = await storageService.uploadIdDocument(testFile);
      expect(idDocPath).toContain('usr-1/id_document_');

      // Test image compression and multiple files upload
      const origImage = global.Image;
      const origGetContext = HTMLCanvasElement.prototype.getContext;
      const origToBlob = HTMLCanvasElement.prototype.toBlob;

      global.Image = class {
        constructor() {
          this.width = 1200;
          this.height = 900;
        }
        set src(v) {
          setTimeout(() => this.onload && this.onload(), 5);
        }
      };
      HTMLCanvasElement.prototype.getContext = () => ({
        drawImage: vi.fn(),
      });
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        callback(new Blob(['fake-jpg'], { type: 'image/jpeg' }));
      };

      try {
        const onProg = vi.fn();
        const urls = await storageService.uploadMultipleFiles('gallery', [testFile], onProg);
        expect(urls).toHaveLength(1);
        expect(onProg).toHaveBeenCalled();

        const empty = await storageService.uploadMultipleFiles('empty', []);
        expect(empty).toEqual([]);

        await storageService.deleteFile('https://test.co/file.jpg');
      } finally {
        global.Image = origImage;
        HTMLCanvasElement.prototype.getContext = origGetContext;
        HTMLCanvasElement.prototype.toBlob = origToBlob;
      }
    });
  });
});
