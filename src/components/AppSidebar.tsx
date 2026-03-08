import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Calendar, ClipboardList, Users, Bell, FileText,
  ArrowRightLeft, LogOut, LayoutDashboard, Clock, UserCircle
} from "lucide-react";

const studentLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/book", icon: Calendar, label: "Book Appointment" },
  { to: "/my-appointments", icon: ClipboardList, label: "My Appointments" },
  { to: "/walk-in", icon: Clock, label: "Walk-In Queue" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
];

const advisorLinks = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/availability", icon: Calendar, label: "My Availability" },
  { to: "/appointments", icon: ClipboardList, label: "Today's Appointments" },
  { to: "/queue", icon: Users, label: "Walk-In Queue" },
  { to: "/case-notes", icon: FileText, label: "Case Notes" },
  { to: "/referrals", icon: ArrowRightLeft, label: "Referrals" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
];

export default function AppSidebar() {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const links = role === "advisor" ? advisorLinks : studentLinks;

  return (
    <aside className="w-64 h-screen bg-card border-r border-border flex flex-col sticky top-0">
      <div className="p-6 border-b border-border">
        <h2 className="text-xl font-bold font-display gradient-text">AdvisorHub</h2>
        <p className="text-xs text-muted-foreground mt-1 capitalize">{role} Portal</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <button
              key={link.to}
              onClick={() => navigate(link.to)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <UserCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.full_name || "User"}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-2" /> Sign Out
        </Button>
      </div>
    </aside>
  );
}
