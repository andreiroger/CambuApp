import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Star, ShieldCheck, Settings, LogOut, Award, UserCheck, Calendar, PartyPopper, Camera, Brain, ArrowRight, Upload, Loader2, Users, UserPlus, UserMinus, X, Check } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Review } from "@shared/schema";

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

export default function ProfilePage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, logout } = useAuth();
  const { toast } = useToast();
  const [reviewTab, setReviewTab] = useState("host");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const idFileInputRef = useRef<HTMLInputElement>(null);
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<any[]>([]);

  const { data: friends = [] } = useQuery<any[]>({
    queryKey: ["/api/friends"],
    enabled: !!user?.id,
  });

  const { data: pendingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/friends/pending"],
    enabled: !!user?.id,
  });

  const { data: outgoingRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/friends/outgoing"],
    enabled: !!user?.id,
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (friendId: string) => {
      await apiRequest("POST", "/api/friends/request", { friendId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/outgoing"] });
      toast({ title: "Friend request sent" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send request", description: error.message, variant: "destructive" });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiRequest("PATCH", `/api/friends/${requestId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/outgoing"] });
      toast({ title: "Friend request accepted" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to accept request", description: error.message, variant: "destructive" });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      await apiRequest("DELETE", `/api/friends/${friendshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/outgoing"] });
      toast({ title: "Friend removed" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to remove friend", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!friendSearchQuery.trim()) {
      setFriendSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(friendSearchQuery)}`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setFriendSearchResults(data);
        }
      } catch {
        setFriendSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [friendSearchQuery]);

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      await apiRequest("PATCH", `/api/users/${user.id}`, { avatar: data.url });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Avatar updated", description: "Your profile photo has been changed." });
    } catch {
      toast({ title: "Upload failed", description: "Could not update avatar. Please try again.", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleVerifyAge(file: File) {
    setVerifying(true);
    setVerificationResult(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const res = await apiRequest("POST", "/api/verify-age", { imageBase64: base64 });
      const data = await res.json();
      setVerificationResult(data.message || "Verification complete");
      toast({ title: "Verification complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      toast({ title: "Verification failed", description: error.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  }

  const { data: reviews = [], isLoading: reviewsLoading } = useQuery<Review[]>({
    queryKey: ["/api/users", user?.id, "reviews"],
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery<{
    partiesAttended: number;
    partiesHosted: number;
    reviewCount: number;
    profileCompleteness: number;
  }>({
    queryKey: ["/api/users", user?.id, "stats"],
    enabled: !!user?.id,
  });

  const hostReviews = reviews.filter((r) => r.type === "host");
  const guestReviews = reviews.filter((r) => r.type === "guest");

  if (isLoading || !user) {
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
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-3">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                data-testid="input-avatar-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
              <button
                type="button"
                className="relative cursor-pointer group"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
                data-testid="button-change-avatar"
              >
                <Avatar className="h-24 w-24" data-testid="img-avatar">
                  <AvatarImage src={user.avatar || undefined} alt={user.fullName} />
                  <AvatarFallback className="text-2xl">{getInitials(user.fullName)}</AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5">
                  {avatarUploading ? (
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </div>
              </button>
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
              {(stats?.profileCompleteness ?? 0) < 100 && (
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Complete your profile to build trust</p>
                  </div>
                </div>
              )}
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
                <span className="font-semibold" data-testid="text-review-count">{reviews.length}</span>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {user.oceanOpenness !== null ? (
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
              {user.oceanLastTaken &&
                (() => {
                  const lastTaken = new Date(user.oceanLastTaken);
                  const ninetyDaysAgo = new Date();
                  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                  return lastTaken < ninetyDaysAgo ? (
                    <Link href="/personality-test">
                      <Button variant="outline" className="w-full" data-testid="button-retake-test">
                        <ArrowRight size={16} className="mr-2" />
                        Retake Test
                      </Button>
                    </Link>
                  ) : null;
                })()}
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="section-personality">
            <CardContent className="p-6">
              <div className="flex flex-col items-center text-center gap-3">
                <Brain size={32} className="text-muted-foreground" />
                <div>
                  <h3 className="font-semibold text-base mb-1">Discover your party personality</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Take the OCEAN personality test to find parties that match your vibe.
                  </p>
                </div>
                <Link href="/personality-test">
                  <Button className="w-full" data-testid="button-take-test">
                    <Brain size={16} className="mr-2" />
                    Take the Test
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <Card data-testid="section-friends">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              <Users size={16} />
              Friends
              <Badge variant="secondary" data-testid="badge-friend-count">{friends.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-4">
            <Input
              placeholder="Search for friends..."
              value={friendSearchQuery}
              onChange={(e) => setFriendSearchQuery(e.target.value)}
              data-testid="input-friend-search"
            />

            {friendSearchResults.length > 0 && (
              <div className="space-y-2">
                {friendSearchResults
                  .filter((u: any) => u.id !== user.id)
                  .map((searchUser: any) => {
                    const isFriend = friends.some((f: any) => f.user.id === searchUser.id);
                    const isPendingOut = outgoingRequests.some((r: any) => r.user.id === searchUser.id);
                    const isPendingIn = pendingRequests.some((r: any) => r.user.id === searchUser.id);
                    const isDisabled = isFriend || isPendingOut || isPendingIn;
                    return (
                      <div key={searchUser.id} className="flex items-center gap-3" data-testid={`search-result-${searchUser.id}`}>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={searchUser.avatar || undefined} alt={searchUser.fullName} />
                          <AvatarFallback className="text-xs">{getInitials(searchUser.fullName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{searchUser.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">@{searchUser.username}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isDisabled || sendRequestMutation.isPending}
                          onClick={() => sendRequestMutation.mutate(searchUser.id)}
                          data-testid={`button-add-friend-${searchUser.id}`}
                        >
                          <UserPlus size={16} />
                        </Button>
                      </div>
                    );
                  })}
                <Separator />
              </div>
            )}

            {pendingRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Friend Requests</p>
                {pendingRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center gap-3" data-testid={`pending-request-${req.id}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={req.user.avatar || undefined} alt={req.user.fullName} />
                      <AvatarFallback className="text-xs">{getInitials(req.user.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.user.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{req.user.username}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => acceptRequestMutation.mutate(req.id)}
                      disabled={acceptRequestMutation.isPending}
                      data-testid={`button-accept-friend-${req.id}`}
                    >
                      <Check size={16} className="text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFriendMutation.mutate(req.id)}
                      disabled={removeFriendMutation.isPending}
                      data-testid={`button-decline-friend-${req.id}`}
                    >
                      <X size={16} className="text-destructive" />
                    </Button>
                  </div>
                ))}
                <Separator />
              </div>
            )}

            {outgoingRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sent Requests</p>
                {outgoingRequests.map((req: any) => (
                  <div key={req.id} className="flex items-center gap-3" data-testid={`outgoing-request-${req.id}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={req.user.avatar || undefined} alt={req.user.fullName} />
                      <AvatarFallback className="text-xs">{getInitials(req.user.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{req.user.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{req.user.username}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFriendMutation.mutate(req.id)}
                      disabled={removeFriendMutation.isPending}
                      data-testid={`button-cancel-request-${req.id}`}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ))}
                <Separator />
              </div>
            )}

            {friends.length > 0 ? (
              <div className="space-y-2">
                {friends.map((friend: any) => (
                  <div key={friend.id} className="flex items-center gap-3" data-testid={`friend-${friend.id}`}>
                    <Link href={`/profile/${friend.user.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={friend.user.avatar || undefined} alt={friend.user.fullName} />
                        <AvatarFallback className="text-xs">{getInitials(friend.user.fullName)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{friend.user.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">@{friend.user.username}</p>
                      </div>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFriendMutation.mutate(friend.id)}
                      disabled={removeFriendMutation.isPending}
                      data-testid={`button-remove-friend-${friend.id}`}
                    >
                      <UserMinus size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Users size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground" data-testid="text-no-friends">No friends yet. Search to add friends!</p>
              </div>
            )}
          </CardContent>
        </Card>

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

        <div className="space-y-2">
          <Button
            className="w-full"
            onClick={() => setLocation("/settings")}
            data-testid="button-edit-profile"
          >
            <Settings size={16} className="mr-2" />
            Edit Profile
          </Button>

          {user.isIdVerified ? (
            <div className="flex items-center justify-center gap-2 p-2">
              <ShieldCheck size={16} className="text-primary" />
              <span className="text-sm font-medium" data-testid="text-id-verified">ID Verified</span>
            </div>
          ) : (
            <>
              <input
                ref={idFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                data-testid="input-id-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVerifyAge(file);
                }}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={() => idFileInputRef.current?.click()}
                disabled={verifying}
                data-testid="button-verify-id"
              >
                {verifying ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Upload size={16} className="mr-2" />
                )}
                {verifying ? "Verifying..." : "Upload ID to Verify"}
              </Button>
              {verificationResult && (
                <p className="text-sm text-muted-foreground text-center" data-testid="text-verification-result">
                  {verificationResult}
                </p>
              )}
            </>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => logout()}
            data-testid="button-logout"
          >
            <LogOut size={16} className="mr-2" />
            Log Out
          </Button>
        </div>
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
