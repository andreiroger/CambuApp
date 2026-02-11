import { useLocation } from "wouter";
import { Search, Home, Calendar, User, Plus, MessageCircle } from "lucide-react";

const navItems = [
  { path: "/browse", label: "Browse", icon: Search },
  { path: "/host", label: "Host", icon: Home },
  { path: "/chat", label: "Chat", icon: MessageCircle },
  { path: "/create-party", label: "Create", icon: Plus },
  { path: "/attending", label: "Going", icon: Calendar },
  { path: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const [location, setLocation] = useLocation();

  const isActive = (path: string) => {
    if (path === "/browse") return location === "/" || location === "/browse";
    if (path === "/host") return location === "/host";
    return location === path;
  };

  return (
    <nav className="fixed bottom-4 inset-x-4 glass border border-border/30 p-1.5 flex justify-around z-50 rounded-[28px]" data-testid="mobile-nav">
      {navItems.map((item) => {
        const active = isActive(item.path);
        const Icon = item.icon;
        const isCreate = item.path === "/create-party";

        return (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            data-testid={`nav-${item.label.toLowerCase()}`}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-[22px] transition-all duration-200 ${
              isCreate
                ? "bg-primary text-primary-foreground px-4"
                : active
                  ? "bg-foreground/10 dark:bg-foreground/15 text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            <Icon size={20} strokeWidth={active || isCreate ? 2.5 : 2} />
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
