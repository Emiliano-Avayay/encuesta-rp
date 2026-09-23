import { BrandHeader } from "@/components/BrandHeader";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <>
      <BrandHeader />
      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-md items-center px-4 py-10">
        <LoginForm />
      </main>
    </>
  );
}
