import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";
import {
  estimateStorageBreakdown,
  formatBytes,
  type StorageBreakdown,
} from "../lib/storageEstimate";

export function StorageUsageCard() {
  const [data, setData] = useState<StorageBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setData(await estimateStorageBreakdown());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not estimate storage");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const totalApp =
    (data?.bibleBytes ?? 0) + (data?.userDataBytes ?? 0);

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HardDrive className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-base font-semibold text-primary">
              Storage used
            </h3>
            <p className="text-sm text-muted mt-0.5">
              Estimates for this device. Scripture books cache as you open them;
              your Spaces live in IndexedDB (export to back up).
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="!py-2 !px-3 text-sm shrink-0"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      {data && !loading && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted">Bible data (approx.)</dt>
          <dd className="text-right font-medium tabular-nums">
            {formatBytes(data.bibleBytes)}
          </dd>
          <dt className="text-muted">Your data (IndexedDB)</dt>
          <dd className="text-right font-medium tabular-nums">
            {formatBytes(data.userDataBytes)}
          </dd>
          <dt className="text-muted">App total (est.)</dt>
          <dd className="text-right font-medium tabular-nums">
            {formatBytes(totalApp)}
          </dd>
          {data.browserUsageBytes != null && (
            <>
              <dt className="text-muted">Browser reported usage</dt>
              <dd className="text-right font-medium tabular-nums">
                {formatBytes(data.browserUsageBytes)}
              </dd>
            </>
          )}
          {data.browserQuotaBytes != null && (
            <>
              <dt className="text-muted">Browser quota</dt>
              <dd className="text-right font-medium tabular-nums">
                {formatBytes(data.browserQuotaBytes)}
              </dd>
            </>
          )}
          <dt className="text-muted">Spaces / sessions</dt>
          <dd className="text-right font-medium tabular-nums">
            {data.spaces} / {data.sessions}
          </dd>
          <dt className="text-muted">Private notes</dt>
          <dd className="text-right font-medium tabular-nums">
            {data.privateNotes}
          </dd>
          <dt className="text-muted">Prayer board</dt>
          <dd className="text-right font-medium tabular-nums">
            {data.prayerBoard}
          </dd>
        </dl>
      )}

      {loading && !data && (
        <p className="text-sm text-muted">Measuring storage…</p>
      )}
    </Card>
  );
}
