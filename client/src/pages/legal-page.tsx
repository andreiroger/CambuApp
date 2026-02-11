import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";

const TITLES: Record<string, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  eula: "End User License Agreement",
};

export default function LegalPage() {
  const [, params] = useRoute("/legal/:type");
  const type = params?.type ?? "terms";

  const { data, isLoading, isError } = useQuery<{ content: string }>({
    queryKey: ["/api/legal", type],
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/auth">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold" data-testid="text-legal-title">
            {TITLES[type] || "Legal"}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ) : isError ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground" data-testid="text-legal-error">
                Failed to load content. Please try again later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6">
              <div
                className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
                data-testid="text-legal-content"
              >
                {data?.content}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
