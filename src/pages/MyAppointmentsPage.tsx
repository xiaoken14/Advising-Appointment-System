import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

export default function MyAppointmentsPage() {
  const { user } = useAuth();

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["student-all-appointments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("student_id", user!.id)
        .order("appointment_date", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">My Appointments</h1>
        <p className="text-muted-foreground mt-1">View all your appointments</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !appointments?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No appointments yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <Card key={apt.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{format(new Date(apt.appointment_date), "EEEE, MMM d, yyyy")}</p>
                  <p className="text-sm text-muted-foreground">{apt.start_time} - {apt.end_time}</p>
                  {apt.reason && <p className="text-sm text-muted-foreground mt-1">{apt.reason}</p>}
                </div>
                <span className={`status-badge status-${apt.status}`}>{apt.status}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
