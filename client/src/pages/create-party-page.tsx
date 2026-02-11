import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Plus, X, PartyPopper, Info, Camera, Upload, CheckCircle2, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { COUNTRIES, REGIONS_BY_COUNTRY } from "@/lib/location-data";

const THEMES = [
  "Cyberpunk/Neon",
  "Cocktail/Lounge",
  "Pool Party",
  "Indie/Bohemian",
  "Festival/EDM",
  "House Party",
  "Dinner Party",
  "Outdoor/BBQ",
  "Game Night",
  "Karaoke",
  "Other",
];

const createPartySchema = z.object({
  title: z.string().min(1, "Title is required"),
  theme: z.string().min(1, "Theme is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  locationName: z.string().min(1, "Location name is required"),
  country: z.string().min(1, "Country is required"),
  region: z.string().optional(),
  city: z.string().min(1, "City is required"),
  exactAddress: z.string().min(1, "Address is required"),
  maxGuests: z.number().min(1, "Must allow at least 1 guest"),
  price: z.number().min(0, "Price cannot be negative"),
  imageUrl: z.string().optional(),
  includesAlcohol: z.boolean(),
  houseRules: z.string().optional(),
  targetGuests: z.string().optional(),
  vibe: z.string().optional(),
});

type CreatePartyForm = z.infer<typeof createPartySchema>;

export default function CreatePartyPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [whatToBring, setWhatToBring] = useState<string[]>([]);
  const [bringItem, setBringItem] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCoHosts, setSelectedCoHosts] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { data: friendsList = [] } = useQuery<{ id: string; user: { id: string; username: string; fullName: string; avatar: string | null } }[]>({
    queryKey: ["/api/friends"],
    enabled: !!user,
  });

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
      form.setValue("imageUrl", data.url);
      setImagePreview(data.url);
      toast({ title: "Image uploaded", description: "Party image has been set." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload image. Please try again.", variant: "destructive" });
    } finally {
      setImageUploading(false);
    }
  }

  const form = useForm<CreatePartyForm>({
    resolver: zodResolver(createPartySchema),
    defaultValues: {
      title: "",
      theme: "",
      description: "",
      date: "",
      time: "",
      locationName: "",
      country: "",
      region: "",
      city: "",
      exactAddress: "",
      maxGuests: 20,
      price: 0,
      imageUrl: "",
      includesAlcohol: false,
      houseRules: "",
      targetGuests: "",
      vibe: "",
    },
  });

  const selectedCountry = form.watch("country");
  const selectedRegion = form.watch("region");

  const createMutation = useMutation({
    mutationFn: async (values: CreatePartyForm) => {
      const dateTime = `${values.date} ${values.time}`;
      const partyDateTime = new Date(`${values.date}T${values.time}`);
      if (partyDateTime < new Date()) {
        throw new Error("Party date and time cannot be in the past");
      }
      
      let latitude = 0;
      let longitude = 0;
      let geocodingFailed = false;
      
      try {
        const addressToGeocode = values.exactAddress && values.exactAddress.trim() 
          ? `${values.exactAddress}, ${values.city}, ${values.country}`
          : `${values.city}, ${values.country}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        try {
          const geoRes = await fetch(
            'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(addressToGeocode),
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            latitude = parseFloat(geoData[0].lat);
            longitude = parseFloat(geoData[0].lon);
          } else {
            geocodingFailed = true;
            toast({ 
              title: "Location coordinates not found", 
              description: "Using default coordinates. You can update the location details in edit mode.", 
              variant: "default" 
            });
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            geocodingFailed = true;
            toast({ 
              title: "Geocoding timed out", 
              description: "Using default coordinates. You can update the location details in edit mode.", 
              variant: "default" 
            });
          } else {
            throw fetchError;
          }
        }
      } catch (error) {
        geocodingFailed = true;
        toast({ 
          title: "Geocoding service error", 
          description: "Using default coordinates. You can update the location details in edit mode.", 
          variant: "default" 
        });
      }
      
      await apiRequest("POST", "/api/parties", {
        hostId: user?.id,
        title: values.title,
        theme: values.theme,
        description: values.description,
        date: dateTime,
        locationName: values.locationName,
        city: values.city,
        country: values.country,
        exactAddress: values.exactAddress || "",
        latitude,
        longitude,
        maxGuests: values.maxGuests,
        price: values.price,
        whatToBring,
        imageUrl: values.imageUrl || "/images/party-neon-techno.png",
        galleryUrls: [],
        includesAlcohol: values.includesAlcohol,
        houseRules: values.houseRules || "",
        targetGuests: values.targetGuests || "",
        vibe: values.vibe || "",
        coHostIds: selectedCoHosts,
      });
    },
    onSuccess: () => {
      toast({ title: "Party created!", description: "Your party has been published." });
      setLocation("/host");
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  function addBringItem() {
    const trimmed = bringItem.trim();
    if (trimmed && !whatToBring.includes(trimmed)) {
      setWhatToBring([...whatToBring, trimmed]);
      setBringItem("");
    }
  }

  function removeBringItem(item: string) {
    setWhatToBring(whatToBring.filter((i) => i !== item));
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/browse">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Create a Party</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => createMutation.mutate(v))} className="space-y-6">
            <Card className="bg-primary/5 border-0" data-testid="card-host-tips">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Tips for hosting a great party:</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                      <li>Be specific about what guests should expect</li>
                      <li>Set clear house rules upfront</li>
                      <li>Respond to requests quickly</li>
                      <li>Welcome your guests warmly</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Basic Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Give your party a catchy name that stands out" {...field} data-testid="input-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Theme</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-theme">
                            <SelectValue placeholder="Select a theme" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {THEMES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Paint a picture of your party. What will guests experience? What makes it special? Include the atmosphere, activities, and any highlights."
                          className="min-h-[100px]"
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vibe & Guidelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="vibe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vibe</FormLabel>
                      <FormControl>
                        <Input placeholder="What's the vibe? e.g., Chill, High-energy, Intimate, Wild..." {...field} data-testid="input-vibe" />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">Help guests know what to expect</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetGuests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Guests</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Who should come? e.g., Music lovers, ages 21-35, people who love dancing..."
                          {...field}
                          data-testid="input-target-guests"
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">Describe your ideal guest to attract the right crowd</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="houseRules"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>House Rules</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., No shoes inside, BYOB, respect the neighbors, clean up after yourself..."
                          {...field}
                          data-testid="input-house-rules"
                        />
                      </FormControl>
                      <p className="text-sm text-muted-foreground">Set clear expectations so everyone has a great time</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Date & Time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} data-testid="input-date" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} data-testid="input-time" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="locationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., My Rooftop, The Warehouse, Beach House" {...field} data-testid="input-location-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue("region", "");
                            form.setValue("city", "");
                          }}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-country">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COUNTRIES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Region / County</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue("city", "");
                          }}
                          value={field.value}
                          disabled={!selectedCountry}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-region">
                              <SelectValue placeholder={selectedCountry ? "Select region" : "Select country first"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(REGIONS_BY_COUNTRY[selectedCountry] || []).map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Type your city" 
                            {...field} 
                            data-testid="input-city" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="exactAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exact Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Street address" {...field} data-testid="input-exact-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxGuests"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Guests</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-max-guests"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            {...field}
                            onChange={(e) => field.onChange(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                            data-testid="input-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>What to Bring</FormLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="e.g. Drinks, Snacks"
                      value={bringItem}
                      onChange={(e) => setBringItem(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addBringItem();
                        }
                      }}
                      data-testid="input-what-to-bring"
                    />
                    <Button type="button" variant="outline" onClick={addBringItem} data-testid="button-add-bring-item">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {whatToBring.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {whatToBring.map((item) => (
                        <Badge key={item} variant="secondary" className="gap-1" data-testid={`badge-bring-${item}`}>
                          {item}
                          <button
                            type="button"
                            onClick={() => removeBringItem(item)}
                            className="ml-1"
                            data-testid={`button-remove-bring-${item}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {friendsList.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <FormLabel className="flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        Co-Hosts (max 5)
                      </FormLabel>
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
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="includesAlcohol"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-2 rounded-md border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="cursor-pointer">Includes Alcohol</FormLabel>
                        {!user?.isAgeVerified && (
                          <p className="text-xs text-muted-foreground" data-testid="text-alcohol-age-hint">
                            Age verification required to enable
                          </p>
                        )}
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={!user?.isAgeVerified}
                          data-testid="switch-includes-alcohol"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Party Image (optional)</FormLabel>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    data-testid="input-party-image-file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                  />
                  {imagePreview || form.getValues("imageUrl") ? (
                    <div className="relative rounded-md overflow-visible">
                      <img
                        src={imagePreview || form.getValues("imageUrl")}
                        alt="Party preview"
                        className="w-full h-48 object-cover rounded-md"
                        data-testid="img-party-preview"
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => imageInputRef.current?.click()}
                          disabled={imageUploading}
                          data-testid="button-change-party-image"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          {imageUploading ? "Uploading..." : "Change Image"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            form.setValue("imageUrl", "");
                            setImagePreview(null);
                          }}
                          data-testid="button-remove-party-image"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-32 border-dashed flex flex-col gap-2"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={imageUploading}
                      data-testid="button-upload-party-image"
                    >
                      {imageUploading ? (
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Upload a photo or take one</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={createMutation.isPending}
              data-testid="button-publish-party"
            >
              {createMutation.isPending ? "Publishing..." : "Publish Party"}
            </Button>
          </form>
        </Form>
      </main>
    </div>
  );
}
