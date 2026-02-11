import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, ShieldCheck, Award, UserCheck, Calendar, PartyPopper, ArrowLeft, Brain } from "lucide-react";
import type { Review, User } from "@shared/schema";

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < Math.floor(rating) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}
        />
      ))}
      <span className="text-sm text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function PersonalityTraitBar({
  traitName,
  score,
  color,
  testId,
}: {
  traitName: string;
  score: number;
  color: string;
  testId: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground" data-testid={`text-trait-${testId}`}>
          {traitName}
        </span>
        <span className="text-sm font-semibold" data-testid={`text-score-${testId}`}>
          {Math.round(score)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
          data-testid={`bar-${testId}`}
        />
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const [reviewTab, setReviewTab] = useState("host");

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ["/api/users", userId, "reviews"],
    enabled: !!userId,
  });

  const { data: stats } = useQuery<{
    partiesAttended: number;
    partiesHosted: number;
    reviewCount: number;
    profileCompleteness: number;
  }>({
    queryKey: ["/api/users", userId, "stats"],
    enabled: !!userId,
  });

  const hostReviews = reviews.filter((r) => r.type === "host");
  const guestReviews = reviews.filter((r) => r.type === "guest");

  if (userLoading || !user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-28">
      <div className="max-w-lg mx-auto space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          data-testid="button-back"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back
        </Button>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-3">
              <Avatar className="h-24 w-24" data-testid="img-avatar">
                <AvatarImage src={user.avatar || undefined} alt={user.fullName} />
                <AvatarFallback className="text-2xl">{getInitials(user.fullName)}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold" data-testid="text-fullname">{user.fullName}</h1>
                  {user.isIdVerified && (
                    <Badge variant="secondary" className="gap-1" data-testid="badge-verified">
                      <ShieldCheck size={12} />
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-username">@{user.username}</p>
                {user.nickname && (
                  <p className="text-sm text-muted-foreground" data-testid="text-nickname">{user.nickname}</p>
                )}
              </div>
              {user.bio && (
                <p className="text-sm text-muted-foreground max-w-sm" data-testid="text-bio">{user.bio}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-trust-signals">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trust & Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Profile Completeness</span>
                <span className="text-sm font-semibold" data-testid="text-completeness">{stats?.profileCompleteness ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${stats?.profileCompleteness ?? 0}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-muted-foreground shrink-0" />
                <div>
                  <span className="font-semibold" data-testid="text-parties-attended">{stats?.partiesAttended ?? 0}</span>
                  <p className="text-xs text-muted-foreground">Parties Attended</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <PartyPopper size={16} className="text-muted-foreground shrink-0" />
                <div>
                  <span className="font-semibold" data-testid="text-parties-hosted">{stats?.partiesHosted ?? 0}</span>
                  <p className="text-xs text-muted-foreground">Parties Hosted</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Star size={16} className="text-muted-foreground shrink-0" />
                <div>
                  <span className="font-semibold" data-testid="text-review-count">{stats?.reviewCount ?? 0}</span>
                  <p className="text-xs text-muted-foreground">Reviews</p>
                </div>
              </div>
              {user.isIdVerified && (
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">ID Verified</p>
                  </div>
                </div>
              )}
              {user.isAgeVerified && (
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-semibold" data-testid="text-age-verified">Age Verified</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <Star size={16} className="fill-yellow-500 text-yellow-500" />
                  <span className="font-semibold" data-testid="text-host-rating">
                    {(user.hostRating ?? 0).toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Host Rating</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1">
                  <Star size={16} className="fill-yellow-500 text-yellow-500" />
                  <span className="font-semibold" data-testid="text-guest-rating">
                    {(user.guestRating ?? 0).toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Guest Rating</p>
              </div>
              <div className="space-y-1">
                <span className="font-semibold" data-testid="text-total-reviews">{reviews.length}</span>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {user.oceanOpenness !== null && user.oceanOpenness !== undefined && (
          <Card data-testid="section-personality">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Personality Profile</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <PersonalityTraitBar
                traitName="Openness"
                score={user.oceanOpenness ?? 0}
                color="bg-purple-500"
                testId="openness"
              />
              <PersonalityTraitBar
                traitName="Conscientiousness"
                score={user.oceanConscientiousness ?? 0}
                color="bg-blue-500"
                testId="conscientiousness"
              />
              <PersonalityTraitBar
                traitName="Extraversion"
                score={user.oceanExtraversion ?? 0}
                color="bg-amber-400"
                testId="extraversion"
              />
              <PersonalityTraitBar
                traitName="Agreeableness"
                score={user.oceanAgreeableness ?? 0}
                color="bg-green-500"
                testId="agreeableness"
              />
              <PersonalityTraitBar
                traitName="Neuroticism"
                score={user.oceanNeuroticism ?? 0}
                color="bg-orange-500"
                testId="neuroticism"
              />
              {user.oceanLastTaken && (
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground" data-testid="text-ocean-last-taken">
                    Last taken: {new Date(user.oceanLastTaken).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reviews</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <Tabs value={reviewTab} onValueChange={setReviewTab}>
              <TabsList className="w-full" data-testid="tabs-reviews">
                <TabsTrigger value="host" className="flex-1" data-testid="tab-as-host">As Host</TabsTrigger>
                <TabsTrigger value="guest" className="flex-1" data-testid="tab-as-guest">As Guest</TabsTrigger>
              </TabsList>

              <TabsContent value="host" className="mt-3 space-y-3">
                {reviewsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : hostReviews.length === 0 ? (
                  <div className="text-center py-6">
                    <Award size={32} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="text-no-host-reviews">No host reviews yet</p>
                  </div>
                ) : (
                  hostReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="guest" className="mt-3 space-y-3">
                {reviewsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : guestReviews.length === 0 ? (
                  <div className="text-center py-6">
                    <UserCheck size={32} className="mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="text-no-guest-reviews">No guest reviews yet</p>
                  </div>
                ) : (
                  guestReviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <Card data-testid={`card-review-${review.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="text-xs">
              {review.authorId.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <RatingStars rating={review.rating} />
              {review.createdAt && (
                <span className="text-xs text-muted-foreground" data-testid={`text-review-date-${review.id}`}>
                  {new Date(review.createdAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <p className="text-sm" data-testid={`text-review-content-${review.id}`}>{review.content}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
