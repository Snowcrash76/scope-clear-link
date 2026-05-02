import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface CreateProjectLineItem {
  title: string;
  description: string;
  cost: number;
  category: 'included' | 'excluded' | 'assumption';
  imageUrl?: string;
}

export interface CreateProjectData {
  name: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  quoteData: {
    lineItems: CreateProjectLineItem[];
    taxRate: number;
    validUntil: Date | null;
    notes: string;
    terms: string;
  };
}

function generateQuoteNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  return `QT-${timestamp}`;
}

export function useCreateProject() {
  const { user } = useAuth();

  const createProject = async (data: CreateProjectData): Promise<string | null> => {
    if (!user) {
      toast.error('You must be logged in to create a job');
      return null;
    }

    try {
      const subtotal = data.quoteData.lineItems
        .filter(item => item.category === 'included')
        .reduce((sum, item) => sum + (item.cost || 0), 0);
      const taxAmount = subtotal * (data.quoteData.taxRate / 100);
      const total = subtotal + taxAmount;

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          user_id: user.id,
          name: data.name,
          client_name: data.clientName,
          client_email: data.clientEmail,
          ...(data.clientAddress ? { client_address: data.clientAddress } : {}),
          status: 'sent',
          total_value: total,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          project_id: projectData.id,
          quote_number: generateQuoteNumber(),
          status: 'draft',
          subtotal,
          tax_rate: data.quoteData.taxRate,
          tax_amount: taxAmount,
          total,
          valid_until: data.quoteData.validUntil?.toISOString().split('T')[0] || null,
          notes: data.quoteData.notes || null,
          terms: data.quoteData.terms || null,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      const { error: linkError } = await supabase
        .from('projects')
        .update({ active_quote_id: quoteData.id })
        .eq('id', projectData.id);

      if (linkError) throw linkError;

      if (data.quoteData.lineItems.length > 0) {
        const { error: scopeError } = await supabase
          .from('scope_items')
          .insert(
            data.quoteData.lineItems.map(item => ({
              project_id: projectData.id,
              title: item.title,
              description: item.description || '',
              category: item.category,
              cost: item.category === 'included' ? item.cost : null,
              image_url: item.imageUrl || null,
            }))
          );

        if (scopeError) throw scopeError;
      }

      return projectData.id;
    } catch (error) {
      console.error('Error creating project:', error);
      toast.error('Failed to create job');
      return null;
    }
  };

  return { createProject };
}
