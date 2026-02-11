import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Save, LogOut, Navigation } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { COUNTRIES, REGIONS_BY_COUNTRY } from "@/lib/location-data";

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");

  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [searchRadius, setSearchRadius] = useState(50);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setNickname(user.nickname || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setBio(user.bio || "");
      setCountry(user.country || "");
      setCity(user.city || "");
      setAddress(user.address || "");
      setNotifications(user.notificationsEnabled ?? true);
      setDarkMode(user.darkMode ?? false);
      setSearchRadius(user.searchRadius ?? 50);
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/users/${user!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Saved", description: "Your changes have been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-28">
      <div className="max-w-lg mx-auto space-y-4">
        <Button
          variant="ghost"
          onClick={() => setLocation("/profile")}
          data-testid="button-back"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Profile
        </Button>

        <h1 className="text-xl font-semibold" data-testid="text-settings-title">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                data-testid="input-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                data-testid="input-nickname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                data-testid="input-bio"
              />
            </div>
            <Button
              onClick={() =>
                updateMutation.mutate({ fullName, nickname, email, phone, bio })
              }
              disabled={updateMutation.isPending}
              data-testid="button-save-personal"
            >
              <Save size={16} className="mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Personal Info"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={country}
                onValueChange={(val) => {
                  setCountry(val);
                  setRegion("");
                  setCity("");
                }}
              >
                <SelectTrigger data-testid="select-country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value} data-testid={`option-country-${c.value}`}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Region / County</Label>
              <Select value={region} onValueChange={(val) => { setRegion(val); setCity(""); }} disabled={!country}>
                <SelectTrigger data-testid="select-region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {(REGIONS_BY_COUNTRY[country] || []).map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Type your city"
                data-testid="input-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                data-testid="input-address"
              />
            </div>
            {user.latitude && user.longitude && (
              <div className="rounded-md bg-muted p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Current GPS Location</p>
                <p className="text-sm font-mono" data-testid="text-gps-coords">
                  {Number(user.latitude).toFixed(6)}, {Number(user.longitude).toFixed(6)}
                </p>
              </div>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!navigator.geolocation) {
                  toast({ title: "Not supported", description: "Geolocation is not supported by your browser.", variant: "destructive" });
                  return;
                }
                toast({ title: "Detecting location...", description: "Please allow location access when prompted." });
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude } = position.coords;
                    updateMutation.mutate({ latitude, longitude });
                  },
                  (error) => {
                    toast({ title: "Location error", description: error.message || "Could not detect your location.", variant: "destructive" });
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
              disabled={updateMutation.isPending}
              data-testid="button-detect-location"
            >
              <Navigation size={16} className="mr-2" />
              Detect My Location
            </Button>
            <Button
              onClick={() => updateMutation.mutate({ country, city, address })}
              disabled={updateMutation.isPending}
              data-testid="button-save-location"
            >
              <Save size={16} className="mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Location"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive push notifications</p>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={setNotifications}
                data-testid="switch-notifications"
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Dark Mode</Label>
                <p className="text-xs text-muted-foreground">Toggle dark theme</p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => {
                  setTheme(checked ? "dark" : "light");
                  setDarkMode(checked);
                }}
                data-testid="switch-dark-mode"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label>Search Radius</Label>
                <span className="text-sm text-muted-foreground" data-testid="text-search-radius">
                  {searchRadius} km
                </span>
              </div>
              <Slider
                value={[searchRadius]}
                onValueChange={(val) => setSearchRadius(val[0])}
                min={5}
                max={200}
                step={5}
                data-testid="slider-search-radius"
              />
            </div>
            <Button
              onClick={() =>
                updateMutation.mutate({
                  notificationsEnabled: notifications,
                  darkMode,
                  searchRadius,
                })
              }
              disabled={updateMutation.isPending}
              data-testid="button-save-preferences"
            >
              <Save size={16} className="mr-2" />
              {updateMutation.isPending ? "Saving..." : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut size={16} className="mr-2" />
              Log Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
