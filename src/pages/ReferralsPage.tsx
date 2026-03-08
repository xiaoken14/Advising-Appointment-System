import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowRightLeft, Plus, CheckCircle, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ReferralsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [toAdvisorId, setToAdvisorId] = useState("");
  const [reason, setReason] = useState("");

  // Get students (from past appointments)
  const { data: students } = useQuery({
    queryKey: ["advisor-students", user?.id],
    queryFn: async () => {
      const { data: appts } = await supabase
        .from("appointments")
        .select("student_id")
        .eq("advisor_id", user!.id);
      const ids = [...new Set(appts?.map((a) => a.student_id) || [])];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids);
      return data || [];
    },
    enabled: !!user,
  });

  // Get other advisors
  const { data: otherAdvisors } = useQuery({
    queryKey: ["other-advisors", user?.id],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "advisor").neq("user_id", user!.id);
      if (!roles?.length) return [];
      const ids = roles.map((r) => r.user_id);
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: sentReferrals } = useQuery({
    queryKey: ["sent-referrals", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("referrals").select("*").eq("from_advisor_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: receivedReferrals } = useQuery({
    queryKey: ["received-referrals", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("referrals").select("*").eq("to_advisor_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch all relevant profiles
  const { data: allProfiles } = useQuery({
    queryKey: ["referral-profiles", sentReferrals, receivedReferrals],
    queryFn: async () => {
      const ids = new Set<string>();
      sentReferrals?.forEach((r) => { ids.add(r.student_id); ids.add(r.to_advisor_id); });
      receivedReferrals?.forEach((r) => { ids.add(r.student_id); ids.add(r.from_advisor_id); });
      if (!ids.size) return {};
      const { data } = await supabase.from("profiles").select("*").in("user_id", [...ids]);
      const map: Record<string, any> = {};
      data?.forEach((p) => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!(sentReferrals || receivedReferrals),
  });

  const createReferral = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("referrals").insert({
        student_id: studentId,
        from_advisor_id: user!.id,
        to_advisor_id: toAdvisorId,
        reason,
      });
      if (error) throw error;
      // Notify target advisor
      await supabase.from("notifications").insert({
        user_id: toAdvisorId,
        type: "referral_received" as const,
        title: "New Referral Received",
        message: `A student has been referred to you. Reason: ${reason}`,
      });
    },
    onSuccess: () => {
      toast.success("Referral sent!");
      queryClient.invalidateQueries({ queryKey: ["sent-referrals"] });
      setDialogOpen(false);
      setStudentId("");
      setToAdvisorId("");
      setReason("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateReferral = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase.from("referrals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["received-referrals"] });
      toast.success("Referral updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display">Referrals</h1>
          <p className="text-muted-foreground mt-1">Manage student referrals</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Referral</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Create Referral</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Student</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students?.map((s) => (
                      <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || s.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Refer To</Label>
                <Select value={toAdvisorId} onValueChange={setToAdvisorId}>
                  <SelectTrigger><SelectValue placeholder="Select advisor" /></SelectTrigger>
                  <SelectContent>
                    {otherAdvisors?.map((a) => (
                      <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for referral" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createReferral.mutate()} disabled={!studentId || !toAdvisorId || !reason.trim() || createReferral.isPending}>
                {createReferral.isPending ? "Sending..." : "Send Referral"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">Received ({receivedReferrals?.length || 0})</TabsTrigger>
          <TabsTrigger value="sent">Sent ({sentReferrals?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-3 mt-4">
          {!receivedReferrals?.length ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No received referrals</CardContent></Card>
          ) : (
            receivedReferrals.map((ref) => (
              <Card key={ref.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Student: {allProfiles?.[ref.student_id]?.full_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground">From: {allProfiles?.[ref.from_advisor_id]?.full_name || "Unknown"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{ref.reason}</p>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(ref.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-badge ${ref.status === "pending" ? "status-booked" : ref.status === "accepted" ? "status-completed" : "status-cancelled"}`}>
                      {ref.status}
                    </span>
                    {ref.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-success" onClick={() => updateReferral.mutate({ id: ref.id, status: "accepted" })}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateReferral.mutate({ id: ref.id, status: "declined" })}>
                          <XCircle className="h-3 w-3 mr-1" /> Decline
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-3 mt-4">
          {!sentReferrals?.length ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No sent referrals</CardContent></Card>
          ) : (
            sentReferrals.map((ref) => (
              <Card key={ref.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Student: {allProfiles?.[ref.student_id]?.full_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">To: {allProfiles?.[ref.to_advisor_id]?.full_name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground mt-1">{ref.reason}</p>
                    </div>
                    <span className={`status-badge ${ref.status === "pending" ? "status-booked" : ref.status === "accepted" ? "status-completed" : "status-cancelled"}`}>
                      {ref.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
