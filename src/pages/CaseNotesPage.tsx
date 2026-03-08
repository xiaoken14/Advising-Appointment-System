import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FileText, Lock } from "lucide-react";

export default function CaseNotesPage() {
  const { user } = useAuth();

  const { data: notes, isLoading } = useQuery({
    queryKey: ["advisor-case-notes", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("case_notes")
        .select("*")
        .eq("advisor_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: studentProfiles } = useQuery({
    queryKey: ["case-notes-students", notes],
    queryFn: async () => {
      const ids = [...new Set(notes!.map((n) => n.student_id))];
      if (!ids.length) return {};
      const { data } = await supabase.from("profiles").select("*").in("user_id", ids);
      const map: Record<string, any> = {};
      data?.forEach((p) => { map[p.user_id] = p; });
      return map;
    },
    enabled: !!notes?.length,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display">Case Notes</h1>
        <p className="text-muted-foreground mt-1">View meeting history and notes</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !notes?.length ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 text-muted" />No case notes yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const student = studentProfiles?.[note.student_id];
            return (
              <Card key={note.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium">{student?.full_name || "Student"}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(note.created_at), "MMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                    {note.is_private && (
                      <Badge variant="outline" className="text-xs gap-1"><Lock className="h-3 w-3" /> Private</Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.notes}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
