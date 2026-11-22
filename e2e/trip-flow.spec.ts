import { readFile } from "node:fs/promises";
import { expect, test, type Locator } from "@playwright/test";
import sharp from "sharp";

async function chooseOverflowAction(
  record: Locator,
  name: string,
  action: string,
) {
  await record.getByRole("button", { name: `Options for ${name}` }).click();
  await record.getByRole("menuitem", { name: action }).click();
}

async function chooseItineraryAction(plan: Locator, action: string) {
  await plan.getByRole("button", { name: "Edit itinerary" }).click();
  await plan.getByRole("menuitem", { name: action }).click();
}

const uid = "11111111-1111-4111-8111-111111111111";
const tripId = "22222222-2222-4222-8222-222222222222";
const alice = "33333333-3333-4333-8333-333333333333";
const bob = "44444444-4444-4444-8444-444444444444";
const token = "fixture-access-token";
type FixtureRpcArgs = {
  [key: string]: unknown;
  p_trip_id: string;
  p_title?: string;
  p_starts_at?: string | null;
  p_address?: string | null;
  p_meeting_info?: string | null;
  p_notes?: string | null;
  p_transport_mode?: string | null;
  p_position?: number;
  p_plan_date?: string | null;
  p_start_date?: string;
  p_end_date?: string;
  p_city?: string;
  p_timezone?: string;
  p_replace?: boolean;
  p_expected_versions?: Record<string, number>;
  p_check_in_date?: string;
  p_check_out_date?: string;
  p_name?: string;
  p_phone?: string | null;
  p_stay_id?: string | null;
  p_expected_version?: number | null;
  p_payer_member_id?: string;
  p_amount_minor?: string;
  p_currency?: string;
  p_operation_id?: string;
  p_description?: string;
  p_expense_id?: string;
  p_expense_date?: string | null;
  p_expense_time?: string | null;
  p_shares?: { member_id: string; owed_minor: string }[];
  p_member_id?: string;
  p_can_edit?: boolean;
  p_item_id?: string;
  p_activity_tag?: string | null;
};

async function installFixture(
  page: import("@playwright/test").Page,
  options: {
    guest?: boolean;
    currency?: string;
    participant?: boolean;
    editor?: boolean;
    linkedMember?: boolean;
    daily?: boolean;
    longHotel?: boolean;
    failReceiptUploadOnce?: boolean;
    seedReceipt?: boolean;
    failReceiptCleanup?: boolean;
    invites?: Record<string, unknown>[];
  } = {},
) {
  const fixtureUid = options.participant || options.editor ? bob : uid;
  const trip = {
    id: tripId,
    title: "Bangkok Weekend",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    timezone: "Asia/Bangkok",
    base_currency: options.currency ?? "THB",
    status: "active",
  };
  const emergencyCards = [
    {
      trip_id: tripId,
      hotel_name: "River House",
      hotel_address: "1 River Road",
      hotel_phone: "+66 2 123 4567",
      emergency_contact_name: "Somchai",
      emergency_contact_phone: "+66 81 234 5678",
    },
  ];
  const trips = [trip];
  let invites = options.invites ?? [];
  const members = [
    {
      id: alice,
      trip_id: tripId,
      user_id: uid,
      display_name: "Mali",
      role: "organizer",
      status: "approved",
      can_edit_plan: false,
    },
    {
      id: bob,
      trip_id: tripId,
      user_id:
        options.participant || options.editor || options.linkedMember
          ? bob
          : null,
      display_name: "Niran",
      role: "member",
      status: "approved",
      can_edit_plan: !!options.editor,
    },
  ];
  let itinerary: Record<string, unknown>[] = [
    {
      id: "stop-1",
      trip_id: tripId,
      title: "Wat Arun",
      starts_at: "2026-11-02T02:00:00Z",
      address: "Bangkok, Thailand",
      latitude: 13.7437,
      longitude: 100.4889,
      meeting_info: "Meet at the river pier",
      notes: "Bring water",
      transport_mode: "boat",
      position: 0,
      version: 1,
      plan_date: "2026-11-02",
    },
    {
      id: "stop-past",
      trip_id: tripId,
      title: "Old Town Walk",
      starts_at: "2026-11-01T04:00:00Z",
      address: "Bangkok, Thailand",
      position: 1,
      version: 1,
      plan_date: "2026-11-01",
    },
    {
      id: "stop-next",
      trip_id: tripId,
      title: "Chatuchak Market",
      starts_at: "2026-11-02T05:00:00Z",
      address: "Kamphaeng Phet 2 Road",
      position: 2,
      version: 1,
      plan_date: "2026-11-02",
    },
    ...(options.daily
      ? [
          {
            id: "stop-future",
            trip_id: tripId,
            title: "Night Bazaar",
            starts_at: "2026-11-04T02:00:00Z",
            address: "Chiang Mai, Thailand",
            position: 3,
            version: 1,
            plan_date: "2026-11-04",
          },
        ]
      : []),
  ];
  let nights: Record<string, unknown>[] = [
    {
      trip_id: tripId,
      night_date: "2026-11-01",
      city: "Bangkok",
      transport_mode: "boat",
      version: 1,
    },
    {
      trip_id: tripId,
      night_date: "2026-11-02",
      city: "Bangkok",
      transport_mode: "boat",
      version: 1,
    },
    ...(options.daily
      ? [
          {
            trip_id: tripId,
            night_date: "2026-11-03",
            city: "Chiang Mai",
            transport_mode: "train",
            version: 1,
          },
          {
            trip_id: tripId,
            night_date: "2026-11-04",
            city: "Chiang Mai",
            transport_mode: "train",
            version: 1,
          },
        ]
      : []),
  ];
  let stays: Record<string, unknown>[] = [
    {
      id: "stay-1",
      trip_id: tripId,
      check_in_date: "2026-11-01",
      check_out_date: "2026-11-03",
      name: options.longHotel
        ? "Traditional Kyoto Machiya near Nishiki Market"
        : "River House",
      address: options.longHotel
        ? "123 Shijo-dori, Nakagyo Ward, Kyoto, Kyoto Prefecture 604-8125, Japan"
        : "1 River Road",
      phone: "+66 2 123 4567",
      version: 1,
    },
    ...(options.daily
      ? [
          {
            id: "stay-2",
            trip_id: tripId,
            check_in_date: "2026-11-03",
            check_out_date: "2026-11-05",
            name: "Doi Hotel",
            address: "2 Mountain Road",
            phone: "+66 53 555 123",
            version: 1,
          },
        ]
      : []),
  ];
  let expenses: Record<string, unknown>[] = [
    {
      id: "expense-1",
      trip_id: tripId,
      paid_by_member_id: alice,
      amount_minor: 900,
      currency: trip.base_currency,
      description: "Airport taxi",
      created_at: "2026-10-27T10:00:00Z",
      expense_date: null,
      expense_time: null,
      version: 1,
      expense_shares: [
        { trip_member_id: alice, owed_minor: 450 },
        { trip_member_id: bob, owed_minor: 450 },
      ],
    },
  ];
  let receipts: Record<string, unknown>[] = options.seedReceipt
    ? [
        {
          id: "receipt-seeded",
          trip_id: tripId,
          expense_id: "expense-1",
          uploaded_by: uid,
          object_path: `${tripId}/expense-1/receipt-seeded.jpg`,
          byte_size: 128,
          status: "ready",
          created_at: "2026-11-02T17:30:00.000Z",
        },
      ]
    : [];
  let uploadedReceipt: Buffer | undefined;
  let failReceiptUploadOnce = !!options.failReceiptUploadOnce;
  let failReceiptCleanup = !!options.failReceiptCleanup;
  let receiptInsertCount = 0;
  const receiptStorageEvents: string[] = [];
  const receiptDownloads: { path: string; authorization: string }[] = [];
  const lifecycleEvents: string[] = [];
  let savedExpense: FixtureRpcArgs | undefined;
  let failExpenseOnce = false;
  let savedCorrection: FixtureRpcArgs | undefined;
  const rpcCalls: { fn: string; args: FixtureRpcArgs }[] = [];
  const restRequests: { method: string; table: string }[] = [];

  await page.addInitScript(
    ({ uid, token, guest }) => {
      const session = {
        access_token: token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "fixture-refresh",
        user: {
          id: uid,
          aud: "authenticated",
          role: "authenticated",
          email: guest ? undefined : "fixture@example.test",
          email_confirmed_at: guest ? undefined : "2026-01-01T00:00:00Z",
          is_anonymous: guest,
          app_metadata: guest
            ? { provider: "anonymous", providers: ["anonymous"] }
            : { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      };
      localStorage.setItem("sb-127-auth-token", JSON.stringify(session));
    },
    { uid: fixtureUid, token, guest: !!options.guest },
  );

  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop() ?? "";
    restRequests.push({ method: route.request().method(), table });
    let data: unknown[] = [];
    if (table === "trips") data = trips;
    if (table === "trip_members") data = members;
    if (table === "trip_join_requests") data = [];
    if (table === "trip_invites") data = invites;
    if (table === "itinerary_items") data = itinerary;
    if (table === "nightly_destinations") data = nights;
    if (table === "stays") data = stays;
    if (table === "expenses") {
      data = expenses;
      if (url.searchParams.get("deleted_at") === "is.null")
        data = expenses.filter((expense) => expense.deleted_at == null);
    }
    if (table === "expense_receipts") data = receipts;
    if (table === "emergency_cards") data = emergencyCards;
    if (table === "expense_receipts") {
      const method = route.request().method();
      const params = url.searchParams;
      const filterValue = (key: string) =>
        (params.get(key) ?? "").replace(/^eq\./, "").replaceAll('"', "");
      if (method === "POST") {
        receiptInsertCount += 1;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const receipt = {
          ...body,
          id: "receipt-added",
          object_path: `${tripId}/${String(body.expense_id)}/receipt-added.jpg`,
          status: "pending",
          created_at: "2026-11-02T17:30:00.000Z",
        };
        receipts.push(receipt);
        data = [receipt];
      } else if (method === "PATCH") {
        const receiptId = filterValue("id");
        const body = route.request().postDataJSON() as Record<string, unknown>;
        receipts = receipts.map((receipt) =>
          receipt.id === receiptId ? { ...receipt, ...body } : receipt,
        );
        data = receipts.filter((receipt) => receipt.id === receiptId);
      } else if (method === "DELETE") {
        const receiptId = filterValue("id");
        receipts = receipts.filter((receipt) => receipt.id !== receiptId);
        data = [];
      } else {
        const expenseId = filterValue("expense_id");
        const requestedTrip = filterValue("trip_id");
        data = receipts.filter(
          (receipt) =>
            (!expenseId || receipt.expense_id === expenseId) &&
            (!requestedTrip || receipt.trip_id === requestedTrip),
        );
        if (
          params.has("select") &&
          (params.get("select") ?? "").includes("expenses!inner")
        ) {
          data = data
            .filter((receipt) => {
              const linked = expenses.find(
                (expense) => expense.id === receipt.expense_id,
              );
              return !!linked && linked.deleted_at != null;
            })
            .map((receipt) => ({
              ...receipt,
              expenses: expenses.find(
                (expense) => expense.id === receipt.expense_id,
              ),
            }));
        }
      }
    }
    const from = Number(route.request().headers()["range"]?.split("-")[0] ?? 0);
    const to = Number(
      route.request().headers()["range"]?.split("-")[1] ?? data.length - 1,
    );
    const single =
      ["POST", "PATCH"].includes(route.request().method()) &&
      table === "expense_receipts";
    await route.fulfill({
      status: 200,
      contentType: single
        ? "application/vnd.pgrst.object+json"
        : "application/json",
      headers: {
        "content-range": `${from}-${Math.min(to, data.length - 1)}/${data.length}`,
      },
      body: JSON.stringify(
        single ? (data[0] ?? null) : data.slice(from, to + 1),
      ),
    });
  });

  await page.route("**/storage/v1/object/**", async (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === "POST" &&
      url.pathname.includes("/expense-receipts/")
    ) {
      const contentType = route.request().headers()["content-type"] ?? "";
      const envelope = route.request().postDataBuffer();
      if (failReceiptUploadOnce) {
        failReceiptUploadOnce = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "temporary upload failure" }),
        });
        return;
      }
      if (envelope && contentType.includes("multipart/form-data")) {
        const form = await new Response(envelope, {
          headers: { "content-type": contentType },
        }).formData();
        const file = [...form.values()].find((value) => value instanceof File);
        uploadedReceipt = file
          ? Buffer.from(await file.arrayBuffer())
          : undefined;
      } else {
        uploadedReceipt = envelope ?? undefined;
      }
      receiptStorageEvents.push(`upload:${url.pathname}`);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ Key: url.pathname }),
      });
      return;
    }
    if (
      route.request().method() === "GET" &&
      url.pathname.includes("/expense-receipts/")
    ) {
      receiptStorageEvents.push(`download:${url.pathname}`);
      receiptDownloads.push({
        path: url.pathname,
        authorization: route.request().headers().authorization ?? "",
      });
      await route.fulfill({
        status: 200,
        contentType: "image/jpeg",
        body: uploadedReceipt ?? Buffer.alloc(0),
      });
      return;
    }
    if (
      route.request().method() === "DELETE" &&
      url.pathname.endsWith("/expense-receipts")
    ) {
      const body = route.request().postDataJSON() as { prefixes?: string[] };
      receiptStorageEvents.push(`remove:${body.prefixes?.join(",") ?? ""}`);
      if (failReceiptCleanup) {
        failReceiptCleanup = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "temporary cleanup failure" }),
        });
        return;
      }
      if (
        body.prefixes?.some((prefix) =>
          receipts.some((receipt) => receipt.object_path === prefix),
        )
      ) {
        uploadedReceipt = undefined;
        lifecycleEvents.push("storage_remove");
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "[]",
      });
      return;
    }
    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "not found" }),
    });
  });

  await page.route("**/auth/v1/logout**", async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/rest/v1/rpc/**", async (route) => {
    const fn = new URL(route.request().url()).pathname.split("/").pop();
    const args = route.request().postDataJSON() as FixtureRpcArgs;
    rpcCalls.push({ fn: fn ?? "", args });
    if (fn === "create_expense" && failExpenseOnce) {
      failExpenseOnce = false;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "temporary server error" }),
      });
      return;
    }
    let result: unknown = null;
    if (fn === "upsert_tagged_itinerary_item") {
      const prior = args.p_item_id
        ? itinerary.find((candidate) => candidate.id === args.p_item_id)
        : undefined;
      const item = {
        ...prior,
        id: prior?.id ?? "stop-added",
        trip_id: tripId,
        title: args.p_title,
        starts_at: args.p_starts_at,
        address: args.p_address,
        meeting_info: args.p_meeting_info,
        notes: args.p_notes,
        activity_tag: args.p_activity_tag,
        transport_mode: args.p_transport_mode,
        position: args.p_position,
        version: Number(prior?.version ?? 0) + 1,
        plan_date: args.p_plan_date ?? null,
      };
      itinerary = prior
        ? itinerary.map((candidate) =>
            candidate.id === prior.id ? item : candidate,
          )
        : [...itinerary, item];
      result = item;
    } else if (fn === "set_nightly_destinations") {
      const from = String(args.p_start_date);
      const to = String(args.p_end_date);
      const dates: string[] = [];
      for (
        let d = new Date(`${from}T00:00:00Z`);
        d <= new Date(`${to}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1)
      )
        dates.push(d.toISOString().slice(0, 10));
      if (args.p_replace === true)
        nights = nights.filter((n) => !dates.includes(String(n.night_date)));
      nights = [
        ...nights,
        ...dates.map((night_date) => ({
          trip_id: tripId,
          night_date,
          city: args.p_city,
          transport_mode: args.p_transport_mode,
          version: 1,
        })),
      ];
      result = nights.filter((n) => dates.includes(String(n.night_date)));
    } else if (fn === "upsert_stay") {
      const prior = args.p_stay_id
        ? stays.find((candidate) => candidate.id === args.p_stay_id)
        : undefined;
      const stay = {
        ...prior,
        id: prior?.id ?? "stay-added",
        trip_id: tripId,
        check_in_date: args.p_check_in_date,
        check_out_date: args.p_check_out_date,
        name: args.p_name,
        address: args.p_address,
        phone: args.p_phone,
        version: Number(prior?.version ?? 0) + 1,
      };
      stays = prior
        ? stays.map((candidate) =>
            candidate.id === prior.id ? stay : candidate,
          )
        : [...stays, stay];
      result = stay;
    } else if (fn === "create_expense") {
      savedExpense = args;
      const exp = {
        id: "expense-added",
        trip_id: tripId,
        paid_by_member_id: args.p_payer_member_id,
        amount_minor: args.p_amount_minor,
        currency: trip.base_currency,
        description: args.p_description,
        created_at: new Date().toISOString(),
        expense_date: args.p_expense_date,
        expense_time: args.p_expense_time,
        version: 1,
        expense_shares:
          args.p_shares?.map((share) => ({
            trip_member_id: share.member_id,
            owed_minor: share.owed_minor,
          })) ?? [],
      };
      expenses = [exp, ...expenses];
      result = exp;
    } else if (fn === "correct_expense") {
      savedCorrection = args;
      expenses = expenses.map((expense) =>
        expense.id === args.p_expense_id
          ? {
              ...expense,
              description: args.p_description,
              amount_minor: args.p_amount_minor,
              paid_by_member_id: args.p_payer_member_id,
              expense_date: args.p_expense_date,
              expense_time: args.p_expense_time,
              version: Number(expense.version ?? 1) + 1,
            }
          : expense,
      );
      result =
        expenses.find((expense) => expense.id === args.p_expense_id) ?? null;
    } else if (fn === "delete_expense") {
      lifecycleEvents.push("delete_expense");
      const target = expenses.find(
        (expense) => expense.id === args.p_expense_id,
      );
      if (target) {
        target.deleted_at = new Date().toISOString();
        target.deleted_by = fixtureUid;
      }
      result = target ?? null;
    } else if (fn === "archive_trip" || fn === "restore_trip") {
      trip.status = fn === "archive_trip" ? "archived" : "active";
    } else if (fn === "set_trip_timezone") {
      trip.timezone = String(args.p_timezone);
    } else if (fn === "set_member_plan_permission") {
      const member = members.find(
        (candidate) => candidate.id === args.p_member_id,
      );
      if (member) member.can_edit_plan = args.p_can_edit === true;
      result = member ?? null;
    } else if (fn === "create_reusable_invite_until") {
      result = [{ token: "1234567890abcdef" }];
    } else if (fn === "revoke_invite") {
      invites = invites.map((invite) =>
        invite.id === args.p_invite_id
          ? { ...invite, revoked_at: new Date().toISOString() }
          : invite,
      );
    } else if (fn === "delete_revoked_invite") {
      invites = invites.filter((invite) => invite.id !== args.p_invite_id);
    } else if (fn === "delete_trip") {
      lifecycleEvents.push("delete_trip");
      trips.splice(0, trips.length);
      receipts = [];
    } else if (fn === "create_trip") {
      const created = {
        ...trip,
        id: "55555555-5555-4555-8555-555555555555",
        title: args.p_title,
        start_date: args.p_start,
        end_date: args.p_end,
        timezone: args.p_timezone,
        status: "active",
      };
      trips.push(created);
      result = created.id;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result),
    });
  });
  return {
    getSavedExpense: () => savedExpense,
    getSavedCorrection: () => savedCorrection,
    getRpcCalls: () => rpcCalls,
    getRestRequests: () => restRequests,
    getStays: () => stays,
    failNextExpense: () => {
      failExpenseOnce = true;
    },
    getExpenseOperationIds: () =>
      rpcCalls
        .filter((call) => call.fn === "create_expense")
        .map((call) => call.args.p_operation_id),
    getExpenseCount: () => expenses.length,
    getReceipts: () => receipts,
    getUploadedReceipt: () => uploadedReceipt,
    getReceiptInsertCount: () => receiptInsertCount,
    failNextReceiptUpload: () => {
      failReceiptUploadOnce = true;
    },
    getReceiptStorageEvents: () => receiptStorageEvents,
    getReceiptDownloads: () => receiptDownloads,
    getLifecycleEvents: () => lifecycleEvents,
  };
}

async function openTrip(page: import("@playwright/test").Page) {
  const dashboard = page.getByRole("region", { name: "Choose a trip" });
  const tripCard = dashboard.getByRole("button", { name: /Bangkok Weekend/ });
  await expect(tripCard).toBeVisible();
  await tripCard.click();
  await expect(tripCard).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Bangkok Weekend" }),
  ).toBeVisible();
  return tripCard;
}

async function expectInViewport(locator: import("@playwright/test").Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const viewportHeight = await locator
        .page()
        .evaluate(() => window.innerHeight);
      const scrollY = await locator.page().evaluate(() => window.scrollY);
      if (!box) return "missing";
      return box.y >= 0 && box.y + box.height <= viewportHeight
        ? "fully-visible"
        : `offscreen y=${box.y.toFixed(1)} bottom=${(box.y + box.height).toFixed(1)} viewport=${viewportHeight} scrollY=${scrollY.toFixed(1)}`;
    })
    .toBe("fully-visible");
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-02T03:00:00.000Z") });
});

for (const { currency, valid, invalid, minor, corrected, correctedMinor } of [
  {
    currency: "JPY",
    valid: "1000",
    invalid: "1000.5",
    minor: "1000",
    corrected: "1001",
    correctedMinor: "1001",
  },
  {
    currency: "THB",
    valid: "1.23",
    invalid: "1.234",
    minor: "123",
    corrected: "1.24",
    correctedMinor: "124",
  },
  {
    currency: "KWD",
    valid: "0.001",
    invalid: "0.0001",
    minor: "1",
    corrected: "0.002",
    correctedMinor: "2",
  },
]) {
  test(`validates and saves ${currency} amounts in create and correction forms`, async ({
    page,
  }) => {
    const fixture = await installFixture(page, { currency });
    await page.goto("/");
    await openTrip(page);
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Expenses", exact: true })
      .click();
    const entry = page.locator(".expense-entry");
    await entry.locator(":scope > summary").click();
    const amount = entry.getByLabel(`Amount (${currency})`);
    await amount.fill("0");
    expect(
      await amount.evaluate(
        (input) => input instanceof HTMLInputElement && input.checkValidity(),
      ),
    ).toBe(false);
    await amount.fill(invalid);
    expect(
      await amount.evaluate(
        (input) => input instanceof HTMLInputElement && input.checkValidity(),
      ),
    ).toBe(false);
    await amount.fill(valid);
    expect(
      await amount.evaluate(
        (input) => input instanceof HTMLInputElement && input.checkValidity(),
      ),
    ).toBe(true);
    await entry
      .getByLabel("What was it for?")
      .fill(`Currency test ${currency}`);
    await entry
      .getByRole("button", { name: "Save expense", exact: true })
      .click();
    await expect
      .poll(() => fixture.getSavedExpense())
      .toMatchObject({ p_amount_minor: minor, p_currency: currency });
    const expense = page
      .locator("article.stop")
      .filter({ hasText: `Currency test ${currency}` });
    await expense.getByText("Correct expense", { exact: true }).click();
    const correction = expense.locator("form");
    const correctionAmount = correction.getByLabel(`Amount (${currency})`);
    expect(
      await correctionAmount.evaluate(
        (input) => input instanceof HTMLInputElement && input.checkValidity(),
      ),
    ).toBe(true);
    await correctionAmount.fill(corrected);
    await correction
      .getByRole("button", { name: "Save correction", exact: true })
      .click();
    await expect
      .poll(() => fixture.getSavedCorrection())
      .toMatchObject({ p_amount_minor: correctedMinor, p_currency: currency });
  });
}

test.describe("destination-local expense date", () => {
  test.use({ timezoneId: "UTC" });

  test("defaults to Bangkok today across the UTC date boundary and resets after save", async ({
    page,
  }) => {
    // 17:30 UTC is already the next calendar day in Bangkok.
    await page.clock.install({ time: new Date("2026-11-02T17:30:00.000Z") });
    const fixtureState = await installFixture(page);
    await page.goto("/");
    await openTrip(page);
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Expenses" })
      .click();
    const expenseEntry = page.locator(".expense-entry");
    await expenseEntry.locator(":scope > summary").click();
    const date = expenseEntry.getByLabel("Date (optional)");
    const time = expenseEntry.getByLabel("Time (optional, requires date)");
    await expect(date).toHaveValue("2026-11-03");
    await expect(time).toBeEnabled();
    await expect(time).toHaveValue("");

    await date.fill("2026-11-02");
    await expect(time).toBeEnabled();
    await time.fill("23:45");
    await date.fill("");
    await expect(time).toBeDisabled();
    await expect(time).toHaveValue("");

    await expenseEntry.getByLabel("What was it for?").fill("Late snack");
    await expenseEntry.getByLabel("Amount (THB)").fill("25");
    await expenseEntry.getByRole("button", { name: "Save expense" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Sent and confirmed." }),
    ).toBeVisible();
    await expect
      .poll(() => fixtureState.getSavedExpense())
      .toMatchObject({
        p_expense_date: null,
        p_expense_time: null,
      });

    // Reopen after save: a fresh expense starts with destination-local today.
    await expenseEntry.locator(":scope > summary").click();
    await expect(date).toHaveValue("2026-11-03");
    await expect(time).toBeEnabled();
  });
});

test("keeps a pending receipt retryable without duplicating metadata, and preserves the preview offline", async ({
  page,
}) => {
  const fixtureState = await installFixture(page, {
    failReceiptUploadOnce: true,
  });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses" })
    .click();
  const expense = page
    .locator("article.stop")
    .filter({ hasText: "Airport taxi" });
  await expense.getByText("Attach receipt", { exact: true }).click();
  const pngData = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#cf772a";
    context.fillRect(0, 0, 640, 480);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await expense.getByLabel("Choose a receipt photo").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngData, "base64"),
  });
  await expect(
    expense.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();

  await page.context().setOffline(true);
  await expense.getByRole("button", { name: "Save receipt" }).click();
  await expect(
    expense
      .getByRole("alert")
      .filter({ hasText: "Connect to the internet to save a receipt." }),
  ).toBeVisible();
  await expect(
    expense.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();
  expect(fixtureState.getReceipts()).toEqual([]);

  await page.context().setOffline(false);
  await expense.getByRole("button", { name: "Save receipt" }).click();
  await expect(
    expense
      .getByRole("status")
      .filter({ hasText: "Receipt upload is pending." }),
  ).toBeVisible();
  await expect(
    expense.getByRole("alert").filter({ hasText: "temporary upload failure" }),
  ).toBeVisible();
  expect(fixtureState.getReceiptInsertCount()).toBe(1);
  expect(fixtureState.getReceipts()).toMatchObject([
    { status: "pending", expense_id: "expense-1" },
  ]);

  await expense.getByRole("button", { name: "Retry save" }).click();
  await expect(
    expense.getByRole("button", { name: "View receipt" }),
  ).toBeVisible();
  expect(fixtureState.getReceiptInsertCount()).toBe(1);
  expect(fixtureState.getReceipts()).toMatchObject([
    { status: "ready", expense_id: "expense-1" },
  ]);
});

test("creates an expense with a private receipt in one flow", async ({
  page,
}, testInfo) => {
  const fixture = await installFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  const form = page.locator(".expense-entry");
  await form.locator(":scope > summary").click();
  await expect(form.getByLabel("Amount (THB)")).toHaveValue("");
  await expect(form.getByLabel("Date (optional)")).toHaveValue("2026-11-02");
  await form.getByLabel("What was it for?").fill("Market lunch");
  await form.getByLabel("Amount (THB)").fill("240");
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#cf772a";
    context.fillRect(0, 0, 640, 480);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await form.getByLabel("Receipt photo (optional)").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await expect(
    form.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Remove selected receipt" }).click();
  await expect(
    form.getByRole("img", { name: "Compressed receipt preview" }),
  ).toHaveCount(0);
  await form.getByLabel("Receipt photo (optional)").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await expect(
    form.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();
  const save = form.getByRole("button", { name: "Save expense", exact: true });
  await expect(save).toBeEnabled();
  await form.screenshot({
    path: `artifacts/${testInfo.project.name}-new-expense-with-receipt.png`,
    style: "header, .activity-tabs { position: static !important; }",
  });
  await save.click();
  await expect
    .poll(() => fixture.getSavedExpense())
    .toMatchObject({ p_description: "Market lunch", p_amount_minor: "24000" });
  await expect
    .poll(() => fixture.getReceipts())
    .toMatchObject([{ expense_id: "expense-added", status: "ready" }]);
  expect(fixture.getExpenseOperationIds()).toHaveLength(1);
  expect(fixture.getUploadedReceipt()).toBeDefined();
});

test("refresh keeps the chosen tab even when an expense draft exists", async ({
  page,
}) => {
  await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  const nav = () => page.getByRole("navigation", { name: "Trip sections" });
  await expect(
    nav().getByRole("button", { name: "Overview", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await nav().getByRole("button", { name: "Expenses", exact: true }).click();
  const form = page.locator(".expense-entry");
  await form.locator(":scope > summary").click();
  await expect(form.locator("form")).toBeFocused();
  await form.getByLabel("What was it for?").fill("Keep this draft");
  await form.getByLabel("Amount (THB)").fill("320");
  // Opening the file picker waits until the draft is durable.
  const chooser = page.waitForEvent("filechooser");
  await form.getByRole("button", { name: "Choose file", exact: true }).click();
  await chooser;
  for (const tab of ["Itinerary", "Trip", "Overview"]) {
    await nav().getByRole("button", { name: tab, exact: true }).click();
    await page.reload();
    await expect(
      nav().getByRole("button", { name: tab, exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  const expenseTab = nav().getByRole("button", {
    name: "Expenses",
    exact: true,
  });
  await expenseTab.press("Enter");
  await expect(form.getByLabel("What was it for?")).toHaveValue(
    "Keep this draft",
  );
  await expect(form.getByLabel("Amount (THB)")).toHaveValue("320");
  await expect(expenseTab).toBeFocused();
});

test("restores an unsaved expense after file picker interruption and reload", async ({
  page,
}) => {
  const fixture = await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  let form = page.locator(".expense-entry");
  await form.locator(":scope > summary").click();
  await form.getByLabel("What was it for?").fill("Receipt draft dinner");
  await form.getByLabel("Amount (THB)").fill("420");
  await form.getByLabel("Date (optional)").fill("2026-11-03");
  await form.getByLabel("Time (optional, requires date)").fill("19:30");
  const chooser = page.waitForEvent("filechooser");
  await form.getByRole("button", { name: "Choose file", exact: true }).click();
  await chooser;
  await page.reload();
  form = page.locator(".expense-entry");
  await expect(form.getByLabel("What was it for?")).toHaveValue(
    "Receipt draft dinner",
  );
  await expect(form.getByLabel("Amount (THB)")).toHaveValue("420");
  await expect(form.getByLabel("Date (optional)")).toHaveValue("2026-11-03");
  await expect(form.getByLabel("Time (optional, requires date)")).toHaveValue(
    "19:30",
  );
  expect(fixture.getExpenseOperationIds()).toHaveLength(0);
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext("2d")!.fillRect(0, 0, 640, 480);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await form
    .getByLabel("Receipt photo (optional)", { exact: true })
    .setInputFiles({
      name: "receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from(data, "base64"),
    });
  await expect(
    form.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Save expense", exact: true }),
  ).toBeEnabled();
  await page.reload();
  form = page.locator(".expense-entry");
  await expect(form.getByLabel("What was it for?")).toHaveValue(
    "Receipt draft dinner",
  );
  await expect(
    form.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect.poll(() => fixture.getExpenseOperationIds().length).toBe(1);
  await expect
    .poll(() => fixture.getReceipts())
    .toMatchObject([{ status: "ready" }]);
  await page.reload();
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  await page.locator(".expense-entry > summary").click();
  await expect(
    page.locator(".expense-entry").getByLabel("What was it for?"),
  ).toHaveValue("");
  expect(fixture.getExpenseOperationIds()).toHaveLength(1);
});

test("receipt file picker works without direct camera controls in both expense flows", async ({
  page,
}) => {
  await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  const data = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#cf772a";
    context.fillRect(0, 0, 640, 480);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const image = {
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  };

  const form = page.locator(".expense-entry");
  await form.locator(":scope > summary").click();
  const nativeChooserPromise = page.waitForEvent("filechooser");
  await form.getByRole("button", { name: "Choose file" }).click();
  const nativeChooser = await nativeChooserPromise;
  expect(
    await (await nativeChooser.element()).getAttribute("capture"),
  ).toBeNull();
  await nativeChooser.setFiles(image);
  await expect(
    form.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();

  await expect(form.getByRole("button", { name: "Take photo" })).toHaveCount(0);
  await expect(form.locator("input[capture]")).toHaveCount(0);

  const expense = page
    .locator("article.stop")
    .filter({ hasText: "Airport taxi" });
  await expense.getByText("Attach receipt", { exact: true }).click();
  const attachmentNativePromise = page.waitForEvent("filechooser");
  await expense.getByRole("button", { name: "Choose file" }).click();
  const attachmentNative = await attachmentNativePromise;
  expect(
    await (await attachmentNative.element()).getAttribute("capture"),
  ).toBeNull();
  await attachmentNative.setFiles(image);
  await expect(
    expense.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();

  await expect(expense.getByRole("button", { name: "Take photo" })).toHaveCount(
    0,
  );
  await expect(expense.locator("input[capture]")).toHaveCount(0);
});

test("after financial save, a receipt upload retry never creates the expense again", async ({
  page,
}) => {
  const fixture = await installFixture(page, { failReceiptUploadOnce: true });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  const form = page.locator(".expense-entry");
  await form.locator(":scope > summary").click();
  await form.getByLabel("What was it for?").fill("Receipt retry lunch");
  await form.getByLabel("Amount (THB)").fill("55");
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 40;
    c.getContext("2d")!.fillRect(0, 0, 40, 40);
    return c.toDataURL("image/png").split(",")[1];
  });
  await form.getByLabel("Receipt photo (optional)").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await form.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Expense saved; receipt pending." }),
  ).toBeVisible();
  expect(fixture.getExpenseOperationIds()).toHaveLength(1);
  fixture.failNextReceiptUpload();
  await page.reload();
  await openTrip(page);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Expense saved; receipt pending." }),
  ).toBeVisible();
  expect(fixture.getExpenseOperationIds()).toHaveLength(1);
  await page.locator(".offline-queue > summary").click();
  const retry = page.getByRole("button", { name: "Retry receipt upload" });
  await retry.click();
  await expect
    .poll(() => fixture.getReceipts())
    .toMatchObject([{ expense_id: "expense-added", status: "ready" }]);
  expect(fixture.getExpenseOperationIds()).toHaveLength(1);
  expect(fixture.getReceiptInsertCount()).toBe(1);
});

test("keeps the compressed receipt in the outbox across reload and resumes the same expense operation", async ({
  page,
}) => {
  const fixture = await installFixture(page);
  let apiOffline = true;
  await page.route("**/rest/v1/rpc/create_expense", async (route) => {
    if (apiOffline) await route.abort("failed");
    else await route.fallback();
  });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  const form = page.locator(".expense-entry");
  await form.locator(":scope > summary").click();
  await form.getByLabel("What was it for?").fill("Offline receipt expense");
  await form.getByLabel("Amount (THB)").fill("80");
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 60;
    c.getContext("2d")!.fillRect(0, 0, 80, 60);
    return c.toDataURL("image/png").split(",")[1];
  });
  await form.getByLabel("Receipt photo (optional)").setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(data, "base64"),
  });
  await form.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(
    page.getByRole("status").filter({
      hasText:
        "Could not send yet. Your item is saved and will retry when connected.",
    }),
  ).toBeVisible();
  const persisted = () =>
    page.evaluate(async () => {
      const opened = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("travelmate");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const rows = await new Promise<Record<string, unknown>[]>(
        (resolve, reject) => {
          const request = opened
            .transaction("outbox", "readonly")
            .objectStore("outbox")
            .getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        },
      );
      const row = rows.find((item) => item.kind === "expense");
      const receipt = row?.receipt as { id?: string; blob?: Blob } | undefined;
      return {
        id: row?.id,
        receiptId: receipt?.id,
        bytes: receipt?.blob?.size ?? 0,
      };
    });
  await expect.poll(persisted).toMatchObject({ bytes: expect.any(Number) });
  const beforeReload = await persisted();
  expect(beforeReload.bytes).toBeGreaterThan(0);
  expect(beforeReload.id).toBeTruthy();
  await page.reload();
  await openTrip(page);
  const afterReload = await persisted();
  expect(afterReload).toEqual(beforeReload);
  expect(fixture.getExpenseOperationIds()).toHaveLength(0);
  apiOffline = false;
  await page.getByText("Saved on this device").click();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect
    .poll(() => fixture.getReceipts())
    .toMatchObject([{ expense_id: "expense-added", status: "ready" }]);
  expect(fixture.getExpenseOperationIds()).toHaveLength(1);
  expect(fixture.getExpenseOperationIds()[0]).toBe(beforeReload.id);
});

test("organizer deletion cancellation does not write; confirmed deletion precedes receipt cleanup", async ({
  page,
}) => {
  const fixture = await installFixture(page, { seedReceipt: true });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  const expense = page
    .locator("article.stop")
    .filter({ hasText: "Airport taxi" });
  const cancelPrompt = page.waitForEvent("dialog").then(async (dialog) => {
    expect(dialog.message()).toContain("Recorded payments stay unchanged.");
    await dialog.dismiss();
  });
  await expense.getByRole("button", { name: "Delete expense" }).click();
  await cancelPrompt;
  expect(
    fixture.getRpcCalls().filter((call) => call.fn === "delete_expense"),
  ).toHaveLength(0);
  const confirmPrompt = page.waitForEvent("dialog").then(async (dialog) => {
    expect(dialog.message()).toContain("Recorded payments stay unchanged.");
    await dialog.accept();
  });
  await expense.getByRole("button", { name: "Delete expense" }).click();
  await confirmPrompt;
  await expect
    .poll(() => fixture.getLifecycleEvents())
    .toEqual(["delete_expense", "storage_remove"]);
  await expect(
    page.locator("article.stop").filter({ hasText: "Airport taxi" }),
  ).toHaveCount(0);
  expect(fixture.getReceiptStorageEvents()).toEqual([
    `remove:${tripId}/expense-1/receipt-seeded.jpg`,
  ]);
});

test("reports failed receipt cleanup and retries without restoring the deleted expense", async ({
  page,
}) => {
  const fixture = await installFixture(page, {
    seedReceipt: true,
    failReceiptCleanup: true,
  });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses", exact: true })
    .click();
  const expense = page
    .locator("article.stop")
    .filter({ hasText: "Airport taxi" });
  const confirmPrompt = page.waitForEvent("dialog").then(async (dialog) => {
    expect(dialog.message()).toContain("Recorded payments stay unchanged.");
    await dialog.accept();
  });
  await expense.getByRole("button", { name: "Delete expense" }).click();
  await confirmPrompt;
  await expect(
    page.locator(".pending").filter({ hasText: "Receipt cleanup pending" }),
  ).toBeVisible();
  expect(fixture.getLifecycleEvents()).toEqual(["delete_expense"]);
  await page.getByRole("button", { name: "Retry receipt cleanup" }).click();
  await expect
    .poll(() => fixture.getLifecycleEvents())
    .toEqual(["delete_expense", "storage_remove"]);
  await expect(
    page.locator(".pending").filter({ hasText: "Receipt cleanup pending" }),
  ).toHaveCount(0);
  await expect(
    page.locator("article.stop").filter({ hasText: "Airport taxi" }),
  ).toHaveCount(0);
});

for (const role of ["approved guest", "plan editor"] as const) {
  test(`${role} cannot delete expenses`, async ({ page }) => {
    await installFixture(
      page,
      role === "plan editor" ? { editor: true } : { participant: true },
    );
    await page.goto("/");
    await openTrip(page);
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Expenses", exact: true })
      .click();
    const expense = page
      .locator("article.stop")
      .filter({ hasText: "Airport taxi" });
    await expect(
      expense.getByRole("button", { name: "Delete expense" }),
    ).toHaveCount(0);
  });
}

test("compresses a receipt before upload, displays it, and removes its private file and metadata", async ({
  page,
}, testInfo) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses" })
    .click();
  const expense = page
    .locator("article.stop")
    .filter({ hasText: "Airport taxi" });
  await expense.getByText("Attach receipt", { exact: true }).click();
  const pngData = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1200;
    const context = canvas.getContext("2d")!;
    const pixels = context.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = (i * 31) % 256;
      pixels.data[i + 1] = (i * 17) % 256;
      pixels.data[i + 2] = (i * 7) % 256;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const input = expense.getByLabel("Choose a receipt photo");
  await input.setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngData, "base64"),
  });
  await expect(
    expense.getByRole("img", { name: "Compressed receipt preview" }),
  ).toBeVisible();
  await expense.getByRole("button", { name: "Save receipt" }).click();
  await expect(
    expense.getByRole("button", { name: "View receipt" }),
  ).toBeVisible();
  await expect
    .poll(() => fixtureState.getReceipts())
    .toMatchObject([
      {
        trip_id: tripId,
        expense_id: "expense-1",
        uploaded_by: uid,
        status: "ready",
      },
    ]);

  const uploaded = fixtureState.getUploadedReceipt();
  expect(uploaded).toBeDefined();
  expect(uploaded!.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  const metadata = await sharp(uploaded!).metadata();
  expect(
    Math.max(metadata.width ?? 0, metadata.height ?? 0),
  ).toBeLessThanOrEqual(1600);
  expect(uploaded!.byteLength).toBeLessThanOrEqual(512 * 1024);
  await expect(
    expense.getByRole("img", { name: "Saved receipt photo" }),
  ).toHaveCount(0);
  await expense.getByRole("button", { name: "View receipt" }).click();
  await expect(
    expense.getByRole("img", { name: "Saved receipt photo" }),
  ).toBeVisible();
  expect(fixtureState.getReceiptDownloads()).toEqual([
    expect.objectContaining({
      path: expect.stringContaining("/storage/v1/object/expense-receipts/"),
      authorization: `Bearer ${token}`,
    }),
  ]);
  expect(fixtureState.getReceiptDownloads()[0]?.path).not.toContain("/public/");
  await expense.screenshot({
    path: `artifacts/${testInfo.project.name}-receipt-fixture-preview.png`,
  });
  await expense.getByRole("button", { name: "Remove receipt" }).click();
  await expect(
    expense.getByText("Attach receipt", { exact: true }),
  ).toBeVisible();
  expect(fixtureState.getReceipts()).toEqual([]);
  expect(fixtureState.getUploadedReceipt()).toBeUndefined();
  await input.setInputFiles({
    name: "replacement.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngData, "base64"),
  });
  await expect
    .poll(() =>
      expense
        .getByRole("img", { name: "Compressed receipt preview" })
        .evaluate((image) =>
          image instanceof HTMLImageElement ? image.naturalWidth : 0,
        ),
    )
    .toBeGreaterThan(0);
});

test("removes receipt objects before permanently deleting a trip", async ({
  page,
}) => {
  const fixtureState = await installFixture(page, { seedReceipt: true });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Trip", exact: true })
    .click();
  await page.getByText("Trip settings and access", { exact: true }).click();
  await page.getByText("Delete trip", { exact: true }).click();
  await page.getByLabel("Trip title").last().fill("Bangkok Weekend");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect
    .poll(() => fixtureState.getLifecycleEvents())
    .toEqual(["storage_remove", "delete_trip"]);
  expect(fixtureState.getReceiptStorageEvents()).toEqual([
    `remove:${tripId}/expense-1/receipt-seeded.jpg`,
  ]);
  expect(fixtureState.getLifecycleEvents().indexOf("storage_remove")).toBe(0);
  expect(fixtureState.getReceipts()).toEqual([]);
});

test("mocked enrolled itinerary and expense flow; keyboard and labels; preview capture", async ({
  page,
}, testInfo) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Roam" })).toBeFocused();
  await openTrip(page);
  await expect(
    page
      .getByRole("region", { name: "Choose a trip" })
      .locator('[aria-pressed="true"]'),
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Wat Arun" })).toBeVisible();
  await expect(
    page.locator(".next-stop").getByRole("link", { name: "Open directions" }),
  ).toHaveAttribute("href", /google\.com\/maps\/(dir|search)\//);
  await expect(page.getByRole("heading", { name: "Itinerary" })).toBeVisible();
  const todayCard = page.locator(".next-stop");
  await expect(todayCard).toContainText("Current stop");
  await expect(todayCard).toContainText("Wat Arun");
  await expect(todayCard).toContainText("Next stop");
  await expect(todayCard).toContainText("Chatuchak Market");
  await expect(todayCard).not.toContainText("Old Town Walk");
  await expect(
    page.getByRole("button", { name: /i'm here|check.?in|attendance/i }),
  ).toHaveCount(0);
  await expect(page.getByText(/checked in|attendance/i)).toHaveCount(0);

  const destination = page.getByLabel("Place or activity");
  await page.locator(".stop-editor summary").click();
  await expect(destination).toBeVisible();

  await destination.fill("Lunch at Or Tor Kor");
  const stopEditor = page.locator(".stop-editor");
  await stopEditor.getByLabel("Address").fill("Kamphaeng Phet 2 Road");
  await stopEditor.getByLabel("Notes").fill("Arrive before noon");
  await stopEditor.getByLabel("Day").fill("2026-11-02");
  await page.getByLabel("Activity time (optional)").fill("09:00");
  await page.getByLabel("Transport").selectOption("train");
  await page.getByRole("button", { name: "Save stop" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Stop saved." }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        fixtureState
          .getRpcCalls()
          .find((call) => call.fn === "upsert_tagged_itinerary_item")?.args,
    )
    .toMatchObject({
      p_title: "Lunch at Or Tor Kor",
      p_plan_date: "2026-11-02",
      p_transport_mode: "train",
    });
  await page.locator(".activity").screenshot({
    path: `artifacts/${testInfo.project.name}-itinerary-fixture-preview.png`,
  });

  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses" })
    .click();
  await page.locator(".expense-entry > summary").click();
  const expenseEntry = page.locator(".expense-entry");
  await expenseEntry.getByLabel("What was it for?").fill("Street food");
  await expenseEntry.getByLabel("Amount (THB)").fill("6.01");
  await expenseEntry.getByLabel("Date (optional)").fill("2026-11-02");
  await expenseEntry.getByLabel("Time (optional, requires date)").fill("12:34");
  await expenseEntry.getByRole("button", { name: "Save expense" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sent and confirmed." }),
  ).toBeVisible();
  await expect
    .poll(() => fixtureState.getSavedExpense())
    .toMatchObject({
      p_amount_minor: "601",
      p_currency: "THB",
      p_description: "Street food",
      p_expense_date: "2026-11-02",
      p_expense_time: "12:34",
      p_payer_member_id: alice,
      p_shares: [
        { member_id: alice, owed_minor: "301" },
        { member_id: bob, owed_minor: "300" },
      ],
    });
  expect(fixtureState.getSavedExpense()?.p_operation_id).toEqual(
    expect.any(String),
  );
  await expect(page.getByText("Airport taxi", { exact: true })).toBeVisible();
  expect(
    fixtureState
      .getRestRequests()
      .some(({ method, table }) => method === "GET" && table === "check_ins"),
  ).toBe(false);
  expect(fixtureState.getRpcCalls().some(({ fn }) => fn === "check_in")).toBe(
    false,
  );

  const addedExpense = page
    .locator("article.stop")
    .filter({ hasText: "Street food" });
  await expect(addedExpense).toContainText("2026-11-02");
  await addedExpense.getByText("Correct expense").click();
  await addedExpense.getByLabel("Description").fill("Street food corrected");
  await addedExpense.getByLabel("Amount (THB)").fill("7.25");
  await addedExpense.getByLabel("Date (optional)").fill("2026-11-03");
  await addedExpense.getByLabel("Time (optional)").fill("13:45");
  await addedExpense.getByRole("button", { name: "Save correction" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Expense corrected." }),
  ).toBeVisible();
  await expect
    .poll(() => fixtureState.getSavedCorrection())
    .toMatchObject({
      p_expense_id: "expense-added",
      p_expected_version: 1,
      p_currency: "THB",
      p_amount_minor: "725",
      p_description: "Street food corrected",
      p_expense_date: "2026-11-03",
      p_expense_time: "13:45",
    });
  expect(fixtureState.getSavedCorrection()?.p_operation_id).toEqual(
    expect.any(String),
  );

  await page.locator(".activity").screenshot({
    path: `artifacts/${testInfo.project.name}-expenses-fixture-preview.png`,
  });
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-fixture-preview.png`,
    fullPage: true,
  });
});

test("trip plan saves inclusive night ranges, accommodation, and a timezone-aware daily activity", async ({
  page,
}) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Itinerary" })
    .click();
  const plan = page.getByRole("region", { name: "Trip itinerary" });
  await expect(plan).not.toContainText("Asia/Bangkok");

  await chooseItineraryAction(plan, "Add city for a night or range");
  await plan.getByLabel("From (night of)").fill("2026-11-01");
  await plan.getByLabel("Through (inclusive)").fill("2026-11-03");
  await plan.getByLabel("City", { exact: true }).first().fill("Chiang Mai");
  await plan.getByLabel("Travel mode into this city").selectOption("train");
  await plan
    .getByLabel("I understand this will overwrite the selected nights")
    .check();
  await plan.getByRole("button", { name: "Save destination" }).click();
  await expect(plan.getByText("Destination nights saved.")).toBeVisible();
  await expect
    .poll(
      () =>
        fixtureState
          .getRpcCalls()
          .find((call) => call.fn === "set_nightly_destinations")?.args,
    )
    .toMatchObject({
      p_start_date: "2026-11-01",
      p_end_date: "2026-11-03",
      p_city: "Chiang Mai",
      p_transport_mode: "train",
      p_replace: true,
      p_expected_versions: { "2026-11-01": 1, "2026-11-02": 1 },
    });
  await expect(plan.getByText("Chiang Mai", { exact: true })).toHaveCount(3);

  await chooseOverflowAction(
    plan.locator(".plan-night").nth(1),
    "Chiang Mai",
    "Edit this night",
  );
  await plan
    .getByLabel("I understand this will overwrite the selected nights")
    .check();
  await plan.getByLabel("City", { exact: true }).last().fill("Ayutthaya");
  await plan.getByRole("button", { name: "Save night or range" }).click();
  await expect
    .poll(
      () =>
        fixtureState
          .getRpcCalls()
          .filter((call) => call.fn === "set_nightly_destinations")
          .at(-1)?.args,
    )
    .toMatchObject({
      p_start_date: "2026-11-02",
      p_end_date: "2026-11-02",
      p_city: "Ayutthaya",
      p_replace: true,
      p_expected_versions: { "2026-11-02": 1 },
    });

  const planViews = plan.getByRole("navigation", { name: "Itinerary view" });
  await planViews.getByRole("button", { name: "Accommodation" }).click();
  await chooseItineraryAction(plan, "Add accommodation");
  await plan.getByLabel("Name", { exact: true }).fill("Riverside Hotel");
  await plan.getByLabel("Check-in").fill("2026-11-01");
  await plan.getByLabel("Check-out (exclusive)").fill("2026-11-03");
  await plan.getByLabel("Address").fill("1 River Road");
  await plan.getByLabel("Phone").fill("+66 2 123 4567");
  await plan.getByRole("button", { name: "Save accommodation" }).click();
  await expect
    .poll(
      () =>
        fixtureState.getRpcCalls().find((call) => call.fn === "upsert_stay")
          ?.args,
    )
    .toMatchObject({
      p_check_in_date: "2026-11-01",
      p_check_out_date: "2026-11-03",
      p_name: "Riverside Hotel",
      p_address: "1 River Road",
      p_phone: "+66 2 123 4567",
      p_stay_id: null,
      p_expected_version: null,
    });

  await planViews.getByRole("button", { name: "Daily itinerary" }).click();
  await chooseItineraryAction(plan, "Add activity");
  await plan
    .locator(".plan-activity-editor")
    .getByLabel("Day")
    .fill("2026-11-02");
  await plan
    .getByRole("textbox", { name: "Activity", exact: true })
    .fill("Doi Suthep visit");
  await plan.getByLabel("Activity time").fill("09:30");
  await plan.getByLabel("Activity tag").selectOption("sightseeing");
  await plan.getByLabel("Address").last().fill("Mueang Chiang Mai");
  await plan.getByLabel("Travel mode into activity").selectOption("taxi");
  await plan.getByRole("button", { name: "Save activity" }).click();
  await expect(plan.getByText("Activity saved.")).toBeVisible();
  await expect
    .poll(
      () =>
        fixtureState
          .getRpcCalls()
          .find(
            (call) =>
              call.fn === "upsert_tagged_itinerary_item" &&
              call.args.p_title === "Doi Suthep visit",
          )?.args,
    )
    .toMatchObject({
      p_plan_date: "2026-11-02",
      p_starts_at: "2026-11-02T02:30:00.000Z",
      p_transport_mode: "taxi",
      p_title: "Doi Suthep visit",
      p_activity_tag: "sightseeing",
    });
  await expect(
    plan.getByText("Doi Suthep visit", { exact: true }),
  ).toBeVisible();
  const createdActivity = plan
    .locator(".plan-activity")
    .filter({ hasText: "Doi Suthep visit" });
  await expect(createdActivity).toContainText(/9:30/);
  await expect(
    createdActivity.getByText("Sightseeing", { exact: true }),
  ).toBeVisible();
  await expect(
    createdActivity.getByRole("button", {
      name: "Options for Doi Suthep visit",
    }),
  ).toBeVisible();
  const overflowTriggers = plan.locator(".overflow-trigger");
  await expect(overflowTriggers).not.toHaveCount(0);
  for (const trigger of await overflowTriggers.all()) {
    await expect(trigger).toHaveText("");
    await expect(trigger.locator("svg")).toHaveCount(1);
  }
  await chooseOverflowAction(
    createdActivity,
    "Doi Suthep visit",
    "Edit activity",
  );
  const createdActivityEditor = plan.locator(".plan-activity-editor");
  await expect(createdActivityEditor.getByLabel("Day")).toHaveValue(
    "2026-11-02",
  );
  await expect(createdActivityEditor.getByLabel("Activity time")).toHaveValue(
    "09:30",
  );
  await expect(createdActivityEditor.getByLabel("Activity tag")).toHaveValue(
    "sightseeing",
  );
  await createdActivityEditor.getByLabel("Activity tag").selectOption("");
  await createdActivityEditor
    .getByRole("button", { name: "Save activity" })
    .click();
  await expect(
    createdActivity.getByText("Sightseeing", { exact: true }),
  ).toHaveCount(0);
});

test.describe("Plan editor regressions", () => {
  test("Plan editors scroll into view, and closed accommodation Edit opens prefilled and updates the same stay", async ({
    page,
  }, testInfo) => {
    const fixtureState = await installFixture(page);
    await page.goto("/");
    await openTrip(page);
    const tabs = page.getByRole("navigation", { name: "Trip sections" });
    await tabs.getByRole("button", { name: "Itinerary" }).click();
    const plan = page.getByRole("region", { name: "Trip itinerary" });
    await expect(plan).not.toContainText("Asia/Bangkok");

    await chooseItineraryAction(plan, "Add city for a night or range");
    const nightForm = plan.locator("form.plan-form").first();
    await expectInViewport(nightForm.getByLabel("From (night of)"));
    await nightForm.getByLabel("From (night of)").fill("2026-11-03");
    await nightForm.getByLabel("Through (inclusive)").fill("2026-11-03");
    await nightForm
      .getByLabel("City", { exact: true })
      .first()
      .fill("Test city");
    await nightForm.getByRole("button", { name: "Save destination" }).click();
    await chooseOverflowAction(
      plan.locator(".plan-night").nth(1),
      "Bangkok",
      "Edit this night",
    );
    const editNightForm = plan.locator("form.plan-form").first();
    await expectInViewport(editNightForm.getByLabel("From (night of)"));
    // Selecting another item while the editor is open must keep the editor usable.
    await chooseOverflowAction(
      plan.locator(".plan-night").nth(0),
      "Bangkok",
      "Edit this night",
    );
    await expectInViewport(editNightForm.getByLabel("From (night of)"));

    const planViews = plan.getByRole("navigation", { name: "Itinerary view" });
    await planViews.getByRole("button", { name: "Accommodation" }).click();
    await chooseItineraryAction(plan, "Add accommodation");
    const addStayForm = plan.locator(".plan-stays form.plan-form");
    await expectInViewport(addStayForm.getByLabel("Name", { exact: true }));
    await addStayForm
      .getByLabel("Name", { exact: true })
      .fill("Riverside Hotel");
    await addStayForm.getByLabel("Check-in").fill("2026-11-01");
    await addStayForm.getByLabel("Check-out (exclusive)").fill("2026-11-03");
    await addStayForm.getByLabel("Address").fill("1 River Road");
    await addStayForm.getByLabel("Phone").fill("+66 2 123 4567");
    await addStayForm
      .getByRole("button", { name: "Save accommodation" })
      .click();

    const originalStay = plan
      .locator(".plan-stay")
      .filter({ hasText: "River House" });
    await chooseOverflowAction(
      originalStay,
      "River House",
      "Edit accommodation",
    );
    const editStayForm = plan.locator(".plan-stays form.plan-form");
    await expectInViewport(editStayForm.getByLabel("Name", { exact: true }));
    await expect(editStayForm.getByLabel("Name", { exact: true })).toHaveValue(
      "River House",
    );
    await expect(editStayForm.getByLabel("Check-in")).toHaveValue("2026-11-01");
    await expect(editStayForm.getByLabel("Check-out (exclusive)")).toHaveValue(
      "2026-11-03",
    );
    await expect(editStayForm.getByLabel("Address")).toHaveValue(
      "1 River Road",
    );
    await expect(editStayForm.getByLabel("Phone")).toHaveValue(
      "+66 2 123 4567",
    );
    const currentViewport = page.viewportSize();
    if (currentViewport && currentViewport.width > 600)
      await page.setViewportSize({
        width: currentViewport.width,
        height: Math.max(currentViewport.height, 1100),
      });
    await editStayForm.screenshot({
      path: `artifacts/${testInfo.project.name}-accommodation-editor-fixture-preview.png`,
    });
    await editStayForm
      .getByLabel("Name", { exact: true })
      .fill("River House Updated");
    await editStayForm
      .getByRole("button", { name: "Save accommodation" })
      .click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_stay")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_stay_id: "stay-1",
        p_expected_version: 1,
        p_name: "River House Updated",
      });
    await expect
      .poll(() => fixtureState.getStays().find((stay) => stay.id === "stay-1"))
      .toMatchObject({
        id: "stay-1",
        name: "River House Updated",
        version: 2,
      });
    await expect(
      plan.locator(".plan-stay").filter({ hasText: "River House Updated" }),
    ).toBeVisible();

    await planViews.getByRole("button", { name: "Accommodation" }).click();
    const accommodation = plan.locator(".plan-stays");
    const updatedStay = accommodation
      .locator(".plan-stay")
      .filter({ hasText: "River House Updated" });
    await expect(updatedStay).toBeVisible();
    await chooseOverflowAction(
      updatedStay,
      "River House Updated",
      "Edit accommodation",
    );
    const accommodationEditor = accommodation.locator("form.plan-form");
    await expect(
      accommodationEditor.getByLabel("Name", { exact: true }),
    ).toHaveValue("River House Updated");
    await accommodationEditor
      .getByLabel("Name", { exact: true })
      .fill("River House Menu Edit");
    await accommodationEditor
      .getByRole("button", { name: "Save accommodation" })
      .click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_stay")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_stay_id: "stay-1",
        p_expected_version: 2,
        p_name: "River House Menu Edit",
      });
    await expect
      .poll(() => fixtureState.getStays().find((stay) => stay.id === "stay-1"))
      .toMatchObject({
        id: "stay-1",
        name: "River House Menu Edit",
        version: 3,
      });
    await planViews.getByRole("button", { name: "Daily itinerary" }).click();
    await expect(
      plan.locator(".plan-night").nth(1).locator(".plan-daily-stay"),
    ).toContainText("River House Menu Edit");

    await chooseItineraryAction(plan, "Add activity");
    await expectInViewport(
      plan.locator(".plan-activity-editor").getByLabel("Day"),
    );
  });
});

test.describe("Browser timezone differs from trip timezone", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("Today uses the device date and edits preserve scheduled clock times", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-02T03:00:00.000Z"));
    const fixtureState = await installFixture(page);
    await page.goto("/");
    await openTrip(page);

    await expect(page.getByLabel("Itinerary date")).toHaveValue("2026-11-01");
    await page.getByRole("button", { name: "Next day" }).click();

    await page.locator(".stop-editor summary").click();
    const stopEditor = page.locator(".stop-editor");
    await expectInViewport(stopEditor.getByLabel("Place or activity"));
    await stopEditor.getByLabel("Place or activity").fill("LA breakfast");
    await stopEditor.getByLabel("Day").fill("2026-11-02");
    await stopEditor.getByLabel("Activity time (optional)").fill("09:30");
    await stopEditor.getByRole("button", { name: "Save stop" }).click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_tagged_itinerary_item")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_title: "LA breakfast",
        p_item_id: null,
        p_plan_date: "2026-11-02",
        p_starts_at: "2026-11-02T02:30:00.000Z",
      });

    const stop = page
      .locator("article.stop")
      .filter({ hasText: "LA breakfast" });
    await expect(stop).toBeVisible();
    await stop.getByRole("button", { name: "Edit stop" }).click();
    await expectInViewport(stopEditor.getByLabel("Place or activity"));
    await expect(stopEditor.getByLabel("Day")).toHaveValue("2026-11-02");
    await expect(stopEditor.getByLabel("Activity time (optional)")).toHaveValue(
      "09:30",
    );
    await stopEditor.getByLabel("Activity time (optional)").fill("10:00");
    await stopEditor.getByRole("button", { name: "Save stop" }).click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_tagged_itinerary_item")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_item_id: "stop-added",
        p_expected_version: 1,
        p_plan_date: "2026-11-02",
        p_starts_at: "2026-11-02T03:00:00.000Z",
      });

    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Itinerary" })
      .click();
    const plan = page.getByRole("region", { name: "Trip itinerary" });
    const legacyActivity = plan
      .locator(".plan-activity")
      .filter({ hasText: "Wat Arun" });
    await chooseOverflowAction(legacyActivity, "Wat Arun", "Edit activity");
    const legacyEditor = plan.locator(".plan-activity-editor");
    await expectInViewport(legacyEditor.getByLabel("Day"));
    await expect(legacyEditor.getByLabel("Day")).toHaveValue("2026-11-02");
    await expect(legacyEditor.getByLabel("Activity time")).toHaveValue("09:00");
    await legacyEditor.getByRole("button", { name: "Save activity" }).click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_tagged_itinerary_item")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_item_id: "stop-1",
        p_expected_version: 1,
        p_plan_date: "2026-11-02",
        p_starts_at: "2026-11-02T02:00:00.000Z",
      });

    const activity = plan
      .locator(".plan-activity")
      .filter({ hasText: "LA breakfast" });
    await expect(activity).toContainText(/10:00/);
    await chooseOverflowAction(activity, "LA breakfast", "Edit activity");
    const editor = plan.locator(".plan-activity-editor");
    await expectInViewport(editor.getByLabel("Day"));
    await expect(editor.getByLabel("Day")).toHaveValue("2026-11-02");
    await expect(editor.getByLabel("Activity time")).toHaveValue("10:00");
    await editor.getByLabel("Activity time").fill("10:15");
    await editor.getByRole("button", { name: "Save activity" }).click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_tagged_itinerary_item")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_item_id: "stop-added",
        p_expected_version: 2,
        p_plan_date: "2026-11-02",
        p_starts_at: "2026-11-02T03:15:00.000Z",
      });
  });
});

test("invitation QR reveals its panel and stays in the viewport", async ({
  page,
}, testInfo) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Trip" })
    .click();
  await page.getByText("Trip settings and access", { exact: true }).click();
  await page.getByLabel("Invitation expiry date").fill("2099-12-31");
  await expect(page.getByText(/Expires on.*GMT\+07:00/)).toBeVisible();
  await page.getByRole("button", { name: "Create invitation" }).click();
  const qrPanel = page.getByRole("region", { name: "Trip invitation" });
  await expect(qrPanel).toBeVisible();
  await expect
    .poll(async () => {
      const box = await qrPanel.boundingBox();
      return box
        ? box.y >= 0 && box.y < (await page.evaluate(() => innerHeight))
        : false;
    })
    .toBe(true);
  await expect(
    qrPanel.getByRole("heading", { name: "Scan to request access" }),
  ).toBeVisible();
  await expect(
    qrPanel.getByRole("img", { name: "Trip invitation QR code" }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        fixtureState
          .getRpcCalls()
          .find((call) => call.fn === "create_reusable_invite_until")?.args,
    )
    .toMatchObject({
      p_trip_id: tripId,
      p_expires_at: "2099-12-31T17:00:00.000Z",
    });
  await expect(qrPanel.getByText("1234-5678-90AB-CDEF")).toBeVisible();
  await expect(qrPanel.getByLabel("Invitation link")).toHaveValue(
    /#\/join\/1234567890abcdef$/,
  );
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-invitation-qr-fixture-preview.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close" }).click({ force: true });
  await expect(qrPanel).toHaveCount(0);
});

test("organizer confirms deletion of revoked invitations while active invitations remain revocable", async ({
  page,
}) => {
  const fixtureState = await installFixture(page, {
    invites: [
      {
        id: "invite-active",
        trip_id: tripId,
        expires_at: "2026-11-20T00:00:00Z",
        uses_count: 0,
        max_uses: 8,
        revoked_at: null,
        deleted_at: null,
      },
      {
        id: "invite-revoked",
        trip_id: tripId,
        expires_at: "2026-11-20T00:00:00Z",
        uses_count: 1,
        max_uses: 8,
        revoked_at: "2026-11-13T00:00:00Z",
        deleted_at: null,
      },
    ],
  });
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Trip" })
    .click();
  await page.getByText("Trip settings and access", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Revoke", exact: true }),
  ).toBeVisible();
  const deleteButton = page.getByRole("button", {
    name: "Delete revoked invitation",
  });
  await expect(deleteButton).toBeVisible();

  let dismiss = true;
  page.on("dialog", async (dialog) => {
    await (dismiss ? dialog.dismiss() : dialog.accept());
  });
  await deleteButton.click();
  expect(
    fixtureState
      .getRpcCalls()
      .filter((call) => call.fn === "delete_revoked_invite"),
  ).toHaveLength(0);
  dismiss = false;
  await deleteButton.click();
  await expect
    .poll(
      () =>
        fixtureState
          .getRpcCalls()
          .filter((call) => call.fn === "delete_revoked_invite").length,
    )
    .toBe(1);
  await expect(deleteButton).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Revoke", exact: true }),
  ).toBeVisible();
});

test("pasted invitation requires submit and lets a guest correct the link", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const invitation = page.getByRole("textbox", {
    name: "Invitation code or link",
  });
  const openInvitation = page.getByRole("button", { name: "Open invitation" });
  const validLink = new URL(`/#/join/${"b".repeat(64)}`, page.url());

  for (const value of [
    "",
    "this is not a URL",
    `https://example.com${validLink.hash}`,
    new URL("/#/join/short-token", validLink).href,
  ]) {
    await invitation.fill(value);
    await invitation.press("Enter");
    await expect(page).toHaveURL(new URL("/", validLink).href);
    await expect(invitation).toHaveValue(value);
    await expect(invitation).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert")).toContainText(/link/i);
    await expect(invitation).toHaveAccessibleDescription(/link/i);
    await expect(invitation).toBeFocused();
  }

  await invitation.fill(validLink.href);
  await invitation.press("Tab");
  await expect(openInvitation).toBeFocused();
  await expect(page).toHaveURL(new URL("/", validLink).href);
  await expect(page.getByRole("alert")).toHaveCount(0);
  if (testInfo.project.use.hasTouch) await openInvitation.tap();
  else await invitation.press("Enter");

  await expect(page).toHaveURL(validLink.href);
  await expect(
    page.getByRole("heading", { name: "Join a trip" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Your name")).toBeFocused();
  await expect(page.getByRole("checkbox")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Request to join" }),
  ).toBeInViewport();
  await expect(
    page.getByText(
      "The organizer must approve your request before you can access the trip.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Install Roam (optional)")).toBeVisible();
  await expect(
    page.getByText(/If you plan to use Roam from your Home Screen/),
  ).toBeHidden();
});

test("Thai guest entry fits the viewport and uses the dark theme", async ({
  page,
}, testInfo) => {
  if (testInfo.project.use.hasTouch)
    await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "ไทย / English" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("lang", "th");

  const invitation = page.getByRole("textbox", { name: "รหัสหรือลิงก์คำเชิญ" });
  await invitation.press("Enter");
  await expect(invitation).toHaveAccessibleDescription(
    "กรุณากรอกรหัสหรือลิงก์คำเชิญจากผู้จัดทริป",
  );
  await invitation.fill("1234-5678-90AB-CDEF");
  await page.getByRole("button", { name: "เปิดคำเชิญ" }).click();
  await expect(page).toHaveURL(/#\/join\/1234567890abcdef$/);

  await expect(page.getByLabel("ชื่อของคุณ")).toBeInViewport();
  await expect(
    page.getByRole("checkbox", {
      name: "ฉันกำลังใช้แอปหรือเบราว์เซอร์ที่จะใช้ต่อไป",
    }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "ขอเข้าร่วม" }),
  ).toBeInViewport();
  await expect(
    page.getByText("ผู้จัดทริปต้องอนุมัติคำขอก่อนที่คุณจะเข้าถึงทริปได้"),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("fresh invitation join validates before anonymous sign in and retries with the same guest identity", async ({
  page,
}) => {
  const token = "1234567890abcdef";
  let anonymousSignIns = 0;
  let redeemCalls = 0;
  let pendingJoinCreated = false;
  const eventOrder: string[] = [];
  const gatewayCalls: { action: string; token: string; name?: string }[] = [];
  await page.route("**/rest/v1/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/auth/v1/signup**", async (route) => {
    anonymousSignIns++;
    eventOrder.push("anonymous-session");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fixture-anonymous-access",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "fixture-anonymous-refresh",
        user: {
          id: "66666666-6666-4666-8666-666666666666",
          aud: "authenticated",
          role: "authenticated",
          is_anonymous: true,
          app_metadata: { provider: "anonymous", providers: ["anonymous"] },
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      }),
    });
  });
  await page.route("**/functions/v1/invite-gateway", async (route) => {
    const body = route.request().postDataJSON() as {
      action: string;
      token: string;
      name?: string;
    };
    gatewayCalls.push(body);
    eventOrder.push(`gateway-${body.action}`);
    if (body.action === "redeem") {
      redeemCalls++;
      if (redeemCalls === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "temporary gateway failure" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "pending" }),
      });
      pendingJoinCreated = true;
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto(`/#/join/${token}`);
  await expect(
    page.getByRole("heading", { name: "Join a trip" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("sb-127-auth-token")),
  ).toBeNull();
  await expect.poll(() => anonymousSignIns).toBe(0);
  await page.getByLabel("Your name").fill("Niran");
  const acknowledgement = page.getByRole("checkbox");
  await expect(acknowledgement).toBeVisible();
  await page.getByRole("button", { name: "Request to join" }).click();
  await expect(acknowledgement).toBeFocused();
  expect(gatewayCalls).toEqual([]);
  expect(anonymousSignIns).toBe(0);
  await acknowledgement.check();
  await page.getByRole("button", { name: "Request to join" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not complete the invitation",
  );
  await expect.poll(() => anonymousSignIns).toBe(1);
  await expect.poll(() => redeemCalls).toBe(1);
  const anonIdentity = await page.evaluate(() => {
    const session = JSON.parse(
      localStorage.getItem("sb-127-auth-token") ?? "{}",
    );
    return session.user?.id;
  });
  expect(anonIdentity).toBe("66666666-6666-4666-8666-666666666666");
  await page.getByRole("button", { name: "Request to join" }).click();
  await expect(page).toHaveURL(/#$/);
  await expect.poll(() => redeemCalls).toBe(2);
  expect(anonymousSignIns).toBe(1);
  expect(pendingJoinCreated).toBe(true);
  expect(gatewayCalls.map((call) => call.action)).toEqual([
    "validate",
    "redeem",
    "redeem",
  ]);
  expect(eventOrder).toEqual([
    "gateway-validate",
    "anonymous-session",
    "gateway-redeem",
    "gateway-redeem",
  ]);
  expect(gatewayCalls.every((call) => call.token === token)).toBe(true);
  expect(
    gatewayCalls
      .filter((call) => call.action === "redeem")
      .map((call) => call.name),
  ).toEqual(["Niran", "Niran"]);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const session = JSON.parse(
          localStorage.getItem("sb-127-auth-token") ?? "{}",
        );
        return session.user?.id;
      }),
    )
    .toBe(anonIdentity);
});

test("invalid invitation gateway response stays unauthenticated and explains the server setup issue", async ({
  page,
}) => {
  let anonymousSignIns = 0;
  await page.route("**/auth/v1/signup**", async (route) => {
    anonymousSignIns++;
    await route.fulfill({ status: 500, body: "unexpected sign in" });
  });
  await page.route("**/functions/v1/invite-gateway", (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "Function not found" }),
    }),
  );
  await page.goto(`/#/join/${"c".repeat(64)}`);
  await expect(
    page.getByRole("heading", { name: "Join a trip" }),
  ).toBeVisible();
  await expect.poll(() => anonymousSignIns).toBe(0);
  await page.getByLabel("Your name").fill("Mali");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Request to join" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Invitations are not set up on this server yet",
  );
  expect(anonymousSignIns).toBe(0);
  await expect(page).toHaveURL(/#\/join\/[a-f0-9]{64}$/);
  expect(
    await page.evaluate(() => localStorage.getItem("sb-127-auth-token")),
  ).toBeNull();
});

test("trip creation carries its date range; archive and restore work; wrong deletion title sends no RPC", async ({
  page,
}) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await page.locator("details.create-trip > summary").click();
  await page.getByLabel("Trip name").fill("Kyoto Spring");
  await page.getByLabel("Your name").fill("Mali");
  await page.getByLabel("Start date").fill("2027-03-20");
  await page.getByLabel("End date").fill("2027-03-24");
  await expect(page.getByLabel("Destination timezone (IANA)")).toHaveCount(0);
  await page.getByRole("button", { name: "Create trip" }).click();
  await expect
    .poll(
      () =>
        fixtureState.getRpcCalls().find((call) => call.fn === "create_trip")
          ?.args,
    )
    .toMatchObject({
      p_title: "Kyoto Spring",
      p_start: "2027-03-20",
      p_end: "2027-03-24",
      p_timezone: "UTC",
      p_currency: "THB",
    });

  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Trip" })
    .click();
  await expect(
    page.getByText("Trip settings and access", { exact: true }),
  ).toBeVisible();
  await page.getByText("Trip settings and access", { exact: true }).click();
  await expect(
    page.getByText("Advanced: destination time", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Itinerary" })
    .click();
  const plan = page.getByRole("region", { name: "Trip itinerary" });
  await expect(plan).not.toContainText("Asia/Bangkok");
  const watArun = plan
    .locator(".plan-activity")
    .filter({ hasText: "Wat Arun" });
  await expect(watArun).toContainText(/9:00/);
  await chooseOverflowAction(watArun, "Wat Arun", "Edit activity");
  await expect(
    plan.locator(".plan-activity-editor").getByLabel("Activity time"),
  ).toHaveValue("09:00");
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Trip" })
    .click();
  await page.getByText("Trip settings and access", { exact: true }).click();
  await page.getByRole("button", { name: "Archive trip" }).click();
  await expect
    .poll(
      () =>
        fixtureState.getRpcCalls().find((call) => call.fn === "archive_trip")
          ?.args,
    )
    .toEqual({ p_trip_id: tripId });
  await page.getByRole("button", { name: "Restore trip" }).click();
  await expect
    .poll(
      () =>
        fixtureState.getRpcCalls().find((call) => call.fn === "restore_trip")
          ?.args,
    )
    .toEqual({ p_trip_id: tripId });

  await page.getByText("Delete trip", { exact: true }).click();
  await page.getByLabel("Trip title").last().fill("Wrong title");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The title does not match." }),
  ).toBeVisible();
  await expect(
    fixtureState.getRpcCalls().filter((call) => call.fn === "delete_trip"),
  ).toHaveLength(0);

  await page.getByLabel("Trip title").last().fill("Bangkok Weekend");
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect
    .poll(
      () =>
        fixtureState.getRpcCalls().find((call) => call.fn === "delete_trip")
          ?.args,
    )
    .toEqual({ p_trip_id: tripId, p_confirmation_title: "Bangkok Weekend" });
});

test("offline expense stays queued until reconnect, then receives fixture acknowledgement", async ({
  page,
  context,
}) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses" })
    .click();

  await context.setOffline(true);
  await page.locator(".expense-entry > summary").click();
  const expenseEntry = page.locator(".expense-entry");
  await expenseEntry.getByLabel("What was it for?").fill("Offline noodles");
  await expenseEntry.getByLabel("Amount (THB)").fill("42.00");
  await expenseEntry.getByRole("button", { name: "Save expense" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Saved locally. Waiting for server confirmation." }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "1 item(s) waiting to send" }),
  ).toBeVisible();
  await expect.poll(() => fixtureState.getSavedExpense()).toBeUndefined();

  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: "Sent and confirmed." }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "1 item(s) waiting to send" }),
  ).toHaveCount(0);
  await expect
    .poll(() => fixtureState.getSavedExpense())
    .toMatchObject({
      p_trip_id: tripId,
      p_payer_member_id: alice,
      p_description: "Offline noodles",
      p_amount_minor: "4200",
    });
  expect(fixtureState.getSavedExpense()?.p_operation_id).toEqual(
    expect.any(String),
  );
  expect(fixtureState.getExpenseCount()).toBe(2);
  expect(
    fixtureState
      .getRestRequests()
      .some(({ method, table }) => method === "GET" && table === "check_ins"),
  ).toBe(false);
});

test("failed offline expense can be inspected and retried with its original ID", async ({
  page,
  context,
}, testInfo) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses" })
    .click();
  fixtureState.failNextExpense();
  await context.setOffline(true);
  await page.locator(".expense-entry > summary").click();
  const expenseEntry = page.locator(".expense-entry");
  await expenseEntry.getByLabel("What was it for?").fill("Retry noodles");
  await expenseEntry.getByLabel("Amount (THB)").fill("25.00");
  await expenseEntry.getByRole("button", { name: "Save expense" }).click();
  await context.setOffline(false);
  const queue = page.locator(".offline-queue");
  await queue.locator("summary").click();
  const operation = queue.locator(".offline-operation");
  await expect(operation).toContainText("Failed");
  await page.locator(".activity").screenshot({
    path: `artifacts/${testInfo.project.name}-offline-queue-fixture-preview.png`,
    style: "header, .activity-tabs { position: static !important; }",
  });
  const originalId = fixtureState.getExpenseOperationIds()[0];
  expect(originalId).toEqual(expect.any(String));
  await operation.getByRole("button", { name: "Retry" }).click();
  await expect(operation).toHaveCount(0);
  expect(fixtureState.getExpenseOperationIds()).toEqual([
    originalId,
    originalId,
  ]);
  expect(fixtureState.getExpenseCount()).toBe(2);
  expect(
    fixtureState
      .getRestRequests()
      .some(({ method, table }) => method === "GET" && table === "check_ins"),
  ).toBe(false);
});

test("guest account warns before sign-out and can stay signed in", async ({
  page,
}) => {
  await installFixture(page, { guest: true });
  await page.goto("/");
  await page.getByRole("button", { name: "Guest account" }).click();
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  const warning = page.getByRole("alert", { name: "Confirm sign out" });
  await expect(warning).toContainText("guest account can lose access");
  await expect(warning).toContainText("supervised recovery");
  await warning.getByRole("button", { name: "Keep signed in" }).click();
  await expect(
    page.getByRole("button", { name: "Guest account" }),
  ).toBeVisible();
});

test("email account confirms sign-out of this device", async ({ page }) => {
  await installFixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  const warning = page.getByRole("alert", { name: "Confirm sign out" });
  await expect(warning).toContainText("sign in again with your email");
  await warning.getByRole("button", { name: "Confirm sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Join a trip" }),
  ).toBeVisible();
});

test("Senior view persists on this device and hides editing tabs", async ({
  page,
}, testInfo) => {
  const fixtureState = await installFixture(page);
  await page.goto("/");
  await page.screenshot({
    path: `artifacts/${testInfo.project.name}-dashboard-fixture-preview.png`,
    fullPage: true,
  });
  await openTrip(page);
  await page.getByRole("button", { name: "Senior view" }).click();
  await expect(
    page.getByRole("button", { name: "Exit senior view" }),
  ).toBeVisible();
  await expect(
    page.locator(".next-stop").getByRole("link", { name: "Open directions" }),
  ).toHaveAttribute("href", /google\.com\/maps\/(dir|search)\//);
  const tabs = page.getByRole("navigation", { name: "Trip sections" });
  await expect(tabs.getByRole("button", { name: "Itinerary" })).toHaveCount(0);
  await expect(tabs.getByRole("button", { name: "Expenses" })).toHaveCount(0);
  await expect(tabs).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit stop" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Itinerary" })).toBeVisible();
  await expect(page.locator(".stop").getByRole("button")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /i'm here|check.?in|attendance/i }),
  ).toHaveCount(0);
  await expect(page.getByText(/checked in|attendance/i)).toHaveCount(0);
  expect(
    fixtureState
      .getRestRequests()
      .some(({ method, table }) => method === "GET" && table === "check_ins"),
  ).toBe(false);
  expect(fixtureState.getRpcCalls().some(({ fn }) => fn === "check_in")).toBe(
    false,
  );
  await page.locator(".activity").screenshot({
    path: `artifacts/${testInfo.project.name}-senior-fixture-preview.png`,
    style: "header, .activity-tabs { position: static !important; }",
  });
  await page.reload();
  await openTrip(page);
  await expect(
    page.getByRole("button", { name: "Exit senior view" }),
  ).toBeVisible();
});

test.describe("Daily itinerary browser regressions", () => {
  test("itinerary menus close with Escape and outside click, and directions remain available", async ({
    page,
  }, testInfo) => {
    await installFixture(page);
    await page.goto("/");
    await openTrip(page);
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Itinerary" })
      .click();
    const itinerary = page.getByRole("region", { name: "Trip itinerary" });
    const day = itinerary.locator(".plan-night").nth(1);
    const activity = day
      .locator(".plan-activity")
      .filter({ hasText: "Wat Arun" });
    await expect(
      activity.getByRole("link", { name: "Directions" }),
    ).toHaveAttribute("href", /google\.com\/maps\/search/);
    await expect(
      day.locator(".plan-daily-stay").getByRole("link", { name: "Directions" }),
    ).toHaveAttribute("href", /google\.com\/maps\/search/);

    const trigger = activity.getByRole("button", {
      name: "Options for Wat Arun",
    });
    await trigger.click();
    const menu = activity.getByRole("menu");
    await expect(
      menu.getByRole("menuitem", { name: "Edit activity" }),
    ).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Remove" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole("heading", { name: "Trip itinerary" }).click();
    await expect(activity.getByRole("menu")).toHaveCount(0);

    const fab = itinerary.getByRole("button", { name: "Edit itinerary" });
    await itinerary
      .locator(".plan-night")
      .first()
      .locator(".plan-day-heading")
      .scrollIntoViewIfNeeded();
    await expect(fab).toBeInViewport({ ratio: 1 });
    if (testInfo.project.name === "mobile-chromium") {
      await page.screenshot({
        path: "artifacts/mobile-chromium-itinerary-viewport-fixture-preview.png",
      });
    }
    await fab.click();
    const actions = itinerary.getByRole("menu", { name: "Itinerary actions" });
    await expect(actions).toBeInViewport({ ratio: 1 });
    await expect(
      actions.getByRole("menuitem", { name: "Add activity" }),
    ).toBeVisible();
    await expect(
      actions.getByRole("menuitem", { name: "Add city for a night or range" }),
    ).toBeVisible();
    await expect(
      actions.getByRole("menuitem", { name: "Add accommodation" }),
    ).toBeVisible();
    await expect(
      actions.getByRole("menuitem", { name: "Accommodation management" }),
    ).toBeVisible();
  });

  test("editing a daily hotel and editing it from Accommodation keep the same stay version", async ({
    page,
  }) => {
    const fixtureState = await installFixture(page);
    await page.goto("/");
    await openTrip(page);
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Itinerary" })
      .click();
    const plan = page.getByRole("region", { name: "Trip itinerary" });
    const planViews = plan.getByRole("navigation", { name: "Itinerary view" });
    const secondDay = plan.locator(".plan-night").nth(1);
    await expect(secondDay.locator(".plan-daily-stay")).toContainText(
      "River House",
    );
    await chooseOverflowAction(
      secondDay.locator(".plan-daily-stay"),
      "River House",
      "Edit accommodation",
    );
    const accommodation = plan.locator(".plan-stays");
    const editor = accommodation.locator("form.plan-form");
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(
      "River House",
    );
    await editor
      .getByLabel("Name", { exact: true })
      .fill("River House Daily Edit");
    await editor.getByRole("button", { name: "Save accommodation" }).click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_stay")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_stay_id: "stay-1",
        p_expected_version: 1,
        p_name: "River House Daily Edit",
      });
    await expect
      .poll(() => fixtureState.getStays().find((stay) => stay.id === "stay-1"))
      .toMatchObject({
        id: "stay-1",
        name: "River House Daily Edit",
        version: 2,
      });

    await expect(
      plan.locator(".plan-stay").filter({ hasText: "River House Daily Edit" }),
    ).toBeVisible();
    await plan
      .locator(".plan-stay")
      .filter({ hasText: "River House Daily Edit" })
      .getByRole("button", { name: "Options for River House Daily Edit" })
      .click();
    await plan.getByRole("menuitem", { name: "Edit accommodation" }).click();
    await expect(editor.getByLabel("Name", { exact: true })).toHaveValue(
      "River House Daily Edit",
    );
    await editor
      .getByLabel("Name", { exact: true })
      .fill("River House Accommodation Edit");
    await editor.getByRole("button", { name: "Save accommodation" }).click();
    await expect
      .poll(
        () =>
          fixtureState
            .getRpcCalls()
            .filter((call) => call.fn === "upsert_stay")
            .at(-1)?.args,
      )
      .toMatchObject({
        p_stay_id: "stay-1",
        p_expected_version: 2,
        p_name: "River House Accommodation Edit",
      });
    await expect
      .poll(() => fixtureState.getStays().find((stay) => stay.id === "stay-1"))
      .toMatchObject({
        id: "stay-1",
        name: "River House Accommodation Edit",
        version: 3,
      });
    await planViews.getByRole("button", { name: "Daily itinerary" }).click();
    await expect(
      plan.locator(".plan-night").nth(1).locator(".plan-daily-stay"),
    ).toContainText("River House Accommodation Edit");
  });

  test("selected day keeps destination, checkout-exclusive hotel, and activities aligned", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-02T03:00:00.000Z"));
    await installFixture(page, { daily: true });
    await page.goto("/");
    await openTrip(page);

    const date = page.getByLabel("Itinerary date");
    const tonight = page.getByRole("region", {
      name: "Selected day destination and accommodation",
    });
    await expect(date).toHaveValue("2026-11-02");
    await expect(tonight).toContainText("Bangkok");
    await expect(tonight).toContainText("River House");
    await expect(page.locator(".stop").nth(0)).toContainText("Wat Arun");
    await expect(page.locator(".stop").nth(1)).toContainText(
      "Chatuchak Market",
    );
    await expect(page.locator(".stop")).toHaveCount(2);

    await page.getByRole("button", { name: "Next day" }).click();
    await expect(date).toHaveValue("2026-11-03");
    await expect(tonight).toContainText("Chiang Mai");
    await expect(tonight).toContainText("Doi Hotel");
    await expect(tonight).not.toContainText("River House");
    await expect(page.getByText("Free day")).toBeVisible();
    await page.getByRole("button", { name: /Next planned activity/ }).click();
    await expect(date).toHaveValue("2026-11-04");
    await expect(tonight).toContainText("Chiang Mai");
    await expect(tonight).toContainText("Doi Hotel");
    await expect(page.locator(".stop").first()).toContainText("Night Bazaar");
    await expect(page.locator(".stop")).toHaveCount(1);

    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(date).toHaveValue("2026-11-03");
    await expect(tonight).toContainText("Doi Hotel");
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(date).toHaveValue("2026-11-02");
    await expect(tonight).toContainText("River House");
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(date).toHaveValue("2026-11-01");
    await expect(
      page.getByRole("button", { name: "Previous day" }),
    ).toBeDisabled();
    await expect(tonight).toContainText("River House");
    await expect(page.locator(".stop").first()).toContainText("Old Town Walk");
  });

  test("default date clamps to first and last trip day outside the trip dates", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-10-29T03:00:00.000Z"));
    await installFixture(page, { daily: true });
    await page.goto("/");
    await openTrip(page);
    const date = page.getByLabel("Itinerary date");
    const tonight = page.getByRole("region", {
      name: "Selected day destination and accommodation",
    });
    await expect(date).toHaveValue("2026-11-01");
    await expect(tonight).toContainText("Bangkok");
    await expect(tonight).toContainText("River House");
    await expect(
      page.getByRole("button", { name: "Previous day" }),
    ).toBeDisabled();
  });

  test("default date clamps to last trip day when today is after the trip", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-06T03:00:00.000Z"));
    await installFixture(page, { daily: true });
    await page.goto("/");
    await openTrip(page);
    const date = page.getByLabel("Itinerary date");
    const selectedDay = page.getByRole("region", {
      name: "Selected day destination and accommodation",
    });
    await expect(date).toHaveValue("2026-11-04");
    await expect(selectedDay).toContainText("Chiang Mai");
    await expect(selectedDay).toContainText("Doi Hotel");
    await expect(page.locator(".stop").first()).toContainText("Night Bazaar");
    await expect(page.getByRole("button", { name: "Next day" })).toBeDisabled();
  });

  test("participant sees daily stay and activities without editing controls", async ({
    page,
  }) => {
    await installFixture(page, { participant: true, daily: true });
    await page.goto("/");
    await openTrip(page);
    const plan = page.getByRole("region", { name: "Trip itinerary" });
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Itinerary" })
      .click();
    await expect(
      plan.locator(".plan-night").nth(1).locator(".plan-daily-stay"),
    ).toContainText("River House");
    await expect(
      plan
        .getByRole("navigation", { name: "Itinerary view" })
        .getByRole("button", {
          name: "Accommodation",
        }),
    ).toBeVisible();
    await plan
      .getByRole("navigation", { name: "Itinerary view" })
      .getByRole("button", { name: "Accommodation" })
      .click();
    await expect(
      plan.locator(".plan-stay").filter({ hasText: "River House" }).first(),
    ).toBeVisible();
    await expect(
      plan.getByRole("button", { name: "Edit itinerary" }),
    ).toHaveCount(0);
    await expect(plan.locator(".overflow-trigger")).toHaveCount(0);
  });

  test("single-date Overview shows one day heading and retains date controls", async ({
    page,
  }) => {
    await installFixture(page);
    await page.goto("/");
    await openTrip(page);
    const tabs = page.getByRole("navigation", { name: "Trip sections" });
    await expect(
      tabs.getByRole("button", { name: "Overview", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Itinerary date")).toHaveValue("2026-11-02");
    await expect(page.locator("h2.overview-day-heading")).toHaveCount(1);
    await expect(page.locator("h2.overview-day-heading time")).toHaveAttribute(
      "datetime",
      "2026-11-02",
    );
    await expect(page.locator(".tonight-card time")).toHaveCount(0);
    await expect(page.locator(".tonight-card")).not.toContainText("Nov 2");
    await expect(page.locator(".tonight-card")).not.toContainText(
      /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/,
    );
  });

  test("organizer grants and revokes plan editing for an approved member", async ({
    page,
  }) => {
    const fixture = await installFixture(page, { linkedMember: true });
    await page.goto("/");
    await openTrip(page);
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Trip", exact: true })
      .click();
    const traveler = page
      .locator(".trip-member-row")
      .filter({ hasText: "Niran" });
    await traveler.getByRole("button", { name: "Grant editing" }).click();
    await expect
      .poll(
        () =>
          fixture
            .getRpcCalls()
            .find((call) => call.fn === "set_member_plan_permission")?.args,
      )
      .toMatchObject({ p_member_id: bob, p_can_edit: true });
    await expect(
      traveler.getByRole("button", { name: "Remove editing" }),
    ).toBeVisible();
    await traveler.getByRole("button", { name: "Remove editing" }).click();
    await expect
      .poll(
        () =>
          fixture
            .getRpcCalls()
            .filter((call) => call.fn === "set_member_plan_permission")
            .at(-1)?.args,
      )
      .toMatchObject({ p_member_id: bob, p_can_edit: false });
    await expect(
      traveler.getByRole("button", { name: "Grant editing" }),
    ).toBeVisible();
  });

  test("approved guest editor can edit activities and stays without admin controls", async ({
    page,
  }) => {
    const fixture = await installFixture(page, {
      editor: true,
      guest: true,
      daily: true,
    });
    await page.goto("/");
    await openTrip(page);
    const overview = page.locator(".activity");
    const editStop = overview
      .getByRole("button", { name: "Edit stop" })
      .first();
    await expect(editStop).toBeVisible();
    await editStop.click();
    await expect(page.getByLabel("Place or activity")).toHaveValue("Wat Arun");
    await page.getByLabel("Place or activity").fill("Wat Arun Updated");
    await page.getByRole("button", { name: "Save stop" }).click();
    await expect
      .poll(
        () =>
          fixture
            .getRpcCalls()
            .find((call) => call.fn === "upsert_tagged_itinerary_item")?.args,
      )
      .toMatchObject({
        p_item_id: "stop-1",
        p_expected_version: 1,
        p_title: "Wat Arun Updated",
      });
    await overview
      .getByRole("button", { name: "Options for River House" })
      .click();
    await overview
      .getByRole("menuitem", { name: "Edit accommodation" })
      .click();
    await expect(page.getByLabel("Name")).toHaveValue("River House");
    await page.getByLabel("Name").fill("River House Updated");
    await page.getByRole("button", { name: "Save accommodation" }).click();
    await expect
      .poll(
        () =>
          fixture.getRpcCalls().find((call) => call.fn === "upsert_stay")?.args,
      )
      .toMatchObject({
        p_stay_id: "stay-1",
        p_expected_version: 1,
        p_name: "River House Updated",
      });
    await expect(
      page.getByRole("status").filter({ hasText: "Accommodation saved." }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: "Trip", exact: true })
      .click();
    await expect(
      page.getByText("Trip settings and access", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Archive trip" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Create invitation",
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Grant editing" }),
    ).toHaveCount(0);
  });
});

test("captures Overview, Itinerary, Expenses, and Trip previews with a fixed Bangkok date", async ({
  page,
}, testInfo) => {
  await page.clock.install({ time: new Date("2026-11-02T03:00:00.000Z") });
  await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  const activity = page.locator(".activity");
  const screenshot = async (tab: string) => {
    const { viewportWidth, documentWidth } = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(
      documentWidth,
      `${tab} tab should not scroll horizontally`,
    ).toBeLessThanOrEqual(viewportWidth);
    await activity.screenshot({
      path: `artifacts/${testInfo.project.name}-${tab}-fixture-preview.png`,
      style: "header, .activity-tabs { position: static !important; }",
    });
  };
  await expect(
    page.getByRole("region", {
      name: "Selected day destination and accommodation",
    }),
  ).toContainText("Bangkok");
  await expect(page.locator("header")).not.toContainText("Asia/Bangkok");
  await expect(
    page.getByRole("region", {
      name: "Selected day destination and accommodation",
    }),
  ).not.toContainText("Asia/Bangkok");
  await screenshot("overview");
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Itinerary" })
    .click();
  await expect(page.locator(".plan-night").first()).toContainText("Bangkok");
  const plan = page.getByRole("region", { name: "Trip itinerary" });
  const dayGroups = plan.locator(".plan-nights > .plan-night");
  await expect(dayGroups).toHaveCount(4);
  for (const [index, date] of [
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
  ].entries()) {
    const group = dayGroups.nth(index);
    await expect(group.locator(".plan-day-heading")).toContainText(
      `Day ${index + 1}`,
    );
    await expect(group.locator(".plan-day-heading time")).toHaveAttribute(
      "datetime",
      date,
    );
    await expect(group.locator(".plan-night")).toHaveCount(0);
  }
  await expect(plan).not.toContainText("Asia/Bangkok");
  const overflowTriggers = plan.locator(".overflow-trigger");
  await expect(overflowTriggers).not.toHaveCount(0);
  for (const trigger of await overflowTriggers.all()) {
    await expect(trigger).toHaveText("");
    await expect(trigger.locator("svg")).toHaveCount(1);
  }
  const lastDay = dayGroups.last();
  await lastDay.scrollIntoViewIfNeeded();
  const lastDayBox = await lastDay.boundingBox();
  const fabBox = await plan
    .getByRole("button", { name: "Edit itinerary" })
    .boundingBox();
  expect(lastDayBox).not.toBeNull();
  expect(fabBox).not.toBeNull();
  expect(lastDayBox!.y + lastDayBox!.height).toBeLessThanOrEqual(fabBox!.y + 4);
  await screenshot("itinerary");
  await plan
    .getByRole("navigation", { name: "Itinerary view" })
    .getByRole("button", { name: "Accommodation" })
    .click();
  await expect(
    plan.locator(".plan-stay").filter({ hasText: "River House" }).first(),
  ).toBeVisible();
  await screenshot("accommodation");
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Expenses" })
    .click();
  await expect(page.getByText("Airport taxi", { exact: true })).toBeVisible();
  await screenshot("expenses");
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Trip", exact: true })
    .click();
  await page.getByText("Delete trip", { exact: true }).click();
  await expect(page.locator(".help-card > strong")).toContainText(
    "Family contact",
  );
  await expect(
    page.getByRole("link", { name: "Call: +66 81 234 5678" }),
  ).toBeVisible();
  await screenshot("trip");
});

test("theme toggle persists and system preference updates the default", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await installFixture(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Switch to dark mode" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("paikan-theme"))).toBe(
    "dark",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();

  // A fresh browser context has no preference override and follows the OS live.
  const context = await page
    .context()
    .browser()!
    .newContext({ colorScheme: "light" });
  const systemPage = await context.newPage();
  await installFixture(systemPage);
  await systemPage.goto("/");
  await expect(systemPage.locator("html")).toHaveAttribute(
    "data-theme",
    "light",
  );
  await systemPage.emulateMedia({ colorScheme: "dark" });
  await expect(systemPage.locator("html")).toHaveAttribute(
    "data-theme",
    "dark",
  );
  expect(
    await systemPage.evaluate(() => localStorage.getItem("paikan-theme")),
  ).toBeNull();
  await context.close();
});

test("account Appearance offers Light, Dark, and System and follows the OS", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await installFixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Account", exact: true }).click();

  const appearance = page.getByRole("group", { name: "Appearance" });
  await expect(appearance).toBeVisible();
  await expect(
    appearance.getByRole("radio", { name: "Light" }),
  ).not.toBeChecked();
  await expect(
    appearance.getByRole("radio", { name: "Dark" }),
  ).not.toBeChecked();
  await expect(appearance.getByRole("radio", { name: "System" })).toBeChecked();
  await page.locator(".account-menu").screenshot({
    path: `artifacts/${testInfo.project.name}-account-appearance-fixture-preview.png`,
  });

  await appearance.getByRole("radio", { name: "Dark" }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("paikan-theme"))).toBe(
    "dark",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await appearance.getByRole("radio", { name: "System" }).check();
  await expect(appearance.getByRole("radio", { name: "System" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => localStorage.getItem("paikan-theme")),
  ).toBeNull();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("captures dark trip tabs and light preview without horizontal overflow", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await installFixture(page);
  await page.goto("/");
  await openTrip(page);
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const activity = page.locator(".activity");
  const capture = async (tab: string, theme: "dark" | "light") => {
    const { viewportWidth, documentWidth } = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(
      documentWidth,
      `${theme} ${tab} should not scroll horizontally`,
    ).toBeLessThanOrEqual(viewportWidth);
    if (tab === "overview") {
      await page.locator("header").screenshot({
        path: `artifacts/${testInfo.project.name}-brand-${theme}-header.png`,
      });
      await page.screenshot({
        path: `artifacts/${testInfo.project.name}-brand-${theme}-viewport.png`,
      });
    }
    await activity.screenshot({
      path: `artifacts/${testInfo.project.name}-${theme}-${tab}-fixture-preview.png`,
      style: "header, .activity-tabs { position: static !important; }",
    });
  };
  await capture("overview", "dark");
  for (const tab of ["Itinerary", "Expenses", "Trip"] as const) {
    await page
      .getByRole("navigation", { name: "Trip sections" })
      .getByRole("button", { name: tab, exact: true })
      .click();
    if (tab === "Itinerary") {
      const plan = page.getByRole("region", { name: "Trip itinerary" });
      const dayGroups = plan.locator(".plan-nights > .plan-night");
      await expect(dayGroups).toHaveCount(4);
      await expect(dayGroups.nth(0).locator(".plan-day-heading")).toContainText(
        "Day 1",
      );
      await expect(dayGroups.nth(1).locator(".plan-day-heading")).toContainText(
        "Day 2",
      );
      await expect(
        dayGroups.nth(0).locator(".plan-day-heading time"),
      ).toHaveAttribute("datetime", "2026-11-01");
      await expect(
        dayGroups.nth(1).locator(".plan-day-heading time"),
      ).toHaveAttribute("datetime", "2026-11-02");
      await expect(plan.locator(".plan-night .plan-night")).toHaveCount(0);
      await plan
        .getByRole("navigation", { name: "Itinerary view" })
        .getByRole("button", { name: "Accommodation" })
        .click();
      await expect(
        plan.locator(".plan-stay").filter({ hasText: "River House" }).first(),
      ).toBeVisible();
      await capture("accommodation", "dark");
      await plan
        .getByRole("navigation", { name: "Itinerary view" })
        .getByRole("button", { name: "Daily itinerary" })
        .click();
    }
    await capture(tab.toLowerCase(), "dark");
  }
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await capture("overview", "light");
});

test("captures compact mobile Overview and Itinerary in light and dark themes", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith("mobile"),
    "mobile layout fixture",
  );
  await page.emulateMedia({ colorScheme: "light" });
  await installFixture(page, { longHotel: true });
  await page.goto("/");
  await openTrip(page);
  const activity = page.locator(".activity");
  const capture = async (
    tab: "overview" | "itinerary",
    theme: "light" | "dark",
  ) => {
    const { viewportWidth, documentWidth } = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(
      documentWidth,
      `${theme} mobile ${tab} should fit the viewport`,
    ).toBeLessThanOrEqual(viewportWidth);
    await activity.screenshot({
      path: `artifacts/${testInfo.project.name}-${theme}-${tab}-compact-fixture-preview.png`,
      style: "header, .activity-tabs { position: static !important; }",
    });
    await (
      tab === "overview"
        ? page.locator(".overview-day-heading")
        : page.locator(".plan-day-heading").first()
    ).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/${testInfo.project.name}-${theme}-${tab}-viewport-fixture-preview.png`,
    });
  };
  const overviewTab = page
    .getByRole("navigation", { name: "Trip sections" })
    .getByRole("button", { name: "Overview", exact: true });
  const box = await overviewTab.boundingBox();
  expect(
    box?.height ?? 0,
    "Overview tab should have a 44px touch target",
  ).toBeGreaterThanOrEqual(44);
  await capture("overview", "light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await capture("overview", "dark");
  const tabs = page.getByRole("navigation", { name: "Trip sections" });
  await tabs.getByRole("button", { name: "Itinerary", exact: true }).click();
  await capture("itinerary", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await capture("itinerary", "light");
});

test("Preparation shares item names and keeps checkmarks and private lists per traveler", async ({
  page,
  context,
}, testInfo) => {
  const sharedItems = [{ id: "passport", title: "Passport" }];
  async function openChecklist(target: typeof page, guest: boolean) {
    await installFixture(target, { guest, participant: guest });
    await target.route("**/rest/v1/trip_preparation_items*", async (route) => {
      const request = route.request();
      const id = new URL(request.url()).searchParams.get("id")?.slice(3);
      switch (request.method()) {
        case "POST":
          sharedItems.push({ id: "jr", title: request.postDataJSON().title });
          return route.fulfill({ status: 201, body: "" });
        case "PATCH":
          sharedItems.find((item) => item.id === id)!.title =
            request.postDataJSON().title;
          return route.fulfill({ json: { id } });
        case "DELETE":
          sharedItems.splice(
            sharedItems.findIndex((item) => item.id === id),
            1,
          );
          return route.fulfill({ json: { id } });
        default:
          return route.fulfill({ json: sharedItems });
      }
    });
    await target.goto("/");
    await openTrip(target);
    await target.getByRole("button", { name: "Preparation" }).click();
    await expect(
      target
        .getByRole("region", { name: "Trip checklist" })
        .getByRole("checkbox", { name: "Passport" }),
    ).toBeVisible();
  }

  if (testInfo.project.use.hasTouch)
    await page.setViewportSize({ width: 320, height: 650 });
  await openChecklist(page, false);
  const tripList = page.getByRole("region", { name: "Trip checklist" });
  const myList = page.getByRole("region", { name: "My checklist" });
  await tripList.getByLabel("New item").fill("Rail pass");
  await tripList.getByRole("button", { name: "Add item" }).click();
  await tripList.getByRole("button", { name: "Edit Rail pass" }).click();
  await tripList.getByLabel("Edit item").fill("JR Pass");
  await tripList.getByRole("button", { name: "Save item" }).click();
  await tripList.getByRole("checkbox", { name: "Passport" }).check();
  await myList.getByLabel("New item").fill("Medication");
  await myList.getByRole("button", { name: "Add item" }).click();
  await myList.getByRole("checkbox", { name: "Medication" }).check();
  await page.reload();
  await expect(
    tripList.getByRole("checkbox", { name: "Passport" }),
  ).toBeChecked();
  await expect(
    myList.getByRole("checkbox", { name: "Medication" }),
  ).toBeChecked();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);

  const guestPage = await context.newPage();
  await openChecklist(guestPage, true);
  const guestTripList = guestPage.getByRole("region", {
    name: "Trip checklist",
  });
  const guestPersonalList = guestPage.getByRole("region", {
    name: "My checklist",
  });
  await expect(
    guestTripList.getByRole("checkbox", { name: "JR Pass" }),
  ).toBeVisible();
  await expect(
    guestTripList.getByRole("checkbox", { name: "Passport" }),
  ).not.toBeChecked();
  await expect(guestTripList.getByRole("button")).toHaveCount(0);
  await expect(guestPersonalList.getByRole("checkbox")).toHaveCount(0);
  await guestPersonalList.getByLabel("New item").fill("Winter clothes");
  await guestPersonalList.getByRole("button", { name: "Add item" }).click();
  await guestPersonalList
    .getByRole("checkbox", { name: "Winter clothes" })
    .check();
  await guestPersonalList
    .getByRole("button", { name: "Remove Winter clothes" })
    .click();
  await expect(guestPersonalList.getByRole("checkbox")).toHaveCount(0);
  await guestPage.close();
  await page.reload();
  await expect(
    myList.getByRole("checkbox", { name: "Medication" }),
  ).toBeChecked();
  await tripList.getByRole("button", { name: "Remove JR Pass" }).click();
  await expect(tripList.getByRole("checkbox", { name: "JR Pass" })).toHaveCount(
    0,
  );
});

test("trip tabs show icons in one bordered row and scroll on narrow screens", async ({
  page,
}, testInfo) => {
  const narrow = testInfo.project.name === "mobile-chromium";
  if (narrow) await page.setViewportSize({ width: 320, height: 650 });
  await page.emulateMedia({ colorScheme: "light" });
  await installFixture(page);
  await page.goto("/");
  const card = await openTrip(page);
  const dashboard = page.getByRole("region", { name: "Choose a trip" });
  const dashboardHeading = dashboard.getByRole("heading", {
    name: "Your trips",
  });
  const gapBelowHeading = async (content: Locator) => {
    const heading = (await dashboardHeading.boundingBox())!;
    const next = (await content.boundingBox())!;
    return next.y - heading.y - heading.height;
  };
  expect(await gapBelowHeading(card)).toBeLessThan(4);
  const title = await card
    .getByText("Bangkok Weekend", { exact: true })
    .boundingBox();
  const dates = await card
    .getByText("2026-11-01 — 2026-11-04", { exact: true })
    .boundingBox();
  expect(dates!.y).toBeGreaterThanOrEqual(title!.y + title!.height);
  const nav = page.getByRole("navigation", { name: "Trip sections" });
  const buttons = nav.getByRole("button");
  await expect(buttons).toHaveText([
    "Overview",
    "Itinerary",
    "Expenses",
    "Preparation",
    "Trip",
  ]);
  for (const button of await buttons.all()) {
    await expect(
      button.locator('svg[aria-hidden="true"][focusable="false"]'),
    ).toHaveCount(1);
  }
  const workspace = page.locator(".trip-workspace");
  const heading = await workspace.locator(":scope > h2").boundingBox();
  const metadata = await workspace.locator(":scope > p").boundingBox();
  expect(metadata!.y).toBeGreaterThanOrEqual(heading!.y + heading!.height);
  expect(metadata!.y - heading!.y - heading!.height).toBeLessThan(4);
  expect((await card.boundingBox())!.height).toBeLessThan(66);

  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      await page.getByRole("button", { name: "Switch to dark mode" }).click();
    }
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    expect(
      await nav.evaluate((row) => {
        const buttons = Array.from(row.querySelectorAll("button"));
        const selected = row.querySelector('[aria-current="page"]')!;
        const border = getComputedStyle(row);
        return {
          scrollable: row.scrollWidth > row.clientWidth,
          rows: new Set(buttons.map((button) => button.offsetTop)).size,
          pageFits: document.documentElement.scrollWidth <= innerWidth,
          hasBorder: [
            border.borderTopWidth,
            border.borderRightWidth,
            border.borderBottomWidth,
            border.borderLeftWidth,
          ].every((width) => parseFloat(width) > 0),
          hasTouchTargets: buttons.every(
            (button) => button.offsetWidth >= 44 && button.offsetHeight >= 44,
          ),
          hasSelection:
            getComputedStyle(selected).backgroundColor !==
            getComputedStyle(buttons[1]).backgroundColor,
        };
      }),
    ).toEqual({
      scrollable: narrow,
      rows: 1,
      pageFits: true,
      hasBorder: true,
      hasTouchTargets: true,
      hasSelection: true,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`trip-navigation-${theme}.png`),
      animations: "disabled",
    });
    await nav.getByRole("button", { name: "Itinerary", exact: true }).click();
    const itinerary = page.getByRole("region", { name: "Trip itinerary" });
    const viewToggle = itinerary.getByRole("navigation", {
      name: "Itinerary view",
    });
    const firstDay = itinerary.locator(".plan-day-heading").first();
    await expect(firstDay).toBeVisible();
    const viewBounds = (await viewToggle.boundingBox())!;
    const dayBounds = (await firstDay.boundingBox())!;
    expect(dayBounds.y - viewBounds.y - viewBounds.height).toBeLessThan(12);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath(`trip-itinerary-${theme}.png`),
      animations: "disabled",
    });
    await nav.getByRole("button", { name: "Overview", exact: true }).click();
  }

  await buttons.first().focus();
  for (const label of ["Itinerary", "Expenses", "Preparation", "Trip"]) {
    await page.keyboard.press("Tab");
    await expect(
      nav.getByRole("button", { name: label, exact: true }),
    ).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await page.reload();
  await expect(
    nav.getByRole("button", { name: "Trip", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if (narrow) {
    await expect
      .poll(() => nav.evaluate((row) => row.scrollLeft))
      .toBeGreaterThan(0);
    // Wider controls can wrap the sticky app header on a narrow screen.
    await page.addStyleTag({ content: "header { column-gap: 2rem; }" });
    await page.evaluate(() => window.scrollBy(0, 500));
    await expect
      .poll(async () => {
        const header = (await page.getByRole("banner").boundingBox())!;
        const row = (await nav.boundingBox())!;
        const gap = row.y - (header.y + header.height);
        return header.height > 68 && gap >= 0 && gap <= 1;
      })
      .toBe(true);
  }

  await page.route(/\/rest\/v1\/trips(?:\?|$)/, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.reload();
  const empty = dashboard.getByText("No approved trips yet.", { exact: false });
  await expect(empty).toBeVisible();
  expect(await gapBelowHeading(empty)).toBeLessThan(4);
});

test("Thai trip labels and itinerary stay readable on a narrow screen", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "Narrow touch viewport",
  );
  await page.setViewportSize({ width: 320, height: 720 });
  await installFixture(page, { longHotel: true });
  await page.goto("/");
  await openTrip(page);
  await page.getByRole("button", { name: "ไทย / English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "th");
  await expect(page.locator(".trip-workspace > p")).toContainText("ใช้งานอยู่");
  await expect(page.getByLabel("วันที่ในแผน")).toBeVisible();
  await expect(
    page.getByRole("strong").filter({ hasText: "ผู้ติดต่อฉุกเฉินในครอบครัว" }),
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("trip-overview-thai.png"),
    animations: "disabled",
  });

  const nav = page.getByRole("navigation", { name: "เมนูทริป" });
  const buttons = nav.getByRole("button");
  await expect(buttons).toHaveText([
    "ภาพรวม",
    "แผนการเดินทาง",
    "ค่าใช้จ่าย",
    "เตรียมตัว",
    "ทริป",
  ]);
  for (const button of await buttons.all()) {
    await button.scrollIntoViewIfNeeded();
    const row = (await nav.boundingBox())!;
    const bounds = (await button.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(row.x);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(row.x + row.width);
  }

  await nav.getByRole("button", { name: "แผนการเดินทาง", exact: true }).click();
  const itinerary = page.getByRole("region", { name: "แผนการเดินทาง" });
  await expect(
    itinerary.getByRole("button", { name: "แผนรายวัน" }),
  ).toBeVisible();
  await expect(itinerary.getByText("วันที่ 1", { exact: true })).toBeVisible();
  const stay = itinerary.locator(".plan-hotel-card").first();
  await expect(stay).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("trip-itinerary-thai.png"),
    animations: "disabled",
  });
});

test("header account icon opens the email panel and fits a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 650 });
  await installFixture(page);
  await page.goto("/");
  const header = page.getByRole("banner");
  const account = header.getByRole("button", { name: "Account", exact: true });
  await expect(account.locator("svg")).toBeVisible();
  await expect(
    page.getByText("fixture@example.test", { exact: true }),
  ).toHaveCount(0);
  await header.locator(".theme-toggle").focus();
  await page.keyboard.press("Tab");
  await expect(account).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    header.getByText("fixture@example.test", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  // Let the account menu's post-render effect register its Escape listener.
  await page.clock.runFor(150);
  await page.keyboard.press("Escape");
  await expect(account).toHaveAttribute("aria-expanded", "false");
  await expect(account).toBeFocused();
});

test("organizer can add the first stop to a selected free day from Overview", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-02T03:00:00.000Z"));
  const fixture = await installFixture(page, { daily: true });
  await page.goto("/");
  await openTrip(page);
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.getByText("Free day", { exact: false })).toBeVisible();
  const editor = page.locator(".stop-editor");
  await editor.locator("summary").click();
  await expect(editor.getByLabel("Day")).toHaveValue("2026-11-03");
  await editor.getByLabel("Place or activity").fill("Coffee in Chiang Mai");
  await editor.getByLabel("Activity tag").selectOption("food");
  await editor.getByRole("button", { name: "Save stop" }).click();
  await expect(
    page.locator("article.stop").filter({ hasText: "Coffee in Chiang Mai" }),
  ).toBeVisible();
  await expect(page.getByText("Free day", { exact: false })).toHaveCount(0);
  await expect(
    page
      .locator("article.stop")
      .filter({ hasText: "Coffee in Chiang Mai" })
      .getByText("Food", { exact: true }),
  ).toBeVisible();
  expect(
    fixture
      .getRpcCalls()
      .find((call) => call.fn === "upsert_tagged_itinerary_item")?.args,
  ).toMatchObject({
    p_plan_date: "2026-11-03",
    p_item_id: null,
    p_activity_tag: "food",
  });
});

test("full itinerary PDF can be downloaded and shared as an attachment", async ({
  page,
}, testInfo) => {
  await installFixture(page, { daily: true });
  await page.route("**/rest/v1/itinerary_items?*", async (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("plan_date")) return route.fallback();
    await route.fulfill({
      json: [
        {
          id: "export-stop",
          trip_id: tripId,
          plan_date: "2026-11-02",
          starts_at: "2026-11-02T02:00:00Z",
          title: "Wat Arun · วัดอรุณ",
          activity_tag: "sightseeing",
          notes: Array.from(
            { length: 32 },
            (_, i) => `Packing detail ${i + 1} · เตรียมหนังสือเดินทาง`,
          ).join("\n"),
          position: 1,
          version: 1,
        },
      ],
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      value: (data: ShareData) => data.files?.[0]?.type === "application/pdf",
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: async (data: ShareData) => {
        document.body.dataset.sharedFile = data.files?.[0]?.name ?? "";
      },
      configurable: true,
    });
  });
  await page.goto("/");
  await openTrip(page);
  await page.getByRole("button", { name: "Itinerary", exact: true }).click();
  const thai = !!testInfo.project.use.hasTouch;
  if (thai) await page.getByRole("button", { name: "ไทย / English" }).click();
  await page
    .getByText(
      thai ? "ส่งออกแผนการเดินทางเป็น PDF" : "Export itinerary as PDF",
      { exact: true },
    )
    .click();
  await page
    .getByRole("button", {
      name: thai ? "สร้าง PDF" : "Create PDF",
      exact: true,
    })
    .click();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: thai ? "ดาวน์โหลด PDF" : "Download PDF" })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("Bangkok Weekend.pdf");
  const output = testInfo.outputPath("itinerary.pdf");
  await file.saveAs(output);
  const bytes = (await readFile(output)).toString("latin1");
  expect(bytes).toMatch(/^%PDF-/);
  expect(bytes.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
  await page
    .getByRole("button", { name: thai ? "แชร์ PDF" : "Share PDF" })
    .click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-shared-file",
    file.suggestedFilename(),
  );
});
