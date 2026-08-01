import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { JoinSpaceModal } from "../components/JoinSpaceModal";
import { NavBreadcrumb } from "../components/NavBreadcrumb";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { consumePendingJoinRaw } from "../components/Layout";

/**
 * Full-page join entry (/join) — deep links and room keys land here, then the group.
 */
export function JoinGroup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [joinOpen, setJoinOpen] = useState(true);
  const [initialRaw, setInitialRaw] = useState<string | null>(() => {
    const fromQuery =
      searchParams.get("code")?.trim() ||
      searchParams.get("key")?.trim() ||
      searchParams.get("invite")?.trim() ||
      null;
    if (fromQuery) return fromQuery;
    return consumePendingJoinRaw();
  });

  // Re-open if user closed then used “Join again”
  useEffect(() => {
    if (!joinOpen && !initialRaw) return;
  }, [joinOpen, initialRaw]);

  function handleClose() {
    setJoinOpen(false);
    setInitialRaw(null);
  }

  return (
    <div className="space-y-4">
      <NavBreadcrumb
        items={[{ label: "Groups", to: "/" }, { label: "Join" }]}
      />

      <div>
        <h2 className="text-2xl font-serif tracking-tight text-primary">
          Join a group
        </h2>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          Enter the host’s <strong className="text-text">room key</strong>, scan
          a QR, or paste an invite. After you join, you’ll open that group on
          this phone.
        </p>
      </div>

      {!joinOpen && (
        <Card padding="lg" className="space-y-3 text-center">
          <p className="text-sm text-muted">
            Join closed. You can start again or go back to your groups.
          </p>
          <div className="flex flex-col gap-2 max-w-xs mx-auto w-full">
            <Button
              fullWidth
              onClick={() => {
                setInitialRaw(null);
                setJoinOpen(true);
              }}
            >
              Join again
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate("/")}
            >
              Back to groups
            </Button>
          </div>
        </Card>
      )}

      <p className="text-center text-sm text-muted">
        Starting a group instead?{" "}
        <Link
          to="/new"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          New group
        </Link>
      </p>

      <JoinSpaceModal
        open={joinOpen}
        initialRaw={initialRaw}
        onClose={handleClose}
      />
    </div>
  );
}
