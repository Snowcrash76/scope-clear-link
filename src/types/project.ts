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
  resolutionComment?: string;
}

export interface ProjectStage {
  id: string;
  name: string;
  description: string;
  status: 'upcoming' | 'current' | 'completed';
}

export interface QuoteLineItem {
  id: string;
  quoteId: string;
  title: string;
  description?: string;
  cost: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Quote {
  id: string;
  projectId: string;
  quoteNumber: string;
  status: 'draft' | 'sent' | 'approved' | 'declined' | 'revised';
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  validUntil?: Date;
  notes?: string;
  terms?: string;
  clientComment?: string;
  approvedAt?: Date;
  declinedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  scopeItemId?: string;
  changeRequestId?: string;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  projectId: string;
  quoteId?: string;
  invoiceNumber: string;
  type: 'staged' | 'final';
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  dueDate?: Date;
  paidAt?: Date;
  notes?: string;
  terms?: string;
  lineItems: InvoiceLineItem[];
  createdAt: Date;
  updatedAt: Date;
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
  activeQuoteId?: string;
}
