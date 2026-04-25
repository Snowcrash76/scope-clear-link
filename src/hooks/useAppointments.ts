import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type AppointmentRow = Database['public']['Tables']['appointments']['Row'];
type AppointmentInsert = Database['public']['Tables']['appointments']['Insert'];

export type Appointment = AppointmentRow;

export function useAppointments(date?: Date) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const targetDate = date || new Date();
  const dateStr = format(targetDate, 'yyyy-MM-dd');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchAppointments = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [userId, dateStr]);

  useEffect(() => {
    if (userId) fetchAppointments();
  }, [userId, fetchAppointments]);

  async function createAppointment(data: Omit<AppointmentInsert, 'user_id'>): Promise<boolean> {
    if (!userId) return false;
    try {
      const { error } = await supabase
        .from('appointments')
        .insert({ ...data, user_id: userId });
      if (error) throw error;
      await fetchAppointments();
      toast.success('Appointment added');
      return true;
    } catch (err) {
      console.error('Error creating appointment:', err);
      toast.error('Failed to add appointment');
      return false;
    }
  }

  async function updateAppointment(id: string, data: Partial<AppointmentInsert>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('appointments')
        .update(data)
        .eq('id', id);
      if (error) throw error;
      await fetchAppointments();
      toast.success('Appointment updated');
      return true;
    } catch (err) {
      console.error('Error updating appointment:', err);
      toast.error('Failed to update appointment');
      return false;
    }
  }

  async function deleteAppointment(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);
      if (error) throw error;
      await fetchAppointments();
      toast.success('Appointment removed');
      return true;
    } catch (err) {
      console.error('Error deleting appointment:', err);
      toast.error('Failed to remove appointment');
      return false;
    }
  }

  return {
    appointments,
    loading,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    refetch: fetchAppointments,
  };
}
