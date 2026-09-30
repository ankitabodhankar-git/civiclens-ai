export type UserRole = 'citizen' | 'officer' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type IssueCategory =
  | 'Infrastructure'
  | 'Sanitation'
  | 'Transportation'
  | 'Environment'
  | 'Public Safety'
  | 'Public Health'
  | 'Education'
  | 'Other';

export type IssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueUrgency = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueStatus = 'Open' | 'In Progress' | 'Resolved';

export interface CivicPlaybook {
  targetResolutionTime: string;
  leadDepartment: string;
  collaboratingDepartments: string[];
  requiredEquipmentAndResources: string[];
  safetyProtocols: string[];
  mitigationSteps: string[];
  publicTransparencyNotice: string;
  generatedAt: string;
}

export interface CivicIssue {
  issueId: string;
  ownerId: string;
  ownerEmail?: string;
  title: string;
  description: string;
  location: string;
  category: IssueCategory;
  severity: IssueSeverity;
  urgency: IssueUrgency;
  impact: string;
  summary: string;
  recommendedAction: string;
  priorityScore: number; // 1-100
  aiConfidence: number; // 0.0-1.0
  status: IssueStatus;
  createdAt: string; // ISO date string
  updatedAt: string;
  resolvedAt?: string;
  aiAnalyzedAt: string;
  isDemo?: boolean;
  playbook?: CivicPlaybook;
  slaTargetAt?: string;
  slaStatus?: 'On Track' | 'At Risk' | 'Overdue' | 'Resolved';
  relatedIssueIds?: string[];
}

export interface AuditLog {
  logId: string;
  actorId: string;
  actorRole: UserRole;
  actorEmail?: string;
  action: 'STATUS_CHANGE' | 'PLAYBOOK_GENERATED' | 'ROLE_ASSIGNED' | 'ISSUE_CREATED' | 'DEMO_DATA_SEED';
  issueId?: string;
  previousStatus?: IssueStatus;
  newStatus?: IssueStatus;
  timestamp: string;
  notes?: string;
}

export interface HistoricalFilterState {
  startDate: string;
  endDate: string;
  category: string;
  location: string;
  severity: string;
  status: string;
  sortBy: 'priority_desc' | 'priority_asc' | 'date_desc' | 'date_asc';
  quickRange: '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';
}

export interface AggregateStats {
  totalCount: number;
  averagePriority: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  highPriorityCount: number;
  categoryDistribution: Record<string, number>;
  mostCommonCategory: string;
  resolutionRate: number; // percentage
}
