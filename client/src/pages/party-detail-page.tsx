import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Calendar, Users, DollarSign, Wine, ShieldCheck, Star, Clock, Send, PartyPopper, CheckCircle2, Info, Loader2, Upload, Trash2, MessageCircle, Sparkles, Pencil, Flag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import type { Party, PartyRequest, User } from "@shared/schema";

interface EnrichedParty extends Party {
  hostName: string;
  hostAvatar: string;
  hostVerified: boolean;
  attendeeCount: number;
  hostRating?: number;
  locationMasked?: boolean;
}

interface ComingWithUserInfo {
  id: string;
  fullName: string;
  avatar: string;
}

interface AttendeeInfo {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  avatar: string;
  comingWithUsers?: ComingWithUserInfo[];
}

function formatPartyDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "EEEE, MMM d, yyyy 'at' h:mm a");
  } catch {
    return dateStr;
  }
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <Skeleton className="w-full h-64" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  );
}

function ReportDialog({ targetType, targetId, onClose }: { targetType: string; targetId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  const reportMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/reports", { targetType, targetId, reason, description });
    },
    onSuccess: () => {
      toast({ title: "Report submitted", description: "Thank you for helping keep CambuApp safe." });
      setOpen(false);
      setReason("");
      setDescription("");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const reasons = targetType === "user"
    ? ["Inappropriate behavior", "Fake profile", "Harassment", "Spam", "Other"]
    : targetType === "party"
      ? ["Inappropriate content", "Suspicious event", "Misleading info", "Safety concern", "Other"]
      : ["Inappropriate content", "Harassment", "Spam", "Other"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`button-report-${targetType}`}>
          <Flag className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report {targetType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger data-testid="select-report-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Additional details (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide more context..."
              className="resize-none"
              data-testid="textarea-report-description"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => reportMutation.mutate()}
            disabled={!reason || reportMutation.isPending}
            data-testid="button-submit-report"
          >
            {reportMutation.isPending ? "Submitting..." : "Submit Report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CoHostsSection({ coHostIds }: { coHostIds: string[] }) {
  const { data: coHostUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/cohosts", ...coHostIds],
    queryFn: async () => {
      const results = await Promise.all(
        coHostIds.map(async (id) => {
          try {
            const res = await fetch(`/api/users/${id}`, { credentials: "include" });
            if (res.ok) return res.json();
            return null;
          } catch {
            return null;
          }
        })
      );
      return results.filter(Boolean);
    },
    enabled: coHostIds.length > 0,
  });

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Co-Hosts
        </h2>
        <div className="space-y-2">
          {coHostUsers.map((coHost: any) => (
            <Link key={coHost.id} href={`/profile/${coHost.id}`}>
              <div className="flex items-center gap-2 cursor-pointer" data-testid={`cohost-${coHost.id}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={coHost.avatar || ""} />
                  <AvatarFallback>{coHost.fullName?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{coHost.fullName}</span>
                <Badge variant="secondary" className="text-xs">Co-Host</Badge>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PartyDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const [message, setMessage] = useState("");
  const [pledgedItems, setPledgedItems] = useState("");
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: party, isLoading: partyLoading } = useQuery<EnrichedParty>({
    queryKey: ["/api/parties", params.id],
  });

  const { data: attendees } = useQuery<AttendeeInfo[]>({
    queryKey: ["/api/parties", params.id, "attendees"],
    enabled: !!params.id,
  });

  const { data: myRequests } = useQuery<PartyRequest[]>({
    queryKey: ["/api/requests/mine"],
    enabled: isAuthenticated,
  });

  const { data: hostStats } = useQuery<{
    partiesAttended: number;
    partiesHosted: number;
    reviewCount: number;
    profileCompleteness: number;
  }>({
    queryKey: ["/api/users", party?.hostId, "stats"],
    enabled: !!party?.hostId,
  });

  const existingRequest = myRequests?.find((r) => r.partyId === params.id);
  const isHost = user?.id === party?.hostId;
  const isCoHost = !!(user?.id && party?.coHostIds?.includes(user.id));

  const { data: friendsList = [] } = useQuery<{ id: string; user: { id: string; username: string; fullName: string; avatar: string; isAgeVerified: boolean } }[]>({
    queryKey: ["/api/friends"],
    enabled: isAuthenticated && !isHost,
  });

  const isAttending = attendees?.some((a) => a.userId === user?.id);

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["/api/parties", params.id, "messages"],
    enabled: !!(isHost || isCoHost || isAttending) && !!params.id,
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/parties/${params.id}`, { status: "cancelled" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties/host/mine"] });
      toast({ title: "Party cancelled" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/parties/${params.id}/requests`, {
        message,
        pledgedItems,
        comingWith: selectedFriends,
      });
    },
    onSuccess: () => {
      toast({ title: "Request sent!", description: "The host will review your request." });
      setMessage("");
      setPledgedItems("");
      setSelectedFriends([]);
      queryClient.invalidateQueries({ queryKey: ["/api/requests/mine"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/parties/${params.id}/messages`, {
        message: chatMessage,
      });
    },
    onSuccess: () => {
      setChatMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/parties", params.id, "messages"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const retractMutation = useMutation({
    mutationFn: async () => {
      if (!existingRequest?.id) throw new Error("No request to retract");
      await apiRequest("DELETE", `/api/requests/${existingRequest.id}`);
    },
    onSuccess: () => {
      toast({ title: "Request retracted", description: "Your request has been withdrawn." });
      queryClient.invalidateQueries({ queryKey: ["/api/requests/mine"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest("DELETE", `/api/messages/${messageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties", params.id, "messages"] });
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleVerifyAge = async (file: File) => {
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
  };

  if (partyLoading) {
    return <DetailSkeleton />;
  }

  if (!party) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <PartyPopper className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Party not found</h2>
        <Button variant="outline" onClick={() => setLocation("/browse")} data-testid="button-back-browse">
          Back to Browse
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="relative h-64 sm:h-80 overflow-hidden">
        <img
          src={party.imageUrl || "/images/party-house.png"}
          alt={party.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLocation("/browse")}
            className="bg-black/30 backdrop-blur border-white/20 text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            {isHost && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setLocation(`/edit-party/${params.id}`)}
                className="bg-black/30 backdrop-blur border-white/20 text-white"
                data-testid="button-edit-party"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {!isHost && party && (
              <ReportDialog targetType="party" targetId={party.id} onClose={() => {}} />
            )}
          </div>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <Badge variant="secondary" className="mb-2" data-testid="badge-party-theme">
            {party.theme}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1" data-testid="text-party-title">
            {party.title}
          </h1>
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <Calendar className="h-4 w-4" />
            <span>{formatPartyDate(party.date)}</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={party.hostAvatar} />
                <AvatarFallback>{party.hostName?.charAt(0)?.toUpperCase() || "H"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold" data-testid="text-host-name">{party.hostName}</span>
                  {party.hostVerified && (
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                  )}
                </div>
                {(party.hostRating ?? 0) > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="h-3.5 w-3.5 text-primary" />
                    <span>{party.hostRating?.toFixed(1)}</span>
                  </div>
                )}
                {hostStats && (
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <Badge variant="secondary" data-testid="badge-host-parties">
                      <PartyPopper className="h-3 w-3 mr-1" />
                      {hostStats.partiesHosted} parties hosted
                    </Badge>
                    <Badge variant="secondary" data-testid="badge-host-reviews">
                      <Star className="h-3 w-3 mr-1" />
                      {hostStats.reviewCount} reviews
                    </Badge>
                    {party.hostVerified && (
                      <Badge variant="secondary" data-testid="badge-host-verified">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate" data-testid="text-location">{party.locationName}, {party.city}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold" data-testid="text-price">
                  {(party.price ?? 0) === 0 ? "FREE" : `$${party.price}`}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span data-testid="text-guests">{party.attendeeCount}/{party.maxGuests} guests</span>
              </div>
              {party.includesAlcohol && (
                <div className="flex items-center gap-2 text-sm">
                  <Wine className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Includes alcohol</span>
                </div>
              )}
            </div>
            {party.locationMasked === false && party.exactAddress && (
              <div className="flex items-center gap-2 text-sm mt-2 pt-2 border-t">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm" data-testid="text-exact-address">{party.exactAddress}</span>
              </div>
            )}
            {party.locationMasked !== false && (
              <p className="text-xs text-muted-foreground mt-2" data-testid="text-location-masked">
                Approximate location (within ~1.5km). Exact address revealed after host approval.
              </p>
            )}
          </CardContent>
        </Card>

        {party.latitude && party.longitude && (
          <Card>
            <CardContent className="p-0 overflow-hidden rounded-md">
              <div style={{ height: "200px", width: "100%" }}>
                <MapContainer
                  center={[party.latitude, party.longitude]}
                  zoom={party.locationMasked !== false ? 12 : 15}
                  style={{ height: "100%", width: "100%" }}
                  scrollWheelZoom={false}
                  dragging={false}
                  zoomControl={false}
                  attributionControl={false}
                  data-testid="map-party-location"
                >
                  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                  {party.locationMasked !== false ? (
                    <Circle
                      center={[party.latitude, party.longitude]}
                      radius={1500}
                      pathOptions={{
                        color: "hsl(280, 70%, 50%)",
                        fillColor: "hsl(280, 70%, 50%)",
                        fillOpacity: 0.15,
                        weight: 2,
                        opacity: 0.4,
                      }}
                    />
                  ) : (
                    <Marker position={[party.latitude, party.longitude]} />
                  )}
                </MapContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {party.description && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">About this party</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-description">
                {party.description}
              </p>
            </CardContent>
          </Card>
        )}

        {party.houseRules && party.houseRules.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">House Rules</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-house-rules">
                {party.houseRules}
              </p>
            </CardContent>
          </Card>
        )}

        {party.vibe && party.vibe.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">Vibe</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-vibe">
                {party.vibe}
              </p>
            </CardContent>
          </Card>
        )}

        {party.targetGuests && party.targetGuests.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">Who Should Come</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-target-guests">
                {party.targetGuests}
              </p>
            </CardContent>
          </Card>
        )}

        {party.coHostIds && party.coHostIds.length > 0 && (
          <CoHostsSection coHostIds={party.coHostIds} />
        )}

        {party.whatToBring && party.whatToBring.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-2">What to bring</h2>
              <div className="flex flex-wrap gap-2">
                {party.whatToBring.map((item, i) => (
                  <Badge key={i} variant="secondary" data-testid={`badge-bring-${i}`}>
                    {item}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isHost && party.status !== "cancelled" && (
          <Card>
            <CardContent className="p-4">
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/50"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                data-testid="button-cancel-party"
              >
                {cancelMutation.isPending ? "Cancelling..." : "Cancel Party"}
              </Button>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && (isHost || isCoHost || isAttending) && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Party Assistant
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={aiLoading}
                  data-testid="button-ai-suggestions"
                  onClick={async () => {
                    setAiLoading(true);
                    setAiSuggestions(null);
                    try {
                      const res = await apiRequest("POST", "/api/ai/party-suggestions", { partyId: params.id });
                      const data = await res.json();
                      setAiSuggestions(data.suggestions);
                    } catch (err: any) {
                      toast({ title: "AI unavailable", description: err.message, variant: "destructive" });
                    } finally {
                      setAiLoading(false);
                    }
                  }}
                >
                  {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  {aiLoading ? "Thinking..." : "Get Suggestions"}
                </Button>
              </div>
              {aiSuggestions && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-ai-suggestions">
                  {aiSuggestions}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {party.galleryUrls && party.galleryUrls.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3">Gallery</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {party.galleryUrls.map((url, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-md">
                    <img
                      src={url}
                      alt={`Gallery ${i + 1}`}
                      className="w-full h-full object-cover"
                      data-testid={`img-gallery-${i}`}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {attendees && attendees.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold mb-3">Attendees ({attendees.length})</h2>
              <div className="space-y-3">
                {attendees.map((attendee) => (
                  <div key={attendee.id} data-testid={`attendee-${attendee.id}`}>
                    <Link href={`/profile/${attendee.userId}`}>
                      <div className="flex items-center gap-2 cursor-pointer">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={attendee.avatar} />
                          <AvatarFallback>{attendee.fullName?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{attendee.fullName}</span>
                      </div>
                    </Link>
                    {attendee.comingWithUsers && attendee.comingWithUsers.length > 0 && (
                      <div className="flex items-center gap-1.5 ml-10 mt-1 flex-wrap">
                        <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">with</span>
                        {attendee.comingWithUsers.map((cwu) => (
                          <Link key={cwu.id} href={`/profile/${cwu.id}`}>
                            <Badge variant="secondary" className="text-xs cursor-pointer gap-1" data-testid={`badge-coming-with-${cwu.id}`}>
                              {cwu.fullName}
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(isHost || isCoHost || isAttending) && (
          <Card data-testid="section-chat">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold">Party Chat</h2>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-3 mb-3">
                {messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No messages yet. Start the conversation!</p>
                )}
                {messages.map((msg: any) => {
                  const isOwn = msg.senderId === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${isOwn ? "flex-row-reverse" : ""}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={msg.sender?.avatar} />
                        <AvatarFallback>{msg.sender?.fullName?.charAt(0)?.toUpperCase() || "?"}</AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 min-w-0 ${isOwn ? "text-right" : ""}`}>
                        <div className={`flex items-center gap-1.5 flex-wrap ${isOwn ? "justify-end" : ""}`}>
                          <span className="text-xs font-medium">{msg.sender?.fullName || msg.sender?.nickname || "Unknown"}</span>
                          <span className="text-xs text-muted-foreground">
                            {msg.createdAt ? format(new Date(msg.createdAt), "h:mm a") : ""}
                          </span>
                          {(isHost || isCoHost) && !isOwn && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteMessageMutation.mutate(msg.id)}
                              data-testid={`button-delete-message-${msg.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className={`text-sm mt-0.5 inline-block rounded-md px-2.5 py-1.5 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type a message..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && chatMessage.trim()) {
                      e.preventDefault();
                      sendMessageMutation.mutate();
                    }
                  }}
                  data-testid="input-chat-message"
                />
                <Button
                  size="icon"
                  onClick={() => sendMessageMutation.mutate()}
                  disabled={!chatMessage.trim() || sendMessageMutation.isPending}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && !isHost && party.includesAlcohol && (
          <Card>
            <CardContent className="p-4">
              {user?.isAgeVerified ? (
                <div className="flex items-center gap-2" data-testid="badge-age-verified">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-500">Age Verified</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground" data-testid="text-verification-required">
                        This party includes alcohol. Age verification (18+) is required to join.
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Upload a clear, well-lit photo of your ID (passport, driver's license, or national ID). Make sure the date of birth is clearly visible.
                      </p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    data-testid="input-id-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVerifyAge(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={verifying}
                    data-testid="button-verify-age"
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {verifying ? "Verifying..." : "Upload ID to Verify Age"}
                  </Button>
                  {verificationResult && (
                    <p className="text-sm text-muted-foreground" data-testid="text-verification-result">
                      {verificationResult}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isAuthenticated && !isHost && !isAttending && !existingRequest && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2 mb-3">
                <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tips for a great experience:</p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                    <li>Arrive on time</li>
                    <li>Bring what you promised</li>
                    <li>Respect the host's space</li>
                    <li>Let the host know if plans change</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isAuthenticated && !isHost && (party.status === "upcoming" || party.status === "ongoing") && (
          <Card>
            <CardContent className="p-4">
              {isAttending ? (
                <div className="flex items-center gap-2 text-center justify-center py-4" data-testid="text-attending">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-green-500">You're Going!</span>
                </div>
              ) : existingRequest ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-center justify-center py-4" data-testid="text-pending">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Request {existingRequest.status === "pending" ? "pending" : existingRequest.status}
                    </span>
                  </div>
                  {existingRequest.status === "pending" && (
                    <Button
                      variant="outline"
                      className="w-full text-destructive border-destructive/50"
                      onClick={() => retractMutation.mutate()}
                      disabled={retractMutation.isPending}
                      data-testid="button-retract-request"
                    >
                      {retractMutation.isPending ? "Retracting..." : "Retract Request"}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <h2 className="font-semibold">Request to Join</h2>
                  <Textarea
                    placeholder="Say hi to the host! Why would you be a great guest?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    data-testid="input-request-message"
                  />
                  <Input
                    placeholder="What will you bring? (optional)"
                    value={pledgedItems}
                    onChange={(e) => setPledgedItems(e.target.value)}
                    data-testid="input-pledged-items"
                  />
                  {friendsList.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium">Bring Friends (max 5)</span>
                        <span className="text-xs text-muted-foreground">{selectedFriends.length}/5 selected</span>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {friendsList.filter((f) => f.user.id !== party.hostId).map((f) => {
                          const isAlcoholBlocked = !!party.includesAlcohol && !f.user.isAgeVerified;
                          const isSelected = selectedFriends.includes(f.user.id);
                          return (
                            <button
                              key={f.user.id}
                              type="button"
                              className={`flex items-center gap-2 w-full p-2 rounded-md text-left transition-colors ${
                                isAlcoholBlocked
                                  ? "opacity-50 cursor-not-allowed"
                                  : isSelected
                                    ? "bg-primary/10 border border-primary/30"
                                    : "hover-elevate"
                              }`}
                              onClick={() => {
                                if (isAlcoholBlocked) return;
                                setSelectedFriends((prev) =>
                                  prev.includes(f.user.id)
                                    ? prev.filter((id) => id !== f.user.id)
                                    : prev.length < 5
                                      ? [...prev, f.user.id]
                                      : prev
                                );
                              }}
                              disabled={isAlcoholBlocked || (!isSelected && selectedFriends.length >= 5)}
                              data-testid={`button-select-friend-${f.user.id}`}
                            >
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={f.user.avatar || undefined} />
                                <AvatarFallback className="text-xs">
                                  {f.user.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{f.user.fullName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {isAlcoholBlocked ? "Not age-verified" : `@${f.user.username}`}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {party.includesAlcohol && !user?.isAgeVerified && (
                    <p className="text-sm text-muted-foreground" data-testid="text-verification-needed">
                      Age verification is required to join this party.
                    </p>
                  )}
                  <Button
                    onClick={() => joinMutation.mutate()}
                    disabled={joinMutation.isPending || (!!party.includesAlcohol && !(user?.isAgeVerified ?? false))}
                    className="w-full"
                    data-testid="button-request-join"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {joinMutation.isPending ? "Sending..." : "Request to Join"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
