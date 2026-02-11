import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, MapPin, Users, PartyPopper, ArrowLeft, History, Ban, Star } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import type { Party } from "@shared/schema";

interface AttendingParty extends Party {
  hostName?: string;
  attendeeCount?: number;
}

function formatPartyDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return dateStr;
  }
}

function AttendingCardSkeleton() {
  return (
    <Card className="overflow-visible">
      <div className="flex gap-4 p-4">
        <Skeleton className="w-24 h-24 rounded-md" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </Card>
  );
}

function AttendingPartyCard({ party, hasUnrated }: { party: AttendingParty; hasUnrated?: boolean }) {
  const isPast = party.status === "finished";
  const isCancelled = party.status === "cancelled";
  const isDimmed = isPast || isCancelled;

  return (
    <Card className="overflow-visible">
      <Link href={`/party/${party.id}`} data-testid={`link-party-${party.id}`}>
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
            {party.theme && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-theme-${party.id}`}>
                {party.theme}
              </Badge>
            )}
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatPartyDate(party.date)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{party.locationName}, {party.city}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{party.attendeeCount ?? 0}/{party.maxGuests}</span>
              </div>
              <span className="text-sm font-medium" data-testid={`text-price-${party.id}`}>
                {(party.price ?? 0) === 0 ? "FREE" : `$${party.price}`}
              </span>
            </div>
            {party.hostName && (
              <p className="text-xs text-muted-foreground">Hosted by {party.hostName}</p>
            )}
          </div>
        </div>
      </Link>
      {isPast && hasUnrated && (
        <div className="border-t px-4 py-2">
          <Link href={`/rate/${party.id}`} data-testid={`link-rate-${party.id}`}>
            <Button variant="default" className="w-full gap-2" data-testid={`button-rate-party-${party.id}`}>
              <Star className="h-4 w-4" />
              Rate Host
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

interface PendingRating {
  party: Party;
  role: "host" | "guest";
  usersToRate: { id: string; fullName: string; avatar: string }[];
}

export default function AttendingPage() {
  const { user } = useAuth();

  const { data: parties, isLoading } = useQuery<AttendingParty[]>({
    queryKey: ["/api/parties/attending/mine"],
  });

  const { data: pendingRatings } = useQuery<PendingRating[]>({
    queryKey: ["/api/parties/rate/pending"],
  });

  const unratedPartyIds = new Set(pendingRatings?.filter(p => p.role === "guest").map(p => p.party.id) ?? []);

  const activeParties = parties?.filter(p => p.status === "upcoming" || p.status === "ongoing") ?? [];
  const pastParties = parties?.filter(p => p.status === "finished") ?? [];
  const cancelledParties = parties?.filter(p => p.status === "cancelled") ?? [];

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/browse">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-bold">Attending</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <AttendingCardSkeleton key={i} />
            ))}
          </div>
        ) : !parties || parties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="text-empty-state">
            <PartyPopper className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No parties yet</h2>
            <p className="text-muted-foreground mb-6">Browse parties and request to join!</p>
            <Link href="/browse">
              <Button data-testid="button-browse-parties">Browse Parties</Button>
            </Link>
          </div>
        ) : (
          <>
            {activeParties.length > 0 && (
              <section data-testid="section-active-attending">
                <div className="flex items-center gap-2 mb-3">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">Upcoming & Ongoing</h2>
                  <Badge variant="secondary" className="text-xs">{activeParties.length}</Badge>
                </div>
                <div className="space-y-4">
                  {activeParties.map((party) => (
                    <AttendingPartyCard key={party.id} party={party} />
                  ))}
                </div>
              </section>
            )}

            {activeParties.length === 0 && (pastParties.length > 0 || cancelledParties.length > 0) && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <p className="text-muted-foreground mb-4">No upcoming parties</p>
                <Link href="/browse">
                  <Button data-testid="button-browse-no-active">Browse Parties</Button>
                </Link>
              </div>
            )}

            {pastParties.length > 0 && (
              <section data-testid="section-past-attending">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-muted-foreground">Past Parties</h2>
                  <Badge variant="outline" className="text-xs">{pastParties.length}</Badge>
                </div>
                <div className="space-y-4">
                  {pastParties.map((party) => (
                    <AttendingPartyCard key={party.id} party={party} hasUnrated={unratedPartyIds.has(party.id)} />
                  ))}
                </div>
              </section>
            )}

            {cancelledParties.length > 0 && (
              <section data-testid="section-cancelled-attending">
                <div className="flex items-center gap-2 mb-3">
                  <Ban className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-muted-foreground">Cancelled</h2>
                  <Badge variant="outline" className="text-xs">{cancelledParties.length}</Badge>
                </div>
                <div className="space-y-4">
                  {cancelledParties.map((party) => (
                    <AttendingPartyCard key={party.id} party={party} />
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
