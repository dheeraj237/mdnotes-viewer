"use client";

import { useFeatureValue } from "@growthbook/growthbook-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/shared/components/ui/button";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { ArrowRight, FileText, Zap, Shield, Chrome } from "lucide-react";

export function LandingPage() {
  // Get configurable content from GrowthBook
  const title = useFeatureValue("landing-title", "Verve: Your Markdown Editor");
  const description = useFeatureValue(
    "landing-description",
    "A powerful markdown documentation editor with live preview, collaborative features, and intuitive navigation."
  );
  const showDemoButton = useFeatureValue("show-demo-button", true);
  const showLoginButton = useFeatureValue("show-login-button", true);

  const handleGoogleSignIn = async () => {
    await signIn("google", { callbackUrl: "/editor" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span className="font-semibold text-xl">Verve</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {showLoginButton && (
              <Button variant="ghost" onClick={handleGoogleSignIn}>
                <Chrome className="h-4 w-4 mr-2" />
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Title & Description */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {title}
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              {description}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            {showDemoButton && (
              <Button size="lg" className="text-lg px-8" asChild>
                <Link href="/editor">
                  Try Demo <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            )}
            {showLoginButton && (
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8"
                onClick={handleGoogleSignIn}
              >
                <Chrome className="mr-2 h-5 w-5" />
                Sign in with Google
              </Button>
            )}
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 pt-16">
            <div className="space-y-3 p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Live Preview</h3>
              <p className="text-sm text-muted-foreground">
                See your markdown rendered instantly as you type with syntax highlighting and
                Mermaid diagram support.
              </p>
            </div>

            <div className="space-y-3 p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">File Explorer</h3>
              <p className="text-sm text-muted-foreground">
                Navigate through your documentation with an intuitive tree-based file explorer and
                quick search.
              </p>
            </div>

            <div className="space-y-3 p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Secure & Private</h3>
              <p className="text-sm text-muted-foreground">
                Your data is secure with Google authentication and stored preferences synced across
                devices.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with Next.js, TypeScript, and Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}
