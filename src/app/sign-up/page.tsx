import type { Metadata } from "next";
import AuthScreen from "../sign-in/AuthScreen";

export const metadata: Metadata = { title: "Sign up · G-ventZ" };

export default function SignUpPage() {
  return <AuthScreen mode="signup" />;
}
