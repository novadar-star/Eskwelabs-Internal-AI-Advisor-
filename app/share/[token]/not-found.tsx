import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-sans">
      <h1 className="text-2xl font-bold">404 - Not Found</h1>
      <p className="text-zinc-500 dark:text-zinc-400">
        This shared conversation link is invalid, has expired, or has been revoked.
      </p>
      <Link
        href="/"
        className="mt-4 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Return Home
      </Link>
    </div>
  );
}
