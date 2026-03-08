import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, XCircle, FileText } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function AdvisorAppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; appointmentId: string; studentId: string }>({ open: false, appointmentId: "", studentId: "" });
  const [noteText, setNoteText] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["advisor-today-appointments-full", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("advisor_id", user!.id)
        .eq("appointment_date", today)
        .order("start_time");
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch student profiles for display
  const { data: studentProfiles } = useQuery({
    queryKey: ["student-profiles-for-appointments", appointments],
    queryFn: async () => {
      const ids = [...new Set(appointments!.map((a) => a.student_id))];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids);
      const map: Record<string, typeof data extends (infer T)[] | null ? T : never> = {};
      data?.forEach((p) => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!appointments?.length,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "completed" | "incomplete" }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisor-today-appointments"] });
      toast.success("Status updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("case_notes").insert({
        appointment_id: noteDialog.appointmentId,
        student_id: noteDialog.studentId,
        advisor_id: user!.id,
        notes: noteText,
        is_private: isPrivate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Case note saved!");
      setNoteDialog({ open: false, appointmentId: "", studentId: "" });
      setNoteText("");
      setIsPrivate(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Today's Appointments</h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !appointments?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No appointments scheduled for today</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const student = studentProfiles?.[apt.student_id];
            return (
              <Card key={apt.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{student?.full_name || "Student"}</p>
                      <p className="text-sm text-muted-foreground">{apt.start_time} - {apt.end_time}</p>
                      {apt.reason && <p className="text-sm text-muted-foreground mt-1">{apt.reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`status-badge status-${apt.status}`}>{apt.status}</span>
                      {apt.status === "booked" && (
                        <>
                          <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10"
                            onClick={() => updateStatus.mutate({ id: apt.id, status: "completed" })}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Complete
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => updateStatus.mutate({ id: apt.id, status: "incomplete" })}>
                            <XCircle className="h-4 w-4 mr-1" /> Incomplete
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost"
                        onClick={() => setNoteDialog({ open: true, appointmentId: apt.id, studentId: apt.student_id })}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={noteDialog.open} onOpenChange={(open) => setNoteDialog((prev) => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Add Case Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Write your case notes here..." rows={5} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
              <Label>Private (student cannot see)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveNote.mutate()} disabled={!noteText.trim() || saveNote.isPending}>
              {saveNote.isPending ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
