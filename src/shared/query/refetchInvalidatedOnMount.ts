// Reopening a trip tab can reuse successful data. Explicit invalidation and
// failed background refreshes still reload on mount. Uncached loads and
// window-focus/reconnect behavior are handled separately by TanStack Query.
export function refetchInvalidatedOnMount({
  state,
}: {
  state: { isInvalidated: boolean; status: string };
}) {
  return state.isInvalidated || state.status === "error";
}
