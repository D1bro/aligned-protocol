import { LoginForms } from "./LoginForms";

export const metadata = { title: "Sign in — Aligned" };

export default function LoginPage() {
  return (
    <div className="center-page auth-bg">
      <LoginForms />
    </div>
  );
}
