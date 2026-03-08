import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Clock, Users } from "lucide-react";

export default function WalkInStudentPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAdvisor, setSelectedAdvisor] = useState("");
  const [reason, setReason] = useState("");

  const { data: advisors } = useQuery({
    queryKey: ["advisors"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "advisor");
      if (!roles?.length) return [];
      const ids = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", ids);
      return profiles || [];
    },
  });

  const { data: myQueue } = useQuery({
    queryKey: ["my-queue-status", user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("walk_in_queue")
        .select("*")
        .eq("student_id", user!.id)
        .gte("created_at", today)
        .in("status", ["waiting", "serving"])
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const joinQueue = useMutation({
    mutationFn: async () => {
      // Get next queue number
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("walk_in_queue")
        .select("queue_number")
        .eq("advisor_id", selectedAdvisor)
        .gte("created_at", today)
        .order("queue_number", { ascending: false })
        .limit(1);
      const nextNumber = (existing?.[0]?.queue_number || 0) + 1;

      const { error } = await supabase.from("walk_in_queue").insert({
        student_id: user!.id,
        advisor_id: selectedAdvisor,
        reason,
        queue_number: nextNumber,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("You've joined the queue!");
      queryClient.invalidateQueries({ queryKey: ["my-queue-status"] });
      setReason("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold font-display">Walk-In Queue</h1>
        <p className="text-muted-foreground mt-1">Join a walk-in queue to see an advisor</p>
      </div>

      {myQueue ? (
        <Card className="border-2 border-primary/20">
          <CardContent className="p-6 text-center space-y-3">
            <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <span className="text-2xl font-bold text-primary-foreground">#{myQueue.queue_number}</span>
            </div>
            <h3 className="text-lg font-semibold font-display">You're in the queue!</h3>
            <span className={`status-badge status-${myQueue.status}`}>{myQueue.status}</span>
            <p className="text-sm text-muted-foreground">
              {myQueue.status === "waiting" ? "Please wait, an advisor will see you shortly." : "The advisor is now seeing you."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label>Select Advisor</Label>
              <Select value={selectedAdvisor} onValueChange={setSelectedAdvisor}>
                <SelectTrigger><SelectValue placeholder="Choose an advisor" /></SelectTrigger>
                <SelectContent>
                  {advisors?.map((a) => (
                    <SelectItem key={a.user_id} value={a.user_id}>
                      {a.full_name || a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason for visit" />
            </div>
            <Button className="w-full" onClick={() => joinQueue.mutate()} disabled={!selectedAdvisor || joinQueue.isPending}>
              <Users className="h-4 w-4 mr-2" /> {joinQueue.isPending ? "Joining..." : "Join Queue"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
