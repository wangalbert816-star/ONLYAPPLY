export type CrmPhase = "onboarding" | "planning" | "essays" | "applications" | "done";
export type CrmEngagementStatus = "active" | "paused" | "completed";
export type CrmTaskLinkType = "profile" | "activities" | "essay" | "report" | "none";
export type CrmMessageRole = "student" | "counselor" | "system" | "admin";
export type CrmMessageChannel = "direct" | "group";

export type CrmCounselor = {
  id: string;
  name: string;
  title: string;
  bio?: string;
  email?: string;
  calendlyUrl?: string;
};

export type CrmEngagement = {
  id: string;
  studentUserId: string;
  studentEmail: string;
  studentName?: string;
  applicationId: string;
  applicationTitle: string;
  counselorId: string;
  phase: CrmPhase;
  status: CrmEngagementStatus;
  planLabel?: string;
  needsFollowUp: boolean;
  internalNotes: string;
  nextMeetingLabel?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmMessage = {
  id: string;
  engagementId: string;
  authorRole: CrmMessageRole;
  authorLabel: string;
  body: string;
  channel: CrmMessageChannel;
  pinned: boolean;
  createdAt: string;
  readByStudent: boolean;
};

export type CrmApplicationDocument = {
  id: string;
  engagementId: string;
  name: string;
  docType: string;
  status: "needed" | "draft" | "submitted" | "done";
  dueAt?: string;
  note?: string;
};

export type CrmFileUploaderRole = "student" | "counselor";

export type CrmStoredFile = {
  id: string;
  engagementId: string;
  name: string;
  category: string;
  uploadedAt: string;
  note?: string;
  storagePath?: string;
  externalUrl?: string;
  taskId?: string;
  uploadedByRole?: CrmFileUploaderRole;
  contentType?: string;
  sizeBytes?: number;
};

export type CrmLibraryLocale = "zh" | "en" | "all";

export type CrmLibraryItemKind = "file" | "link";

export type CrmLibraryItem = {
  id: string;
  title: string;
  description?: string;
  category: string;
  locale: CrmLibraryLocale;
  itemKind: CrmLibraryItemKind;
  fileName: string;
  storagePath?: string;
  externalUrl?: string;
  contentType?: string;
  sizeBytes?: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type CrmTask = {
  id: string;
  engagementId: string;
  title: string;
  description?: string;
  dueAt?: string;
  status: "open" | "done";
  linkType: CrmTaskLinkType;
  attachedFileIds?: string[];
  submittedFileIds?: string[];
  returnedAt?: string;
  returnNote?: string;
  createdAt: string;
  completedAt?: string;
};

export type CrmStoreSnapshot = {
  counselors: CrmCounselor[];
  engagements: CrmEngagement[];
  messages: CrmMessage[];
  tasks: CrmTask[];
  documents: CrmApplicationDocument[];
  files: CrmStoredFile[];
};
