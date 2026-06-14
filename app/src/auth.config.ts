import type { NextAuthConfig } from "next-auth";
import Github from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { type Role } from "@/db/schema";

export const authConfig = {
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Github({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const anyToken = token as any;

      // If user logs in or registers
      if (user) {
        anyToken.id = user.id;
        anyToken.roles = (user as any).roles || ["registered_user"];
      }

      // If user profile is updated in-session
      if (trigger === "update" && session?.roles) {
        anyToken.roles = session.roles;
      }

      return token;
    },
    async session({ session, token }) {
      const anyToken = token as any;
      if (anyToken.id) {
        session.user.id = anyToken.id as string;
      }
      if (anyToken.roles) {
        session.user.roles = anyToken.roles as Role[];
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
