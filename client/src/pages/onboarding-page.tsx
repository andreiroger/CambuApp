import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PartyPopper,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Music,
  Users,
  Flame,
  Utensils,
  TreePine,
  Sparkles,
  Navigation,
  Brain,
} from "lucide-react";
import { COUNTRIES, REGIONS_BY_COUNTRY } from "@/lib/location-data";

const personalInfoSchema = z.object({
  nickname: z.string().optional(),
  dob: z.string().optional(),
  phone: z.string().optional(),
  bio: z.string().optional(),
});

const vibeSchema = z.object({
  preferredVibe: z.string().optional(),
  gatheringSizePref: z.string().optional(),
  hostOrGuest: z.string().optional(),
});

const locationSchema = z.object({
  country: z.string().min(1, "Please select a country"),
  region: z.string().min(1, "Please select a region"),
  city: z.string().min(1, "Please enter a city"),
  address: z.string().optional(),
});

type PersonalInfoValues = z.infer<typeof personalInfoSchema>;
type VibeValues = z.infer<typeof vibeSchema>;
type LocationValues = z.infer<typeof locationSchema>;

const VIBE_OPTIONS = [
  { value: "chill", label: "Chill & Intimate", icon: Sparkles },
  { value: "dance", label: "Dance & Energy", icon: Flame },
  { value: "food", label: "Food & Drinks", icon: Utensils },
  { value: "music", label: "Music & Live", icon: Music },
  { value: "outdoor", label: "Outdoor & Adventure", icon: TreePine },
  { value: "mix", label: "Mix of Everything", icon: Users },
];

const SIZE_OPTIONS = [
  { value: "small", label: "Small", subtitle: "1-15 people" },
  { value: "medium", label: "Medium", subtitle: "16-40 people" },
  { value: "large", label: "Large", subtitle: "41+ people" },
];

const ROLE_OPTIONS = [
  { value: "host", label: "Host", subtitle: "I love organizing events" },
  { value: "guest", label: "Guest", subtitle: "I love attending events" },
  { value: "both", label: "Both", subtitle: "I do both!" },
];

const OCEAN_QUESTIONS = [
  {
    trait: "openness" as const,
    label: "Openness",
    description: "Creativity, curiosity, and openness to new experiences",
    questions: [
      "I enjoy trying new and unfamiliar experiences",
      "I am curious about many different things",
      "I appreciate art, music, and creative expression",
    ],
  },
  {
    trait: "conscientiousness" as const,
    label: "Conscientiousness",
    description: "Organization, dependability, and self-discipline",
    questions: [
      "I like to keep things organized and tidy",
      "I make plans and stick to them",
      "I pay attention to details in my work",
    ],
  },
  {
    trait: "extraversion" as const,
    label: "Extraversion",
    description: "Sociability, assertiveness, and positive emotions",
    questions: [
      "I feel energized when I'm around other people",
      "I enjoy being the center of attention at social events",
      "I find it easy to start conversations with strangers",
    ],
  },
  {
    trait: "agreeableness" as const,
    label: "Agreeableness",
    description: "Cooperation, trust, and consideration for others",
    questions: [
      "I try to be kind and considerate to everyone",
      "I prefer cooperation over competition",
      "I find it important to help others when I can",
    ],
  },
  {
    trait: "neuroticism" as const,
    label: "Neuroticism",
    description: "Emotional sensitivity and tendency to experience stress",
    questions: [
      "I tend to worry about things that might go wrong",
      "My mood can change quickly",
      "I sometimes feel overwhelmed by my emotions",
    ],
  },
];

const LIKERT_OPTIONS = [
  { value: 0, label: "Strongly Disagree" },
  { value: 25, label: "Disagree" },
  { value: 50, label: "Neutral" },
  { value: 75, label: "Agree" },
  { value: 100, label: "Strongly Agree" },
];

interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export default function OnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [oceanAnswers, setOceanAnswers] = useState<Record<string, number | null>>({});
  const [currentTraitIndex, setCurrentTraitIndex] = useState(0);

  const personalForm = useForm<PersonalInfoValues>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: { nickname: "", dob: "", phone: "", bio: "" },
  });

  const vibeForm = useForm<VibeValues>({
    resolver: zodResolver(vibeSchema),
    defaultValues: { preferredVibe: "", gatheringSizePref: "", hostOrGuest: "" },
  });

  const locationForm = useForm<LocationValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { country: "", region: "", city: "", address: "" },
  });

  const selectedCountry = locationForm.watch("country");
  const selectedRegion = locationForm.watch("region");

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (!user) throw new Error("Not authenticated");
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const personalityMutation = useMutation({
    mutationFn: async (testScores: OceanScores) => {
      const res = await apiRequest("POST", "/api/personality/test", testScores);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Personality test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleStep1Next = async (values: PersonalInfoValues) => {
    await updateMutation.mutateAsync({
      nickname: values.nickname || undefined,
      dob: values.dob || undefined,
      phone: values.phone || undefined,
      bio: values.bio || undefined,
    });
    setCurrentStep(2);
  };

  const handleStep2Next = async (values: VibeValues) => {
    await updateMutation.mutateAsync({
      preferredVibe: values.preferredVibe || undefined,
      gatheringSizePref: values.gatheringSizePref || undefined,
      hostOrGuest: values.hostOrGuest || undefined,
    });
    setCurrentStep(3);
  };

  const handleOceanAnswer = (questionKey: string, value: number) => {
    setOceanAnswers((prev) => ({ ...prev, [questionKey]: value }));
  };

  const computeOceanScores = (): OceanScores => {
    const scores: OceanScores = { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 };
    for (const group of OCEAN_QUESTIONS) {
      const vals = group.questions.map((_, qi) => oceanAnswers[`${group.trait}-${qi}`]);
      const answered = vals.filter((v): v is number => v !== null && v !== undefined);
      if (answered.length > 0) {
        scores[group.trait] = Math.round(answered.reduce((a, b) => a + b, 0) / answered.length);
      }
    }
    return scores;
  };

  const currentTraitGroup = OCEAN_QUESTIONS[currentTraitIndex];
  const currentTraitAllAnswered = currentTraitGroup?.questions.every(
    (_, qi) => oceanAnswers[`${currentTraitGroup.trait}-${qi}`] !== undefined && oceanAnswers[`${currentTraitGroup.trait}-${qi}`] !== null
  );
  const totalQuestionsAnswered = Object.values(oceanAnswers).filter((v) => v !== null && v !== undefined).length;

  const handleStep3Next = async () => {
    if (currentTraitIndex < OCEAN_QUESTIONS.length - 1) {
      setCurrentTraitIndex(currentTraitIndex + 1);
    } else {
      const scores = computeOceanScores();
      await personalityMutation.mutateAsync(scores);
      setCurrentStep(4);
    }
  };

  const handleStep3Skip = () => {
    setCurrentStep(4);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", description: "Your browser does not support GPS detection.", variant: "destructive" });
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await updateMutation.mutateAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          toast({ title: "Location detected", description: "Your GPS coordinates have been saved." });
        } catch {
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        setDetectingLocation(false);
        toast({ title: "Location detection failed", description: error.message, variant: "destructive" });
      },
    );
  };

  const handleStep4Next = async (values: LocationValues) => {
    await updateMutation.mutateAsync({
      country: values.country,
      city: values.city,
      address: values.address || undefined,
      onboardingComplete: true,
    });
    toast({ title: "Welcome to CambuApp!", description: "Your profile is all set. Start exploring parties!" });
    setLocation("/");
  };

  const handleSkip = () => {
    toast({ title: "Welcome to CambuApp!", description: "You can update your profile anytime." });
    setLocation("/");
  };

  const steps = [
    { number: 1, label: "Personal" },
    { number: 2, label: "Your Vibe" },
    { number: 3, label: "Personality" },
    { number: 4, label: "Location" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div
        className="relative overflow-hidden py-10 px-4 flex flex-col items-center"
        style={{
          background: "linear-gradient(135deg, hsl(280 85% 15%) 0%, hsl(280 85% 8%) 50%, hsl(300 60% 10%) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: "radial-gradient(circle at 30% 50%, hsl(280 85% 55% / 0.4) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <PartyPopper className="w-7 h-7 text-primary-foreground" />
            <h1 className="text-2xl font-bold text-primary-foreground" data-testid="text-onboarding-title">
              Set Up Your Profile
            </h1>
          </div>
          <p className="text-primary-foreground/70 text-sm" data-testid="text-onboarding-subtitle">
            Step {currentStep} of 4
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 px-4 -mt-4 relative z-10 mb-6">
        {steps.map((step) => (
          <div key={step.number} className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                currentStep > step.number
                  ? "bg-primary text-primary-foreground"
                  : currentStep === step.number
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
              data-testid={`step-indicator-${step.number}`}
            >
              {currentStep > step.number ? <Check className="w-4 h-4" /> : step.number}
            </div>
            {step.number < 4 && (
              <div
                className={`w-12 h-0.5 ${
                  currentStep > step.number ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pb-12">
        <Card className="w-full max-w-md">
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle data-testid="text-step1-title">Personal Info</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...personalForm}>
                  <form
                    onSubmit={personalForm.handleSubmit(handleStep1Next)}
                    className="space-y-4"
                    data-testid="form-personal-info"
                  >
                    <FormField
                      control={personalForm.control}
                      name="nickname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nickname (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="What should people call you?"
                              data-testid="input-nickname"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="dob"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of Birth</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-dob"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input
                              type="tel"
                              placeholder="+1 555-0123"
                              data-testid="input-phone"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={personalForm.control}
                      name="bio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bio</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Tell people about yourself and what kind of parties you like..."
                              className="resize-none"
                              rows={3}
                              data-testid="input-bio"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3 justify-between pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleSkip}
                        data-testid="button-skip-onboarding"
                      >
                        Skip for now
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                        data-testid="button-step1-next"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </>
          )}

          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle data-testid="text-step2-title">Your Vibe</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...vibeForm}>
                  <form
                    onSubmit={vibeForm.handleSubmit(handleStep2Next)}
                    className="space-y-6"
                    data-testid="form-vibe"
                  >
                    <FormField
                      control={vibeForm.control}
                      name="preferredVibe"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Preferred Vibe</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 gap-2">
                              {VIBE_OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const isSelected = field.value === option.value;
                                return (
                                  <div
                                    key={option.value}
                                    className={`cursor-pointer rounded-md border p-3 text-center transition-colors ${
                                      isSelected
                                        ? "border-primary bg-primary/10"
                                        : ""
                                    }`}
                                    onClick={() => field.onChange(option.value)}
                                    data-testid={`option-vibe-${option.value}`}
                                  >
                                    <Icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                                    <span className="text-sm font-medium">{option.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vibeForm.control}
                      name="gatheringSizePref"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gathering Size Preference</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-3 gap-2">
                              {SIZE_OPTIONS.map((option) => {
                                const isSelected = field.value === option.value;
                                return (
                                  <div
                                    key={option.value}
                                    className={`cursor-pointer rounded-md border p-3 text-center transition-colors ${
                                      isSelected
                                        ? "border-primary bg-primary/10"
                                        : ""
                                    }`}
                                    onClick={() => field.onChange(option.value)}
                                    data-testid={`option-size-${option.value}`}
                                  >
                                    <span className="text-sm font-medium block">{option.label}</span>
                                    <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={vibeForm.control}
                      name="hostOrGuest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Are you mainly a...</FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-3 gap-2">
                              {ROLE_OPTIONS.map((option) => {
                                const isSelected = field.value === option.value;
                                return (
                                  <div
                                    key={option.value}
                                    className={`cursor-pointer rounded-md border p-3 text-center transition-colors ${
                                      isSelected
                                        ? "border-primary bg-primary/10"
                                        : ""
                                    }`}
                                    onClick={() => field.onChange(option.value)}
                                    data-testid={`option-role-${option.value}`}
                                  >
                                    <span className="text-sm font-medium block">{option.label}</span>
                                    <span className="text-xs text-muted-foreground">{option.subtitle}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-3 justify-between pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCurrentStep(1)}
                        data-testid="button-step2-back"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                        data-testid="button-step2-next"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </>
          )}

          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle data-testid="text-step3-title">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary" />
                    Personality Test
                  </div>
                </CardTitle>
                <p className="text-sm text-muted-foreground">OCEAN Model Assessment</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span data-testid="text-ocean-progress">{totalQuestionsAnswered} / 15</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${(totalQuestionsAnswered / 15) * 100}%` }}
                        data-testid="progress-ocean"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-1 pt-1">
                      {OCEAN_QUESTIONS.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === currentTraitIndex
                              ? "w-6 bg-primary"
                              : i < currentTraitIndex
                                ? "w-3 bg-primary/50"
                                : "w-3 bg-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-center">
                    <h3 className="text-sm font-semibold text-primary" data-testid="text-ocean-trait-label">
                      {currentTraitGroup.label}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{currentTraitGroup.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trait {currentTraitIndex + 1} of {OCEAN_QUESTIONS.length}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {currentTraitGroup.questions.map((question, qi) => {
                      const questionKey = `${currentTraitGroup.trait}-${qi}`;
                      const selectedValue = oceanAnswers[questionKey];
                      return (
                        <div key={questionKey} className="space-y-2">
                          <p className="text-sm font-medium" data-testid={`text-question-${questionKey}`}>
                            {qi + 1}. {question}
                          </p>
                          <div className="grid grid-cols-5 gap-1">
                            {LIKERT_OPTIONS.map((option) => {
                              const isSelected = selectedValue === option.value;
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => handleOceanAnswer(questionKey, option.value)}
                                  className={`rounded-md border p-2 text-center transition-colors cursor-pointer ${
                                    isSelected
                                      ? "border-primary bg-primary/15 text-primary"
                                      : "border-border"
                                  }`}
                                  data-testid={`option-${questionKey}-${option.value}`}
                                >
                                  <span className="text-xs leading-tight block">{option.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 justify-between pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (currentTraitIndex > 0) {
                          setCurrentTraitIndex(currentTraitIndex - 1);
                        } else {
                          setCurrentStep(2);
                        }
                      }}
                      data-testid="button-step3-back"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Back
                    </Button>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleStep3Skip}
                        data-testid="button-step3-skip"
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        onClick={handleStep3Next}
                        disabled={personalityMutation.isPending || !currentTraitAllAnswered}
                        data-testid="button-step3-next"
                      >
                        {personalityMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        {currentTraitIndex < OCEAN_QUESTIONS.length - 1 ? "Next Trait" : "Submit"}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </>
          )}

          {currentStep === 4 && (
            <>
              <CardHeader>
                <CardTitle data-testid="text-step4-title">Your Location</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...locationForm}>
                  <form
                    onSubmit={locationForm.handleSubmit(handleStep4Next)}
                    className="space-y-4"
                    data-testid="form-location"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleDetectLocation}
                      disabled={detectingLocation}
                      data-testid="button-detect-location"
                    >
                      {detectingLocation ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Navigation className="w-4 h-4 mr-2" />
                      )}
                      {detectingLocation ? "Detecting..." : "Detect My Location"}
                    </Button>
                    <FormField
                      control={locationForm.control}
                      name="country"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Country</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              locationForm.setValue("region", "");
                              locationForm.setValue("city", "");
                            }}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-country">
                                <SelectValue placeholder="Select your country" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {COUNTRIES.map((c) => (
                                <SelectItem key={c.value} value={c.value} data-testid={`option-country-${c.value}`}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="region"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Region / County</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              locationForm.setValue("city", "");
                            }}
                            value={field.value}
                            disabled={!selectedCountry}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-region">
                                <SelectValue placeholder={selectedCountry ? "Select region" : "Select a country first"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(REGIONS_BY_COUNTRY[selectedCountry] || []).map((r) => (
                                <SelectItem key={r} value={r} data-testid={`option-region-${r}`}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={selectedRegion ? "Type your city" : "Select a region first"}
                              {...field}
                              disabled={!selectedRegion}
                              data-testid="input-city"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={locationForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address (optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Street address"
                              data-testid="input-address"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-center gap-3 justify-between pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCurrentStep(3)}
                        data-testid="button-step4-back"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={updateMutation.isPending}
                        data-testid="button-complete-setup"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        <Check className="w-4 h-4 mr-1" />
                        Complete Setup
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
