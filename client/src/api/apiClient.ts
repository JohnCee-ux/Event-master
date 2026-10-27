import {
  IEvent,
  IAttendee,
  IAuditLog,
  IEventAnalytics,
  IPostEventSummary,
  CheckInResponse,
  SyncCheckInRequest,
  SyncCheckInResponse,
  RegistrationResponse,
  IOrganizer,
} from '../../../shared/types.js';

export const getDeviceId = (): string => {
  if (typeof window === 'undefined') return 'server';
  let deviceId = localStorage.getItem('gatekeeper_device_id');
  if (!deviceId) {
    deviceId = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
    localStorage.setItem('gatekeeper_device_id', deviceId);
  }
  return deviceId;
};

class ApiClient {
  /**
   * Authentication relies entirely on the httpOnly cookie set by the server.
   * It is sent automatically by the browser via `credentials: 'include'` and
   * is NOT accessible to JavaScript — eliminating the XSS attack surface.
   * No JWT is stored in localStorage.
   */
  private getBaseHeaders(): HeadersInit {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const superAdminToken =
      typeof window !== 'undefined'
        ? sessionStorage.getItem('gatekeeper_superadmin_token') || localStorage.getItem('gatekeeper_superadmin_token')
        : null;
    if (superAdminToken) {
      headers['x-super-admin-token'] = superAdminToken;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const headers = {
      ...this.getBaseHeaders(),
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // sends httpOnly cookie automatically on every request
    });

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`;
      } catch {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    // Return blob if requested (for CSV downloads)
    if (options.headers && (options.headers as Record<string, string>)['Accept'] === 'text/csv') {
      return (await response.blob()) as unknown as T;
    }

    return response.json();
  }

  // --- Auth Endpoints ---
  public async registerOrganizer(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ token: string; organizer: IOrganizer }> {
    return this.request<{ token: string; organizer: IOrganizer }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async requestRegistrationOtp(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/api/auth/register/request-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async verifyRegistrationOtp(email: string, otp: string): Promise<{ token: string; organizer: IOrganizer }> {
    return this.request('/api/auth/register/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  public async loginOrganizer(data: {
    email: string;
    password: string;
  }): Promise<{ token: string; organizer: IOrganizer }> {
    return this.request<{ token: string; organizer: IOrganizer }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async sendOtp(
    email: string
  ): Promise<{ success: boolean; message: string; previewUrl?: string }> {
    return this.request<{ success: boolean; message: string; previewUrl?: string }>(
      '/api/auth/send-otp',
      { method: 'POST', body: JSON.stringify({ email }) }
    );
  }

  public async verifyOtp(
    email: string,
    otp: string
  ): Promise<{ token: string; organizer: IOrganizer }> {
    return this.request<{ token: string; organizer: IOrganizer }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  public async sendPasswordResetOtp(
    email: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/auth/send-password-reset-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  public async resetPassword(data: {
    email: string;
    otp: string;
    password: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async logoutOrganizer(): Promise<void> {
    await this.request('/api/auth/logout', { method: 'POST' });
  }

  public async getMe(): Promise<{ organizer: IOrganizer }> {
    return this.request<{ organizer: IOrganizer }>('/api/auth/me');
  }

  // --- Event Endpoints ---
  public async getEvents(): Promise<{ events: IEvent[] }> {
    return this.request<{ events: IEvent[] }>('/api/events');
  }

  public async getEvent(id: string): Promise<{ event: IEvent }> {
    return this.request<{ event: IEvent }>(`/api/events/${id}`);
  }

  public async createEvent(data: {
    name: string;
    description?: string;
    imageDataUrl?: string | null;
    date: string;
    startTime: string;
    venue: string;
    capacity: number;
    prefix?: string;
  }): Promise<{ event: IEvent }> {
    return this.request<{ event: IEvent }>('/api/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateEvent(id: string, data: Partial<IEvent>): Promise<{ event: IEvent }> {
    return this.request<{ event: IEvent }>(`/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  public async publishEvent(id: string): Promise<{ success: boolean; event: IEvent }> {
    return this.request<{ success: boolean; event: IEvent }>(`/api/events/${id}/publish`, {
      method: 'POST',
    });
  }

  public async startEvent(id: string): Promise<{ success: boolean; event: IEvent }> {
    return this.request<{ success: boolean; event: IEvent }>(`/api/events/${id}/start`, {
      method: 'POST',
    });
  }

  public async endEvent(id: string): Promise<{ success: boolean; event: IEvent }> {
    return this.request<{ success: boolean; event: IEvent }>(`/api/events/${id}/end`, {
      method: 'POST',
    });
  }

  public async deleteEvent(id: string): Promise<{ success: boolean; message: string; deletedAttendeesCount?: number }> {
    return this.request<{ success: boolean; message: string; deletedAttendeesCount?: number }>(`/api/events/${id}`, {
      method: 'DELETE',
    });
  }

  public async getEventAnalytics(id: string): Promise<{ analytics: IEventAnalytics }> {
    return this.request<{ analytics: IEventAnalytics }>(`/api/events/${id}/analytics`);
  }

  public async getPostEventSummary(id: string): Promise<{ summary: IPostEventSummary }> {
    return this.request<{ summary: IPostEventSummary }>(`/api/events/${id}/summary`);
  }

  public async getAuditLogs(
    id: string,
    params?: { page?: number; limit?: number; action?: string }
  ): Promise<{
    logs: IAuditLog[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.action) query.append('action', params.action);
    return this.request(`/api/events/${id}/audit-log?${query.toString()}`);
  }

  // --- Public Attendee Endpoints ---
  public async getPublicEvents(): Promise<{
    events: Array<{
      id: string;
      name: string;
      description: string;
      imageDataUrl?: string | null;
      date: string;
      startTime: string;
      venue: string;
      capacity: number;
      status: string;
      prefix: string;
      registeredCount: number;
      isSoldOut: boolean;
    }>;
  }> {
    return this.request('/api/events/public');
  }

  public async getPublicEvent(id: string): Promise<{
    event: {
      id: string;
      name: string;
      description: string;
      imageDataUrl?: string | null;
      date: string;
      startTime: string;
      venue: string;
      capacity: number;
      status: string;
      prefix: string;
      registeredCount: number;
      isSoldOut: boolean;
    };
  }> {
    return this.request(`/api/events/public/${id}`);
  }

  public async registerAttendee(data: {
    eventId: string;
    name: string;
    email: string;
    ticketType?: string;
  }): Promise<RegistrationResponse> {
    return this.request<RegistrationResponse>('/api/attendees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async publicLookupTicket(data: {
    email?: string;
    ticketCode?: string;
    eventId?: string;
  }): Promise<RegistrationResponse> {
    return this.request<RegistrationResponse>('/api/attendees/public-lookup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async listAttendees(
    eventId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      filter?: string;
      ticketType?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{
    attendees: IAttendee[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams({ eventId });
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.search) query.append('search', params.search);
    if (params?.filter) query.append('filter', params.filter);
    if (params?.ticketType) query.append('ticketType', params.ticketType);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.sortOrder) query.append('sortOrder', params.sortOrder);

    return this.request(`/api/attendees?${query.toString()}`);
  }

  public async checkInByCode(
    eventId: string,
    code: string,
    source: 'camera' | 'manual' = 'camera'
  ): Promise<CheckInResponse> {
    return this.request<CheckInResponse>('/api/attendees/checkin-code', {
      method: 'POST',
      body: JSON.stringify({ eventId, code, deviceId: getDeviceId(), source }),
    });
  }

  public async checkInById(attendeeId: string): Promise<CheckInResponse> {
    return this.request<CheckInResponse>(`/api/attendees/${attendeeId}/checkin`, {
      method: 'PATCH',
    });
  }

  public async undoCheckIn(
    attendeeId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string; attendee: IAttendee }> {
    return this.request(`/api/attendees/${attendeeId}/undo-checkin`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason || 'Accidental scan undo' }),
    });
  }

  public async resendTicket(
    attendeeId: string
  ): Promise<{ success: boolean; message: string; previewUrl?: string }> {
    return this.request(`/api/attendees/${attendeeId}/resend-ticket`, {
      method: 'POST',
    });
  }

  // --- Offline Sync Endpoint ---
  public async syncOfflineScans(payload: SyncCheckInRequest): Promise<SyncCheckInResponse> {
    return this.request<SyncCheckInResponse>('/api/checkins/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Super Admin Endpoints ---
  public async requestSuperAdminOtp(): Promise<{ success: boolean; message: string }> {
    return this.request('/api/super-admin/request-otp', { method: 'POST' });
  }

  public async verifySuperAdminOtp(otp: string): Promise<{ success: boolean; message: string; token: string }> {
    const res = await this.request<{ success: boolean; message: string; token: string }>('/api/super-admin/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    });
    if (res.token && typeof window !== 'undefined') {
      sessionStorage.setItem('gatekeeper_superadmin_token', res.token);
      localStorage.setItem('gatekeeper_superadmin_token', res.token);
    }
    return res;
  }

  public async getSuperAdminStatus(): Promise<{ unlocked: boolean; isSuperAdmin: boolean }> {
    return this.request<{ unlocked: boolean; isSuperAdmin: boolean }>('/api/super-admin/status');
  }

  public lockSuperAdmin(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('gatekeeper_superadmin_token');
      localStorage.removeItem('gatekeeper_superadmin_token');
    }
    this.request('/api/super-admin/lock', { method: 'POST' }).catch(() => {});
  }

  public async getSuperAdminOverview(): Promise<{
    metrics: {
      totalOrganizers: number;
      totalEvents: number;
      totalAttendees: number;
      totalCheckedIn: number;
      overallCheckInRate: number;
      eventsByStatus: Record<string, number>;
      storageEngine: string;
    };
    recentSignups: any[];
    recentEvents: any[];
  }> {
    return this.request('/api/super-admin/overview');
  }

  public async getSuperAdminUsers(query?: string): Promise<{ users: any[]; total: number }> {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    return this.request(`/api/super-admin/users?${params.toString()}`);
  }

  public async deleteSuperAdminUser(userId: string): Promise<{ success: boolean; message: string; deletedEventsCount: number; deletedAttendeesCount: number }> {
    return this.request(`/api/super-admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  public async getSuperAdminEvents(params?: { query?: string; status?: string; organizerId?: string }): Promise<{ events: any[]; total: number }> {
    const search = new URLSearchParams();
    if (params?.query) search.append('query', params.query);
    if (params?.status) search.append('status', params.status);
    if (params?.organizerId) search.append('organizerId', params.organizerId);
    return this.request(`/api/super-admin/events?${search.toString()}`);
  }

  public async deleteSuperAdminEvent(eventId: string): Promise<{ success: boolean; message: string; deletedAttendeesCount: number }> {
    return this.request(`/api/super-admin/events/${eventId}`, {
      method: 'DELETE',
    });
  }

  public async getSuperAdminRegistrations(params?: { query?: string; eventId?: string; status?: string }): Promise<{ registrations: any[]; total: number }> {
    const search = new URLSearchParams();
    if (params?.query) search.append('query', params.query);
    if (params?.eventId) search.append('eventId', params.eventId);
    if (params?.status) search.append('status', params.status);
    return this.request(`/api/super-admin/registrations?${search.toString()}`);
  }

  public async deleteSuperAdminRegistration(attendeeId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/super-admin/registrations/${attendeeId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
