import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Search, SlidersHorizontal, MapPin, Calendar, Users, DollarSign, Wine, Star, ChevronDown, ChevronUp, PartyPopper, Loader2, Map as MapIcon, Bell, Globe } from "lucide-react";
import { COUNTRIES, REGIONS_BY_COUNTRY } from "@/lib/location-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, isAfter, isBefore, endOfWeek, endOfMonth, addMonths, subDays, subWeeks } from "date-fns";
import type { Party } from "@shared/schema";

interface EnrichedParty extends Party {
  hostName: string;
  hostAvatar: string;
  hostVerified: boolean;
  attendeeCount: number;
  attendeeAvatars?: { userId: string; avatar: string; fullName: string }[];
}

interface PartiesResponse {
  parties: EnrichedParty[];
  total: number;
  hasMore: boolean;
}

const THEMES = [
  "All",
  "Cyberpunk/Neon",
  "Cocktail/Lounge",
  "Pool Party",
  "Indie/Bohemian",
  "Festival/EDM",
  "House Party",
  "Dinner Party",
  "Outdoor/BBQ",
  "Game Night",
];

function formatPartyDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return dateStr;
  }
}

function PartyCardSkeleton() {
  return (
    <Card className="overflow-visible">
      <Skeleton className="h-48 w-full rounded-t-md rounded-b-none" />
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function BrowsePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: notifData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000,
  });
  const unreadCount = notifData?.count ?? 0;
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState("newest");
  const [maxPrice, setMaxPrice] = useState([200]);
  const [themeFilter, setThemeFilter] = useState("All");
  const [crowdSize, setCrowdSize] = useState("All");
  const [dateFilter, setDateFilter] = useState("All dates");
  const [freeOnly, setFreeOnly] = useState(false);
  const [browseMode, setBrowseMode] = useState<"upcoming" | "past">("upcoming");
  const [offset, setOffset] = useState(0);
  const [allParties, setAllParties] = useState<EnrichedParty[]>([]);
  const [gpsLat, setGpsLat] = useState<number | null>(user?.latitude ?? null);
  const [gpsLng, setGpsLng] = useState<number | null>(user?.longitude ?? null);
  const [searchRadius, setSearchRadius] = useState([user?.searchRadius ?? 50]);
  const [debouncedRadius, setDebouncedRadius] = useState(user?.searchRadius ?? 50);
  const [locating, setLocating] = useState(false);
  const [locationMode, setLocationMode] = useState<"nearby" | "search">("nearby");
  const [searchCountry, setSearchCountry] = useState("");
  const [searchRegion, setSearchRegion] = useState("");
  const [searchCity, setSearchCity] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRadius(searchRadius[0]);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchRadius]);

  const buildQueryUrl = () => {
    const params = new URLSearchParams();
    if (offset > 0) params.set("offset", String(offset));
    if (browseMode !== "past") {
      if (locationMode === "nearby" && gpsLat !== null && gpsLng !== null) {
        params.set("lat", String(gpsLat));
        params.set("lng", String(gpsLng));
        params.set("radius", String(debouncedRadius));
      } else if (locationMode === "search") {
        if (searchCountry) params.set("country", searchCountry);
        if (searchRegion) params.set("region", searchRegion);
        if (searchCity.trim()) params.set("city", searchCity.trim());
      }
    }
    if (browseMode === "past") {
      params.set("status", "finished");
    }
    const qs = params.toString();
    return `/api/parties${qs ? `?${qs}` : ""}`;
  };

  const { data, isLoading } = useQuery<PartiesResponse>({
    queryKey: ["/api/parties", offset, gpsLat, gpsLng, debouncedRadius, browseMode, locationMode, searchCountry, searchRegion, searchCity],
    queryFn: async () => {
      const res = await fetch(buildQueryUrl(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch parties");
      return res.json();
    },
  });


  const parties = useMemo(() => {
    if (!data?.parties) return allParties;
    if (offset === 0) return data.parties;
    const existingIds = new Set(allParties.map(p => p.id));
    const newParties = data.parties.filter(p => !existingIds.has(p.id));
    return [...allParties, ...newParties];
  }, [data, offset, allParties]);

  const hasMore = data?.hasMore ?? false;

  const handleLoadMore = () => {
    setAllParties(parties);
    setOffset(parties.length);
  };

  const locationMutation = useMutation({
    mutationFn: async ({ lat, lng }: { lat: number; lng: number }) => {
      if (!user) throw new Error("Not authenticated");
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, {
        latitude: lat,
        longitude: lng,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/parties"] });
      toast({ title: "Location updated", description: "Showing parties near you." });
    },
    onError: () => {
      toast({ title: "Failed to update location", variant: "destructive" });
    },
  });

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", description: "Your browser does not support location services.", variant: "destructive" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGpsLat(lat);
        setGpsLng(lng);
        setOffset(0);
        setAllParties([]);
        locationMutation.mutate({ lat, lng });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast({ title: "Location access denied", description: "Please enable location permissions.", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRadiusChange = (value: number[]) => {
    setSearchRadius(value);
  };

  useEffect(() => {
    setOffset(0);
    setAllParties([]);
  }, [debouncedRadius]);

  useEffect(() => {
    setOffset(0);
    setAllParties([]);
  }, [locationMode, searchCountry, searchRegion, searchCity]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortBy !== "newest") count++;
    if (themeFilter !== "All") count++;
    if (maxPrice[0] < 200) count++;
    if (crowdSize !== "All") count++;
    if (dateFilter !== "All dates") count++;
    if (freeOnly) count++;
    return count;
  }, [sortBy, themeFilter, maxPrice, crowdSize, dateFilter, freeOnly]);

  const filteredParties = useMemo(() => {
    if (!parties) return [];
    let result = [...parties];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.theme.toLowerCase().includes(q)
      );
    }

    if (themeFilter !== "All") {
      result = result.filter((p) => p.theme === themeFilter);
    }

    result = result.filter((p) => (p.price ?? 0) <= maxPrice[0]);

    if (freeOnly) {
      result = result.filter((p) => (p.price ?? 0) === 0);
    }

    if (crowdSize === "Intimate (1-15)") {
      result = result.filter((p) => p.maxGuests <= 15);
    } else if (crowdSize === "Medium (16-40)") {
      result = result.filter((p) => p.maxGuests >= 16 && p.maxGuests <= 40);
    } else if (crowdSize === "Large (41+)") {
      result = result.filter((p) => p.maxGuests > 40);
    }

    if (dateFilter !== "All dates") {
      const now = new Date();
      if (browseMode === "upcoming") {
        if (dateFilter === "This week") {
          const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
          result = result.filter((p) => {
            const partyDate = new Date(p.date);
            return isAfter(partyDate, now) && isBefore(partyDate, weekEnd);
          });
        } else if (dateFilter === "This month") {
          const monthEnd = endOfMonth(now);
          result = result.filter((p) => {
            const partyDate = new Date(p.date);
            return isAfter(partyDate, now) && isBefore(partyDate, monthEnd);
          });
        } else if (dateFilter === "Next 3 months") {
          const threeMonthsOut = addMonths(now, 3);
          result = result.filter((p) => {
            const partyDate = new Date(p.date);
            return isAfter(partyDate, now) && isBefore(partyDate, threeMonthsOut);
          });
        }
      } else {
        if (dateFilter === "Last week") {
          const oneWeekAgo = subWeeks(now, 1);
          result = result.filter((p) => {
            const partyDate = new Date(p.date);
            return isAfter(partyDate, oneWeekAgo) && isBefore(partyDate, now);
          });
        } else if (dateFilter === "Last 2 weeks") {
          const twoWeeksAgo = subWeeks(now, 2);
          result = result.filter((p) => {
            const partyDate = new Date(p.date);
            return isAfter(partyDate, twoWeeksAgo) && isBefore(partyDate, now);
          });
        } else if (dateFilter === "Last month") {
          const oneMonthAgo = subDays(now, 30);
          result = result.filter((p) => {
            const partyDate = new Date(p.date);
            return isAfter(partyDate, oneMonthAgo) && isBefore(partyDate, now);
          });
        }
      }
    }

    if (sortBy === "price_low") {
      result.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sortBy === "price_high") {
      result.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (sortBy === "popular") {
      result.sort((a, b) => b.attendeeCount - a.attendeeCount);
    } else if (sortBy === "soonest") {
      if (browseMode === "past") {
        result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } else {
        result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
    } else {
      result.sort((a, b) => new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime());
    }

    return result;
  }, [parties, search, sortBy, maxPrice, themeFilter, crowdSize, dateFilter, freeOnly, browseMode]);

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <PartyPopper className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold" data-testid="text-app-name">CambuApp</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/map")}
                data-testid="button-toggle-map"
              >
                <MapIcon className="h-4 w-4" />
              </Button>
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/notifications")}
                  data-testid="button-notifications"
                >
                  <Bell className="h-4 w-4" />
                </Button>
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] flex items-center justify-center text-[10px] font-medium bg-destructive text-destructive-foreground rounded-full px-1 pointer-events-none" data-testid="badge-unread-count">
                    {unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search parties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/50">
                <Button
                  variant={browseMode === "upcoming" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setBrowseMode("upcoming"); setOffset(0); setAllParties([]); setDateFilter("All dates"); }}
                  data-testid="button-browse-upcoming"
                >
                  Upcoming
                </Button>
                <Button
                  variant={browseMode === "past" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => { setBrowseMode("past"); setOffset(0); setAllParties([]); setDateFilter("All dates"); }}
                  data-testid="button-browse-past"
                >
                  Past
                </Button>
              </div>

              {browseMode !== "past" && (
                <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted/50">
                  <Button
                    variant={locationMode === "nearby" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLocationMode("nearby")}
                    data-testid="button-mode-nearby"
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    Near Me
                  </Button>
                  <Button
                    variant={locationMode === "search" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setLocationMode("search")}
                    data-testid="button-mode-search"
                  >
                    <Globe className="h-4 w-4 mr-1" />
                    Search
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {browseMode !== "past" && locationMode === "nearby" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUseLocation}
                  disabled={locating}
                  data-testid="button-use-location"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MapPin className="h-4 w-4 mr-1" />}
                  {gpsLat !== null ? "Update Location" : "Detect My Location"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersOpen(!filtersOpen)}
                data-testid="button-toggle-filters"
              >
                <SlidersHorizontal className="h-4 w-4 mr-1" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="ml-1.5 h-5 min-w-[20px] flex items-center justify-center text-xs px-1" data-testid="badge-filter-count">
                    {activeFilterCount}
                  </Badge>
                )}
                {filtersOpen ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
              </Button>
            </div>
          </div>

          {browseMode !== "past" && locationMode === "nearby" && (
            <>
              {gpsLat !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Radius: {searchRadius[0]}km</span>
                  <Slider
                    value={searchRadius}
                    onValueChange={handleRadiusChange}
                    min={1}
                    max={100}
                    step={1}
                    className="flex-1"
                    data-testid="slider-radius"
                  />
                </div>
              )}
            </>
          )}

          {filtersOpen && (
            <div className="pb-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {browseMode !== "past" && locationMode === "search" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Country</label>
                    <Select value={searchCountry} onValueChange={(val) => { setSearchCountry(val); setSearchRegion(""); setSearchCity(""); }}>
                      <SelectTrigger data-testid="select-search-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">Region</label>
                    <Select value={searchRegion} onValueChange={(val) => { setSearchRegion(val); setSearchCity(""); }} disabled={!searchCountry}>
                      <SelectTrigger data-testid="select-search-region">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {(REGIONS_BY_COUNTRY[searchCountry] || []).map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm text-muted-foreground">City</label>
                    <Input
                      placeholder="Type city name"
                      value={searchCity}
                      onChange={(e) => setSearchCity(e.target.value)}
                      data-testid="input-search-city"
                    />
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Sort by</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger data-testid="select-sort">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="soonest">Soonest</SelectItem>
                    <SelectItem value="price_low">Price (low to high)</SelectItem>
                    <SelectItem value="price_high">Price (high to low)</SelectItem>
                    <SelectItem value="popular">Most popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Theme</label>
                <Select value={themeFilter} onValueChange={setThemeFilter}>
                  <SelectTrigger data-testid="select-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Max price: ${maxPrice[0]}</label>
                <Slider
                  value={maxPrice}
                  onValueChange={setMaxPrice}
                  max={500}
                  step={5}
                  data-testid="slider-max-price"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Crowd size</label>
                <Select value={crowdSize} onValueChange={setCrowdSize}>
                  <SelectTrigger data-testid="select-crowd-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Intimate (1-15)">Intimate (1-15)</SelectItem>
                    <SelectItem value="Medium (16-40)">Medium (16-40)</SelectItem>
                    <SelectItem value="Large (41+)">Large (41+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground">Date</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger data-testid="select-date-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All dates">All dates</SelectItem>
                    {browseMode === "past" ? (
                      <>
                        <SelectItem value="Last week">Last week</SelectItem>
                        <SelectItem value="Last 2 weeks">Last 2 weeks</SelectItem>
                        <SelectItem value="Last month">Last month</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="This week">This week</SelectItem>
                        <SelectItem value="This month">This month</SelectItem>
                        <SelectItem value="Next 3 months">Next 3 months</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Button
                  variant={freeOnly ? "default" : "outline"}
                  className="w-full toggle-elevate"
                  onClick={() => setFreeOnly(!freeOnly)}
                  data-testid="button-free-only"
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Free only
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {isLoading && offset === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <PartyCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="text-empty-state">
            <PartyPopper className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">{browseMode === "past" ? "No past parties found" : "No parties found in your area"}</h2>
            <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredParties.map((party) => (
                <Link key={party.id} href={`/party/${party.id}`} data-testid={`link-party-${party.id}`}>
                  <Card className="overflow-visible hover-elevate cursor-pointer group">
                    <div className="relative h-48 overflow-hidden rounded-t-md">
                      <img
                        src={party.imageUrl || "/images/party-house.png"}
                        alt={party.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {browseMode === "past" && (
                        <Badge variant="outline" className="absolute top-3 left-3 text-xs bg-background/80 backdrop-blur-sm" data-testid={`badge-past-${party.id}`}>
                          Past
                        </Badge>
                      )}
                      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-theme-${party.id}`}>
                          {party.theme}
                        </Badge>
                        {party.includesAlcohol && (
                          <Wine className="h-4 w-4 text-white/90" />
                        )}
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-2">
                      <h3 className="font-semibold text-base leading-tight line-clamp-1" data-testid={`text-title-${party.id}`}>
                        {party.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{formatPartyDate(party.date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{party.locationName}, {party.city}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        <span className="font-bold text-base" data-testid={`text-price-${party.id}`}>
                          {(party.price ?? 0) === 0 ? "FREE" : `$${party.price}`}
                        </span>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          <span>{party.attendeeCount ?? 0}/{party.maxGuests} guests</span>
                        </div>
                      </div>
                      {party.attendeeAvatars && party.attendeeAvatars.length > 0 && (
                        <div className="flex items-center gap-1 pt-1" data-testid={`avatars-going-${party.id}`}>
                          <div className="flex -space-x-2">
                            {party.attendeeAvatars.slice(0, 5).map((a) => (
                              <Avatar key={a.userId} className="h-6 w-6 border-2 border-background">
                                <AvatarImage src={a.avatar} />
                                <AvatarFallback className="text-[10px]">{(a.fullName || "?")[0]}</AvatarFallback>
                              </Avatar>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground ml-1">
                            {party.attendeeCount > 5
                              ? `+${party.attendeeCount - 5} going`
                              : party.attendeeCount === 1
                                ? "1 going"
                                : `${party.attendeeCount} going`}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
                        <Star className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate">Hosted by {party.hostName || "Unknown Host"}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  data-testid="button-load-more"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
