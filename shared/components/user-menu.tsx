"use client";

import { useSession, signOut } from "next-auth/react";
import { useUserStore } from "@/core/store/user-store";
import { useEffect } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { User, LogOut, Settings } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";

export function UserMenu() {
  const { data: session, status } = useSession();
  const { profile, setProfile, preferences, setTheme } = useUserStore();
  const { theme, setTheme: setNextTheme } = useTheme();

  // Sync session with user store
  useEffect(() => {
    if (session?.user) {
      setProfile({
        id: session.user.id || "",
        name: session.user.name || null,
        email: session.user.email || null,
        image: session.user.image || null,
      });
    } else {
      setProfile(null);
    }
  }, [session, setProfile]);

  // Sync theme
  useEffect(() => {
    if (preferences.theme !== theme) {
      setNextTheme(preferences.theme);
    }
  }, [preferences.theme, theme, setNextTheme]);

  if (status === "loading") {
    return null;
  }

  if (!session) {
    return null;
  }

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    setNextTheme(newTheme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          {session.user?.image ? (
            <Image
              src={session.user.image}
              alt={session.user.name || "User"}
              width={32}
              height={32}
              className="rounded-full"
            />
          ) : (
            <User className="h-5 w-5" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{session.user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{session.user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleThemeChange("light")}>
          <span className="flex items-center">
            <span className="mr-2">{preferences.theme === "light" ? "●" : "○"}</span>
            Light
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
          <span className="flex items-center">
            <span className="mr-2">{preferences.theme === "dark" ? "●" : "○"}</span>
            Dark
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange("system")}>
          <span className="flex items-center">
            <span className="mr-2">{preferences.theme === "system" ? "●" : "○"}</span>
            System
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
