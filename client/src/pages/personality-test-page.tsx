import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Brain, ChevronLeft, ChevronRight, Loader2, Check } from "lucide-react";

interface OceanScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

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

function calculateDaysRemaining(lastTaken: string | null): number | null {
  if (!lastTaken) return null;
  const lastDate = new Date(lastTaken);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = 90 - daysPassed;
  return daysRemaining > 0 ? daysRemaining : null;
}

export default function PersonalityTestPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [currentTraitIndex, setCurrentTraitIndex] = useState(0);
  const [testStarted, setTestStarted] = useState(false);
  const [testComplete, setTestComplete] = useState(false);

  const daysRemaining = user?.oceanLastTaken ? calculateDaysRemaining(user.oceanLastTaken) : null;
  const canRetakeTest = daysRemaining === null;

  useEffect(() => {
    if (user && !canRetakeTest) {
      setTestComplete(true);
    }
  }, [user, canRetakeTest]);

  const testMutation = useMutation({
    mutationFn: async (testScores: OceanScores) => {
      const res = await apiRequest("POST", "/api/personality/test", testScores);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Test Completed",
        description: "Your OCEAN personality results have been saved.",
      });
      setTestComplete(true);
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Failed to submit test results",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-12 w-24 rounded-md" />
          <Skeleton className="h-32 w-full rounded-md" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      </div>
    );
  }

  const handleAnswer = (questionKey: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionKey]: value }));
  };

  const computeScores = (): OceanScores => {
    const scores: OceanScores = { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50 };
    for (const group of OCEAN_QUESTIONS) {
      const vals = group.questions.map((_, qi) => answers[`${group.trait}-${qi}`]);
      const answered = vals.filter((v): v is number => v !== null && v !== undefined);
      if (answered.length > 0) {
        scores[group.trait] = Math.round(answered.reduce((a, b) => a + b, 0) / answered.length);
      }
    }
    return scores;
  };

  const currentTraitGroup = OCEAN_QUESTIONS[currentTraitIndex];
  const currentTraitAllAnswered = currentTraitGroup?.questions.every(
    (_, qi) => answers[`${currentTraitGroup.trait}-${qi}`] !== undefined && answers[`${currentTraitGroup.trait}-${qi}`] !== null
  );
  const totalQuestionsAnswered = Object.values(answers).filter((v) => v !== null && v !== undefined).length;

  const handleNext = async () => {
    if (currentTraitIndex < OCEAN_QUESTIONS.length - 1) {
      setCurrentTraitIndex(currentTraitIndex + 1);
    } else {
      const scores = computeScores();
      testMutation.mutate(scores);
    }
  };

  const handlePrev = () => {
    if (currentTraitIndex > 0) {
      setCurrentTraitIndex(currentTraitIndex - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 pb-28">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/profile")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Personality Test</h1>
            </div>
            <p className="text-sm text-muted-foreground">OCEAN Model Assessment</p>
          </div>
        </div>

        {!canRetakeTest && daysRemaining !== null && (
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                You can retake this test in <span className="font-semibold">{daysRemaining} days</span>.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Last taken: {new Date(user.oceanLastTaken!).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        )}

        {testComplete && user.oceanOpenness !== null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {OCEAN_QUESTIONS.map((group) => {
                  const score = user[`ocean${group.trait.charAt(0).toUpperCase() + group.trait.slice(1)}` as keyof typeof user] as number | null;
                  return (
                    <div key={group.trait} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{group.label}</span>
                        <span className="font-semibold text-primary" data-testid={`text-${group.trait}-score`}>
                          {score ?? 50}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${score ?? 50}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {!testStarted && canRetakeTest && !testComplete && (
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Brain className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Discover Your Personality</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Answer 15 questions across 5 personality traits. It takes about 3 minutes.
                </p>
              </div>
              <Button
                onClick={() => setTestStarted(true)}
                className="w-full"
                data-testid="button-start-test"
              >
                Start Test
              </Button>
            </CardContent>
          </Card>
        )}

        {testStarted && canRetakeTest && !testComplete && (
          <>
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
                {OCEAN_QUESTIONS.map((group, i) => {
                  const groupAnswered = group.questions.every(
                    (_, qi) => answers[`${group.trait}-${qi}`] !== undefined && answers[`${group.trait}-${qi}`] !== null
                  );
                  return (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentTraitIndex
                          ? "w-6 bg-primary"
                          : groupAnswered
                            ? "w-3 bg-primary/50"
                            : "w-3 bg-muted-foreground/30"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <Card>
              <CardContent className="p-4 space-y-4">
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
                    const selectedValue = answers[questionKey];
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
                                onClick={() => handleAnswer(questionKey, option.value)}
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
                    onClick={handlePrev}
                    disabled={currentTraitIndex === 0}
                    data-testid="button-prev-trait"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleNext}
                    disabled={testMutation.isPending || !currentTraitAllAnswered}
                    data-testid="button-next-trait"
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    {currentTraitIndex < OCEAN_QUESTIONS.length - 1 ? (
                      <>
                        Next Trait
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-1" />
                        Submit Results
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
