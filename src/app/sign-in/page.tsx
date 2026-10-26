import type { Metadata } from "next";
import AuthScreen from "./AuthScreen";

export const metadata: Metadata = { title: "Log in · G-ventZ" };

export default function SignInPage() {
  return <AuthScreen mode="signin" />;
}
