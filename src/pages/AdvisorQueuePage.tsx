import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Play, CheckCircle, Users } from "lucide-react";

export default function AdvisorQueuePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: queueItems, isLoading } = useQuery({
    queryKey: ["advisor-full-queue", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("walk_in_queue")
        .select("*")
        .eq("advisor_id", user!.id)
        .gte("created_at", today)
        .order("queue_number");
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 5000,
  });

  const { data: studentProfiles } = useQuery({
    queryKey: ["queue-student-profiles", queueItems],
    queryFn: async () => {
      const ids = [...new Set(queueItems!.map((q) => q.student_id))];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids);
      const map: Record<string, any> = {};
      data?.forEach((p) => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!queueItems?.length,
  });

  const updateQueue = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "serving" | "done" }) => {
      const { error } = await supabase.from("walk_in_queue").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisor-full-queue"] });
      toast.success("Queue updated!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const waitingCount = queueItems?.filter((q) => q.status === "waiting").length || 0;
  const servingCount = queueItems?.filter((q) => q.status === "serving").length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Walk-In Queue</h1>
        <p className="text-muted-foreground mt-1">Manage today's walk-in students</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-warning">{waitingCount}</p><p className="text-xs text-muted-foreground">Waiting</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-info">{servingCount}</p><p className="text-xs text-muted-foreground">Serving</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-success">{queueItems?.filter((q) => q.status === "done").length || 0}</p><p className="text-xs text-muted-foreground">Done</p></CardContent></Card>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !queueItems?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><Users className="h-8 w-8 mx-auto mb-2 text-muted" />No one in queue today</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {queueItems.map((item) => {
            const student = studentProfiles?.[item.student_id];
            return (
              <Card key={item.id} className={item.status === "serving" ? "border-info/40 bg-info/5" : ""}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      #{item.queue_number}
                    </div>
                    <div>
                      <p className="font-medium">{student?.full_name || "Student"}</p>
                      <p className="text-sm text-muted-foreground">{item.reason || "Walk-in"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-badge status-${item.status}`}>{item.status}</span>
                    {item.status === "waiting" && (
                      <Button size="sm" onClick={() => updateQueue.mutate({ id: item.id, status: "serving" })}>
                        <Play className="h-3 w-3 mr-1" /> Serve
                      </Button>
                    )}
                    {item.status === "serving" && (
                      <Button size="sm" variant="outline" className="text-success" onClick={() => updateQueue.mutate({ id: item.id, status: "done" })}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Done
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
