import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { JoinSpaceModal } from "../components/JoinSpaceModal";
import { NavBreadcrumb } from "../components/NavBreadcrumb";
import { consumePendingJoinRaw } from "../components/Layout";

/**
 * Full-page join entry (/join) — deep links and room keys land here, then the group.
 */
export function JoinGroup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [initialRaw] = useState<string | null>(() => {
    const fromQuery =
      searchParams.get("code")?.trim() ||
      searchParams.get("key")?.trim() ||
      searchParams.get("invite")?.trim() ||
      null;
    if (fromQuery) return fromQuery;
    return consumePendingJoinRaw();
  });

  function handleClose() {
    navigate("/");
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
          Use the live <strong className="text-text">room key</strong> or join
          link. You’ll land in that group on this phone.
        </p>
      </div>

      <JoinSpaceModal
        open
        embedded
        initialRaw={initialRaw}
        onClose={handleClose}
      />

      <p className="text-center text-sm text-muted">
        Starting a group instead?{" "}
        <Link
          to="/new"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          New group
        </Link>
      </p>
    </div>
  );
}
