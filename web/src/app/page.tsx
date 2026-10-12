import { Footer, Header } from "@/components/Header";
import HomeContent from "@/components/HomeContent";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8 sm:py-12">
      <Header />
      <HomeContent />
      <Footer />
    </main>
  );
}
