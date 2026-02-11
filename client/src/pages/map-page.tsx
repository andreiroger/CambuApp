import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Party, Business } from "@shared/schema";
import { format } from "date-fns";

interface MapData {
  parties: (Party & { locationMasked?: boolean })[];
  businesses: Business[];
}

const DEFAULT_CENTER: [number, number] = [40.7128, -74.0060];

function createPartyMarkerIcon() {
  return L.divIcon({
    html: `
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 5.25 3.07 9.8 7.52 11.98C8.34 33.5 11.87 40 16 40c4.13 0 7.66 6.5 8.48 12.02C28.93 25.8 32 21.25 32 16c0-8.84-7.16-16-16-16z" 
              fill="hsl(var(--primary))" />
        <circle cx="16" cy="14" r="5" fill="white" />
      </svg>
    `,
    className: "party-marker",
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

function createBusinessMarkerIcon() {
  return L.divIcon({
    html: `
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16 0 0 7.16 0 16c0 5.25 3.07 9.8 7.52 11.98C8.34 33.5 11.87 40 16 40c4.13 0 7.66 6.5 8.48 12.02C28.93 25.8 32 21.25 32 16c0-8.84-7.16-16-16-16z" 
              fill="hsl(180, 70%, 50%)" />
        <rect x="10" y="10" width="12" height="12" fill="white" rx="1" />
      </svg>
    `,
    className: "business-marker",
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

function formatPartyDate(dateStr: string) {
  try {
    return format(new Date(dateStr), "MMM d, h:mm a");
  } catch {
    return dateStr;
  }
}

function MapLoadingSkeleton() {
  return (
    <div className="w-full h-[calc(100vh-60px)] flex flex-col">
      <div className="p-3 bg-background border-b flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded" />
        <Skeleton className="h-5 w-32" />
      </div>
      <Skeleton className="flex-1" />
    </div>
  );
}

interface PartyPopupProps {
  party: Party;
  onViewParty: (id: string) => void;
}

function PartyPopupContent({ party, onViewParty }: PartyPopupProps) {
  return (
    <div className="space-y-2 w-64">
      <h3 className="font-semibold text-sm" data-testid={`popup-title-${party.id}`}>
        {party.title}
      </h3>
      <div className="text-xs text-muted-foreground space-y-1">
        <div>
          <span className="font-medium">Theme:</span> {party.theme}
        </div>
        <div>
          <span className="font-medium">When:</span> {formatPartyDate(party.date)}
        </div>
        <div>
          <span className="font-medium">Status:</span> {party.status}
        </div>
        <div>
          <span className="font-medium">Location:</span> {party.city}
        </div>
      </div>
      <Button
        size="sm"
        className="w-full"
        onClick={() => onViewParty(party.id)}
        data-testid={`button-view-party-${party.id}`}
      >
        View Party
      </Button>
    </div>
  );
}

interface BusinessPopupProps {
  business: Business;
}

function BusinessPopupContent({ business }: BusinessPopupProps) {
  return (
    <div className="space-y-1 w-48">
      <h3 className="font-semibold text-sm" data-testid={`popup-business-${business.id}`}>
        {business.name}
      </h3>
      <div className="text-xs text-muted-foreground">
        <div>
          <span className="font-medium">Category:</span> {business.category}
        </div>
        <div>
          <span className="font-medium">Location:</span> {business.city}
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [geolocating, setGeolocating] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeolocating(false);
      setMapReady(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([latitude, longitude]);
        setGeolocating(false);
        setMapReady(true);
      },
      () => {
        setGeolocating(false);
        setMapReady(true);
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  const { data: mapData, isLoading } = useQuery<MapData>({
    queryKey: ["/api/map", center[0], center[1]],
    queryFn: async () => {
      const res = await fetch(
        `/api/map?lat=${center[0]}&lng=${center[1]}&radius=50`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch map data");
      return res.json();
    },
    enabled: mapReady,
  });

  const handleViewParty = (id: string) => {
    setLocation(`/party/${id}`);
  };

  const handleBack = () => {
    setLocation("/browse");
  };

  if (geolocating || !mapReady || isLoading) {
    return <MapLoadingSkeleton />;
  }

  return (
    <div className="w-full h-[calc(100vh-60px)] flex flex-col bg-background relative" data-testid="map-page">
      <div className="p-3 bg-background border-b flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleBack}
          data-testid="button-back-map"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <MapPin className="h-4 w-4" />
          <span>Nearby Parties & Venues</span>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        data-testid="map-container"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {mapData?.parties.map((party) => (
          party.locationMasked !== false ? (
            <Circle
              key={`party-${party.id}`}
              center={[party.latitude, party.longitude]}
              radius={1500}
              pathOptions={{
                color: "hsl(280, 70%, 50%)",
                fillColor: "hsl(280, 70%, 50%)",
                fillOpacity: 0.12,
                weight: 2,
                opacity: 0.4,
              }}
            >
              <Popup data-testid={`popup-party-${party.id}`}>
                <PartyPopupContent party={party} onViewParty={handleViewParty} />
              </Popup>
            </Circle>
          ) : (
            <Marker
              key={`party-${party.id}`}
              position={[party.latitude, party.longitude]}
              icon={createPartyMarkerIcon()}
              data-testid={`marker-party-${party.id}`}
            >
              <Popup data-testid={`popup-party-${party.id}`}>
                <PartyPopupContent party={party} onViewParty={handleViewParty} />
              </Popup>
            </Marker>
          )
        ))}

        {mapData?.businesses.map((business) => (
          <Marker
            key={`business-${business.id}`}
            position={[business.latitude, business.longitude]}
            icon={createBusinessMarkerIcon()}
            data-testid={`marker-business-${business.id}`}
          >
            <Popup data-testid={`popup-business-${business.id}`}>
              <BusinessPopupContent business={business} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[1000] bg-background/90 backdrop-blur-sm rounded-md px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2" style={{ borderColor: "hsl(280, 70%, 50%)", backgroundColor: "hsla(280, 70%, 50%, 0.15)" }} />
          <span>Approximate party area</span>
        </div>
      </div>
    </div>
  );
}
