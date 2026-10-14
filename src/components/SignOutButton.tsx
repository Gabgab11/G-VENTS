import { signOut } from "@/app/auth/actions";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="back-link">Sign out</button>
    </form>
  );
}
