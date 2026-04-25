import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, Plus, Pencil, Trash2, X, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useAppointments, type Appointment } from '@/hooks/useAppointments';

type FormState = {
  title: string;
  start_time: string;
  end_time: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  start_time: '',
  end_time: '',
  notes: '',
};

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function AppointmentRow({
  appt,
  onEdit,
  onDelete,
  deleting,
}: {
  appt: Appointment;
  onEdit: (a: Appointment) => void;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
      data-testid={`appointment-row-${appt.id}`}
    >
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5 flex-shrink-0 w-20">
        <Clock className="w-3 h-3" />
        <span>{formatTime(appt.start_time)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate">{appt.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
        </p>
        {appt.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 italic truncate">{appt.notes}</p>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onEdit(appt)}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          data-testid={`button-edit-appointment-${appt.id}`}
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={() => onDelete(appt.id)}
          disabled={deleting}
          className="p-1 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
          data-testid={`button-delete-appointment-${appt.id}`}
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

function AppointmentForm({
  initial,
  today,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  today: string;
  onSave: (form: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  function set(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const canSave = form.title.trim() && form.start_time && form.end_time;

  return (
    <div className="px-4 py-3 bg-muted/30 border-t border-border/60 space-y-3" data-testid="appointment-form">
      <div className="space-y-1">
        <Label htmlFor="appt-title" className="text-xs">Title</Label>
        <Input
          id="appt-title"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Site inspection at 12 Oak St"
          className="h-8 text-sm"
          autoFocus
          data-testid="input-appointment-title"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="appt-start" className="text-xs">Start time</Label>
          <Input
            id="appt-start"
            type="time"
            value={form.start_time}
            onChange={e => set('start_time', e.target.value)}
            className="h-8 text-sm"
            data-testid="input-appointment-start-time"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="appt-end" className="text-xs">End time</Label>
          <Input
            id="appt-end"
            type="time"
            value={form.end_time}
            onChange={e => set('end_time', e.target.value)}
            className="h-8 text-sm"
            data-testid="input-appointment-end-time"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="appt-notes" className="text-xs text-muted-foreground">Notes (optional)</Label>
        <Input
          id="appt-notes"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Any extra details..."
          className="h-8 text-sm"
          data-testid="input-appointment-notes"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          data-testid="button-appointment-cancel"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!canSave || saving}
          className={cn(
            'flex items-center gap-1 text-xs px-3 py-1.5 rounded font-medium transition-colors',
            canSave && !saving
              ? 'bg-amber-600 text-white hover:bg-amber-700'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
          data-testid="button-appointment-save"
        >
          <Check className="w-3 h-3" />
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function TodaySchedule() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const { appointments, loading, createAppointment, updateAppointment, deleteAppointment } =
    useAppointments(today);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const editingAppt = editingId ? appointments.find(a => a.id === editingId) : null;
  const editInitial: FormState = editingAppt
    ? {
        title: editingAppt.title,
        start_time: editingAppt.start_time.slice(0, 5),
        end_time: editingAppt.end_time.slice(0, 5),
        notes: editingAppt.notes ?? '',
      }
    : EMPTY_FORM;

  async function handleSave(form: FormState) {
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      date: todayStr,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: form.notes.trim() || null,
    };
    let ok: boolean;
    if (editingId) {
      ok = await updateAppointment(editingId, payload);
    } else {
      ok = await createAppointment(payload);
    }
    setSaving(false);
    if (ok) {
      setShowForm(false);
      setEditingId(null);
    }
  }

  function handleEdit(appt: Appointment) {
    setShowForm(false);
    setEditingId(appt.id);
  }

  function handleCancelForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await deleteAppointment(id);
    setDeleting(null);
  }

  const dateLabel = format(today, 'EEE d MMM');

  return (
    <div className="rounded-xl border border-[#D8C3AD] bg-white overflow-hidden shadow-card flex flex-col" data-testid="today-schedule-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-amber-600" />
          <h2 className="font-heading text-sm font-semibold">Today's Schedule</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
          {!showForm && !editingId && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 transition-colors px-1.5 py-1 rounded hover:bg-amber-50"
              data-testid="button-add-appointment"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="divide-y">
            {[1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="h-3 bg-muted rounded w-16 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded w-2/3" />
                  <div className="h-2.5 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : appointments.length === 0 && !showForm && !editingId ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Calendar className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-xs text-amber-700 hover:text-amber-800 font-medium transition-colors"
              data-testid="button-add-first-appointment"
            >
              + Add one
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {appointments.map(appt =>
              editingId === appt.id ? (
                <div key={appt.id} className="bg-muted/10">
                  <AppointmentForm
                    initial={editInitial}
                    today={todayStr}
                    onSave={handleSave}
                    onCancel={handleCancelForm}
                    saving={saving}
                  />
                </div>
              ) : (
                <AppointmentRow
                  key={appt.id}
                  appt={appt}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  deleting={deleting === appt.id}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Add form at the bottom */}
      {showForm && !editingId && (
        <AppointmentForm
          initial={EMPTY_FORM}
          today={todayStr}
          onSave={handleSave}
          onCancel={handleCancelForm}
          saving={saving}
        />
      )}
    </div>
  );
}
