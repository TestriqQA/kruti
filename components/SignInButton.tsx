"use client";

import { signIn } from "next-auth/react";
import { ReactNode } from "react";

/**
 * A reusable sign-in button that triggers LinkedIn OAuth directly.
 *
 * Drop-in replacement for `<Link href="/login">` or `<button onClick={...}>` anywhere
 * a sign-in action is needed. Accepts `className` and `children` so it can match any
 * visual style without duplicating the sign-in logic.
 */
export default function SignInButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={() => signIn("linkedin", { callbackUrl: "/dashboard" })}
      className={className}
    >
      {children}
    </button>
  );
}
