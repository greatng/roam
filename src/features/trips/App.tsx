import { RoamLogo } from "../../shared/RoamLogo";
import { Button } from "../../shared/ui/Button";
import { IconButton } from "../../shared/ui/IconButton";
import { ThemeChoice } from "../../shared/ui/ThemeChoice";
import { revealEditor } from "../../shared/editor-navigation";
import { GuestRecovery } from "./GuestRecovery";
import { actionError } from "./errors";
import type { User } from "@supabase/supabase-js";
import { EmailAccess } from "../auth/EmailAccess";
import { canCreateTrip } from "../auth/email";
import { useMembers } from "../members/queries";
import { pages } from "../../shared/supabase/pages";
import { addCalendarDays } from "../plan/dates";
import { redeem } from "../invites/redeem";
import { removeTripReceiptFiles } from "../expenses/receipts/storage";

import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import { QueryClient, useQuery } from "@tanstack/preact-query";
import QRCode from "qrcode";
import { supabase as db } from "../../shared/supabase/client";
import { TripActivity } from "./TripActivity";
import { ThemeToggle } from "../../shared/ThemeToggle";
import { PwaUpdate } from "../../shared/PwaUpdate";
import {
  cacheTripData,
  clearAllLocalData,
  clearTripData,
  localDb,
  readCachedTripData,
} from "../offline/db";

export const qc = new QueryClient();
const thai = signal(false);
const t = (en: string, th: string) => (thai.value ? th : en);
type TripRow = {
  id: string;
  title: string;
  base_currency: string;
  status: string;
  start_date: string;
  end_date: string;
};
function mayUseOfflineCache(error: unknown) {
  const candidate = error as { status?: number; code?: string } | null;
  return (
    candidate?.status !== 401 &&
    candidate?.status !== 403 &&
    candidate?.code !== "42501" &&
    candidate?.code !== "PGRST301" &&
    (!navigator.onLine || !candidate?.status || candidate.status >= 500)
  );
}
export function App() {
  const [uid, setUid] = useState<string>();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<{
    image: string;
    code: string;
    link: string;
  } | null>(null);
  const [inviteExpiryDate, setInviteExpiryDate] = useState("");
  const inviteCutoff = inviteExpiryDate
    ? new Date(addCalendarDays(inviteExpiryDate, 1) + "T00:00:00")
    : null;
  const qrPanel = useRef<HTMLElement>(null);
  const [route, setRoute] = useState(location.hash);
  const [invitationError, setInvitationError] = useState<
    "empty" | "invalid" | null
  >(null);
  const joinHeading = useRef<HTMLHeadingElement>(null);
  const focusJoinAfterPaste = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signOutWarning, setSignOutWarning] = useState(false);
  const accountControl = useRef<HTMLDivElement>(null);
  const appHeader = useRef<HTMLElement>(null);
  const appMain = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const header = appHeader.current;
    const main = appMain.current;
    if (!header || !main || typeof ResizeObserver === "undefined") return;
    const updateHeaderHeight = () => {
      main.style.setProperty(
        "--app-header-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`,
      );
    };
    updateHeaderHeight();
    const observer = new ResizeObserver(updateHeaderHeight);
    observer.observe(header, { box: "border-box" });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!accountOpen) return;
    function close() {
      setAccountOpen(false);
      setSignOutWarning(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        !accountControl.current?.contains(document.activeElement)
      )
        return;
      close();
      accountControl.current.querySelector("button")?.focus();
    }
    function onOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !accountControl.current?.contains(event.target)
      )
        close();
    }
    document.addEventListener("keydown", onEscape);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [accountOpen]);
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    if (qr) revealEditor(qrPanel.current);
  }, [qr]);
  useEffect(() => {
    if (focusJoinAfterPaste.current && joinHeading.current) {
      focusJoinAfterPaste.current = false;
      revealEditor(joinHeading.current);
    }
  }, [route]);
  useEffect(() => {
    setSelectedId(
      uid ? localStorage.getItem(`paikan-selected-trip:${uid}`) : null,
    );
  }, [uid]);
  function selectTrip(id: string | null) {
    setSelectedId(id);
    setQr(null);
    if (uid) {
      if (id) localStorage.setItem(`paikan-selected-trip:${uid}`, id);
      else localStorage.removeItem(`paikan-selected-trip:${uid}`);
    }
  }
  async function prepareSignOut() {
    setPendingCount(
      uid ? await localDb.outbox.where("ownerId").equals(uid).count() : 0,
    );
    setSignOutWarning(true);
  }
  async function signOut() {
    await run(async () => {
      localStorage.setItem("paikan-cache-disabled", "true");
      try {
        const result = await db.auth.signOut({ scope: "local" });
        if (result.error) throw result.error;
      } catch (cause) {
        const current = await db.auth.getSession();
        const activeId = current.data.session?.user.id;
        if (activeId) localStorage.setItem("travelmate-local-user", activeId);
        localStorage.setItem(
          "paikan-cache-disabled",
          activeId ? "false" : "true",
        );
        throw cause;
      }
      await clearAllLocalData();
      qc.clear();
      setUser(null);
      setUid(undefined);
      setSelectedId(null);
      setSignOutWarning(false);
      setAccountOpen(false);
      localStorage.removeItem("travelmate-local-user");
      if (uid) localStorage.removeItem(`paikan-selected-trip:${uid}`);
    });
  }

  useEffect(() => {
    const routeChange = () => setRoute(location.hash);
    window.addEventListener("hashchange", routeChange);
    const { data } = db.auth.onAuthStateChange((_e, s) => {
      setUid(s?.user.id);
      setUser(s?.user ?? null);
      setQr(null);
      qc.clear();
      const previous = localStorage.getItem("travelmate-local-user");
      if (previous && previous !== s?.user.id) void clearAllLocalData();
      if (s?.user.id) localStorage.setItem("travelmate-local-user", s.user.id);
      localStorage.setItem(
        "paikan-cache-disabled",
        s?.user.id ? "false" : "true",
      );
    });
    void db.auth.getSession().then(({ data }) => {
      const next = data.session?.user.id;
      const previous = localStorage.getItem("travelmate-local-user");
      if (previous && previous !== next) void clearAllLocalData();
      if (next) localStorage.setItem("travelmate-local-user", next);
      localStorage.setItem("paikan-cache-disabled", next ? "false" : "true");
      setUid(next);
      setUser(data.session?.user ?? null);
    });
    const resume = () => void qc.invalidateQueries();
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("hashchange", routeChange);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  }, []);
  const trips = useQuery({
    queryKey: ["trips", uid],
    enabled: !!uid,
    queryFn: async () => {
      try {
        const rows = await pages((from, to) =>
          db.from("trips").select("*").order("id").range(from, to),
        );
        if (uid) await cacheTripData(uid, "__dashboard__", "trips", rows);
        return rows;
      } catch (error) {
        const cached =
          uid && mayUseOfflineCache(error)
            ? await readCachedTripData<TripRow[]>(uid, "__dashboard__", "trips")
            : undefined;
        if (cached) return cached;
        throw error;
      }
    },
  });
  const members = useMembers(uid);
  const requests = useQuery({
    queryKey: ["requests", uid],
    enabled: !!uid,
    queryFn: () =>
      pages((from, to) =>
        db.from("trip_join_requests").select("*").order("id").range(from, to),
      ),
  });
  const invites = useQuery({
    queryKey: ["invites", uid],
    enabled: !!uid,
    queryFn: () =>
      pages((from, to) =>
        db
          .from("trip_invites")
          .select(
            "id,trip_id,expires_at,uses_count,max_uses,revoked_at,deleted_at",
          )
          .is("deleted_at", null)
          .order("id")
          .range(from, to),
      ),
  });
  useEffect(() => {
    if (!trips.isSuccess || !trips.data) return;
    const ids = new Set(trips.data.map((trip) => trip.id));
    if (selectedId && !ids.has(selectedId)) selectTrip(null);
    void (async () => {
      const cached = await localDb.cached.toArray();
      const queued = await localDb.outbox.toArray();
      for (const tripId of new Set(
        [...cached, ...queued]
          .filter((row) => row.ownerId === uid)
          .map((row) => row.tripId),
      ))
        if (tripId !== "__dashboard__" && !ids.has(tripId))
          await clearTripData(tripId, uid);
    })();
  }, [trips.isSuccess, trips.data, uid, selectedId]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await qc.invalidateQueries();
    } catch (cause) {
      setError(actionError(cause, thai.value));
    } finally {
      setBusy(false);
    }
  }
  async function rpc(name: string, args: Record<string, unknown>) {
    const r = await db.rpc(name, args);
    if (r.error) throw r.error;
    return r.data;
  }
  return (
    <>
      <header ref={appHeader}>
        <a href="#/trips" aria-label="Roam" onClick={() => selectTrip(null)}>
          <RoamLogo />
        </a>
        <Button
          type="button"
          onClick={() => {
            thai.value = !thai.value;
            document.documentElement.lang = thai.value ? "th" : "en";
          }}
        >
          ไทย / English
        </Button>
        <div class="header-actions">
          <ThemeToggle thai={thai.value} />
          {uid && (
            <div class="account-control" ref={accountControl}>
              <IconButton
                class="account-toggle"
                aria-label={
                  user?.is_anonymous
                    ? t("Guest account", "บัญชีผู้เยี่ยมชม")
                    : t("Account", "บัญชี")
                }
                aria-expanded={accountOpen}
                aria-controls={accountOpen ? "account-panel" : undefined}
                onClick={() => {
                  setAccountOpen(!accountOpen);
                  setSignOutWarning(false);
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                >
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
                </svg>
              </IconButton>
              {accountOpen && (
                <section
                  id="account-panel"
                  class="account-menu"
                  aria-label={t("Account", "บัญชี")}
                >
                  <ThemeChoice thai={thai.value} />
                  <p>
                    {user?.is_anonymous
                      ? t(
                          "This guest account lives on this device. Verify an email to keep access across devices.",
                          "บัญชีผู้เยี่ยมชมใช้ได้เฉพาะอุปกรณ์นี้ ยืนยันอีเมลเพื่อใช้บัญชีนี้ในอุปกรณ์อื่น",
                        )
                      : user?.email}
                  </p>
                  {user?.is_anonymous && (
                    <Button
                      type="button"
                      onClick={() => {
                        selectTrip(null);
                        setAccountOpen(false);
                      }}
                    >
                      {t(
                        "Create my own trips / Verify email",
                        "ยืนยันอีเมลเพื่อสร้างทริป",
                      )}
                    </Button>
                  )}
                  <Button type="button" onClick={() => void prepareSignOut()}>
                    {t("Sign out of this device", "ออกจากระบบบนอุปกรณ์นี้")}
                  </Button>
                  {signOutWarning && (
                    <section
                      role="alert"
                      aria-label={t("Confirm sign out", "ยืนยันการออกจากระบบ")}
                    >
                      <p>
                        {user?.is_anonymous
                          ? t(
                              "Signing out of a guest account can lose access to your trips. Ask your organizer about supervised recovery before continuing.",
                              "การออกจากบัญชีผู้เยี่ยมชมอาจทำให้เข้าถึงทริปไม่ได้ กรุณาติดต่อผู้จัดเรื่องกู้คืนบัญชีก่อน",
                            )
                          : t(
                              "You can sign in again with your email. Saved trip data will be removed from this device.",
                              "คุณลงชื่อเข้าใช้ด้วยอีเมลได้อีกครั้ง ข้อมูลทริปที่บันทึกไว้จะถูกลบจากอุปกรณ์นี้",
                            )}
                      </p>
                      {pendingCount > 0 && (
                        <p>
                          {t(
                            `${pendingCount} saved action(s) will be removed from this device. Some may already have reached the server. Reconnect and check the trip before signing out.`,
                            `มี ${pendingCount} รายการที่บันทึกไว้และจะถูกลบ บางรายการอาจถึงเซิร์ฟเวอร์แล้ว กรุณาเชื่อมต่อและตรวจสอบทริปก่อนออกจากระบบ`,
                          )}
                        </p>
                      )}
                      <Button disabled={busy} onClick={() => void signOut()}>
                        {t("Confirm sign out", "ยืนยันการออกจากระบบ")}
                      </Button>
                      <Button onClick={() => setSignOutWarning(false)}>
                        {t("Keep signed in", "ใช้บัญชีนี้ต่อ")}
                      </Button>
                    </section>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </header>
      <PwaUpdate thai={thai.value} />
      <main ref={appMain}>
        <h1>{t("Your trips, together.", "เดินทางไปด้วยกัน")}</h1>
        {error && <p role="alert">{error}</p>}
        {(trips.error || members.error || requests.error || invites.error) && (
          <p role="alert">
            {t(
              "Unable to refresh. Check your connection.",
              "ไม่สามารถโหลดข้อมูล กรุณาตรวจสอบอินเทอร์เน็ต",
            )}
          </p>
        )}
        {route.startsWith("#/join/") ? (
          <section>
            <h2 class="editor-panel" ref={joinHeading} tabIndex={-1}>
              {t("Join a trip", "เข้าร่วมทริป")}
            </h2>
            <p>
              {t(
                "The organizer must approve your request before you can access the trip.",
                "ผู้จัดทริปต้องอนุมัติคำขอก่อนที่คุณจะเข้าถึงทริปได้",
              )}
            </p>
            <form
              class="guest-entry-form"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await redeem(route.slice(7), f.get("name"));
                  history.replaceState(null, "", location.pathname + "#");
                  setRoute("#");
                });
              }}
            >
              <label>
                {t("Your name", "ชื่อของคุณ")}
                <input name="name" required maxLength={80} />
              </label>
              <label class="guest-entry-acknowledgement">
                <input type="checkbox" required />
                {t(
                  "I am using the browser or installed app I will keep using.",
                  "ฉันกำลังใช้แอปหรือเบราว์เซอร์ที่จะใช้ต่อไป",
                )}
              </label>
              <Button type="submit" disabled={busy}>
                {t("Request to join", "ขอเข้าร่วม")}
              </Button>
            </form>
            <details class="guest-install-help">
              <summary>
                {t("Install Roam (optional)", "ติดตั้ง Roam (ไม่บังคับ)")}
              </summary>
              <p>
                {t(
                  "If you plan to use Roam from your Home Screen, open this invitation in the installed app before requesting access. Sessions may differ between the app and browser.",
                  "หากจะใช้ Roam จากหน้าจอโฮม ให้เปิดคำเชิญในแอปที่ติดตั้งแล้วค่อยขอเข้าร่วม เพราะแอปกับเบราว์เซอร์อาจใช้บัญชีคนละบัญชี",
                )}
              </p>
            </details>
          </section>
        ) : null}
        {!selectedId &&
          (!uid || user?.is_anonymous) &&
          !route.startsWith("#/join/") && (
            <section>
              <h2>{t("Join a trip", "เข้าร่วมทริป")}</h2>
              <p>
                {t(
                  "Ask your organizer for an invitation link or QR code. If you lost your session, ask them to verify your identity before rejoining.",
                  "ขอลิงก์คำเชิญหรือรหัส QR จากผู้จัดทริป หากข้อมูลบัญชีสูญหาย ให้ผู้จัดยืนยันตัวตนก่อนเข้าร่วมใหม่",
                )}
              </p>
              <form
                class="guest-entry-form"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  const input =
                    event.currentTarget.elements.namedItem("invitation-link");
                  if (!(input instanceof HTMLInputElement)) return;
                  const value = input.value.trim();
                  const code = value.replace(/[\s-]/g, "").toLowerCase();
                  if (/^[a-f0-9]{16}$/.test(code)) {
                    setInvitationError(null);
                    focusJoinAfterPaste.current = true;
                    location.hash = "#/join/" + code;
                    return;
                  }
                  try {
                    const url = new URL(value);
                    if (
                      url.protocol === location.protocol &&
                      url.origin === location.origin &&
                      /^#\/join\/(?:[a-f0-9]{16}|[a-f0-9]{64})$/.test(url.hash)
                    ) {
                      setInvitationError(null);
                      focusJoinAfterPaste.current = true;
                      location.hash = url.hash;
                      return;
                    }
                  } catch {
                    // A malformed URL receives the same correction guidance.
                  }
                  setInvitationError(value ? "invalid" : "empty");
                  input.focus();
                }}
              >
                <label>
                  {t("Invitation code or link", "รหัสหรือลิงก์คำเชิญ")}
                  <input
                    id="invitation-link"
                    type="text"
                    autoCapitalize="none"
                    spellcheck={false}
                    required
                    enterKeyHint="go"
                    aria-invalid={invitationError ? true : undefined}
                    aria-describedby={
                      invitationError ? "invitation-link-error" : undefined
                    }
                    onInput={() => setInvitationError(null)}
                  />
                </label>
                {invitationError && (
                  <p id="invitation-link-error" role="alert">
                    {invitationError === "empty"
                      ? t(
                          "Enter the invitation code or link from your organizer.",
                          "กรุณากรอกรหัสหรือลิงก์คำเชิญจากผู้จัดทริป",
                        )
                      : t(
                          "Check the invitation code or use the full link for this Roam site.",
                          "ตรวจสอบรหัสคำเชิญ หรือใช้ลิงก์คำเชิญแบบเต็มของ Roam",
                        )}
                  </p>
                )}
                <Button type="submit">
                  {t("Open invitation", "เปิดคำเชิญ")}
                </Button>
              </form>
            </section>
          )}
        {!selectedId &&
          !canCreateTrip(user) &&
          !route.startsWith("#/join/") && (
            <EmailAccess
              key={uid ?? "signed-out"}
              guest={!!user?.is_anonymous}
              thai={thai.value}
              onVerified={() => {
                void db.auth.getSession().then(({ data }) => {
                  setUser(data.session?.user ?? null);
                  setUid(data.session?.user.id);
                });
              }}
            />
          )}
        {!selectedId && canCreateTrip(user) && (
          <details
            class="create-trip"
            onToggle={(event) => {
              if (event.currentTarget.open)
                revealEditor(event.currentTarget.querySelector("form"));
            }}
          >
            <summary>{t("Create a trip", "สร้างทริป")}</summary>
            <form
              class="editor-panel"
              tabIndex={-1}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  if (!canCreateTrip(user))
                    throw new Error("Email verification required");
                  const createdTrip = await rpc("create_trip", {
                    p_title: f.get("title"),
                    p_name: f.get("name"),
                    p_timezone: "UTC",
                    p_currency: f.get("currency"),
                    p_start: f.get("start"),
                    p_end: f.get("end"),
                  });
                  selectTrip(createdTrip);
                });
              }}
            >
              <h2>{t("Create a trip", "สร้างทริป")}</h2>
              {[
                ["title", t("Trip name", "ชื่อทริป"), "text"],
                ["name", t("Your name", "ชื่อของคุณ"), "text"],
                ["start", t("Start date", "วันเริ่มทริป"), "date"],
                ["end", t("End date", "วันสิ้นสุดทริป"), "date"],
                [
                  "currency",
                  t("Currency (e.g. THB)", "สกุลเงิน เช่น THB"),
                  "text",
                ],
              ].map(([name, label, type]) => (
                <label key={name}>
                  {label}
                  <input
                    name={name}
                    type={type === "date" ? "date" : "text"}
                    required
                    maxLength={name === "currency" ? 3 : 80}
                    defaultValue={name === "currency" ? "THB" : undefined}
                  />
                </label>
              ))}
              <Button disabled={busy}>{t("Create trip", "สร้างทริป")}</Button>
            </form>
          </details>
        )}
        {uid && (
          <Button onClick={() => void qc.invalidateQueries()}>
            {t("Refresh status", "ตรวจสอบสถานะล่าสุด")}
          </Button>
        )}
        {requests.data
          ?.filter((r) => r.auth_user_id === uid)
          .map((r) => (
            <p role="status" key={r.id}>
              {t("Join request", "คำขอเข้าร่วม")}:{" "}
              {r.status === "pending"
                ? t("Waiting for organizer approval", "รอผู้จัดอนุมัติ")
                : r.status === "approved"
                  ? t("Approved", "อนุมัติแล้ว")
                  : t(
                      "Declined — contact organizer",
                      "คำขอถูกปฏิเสธ กรุณาติดต่อผู้จัดทริป",
                    )}
            </p>
          ))}
        {uid && trips.data && (
          <section
            class="trip-dashboard"
            aria-label={t("Choose a trip", "เลือกทริป")}
          >
            <h2>{t("Your trips", "ทริปของคุณ")}</h2>
            {trips.data.length === 0 && (
              <p>
                {t(
                  "No approved trips yet. Create a trip or join with an invitation.",
                  "คุณยังไม่มีทริปที่เข้าร่วมแล้ว สร้างทริปใหม่หรือใช้คำเชิญเพื่อเข้าร่วม",
                )}
              </p>
            )}
            <div class="trip-cards">
              {trips.data.map((trip) => (
                <Button
                  type="button"
                  key={trip.id}
                  aria-pressed={selectedId === trip.id}
                  onClick={() => selectTrip(trip.id)}
                >
                  <strong>{trip.title}</strong>
                  <span>
                    {trip.start_date} — {trip.end_date}
                  </span>
                  <small>
                    {trip.status === "archived"
                      ? t("Archived", "เก็บถาวรแล้ว")
                      : t("Active", "ใช้งานอยู่")}
                  </small>
                </Button>
              ))}
            </div>
          </section>
        )}
        {trips.data
          ?.filter((trip) => trip.id === selectedId)
          .map((trip) => {
            const org = members.data?.some(
              (m) =>
                m.trip_id === trip.id &&
                m.user_id === uid &&
                m.role === "organizer" &&
                m.status === "approved",
            );
            return (
              <section class="trip-workspace" key={trip.id}>
                <h2>{trip.title}</h2>
                <p>
                  {trip.start_date} — {trip.end_date} · {trip.base_currency} ·{" "}
                  {t(
                    trip.status,
                    trip.status === "archived" ? "เก็บถาวรแล้ว" : "ใช้งานอยู่",
                  )}
                </p>
                {uid && members.data && (
                  <TripActivity
                    key={trip.id}
                    trip={trip}
                    members={members.data}
                    uid={uid}
                    thai={thai.value}
                    tripSettings={
                      <>
                        <h3>{t("Travelers", "ผู้เดินทาง")}</h3>
                        {members.data
                          ?.filter(
                            (m) =>
                              m.trip_id === trip.id && m.status === "approved",
                          )
                          .map((m) => (
                            <div class="trip-member-row" key={m.id}>
                              <span>
                                {m.display_name}
                                {m.role !== "organizer" && (
                                  <small class="member-permission">
                                    {" "}
                                    ·{" "}
                                    {m.can_edit_plan
                                      ? t(
                                          "Can edit itinerary",
                                          "แก้ไขแผนการเดินทางได้",
                                        )
                                      : t("Read only", "ดูได้เท่านั้น")}
                                  </small>
                                )}
                              </span>
                              {org &&
                                m.role !== "organizer" &&
                                m.user_id &&
                                !m.managed_by_user_id && (
                                  <Button
                                    type="button"
                                    appearance="secondary"
                                    disabled={busy}
                                    onClick={() =>
                                      void run(async () => {
                                        await rpc(
                                          "set_member_plan_permission",
                                          {
                                            p_member_id: m.id,
                                            p_can_edit: !m.can_edit_plan,
                                          },
                                        );
                                      })
                                    }
                                  >
                                    {m.can_edit_plan
                                      ? t("Remove editing", "ยกเลิกสิทธิ์แก้ไข")
                                      : t("Grant editing", "ให้สิทธิ์แก้ไข")}
                                  </Button>
                                )}
                              {org && m.role !== "organizer" && (
                                <Button
                                  disabled={busy}
                                  onClick={() =>
                                    void run(async () => {
                                      await rpc("remove_member", {
                                        p_member_id: m.id,
                                      });
                                    })
                                  }
                                >
                                  {t("Remove", "นำออก")}
                                </Button>
                              )}
                            </div>
                          ))}
                        {org && (
                          <>
                            <details class="trip-settings">
                              <summary>
                                {t(
                                  "Trip settings and access",
                                  "ตั้งค่าทริปและการเข้าถึง",
                                )}
                              </summary>
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  if (!inviteCutoff) return;
                                  void run(async () => {
                                    const [invite] = await rpc(
                                      "create_reusable_invite_until",
                                      {
                                        p_trip_id: trip.id,
                                        p_expires_at:
                                          inviteCutoff.toISOString(),
                                      },
                                    );
                                    const link =
                                      location.origin +
                                      location.pathname +
                                      "#/join/" +
                                      invite.token;
                                    setQr({
                                      image: await QRCode.toDataURL(link),
                                      code: invite.token
                                        .toUpperCase()
                                        .match(/.{4}/g)!
                                        .join("-"),
                                      link,
                                    });
                                  });
                                }}
                              >
                                <label>
                                  {t(
                                    "Invitation expiry date",
                                    "วันหมดอายุคำเชิญ",
                                  )}
                                  <input
                                    name="expiry"
                                    type="date"
                                    required
                                    value={inviteExpiryDate}
                                    onInput={(event) =>
                                      setInviteExpiryDate(
                                        event.currentTarget.value,
                                      )
                                    }
                                  />
                                </label>
                                <p>
                                  {inviteCutoff && (
                                    <>
                                      {t("Expires on", "หมดอายุวันที่")}{" "}
                                      {new Intl.DateTimeFormat(
                                        thai.value ? "th-TH" : "en",
                                        {
                                          year: "numeric",
                                          month: "short",
                                          day: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                          timeZoneName: "longOffset",
                                        },
                                      ).format(inviteCutoff)}
                                      .{" "}
                                    </>
                                  )}
                                  {t(
                                    "A new invitation replaces the previous reusable invitation.",
                                    "คำเชิญใหม่จะแทนที่คำเชิญเดิมที่ใช้ได้หลายครั้ง",
                                  )}
                                </p>
                                <Button
                                  disabled={busy || trip.status !== "active"}
                                >
                                  {t("Create invitation", "สร้างคำเชิญ")}
                                </Button>
                              </form>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const name = new FormData(
                                    e.currentTarget,
                                  ).get("name");
                                  void run(async () => {
                                    await rpc("add_managed_member", {
                                      p_trip_id: trip.id,
                                      p_name: name,
                                    });
                                  });
                                }}
                              >
                                <label>
                                  {t(
                                    "Traveler without a device",
                                    "ผู้เดินทางที่ไม่มีอุปกรณ์",
                                  )}
                                  <input name="name" required maxLength={80} />
                                </label>
                                <Button disabled={busy}>
                                  {t("Add traveler", "เพิ่มผู้เดินทาง")}
                                </Button>
                              </form>
                              {uid && (
                                <Button
                                  onClick={() => void qc.invalidateQueries()}
                                >
                                  {t("Refresh status", "ตรวจสอบสถานะล่าสุด")}
                                </Button>
                              )}
                              {requests.data
                                ?.filter(
                                  (r) =>
                                    r.trip_id === trip.id &&
                                    r.status === "pending",
                                )
                                .map((r) => (
                                  <div key={r.id}>
                                    <p>{r.requested_display_name}</p>
                                    {[true, false].map((approve) => (
                                      <Button
                                        disabled={busy}
                                        onClick={() =>
                                          void run(async () => {
                                            await rpc("decide_join", {
                                              p_request_id: r.id,
                                              p_approve: approve,
                                            });
                                          })
                                        }
                                      >
                                        {approve
                                          ? t("Approve", "อนุมัติ")
                                          : t("Decline", "ปฏิเสธ")}
                                      </Button>
                                    ))}
                                  </div>
                                ))}
                              {invites.data
                                ?.filter((i) => i.trip_id === trip.id)
                                .map((i) => (
                                  <p key={i.id}>
                                    {i.uses_count}
                                    {i.max_uses == null
                                      ? ""
                                      : "/" + i.max_uses}{" "}
                                    · {i.expires_at}
                                    {i.revoked_at ? (
                                      <Button
                                        disabled={busy}
                                        onClick={() => {
                                          if (
                                            !window.confirm(
                                              t(
                                                "Delete this revoked invitation? Its history will be retained.",
                                                "ต้องการลบคำเชิญที่ยกเลิกแล้วหรือไม่ ประวัติจะยังคงอยู่",
                                              ),
                                            )
                                          )
                                            return;
                                          void run(async () => {
                                            await rpc("delete_revoked_invite", {
                                              p_invite_id: i.id,
                                            });
                                          });
                                        }}
                                      >
                                        {t(
                                          "Delete revoked invitation",
                                          "ลบคำเชิญที่ยกเลิกแล้ว",
                                        )}
                                      </Button>
                                    ) : (
                                      <Button
                                        disabled={busy}
                                        onClick={() =>
                                          void run(async () => {
                                            await rpc("revoke_invite", {
                                              p_invite_id: i.id,
                                            });
                                            setQr(null);
                                          })
                                        }
                                      >
                                        {t("Revoke", "ยกเลิก")}
                                      </Button>
                                    )}
                                  </p>
                                ))}
                              <Button
                                disabled={busy || trip.status === "archived"}
                                onClick={() =>
                                  void run(async () => {
                                    await rpc("archive_trip", {
                                      p_trip_id: trip.id,
                                    });
                                    setQr(null);
                                  })
                                }
                              >
                                {t("Archive trip", "เก็บทริปถาวร")}
                              </Button>
                              {trip.status === "archived" && (
                                <Button
                                  disabled={busy}
                                  onClick={() =>
                                    void run(async () => {
                                      await rpc("restore_trip", {
                                        p_trip_id: trip.id,
                                      });
                                    })
                                  }
                                >
                                  {t("Restore trip", "กู้คืนทริป")}
                                </Button>
                              )}
                            </details>
                            <GuestRecovery
                              tripId={trip.id}
                              requests={requests.data ?? []}
                              members={members.data ?? []}
                              invites={invites.data ?? []}
                              busy={busy}
                              thai={thai.value}
                              onAction={(name, args) =>
                                void run(async () => {
                                  await rpc(name, args);
                                })
                              }
                            />
                            <details class="danger-zone">
                              <summary>{t("Delete trip", "ลบทริป")}</summary>
                              <p>
                                {t(
                                  "This permanently removes the trip, its itinerary, expenses, receipt photos, members, and stay details. Type the trip title to confirm.",
                                  "การดำเนินการนี้จะลบทริป กำหนดการ ค่าใช้จ่าย รูปใบเสร็จ สมาชิก และข้อมูลที่พักถาวร กรุณาพิมพ์ชื่อทริปเพื่อยืนยัน",
                                )}
                              </p>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const f = new FormData(e.currentTarget);
                                  if (f.get("confirmTitle") !== trip.title) {
                                    setError(
                                      t(
                                        "The title does not match.",
                                        "ชื่อทริปไม่ตรงกัน",
                                      ),
                                    );
                                    return;
                                  }
                                  void run(async () => {
                                    await removeTripReceiptFiles(trip.id);
                                    await rpc("delete_trip", {
                                      p_trip_id: trip.id,
                                      p_confirmation_title:
                                        f.get("confirmTitle"),
                                    });
                                    if (uid) await clearTripData(trip.id, uid);
                                    selectTrip(null);
                                  });
                                }}
                              >
                                <label>
                                  {t("Trip title", "ชื่อทริป")}
                                  <input
                                    name="confirmTitle"
                                    required
                                    autoComplete="off"
                                  />
                                </label>
                                <Button class="danger-button" disabled={busy}>
                                  {t("Delete permanently", "ลบถาวร")}
                                </Button>
                              </form>
                            </details>
                          </>
                        )}
                      </>
                    }
                  />
                )}
              </section>
            );
          })}
        {qr && (
          <section
            ref={qrPanel}
            class="editor-panel"
            aria-label={t("Trip invitation", "คำเชิญเข้าร่วมทริป")}
          >
            <h2>{t("Scan to request access", "สแกนเพื่อขอเข้าร่วม")}</h2>
            <img
              src={qr.image}
              width="280"
              height="280"
              alt={t(
                "Trip invitation QR code",
                "คิวอาร์โค้ดสำหรับเข้าร่วมทริป",
              )}
            />
            <p>
              {t("Invitation code", "รหัสคำเชิญ")} <strong>{qr.code}</strong>
            </p>
            <label>
              {t("Invitation link", "ลิงก์คำเชิญ")}
              <input
                readOnly
                value={qr.link}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
            <Button onClick={() => setQr(null)}>{t("Close", "ปิด")}</Button>
          </section>
        )}
      </main>
    </>
  );
}
