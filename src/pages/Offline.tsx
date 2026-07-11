import { Link } from "react-router-dom";
import { BookOpen, Home, WifiOff } from "lucide-react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

/**
 * Explicit offline landing. Also linked from the offline banner.
 * SPA + navigateFallback keeps main routes available offline after first visit.
 */
export function Offline() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900">
          <WifiOff className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <h2 className="text-2xl">Offline</h2>
          <p className="text-sm text-muted mt-1">
            You’re not connected to the network. DiscipleSpaces is built to keep
            working with data already on this device.
          </p>
        </div>
      </div>

      <Card className="space-y-2 text-sm text-muted">
        <p className="font-medium text-primary">What still works</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your Spaces, sessions, and private notes</li>
          <li>Cached King James Bible books you’ve opened (or fully installed PWA)</li>
          <li>Help &amp; tutorial content</li>
        </ul>
      </Card>

      <div className="flex flex-col gap-2">
        <Link to="/" className="block">
          <Button fullWidth>
            <Home className="h-5 w-5" aria-hidden />
            Your spaces
          </Button>
        </Link>
        <Link to="/bible" className="block">
          <Button variant="secondary" fullWidth>
            <BookOpen className="h-5 w-5" aria-hidden />
            Bible
          </Button>
        </Link>
        <Link to="/help" className="block">
          <Button variant="ghost" fullWidth>
            Help
          </Button>
        </Link>
      </div>
    </div>
  );
}
