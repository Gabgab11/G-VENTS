import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AuthScreen from "../sign-in/AuthScreen";
import SignInArt from "../sign-in/SignInArt";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.meta");
  return { title: t("signUp") };
}

export default function SignUpPage() {
  return <AuthScreen mode="signup" art={<SignInArt />} />;
}
