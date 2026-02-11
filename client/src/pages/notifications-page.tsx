import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Check, CheckCheck, ArrowLeft, PartyPopper, UserCheck, UserX, MessageSquare, UserPlus, Trash2, X } from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { useRef, useState, useCallback } from "react";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedPartyId: string | null;
  relatedUserId: string | null;
  read: boolean;
  createdAt: string;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "new_request": return <UserPlus className="h-5 w-5 text-primary" />;
    case "request_accepted": return <UserCheck className="h-5 w-5 text-green-500" />;
    case "request_declined": return <UserX className="h-5 w-5 text-red-500" />;
    case "new_message": return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case "party_starting": return <PartyPopper className="h-5 w-5 text-primary" />;
    default: return <Bell className="h-5 w-5 text-muted-foreground" />;
  }
}

function SwipeableNotificationCard({
  notif,
  onDelete,
  onClick,
  isDeleting,
}: {
  notif: Notification;
  onDelete: (id: string) => void;
  onClick: (notif: Notification) => void;
  isDeleting: boolean;
}) {
  const [translateX, setTranslateX] = useState(0);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 10) {
      isSwiping.current = true;
      setTranslateX(Math.min(diff, 120));
    } else if (diff < -10 && translateX > 0) {
      isSwiping.current = true;
      setTranslateX(Math.max(0, translateX + (touchStartX.current - touchCurrentX.current)));
    }
  }, [translateX]);

  const handleTouchEnd = useCallback(() => {
    if (translateX > 80) {
      setTranslateX(120);
    } else {
      setTranslateX(0);
    }
  }, [translateX]);

  const handleCardClick = useCallback(() => {
    if (!isSwiping.current) {
      onClick(notif);
    }
  }, [notif, onClick]);

  return (
    <div className="relative overflow-hidden rounded-md" data-testid={`swipeable-notification-${notif.id}`}>
      <div
        className="absolute inset-0 flex items-center justify-end bg-destructive rounded-md"
        style={{ visibility: translateX > 0 ? "visible" : "hidden" }}
      >
        <button
          className="flex items-center justify-center h-full px-6 text-destructive-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notif.id);
          }}
          data-testid={`button-swipe-delete-${notif.id}`}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div
        style={{
          transform: `translateX(-${translateX}px)`,
          transition: isSwiping.current ? "none" : "transform 0.2s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Card
          className={`overflow-visible cursor-pointer hover-elevate ${!notif.read ? "border-primary/30" : ""} group`}
          onClick={handleCardClick}
          data-testid={`card-notification-${notif.id}`}
        >
          <CardContent className="p-4 flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {getNotificationIcon(notif.type)}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-medium ${!notif.read ? "text-foreground" : "text-muted-foreground"}`} data-testid={`text-notif-title-${notif.id}`}>
                  {notif.title}
                </p>
                {!notif.read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-notif-message-${notif.id}`}>
                {notif.message}
              </p>
              <p className="text-xs text-muted-foreground">
                {(() => {
                  try {
                    return formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true });
                  } catch {
                    return "";
                  }
                })()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 invisible group-hover:visible"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(notif.id);
              }}
              disabled={isDeleting}
              data-testid={`button-delete-notification-${notif.id}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [, navigate] = useLocation();

  const { data: notifications, isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/notifications");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleNotificationClick = (notif: Notification) => {
    if (!notif.read) {
      markReadMutation.mutate(notif.id);
    }
    if (notif.relatedPartyId) {
      navigate(`/party/${notif.relatedPartyId}`);
    }
  };

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/browse")} data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-unread-count">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications && notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => clearAllMutation.mutate()}
                disabled={clearAllMutation.isPending}
                data-testid="button-clear-all"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="overflow-visible">
                <CardContent className="p-4 flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="text-empty-notifications">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No notifications yet</h2>
            <p className="text-muted-foreground">You'll see updates about your parties here</p>
          </div>
        ) : (
          notifications.map((notif) => (
            <SwipeableNotificationCard
              key={notif.id}
              notif={notif}
              onDelete={(id) => deleteNotificationMutation.mutate(id)}
              onClick={handleNotificationClick}
              isDeleting={deleteNotificationMutation.isPending}
            />
          ))
        )}
      </main>
    </div>
  );
}
