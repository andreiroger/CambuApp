import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PartyPopper, Sparkles, Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name is required"),
  agreedToTerms: z.boolean().refine(v => v === true, "You must agree to the terms and EULA"),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("signin");

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", fullName: "", agreedToTerms: false },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginValues) => {
      const res = await apiRequest("POST", "/api/auth/login", values);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Welcome back!", description: "You've signed in successfully." });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Sign in failed",
        description: error.message.includes("401") ? "Invalid username or password" : error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (values: RegisterValues) => {
      const res = await apiRequest("POST", "/api/auth/register", { ...values, agreedToEula: values.agreedToTerms });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Account created!", description: "Let's set up your profile." });
      setLocation("/onboarding");
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message.includes("Username already taken") ? "Username already taken" : error.message.includes("email is already registered") ? "This email is already registered" : error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (user && !authLoading) {
      setLocation("/");
    }
  }, [user, authLoading, setLocation]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="relative overflow-hidden py-16 px-4 flex flex-col items-center justify-center"
        style={{
          background: "linear-gradient(135deg, hsl(280 85% 15%) 0%, hsl(280 85% 8%) 50%, hsl(300 60% 10%) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: "radial-gradient(circle at 30% 50%, hsl(280 85% 55% / 0.4) 0%, transparent 50%), radial-gradient(circle at 70% 30%, hsl(320 65% 50% / 0.3) 0%, transparent 40%)",
          }}
        />
        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <PartyPopper className="w-10 h-10 text-primary-foreground" />
            <h1 className="text-4xl font-bold text-primary-foreground tracking-tight" data-testid="text-app-title">
              CambuApp
            </h1>
            <Sparkles className="w-8 h-8 text-primary-foreground opacity-80" />
          </div>
          <p className="text-primary-foreground/70 text-lg" data-testid="text-app-tagline">
            The Party Vibe Network
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 -mt-8 pb-12">
        <Card className="w-full max-w-md relative z-10">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full mb-6">
                <TabsTrigger value="signin" className="flex-1" data-testid="tab-signin">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1" data-testid="tab-signup">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <Form {...loginForm}>
                  <form
                    onSubmit={loginForm.handleSubmit((v) => loginMutation.mutate(v))}
                    className="space-y-4"
                    data-testid="form-signin"
                  >
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your username"
                              data-testid="input-login-username"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Enter your password"
                              data-testid="input-login-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-signin"
                    >
                      {loginMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Sign In
                    </Button>
                  </form>
                </Form>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="text-foreground underline underline-offset-2"
                    onClick={() => setActiveTab("signup")}
                    data-testid="link-goto-signup"
                  >
                    Sign up
                  </button>
                </p>
              </TabsContent>

              <TabsContent value="signup">
                <Form {...registerForm}>
                  <form
                    onSubmit={registerForm.handleSubmit((v) => registerMutation.mutate(v))}
                    className="space-y-4"
                    data-testid="form-signup"
                  >
                    <FormField
                      control={registerForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Your full name"
                              data-testid="input-register-fullname"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Choose a username"
                              data-testid="input-register-username"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="you@example.com"
                              data-testid="input-register-email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="At least 6 characters"
                              data-testid="input-register-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="agreedToTerms"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-start gap-3">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-agree-terms"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-normal leading-snug cursor-pointer">
                              I agree to the{" "}
                              <Link href="/legal/terms" className="underline underline-offset-2" data-testid="link-terms">
                                Terms of Service
                              </Link>
                              ,{" "}
                              <Link href="/legal/privacy" className="underline underline-offset-2" data-testid="link-privacy">
                                Privacy Policy
                              </Link>
                              , and{" "}
                              <Link href="/legal/eula" className="underline underline-offset-2" data-testid="link-eula">
                                EULA
                              </Link>
                            </FormLabel>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={registerMutation.isPending}
                      data-testid="button-signup"
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Create Account
                    </Button>
                  </form>
                </Form>
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-foreground underline underline-offset-2"
                    onClick={() => setActiveTab("signin")}
                    data-testid="link-goto-signin"
                  >
                    Sign in
                  </button>
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
