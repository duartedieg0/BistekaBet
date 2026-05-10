"use client";

import { Button } from "@/components/ui/button";
import { useGoogleSignIn } from "@/app/_components/use-google-sign-in";

type Variant = "default" | "accent" | "outline";
type Size = "default" | "sm" | "lg";

interface Props {
  variant?: Variant;
  size?: Size;
  label?: string;
  className?: string;
}

export function GoogleSignInButton({
  variant = "accent",
  size = "lg",
  label = "Entrar com Google",
  className,
}: Props) {
  const { signIn, pending } = useGoogleSignIn();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={signIn}
      disabled={pending}
      className={className}
      aria-label="Entrar com a conta Google"
    >
      <GoogleIcon />
      {pending ? "Entrando..." : label}
    </Button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.4-1.6 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1S8.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12S6.8 21.4 12 21.4c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"
      />
    </svg>
  );
}
