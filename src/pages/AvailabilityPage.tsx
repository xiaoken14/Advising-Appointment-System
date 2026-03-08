import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Clock, Save } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface AvailabilityForm {
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
}

export default function AvailabilityPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: availability, isLoading } = useQuery({
    queryKey: ["advisor-availability", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("advisor_availability")
        .select("*")
        .eq("advisor_id", user!.id)
        .order("day_of_week");
      return data || [];
    },
    enabled: !!user,
  });

  const [forms, setForms] = useState<Record<number, AvailabilityForm>>({});

  const getForm = (day: number): AvailabilityForm => {
    if (forms[day]) return forms[day];
    const existing = availability?.find((a) => a.day_of_week === day);
    return existing
      ? { day_of_week: day, start_time: existing.start_time, end_time: existing.end_time, slot_duration_minutes: existing.slot_duration_minutes, is_active: existing.is_active }
      : { day_of_week: day, start_time: "09:00", end_time: "17:00", slot_duration_minutes: 30, is_active: false };
  };

  const updateForm = (day: number, updates: Partial<AvailabilityForm>) => {
    setForms((prev) => ({ ...prev, [day]: { ...getForm(day), ...updates } }));
  };

  const saveMutation = useMutation({
    mutationFn: async (form: AvailabilityForm) => {
      const existing = availability?.find((a) => a.day_of_week === form.day_of_week);
      if (existing) {
        const { error } = await supabase
          .from("advisor_availability")
          .update({
            start_time: form.start_time,
            end_time: form.end_time,
            slot_duration_minutes: form.slot_duration_minutes,
            is_active: form.is_active,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("advisor_availability").insert({
          advisor_id: user!.id,
          ...form,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advisor-availability"] });
      toast.success("Availability saved!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Manage Availability</h1>
        <p className="text-muted-foreground mt-1">Set your weekly working hours and slot durations</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {DAYS.map((dayName, dayIndex) => {
            const form = getForm(dayIndex);
            return (
              <Card key={dayIndex} className={!form.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {dayName}
                  </CardTitle>
                  <Switch checked={form.is_active} onCheckedChange={(v) => updateForm(dayIndex, { is_active: v })} />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Start Time</Label>
                      <Input type="time" value={form.start_time} onChange={(e) => updateForm(dayIndex, { start_time: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">End Time</Label>
                      <Input type="time" value={form.end_time} onChange={(e) => updateForm(dayIndex, { end_time: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Slot Duration (minutes)</Label>
                    <Input type="number" min={10} max={120} value={form.slot_duration_minutes} onChange={(e) => updateForm(dayIndex, { slot_duration_minutes: parseInt(e.target.value) || 30 })} />
                  </div>
                  <Button size="sm" className="w-full" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                    <Save className="h-3 w-3 mr-1" /> Save
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
