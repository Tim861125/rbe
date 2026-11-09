export type GroupKey = "taipei" | "zhongli" | "hsinchu" | "taichung";

export type Group = { key: GroupKey; name: string; count: number };

export type SubmitResult = {
  ok: boolean;
  count?: number;
  lineSent?: boolean;
  /** 僅在 ok: false 時出現，為 API 400 的中文錯誤訊息（由呼叫方顯示） */
  error?: string;
};

type GroupsResponse = { groups: Group[]; total: number };

type SubmitSuccess = {
  ok: true;
  count: number;
  announced: boolean;
  lineSent: boolean;
};

type SubmitFail = { ok: false; error: string };

/**
 * 小組名單 + 人數更新流程。
 * useAsyncData 以固定 key 共用，可在多處呼叫而不重複打 API。
 */
export async function useGroups() {
  // 會 await：SSR 等資料回來才 render（卡片/組名會出现在 server html）
  // SSR 時用 useRequestFetch（nitro 內部 fetch，保留 request context）：
  // cloudflare_module preset 下綁定只掛在事件上，裸 $fetch 走外部 HTTP 會丟了
  // event.context.cloudflare.env（見 nuxt/nuxt#30433）；用戶端仍走 $fetch。
  const requestFetch = useRequestFetch();
  const fetchGroups = import.meta.server ? requestFetch : $fetch;
  // loadError：抓取失敗旗標，讓頁面分辨「載入中」與「載入失敗」（空陣列兩者同形）。
  const loadError = ref(false);
  const { data: groups, refresh } = await useAsyncData("groups", async () => {
    try {
      const res = await fetchGroups<GroupsResponse>("/api/groups");
      loadError.value = false;
      return res.groups;
    } catch (err) {
      console.error("[useGroups] fetch /api/groups failed", err);
      // API 失敗時回空陣列並記得錯誤狀態，讓頁面呈現載入失敗而不是無限載入中
      loadError.value = true;
      return [] as Group[];
    }
  }, { default: () => [] as Group[] });

  const total = computed(() =>
    groups.value.reduce((sum, g) => sum + g.count, 0)
  );

  async function submit(
    key: GroupKey,
    amount: number,
  ): Promise<SubmitResult> {
    try {
      const res = await $fetch<SubmitSuccess>(
        `/api/groups/${key}/registrations`,
        { method: "POST", body: { amount } },
      );
      return { ok: res.ok, count: res.count, lineSent: res.lineSent };
    } catch (err) {
      const data = (err as { data?: unknown } | null)?.data;
      const error
        = data
        && typeof data === "object"
        && "error" in data
        && typeof (data as SubmitFail).error === "string"
          ? (data as SubmitFail).error
          : "連線失敗，請稍後再試";
      return { ok: false, error };
    }
  }

  return { groups, total, loadError, refresh, submit };
}
