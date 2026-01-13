export interface ScopeItem {
  id: string;
  title: string;
  description: string;
  category: 'included' | 'excluded' | 'assumption';
  acknowledged: boolean;
  imageUrl?: string; // Deprecated, use imageUrls
  imageUrls?: string[];
  cost?: number;
}

export interface ChangeRequest {
  id: string;
  type: 'client_request' | 'site_issue' | 'substitution';
  title: string;
  description: string;
  reason?: string;
  costImpact: number;
  timeImpact: number; // days
  status: 'pending' | 'approved' | 'declined';
  createdAt: Date;
  resolvedAt?: Date;
  imageUrl?: string;
}

export interface ProjectStage {
  id: string;
  name: string;
  description: string;
  status: 'upcoming' | 'current' | 'completed';
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientEmail: string;
  tradeName: string;
  tradeBusinessName: string;
  status: 'draft' | 'sent' | 'acknowledged' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  scopeItems: ScopeItem[];
  changeRequests: ChangeRequest[];
  stages: ProjectStage[];
  currentStageIndex: number;
}
