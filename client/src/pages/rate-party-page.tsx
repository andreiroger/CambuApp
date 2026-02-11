import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Party } from "@shared/schema";

interface UserToRate {
  id: string;
  fullName: string;
  avatar: string;
}

interface PendingRating {
  party: Party;
  role: "host" | "guest";
  usersToRate: UserToRate[];
}

function StarRating({ rating, onRate }: { rating: number; onRate: (r: number) => void }) {
  return (
    <div className="flex items-center gap-1" data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate(star)}
          className="p-1"
          data-testid={`button-star-${star}`}
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              star <= rating
                ? "fill-yellow-500 text-yellow-500"
                : "text-muted-foreground"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function RatePartyPage() {
  const { partyId } = useParams<{ partyId: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [completed, setCompleted] = useState(false);

  const { data: pendingList, isLoading } = useQuery<PendingRating[]>({
    queryKey: ["/api/parties/rate/pending"],
  });

  const pendingForParty = pendingList?.find(p => p.party.id === partyId);
  const usersToRate = pendingForParty?.usersToRate ?? [];
  const currentUser = usersToRate[currentIndex];
  const role = pendingForParty?.role;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !role || !partyId) return;
      const reviewType = role === "host" ? "guest_review" : "host_review";
      await apiRequest("POST", "/api/reviews", {
        targetId: currentUser.id,
        partyId,
        content: comment || "",
        rating,
        type: reviewType,
      });
    },
    onSuccess: () => {
      toast({ title: "Rating submitted" });
      queryClient.invalidateQueries({ queryKey: ["/api/parties/rate/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties/attending/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties/host/mine"] });

      setRating(0);
      setComment("");

      if (currentIndex + 1 < usersToRate.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setCompleted(true);
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-5 w-32" />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <Card className="overflow-visible p-6 space-y-4">
            <Skeleton className="h-16 w-16 rounded-full mx-auto" />
            <Skeleton className="h-5 w-40 mx-auto" />
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-24 w-full" />
          </Card>
        </main>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href={role === "host" ? "/host" : "/attending"}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold">Rating Complete</h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="text-rating-complete">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">All done!</h2>
            <p className="text-muted-foreground mb-6">
              Thanks for rating everyone at {pendingForParty?.party.title}.
            </p>
            <Link href={role === "host" ? "/host" : "/attending"}>
              <Button data-testid="button-go-back">Go Back</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!pendingForParty || !currentUser) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href="/attending">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold">Rate Party</h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="text-no-ratings">
            <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No ratings pending</h2>
            <p className="text-muted-foreground mb-6">You've already rated everyone for this party.</p>
            <Link href="/attending">
              <Button data-testid="button-browse-back">Go Back</Button>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={role === "host" ? "/host" : "/attending"}>
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{pendingForParty.party.title}</h1>
            <p className="text-xs text-muted-foreground">
              {role === "host" ? "Rate your guests" : "Rate the host"} ({currentIndex + 1}/{usersToRate.length})
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Card className="overflow-visible p-6">
          <div className="flex flex-col items-center space-y-5">
            <Avatar className="h-20 w-20">
              <AvatarImage src={currentUser.avatar || undefined} />
              <AvatarFallback className="text-2xl">{currentUser.fullName[0]}</AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h2 className="text-lg font-semibold" data-testid="text-rate-user-name">
                {currentUser.fullName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {role === "host" ? "How was this guest?" : "How was the host?"}
              </p>
            </div>

            <StarRating rating={rating} onRate={setRating} />

            <div className="w-full">
              <Textarea
                placeholder="Leave a comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="resize-none"
                rows={3}
                data-testid="input-review-comment"
              />
            </div>

            <Button
              className="w-full"
              disabled={rating === 0 || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              data-testid="button-submit-rating"
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Rating"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
