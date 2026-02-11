import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Calendar, Users, MapPin, Check, X, MessageSquare, Gift, ChevronDown, ChevronUp, PartyPopper, Star, ShieldCheck, Brain, History, Ban } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Party } from "@shared/schema";

function formatPartyDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return dateStr;
  }
}

interface RequestUser {
  id: string;
  username: string;
  fullName: string;
  nickname: string;
  avatar: string;
  bio: string;
  isIdVerified: boolean;
  isAgeVerified: boolean;
  hostRating: number;
  guestRating: number;
  oceanOpenness: number | null;
  oceanConscientiousness: number | null;
  oceanExtraversion: number | null;
  oceanAgreeableness: number | null;
  oceanNeuroticism: number | null;
  reviewCount: number;
}

interface ComingWithUser {
  id: string;
  fullName: string;
  username: string;
  avatar: string;
}

interface RequestWithUser {
  id: string;
  partyId: string;
  userId: string;
  message: string;
  pledgedItems: string;
  comingWith: string[] | null;
  comingWithUsers: ComingWithUser[];
  status: string;
  user: RequestUser | null;
}

function PartyRequestsList({ partyId }: { partyId: string }) {
  const { toast } = useToast();

  const { data: requests, isLoading } = useQuery<RequestWithUser[]>({
    queryKey: ["/api/parties", partyId, "requests"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: string }) => {
      await apiRequest("PATCH", `/api/requests/${requestId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties", partyId, "requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties/host/mine"] });
      toast({ title: "Request updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const pendingRequests = requests?.filter((r) => r.status === "pending") ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 pt-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (pendingRequests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground pt-3" data-testid="text-no-pending-requests">
        No pending requests
      </p>
    );
  }

  return (
    <div className="space-y-3 pt-3">
      {pendingRequests.map((req) => (
        <div key={req.id} className="rounded-md border p-3 space-y-2" data-testid={`card-request-${req.id}`}>
          <div className="flex items-start gap-3">
            <Link href={`/profile/${req.user?.id}`}>
              <Avatar className="cursor-pointer">
                <AvatarImage src={req.user?.avatar} />
                <AvatarFallback>{(req.user?.fullName || "?")[0]}</AvatarFallback>
              </Avatar>
            </Link>
            <div className="flex-1 min-w-0 space-y-1">
              <Link href={`/profile/${req.user?.id}`}>
                <div className="cursor-pointer">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm" data-testid={`text-requester-name-${req.id}`}>
                      {req.user?.fullName || "Unknown"}
                    </p>
                    {req.user?.nickname && (
                      <span className="text-xs text-muted-foreground">"{req.user.nickname}"</span>
                    )}
                    {req.user?.isIdVerified && (
                      <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">@{req.user?.username || "unknown"}</p>
                </div>
              </Link>
              {req.user?.bio && (
                <p className="text-xs text-muted-foreground line-clamp-2">{req.user.bio}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {(req.user?.guestRating ?? 0) > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span className="text-xs text-muted-foreground">{req.user!.guestRating.toFixed(1)} guest</span>
                  </div>
                )}
                {(req.user?.reviewCount ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">{req.user!.reviewCount} reviews</span>
                )}
                {req.user?.oceanOpenness !== null && req.user?.oceanOpenness !== undefined && (
                  <Badge variant="secondary" className="text-xs py-0">
                    <Brain className="h-3 w-3 mr-1" />
                    Personality
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => updateStatusMutation.mutate({ requestId: req.id, status: "accepted" })}
                disabled={updateStatusMutation.isPending}
                data-testid={`button-accept-request-${req.id}`}
              >
                <Check className="h-4 w-4 text-green-500" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => updateStatusMutation.mutate({ requestId: req.id, status: "declined" })}
                disabled={updateStatusMutation.isPending}
                data-testid={`button-decline-request-${req.id}`}
              >
                <X className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
          {req.message && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground pl-12">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{req.message}</span>
            </div>
          )}
          {req.pledgedItems && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground pl-12">
              <Gift className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{req.pledgedItems}</span>
            </div>
          )}
          {req.comingWithUsers && req.comingWithUsers.length > 0 && (
            <div className="flex items-start gap-1.5 text-sm text-muted-foreground pl-12">
              <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div className="flex items-center gap-1 flex-wrap">
                <span>Coming with:</span>
                {req.comingWithUsers.map((cwu) => (
                  <Link key={cwu.id} href={`/profile/${cwu.id}`}>
                    <Badge variant="secondary" className="text-xs cursor-pointer gap-1" data-testid={`badge-coming-with-${cwu.id}`}>
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={cwu.avatar || undefined} />
                        <AvatarFallback className="text-[8px]">{cwu.fullName[0]}</AvatarFallback>
                      </Avatar>
                      {cwu.fullName}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function HostedPartyCard({ party, hasUnrated }: { party: Party & { attendeeCount?: number }; hasUnrated?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/parties/${party.id}`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties/host/mine"] });
      toast({ title: "Party cancelled" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to cancel this party? This cannot be undone.")) {
      cancelMutation.mutate();
    }
  };

  const isPast = party.status === "finished";
  const isCancelled = party.status === "cancelled";
  const isDimmed = isPast || isCancelled;

  return (
    <Card className="overflow-visible" data-testid={`card-hosted-party-${party.id}`}>
      <Link href={`/party/${party.id}`}>
        <div className="flex gap-4 p-4 cursor-pointer hover-elevate rounded-t-md">
          <div className="w-24 h-24 rounded-md overflow-hidden shrink-0">
            <img
              src={party.imageUrl || "/images/party-house.png"}
              alt={party.title}
              className={`w-full h-full object-cover ${isDimmed ? "opacity-60" : ""}`}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold leading-tight line-clamp-1" data-testid={`text-party-title-${party.id}`}>
                {party.title}
              </h3>
              {isPast && (
                <Badge variant="outline" className="text-xs" data-testid={`badge-finished-${party.id}`}>Finished</Badge>
              )}
              {isCancelled && (
                <Badge variant="destructive" className="text-xs" data-testid={`badge-cancelled-${party.id}`}>Cancelled</Badge>
              )}
              {party.status === "ongoing" && (
                <Badge variant="default" className="text-xs" data-testid={`badge-ongoing-${party.id}`}>Live</Badge>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatPartyDate(party.date)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{party.locationName}, {party.city}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>{party.attendeeCount ?? 0}/{party.maxGuests} guests</span>
            </div>
          </div>
        </div>
      </Link>
      {(party.status === "upcoming" || party.status === "ongoing") && (
        <div className="px-4 pb-2">
          <Button
            variant="outline"
            className="w-full text-destructive border-destructive/50"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            data-testid={`button-cancel-party-${party.id}`}
          >
            {cancelMutation.isPending ? "Cancelling..." : "Cancel Party"}
          </Button>
        </div>
      )}
      {isPast && hasUnrated && (
        <div className="border-t px-4 py-2">
          <Link href={`/rate/${party.id}`} data-testid={`link-rate-guests-${party.id}`}>
            <Button variant="default" className="w-full gap-2" data-testid={`button-rate-guests-${party.id}`}>
              <Star className="h-4 w-4" />
              Rate Guests
            </Button>
          </Link>
        </div>
      )}
      {!isPast && !isCancelled && (
        <div className="border-t px-4 py-2">
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-toggle-requests-${party.id}`}
          >
            <span className="text-sm">Join Requests</span>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          {expanded && (
            <div className="pb-3">
              <PartyRequestsList partyId={party.id} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function HostPageSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="overflow-visible">
          <div className="flex gap-4 p-4">
            <Skeleton className="w-24 h-24 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

interface PendingRating {
  party: Party;
  role: "host" | "guest";
  usersToRate: { id: string; fullName: string; avatar: string }[];
}

export default function HostPage() {
  const { user } = useAuth();

  const { data: parties, isLoading } = useQuery<(Party & { attendeeCount?: number })[]>({
    queryKey: ["/api/parties/host/mine"],
  });

  const { data: pendingRatings } = useQuery<PendingRating[]>({
    queryKey: ["/api/parties/rate/pending"],
  });

  const unratedPartyIds = new Set(pendingRatings?.filter(p => p.role === "host").map(p => p.party.id) ?? []);

  const activeParties = parties?.filter(p => p.status === "upcoming" || p.status === "ongoing") ?? [];
  const pastParties = parties?.filter(p => p.status === "finished") ?? [];
  const cancelledParties = parties?.filter(p => p.status === "cancelled") ?? [];

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-lg font-bold">My Hosted Parties</h1>
          <Link href="/create-party">
            <Button data-testid="button-create-party">
              <Plus className="h-4 w-4 mr-2" />
              Create Party
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <HostPageSkeleton />
        ) : !parties || parties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="text-empty-state">
            <PartyPopper className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No parties yet</h2>
            <p className="text-muted-foreground mb-6">Create your first party and start hosting!</p>
            <Link href="/create-party">
              <Button data-testid="button-create-party-empty">
                <Plus className="h-4 w-4 mr-2" />
                Create a Party
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {activeParties.length > 0 && (
              <section data-testid="section-active-parties">
                <div className="flex items-center gap-2 mb-3">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">Upcoming & Ongoing</h2>
                  <Badge variant="secondary" className="text-xs">{activeParties.length}</Badge>
                </div>
                <div className="space-y-4">
                  {activeParties.map((party) => (
                    <HostedPartyCard key={party.id} party={party} />
                  ))}
                </div>
              </section>
            )}

            {activeParties.length === 0 && (pastParties.length > 0 || cancelledParties.length > 0) && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-muted-foreground mb-4">No upcoming parties</p>
                <Link href="/create-party">
                  <Button data-testid="button-create-party-no-active">
                    <Plus className="h-4 w-4 mr-2" />
                    Create a Party
                  </Button>
                </Link>
              </div>
            )}

            {pastParties.length > 0 && (
              <section data-testid="section-past-parties">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-muted-foreground">Past Parties</h2>
                  <Badge variant="outline" className="text-xs">{pastParties.length}</Badge>
                </div>
                <div className="space-y-4">
                  {pastParties.map((party) => (
                    <HostedPartyCard key={party.id} party={party} hasUnrated={unratedPartyIds.has(party.id)} />
                  ))}
                </div>
              </section>
            )}

            {cancelledParties.length > 0 && (
              <section data-testid="section-cancelled-parties">
                <div className="flex items-center gap-2 mb-3">
                  <Ban className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-muted-foreground">Cancelled</h2>
                  <Badge variant="outline" className="text-xs">{cancelledParties.length}</Badge>
                </div>
                <div className="space-y-4">
                  {cancelledParties.map((party) => (
                    <HostedPartyCard key={party.id} party={party} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
