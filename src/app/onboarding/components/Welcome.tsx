"use client";

interface WelcomeProps {
  onStart: () => void;
  loading: boolean;
}

export default function Welcome({ onStart, loading }: WelcomeProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-[#1a2744]">
          Welcome to Wonk HQ
        </h1>

        <div className="mt-8 space-y-4 text-lg text-[#1a2744]/80">
          <p>
            This maps what you already know so we can build your curriculum.
          </p>
          <p>
            No grades, no pressure. Just finding your starting line.
          </p>
          <p className="text-base text-[#1a2744]/60">
            This takes about 30-45 minutes, but you can pause anytime.
          </p>
        </div>

        <button
          onClick={onStart}
          disabled={loading}
          className="mt-10 inline-block rounded-lg bg-[#e85d4a] px-10 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-[#d14d3b] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Starting..." : "Let's Begin"}
        </button>
      </div>
    </div>
  );
}
