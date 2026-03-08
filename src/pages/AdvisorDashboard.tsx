import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, Users, FileText, ArrowRightLeft, Bell, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function AdvisorDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const today = new Date().toISOString().split("T")[0];

  const { data: todayAppts } = useQuery({
    queryKey: ["advisor-today-appointments", user?.id],
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

  const { data: queueItems } = useQuery({
    queryKey: ["advisor-queue", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("walk_in_queue")
        .select("*")
        .eq("advisor_id", user!.id)
        .in("status", ["waiting", "serving"])
        .order("queue_number");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pendingReferrals } = useQuery({
    queryKey: ["advisor-pending-referrals", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .eq("to_advisor_id", user!.id)
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: unreadNotifs } = useQuery({
    queryKey: ["advisor-notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return data || [];
    },
    enabled: !!user,
  });

  const stats = [
    { label: "Today's Appointments", value: todayAppts?.length || 0, icon: Calendar, to: "/appointments", gradient: "var(--gradient-primary)" },
    { label: "In Queue", value: queueItems?.length || 0, icon: Users, to: "/queue", gradient: "var(--gradient-secondary)" },
    { label: "Pending Referrals", value: pendingReferrals?.length || 0, icon: ArrowRightLeft, to: "/referrals", gradient: "var(--gradient-warm)" },
    { label: "Notifications", value: unreadNotifs?.length || 0, icon: Bell, to: "/notifications", gradient: "var(--gradient-hero)" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">
          Good {new Date().getHours() < 12 ? "morning" : "afternoon"}, {profile?.full_name || "Advisor"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(stat.to)}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: stat.gradient }}>
                  <stat.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-display">Today's Appointments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/appointments")}>
              View <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {!todayAppts?.length ? (
              <p className="text-muted-foreground text-sm text-center py-4">No appointments today</p>
            ) : (
              <div className="space-y-2">
                {todayAppts.slice(0, 4).map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{apt.start_time} - {apt.end_time}</p>
                      <p className="text-xs text-muted-foreground">{apt.reason || "No reason provided"}</p>
                    </div>
                    <span className={`status-badge status-${apt.status}`}>{apt.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-display">Walk-In Queue</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate("/queue")}>
              View <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {!queueItems?.length ? (
              <p className="text-muted-foreground text-sm text-center py-4">Queue is empty</p>
            ) : (
              <div className="space-y-2">
                {queueItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">#{item.queue_number}</p>
                      <p className="text-xs text-muted-foreground">{item.reason || "Walk-in"}</p>
                    </div>
                    <span className={`status-badge status-${item.status}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
