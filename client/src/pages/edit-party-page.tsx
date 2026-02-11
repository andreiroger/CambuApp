import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Save, Loader2, Upload, Camera, Users, CheckCircle2 } from "lucide-react";
import type { Party } from "@shared/schema";

const THEME_OPTIONS = [
  { value: "house-party", label: "House Party" },
  { value: "outdoor", label: "Outdoor" },
  { value: "pool-party", label: "Pool Party" },
  { value: "rooftop", label: "Rooftop" },
  { value: "club", label: "Club" },
  { value: "beach", label: "Beach" },
  { value: "bbq", label: "BBQ" },
  { value: "themed", label: "Themed" },
  { value: "other", label: "Other" },
];

export default function EditPartyPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [locationName, setLocationName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [maxGuests, setMaxGuests] = useState(0);
  const [price, setPrice] = useState(0);
  const [houseRules, setHouseRules] = useState("");
  const [targetGuests, setTargetGuests] = useState("");
  const [vibe, setVibe] = useState("");
  const [whatToBring, setWhatToBring] = useState<string[]>([]);
  const [includesAlcohol, setIncludesAlcohol] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [selectedCoHosts, setSelectedCoHosts] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: party, isLoading } = useQuery<Party>({
    queryKey: ["/api/parties", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/parties/${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  const { data: friendsList = [] } = useQuery<{ id: string; user: { id: string; username: string; fullName: string; avatar: string | null } }[]>({
    queryKey: ["/api/friends"],
    enabled: !!user,
  });

  useEffect(() => {
    if (party && !initialized) {
      setTitle(party.title || "");
      setTheme(party.theme || "");
      setDescription(party.description || "");
      if (party.date) {
        const d = new Date(party.date);
        if (!isNaN(d.getTime())) {
          const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
          setDate(local.toISOString().slice(0, 16));
        } else {
          setDate(party.date);
        }
      }
      setLocationName(party.locationName || "");
      setCity(party.city || "");
      setCountry(party.country || "");
      setMaxGuests(party.maxGuests || 0);
      setPrice(party.price || 0);
      setHouseRules(party.houseRules || "");
      setTargetGuests(party.targetGuests || "");
      setVibe(party.vibe || "");
      setWhatToBring(party.whatToBring || []);
      setIncludesAlcohol(party.includesAlcohol || false);
      setImageUrl(party.imageUrl || "");
      setSelectedCoHosts(party.coHostIds || []);
      setInitialized(true);
    }
  }, [party, initialized]);

  useEffect(() => {
    if (party && user && party.hostId !== user.id) {
      toast({ title: "Not authorized", description: "You are not the host of this party.", variant: "destructive" });
      setLocation("/browse");
    }
  }, [party, user, setLocation, toast]);

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/upload/party-image", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setImageUrl(data.url);
      toast({ title: "Image uploaded", description: "Party image has been updated." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload image. Please try again.", variant: "destructive" });
    } finally {
      setImageUploading(false);
    }
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/parties/${id}`, {
        title,
        theme,
        description,
        date,
        locationName,
        city,
        country,
        maxGuests,
        price,
        houseRules,
        targetGuests,
        vibe,
        whatToBring,
        includesAlcohol,
        imageUrl,
        coHostIds: selectedCoHosts,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parties", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      toast({ title: "Party updated!", description: "Your changes have been saved." });
      setLocation(`/party/${id}`);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-28">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-md" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
        </main>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground" data-testid="text-not-found">Party not found</p>
      </div>
    );
  }

  if (user && party.hostId !== user.id) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/party/${id}`)}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Edit Party</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  maxLength={100}
                  placeholder="Party title"
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger data-testid="input-theme">
                    <SelectValue placeholder="Select a theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                  maxLength={2000}
                  placeholder="Describe your party"
                  className="min-h-[100px]"
                  data-testid="textarea-description"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date & Time</Label>
                <Input
                  id="date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="input-date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationName">Location Name</Label>
                <Input
                  id="locationName"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g., My Rooftop"
                  data-testid="input-location"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    data-testid="input-city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Country"
                    data-testid="input-country"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxGuests">Max Guests</Label>
                  <Input
                    id="maxGuests"
                    type="number"
                    min={1}
                    value={maxGuests}
                    onChange={(e) => setMaxGuests(parseInt(e.target.value) || 0)}
                    data-testid="input-max-guests"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={1}
                    value={price}
                    onChange={(e) => setPrice(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    data-testid="input-price"
                  />
                  <p className="text-xs text-muted-foreground">0 = free</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="houseRules">House Rules</Label>
                <Textarea
                  id="houseRules"
                  value={houseRules}
                  onChange={(e) => setHouseRules(e.target.value.slice(0, 1000))}
                  maxLength={1000}
                  placeholder="Set your house rules"
                  data-testid="textarea-house-rules"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetGuests">Target Guests</Label>
                <Input
                  id="targetGuests"
                  value={targetGuests}
                  onChange={(e) => setTargetGuests(e.target.value)}
                  placeholder="Who should come?"
                  data-testid="input-target-guests"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vibe">Vibe</Label>
                <Input
                  id="vibe"
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  placeholder="What's the vibe?"
                  data-testid="input-vibe"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="includesAlcohol"
                  checked={includesAlcohol}
                  onCheckedChange={(checked) => setIncludesAlcohol(checked === true)}
                  disabled={!user?.isAgeVerified}
                  data-testid="checkbox-alcohol"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="includesAlcohol" className="cursor-pointer">Includes Alcohol</Label>
                  {!user?.isAgeVerified && (
                    <p className="text-xs text-muted-foreground" data-testid="text-alcohol-age-hint">
                      Age verification required to enable
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {friendsList.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Co-Hosts (max 5)
                  </Label>
                  <span className="text-xs text-muted-foreground">{selectedCoHosts.length}/5 selected</span>
                </div>
                <p className="text-xs text-muted-foreground">Co-hosts can manage requests and moderate chat</p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {friendsList.map((f) => {
                    const isSelected = selectedCoHosts.includes(f.user.id);
                    return (
                      <button
                        key={f.user.id}
                        type="button"
                        className={`flex items-center gap-2 w-full p-2 rounded-md text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30"
                            : "hover-elevate"
                        }`}
                        onClick={() => {
                          setSelectedCoHosts((prev) =>
                            prev.includes(f.user.id)
                              ? prev.filter((id) => id !== f.user.id)
                              : prev.length < 5
                                ? [...prev, f.user.id]
                                : prev
                          );
                        }}
                        disabled={!isSelected && selectedCoHosts.length >= 5}
                        data-testid={`button-select-cohost-${f.user.id}`}
                      >
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={f.user.avatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {f.user.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{f.user.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">@{f.user.username}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-4">
              <Label>Party Image</Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="Party preview"
                  className="w-full h-48 object-cover rounded-md"
                  data-testid="img-party-preview"
                />
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  data-testid="button-upload-image"
                >
                  {imageUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {imageUploading ? "Uploading..." : "Upload Image"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full"
            disabled={updateMutation.isPending}
            data-testid="button-save"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </main>
    </div>
  );
}
