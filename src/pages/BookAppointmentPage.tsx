import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, addMinutes, parse } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BookAppointmentPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAdvisor, setSelectedAdvisor] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSlot, setSelectedSlot] = useState("");
  const [reason, setReason] = useState("");

  // Get all advisors
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

  // Get advisor availability for selected day
  const { data: availability } = useQuery({
    queryKey: ["advisor-availability-for-booking", selectedAdvisor, selectedDate?.getDay()],
    queryFn: async () => {
      const { data } = await supabase
        .from("advisor_availability")
        .select("*")
        .eq("advisor_id", selectedAdvisor)
        .eq("day_of_week", selectedDate!.getDay())
        .eq("is_active", true)
        .single();
      return data;
    },
    enabled: !!selectedAdvisor && !!selectedDate,
  });

  // Get existing appointments for that date to filter out taken slots
  const { data: existingAppts } = useQuery({
    queryKey: ["existing-appointments", selectedAdvisor, selectedDate],
    queryFn: async () => {
      const dateStr = format(selectedDate!, "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("advisor_id", selectedAdvisor)
        .eq("appointment_date", dateStr)
        .neq("status", "cancelled");
      return data || [];
    },
    enabled: !!selectedAdvisor && !!selectedDate,
  });

  const availableSlots = useMemo(() => {
    if (!availability) return [];
    const slots: { start: string; end: string }[] = [];
    const startParts = availability.start_time.split(":");
    const endParts = availability.end_time.split(":");
    let current = new Date(2000, 0, 1, parseInt(startParts[0]), parseInt(startParts[1]));
    const endTime = new Date(2000, 0, 1, parseInt(endParts[0]), parseInt(endParts[1]));
    const duration = availability.slot_duration_minutes;

    while (addMinutes(current, duration) <= endTime) {
      const slotStart = format(current, "HH:mm");
      const slotEnd = format(addMinutes(current, duration), "HH:mm");
      const taken = existingAppts?.some((a) => a.start_time.substring(0, 5) === slotStart);
      if (!taken) {
        slots.push({ start: slotStart, end: slotEnd });
      }
      current = addMinutes(current, duration);
    }
    return slots;
  }, [availability, existingAppts]);

  const bookMutation = useMutation({
    mutationFn: async () => {
      const slot = availableSlots.find((s) => s.start === selectedSlot);
      if (!slot || !selectedDate) throw new Error("Invalid slot");
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      const { error } = await supabase.from("appointments").insert({
        student_id: user!.id,
        advisor_id: selectedAdvisor,
        appointment_date: dateStr,
        start_time: slot.start,
        end_time: slot.end,
        reason,
      });
      if (error) throw error;

      // Create notification for advisor
      await supabase.from("notifications").insert({
        user_id: selectedAdvisor,
        type: "appointment_booked" as const,
        title: "New Appointment Booked",
        message: `A student booked an appointment on ${format(selectedDate, "MMM d")} at ${slot.start}`,
      });
    },
    onSuccess: () => {
      toast.success("Appointment booked!");
      queryClient.invalidateQueries({ queryKey: ["student-upcoming-appointments"] });
      setSelectedSlot("");
      setReason("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-display">Book an Appointment</h1>
        <p className="text-muted-foreground mt-1">Select an advisor, date, and time slot</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>Select Advisor</Label>
            <Select value={selectedAdvisor} onValueChange={(v) => { setSelectedAdvisor(v); setSelectedSlot(""); }}>
              <SelectTrigger><SelectValue placeholder="Choose an advisor" /></SelectTrigger>
              <SelectContent>
                {advisors?.map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.full_name || a.email} {a.department ? `(${a.department})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAdvisor && (
            <div className="space-y-2">
              <Label>Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(d) => { setSelectedDate(d); setSelectedSlot(""); }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {selectedDate && (
            <div className="space-y-2">
              <Label>Available Slots</Label>
              {!availableSlots.length ? (
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">No available slots for this day</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.start}
                      onClick={() => setSelectedSlot(slot.start)}
                      className={`p-2 text-sm rounded-lg border-2 transition-all flex items-center justify-center gap-1 ${
                        selectedSlot === slot.start
                          ? "border-primary bg-primary/5 text-primary font-medium"
                          : "border-border hover:border-primary/40 text-muted-foreground"
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {slot.start}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedSlot && (
            <>
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Briefly describe the reason for your visit" />
              </div>
              <Button className="w-full" onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending}>
                {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
