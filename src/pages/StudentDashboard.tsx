import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, Bell, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: appointments } = useQuery({
    queryKey: ["student-upcoming-appointments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("student_id", user!.id)
        .eq("status", "booked")
        .gte("appointment_date", new Date().toISOString().split("T")[0])
        .order("appointment_date", { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: notifications } = useQuery({
    queryKey: ["student-notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">
          Welcome back, {profile?.full_name || "Student"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Here's your advising overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/book")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Calendar className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quick Action</p>
              <p className="font-semibold font-display">Book Appointment</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/walk-in")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-secondary)" }}>
              <Clock className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Quick Action</p>
              <p className="font-semibold font-display">Join Walk-In Queue</p>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate("/notifications")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-warm)" }}>
              <Bell className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Unread</p>
              <p className="font-semibold font-display">{notifications?.length || 0} Notifications</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-display">Upcoming Appointments</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate("/my-appointments")}>
            View All <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {!appointments?.length ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No upcoming appointments</p>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="font-medium text-sm">{format(new Date(apt.appointment_date), "MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">{apt.start_time} - {apt.end_time}</p>
                  </div>
                  <span className="status-badge status-booked">Booked</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
